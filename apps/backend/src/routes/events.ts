import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { requireAuth } from '../middleware/auth';
import { pool } from '../db/client';
import { config } from '../config';
import {
  EnrichedAccessEvent,
  subscribe,
  unsubscribe,
} from '../services/auditLog';

const router = Router();

router.get('/stream', requireAuth, async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  // Immediately flush headers
  if (typeof (res as unknown as { flushHeaders?: () => void }).flushHeaders === 'function') {
    (res as unknown as { flushHeaders: () => void }).flushHeaders();
  }

  const write = (event: string, data: unknown): void => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  write('hello', { ok: true });

  // Subscribe to real audit events
  const onEvent = (ev: EnrichedAccessEvent): void => {
    write('access', ev);
  };
  subscribe(onEvent);

  // Synthetic events for dev/demo only — broadcast without persisting to DB.
  let tickInterval: ReturnType<typeof setInterval> | null = null;
  if (config.NODE_ENV !== 'production') {
    tickInterval = setInterval(async () => {
      try {
        const users = await pool.query<{ id: string; full_name: string; email: string }>(
          'SELECT id, full_name, email FROM users ORDER BY random() LIMIT 1'
        );
        const apps = await pool.query<{ id: string; name: string }>(
          'SELECT id, name FROM applications ORDER BY random() LIMIT 1'
        );
        if (!users.rows[0] || !apps.rows[0]) return;
        const outcome: 'allowed' | 'denied' = Math.random() < 0.8 ? 'allowed' : 'denied';
        const denyReasons = [
          'device_not_managed',
          'disk_not_encrypted',
          'mfa_required',
          'outside_time_window',
          'no_matching_policy',
        ];
        // Broadcast directly — do NOT write to access_events table
        const syntheticEvent: EnrichedAccessEvent = {
          id: uuid(),
          timestamp: new Date(),
          user_id: users.rows[0].id,
          user_name: users.rows[0].full_name,
          user_email: users.rows[0].email,
          application_id: apps.rows[0].id,
          app_name: apps.rows[0].name,
          device_id: null,
          policy_id: null,
          outcome,
          deny_reason: outcome === 'denied'
            ? denyReasons[Math.floor(Math.random() * denyReasons.length)]
            : null,
          ip_address: `203.0.113.${Math.floor(Math.random() * 254) + 1}`,
          geo_country: ['US', 'US', 'CA', 'GB', 'DE'][Math.floor(Math.random() * 5)],
          session_id: null,
          raw_event: { synthetic: true },
        };
        write('access', syntheticEvent);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('[sse] tick error', e);
      }
    }, 3000);
  }

  // Keep-alive comment every 20s (cheap)
  const keepAlive = setInterval(() => {
    res.write(': keepalive\n\n');
  }, 20_000);

  req.on('close', () => {
    if (tickInterval) clearInterval(tickInterval);
    clearInterval(keepAlive);
    unsubscribe(onEvent);
    res.end();
  });
});

export default router;
