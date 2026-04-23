/**
 * Comprehensive policy engine tests.
 * Covers simulateAgainstPolicy, policy cache, unknown conditions,
 * country edge cases, and condition reason mapping.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../db/client', () => ({
  pool: { query: vi.fn() },
}));

vi.mock('../lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { pool } from '../db/client';
import {
  simulate,
  simulateAgainstPolicy,
  invalidatePolicyCache,
} from './policyEngine';

const mockQuery = pool.query as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  invalidatePolicyCache();
});

// Helper to set up standard mock responses for simulate()
function setupSimulateMocks(opts: {
  groups?: string[];
  device?: { id: string; managed: boolean; disk_encrypted: boolean; enrollment_status: string; registered_at: Date } | null;
  policies?: any[];
}) {
  // getUserGroupIds
  mockQuery.mockResolvedValueOnce({
    rows: (opts.groups || []).map((g) => ({ group_id: g })),
  });
  // getPrimaryDevice
  mockQuery.mockResolvedValueOnce({ rows: opts.device ? [opts.device] : [] });
  // loadActivePolicies
  mockQuery.mockResolvedValueOnce({ rows: opts.policies || [] });
}

describe('simulateAgainstPolicy', () => {
  it('returns denied with policy_not_found when policy does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }); // policy lookup

    const result = await simulateAgainstPolicy('u-1', 'app-1', 'nonexistent-policy-id');
    expect(result.outcome).toBe('denied');
    expect(result.reason).toBe('policy_not_found');
  });

  it('returns denied with subject_not_in_policy when user/group not matched', async () => {
    const policy = {
      id: 'p-1',
      name: 'Test Policy',
      rules: {
        who: { users: ['other-user'] },
        what: { applications: ['app-1'] },
        conditions: [],
      },
    };
    // policy lookup
    mockQuery.mockResolvedValueOnce({ rows: [policy] });
    // getUserGroupIds
    mockQuery.mockResolvedValueOnce({ rows: [] });
    // getPrimaryDevice
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const result = await simulateAgainstPolicy('u-1', 'app-1', 'p-1');
    expect(result.outcome).toBe('denied');
    expect(result.reason).toBe('subject_not_in_policy');
    expect(result.policyId).toBe('p-1');
  });

  it('returns denied with app_not_in_policy when app is not in what.applications', async () => {
    const policy = {
      id: 'p-1',
      name: 'Test Policy',
      rules: {
        who: { users: ['u-1'] },
        what: { applications: ['other-app'] },
        conditions: [],
      },
    };
    mockQuery.mockResolvedValueOnce({ rows: [policy] });
    mockQuery.mockResolvedValueOnce({ rows: [] });
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const result = await simulateAgainstPolicy('u-1', 'app-1', 'p-1');
    expect(result.outcome).toBe('denied');
    expect(result.reason).toBe('app_not_in_policy');
  });

  it('returns allowed when all conditions pass', async () => {
    const policy = {
      id: 'p-1',
      name: 'Pass Policy',
      rules: {
        who: { users: ['u-1'] },
        what: { applications: ['app-1'] },
        conditions: [{ type: 'mfa_verified', value: true }],
      },
    };
    mockQuery.mockResolvedValueOnce({ rows: [policy] });
    mockQuery.mockResolvedValueOnce({ rows: [] });
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const result = await simulateAgainstPolicy('u-1', 'app-1', 'p-1', { mfaVerified: true });
    expect(result.outcome).toBe('allowed');
    expect(result.conditions_checked).toHaveLength(1);
    expect(result.conditions_checked![0].passed).toBe(true);
  });

  it('returns denied with correct reason when condition fails', async () => {
    const policy = {
      id: 'p-1',
      name: 'Strict Policy',
      rules: {
        who: { users: ['u-1'] },
        what: { applications: ['app-1'] },
        conditions: [
          { type: 'device_managed', value: true },
          { type: 'disk_encrypted', value: true },
        ],
      },
    };
    mockQuery.mockResolvedValueOnce({ rows: [policy] });
    mockQuery.mockResolvedValueOnce({ rows: [] });
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const result = await simulateAgainstPolicy('u-1', 'app-1', 'p-1', {
      deviceManaged: false,
      diskEncrypted: true,
    });
    expect(result.outcome).toBe('denied');
    expect(result.reason).toBe('device_not_managed');
  });
});

describe('simulate — additional coverage', () => {
  it('uses policy cache on second call within TTL', async () => {
    const policies = [
      {
        id: 'p-1',
        name: 'Cached',
        rules: {
          who: { users: ['u-1'] },
          what: { applications: ['app-1'] },
          conditions: [],
        },
      },
    ];

    // First call: full DB queries
    setupSimulateMocks({ policies });
    await simulate('u-1', 'app-1');

    // Second call: cache hit — only getUserGroupIds + getPrimaryDevice, no loadActivePolicies
    mockQuery.mockResolvedValueOnce({ rows: [] }); // groups
    mockQuery.mockResolvedValueOnce({ rows: [] }); // device

    const result = await simulate('u-1', 'app-1');
    expect(result.outcome).toBe('allowed');
    // 3 queries first time + 2 second time = 5 total
    expect(mockQuery).toHaveBeenCalledTimes(5);
  });

  it('handles unknown condition type with fail-safe deny', async () => {
    const policies = [
      {
        id: 'p-1',
        name: 'Unknown Cond',
        rules: {
          who: { users: ['u-1'] },
          what: { applications: ['app-1'] },
          conditions: [{ type: 'biometric_scan', value: true } as any],
        },
      },
    ];
    setupSimulateMocks({ policies });

    const result = await simulate('u-1', 'app-1');
    expect(result.outcome).toBe('denied');
    expect(result.reason).toBe('condition_failed');
  });

  it('returns denied with country_blocked when country is undefined', async () => {
    const policies = [
      {
        id: 'p-1',
        name: 'Country Policy',
        rules: {
          who: { users: ['u-1'] },
          what: { applications: ['app-1'] },
          conditions: [{ type: 'country', allowed: ['US', 'CA'] }],
        },
      },
    ];
    setupSimulateMocks({ policies });

    // No country in context
    const result = await simulate('u-1', 'app-1', {});
    expect(result.outcome).toBe('denied');
    expect(result.reason).toBe('country_blocked');
  });

  it('time_range: allows when exactly at start time', async () => {
    const policies = [
      {
        id: 'p-1',
        name: 'Time Policy',
        rules: {
          who: { users: ['u-1'] },
          what: { applications: ['app-1'] },
          conditions: [{ type: 'time_range', start: '09:00', end: '17:00' }],
        },
      },
    ];
    setupSimulateMocks({ policies });

    // Set now to exactly 09:00
    const now = new Date();
    now.setHours(9, 0, 0, 0);
    const result = await simulate('u-1', 'app-1', { now });
    expect(result.outcome).toBe('allowed');
  });

  it('uses device data from DB when no overrides are provided', async () => {
    const device = {
      id: 'd-1',
      managed: true,
      disk_encrypted: true,
      enrollment_status: 'enrolled',
      registered_at: new Date(),
    };
    const policies = [
      {
        id: 'p-1',
        name: 'Device Policy',
        rules: {
          who: { users: ['u-1'] },
          what: { applications: ['app-1'] },
          conditions: [
            { type: 'device_managed', value: true },
            { type: 'disk_encrypted', value: true },
          ],
        },
      },
    ];
    setupSimulateMocks({ device, policies });

    const result = await simulate('u-1', 'app-1');
    expect(result.outcome).toBe('allowed');
  });
});
