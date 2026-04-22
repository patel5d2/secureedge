import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { redis } from '../db/redis';

export const authLimiter = rateLimit({
  windowMs: 60_000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'too_many_requests' },
  // Use Redis store for distributed rate limiting across instances.
  // If Redis is not connected, express-rate-limit falls back to memory store.
  store: new RedisStore({
    // @ts-expect-error — rate-limit-redis accepts ioredis client
    sendCommand: (...args: string[]) => redis.call(...args),
  }),
});

/** General API limiter — more permissive than auth */
export const apiLimiter = rateLimit({
  windowMs: 60_000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'too_many_requests' },
  store: new RedisStore({
    // @ts-expect-error — rate-limit-redis accepts ioredis client
    sendCommand: (...args: string[]) => redis.call(...args),
  }),
});
