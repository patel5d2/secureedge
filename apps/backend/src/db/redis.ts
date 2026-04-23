import Redis from 'ioredis';
import { config } from '../config';
import { logger } from '../lib/logger';

export const redis = new Redis(config.REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    if (times > 5) return null; // stop retrying after 5 attempts
    return Math.min(times * 200, 2000);
  },
  lazyConnect: true,
});

redis.on('error', (err) => {
  logger.error({ err: err.message }, 'redis connection error');
});

redis.on('connect', () => {
  logger.info('redis connected');
});

export async function connectRedis(): Promise<void> {
  try {
    await redis.connect();
  } catch (err) {
    logger.warn({ err }, 'redis failed to connect — falling back to in-memory');
  }
}

export async function pingRedis(): Promise<boolean> {
  try {
    const pong = await redis.ping();
    return pong === 'PONG';
  } catch {
    return false;
  }
}

// ── Session cache helpers ────────────────────────────────────────────

const SESSION_PREFIX = 'sess:';

export async function cacheSession(sessionId: string, userId: string, ttlSeconds: number): Promise<void> {
  try {
    await redis.set(`${SESSION_PREFIX}${sessionId}`, userId, 'EX', ttlSeconds);
  } catch {
    /* Redis down — auth falls back to DB check */
  }
}

export async function isSessionCached(sessionId: string): Promise<boolean | null> {
  try {
    const val = await redis.get(`${SESSION_PREFIX}${sessionId}`);
    if (val === null) return null; // cache miss → must check DB
    return true; // cache hit → session is valid
  } catch {
    return null; // Redis down → fall back to DB
  }
}

export async function invalidateSession(sessionId: string): Promise<void> {
  try {
    await redis.del(`${SESSION_PREFIX}${sessionId}`);
  } catch {
    /* best-effort */
  }
}
