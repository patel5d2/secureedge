/**
 * Auth route unit tests.
 *
 * We mock out the database, Redis, and audit log so we can test the
 * login → MFA → logout flow in isolation without infrastructure.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';

// ── Mocks — vi.mock factories are hoisted, so avoid referencing outer vars ──

vi.mock('../config', () => ({
  config: {
    JWT_SECRET: 'test-secret-for-unit-tests-only-do-not-use',
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

vi.mock('../services/auditLog', () => ({
  logEvent: vi.fn().mockResolvedValue({}),
}));

vi.mock('../middleware/rateLimit', () => ({
  authLimiter: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn(), fatal: vi.fn() },
}));

// Import after mocks are registered
import authRouter from './auth';
import { pool } from '../db/client';
import { errorHandler } from '../middleware/errors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const mockQuery = pool.query as ReturnType<typeof vi.fn>;

// ── Test App ──────────────────────────────────────────────────────────

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', authRouter);
  app.use(errorHandler);
  return app;
}

// ── Fixtures ──────────────────────────────────────────────────────────

const HASHED_PASSWORD = bcrypt.hashSync('correct-password', 4);

const USER_ROW = {
  id: 'u-1',
  email: 'test@secureedge.dev',
  full_name: 'Test User',
  role: 'user',
  department: 'Engineering',
  status: 'active',
  password_hash: HASHED_PASSWORD,
  last_login_at: null,
};

// ── Tests ─────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/auth/login', () => {
  const app = createApp();

  it('returns 400 for missing password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@secureedge.dev' });

    expect(res.status).toBe(400);
  });

  it('returns 400 for missing email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ password: 'test' });

    expect(res.status).toBe(400);
  });

  it('returns 400 for empty password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@secureedge.dev', password: '' });

    expect(res.status).toBe(400);
  });

  it('returns 401 for unknown email', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'unknown@test.com', password: 'doesnotmatter' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('invalid_credentials');
  });

  it('returns 403 for inactive account', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ ...USER_ROW, status: 'suspended' }],
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@secureedge.dev', password: 'correct-password' });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('account_not_active');
  });

  it('returns 401 for user with no password_hash', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ ...USER_ROW, password_hash: null }],
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@secureedge.dev', password: 'correct-password' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('invalid_credentials');
  });

  it('returns 401 for wrong password', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [USER_ROW] });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@secureedge.dev', password: 'wrong-password' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('invalid_credentials');
  });

  it('returns 200 with JWT cookie and mfaRequired for valid login', async () => {
    // 1) user lookup
    mockQuery.mockResolvedValueOnce({ rows: [USER_ROW] });
    // 2) session insert
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'session-1' }] });
    // 3) update last_login_at
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@secureedge.dev', password: 'correct-password' });

    expect(res.status).toBe(200);
    expect(res.body.mfaRequired).toBe(true);
    expect(res.body.nextStep).toBe('mfa');
    expect(res.body.user.email).toBe('test@secureedge.dev');
    expect(res.body.user.password_hash).toBeUndefined(); // sanitized

    // JWT cookie should be set
    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    const tokenCookie = Array.isArray(cookies)
      ? cookies.find((c: string) => c.startsWith('se_token='))
      : cookies;
    expect(tokenCookie).toBeDefined();
  });

  it('sets mfa=false in pre-MFA JWT', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [USER_ROW] });
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'session-1' }] });
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@secureedge.dev', password: 'correct-password' });

    const cookies = res.headers['set-cookie'] as unknown as string[];
    const tokenCookie = cookies.find((c) => c.startsWith('se_token='));
    const tokenValue = tokenCookie!.split('=')[1].split(';')[0];
    const payload = jwt.decode(tokenValue) as Record<string, unknown>;

    expect(payload.mfa).toBe(false);
    expect(payload.sid).toBe('session-1');
  });
});

describe('POST /api/auth/mfa', () => {
  const app = createApp();

  function loginCookie(): string {
    const token = jwt.sign(
      { sub: 'u-1', email: 'test@secureedge.dev', role: 'user', sid: 'session-1', mfa: false },
      'test-secret-for-unit-tests-only-do-not-use',
      { expiresIn: 3600 }
    );
    return `se_token=${token}`;
  }

  it('returns 401 without auth cookie', async () => {
    const res = await request(app)
      .post('/api/auth/mfa')
      .send({ code: '123456' });

    expect(res.status).toBe(401);
  });

  it('returns 401 for invalid MFA code', async () => {
    // requireAuth calls loadUser
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'u-1', email: 'test@secureedge.dev', role: 'user', full_name: 'Test' }] });

    const res = await request(app)
      .post('/api/auth/mfa')
      .set('Cookie', loginCookie())
      .send({ code: '000000' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('invalid_mfa_code');
  });

  it('returns 200 and re-issues JWT with mfa=true for valid code', async () => {
    // requireAuth: loadUser
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'u-1', email: 'test@secureedge.dev', role: 'user', full_name: 'Test' }] });
    // MFA: update session mfa_verified_at
    mockQuery.mockResolvedValueOnce({ rows: [] });
    // MFA: fetch user for response
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 'u-1',
        email: 'test@secureedge.dev',
        full_name: 'Test User',
        role: 'user',
        department: 'Engineering',
        status: 'active',
        last_login_at: null,
      }],
    });

    const res = await request(app)
      .post('/api/auth/mfa')
      .set('Cookie', loginCookie())
      .send({ code: '123456' });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.user.email).toBe('test@secureedge.dev');

    // New JWT should have mfa=true
    const cookies = res.headers['set-cookie'] as unknown as string[];
    const tokenCookie = cookies.find((c) => c.startsWith('se_token='));
    const tokenValue = tokenCookie!.split('=')[1].split(';')[0];
    const payload = jwt.decode(tokenValue) as Record<string, unknown>;
    expect(payload.mfa).toBe(true);
  });
});

describe('POST /api/auth/logout', () => {
  const app = createApp();

  it('returns 200 and clears cookie even without a token', async () => {
    const res = await request(app).post('/api/auth/logout');

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('revokes session and clears cookie when token is present', async () => {
    const token = jwt.sign(
      { sub: 'u-1', email: 'test@secureedge.dev', role: 'user', sid: 'session-1', mfa: true },
      'test-secret-for-unit-tests-only-do-not-use',
      { expiresIn: 3600 }
    );

    // Session revocation update
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', `se_token=${token}`);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    // Verify the session revocation query was called
    expect(mockQuery).toHaveBeenCalledWith(
      'UPDATE sessions SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL',
      ['session-1']
    );
  });
});

describe('GET /api/auth/me', () => {
  const app = createApp();

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns current user when authenticated', async () => {
    const token = jwt.sign(
      { sub: 'u-1', email: 'test@secureedge.dev', role: 'user', sid: 'session-1', mfa: true },
      'test-secret-for-unit-tests-only-do-not-use',
      { expiresIn: 3600 }
    );

    // requireAuth: loadUser
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'u-1', email: 'test@secureedge.dev', role: 'user', full_name: 'Test' }] });
    // /me: fetch user
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 'u-1',
        email: 'test@secureedge.dev',
        full_name: 'Test User',
        role: 'user',
        department: 'Engineering',
        status: 'active',
        last_login_at: null,
      }],
    });

    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', `se_token=${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('test@secureedge.dev');
  });
});
