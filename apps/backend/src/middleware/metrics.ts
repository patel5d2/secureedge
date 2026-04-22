import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';
import { Request, Response, NextFunction } from 'express';
import { pool } from '../db/client';

export const register = new Registry();

collectDefaultMetrics({ register });

// ── HTTP Metrics ──────────────────────────────────────────────────────

export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'path', 'status'] as const,
  registers: [register],
});

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'path', 'status'] as const,
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [register],
});

// ── Application Metrics ───────────────────────────────────────────────

export const policyEvalDuration = new Histogram({
  name: 'policy_evaluation_duration_seconds',
  help: 'Policy evaluation duration in seconds',
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25],
  registers: [register],
});

export const sseConnectionsGauge = new Gauge({
  name: 'sse_active_connections',
  help: 'Active SSE connections',
  registers: [register],
});

export const dbPoolActive = new Gauge({
  name: 'db_pool_active_connections',
  help: 'Active database connections in pool',
  registers: [register],
  collect() {
    this.set(pool.totalCount - pool.idleCount);
  },
});

export const dbPoolIdle = new Gauge({
  name: 'db_pool_idle_connections',
  help: 'Idle database connections in pool',
  registers: [register],
  collect() {
    this.set(pool.idleCount);
  },
});

export const dbPoolWaiting = new Gauge({
  name: 'db_pool_waiting_connections',
  help: 'Waiting database connections in pool',
  registers: [register],
  collect() {
    this.set(pool.waitingCount);
  },
});

// ── Middleware ─────────────────────────────────────────────────────────

function normalizePath(url: string): string {
  // Collapse UUIDs and numeric IDs into :id for cardinality control
  return url
    .split('?')[0]
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
    .replace(/\/\d+/g, '/:id');
}

export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const duration = Number(process.hrtime.bigint() - start) / 1e9;
    const path = normalizePath(req.path);
    const labels = { method: req.method, path, status: String(res.statusCode) };

    httpRequestsTotal.inc(labels);
    httpRequestDuration.observe(labels, duration);
  });

  next();
}
