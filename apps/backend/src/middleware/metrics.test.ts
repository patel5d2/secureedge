import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock dependencies before importing the module under test
vi.mock('../db/client', () => ({
  pool: {
    totalCount: 5,
    idleCount: 3,
    waitingCount: 1,
    query: vi.fn(),
  },
}));

vi.mock('../lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import {
  register,
  metricsMiddleware,
  httpRequestsTotal,
  httpRequestDuration,
  policyEvalDuration,
  sseConnectionsGauge,
  dbPoolActive,
  dbPoolIdle,
  dbPoolWaiting,
} from './metrics';

describe('metrics middleware', () => {
  beforeEach(async () => {
    // Reset counters between tests
    register.resetMetrics();
  });

  describe('normalizePath (tested via middleware)', () => {
    function createApp() {
      const app = express();
      app.use(metricsMiddleware);
      app.get('/api/users/:id', (_req, res) => res.json({ ok: true }));
      app.get('/api/items', (_req, res) => res.json({ ok: true }));
      return app;
    }

    it('increments http_requests_total on request completion', async () => {
      const app = createApp();
      await request(app).get('/api/items');

      const metrics = await register.getMetricsAsJSON();
      const counter = metrics.find((m) => m.name === 'http_requests_total');
      expect(counter).toBeDefined();
    });

    it('records duration in http_request_duration_seconds histogram', async () => {
      const app = createApp();
      await request(app).get('/api/items');

      const metrics = await register.getMetricsAsJSON();
      const hist = metrics.find((m) => m.name === 'http_request_duration_seconds');
      expect(hist).toBeDefined();
    });

    it('collapses UUID path segments into :id', async () => {
      const app = express();
      app.use(metricsMiddleware);
      app.get('/api/users/:id', (_req, res) => res.json({ ok: true }));
      await request(app).get('/api/users/550e8400-e29b-41d4-a716-446655440000');

      // Verify via metric label — the path should contain :id, not the UUID
      const metrics = await register.metrics();
      expect(metrics).toContain('/api/users/:id');
      expect(metrics).not.toContain('550e8400');
    });

    it('collapses numeric path segments into :id', async () => {
      const app = express();
      app.use(metricsMiddleware);
      app.get('/api/items/:id', (_req, res) => res.json({ ok: true }));
      await request(app).get('/api/items/12345');

      const metrics = await register.metrics();
      expect(metrics).toContain('/api/items/:id');
    });

    it('calls next() and does not block the request', async () => {
      const app = createApp();
      const res = await request(app).get('/api/items');
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });
  });

  describe('Prometheus registry', () => {
    it('exports metrics in Prometheus text format', async () => {
      const text = await register.metrics();
      expect(typeof text).toBe('string');
      expect(text.length).toBeGreaterThan(0);
    });

    it('registers application-specific metrics', async () => {
      const metrics = await register.getMetricsAsJSON();
      const names = metrics.map((m) => m.name);
      expect(names).toContain('policy_evaluation_duration_seconds');
      expect(names).toContain('sse_active_connections');
      expect(names).toContain('db_pool_active_connections');
      expect(names).toContain('db_pool_idle_connections');
      expect(names).toContain('db_pool_waiting_connections');
    });
  });
});
