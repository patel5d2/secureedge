import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/client';
import { asyncHandler } from '../middleware/errors';
import { requireAuth } from '../middleware/auth';
import { simulate } from '../services/policyEngine';
import { Application, Group, PolicyRules } from '../types';

const router = Router();

router.use(requireAuth);

router.get(
  '/apps',
  asyncHandler(async (req, res) => {
    const uid = req.user!.id;
    const appsRes = await pool.query<Application>(
      `SELECT id, name, slug, description, icon_url, app_url, protocol, required_mfa, created_at
         FROM applications
         ORDER BY name ASC`
    );
    const apps = await Promise.all(
      appsRes.rows.map(async (app) => {
        const sim = await simulate(uid, app.id);
        const postureReasons = [
          'device_not_managed',
          'disk_not_encrypted',
          'posture_failed',
        ];
        return {
          id: app.id,
          name: app.name,
          slug: app.slug,
          description: app.description,
          icon_url: app.icon_url,
          app_url: app.app_url,
          protocol: app.protocol,
          accessible: sim.outcome === 'allowed',
          posture_required:
            sim.outcome === 'denied' &&
            !!sim.reason &&
            postureReasons.includes(sim.reason),
          reason: sim.reason,
        };
      })
    );
    res.json({ apps });
  })
);

router.get(
  '/apps/:id',
  asyncHandler(async (req, res) => {
    const uid = req.user!.id;
    const appRes = await pool.query<Application>(
      `SELECT id, name, slug, description, icon_url, app_url, protocol, required_mfa, created_at
         FROM applications WHERE id = $1`,
      [req.params.id]
    );
    const app = appRes.rows[0];
    if (!app) {
      res.status(404).json({ error: 'not_found' });
      return;
    }

    // policies that reference this app and are active — collect groups the user is in
    const policiesRes = await pool.query<{ rules: PolicyRules }>(
      `SELECT rules FROM policies WHERE status = 'active'`
    );
    const userGroupsRes = await pool.query<{ group_id: string }>(
      `SELECT group_id FROM user_groups WHERE user_id = $1`,
      [uid]
    );
    const userGroupIds = new Set(userGroupsRes.rows.map((r) => r.group_id));
    const relevantGroupIds = new Set<string>();
    for (const p of policiesRes.rows) {
      const apps = p.rules?.what?.applications || [];
      if (!apps.includes(app.id)) continue;
      const gids = p.rules?.who?.groups || [];
      for (const g of gids) {
        if (userGroupIds.has(g)) relevantGroupIds.add(g);
      }
    }
    let accessGroups: Group[] = [];
    if (relevantGroupIds.size > 0) {
      const r = await pool.query<Group>(
        `SELECT id, name, description, source, created_at
           FROM groups WHERE id = ANY($1::uuid[])`,
        [Array.from(relevantGroupIds)]
      );
      accessGroups = r.rows;
    }

    const sim = await simulate(uid, app.id);

    // requirements summary — derive from any policy that governs this app
    const requirements = {
      managed: false,
      encrypted: false,
      mfa: app.required_mfa,
    };
    for (const p of policiesRes.rows) {
      const apps = p.rules?.what?.applications || [];
      if (!apps.includes(app.id)) continue;
      for (const c of p.rules?.conditions || []) {
        if (c.type === 'device_managed' && c.value) requirements.managed = true;
        if (c.type === 'disk_encrypted' && c.value) requirements.encrypted = true;
        if (c.type === 'mfa_verified' && c.value) requirements.mfa = true;
      }
    }

    res.json({
      app,
      requirements,
      accessGroups,
      simulate: sim,
    });
  })
);

router.get(
  '/sessions',
  asyncHandler(async (req, res) => {
    const r = await pool.query(
      `SELECT id, user_id, device_id, started_at, expires_at, revoked_at, ip_address, user_agent
         FROM sessions
         WHERE user_id = $1
         ORDER BY started_at DESC
         LIMIT 50`,
      [req.user!.id]
    );
    res.json({ sessions: r.rows });
  })
);

router.get(
  '/devices',
  asyncHandler(async (req, res) => {
    const r = await pool.query(
      `SELECT id, user_id, name, os, enrollment_status, last_posture_check,
              posture_score, managed, disk_encrypted, registered_at
         FROM devices
         WHERE user_id = $1
         ORDER BY registered_at DESC`,
      [req.user!.id]
    );
    res.json({ devices: r.rows });
  })
);

