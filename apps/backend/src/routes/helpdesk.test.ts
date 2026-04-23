/**
 * Helpdesk route comprehensive tests.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import jwt from 'jsonwebtoken';

const TEST_SECRET = 'test-helpdesk-route-secret-for-unit-tests';

vi.mock('../config', () => ({
  config: {
    JWT_SECRET: 'test-helpdesk-route-secret-for-unit-tests',
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
  apiLimiter: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn(), fatal: vi.fn() },
}));

import helpdeskRouter from './helpdesk';
import { errorHandler } from '../middleware/errors';
import { pool } from '../db/client';
import { invalidateSession } from '../db/redis';

const mockQuery = pool.query as ReturnType<typeof vi.fn>;

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/helpdesk', helpdeskRouter);
  app.use(errorHandler);
  return app;
}

function helpdeskToken() {
  return jwt.sign(
    { sub: 'hd-1', email: 'helpdesk@test.com', role: 'helpdesk', sid: 'sess-1', mfa: true },
    TEST_SECRET,
    { expiresIn: 3600 }
  );
}

function userToken() {
  return jwt.sign(
    { sub: 'u-1', email: 'user@test.com', role: 'user', sid: 'sess-2', mfa: true },
    TEST_SECRET,
    { expiresIn: 3600 }
  );
}

const helpdeskUser = { id: 'hd-1', email: 'helpdesk@test.com', role: 'helpdesk', full_name: 'Helpdesk' };
const regularUser = { id: 'u-1', email: 'user@test.com', role: 'user', full_name: 'User' };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Helpdesk route auth enforcement', () => {
  const app = createApp();

  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/helpdesk/dashboard');
    expect(res.status).toBe(401);
  });

  it('returns 403 for regular user role', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [regularUser] });
    const res = await request(app)
      .get('/api/helpdesk/dashboard')
      .set('Cookie', `se_token=${userToken()}`);
    expect(res.status).toBe(403);
  });
});

describe('GET /api/helpdesk/dashboard', () => {
  const app = createApp();

  it('returns dashboard stats', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [helpdeskUser] });
    mockQuery.mockResolvedValueOnce({ rows: [{ count: '10' }] }); // active
    mockQuery.mockResolvedValueOnce({ rows: [{ count: '5' }] }); // denials
    mockQuery.mockResolvedValueOnce({ rows: [{ count: '3' }] }); // open
    mockQuery.mockResolvedValueOnce({ rows: [{ count: '1' }] }); // critical
    mockQuery.mockResolvedValueOnce({ rows: [{ count: '50' }] }); // allowed

    const res = await request(app)
      .get('/api/helpdesk/dashboard')
      .set('Cookie', `se_token=${helpdeskToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.activeConnections).toBe(10);
    expect(res.body.denials24h).toBe(5);
    expect(res.body.openAlerts).toBe(3);
    expect(res.body.criticalAlerts).toBe(1);
    expect(res.body.allowed24h).toBe(50);
  });
});

describe('GET /api/helpdesk/alerts', () => {
  const app = createApp();

  it('returns paginated alerts', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [helpdeskUser] });
    mockQuery.mockResolvedValueOnce({ rows: [{ total: 2 }] });
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'a-1' }, { id: 'a-2' }] });

    const res = await request(app)
      .get('/api/helpdesk/alerts')
      .set('Cookie', `se_token=${helpdeskToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.alerts).toHaveLength(2);
    expect(res.body.total).toBe(2);
  });
});

describe('PUT /api/helpdesk/alerts/:id', () => {
  const app = createApp();

  it('updates alert status', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [helpdeskUser] });
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'a-1', status: 'resolved' }] });

    const res = await request(app)
      .put('/api/helpdesk/alerts/a-1')
      .set('Cookie', `se_token=${helpdeskToken()}`)
      .send({ status: 'resolved' });

    expect(res.status).toBe(200);
    expect(res.body.alert.status).toBe('resolved');
  });

  it('returns 404 for non-existent alert', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [helpdeskUser] });
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .put('/api/helpdesk/alerts/nonexistent')
      .set('Cookie', `se_token=${helpdeskToken()}`)
      .send({ status: 'acknowledged' });

    expect(res.status).toBe(404);
  });
});

describe('GET /api/helpdesk/users/search', () => {
  const app = createApp();

  it('returns matching users', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [helpdeskUser] });
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'u-1', email: 'alice@test.com' }] });

    const res = await request(app)
      .get('/api/helpdesk/users/search?q=alice')
      .set('Cookie', `se_token=${helpdeskToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.users).toHaveLength(1);
  });

  it('returns empty array for empty query', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [helpdeskUser] });

    const res = await request(app)
      .get('/api/helpdesk/users/search?q=')
      .set('Cookie', `se_token=${helpdeskToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.users).toEqual([]);
  });
});

describe('POST /api/helpdesk/users/:id/force-logout', () => {
  const app = createApp();

  it('revokes sessions and invalidates Redis cache', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [helpdeskUser] });
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 's-1' }, { id: 's-2' }], rowCount: 2 });

    const res = await request(app)
      .post('/api/helpdesk/users/u-1/force-logout')
      .set('Cookie', `se_token=${helpdeskToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.revoked).toBe(2);
    expect(invalidateSession).toHaveBeenCalledTimes(2);
  });
});

describe('POST /api/helpdesk/users/:id/send-password-reset', () => {
  const app = createApp();

  it('returns 404 for non-existent user', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [helpdeskUser] });
    mockQuery.mockResolvedValueOnce({ rows: [] }); // user lookup

    const res = await request(app)
      .post('/api/helpdesk/users/nonexistent/send-password-reset')
      .set('Cookie', `se_token=${helpdeskToken()}`);

    expect(res.status).toBe(404);
  });

  it('revokes sessions, logs audit event, returns token in dev', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [helpdeskUser] }); // loadUser (auth)
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'u-1', email: 'user@t.com', full_name: 'User' }] }); // user lookup
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 's-1' }], rowCount: 1 }); // session revocation

    const res = await request(app)
      .post('/api/helpdesk/users/u-1/send-password-reset')
      .set('Cookie', `se_token=${helpdeskToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.email).toBe('user@t.com');
    expect(res.body.revoked).toBe(1);
    expect(res.body.resetToken).toBeDefined(); // dev mode
    expect(res.body.expiresAt).toBeDefined();
  });
});

describe('GET /api/helpdesk/devices', () => {
  const app = createApp();

  it('returns paginated devices', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [helpdeskUser] });
    mockQuery.mockResolvedValueOnce({ rows: [{ total: 1 }] });
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'd-1', name: 'MacBook' }] });

    const res = await request(app)
      .get('/api/helpdesk/devices')
      .set('Cookie', `se_token=${helpdeskToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.devices).toHaveLength(1);
    expect(res.body.total).toBe(1);
  });

  it('supports device search', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [helpdeskUser] });
    mockQuery.mockResolvedValueOnce({ rows: [{ total: 1 }] });
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'd-1' }] });

    const res = await request(app)
      .get('/api/helpdesk/devices?search=mac')
      .set('Cookie', `se_token=${helpdeskToken()}`);

    expect(res.status).toBe(200);
  });
});

describe('GET /api/helpdesk/users/:id/access-history', () => {
  const app = createApp();

  it('returns user access events', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [helpdeskUser] });
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: 'ev-1', outcome: 'allowed', app_name: 'App1' },
        { id: 'ev-2', outcome: 'denied', app_name: 'App2' },
      ],
    });

    const res = await request(app)
      .get('/api/helpdesk/users/u-1/access-history')
      .set('Cookie', `se_token=${helpdeskToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.events).toHaveLength(2);
  });
});

describe('GET /api/helpdesk/alerts — filters', () => {
  const app = createApp();

  it('filters alerts by severity and status', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [helpdeskUser] });
    mockQuery.mockResolvedValueOnce({ rows: [{ total: 1 }] });
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'a-1', severity: 'critical', status: 'open' }] });

    const res = await request(app)
      .get('/api/helpdesk/alerts?severity=critical&status=open')
      .set('Cookie', `se_token=${helpdeskToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.alerts).toHaveLength(1);
  });
});

