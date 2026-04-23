/**
 * Database client tests.
 * Tests pingDb function and pool error handler.
 *
 * Note: `pool.on('error', ...)` is called at module import time.
 * Because vi.mock runs before imports but vi.fn() instances inside the class
 * are the same ones used by the module code, we can inspect them before clearAllMocks.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('pg', () => {
  class MockPool {
    query = vi.fn();
    on = vi.fn();
    totalCount = 5;
    idleCount = 3;
    waitingCount = 1;
  }
  return { Pool: MockPool };
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

// Capture the error handler that was registered at module load time,
// BEFORE beforeEach clears the mock.
const onMock = pool.on as ReturnType<typeof vi.fn>;
const errorHandlerCall = onMock.mock.calls.find(
  (call: unknown[]) => call[0] === 'error'
);
const errorHandler = errorHandlerCall
  ? (errorHandlerCall[1] as (err: Error) => void)
  : undefined;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('pool', () => {
  it('registered an error event handler at module load time', () => {
    // We captured this before clearAllMocks, so the assertion checks the call was made
    expect(errorHandlerCall).toBeDefined();
    expect(typeof errorHandler).toBe('function');
  });

  it('error handler logs the error via pino', () => {
    const testError = new Error('pool broke');
    errorHandler!(testError);

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
    (pool.query as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('connection refused')
    );
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