router.get(
  '/profile',
  asyncHandler(async (req, res) => {
    const uid = req.user!.id;
    const uRes = await pool.query(
      `SELECT id, email, full_name, role, department, status, last_login_at, created_at
         FROM users WHERE id = $1`,
      [uid]
    );
    const gRes = await pool.query<Group>(
      `SELECT g.id, g.name, g.description, g.source, g.created_at
         FROM groups g
         JOIN user_groups ug ON ug.group_id = g.id
        WHERE ug.user_id = $1
        ORDER BY g.name`,
      [uid]
    );
    const dRes = await pool.query(
      `SELECT id, name, os, enrollment_status, last_posture_check, posture_score,
              managed, disk_encrypted, registered_at
         FROM devices
         WHERE user_id = $1
         ORDER BY registered_at DESC
         LIMIT 1`,
      [uid]
    );
    res.json({
      user: uRes.rows[0],
      groups: gRes.rows,
      device: dRes.rows[0] || null,
    });
  })
);

// ─── SESSION REVOKE ───────────────────────────────────────────

router.delete(
  '/sessions/:id',
  asyncHandler(async (req, res) => {
    const r = await pool.query(
      `UPDATE sessions SET revoked_at = now()
       WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL
       RETURNING id`,
      [req.params.id, req.user!.id]
    );
    if (!r.rows[0]) { res.status(404).json({ error: 'not_found_or_already_revoked' }); return; }
    res.json({ ok: true });
  })
);

// ─── DEVICE REGISTRATION ─────────────────────────────────────

const DeviceRegisterSchema = z.object({
  name: z.string().min(1),
  os: z.string().min(1),
  os_version: z.string().optional(),
  serial_number: z.string().optional(),
  managed: z.boolean().default(false),
  disk_encrypted: z.boolean().default(false),
  firewall_enabled: z.boolean().default(false),
});

router.post(
  '/devices',
  asyncHandler(async (req, res) => {
    const body = DeviceRegisterSchema.parse(req.body);
    const r = await pool.query(
      `INSERT INTO devices (user_id, name, os, os_version, serial_number, managed, disk_encrypted, firewall_enabled, enrollment_status, posture_score, last_posture_check)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending'::device_enrollment, $9, now())
       RETURNING *`,
      [
        req.user!.id, body.name, body.os, body.os_version || null,
        body.serial_number || null, body.managed, body.disk_encrypted,
        body.firewall_enabled,
        // Calculate initial posture score
        Math.round((body.managed ? 40 : 0) + (body.disk_encrypted ? 30 : 0) + (body.firewall_enabled ? 20 : 0) + 10),
      ]
    );
    res.status(201).json({ device: r.rows[0] });
  })
);

const DeviceUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  os: z.string().min(1).optional(),
  os_version: z.string().optional(),
  managed: z.boolean().optional(),
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
    if (body.name !== undefined) { fields.push(`name = $${i++}`); values.push(body.name); }
    if (body.os !== undefined) { fields.push(`os = $${i++}`); values.push(body.os); }
    if (body.os_version !== undefined) { fields.push(`os_version = $${i++}`); values.push(body.os_version); }
    if (body.managed !== undefined) { fields.push(`managed = $${i++}`); values.push(body.managed); }
    if (body.disk_encrypted !== undefined) { fields.push(`disk_encrypted = $${i++}`); values.push(body.disk_encrypted); }
    if (body.firewall_enabled !== undefined) { fields.push(`firewall_enabled = $${i++}`); values.push(body.firewall_enabled); }
    // Recalculate posture score if posture-related fields changed
    if (body.managed !== undefined || body.disk_encrypted !== undefined || body.firewall_enabled !== undefined) {
      fields.push(`last_posture_check = now()`);
    }
    if (fields.length === 0) { res.json({ device: null }); return; }
    values.push(req.params.id);
    values.push(req.user!.id);
    const r = await pool.query(
      `UPDATE devices SET ${fields.join(', ')} WHERE id = $${i} AND user_id = $${i + 1} RETURNING *`,
      values
    );
    if (!r.rows[0]) { res.status(404).json({ error: 'not_found' }); return; }
    res.json({ device: r.rows[0] });
  })
);

router.delete(
  '/devices/:id',
  asyncHandler(async (req, res) => {
    const r = await pool.query(
      'DELETE FROM devices WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user!.id]
    );
    if (!r.rows[0]) { res.status(404).json({ error: 'not_found' }); return; }
    res.json({ ok: true });
  })
);

export default router;
