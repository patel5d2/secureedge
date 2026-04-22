import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { pool } from '../db/client';
import { asyncHandler } from '../middleware/errors';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import {
  simulate,
  simulateAgainstPolicy,
  invalidatePolicyCache,
} from '../services/policyEngine';
import { PolicyRules } from '../types';

const router = Router();

router.use(requireAuth);
router.use(requireRole('admin'));

router.get(
  '/overview',
  asyncHandler(async (_req, res) => {
    const [active24h, policiesActive, denials24h, critical] = await Promise.all([
      pool.query<{ count: string }>(
        `SELECT COUNT(DISTINCT user_id) AS count
           FROM access_events
          WHERE timestamp > now() - interval '24 hours'`
      ),
      pool.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM policies WHERE status = 'active'`
      ),
      pool.query<{ count: string }>(
        `SELECT COUNT(*) AS count
           FROM access_events
          WHERE outcome = 'denied'
            AND timestamp > now() - interval '24 hours'`
      ),
      pool.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM alerts WHERE status = 'open' AND severity = 'critical'`
      ),
    ]);

    const buckets = await pool.query<{
      hour: string;
      outcome: 'allowed' | 'denied';
      count: string;
    }>(
      `SELECT to_char(date_trunc('hour', timestamp), 'YYYY-MM-DD HH24:00') AS hour,
              outcome::text AS outcome,
              COUNT(*) AS count
         FROM access_events
        WHERE timestamp > now() - interval '24 hours'
        GROUP BY 1, 2
        ORDER BY 1`
    );

    // Build hourly buckets for past 24h continuously
    const labels: string[] = [];
    const allowed: number[] = [];
    const denied: number[] = [];
    const now = new Date();
    now.setMinutes(0, 0, 0);
    for (let i = 23; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 3600_000);
      const label = d.toISOString().slice(0, 13).replace('T', ' ') + ':00';
      labels.push(label);
      allowed.push(0);
      denied.push(0);
    }
    for (const row of buckets.rows) {
      const idx = labels.indexOf(row.hour);
      if (idx >= 0) {
        const n = parseInt(row.count, 10);
        if (row.outcome === 'allowed') allowed[idx] = n;
        else denied[idx] = n;
      }
    }

    res.json({
      activeUsers24h: parseInt(active24h.rows[0].count, 10),
      policiesActive: parseInt(policiesActive.rows[0].count, 10),
      denials24h: parseInt(denials24h.rows[0].count, 10),
      criticalAlerts: parseInt(critical.rows[0].count, 10),
      trend: { labels, allowed, denied },
    });
  })
);

router.get(
  '/policies',
  asyncHandler(async (_req, res) => {
    const r = await pool.query<{
      id: string;
      name: string;
      description: string | null;
      status: string;
      priority: number;
      rules: PolicyRules;
      created_by: string | null;
      created_at: Date;
      updated_at: Date;
    }>(
      `SELECT id, name, description, status, priority, rules, created_by, created_at, updated_at
         FROM policies
         ORDER BY priority ASC, name ASC`
    );
    const policies = await Promise.all(
      r.rows.map(async (p) => {
        const appCount = p.rules?.what?.applications?.length || 0;
        const groupIds = p.rules?.who?.groups || [];
        const userIds = p.rules?.who?.users || [];
        let affected = 0;
        if (groupIds.length > 0) {
          const c = await pool.query<{ count: string }>(
            `SELECT COUNT(DISTINCT user_id) AS count
               FROM user_groups WHERE group_id = ANY($1::uuid[])`,
            [groupIds]
          );
          affected += parseInt(c.rows[0].count, 10);
        }
        affected += userIds.length;
        return { ...p, affected_user_count: affected, app_count: appCount };
      })
    );
    res.json({ policies });
  })
);

const RulesSchema = z.object({
  who: z
    .object({
      users: z.array(z.string().uuid()).optional(),
      groups: z.array(z.string().uuid()).optional(),
    })
    .optional(),
  what: z
    .object({
      applications: z.array(z.string().uuid()).optional(),
    })
    .optional(),
  conditions: z
    .array(
      z.union([
        z.object({ type: z.literal('device_managed'), value: z.boolean() }),
        z.object({ type: z.literal('disk_encrypted'), value: z.boolean() }),
        z.object({ type: z.literal('mfa_verified'), value: z.boolean() }),
        z.object({
          type: z.literal('time_range'),
          start: z.string().regex(/^\d{2}:\d{2}$/),
          end: z.string().regex(/^\d{2}:\d{2}$/),
        }),
        z.object({
          type: z.literal('country'),
          allowed: z.array(z.string()),
        }),
      ])
    )
    .optional(),
});

const PolicyCreateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(['draft', 'active', 'disabled']).optional(),
  priority: z.number().int().optional(),
  rules: RulesSchema.optional(),
});

const PolicyUpdateSchema = PolicyCreateSchema.partial();

router.post(
  '/policies',
  asyncHandler(async (req, res) => {
    const body = PolicyCreateSchema.parse(req.body);
    const r = await pool.query(
      `INSERT INTO policies (name, description, status, priority, rules, created_by)
       VALUES ($1, $2, $3::policy_status, $4, $5::jsonb, $6)
       RETURNING *`,
      [
        body.name,
        body.description || null,
        body.status || 'draft',
        body.priority ?? 100,
        JSON.stringify(body.rules || {}),
        req.user!.id,
      ]
    );
    invalidatePolicyCache();
    res.status(201).json({ policy: r.rows[0] });
  })
);

router.get(
  '/policies/:id',
  asyncHandler(async (req, res) => {
    const r = await pool.query(
      `SELECT * FROM policies WHERE id = $1`,
      [req.params.id]
    );
    if (!r.rows[0]) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.json({ policy: r.rows[0] });
  })
);

router.put(
  '/policies/:id',
  asyncHandler(async (req, res) => {
    const body = PolicyUpdateSchema.parse(req.body);
    const fields: string[] = [];
    const values: unknown[] = [];
    let i = 1;
    if (body.name !== undefined) {
      fields.push(`name = $${i++}`);
      values.push(body.name);
    }
    if (body.description !== undefined) {
      fields.push(`description = $${i++}`);
      values.push(body.description);
    }
    if (body.status !== undefined) {
      fields.push(`status = $${i++}::policy_status`);
      values.push(body.status);
    }
    if (body.priority !== undefined) {
      fields.push(`priority = $${i++}`);
      values.push(body.priority);
    }
    if (body.rules !== undefined) {
      fields.push(`rules = $${i++}::jsonb`);
      values.push(JSON.stringify(body.rules));
    }
    fields.push(`updated_at = now()`);
    if (values.length === 0) {
      // nothing to update other than updated_at
    }
    values.push(req.params.id);
    const r = await pool.query(
      `UPDATE policies SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    );
    if (!r.rows[0]) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    invalidatePolicyCache();
    res.json({ policy: r.rows[0] });
  })
);

router.delete(
  '/policies/:id',
  asyncHandler(async (req, res) => {
    const r = await pool.query(
      `DELETE FROM policies WHERE id = $1 RETURNING id`,
      [req.params.id]
    );
    if (!r.rows[0]) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    invalidatePolicyCache();
    res.json({ ok: true });
  })
);

const SimulateBody = z.object({
  userId: z.string().uuid(),
  appId: z.string().uuid(),
  context: z
    .object({
      deviceManaged: z.boolean().optional(),
      diskEncrypted: z.boolean().optional(),
      mfaVerified: z.boolean().optional(),
      country: z.string().optional(),
      now: z.string().datetime().optional(),
    })
    .optional(),
});

router.post(
  '/policies/:id/simulate',
  asyncHandler(async (req, res) => {
    const body = SimulateBody.parse(req.body);
    const ctx = body.context
      ? {
          ...body.context,
          now: body.context.now ? new Date(body.context.now) : undefined,
        }
      : undefined;
    const result = await simulateAgainstPolicy(
      body.userId,
      body.appId,
      req.params.id,
      ctx
    );
    res.json(result);
  })
);

// Also expose a generic simulate (not per policy) as a convenience
router.post(
  '/simulate',
  asyncHandler(async (req, res) => {
    const body = SimulateBody.parse(req.body);
    const ctx = body.context
      ? {
          ...body.context,
          now: body.context.now ? new Date(body.context.now) : undefined,
        }
      : undefined;
    const result = await simulate(body.userId, body.appId, ctx);
    res.json(result);
  })
);

router.get(
  '/users',
  asyncHandler(async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string, 10) || 50));
    const search = (req.query.search as string) || '';
    const offset = (page - 1) * limit;

    const searchCond = search
      ? `WHERE u.email ILIKE $1 OR u.full_name ILIKE $1 OR u.department ILIKE $1`
      : '';
    const searchVals = search ? [`%${search}%`] : [];
    const pIdx = searchVals.length;

    const [countRes, r] = await Promise.all([
      pool.query(
        `SELECT COUNT(*)::int AS total FROM users u ${searchCond}`,
        searchVals
      ),
      pool.query(
        `SELECT u.id, u.email, u.full_name, u.department, u.role, u.status,
                u.last_login_at, u.created_at,
                COALESCE(array_agg(DISTINCT g.name) FILTER (WHERE g.id IS NOT NULL), '{}') AS groups,
                (SELECT COUNT(*) FROM devices d WHERE d.user_id = u.id)::int AS device_count
           FROM users u
           LEFT JOIN user_groups ug ON ug.user_id = u.id
           LEFT JOIN groups g ON g.id = ug.group_id
           ${searchCond}
           GROUP BY u.id
           ORDER BY u.full_name ASC
           LIMIT $${pIdx + 1} OFFSET $${pIdx + 2}`,
        [...searchVals, limit, offset]
      ),
    ]);

    res.json({ users: r.rows, total: countRes.rows[0].total, page, limit });
  })
);

router.get(
  '/users/:id',
  asyncHandler(async (req, res) => {
    const uRes = await pool.query(
      `SELECT id, email, full_name, department, role, status, last_login_at, created_at
         FROM users WHERE id = $1`,
      [req.params.id]
    );
    if (!uRes.rows[0]) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    const gRes = await pool.query(
      `SELECT g.id, g.name, g.description, g.source
         FROM groups g JOIN user_groups ug ON ug.group_id = g.id
        WHERE ug.user_id = $1
        ORDER BY g.name`,
      [req.params.id]
    );
    const dRes = await pool.query(
      `SELECT id, name, os, enrollment_status, last_posture_check, posture_score, managed, disk_encrypted, registered_at
         FROM devices WHERE user_id = $1 ORDER BY registered_at DESC`,
      [req.params.id]
    );
    const eRes = await pool.query(
      `SELECT e.*, a.name AS app_name
         FROM access_events e
         LEFT JOIN applications a ON a.id = e.application_id
        WHERE e.user_id = $1
        ORDER BY e.timestamp DESC
        LIMIT 20`,
      [req.params.id]
    );
    res.json({
      user: uRes.rows[0],
      groups: gRes.rows,
      devices: dRes.rows,
      recent_events: eRes.rows,
    });
  })
);

router.get(
  '/applications',
  asyncHandler(async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string, 10) || 50));
    const search = (req.query.search as string) || '';
    const offset = (page - 1) * limit;

    const searchCond = search ? `WHERE a.name ILIKE $1 OR a.slug ILIKE $1` : '';
    const searchVals = search ? [`%${search}%`] : [];
    const pIdx = searchVals.length;

    const [countRes, r] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS total FROM applications a ${searchCond}`, searchVals),
      pool.query(
        `SELECT a.*,
                (SELECT COUNT(*) FROM policies p
                  WHERE p.rules -> 'what' -> 'applications' @> to_jsonb(a.id::text))::int AS policy_count
           FROM applications a
           ${searchCond}
           ORDER BY a.name ASC
           LIMIT $${pIdx + 1} OFFSET $${pIdx + 2}`,
        [...searchVals, limit, offset]
      ),
    ]);

    res.json({ applications: r.rows, total: countRes.rows[0].total, page, limit });
  })
);

