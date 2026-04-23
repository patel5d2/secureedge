/**
 * Database client tests.
 * Tests pool creation, error handler, and pingDb.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('pg', () => {
  const mockPool = {
    query: vi.fn(),
    on: vi.fn(),
    totalCount: 5,
    idleCount: 3,
    waitingCount: 1,
  };
  return { Pool: vi.fn(() => mockPool) };
});

vi.mock('../config', () => ({
  config: {
    DATABASE_URL: 'postgresql://localhost/test',
    NODE_ENV: 'test',
  },
}));

vi.mock('../lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { pool, pingDb } from './client';
import { logger } from '../lib/logger';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('pool', () => {
  it('registers an error event handler', () => {
    expect(pool.on).toHaveBeenCalledWith('error', expect.any(Function));
  });

  it('error handler logs the error via pino', () => {
    // Get the error handler that was registered
    const onCall = (pool.on as ReturnType<typeof vi.fn>).mock.calls.find(
      (call: unknown[]) => call[0] === 'error'
    );
    expect(onCall).toBeDefined();
    const errorHandler = onCall![1] as (err: Error) => void;

    const testError = new Error('pool broke');
    errorHandler(testError);

    expect(logger.error).toHaveBeenCalledWith(
      { err: testError },
      'unexpected database pool error'
    );
  });
});

describe('pingDb', () => {
  it('returns true when query succeeds with ok = 1', async () => {
    (pool.query as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      rows: [{ ok: 1 }],
    });
    const result = await pingDb();
    expect(result).toBe(true);
  });

  it('returns false when query fails', async () => {
    (pool.query as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('connection refused'));
    const result = await pingDb();
    expect(result).toBe(false);
  });

  it('returns false when query returns unexpected result', async () => {
    (pool.query as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      rows: [{ ok: 0 }],
    });
    const result = await pingDb();
    expect(result).toBe(false);
  });
});
