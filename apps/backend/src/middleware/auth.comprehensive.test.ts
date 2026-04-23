/**
 * Comprehensive auth middleware tests.
 * Tests requireAuth (all branches) and optionalAuth.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import jwt from 'jsonwebtoken';

const TEST_SECRET = 'test-secret-for-comprehensive-auth-tests';

vi.mock('../config', () => ({
  config: {
    JWT_SECRET: 'test-secret-for-comprehensive-auth-tests',
    SESSION_TTL_SECONDS: 3600,
    NODE_ENV: 'test',
  },
}));

vi.mock('../db/client', () => ({
  pool: { query: vi.fn() },
}));

const mockIsSessionCached = vi.fn();
const mockCacheSession = vi.fn();
const mockInvalidateSession = vi.fn();

vi.mock('../db/redis', () => ({
  isSessionCached: (...args: any[]) => mockIsSessionCached(...args),
  cacheSession: (...args: any[]) => mockCacheSession(...args),
  invalidateSession: (...args: any[]) => mockInvalidateSession(...args),
}));

vi.mock('../lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { requireAuth, optionalAuth } from './auth';
import { pool } from '../db/client';

const mockQuery = pool.query as ReturnType<typeof vi.fn>;

function makeToken(payload: Record<string, unknown>, secret = TEST_SECRET) {
  return jwt.sign(payload, secret, { expiresIn: 3600 });
}

const validPayload = { sub: 'u-1', email: 'test@t.com', role: 'user', sid: 'sess-1', mfa: true };
const activeUser = { id: 'u-1', email: 'test@t.com', role: 'user', full_name: 'Test' };

function createRequireAuthApp() {
  const app = express();
  app.use(cookieParser());
  app.use(requireAuth);
  app.get('/protected', (req, res) => {
    res.json({
      userId: req.user?.id,
      sessionId: req.sessionId,
      mfaVerified: req.mfaVerified,
    });
  });
  return app;
}

function createOptionalAuthApp() {
  const app = express();
  app.use(cookieParser());
  app.use(optionalAuth);
  app.get('/public', (req, res) => {
    res.json({ userId: req.user?.id || null, sessionId: req.sessionId || null });
  });
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockIsSessionCached.mockResolvedValue(true);
  mockCacheSession.mockResolvedValue(undefined);
});

describe('requireAuth', () => {
  it('returns 401 when no cookie and no Bearer header', async () => {
    const res = await request(createRequireAuthApp()).get('/protected');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('unauthorized');
  });

  it('extracts token from Bearer Authorization header', async () => {
    const token = makeToken(validPayload);
    mockQuery.mockResolvedValueOnce({ rows: [activeUser] }); // loadUser

    const res = await request(createRequireAuthApp())
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.userId).toBe('u-1');
  });

  it('returns 401 for expired JWT', async () => {
    const token = jwt.sign(validPayload, TEST_SECRET, { expiresIn: -1 });
    const res = await request(createRequireAuthApp())
      .get('/protected')
      .set('Cookie', `se_token=${token}`);

    expect(res.status).toBe(401);
  });

  it('returns 401 for JWT signed with wrong secret', async () => {
    const token = makeToken(validPayload, 'wrong-secret');
    const res = await request(createRequireAuthApp())
      .get('/protected')
      .set('Cookie', `se_token=${token}`);

    expect(res.status).toBe(401);
  });

  it('returns 401 when user is not found in DB', async () => {
    const token = makeToken(validPayload);
    mockQuery.mockResolvedValueOnce({ rows: [] }); // user not found

    const res = await request(createRequireAuthApp())
      .get('/protected')
      .set('Cookie', `se_token=${token}`);

    expect(res.status).toBe(401);
  });

  it('returns 200 and skips session check when no sid in token', async () => {
    const token = makeToken({ sub: 'u-1', email: 'test@t.com', role: 'user' }); // no sid
    mockQuery.mockResolvedValueOnce({ rows: [activeUser] });

    const res = await request(createRequireAuthApp())
      .get('/protected')
      .set('Cookie', `se_token=${token}`);

    expect(res.status).toBe(200);
    expect(mockIsSessionCached).not.toHaveBeenCalled();
  });

  it('skips DB check when Redis cache returns true (hit)', async () => {
    const token = makeToken(validPayload);
    mockQuery.mockResolvedValueOnce({ rows: [activeUser] }); // loadUser
    mockIsSessionCached.mockResolvedValueOnce(true);

    const res = await request(createRequireAuthApp())
      .get('/protected')
      .set('Cookie', `se_token=${token}`);

    expect(res.status).toBe(200);
    // loadUser is the only DB query — no session check query
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  it('falls back to DB when Redis cache miss, re-caches valid session', async () => {
    const token = makeToken(validPayload);
    mockQuery.mockResolvedValueOnce({ rows: [activeUser] }); // loadUser
    mockIsSessionCached.mockResolvedValueOnce(null); // cache miss
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'sess-1' }] }); // DB session valid

    const res = await request(createRequireAuthApp())
      .get('/protected')
      .set('Cookie', `se_token=${token}`);

    expect(res.status).toBe(200);
    expect(mockCacheSession).toHaveBeenCalledWith('sess-1', 'u-1', 3600);
  });

  it('returns 401 when Redis miss and DB session is revoked', async () => {
    const token = makeToken(validPayload);
    mockQuery.mockResolvedValueOnce({ rows: [activeUser] }); // loadUser
    mockIsSessionCached.mockResolvedValueOnce(null); // cache miss
    mockQuery.mockResolvedValueOnce({ rows: [] }); // DB session revoked

    const res = await request(createRequireAuthApp())
      .get('/protected')
      .set('Cookie', `se_token=${token}`);

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('session_expired_or_revoked');
  });

  it('sets req.mfaVerified = true when mfa claim is true', async () => {
    const token = makeToken({ ...validPayload, mfa: true });
    mockQuery.mockResolvedValueOnce({ rows: [activeUser] });

    const res = await request(createRequireAuthApp())
      .get('/protected')
      .set('Cookie', `se_token=${token}`);

    expect(res.body.mfaVerified).toBe(true);
  });

  it('sets req.mfaVerified = false when mfa claim is false', async () => {
    const token = makeToken({ ...validPayload, mfa: false });
    mockQuery.mockResolvedValueOnce({ rows: [activeUser] });

    const res = await request(createRequireAuthApp())
      .get('/protected')
      .set('Cookie', `se_token=${token}`);

    expect(res.body.mfaVerified).toBe(false);
  });
});

describe('optionalAuth', () => {
  it('calls next() with no user when no token is present', async () => {
    const res = await request(createOptionalAuthApp()).get('/public');
    expect(res.status).toBe(200);
    expect(res.body.userId).toBeNull();
  });

  it('attaches user when valid token is present', async () => {
    const token = makeToken(validPayload);
    mockQuery.mockResolvedValueOnce({ rows: [activeUser] });

    const res = await request(createOptionalAuthApp())
      .get('/public')
      .set('Cookie', `se_token=${token}`);

    expect(res.status).toBe(200);
    expect(res.body.userId).toBe('u-1');
  });

  it('calls next() without user when token is invalid (swallowed)', async () => {
    const token = makeToken(validPayload, 'wrong-secret');

    const res = await request(createOptionalAuthApp())
      .get('/public')
      .set('Cookie', `se_token=${token}`);

    expect(res.status).toBe(200);
    expect(res.body.userId).toBeNull();
  });
});