router.get(
  '/groups',
  asyncHandler(async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string, 10) || 50));
    const search = (req.query.search as string) || '';
    const offset = (page - 1) * limit;

    const searchCond = search ? `WHERE g.name ILIKE $1 OR g.description ILIKE $1` : '';
    const searchVals = search ? [`%${search}%`] : [];
    const pIdx = searchVals.length;

    const [countRes, r] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS total FROM groups g ${searchCond}`, searchVals),
      pool.query(
        `SELECT g.*, (SELECT COUNT(*) FROM user_groups ug WHERE ug.group_id = g.id)::int AS member_count
           FROM groups g
           ${searchCond}
           ORDER BY g.name ASC
           LIMIT $${pIdx + 1} OFFSET $${pIdx + 2}`,
        [...searchVals, limit, offset]
      ),
    ]);

    res.json({ groups: r.rows, total: countRes.rows[0].total, page, limit });
  })
);

const AuditQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  search: z.string().optional(),
  outcome: z.enum(['allowed', 'denied']).optional(),
  userId: z.string().uuid().optional(),
  appId: z.string().uuid().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

router.get(
  '/audit-log',
  asyncHandler(async (req, res) => {
    const q = AuditQuery.parse(req.query);
    const conds: string[] = [];
    const values: unknown[] = [];
    let i = 1;
    if (q.outcome) {
      conds.push(`e.outcome = $${i++}::access_outcome`);
      values.push(q.outcome);
    }
    if (q.userId) {
      conds.push(`e.user_id = $${i++}`);
      values.push(q.userId);
    }
    if (q.appId) {
      conds.push(`e.application_id = $${i++}`);
      values.push(q.appId);
    }
    if (q.startDate) {
      conds.push(`e.timestamp >= $${i++}`);
      values.push(new Date(q.startDate));
    }
    if (q.endDate) {
      conds.push(`e.timestamp <= $${i++}`);
      values.push(new Date(q.endDate));
    }
    if (q.search) {
      conds.push(
        `(u.full_name ILIKE $${i} OR u.email ILIKE $${i} OR a.name ILIKE $${i} OR e.deny_reason ILIKE $${i})`
      );
      values.push(`%${q.search}%`);
      i++;
    }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

    const totalRes = await pool.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM access_events e
         LEFT JOIN users u ON u.id = e.user_id
         LEFT JOIN applications a ON a.id = e.application_id
         ${where}`,
      values
    );
    const total = parseInt(totalRes.rows[0].count, 10);
    const offset = (q.page - 1) * q.limit;

    const eventsRes = await pool.query(
      `SELECT e.*, u.full_name AS user_name, u.email AS user_email, a.name AS app_name
         FROM access_events e
         LEFT JOIN users u ON u.id = e.user_id
         LEFT JOIN applications a ON a.id = e.application_id
         ${where}
         ORDER BY e.timestamp DESC
         LIMIT $${i} OFFSET $${i + 1}`,
      [...values, q.limit, offset]
    );

    res.json({
      events: eventsRes.rows,
      total,
      page: q.page,
      limit: q.limit,
    });
  })
);

