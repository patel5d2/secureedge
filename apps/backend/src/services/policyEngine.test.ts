/**
 * Policy Engine unit tests.
 *
 * These test the pure-logic functions that don't need a database.
 * We use vitest mocks to stub out the `pool.query` calls and test the
 * exported `simulate`, `simulateAgainstPolicy`, `userCanAccess`, and
 * the internal condition evaluation logic via the public API surface.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database pool before importing anything that uses it
vi.mock('../db/client', () => ({
  pool: {
    query: vi.fn(),
  },
}));

import { simulate, userCanAccess, invalidatePolicyCache } from './policyEngine';
import { pool } from '../db/client';

const mockQuery = pool.query as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  invalidatePolicyCache();
});

// Helper to set up mock queries in order
function setupMocks(opts: {
  groupIds?: string[];
  device?: { id: string; managed: boolean; disk_encrypted: boolean; enrollment_status: string; registered_at: Date } | null;
  policies?: Array<{
    id: string;
    name: string;
    status: string;
    priority: number;
    rules: Record<string, unknown>;
    description?: string | null;
    created_by?: string | null;
    created_at?: Date;
    updated_at?: Date;
  }>;
}) {
  // Call 1: getUserGroupIds
  mockQuery.mockResolvedValueOnce({
    rows: (opts.groupIds || []).map((id) => ({ group_id: id })),
  });
  // Call 2: getPrimaryDevice
  mockQuery.mockResolvedValueOnce({
    rows: opts.device ? [opts.device] : [],
  });
  // Call 3: loadActivePolicies
  mockQuery.mockResolvedValueOnce({
    rows: opts.policies || [],
  });
}

describe('simulate', () => {
  it('returns denied with no_matching_policy when no policies match', async () => {
    setupMocks({ groupIds: ['g1'], device: null, policies: [] });

    const result = await simulate('user1', 'app1');

    expect(result.outcome).toBe('denied');
    expect(result.reason).toBe('no_matching_policy');
  });

  it('returns allowed when user matches policy and all conditions pass', async () => {
    setupMocks({
      groupIds: ['engineering-group'],
      device: {
        id: 'd1',
        managed: true,
        disk_encrypted: true,
        enrollment_status: 'enrolled',
        registered_at: new Date(),
      },
      policies: [
        {
          id: 'p1',
          name: 'Eng Access',
          status: 'active',
          priority: 10,
          rules: {
            who: { groups: ['engineering-group'] },
            what: { applications: ['app1'] },
            conditions: [
              { type: 'device_managed', value: true },
              { type: 'disk_encrypted', value: true },
            ],
          },
        },
      ],
    });

    const result = await simulate('user1', 'app1');

    expect(result.outcome).toBe('allowed');
    expect(result.policyId).toBe('p1');
    expect(result.policyName).toBe('Eng Access');
  });

  it('returns denied when device is not managed', async () => {
    setupMocks({
      groupIds: ['eng'],
      device: {
        id: 'd1',
        managed: false,
        disk_encrypted: true,
        enrollment_status: 'enrolled',
        registered_at: new Date(),
      },
      policies: [
        {
          id: 'p1',
          name: 'Policy',
          status: 'active',
          priority: 10,
          rules: {
            who: { groups: ['eng'] },
            what: { applications: ['app1'] },
            conditions: [{ type: 'device_managed', value: true }],
          },
        },
      ],
    });

    const result = await simulate('user1', 'app1');

    expect(result.outcome).toBe('denied');
    expect(result.reason).toBe('device_not_managed');
  });

  it('returns denied when disk is not encrypted', async () => {
    setupMocks({
      groupIds: ['eng'],
      device: {
        id: 'd1',
        managed: true,
        disk_encrypted: false,
        enrollment_status: 'enrolled',
        registered_at: new Date(),
      },
      policies: [
        {
          id: 'p1',
          name: 'Policy',
          status: 'active',
          priority: 10,
          rules: {
            who: { groups: ['eng'] },
            what: { applications: ['app1'] },
            conditions: [{ type: 'disk_encrypted', value: true }],
          },
        },
      ],
    });

    const result = await simulate('user1', 'app1');

    expect(result.outcome).toBe('denied');
    expect(result.reason).toBe('disk_not_encrypted');
  });

  it('returns denied with mfa_required when MFA condition fails', async () => {
    setupMocks({
      groupIds: ['sales'],
      device: null,
      policies: [
        {
          id: 'p1',
          name: 'Sales CRM',
          status: 'active',
          priority: 20,
          rules: {
            who: { groups: ['sales'] },
            what: { applications: ['app1'] },
            conditions: [{ type: 'mfa_verified', value: true }],
          },
        },
      ],
    });

    // Override mfaVerified via context
    const result = await simulate('user1', 'app1', { mfaVerified: false });

    expect(result.outcome).toBe('denied');
    expect(result.reason).toBe('mfa_required');
  });

  it('returns denied with country_blocked for blocked country', async () => {
    setupMocks({
      groupIds: ['hr'],
      device: null,
      policies: [
        {
          id: 'p1',
          name: 'HR policy',
          status: 'active',
          priority: 50,
          rules: {
            who: { groups: ['hr'] },
            what: { applications: ['app1'] },
            conditions: [{ type: 'country', allowed: ['US', 'CA'] }],
          },
        },
      ],
    });

    const result = await simulate('user1', 'app1', { country: 'RU' });

    expect(result.outcome).toBe('denied');
    expect(result.reason).toBe('country_blocked');
  });

  it('returns denied with outside_time_window for out-of-range time', async () => {
    setupMocks({
      groupIds: ['contractors'],
      device: null,
      policies: [
        {
          id: 'p1',
          name: 'Contractor policy',
          status: 'active',
          priority: 30,
          rules: {
            who: { groups: ['contractors'] },
            what: { applications: ['app1'] },
            conditions: [{ type: 'time_range', start: '09:00', end: '18:00' }],
          },
        },
      ],
    });

    // 23:00 is outside 09:00-18:00
    const lateNight = new Date('2026-01-15T23:00:00');
    const result = await simulate('user1', 'app1', { now: lateNight });

    expect(result.outcome).toBe('denied');
    expect(result.reason).toBe('outside_time_window');
  });

  it('evaluates policies in priority order — first match wins', async () => {
    setupMocks({
      groupIds: ['eng', 'all'],
      device: { id: 'd1', managed: true, disk_encrypted: true, enrollment_status: 'enrolled', registered_at: new Date() },
      policies: [
        {
          id: 'p-strict',
          name: 'Strict',
          status: 'active',
          priority: 5,
          rules: {
            who: { groups: ['eng'] },
            what: { applications: ['app1'] },
            conditions: [{ type: 'device_managed', value: true }],
          },
        },
        {
          id: 'p-lax',
          name: 'Lax',
          status: 'active',
          priority: 100,
          rules: {
            who: { groups: ['all'] },
            what: { applications: ['app1'] },
            conditions: [],
          },
        },
      ],
    });

    const result = await simulate('user1', 'app1');

    // Should match the strict (priority 5) policy first
    expect(result.outcome).toBe('allowed');
    expect(result.policyId).toBe('p-strict');
  });

  it('skips policies that dont match the user', async () => {
    setupMocks({
      groupIds: ['eng'],
      device: null,
      policies: [
        {
          id: 'p1',
          name: 'Sales Only',
          status: 'active',
          priority: 10,
          rules: {
            who: { groups: ['sales'] },
            what: { applications: ['app1'] },
            conditions: [],
          },
        },
      ],
    });

    const result = await simulate('user1', 'app1');

    expect(result.outcome).toBe('denied');
    expect(result.reason).toBe('no_matching_policy');
  });

  it('matches user by user ID in the who clause', async () => {
    setupMocks({
      groupIds: [],
      device: null,
      policies: [
        {
          id: 'p1',
          name: 'Direct User Policy',
          status: 'active',
          priority: 10,
          rules: {
            who: { users: ['user1'] },
            what: { applications: ['app1'] },
            conditions: [],
          },
        },
      ],
    });

    const result = await simulate('user1', 'app1');

    expect(result.outcome).toBe('allowed');
    expect(result.policyId).toBe('p1');
  });
});

describe('userCanAccess', () => {
  it('returns true when simulate outcome is allowed', async () => {
    setupMocks({
      groupIds: ['g1'],
      device: null,
      policies: [
        {
          id: 'p1',
          name: 'Open',
          status: 'active',
          priority: 100,
          rules: {
            who: { groups: ['g1'] },
            what: { applications: ['app1'] },
            conditions: [],
          },
        },
      ],
    });

    const allowed = await userCanAccess('user1', 'app1');
    expect(allowed).toBe(true);
  });

  it('returns false when simulate outcome is denied', async () => {
    setupMocks({ groupIds: [], device: null, policies: [] });

    const allowed = await userCanAccess('user1', 'app1');
    expect(allowed).toBe(false);
  });
});
