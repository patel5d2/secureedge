/**
 * Audit log service tests.
 * Tests logEvent (insert + enrichment + broadcast), subscribe/unsubscribe,
 * broadcast error handling, and recentEvents.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../db/client', () => ({
  pool: { query: vi.fn() },
}));

vi.mock('../lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { pool } from '../db/client';
import { logger } from '../lib/logger';
import { logEvent, recentEvents, subscribe, unsubscribe } from './auditLog';

const mockQuery = pool.query as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('logEvent', () => {
  const baseEvent = {
    id: 'ev-1',
    timestamp: new Date(),
    user_id: 'u-1',
    application_id: 'app-1',
    device_id: null,
    policy_id: null,
    outcome: 'allowed' as const,
    deny_reason: null,
    ip_address: '10.0.0.1',
    geo_country: 'US',
    session_id: null,
    raw_event: {},
  };

  it('inserts into access_events and returns enriched event', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [baseEvent] })                         // INSERT
      .mockResolvedValueOnce({ rows: [{ full_name: 'Alice', email: 'alice@test.com' }] })  // user
      .mockResolvedValueOnce({ rows: [{ name: 'Dashboard' }] });            // app

    const result = await logEvent({ outcome: 'allowed', userId: 'u-1', applicationId: 'app-1' });
    expect(result.id).toBe('ev-1');
    expect(result.user_name).toBe('Alice');
    expect(result.user_email).toBe('alice@test.com');
    expect(result.app_name).toBe('Dashboard');
  });

  it('handles logEvent without user_id (user_name/email null)', async () => {
    const noUserEvent = { ...baseEvent, user_id: null };
    mockQuery.mockResolvedValueOnce({ rows: [noUserEvent] }); // INSERT only
    // No user query should be made
    mockQuery.mockResolvedValueOnce({ rows: [{ name: 'App' }] }); // app query

    const result = await logEvent({ outcome: 'allowed', applicationId: 'app-1' });
    expect(result.user_name).toBeNull();
    expect(result.user_email).toBeNull();
    expect(result.app_name).toBe('App');
  });

  it('handles logEvent without application_id (app_name null)', async () => {
    const noAppEvent = { ...baseEvent, application_id: null };
    mockQuery
      .mockResolvedValueOnce({ rows: [noAppEvent] })
      .mockResolvedValueOnce({ rows: [{ full_name: 'Bob', email: 'bob@test.com' }] });

    const result = await logEvent({ outcome: 'denied', userId: 'u-1', denyReason: 'blocked' });
    expect(result.app_name).toBeNull();
    expect(result.user_name).toBe('Bob');
  });

  it('handles user not found in users table', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [baseEvent] })
      .mockResolvedValueOnce({ rows: [] })  // user not found
      .mockResolvedValueOnce({ rows: [{ name: 'App' }] });

    const result = await logEvent({ outcome: 'allowed', userId: 'u-1', applicationId: 'app-1' });
    expect(result.user_name).toBeNull();
    expect(result.user_email).toBeNull();
  });

  it('handles app not found in applications table', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [baseEvent] })
      .mockResolvedValueOnce({ rows: [{ full_name: 'X', email: 'x@t.com' }] })
      .mockResolvedValueOnce({ rows: [] });  // app not found

    const result = await logEvent({ outcome: 'allowed', userId: 'u-1', applicationId: 'app-1' });
    expect(result.app_name).toBeNull();
  });

  it('passes null for optional fields', async () => {
    const minEvent = { ...baseEvent, user_id: null, application_id: null };
    mockQuery.mockResolvedValueOnce({ rows: [minEvent] });

    const result = await logEvent({ outcome: 'denied' });
    expect(mockQuery).toHaveBeenCalledTimes(1); // Only INSERT, no enrichment queries
    expect(result.user_name).toBeNull();
    expect(result.app_name).toBeNull();
  });

  it('broadcasts enriched event to subscribers', async () => {
    const handler = vi.fn();
    subscribe(handler);
    try {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ ...baseEvent, user_id: null, application_id: null }] });

      await logEvent({ outcome: 'allowed' });
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'ev-1', outcome: 'allowed' })
      );
    } finally {
      unsubscribe(handler);
    }
  });
});

describe('subscribe / unsubscribe', () => {
  it('subscribe receives future events', async () => {
    const handler = vi.fn();
    subscribe(handler);

    const event = { id: 'ev-2', user_id: null, application_id: null, outcome: 'allowed' as const };
    mockQuery.mockResolvedValueOnce({ rows: [event] });

    await logEvent({ outcome: 'allowed' });
    expect(handler).toHaveBeenCalledTimes(1);

    unsubscribe(handler);
  });

  it('unsubscribe stops receiving events', async () => {
    const handler = vi.fn();
    subscribe(handler);
    unsubscribe(handler);

    const event = { id: 'ev-3', user_id: null, application_id: null, outcome: 'denied' as const };
    mockQuery.mockResolvedValueOnce({ rows: [event] });

    await logEvent({ outcome: 'denied' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('broadcast catches subscriber errors and logs them', async () => {
    const badHandler = vi.fn(() => { throw new Error('boom'); });
    const goodHandler = vi.fn();
    subscribe(badHandler);
    subscribe(goodHandler);

    const event = { id: 'ev-4', user_id: null, application_id: null, outcome: 'allowed' as const };
    mockQuery.mockResolvedValueOnce({ rows: [event] });

    await logEvent({ outcome: 'allowed' });

    expect(badHandler).toHaveBeenCalled();
    expect(goodHandler).toHaveBeenCalled(); // Still called despite prior error
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.any(Error) }),
      'audit log subscriber error'
    );

    unsubscribe(badHandler);
    unsubscribe(goodHandler);
  });
});

describe('recentEvents', () => {
  it('returns events with enrichment', async () => {
    const rows = [
      { id: 'ev-1', user_name: 'Alice', user_email: 'a@t.com', app_name: 'App1' },
    ];
    mockQuery.mockResolvedValueOnce({ rows });

    const result = await recentEvents(10);
    expect(result).toHaveLength(1);
    expect(result[0].user_name).toBe('Alice');
  });

  it('clamps limit to range 1-500', async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    await recentEvents(0);
    expect(mockQuery).toHaveBeenCalledWith(expect.any(String), [1]);

    mockQuery.mockClear();
    await recentEvents(1000);
    expect(mockQuery).toHaveBeenCalledWith(expect.any(String), [500]);
  });

  it('defaults limit to 20', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await recentEvents();
    expect(mockQuery).toHaveBeenCalledWith(expect.any(String), [20]);
  });
});
