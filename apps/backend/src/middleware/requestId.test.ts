import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { requestId } from './requestId';

function createApp() {
  const app = express();
  app.use(requestId);
  app.get('/test', (req, res) => {
    res.json({ id: req.id });
  });
  return app;
}

describe('requestId middleware', () => {
  it('generates a UUID when no X-Request-Id header is provided', async () => {
    const app = createApp();
    const res = await request(app).get('/test');

    expect(res.status).toBe(200);
    expect(res.body.id).toBeDefined();
    // UUID v4 pattern
    expect(res.body.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
  });

  it('uses the provided X-Request-Id header value', async () => {
    const app = createApp();
    const res = await request(app)
      .get('/test')
      .set('X-Request-Id', 'custom-trace-123');

    expect(res.body.id).toBe('custom-trace-123');
  });

  it('sets X-Request-Id on the response', async () => {
    const app = createApp();
    const res = await request(app)
      .get('/test')
      .set('X-Request-Id', 'trace-abc');

    expect(res.headers['x-request-id']).toBe('trace-abc');
  });

  it('sets generated UUID on the response header when none provided', async () => {
    const app = createApp();
    const res = await request(app).get('/test');

    expect(res.headers['x-request-id']).toBeDefined();
    expect(res.headers['x-request-id']).toBe(res.body.id);
  });
});