router.get(
  '/recent-events',
  asyncHandler(async (_req, res) => {
    const r = await pool.query(
      `SELECT e.*, u.full_name AS user_name, u.email AS user_email, a.name AS app_name
         FROM access_events e
         LEFT JOIN users u ON u.id = e.user_id
         LEFT JOIN applications a ON a.id = e.application_id
        WHERE e.outcome = 'denied'
        ORDER BY e.timestamp DESC
        LIMIT 10`
    );
    res.json({ events: r.rows });
  })
);

// ─── APPLICATION CRUD ─────────────────────────────────────────

const AppCreateSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  app_url: z.string().url(),
  protocol: z.enum(['https', 'ssh', 'rdp']).default('https'),
  required_mfa: z.boolean().default(true),
  description: z.string().optional(),
  icon_url: z.string().optional(),
});

router.post(
  '/applications',
  asyncHandler(async (req, res) => {
    const body = AppCreateSchema.parse(req.body);
    const r = await pool.query(
      `INSERT INTO applications (name, slug, app_url, protocol, required_mfa, description, icon_url)
       VALUES ($1, $2, $3, $4::app_protocol, $5, $6, $7)
       RETURNING *`,
      [body.name, body.slug, body.app_url, body.protocol, body.required_mfa, body.description || null, body.icon_url || null]
    );
    res.status(201).json({ application: r.rows[0] });
  })
);

