/**
 * Portal route comprehensive tests.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import jwt from 'jsonwebtoken';

const TEST_SECRET = 'test-portal-route-secret-for-unit-tests';

vi.mock('../config', () => ({
  config: {
    JWT_SECRET: 'test-portal-route-secret-for-unit-tests',
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

vi.mock('../services/policyEngine', () => ({
  simulate: vi.fn().mockResolvedValue({ outcome: 'allowed', policyId: 'p-1', policyName: 'Test' }),
}));

import portalRouter from './portal';
import { errorHandler } from '../middleware/errors';
import { pool } from '../db/client';

const mockQuery = pool.query as ReturnType<typeof vi.fn>;

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/portal', portalRouter);
  app.use(errorHandler);
  return app;
}

function userToken() {
  return jwt.sign(
    { sub: 'u-1', email: 'user@test.com', role: 'user', sid: 'sess-1', mfa: true },
    TEST_SECRET,
    { expiresIn: 3600 }
  );
}

const activeUser = { id: 'u-1', email: 'user@test.com', role: 'user', full_name: 'User' };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Portal route auth enforcement', () => {
  const app = createApp();

  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/portal/apps');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/portal/apps', () => {
  const app = createApp();

  it('returns apps with accessibility status', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [activeUser] }); // loadUser
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'app-1', name: 'Dashboard', slug: 'dashboard', app_url: 'https://d.com', protocol: 'https', required_mfa: true }],
    });

    const res = await request(app)
      .get('/api/portal/apps')
      .set('Cookie', `se_token=${userToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.apps).toHaveLength(1);
    expect(res.body.apps[0].accessible).toBe(true);
    expect(res.body.apps[0].name).toBe('Dashboard');
  });
});

describe('GET /api/portal/apps/:id', () => {
  const app = createApp();

  it('returns app detail with requirements and groups', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [activeUser] }); // loadUser
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'app-1', name: 'Dashboard', slug: 'dashboard', app_url: 'https://d.com', required_mfa: false }],
    }); // app
    mockQuery.mockResolvedValueOnce({ rows: [] }); // policies
    mockQuery.mockResolvedValueOnce({ rows: [] }); // user_groups

    const res = await request(app)
      .get('/api/portal/apps/app-1')
      .set('Cookie', `se_token=${userToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.app.id).toBe('app-1');
    expect(res.body.requirements).toBeDefined();
    expect(res.body.simulate).toBeDefined();
  });

  it('returns 404 for non-existent app', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [activeUser] });
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get('/api/portal/apps/nonexistent')
      .set('Cookie', `se_token=${userToken()}`);

    expect(res.status).toBe(404);
  });
});

describe('GET /api/portal/sessions', () => {
  const app = createApp();

  it('returns user sessions', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [activeUser] });
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 's-1', ip_address: '10.0.0.1' }] });

    const res = await request(app)
      .get('/api/portal/sessions')
      .set('Cookie', `se_token=${userToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.sessions).toHaveLength(1);
  });
});

describe('DELETE /api/portal/sessions/:id', () => {
  const app = createApp();

  it('revokes own session', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [activeUser] });
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 's-1' }] });

    const res = await request(app)
      .delete('/api/portal/sessions/s-1')
      .set('Cookie', `se_token=${userToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('returns 404 for not found or already revoked', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [activeUser] });
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .delete('/api/portal/sessions/nonexistent')
      .set('Cookie', `se_token=${userToken()}`);

    expect(res.status).toBe(404);
  });
});

describe('GET /api/portal/devices', () => {
  const app = createApp();

  it('returns user devices', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [activeUser] });
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'd-1', name: 'MacBook' }] });

    const res = await request(app)
      .get('/api/portal/devices')
      .set('Cookie', `se_token=${userToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.devices).toHaveLength(1);
  });
});

describe('POST /api/portal/devices', () => {
  const app = createApp();

  it('registers a new device', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [activeUser] });
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'd-new', name: 'MacBook', os: 'macOS 14', enrollment_status: 'pending' }],
    });

    const res = await request(app)
      .post('/api/portal/devices')
      .set('Cookie', `se_token=${userToken()}`)
      .send({ name: 'MacBook', os: 'macOS 14' });

    expect(res.status).toBe(201);
    expect(res.body.device.enrollment_status).toBe('pending');
  });

  it('validates required fields', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [activeUser] });

    const res = await request(app)
      .post('/api/portal/devices')
      .set('Cookie', `se_token=${userToken()}`)
      .send({});

    expect(res.status).toBe(400);
  });
});

describe('PUT /api/portal/devices/:id', () => {
  const app = createApp();

  it('updates own device', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [activeUser] });
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'd-1', name: 'Updated' }] });

    const res = await request(app)
      .put('/api/portal/devices/d-1')
      .set('Cookie', `se_token=${userToken()}`)
      .send({ name: 'Updated' });

    expect(res.status).toBe(200);
    expect(res.body.device.name).toBe('Updated');
  });

  it('returns 404 for wrong user device', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [activeUser] });
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .put('/api/portal/devices/nonexistent')
      .set('Cookie', `se_token=${userToken()}`)
      .send({ name: 'X' });

    expect(res.status).toBe(404);
  });

  it('returns device: null for empty update body', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [activeUser] });

    const res = await request(app)
      .put('/api/portal/devices/d-1')
      .set('Cookie', `se_token=${userToken()}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.device).toBeNull();
  });
});

describe('DELETE /api/portal/devices/:id', () => {
  const app = createApp();

  it('deletes own device', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [activeUser] });
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'd-1' }] });

    const res = await request(app)
      .delete('/api/portal/devices/d-1')
      .set('Cookie', `se_token=${userToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('returns 404 for wrong user device', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [activeUser] });
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .delete('/api/portal/devices/nonexistent')
      .set('Cookie', `se_token=${userToken()}`);

    expect(res.status).toBe(404);
  });
});

describe('GET /api/portal/profile', () => {
  const app = createApp();

  it('returns user profile with groups and device', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [activeUser] }); // loadUser
    mockQuery.mockResolvedValueOnce({ rows: [{ ...activeUser, department: 'Engineering' }] }); // profile
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'g-1', name: 'Engineers' }] }); // groups
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'd-1', name: 'MacBook' }] }); // device

    const res = await request(app)
      .get('/api/portal/profile')
      .set('Cookie', `se_token=${userToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.user).toBeDefined();
    expect(res.body.groups).toHaveLength(1);
    expect(res.body.device.id).toBe('d-1');
  });
});
