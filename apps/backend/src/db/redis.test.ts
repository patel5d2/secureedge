/**
 * Redis module tests.
 * Tests cacheSession, isSessionCached, invalidateSession, pingRedis, connectRedis.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

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

// Import AFTER mocks — `redis` will be a MockRedis instance
import { redis, cacheSession, isSessionCached, invalidateSession, pingRedis, connectRedis } from './redis';
import { logger } from '../lib/logger';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('cacheSession', () => {
  it('sets key with TTL in Redis', async () => {
    (redis.set as ReturnType<typeof vi.fn>).mockResolvedValueOnce('OK');
    await cacheSession('sess-1', 'u-1', 3600);
    expect(redis.set).toHaveBeenCalledWith('sess:sess-1', 'u-1', 'EX', 3600);
  });

  it('silently fails on Redis error', async () => {
    (redis.set as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Redis down'));
    await expect(cacheSession('sess-1', 'u-1', 3600)).resolves.toBeUndefined();
  });
});

describe('isSessionCached', () => {
  it('returns true on cache hit', async () => {
    (redis.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce('u-1');
    const result = await isSessionCached('sess-1');
    expect(result).toBe(true);
    expect(redis.get).toHaveBeenCalledWith('sess:sess-1');
  });

  it('returns null on cache miss', async () => {
    (redis.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    const result = await isSessionCached('sess-1');
    expect(result).toBeNull();
  });

  it('returns null on Redis error', async () => {
    (redis.get as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Redis down'));
    const result = await isSessionCached('sess-1');
    expect(result).toBeNull();
  });
});

describe('invalidateSession', () => {
  it('deletes the session key from Redis', async () => {
    (redis.del as ReturnType<typeof vi.fn>).mockResolvedValueOnce(1);
    await invalidateSession('sess-1');
    expect(redis.del).toHaveBeenCalledWith('sess:sess-1');
  });

  it('silently fails on Redis error', async () => {
    (redis.del as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Redis down'));
    await expect(invalidateSession('sess-1')).resolves.toBeUndefined();
  });
});

describe('pingRedis', () => {
  it('returns true when Redis responds with PONG', async () => {
    (redis.ping as ReturnType<typeof vi.fn>).mockResolvedValueOnce('PONG');
    const result = await pingRedis();
    expect(result).toBe(true);
  });

  it('returns false on error', async () => {
    (redis.ping as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('timeout'));
    const result = await pingRedis();
    expect(result).toBe(false);
  });
});

describe('connectRedis', () => {
  it('connects successfully without error', async () => {
    (redis.connect as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);
    await expect(connectRedis()).resolves.toBeUndefined();
  });

  it('logs warning on connection failure without crashing', async () => {
    (redis.connect as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('refused'));
    await expect(connectRedis()).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.any(Error) }),
      expect.stringContaining('redis failed to connect')
    );
  });
});
