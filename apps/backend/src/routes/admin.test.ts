/**
 * Admin route comprehensive tests.
 * Tests every CRUD endpoint with auth/RBAC enforcement.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import jwt from 'jsonwebtoken';

const TEST_SECRET = 'test-admin-route-secret-for-unit-tests';

vi.mock('../config', () => ({
  config: {
    JWT_SECRET: 'test-admin-route-secret-for-unit-tests',
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

vi.mock('../services/policyEngine', () => ({
  simulate: vi.fn().mockResolvedValue({ outcome: 'allowed', policyId: 'p-1', policyName: 'Test' }),
  simulateAgainstPolicy: vi.fn().mockResolvedValue({ outcome: 'allowed', policyId: 'p-1', policyName: 'Test' }),
  invalidatePolicyCache: vi.fn(),
}));

import adminRouter from './admin';
import { errorHandler } from '../middleware/errors';
import { pool } from '../db/client';

const mockQuery = pool.query as ReturnType<typeof vi.fn>;

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/admin', adminRouter);
  app.use(errorHandler);
  return app;
}

function adminToken() {
  return jwt.sign(
    { sub: 'admin-1', email: 'admin@test.com', role: 'admin', sid: 'sess-1', mfa: true },
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

const adminUser = { id: 'admin-1', email: 'admin@test.com', role: 'admin', full_name: 'Admin' };
const regularUser = { id: 'u-1', email: 'user@test.com', role: 'user', full_name: 'User' };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Admin route auth enforcement', () => {
  const app = createApp();

  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/admin/overview');
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-admin role', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [regularUser] }); // loadUser
    const res = await request(app)
      .get('/api/admin/overview')
      .set('Cookie', `se_token=${userToken()}`);
    expect(res.status).toBe(403);
  });
});

describe('GET /api/admin/overview', () => {
  const app = createApp();

  it('returns dashboard statistics', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [adminUser] }); // loadUser
    // active24h, policiesActive, denials24h, critical, buckets
    mockQuery.mockResolvedValueOnce({ rows: [{ count: '42' }] });
    mockQuery.mockResolvedValueOnce({ rows: [{ count: '5' }] });
    mockQuery.mockResolvedValueOnce({ rows: [{ count: '10' }] });
    mockQuery.mockResolvedValueOnce({ rows: [{ count: '2' }] });
    mockQuery.mockResolvedValueOnce({ rows: [] }); // buckets

    const res = await request(app)
      .get('/api/admin/overview')
      .set('Cookie', `se_token=${adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.activeUsers24h).toBe(42);
    expect(res.body.policiesActive).toBe(5);
    expect(res.body.denials24h).toBe(10);
    expect(res.body.criticalAlerts).toBe(2);
    expect(res.body.trend).toBeDefined();
    expect(res.body.trend.labels).toHaveLength(24);
  });
});

describe('Policy CRUD', () => {
  const app = createApp();

  it('GET /policies returns policy list', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [adminUser] });
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'p-1', name: 'Test', rules: { who: { groups: [] }, what: {} }, status: 'active' }],
    });

    const res = await request(app)
      .get('/api/admin/policies')
      .set('Cookie', `se_token=${adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.policies).toBeDefined();
  });

  it('POST /policies creates a policy with defaults', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [adminUser] });
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'p-new', name: 'New Policy', status: 'draft', priority: 100 }] });

    const res = await request(app)
      .post('/api/admin/policies')
      .set('Cookie', `se_token=${adminToken()}`)
      .send({ name: 'New Policy' });

    expect(res.status).toBe(201);
    expect(res.body.policy.name).toBe('New Policy');
  });

  it('POST /policies validates name required', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [adminUser] });

    const res = await request(app)
      .post('/api/admin/policies')
      .set('Cookie', `se_token=${adminToken()}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it('GET /policies/:id returns single policy', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [adminUser] });
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'p-1', name: 'Test' }] });

    const res = await request(app)
      .get('/api/admin/policies/p-1')
      .set('Cookie', `se_token=${adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.policy.id).toBe('p-1');
  });

  it('GET /policies/:id returns 404 if not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [adminUser] });
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get('/api/admin/policies/nonexistent')
      .set('Cookie', `se_token=${adminToken()}`);

    expect(res.status).toBe(404);
  });

  it('PUT /policies/:id updates and returns policy', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [adminUser] });
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'p-1', name: 'Updated', status: 'active' }] });

    const res = await request(app)
      .put('/api/admin/policies/p-1')
      .set('Cookie', `se_token=${adminToken()}`)
      .send({ name: 'Updated' });

    expect(res.status).toBe(200);
    expect(res.body.policy.name).toBe('Updated');
  });

  it('PUT /policies/:id returns 404 if not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [adminUser] });
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .put('/api/admin/policies/nonexistent')
      .set('Cookie', `se_token=${adminToken()}`)
      .send({ name: 'X' });

    expect(res.status).toBe(404);
  });

  it('DELETE /policies/:id deletes policy', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [adminUser] });
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'p-1' }] });

    const res = await request(app)
      .delete('/api/admin/policies/p-1')
      .set('Cookie', `se_token=${adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('DELETE /policies/:id returns 404 if not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [adminUser] });
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .delete('/api/admin/policies/nonexistent')
      .set('Cookie', `se_token=${adminToken()}`);

    expect(res.status).toBe(404);
  });
});

describe('Policy simulation', () => {
  const app = createApp();

  it('POST /simulate runs policy simulation', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [adminUser] });

    const res = await request(app)
      .post('/api/admin/simulate')
      .set('Cookie', `se_token=${adminToken()}`)
      .send({ userId: '00000000-0000-0000-0000-000000000001', appId: '00000000-0000-0000-0000-000000000002' });

    expect(res.status).toBe(200);
    expect(res.body.outcome).toBe('allowed');
  });

  it('POST /policies/:id/simulate runs against specific policy', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [adminUser] });

    const res = await request(app)
      .post('/api/admin/policies/p-1/simulate')
      .set('Cookie', `se_token=${adminToken()}`)
      .send({ userId: '00000000-0000-0000-0000-000000000001', appId: '00000000-0000-0000-0000-000000000002' });

    expect(res.status).toBe(200);
    expect(res.body.outcome).toBe('allowed');
  });
});

describe('User CRUD', () => {
  const app = createApp();

  it('GET /users returns paginated user list', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [adminUser] });
    mockQuery.mockResolvedValueOnce({ rows: [{ total: 2 }] });
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'u-1', email: 'a@b.c' }, { id: 'u-2', email: 'd@e.f' }] });

    const res = await request(app)
      .get('/api/admin/users')
      .set('Cookie', `se_token=${adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.users).toHaveLength(2);
    expect(res.body.total).toBe(2);
    expect(res.body.page).toBe(1);
  });

  it('GET /users/:id returns user detail', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [adminUser] });
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'u-1', email: 'test@t.com' }] }); // user
    mockQuery.mockResolvedValueOnce({ rows: [] }); // groups
    mockQuery.mockResolvedValueOnce({ rows: [] }); // devices
    mockQuery.mockResolvedValueOnce({ rows: [] }); // events

    const res = await request(app)
      .get('/api/admin/users/u-1')
      .set('Cookie', `se_token=${adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe('u-1');
  });

  it('GET /users/:id returns 404', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [adminUser] });
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get('/api/admin/users/nonexistent')
      .set('Cookie', `se_token=${adminToken()}`);

    expect(res.status).toBe(404);
  });

  it('POST /users creates a user', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [adminUser] });
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'u-new', email: 'new@t.com', role: 'user' }] });

    const res = await request(app)
      .post('/api/admin/users')
      .set('Cookie', `se_token=${adminToken()}`)
      .send({ email: 'new@t.com', full_name: 'New User' });

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('new@t.com');
  });

  it('PUT /users/:id updates user', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [adminUser] });
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'u-1', full_name: 'Updated' }] });

    const res = await request(app)
      .put('/api/admin/users/u-1')
      .set('Cookie', `se_token=${adminToken()}`)
      .send({ full_name: 'Updated' });

    expect(res.status).toBe(200);
    expect(res.body.user.full_name).toBe('Updated');
  });

  it('PUT /users/:id returns 404', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [adminUser] });
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .put('/api/admin/users/nonexistent')
      .set('Cookie', `se_token=${adminToken()}`)
      .send({ full_name: 'X' });

    expect(res.status).toBe(404);
  });

  it('DELETE /users/:id soft-deletes (deactivates) user', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [adminUser] });
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'u-1', status: 'deactivated' }] });

    const res = await request(app)
      .delete('/api/admin/users/u-1')
      .set('Cookie', `se_token=${adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.user.status).toBe('deactivated');
  });
});

describe('Application CRUD', () => {
  const app = createApp();

  it('GET /applications returns paginated list', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [adminUser] });
    mockQuery.mockResolvedValueOnce({ rows: [{ total: 1 }] });
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'app-1', name: 'Dashboard' }] });

    const res = await request(app)
      .get('/api/admin/applications')
      .set('Cookie', `se_token=${adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.applications).toHaveLength(1);
  });

  it('POST /applications creates app', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [adminUser] });
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'app-new', name: 'New App', slug: 'new-app' }] });

    const res = await request(app)
      .post('/api/admin/applications')
      .set('Cookie', `se_token=${adminToken()}`)
      .send({ name: 'New App', slug: 'new-app', app_url: 'https://new.app' });

    expect(res.status).toBe(201);
    expect(res.body.application.slug).toBe('new-app');
  });

  it('PUT /applications/:id updates app', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [adminUser] });
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'app-1', name: 'Updated' }] });

    const res = await request(app)
      .put('/api/admin/applications/app-1')
      .set('Cookie', `se_token=${adminToken()}`)
      .send({ name: 'Updated' });

    expect(res.status).toBe(200);
  });

  it('DELETE /applications/:id deletes app and nullifies references', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [adminUser] });
    mockQuery.mockResolvedValueOnce({ rows: [] }); // nullify access_events
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'app-1' }] }); // DELETE

    const res = await request(app)
      .delete('/api/admin/applications/app-1')
      .set('Cookie', `se_token=${adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

describe('Group CRUD', () => {
  const app = createApp();

  it('GET /groups returns paginated list', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [adminUser] });
    mockQuery.mockResolvedValueOnce({ rows: [{ total: 1 }] });
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'g-1', name: 'Engineers', member_count: 5 }] });

    const res = await request(app)
      .get('/api/admin/groups')
      .set('Cookie', `se_token=${adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.groups).toHaveLength(1);
  });

  it('POST /groups creates group', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [adminUser] });
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'g-new', name: 'New Group' }] });

    const res = await request(app)
      .post('/api/admin/groups')
      .set('Cookie', `se_token=${adminToken()}`)
      .send({ name: 'New Group' });

    expect(res.status).toBe(201);
  });

  it('GET /groups/:id returns group with members', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [adminUser] });
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'g-1', name: 'Engineers' }] }); // group
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'u-1', email: 'a@b.c' }] }); // members

    const res = await request(app)
      .get('/api/admin/groups/g-1')
      .set('Cookie', `se_token=${adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.group.id).toBe('g-1');
    expect(res.body.members).toHaveLength(1);
  });

  it('GET /groups/:id returns 404', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [adminUser] });
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get('/api/admin/groups/nonexistent')
      .set('Cookie', `se_token=${adminToken()}`);

    expect(res.status).toBe(404);
  });

  it('PUT /groups/:id updates group', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [adminUser] });
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'g-1', name: 'Updated' }] });

    const res = await request(app)
      .put('/api/admin/groups/g-1')
      .set('Cookie', `se_token=${adminToken()}`)
      .send({ name: 'Updated' });

    expect(res.status).toBe(200);
  });

  it('DELETE /groups/:id deletes group', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [adminUser] });
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'g-1' }] });

    const res = await request(app)
      .delete('/api/admin/groups/g-1')
      .set('Cookie', `se_token=${adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('POST /groups/:id/members adds member', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [adminUser] });
    mockQuery.mockResolvedValueOnce({ rows: [] }); // INSERT

    const res = await request(app)
      .post('/api/admin/groups/g-1/members')
      .set('Cookie', `se_token=${adminToken()}`)
      .send({ userId: '00000000-0000-0000-0000-000000000001' });

    expect(res.status).toBe(201);
  });

  it('DELETE /groups/:id/members/:userId removes member', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [adminUser] });
    mockQuery.mockResolvedValueOnce({ rows: [] }); // DELETE

    const res = await request(app)
      .delete('/api/admin/groups/g-1/members/u-1')
      .set('Cookie', `se_token=${adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

describe('Device admin', () => {
  const app = createApp();

  it('PUT /devices/:id updates device', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [adminUser] });
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'd-1', managed: true }] });

    const res = await request(app)
      .put('/api/admin/devices/d-1')
      .set('Cookie', `se_token=${adminToken()}`)
      .send({ managed: true });

    expect(res.status).toBe(200);
    expect(res.body.device.managed).toBe(true);
  });

  it('PUT /devices/:id returns 404', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [adminUser] });
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .put('/api/admin/devices/nonexistent')
      .set('Cookie', `se_token=${adminToken()}`)
      .send({ managed: false });

    expect(res.status).toBe(404);
  });
});

describe('Audit log', () => {
  const app = createApp();

  it('GET /audit-log returns paginated events', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [adminUser] });
    mockQuery.mockResolvedValueOnce({ rows: [{ count: '5' }] }); // total
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'ev-1' }] }); // events

    const res = await request(app)
      .get('/api/admin/audit-log')
      .set('Cookie', `se_token=${adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.events).toBeDefined();
    expect(res.body.total).toBe(5);
  });

  it('GET /recent-events returns denied events', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [adminUser] });
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'ev-1', outcome: 'denied' }] });

    const res = await request(app)
      .get('/api/admin/recent-events')
      .set('Cookie', `se_token=${adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.events).toHaveLength(1);
  });
});