router.put(
  '/applications/:id',
  asyncHandler(async (req, res) => {
    const body = AppCreateSchema.partial().parse(req.body);
    const fields: string[] = [];
    const values: unknown[] = [];
    let i = 1;
    if (body.name !== undefined) { fields.push(`name = $${i++}`); values.push(body.name); }
    if (body.slug !== undefined) { fields.push(`slug = $${i++}`); values.push(body.slug); }
    if (body.app_url !== undefined) { fields.push(`app_url = $${i++}`); values.push(body.app_url); }
    if (body.protocol !== undefined) { fields.push(`protocol = $${i++}::app_protocol`); values.push(body.protocol); }
    if (body.required_mfa !== undefined) { fields.push(`required_mfa = $${i++}`); values.push(body.required_mfa); }
    if (body.description !== undefined) { fields.push(`description = $${i++}`); values.push(body.description); }
    if (body.icon_url !== undefined) { fields.push(`icon_url = $${i++}`); values.push(body.icon_url); }
    if (fields.length === 0) { res.json({ application: null }); return; }
    values.push(req.params.id);
    const r = await pool.query(
      `UPDATE applications SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    );
    if (!r.rows[0]) { res.status(404).json({ error: 'not_found' }); return; }
    res.json({ application: r.rows[0] });
  })
);

router.delete(
  '/applications/:id',
  asyncHandler(async (req, res) => {
    // Remove references in access_events first
    await pool.query('UPDATE access_events SET application_id = NULL WHERE application_id = $1', [req.params.id]);
    const r = await pool.query('DELETE FROM applications WHERE id = $1 RETURNING id', [req.params.id]);
    if (!r.rows[0]) { res.status(404).json({ error: 'not_found' }); return; }
    res.json({ ok: true });
  })
);

// ─── USER CRUD ────────────────────────────────────────────────

const UserCreateSchema = z.object({
  email: z.string().email(),
  full_name: z.string().min(1),
  role: z.enum(['admin', 'helpdesk', 'user']).default('user'),
  department: z.string().optional(),
  password: z.string().min(6).optional(),
});

router.post(
  '/users',
  asyncHandler(async (req, res) => {
    const body = UserCreateSchema.parse(req.body);
    let passwordHash: string | null = null;
    if (body.password) {
      passwordHash = await bcrypt.hash(body.password, 12);
    }
    const r = await pool.query(
      `INSERT INTO users (email, full_name, role, department, password_hash)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, full_name, role, department, status, created_at, last_login_at`,
      [body.email, body.full_name, body.role, body.department || null, passwordHash]
    );
    res.status(201).json({ user: r.rows[0] });
  })
);

const UserUpdateSchema = z.object({
  full_name: z.string().min(1).optional(),
  role: z.enum(['admin', 'helpdesk', 'user']).optional(),
  department: z.string().optional(),
  status: z.enum(['active', 'suspended', 'deactivated']).optional(),
  password: z.string().min(6).optional(),
});

router.put(
  '/users/:id',
  asyncHandler(async (req, res) => {
    const body = UserUpdateSchema.parse(req.body);
    const fields: string[] = [];
    const values: unknown[] = [];
    let i = 1;
    if (body.full_name !== undefined) { fields.push(`full_name = $${i++}`); values.push(body.full_name); }
    if (body.role !== undefined) { fields.push(`role = $${i++}`); values.push(body.role); }
    if (body.department !== undefined) { fields.push(`department = $${i++}`); values.push(body.department); }
    if (body.status !== undefined) { fields.push(`status = $${i++}::user_status`); values.push(body.status); }
    if (body.password !== undefined) {
      const hash = await bcrypt.hash(body.password, 12);
      fields.push(`password_hash = $${i++}`);
      values.push(hash);
    }
    if (fields.length === 0) { res.json({ user: null }); return; }
    values.push(req.params.id);
    const r = await pool.query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${i}
       RETURNING id, email, full_name, role, department, status, created_at, last_login_at`,
      values
    );
    if (!r.rows[0]) { res.status(404).json({ error: 'not_found' }); return; }
    res.json({ user: r.rows[0] });
  })
);

router.delete(
  '/users/:id',
  asyncHandler(async (req, res) => {
    // Soft-delete: deactivate instead of hard delete
    const r = await pool.query(
      `UPDATE users SET status = 'deactivated'::user_status WHERE id = $1
       RETURNING id, email, full_name, status`,
      [req.params.id]
    );
    if (!r.rows[0]) { res.status(404).json({ error: 'not_found' }); return; }
    res.json({ user: r.rows[0] });
  })
);

// ─── GROUP CRUD + MEMBER MANAGEMENT ──────────────────────────

const GroupCreateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  source: z.enum(['local', 'idp_synced']).default('local'),
});

