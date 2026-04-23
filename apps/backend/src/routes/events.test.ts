/**
 * SSE events route tests.
 * Tests the /stream endpoint setup and event emission.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import http from 'http';

const TEST_SECRET = 'test-events-route-secret-for-unit-tests';

vi.mock('../config', () => ({
  config: {
    JWT_SECRET: 'test-events-route-secret-for-unit-tests',
    SESSION_TTL_SECONDS: 3600,
    NODE_ENV: 'test',
    CORS_ORIGIN: 'http://localhost:5173',
  },
}));

vi.mock('../db/client', () => ({
  pool: { query: vi.fn() },
}));

vi.mock('../db/redis', () => ({
  cacheSession: vi.fn().mockResolvedValue(undefined),
  invalidateSession: vi.fn().mockResolvedValue(undefined),
  isSessionCached: vi.fn().mockResolvedValue(true),
}));

vi.mock('../middleware/rateLimit', () => ({
  authLimiter: (_req: any, _res: any, next: any) => next(),
  apiLimiter: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn(), fatal: vi.fn() },
}));

vi.mock('../services/auditLog', () => ({
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
}));

import eventsRouter from './events';
import { pool } from '../db/client';
import { subscribe, unsubscribe } from '../services/auditLog';

const mockQuery = pool.query as ReturnType<typeof vi.fn>;

const activeUser = { id: 'u-1', email: 'user@test.com', role: 'user', full_name: 'User' };

function userToken() {
  return jwt.sign(
    { sub: 'u-1', email: 'user@test.com', role: 'user', sid: 'sess-1', mfa: true },
    TEST_SECRET,
    { expiresIn: 3600 }
  );
}

function createApp() {
  const app = express();
  app.use(cookieParser());
  app.use('/api/events', eventsRouter);
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/events/stream', () => {
  it('returns SSE headers and hello event, then unsubscribes on close', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [activeUser] }); // loadUser

    const app = createApp();
    const server = http.createServer(app);

    await new Promise<void>((resolve) => {
      server.listen(0, () => resolve());
    });

    const addr = server.address() as { port: number };
    const url = `http://127.0.0.1:${addr.port}/api/events/stream`;

    const controller = new AbortController();

    try {
      const response = await fetch(url, {
        headers: { Cookie: `se_token=${userToken()}` },
        signal: controller.signal,
      });

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('text/event-stream');
      expect(response.headers.get('cache-control')).toBe('no-cache');

      // Read the first chunk (should contain hello event)
      const reader = response.body!.getReader();
      const { value } = await reader.read();
      const text = new TextDecoder().decode(value);
      expect(text).toContain('event: hello');
      expect(text).toContain('"ok":true');

      // Verify subscribe was called
      expect(subscribe).toHaveBeenCalledWith(expect.any(Function));

      // Close the connection
      controller.abort();
    } catch (e) {
      // AbortError is expected
      if (e instanceof Error && e.name !== 'AbortError') throw e;
    }

    // Wait a tick for cleanup handlers to fire
    await new Promise((r) => setTimeout(r, 50));

    // Verify unsubscribe was called
    expect(unsubscribe).toHaveBeenCalled();

    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('returns 401 without auth token', async () => {
    const app = createApp();
    const server = http.createServer(app);

    await new Promise<void>((resolve) => {
      server.listen(0, () => resolve());
    });

    const addr = server.address() as { port: number };
    const url = `http://127.0.0.1:${addr.port}/api/events/stream`;

    const response = await fetch(url);
    expect(response.status).toBe(401);

    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
});
