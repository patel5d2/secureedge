/**
 * Redis module tests.
 * Tests cacheSession, isSessionCached, invalidateSession, pingRedis, connectRedis.
 * Mocks the ioredis client to test success and failure paths.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSet = vi.fn();
const mockGet = vi.fn();
const mockDel = vi.fn();
const mockPing = vi.fn();
const mockConnect = vi.fn();
const mockOn = vi.fn();

vi.mock('ioredis', () => {
  // Return a constructor function (class) so `new Redis(...)` works
  const RedisMock = vi.fn().mockImplementation(() => ({
    set: mockSet,
    get: mockGet,
    del: mockDel,
    ping: mockPing,
    connect: mockConnect,
    on: mockOn,
    call: vi.fn(),
    quit: vi.fn(),
  }));
  return { default: RedisMock };
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

import { cacheSession, isSessionCached, invalidateSession, pingRedis, connectRedis } from './redis';
import { logger } from '../lib/logger';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('cacheSession', () => {
  it('sets key with TTL in Redis', async () => {
    mockSet.mockResolvedValueOnce('OK');
    await cacheSession('sess-1', 'u-1', 3600);
    expect(mockSet).toHaveBeenCalledWith('sess:sess-1', 'u-1', 'EX', 3600);
  });

  it('silently fails on Redis error', async () => {
    mockSet.mockRejectedValueOnce(new Error('Redis down'));
    await expect(cacheSession('sess-1', 'u-1', 3600)).resolves.toBeUndefined();
  });
});

describe('isSessionCached', () => {
  it('returns true on cache hit', async () => {
    mockGet.mockResolvedValueOnce('u-1');
    const result = await isSessionCached('sess-1');
    expect(result).toBe(true);
    expect(mockGet).toHaveBeenCalledWith('sess:sess-1');
  });

  it('returns null on cache miss', async () => {
    mockGet.mockResolvedValueOnce(null);
    const result = await isSessionCached('sess-1');
    expect(result).toBeNull();
  });

  it('returns null on Redis error', async () => {
    mockGet.mockRejectedValueOnce(new Error('Redis down'));
    const result = await isSessionCached('sess-1');
    expect(result).toBeNull();
  });
});

describe('invalidateSession', () => {
  it('deletes the session key from Redis', async () => {
    mockDel.mockResolvedValueOnce(1);
    await invalidateSession('sess-1');
    expect(mockDel).toHaveBeenCalledWith('sess:sess-1');
  });

  it('silently fails on Redis error', async () => {
    mockDel.mockRejectedValueOnce(new Error('Redis down'));
    await expect(invalidateSession('sess-1')).resolves.toBeUndefined();
  });
});

describe('pingRedis', () => {
  it('returns true when Redis responds with PONG', async () => {
    mockPing.mockResolvedValueOnce('PONG');
    const result = await pingRedis();
    expect(result).toBe(true);
  });

  it('returns false on error', async () => {
    mockPing.mockRejectedValueOnce(new Error('timeout'));
    const result = await pingRedis();
    expect(result).toBe(false);
  });
});

describe('connectRedis', () => {
  it('connects successfully without error', async () => {
    mockConnect.mockResolvedValueOnce(undefined);
    await expect(connectRedis()).resolves.toBeUndefined();
  });

  it('logs warning on connection failure without crashing', async () => {
    mockConnect.mockRejectedValueOnce(new Error('refused'));
    await expect(connectRedis()).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.any(Error) }),
      expect.stringContaining('redis failed to connect')
    );
  });
});