router.post(
  '/groups',
  asyncHandler(async (req, res) => {
    const body = GroupCreateSchema.parse(req.body);
    const r = await pool.query(
      `INSERT INTO groups (name, description, source) VALUES ($1, $2, $3::group_source) RETURNING *`,
      [body.name, body.description || null, body.source]
    );
    res.status(201).json({ group: r.rows[0] });
  })
);

router.get(
  '/groups/:id',
  asyncHandler(async (req, res) => {
    const gRes = await pool.query('SELECT * FROM groups WHERE id = $1', [req.params.id]);
    if (!gRes.rows[0]) { res.status(404).json({ error: 'not_found' }); return; }
    const mRes = await pool.query(
      `SELECT u.id, u.email, u.full_name, u.department, u.role, u.status
         FROM users u JOIN user_groups ug ON ug.user_id = u.id
        WHERE ug.group_id = $1 ORDER BY u.full_name`,
      [req.params.id]
    );
    res.json({ group: gRes.rows[0], members: mRes.rows });
  })
);

router.put(
  '/groups/:id',
  asyncHandler(async (req, res) => {
    const body = GroupCreateSchema.partial().parse(req.body);
    const fields: string[] = [];
    const values: unknown[] = [];
    let i = 1;
    if (body.name !== undefined) { fields.push(`name = $${i++}`); values.push(body.name); }
    if (body.description !== undefined) { fields.push(`description = $${i++}`); values.push(body.description); }
    if (body.source !== undefined) { fields.push(`source = $${i++}::group_source`); values.push(body.source); }
    if (fields.length === 0) { res.json({ group: null }); return; }
    values.push(req.params.id);
    const r = await pool.query(
      `UPDATE groups SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    );
    if (!r.rows[0]) { res.status(404).json({ error: 'not_found' }); return; }
    res.json({ group: r.rows[0] });
  })
);

router.delete(
  '/groups/:id',
  asyncHandler(async (req, res) => {
    const r = await pool.query('DELETE FROM groups WHERE id = $1 RETURNING id', [req.params.id]);
    if (!r.rows[0]) { res.status(404).json({ error: 'not_found' }); return; }
    res.json({ ok: true });
  })
);

// Group member management
router.post(
  '/groups/:id/members',
  asyncHandler(async (req, res) => {
    const body = z.object({ userId: z.string().uuid() }).parse(req.body);
    await pool.query(
      'INSERT INTO user_groups (user_id, group_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [body.userId, req.params.id]
    );
    res.status(201).json({ ok: true });
  })
);

router.delete(
  '/groups/:id/members/:userId',
  asyncHandler(async (req, res) => {
    await pool.query(
      'DELETE FROM user_groups WHERE user_id = $1 AND group_id = $2',
      [req.params.userId, req.params.id]
    );
    res.json({ ok: true });
  })
);

// ─── DEVICE ADMIN ─────────────────────────────────────────────

const DeviceUpdateSchema = z.object({
  enrollment_status: z.enum(['pending', 'enrolled', 'quarantined', 'revoked']).optional(),
  managed: z.boolean().optional(),
  posture_score: z.number().int().min(0).max(100).optional(),
  disk_encrypted: z.boolean().optional(),
  firewall_enabled: z.boolean().optional(),
});

router.put(
  '/devices/:id',
  asyncHandler(async (req, res) => {
    const body = DeviceUpdateSchema.parse(req.body);
    const fields: string[] = [];
    const values: unknown[] = [];
    let i = 1;
    if (body.enrollment_status !== undefined) { fields.push(`enrollment_status = $${i++}::device_enrollment`); values.push(body.enrollment_status); }
    if (body.managed !== undefined) { fields.push(`managed = $${i++}`); values.push(body.managed); }
    if (body.posture_score !== undefined) { fields.push(`posture_score = $${i++}`); values.push(body.posture_score); fields.push(`last_posture_check = now()`); }
    if (body.disk_encrypted !== undefined) { fields.push(`disk_encrypted = $${i++}`); values.push(body.disk_encrypted); }
    if (body.firewall_enabled !== undefined) { fields.push(`firewall_enabled = $${i++}`); values.push(body.firewall_enabled); }
    if (fields.length === 0) { res.json({ device: null }); return; }
    values.push(req.params.id);
    const r = await pool.query(
      `UPDATE devices SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    );
    if (!r.rows[0]) { res.status(404).json({ error: 'not_found' }); return; }
    res.json({ device: r.rows[0] });
  })
);

export default router;
