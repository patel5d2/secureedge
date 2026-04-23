import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { pool } from '../db/client';
import { config } from '../config';
import { asyncHandler } from '../middleware/errors';
import { authLimiter } from '../middleware/rateLimit';
import { requireAuth, signToken } from '../middleware/auth';
import { logEvent } from '../services/auditLog';
import { cacheSession, invalidateSession } from '../db/redis';

const router = Router();

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'Password is required'),
});

const MfaSchema = z.object({
  code: z.string().min(1),
});

// Spec: HttpOnly + Secure + SameSite=Strict
const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'strict' as const,
  secure: config.NODE_ENV === 'production',
  maxAge: config.SESSION_TTL_SECONDS * 1000,
  path: '/',
};

function sanitizeUser(u: {
  id: string;
  email: string;
  full_name: string;
  role: string;
  department: string | null;
  status: string;
  last_login_at: Date | null;
}) {
  return {
    id: u.id,
    email: u.email,
    full_name: u.full_name,
    role: u.role,
    department: u.department,
    status: u.status,
    last_login_at: u.last_login_at,
  };
}

router.post(
  '/login',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { email, password } = LoginSchema.parse(req.body);
    const ip = (req.ip || '').replace('::ffff:', '') || null;

    const r = await pool.query(
      `SELECT id, email, full_name, role, department, status, password_hash, last_login_at
         FROM users WHERE email = $1`,
      [email]
    );
    const user = r.rows[0];
    if (!user) {
      // Log failed login attempt
      logEvent({ outcome: 'denied', denyReason: 'invalid_credentials', ipAddress: ip, raw: { email, event: 'login_failed' } }).catch(() => {});
      res.status(401).json({ error: 'invalid_credentials' });
      return;
    }
    if (user.status !== 'active') {
      logEvent({ userId: user.id, outcome: 'denied', denyReason: 'account_not_active', ipAddress: ip, raw: { event: 'login_blocked' } }).catch(() => {});
      res.status(403).json({ error: 'account_not_active' });
      return;
    }
    // Password is always required — no bypass
    if (!user.password_hash) {
      res.status(401).json({ error: 'invalid_credentials' });
      return;
    }
    const passwordOk = await bcrypt.compare(password, user.password_hash);
    if (!passwordOk) {
      logEvent({ userId: user.id, outcome: 'denied', denyReason: 'invalid_password', ipAddress: ip, raw: { event: 'login_failed' } }).catch(() => {});
      res.status(401).json({ error: 'invalid_credentials' });
      return;
    }
    // Create session row
    const ua = req.headers['user-agent'] || null;
    const sessionRow = await pool.query<{ id: string }>(
      `INSERT INTO sessions (user_id, started_at, expires_at, ip_address, user_agent)
       VALUES ($1, now(), now() + ($2 || ' seconds')::interval, $3::inet, $4)
       RETURNING id`,
      [user.id, String(config.SESSION_TTL_SECONDS), ip, ua]
    );
    const sessionId = sessionRow.rows[0].id;

    // Cache session in Redis
    await cacheSession(sessionId, user.id, config.SESSION_TTL_SECONDS);

    await pool.query('UPDATE users SET last_login_at = now() WHERE id = $1', [
      user.id,
    ]);
    // Issue pre-MFA token (mfa: false)
    const token = signToken(user, sessionId, false);
    res.cookie('se_token', token, COOKIE_OPTS);
    res.json({
      user: sanitizeUser(user),
      mfaRequired: true,
      nextStep: 'mfa',
    });
  })
);

router.post(
  '/mfa',
  authLimiter,
  requireAuth,
  asyncHandler(async (req, res) => {
    const { code } = MfaSchema.parse(req.body);

    // TODO: Replace with real TOTP verification (e.g. otpauth library) in production.
    // For dev, accept the hardcoded code.
    const DEV_MFA_CODE = '123456';
    if (code !== DEV_MFA_CODE) {
      res.status(401).json({ error: 'invalid_mfa_code' });
      return;
    }

    // Record MFA verification in session row (server-side, not a cookie)
    if (req.sessionId) {
      await pool.query(
        `UPDATE sessions SET mfa_verified_at = now() WHERE id = $1`,
        [req.sessionId]
      );
    }

    // Re-issue JWT with mfa: true claim so downstream checks are tamper-proof
    const newToken = signToken(req.user!, req.sessionId, true);
    res.cookie('se_token', newToken, COOKIE_OPTS);

    const r = await pool.query(
      `SELECT id, email, full_name, role, department, status, last_login_at
         FROM users WHERE id = $1`,
      [req.user!.id]
    );
    res.json({ user: sanitizeUser(r.rows[0]), ok: true });
  })
);

router.post(
  '/logout',
  asyncHandler(async (req, res) => {
    // Best-effort revoke by session id from the JWT
    if (req.cookies && req.cookies['se_token']) {
      try {
        // Decode without verification — just to get sid
        const token = req.cookies['se_token'] as string;
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(
            Buffer.from(parts[1], 'base64url').toString('utf8')
          );
          if (payload && payload.sid) {
            await pool.query(
              'UPDATE sessions SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL',
              [payload.sid]
            );
            // Invalidate Redis session cache immediately
            await invalidateSession(payload.sid);
          }
        }
      } catch {
        /* ignore */
      }
    }
    res.clearCookie('se_token', { path: '/' });
    res.json({ ok: true });
  })
);

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const r = await pool.query(
      `SELECT id, email, full_name, role, department, status, last_login_at
         FROM users WHERE id = $1`,
      [req.user!.id]
    );
    res.json({ user: sanitizeUser(r.rows[0]) });
  })
);

export default router;
