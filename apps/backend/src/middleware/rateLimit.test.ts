/**
 * Rate limiter tests.
 * The RedisStore constructor needs a class mock to work.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('ioredis', () => {
  class MockRedis {
    set = vi.fn().mockResolvedValue('OK');
    get = vi.fn().mockResolvedValue(null);
    del = vi.fn().mockResolvedValue(1);
    ping = vi.fn().mockResolvedValue('PONG');
    connect = vi.fn().mockResolvedValue(undefined);
    on = vi.fn();
    call = vi.fn().mockResolvedValue('OK');
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

vi.mock('rate-limit-redis', () => {
  class MockRedisStore {
    constructor(_opts?: unknown) {}
    init = vi.fn();
    get = vi.fn();
    increment = vi.fn().mockResolvedValue({ totalHits: 1, resetTime: new Date() });
    decrement = vi.fn();
    resetKey = vi.fn();
  }
  return { default: MockRedisStore };
});

import { authLimiter, apiLimiter } from './rateLimit';

describe('rate limiters', () => {
  it('exports authLimiter as a middleware function', () => {
    expect(typeof authLimiter).toBe('function');
  });

  it('exports apiLimiter as a middleware function', () => {
    expect(typeof apiLimiter).toBe('function');
  });
});
