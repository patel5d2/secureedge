import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/client';
import { asyncHandler } from '../middleware/errors';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { invalidateSession } from '../db/redis';

const router = Router();

router.use(requireAuth);
router.use(requireRole('helpdesk', 'admin'));

router.get(
  '/dashboard',
  asyncHandler(async (_req, res) => {
    const [active, denials, openAlerts, critical, allowed] = await Promise.all([
      pool.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM sessions
          WHERE revoked_at IS NULL AND expires_at > now()`
      ),
      pool.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM access_events
          WHERE outcome = 'denied' AND timestamp > now() - interval '24 hours'`
      ),
      pool.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM alerts WHERE status = 'open'`
      ),
      pool.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM alerts
          WHERE status = 'open' AND severity = 'critical'`
      ),
      pool.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM access_events
          WHERE outcome = 'allowed' AND timestamp > now() - interval '24 hours'`
      ),
    ]);
    res.json({
      activeConnections: parseInt(active.rows[0].count, 10),
      denials24h: parseInt(denials.rows[0].count, 10),
      openAlerts: parseInt(openAlerts.rows[0].count, 10),
      criticalAlerts: parseInt(critical.rows[0].count, 10),
      allowed24h: parseInt(allowed.rows[0].count, 10),
    });
  })
);

router.get(
  '/alerts',
  asyncHandler(async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string, 10) || 50));
    const severity = (req.query.severity as string) || '';
    const status = (req.query.status as string) || '';
    const offset = (page - 1) * limit;

    const conds: string[] = [];
    const vals: unknown[] = [];
    let i = 1;
    if (severity) { conds.push(`al.severity = $${i++}::alert_severity`); vals.push(severity); }
    if (status) { conds.push(`al.status = $${i++}::alert_status`); vals.push(status); }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

    const [countRes, r] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS total FROM alerts al ${where}`, vals),
      pool.query(
        `SELECT al.*, u.full_name AS user_name, u.email AS user_email
           FROM alerts al
           LEFT JOIN users u ON u.id = al.user_id
           ${where}
           ORDER BY al.triggered_at DESC
           LIMIT $${i} OFFSET $${i + 1}`,
        [...vals, limit, offset]
      ),
    ]);

    res.json({ alerts: r.rows, total: countRes.rows[0].total, page, limit });
  })
);

const AlertUpdate = z.object({
  status: z.enum(['open', 'acknowledged', 'resolved', 'false_positive']),
});

router.put(
  '/alerts/:id',
  asyncHandler(async (req, res) => {
    const body = AlertUpdate.parse(req.body);
    const resolved = body.status === 'resolved' ? new Date() : null;
    const r = await pool.query(
      `UPDATE alerts
          SET status = $1::alert_status,
              resolved_at = CASE WHEN $1 = 'resolved' THEN now() ELSE resolved_at END
        WHERE id = $2
        RETURNING *`,
      [body.status, req.params.id]
    );
    if (!r.rows[0]) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.json({ alert: r.rows[0], resolved_at: resolved });
  })
);

router.get(
  '/users/search',
  asyncHandler(async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    if (!q) {
      res.json({ users: [] });
      return;
    }
    const r = await pool.query(
      `SELECT id, email, full_name, department, role, status, last_login_at
         FROM users
        WHERE email ILIKE $1 OR full_name ILIKE $1
        ORDER BY full_name
        LIMIT 50`,
      [`%${q}%`]
    );
    res.json({ users: r.rows });
  })
);

router.get(
  '/users/:id/access-history',
  asyncHandler(async (req, res) => {
    const r = await pool.query(
      `SELECT e.*, a.name AS app_name
         FROM access_events e
         LEFT JOIN applications a ON a.id = e.application_id
        WHERE e.user_id = $1
          AND e.timestamp > now() - interval '30 days'
        ORDER BY e.timestamp DESC
        LIMIT 500`,
      [req.params.id]
    );
    res.json({ events: r.rows });
  })
);

router.post(
  '/users/:id/force-logout',
  asyncHandler(async (req, res) => {
    const r = await pool.query(
      `UPDATE sessions
          SET revoked_at = now()
        WHERE user_id = $1
          AND revoked_at IS NULL
          AND expires_at > now()
        RETURNING id`,
      [req.params.id]
    );
    // Invalidate all revoked sessions from Redis cache
    await Promise.all(
      r.rows.map((s) => invalidateSession(s.id))
    );
    res.json({ revoked: r.rowCount || 0, sessionIds: r.rows.map((s) => s.id) });
  })
);

router.get(
  '/devices',
  asyncHandler(async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string, 10) || 50));
    const search = (req.query.search as string) || '';
    const offset = (page - 1) * limit;

    const searchCond = search
      ? `WHERE d.name ILIKE $1 OR u.full_name ILIKE $1 OR u.email ILIKE $1`
      : '';
    const searchVals = search ? [`%${search}%`] : [];
    const pIdx = searchVals.length;

    const [countRes, r] = await Promise.all([
      pool.query(
        `SELECT COUNT(*)::int AS total FROM devices d
           LEFT JOIN users u ON u.id = d.user_id
           ${searchCond}`,
        searchVals
      ),
      pool.query(
        `SELECT d.*, u.full_name AS owner_name, u.email AS owner_email
           FROM devices d
           LEFT JOIN users u ON u.id = d.user_id
           ${searchCond}
           ORDER BY d.registered_at DESC
           LIMIT $${pIdx + 1} OFFSET $${pIdx + 2}`,
        [...searchVals, limit, offset]
      ),
    ]);

    res.json({ devices: r.rows, total: countRes.rows[0].total, page, limit });
  })
);

export default router;
