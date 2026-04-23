/**
 * Rate limiter tests.
 * Verifies that rate limiters are correctly configured and exported.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('ioredis', () => {
  class MockRedis {
    set = vi.fn();
    get = vi.fn();
    del = vi.fn();
    ping = vi.fn();
    connect = vi.fn();
    on = vi.fn();
    call = vi.fn();
    quit = vi.fn();
  }
  return { default: MockRedis };
});

vi.mock('../config', () => ({
  config: {
    REDIS_URL: 'redis://localhost:6379',
    NODE_ENV: 'test',
  },
}));

vi.mock('../lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { authLimiter, apiLimiter } from './rateLimit';

describe('rate limiters', () => {
  it('exports authLimiter as a middleware function', () => {
    expect(typeof authLimiter).toBe('function');
  });

  it('exports apiLimiter as a middleware function', () => {
    expect(typeof apiLimiter).toBe('function');
  });
});
