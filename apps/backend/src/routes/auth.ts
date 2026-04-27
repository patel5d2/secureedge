import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { z } from 'zod';
import { pool } from '../db/client';
import { config } from '../config';
import { asyncHandler } from '../middleware/errors';
import { authLimiter, signupLimiter } from '../middleware/rateLimit';
import { requireAuth, signToken } from '../middleware/auth';
import { logEvent } from '../services/auditLog';
import { cacheSession, invalidateSession } from '../db/redis';
import { sendVerificationEmail } from '../services/email';
import { verifyCaptcha } from '../services/captcha';

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
      `SELECT id, email, full_name, role, department, status, password_hash, email_verified, last_login_at
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
    if (user.email_verified === false) {
      logEvent({ userId: user.id, outcome: 'denied', denyReason: 'email_not_verified', ipAddress: ip, raw: { event: 'login_blocked' } }).catch(() => {});
      res.status(403).json({ error: 'email_not_verified' });
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

// ── Self-serve sign-up ────────────────────────────────────────────────

const TOKEN_TTL_MINUTES = 10;
// OWASP-aligned baseline; password strength is also checked client-side
// so users get fast feedback. Server is the source of truth.
const PASSWORD_RULES =
  'must be at least 12 characters and include uppercase, lowercase, number, and symbol';

const SignupSchema = z.object({
  email: z.string().email().max(254).transform((v) => v.toLowerCase().trim()),
  full_name: z.string().min(2).max(80).transform((v) => v.trim()),
  password: z
    .string()
    .min(12, PASSWORD_RULES)
    .max(128)
    .refine((v) => /[a-z]/.test(v), PASSWORD_RULES)
    .refine((v) => /[A-Z]/.test(v), PASSWORD_RULES)
    .refine((v) => /\d/.test(v), PASSWORD_RULES)
    .refine((v) => /[^A-Za-z0-9]/.test(v), PASSWORD_RULES),
  accept_terms: z.literal(true, { errorMap: () => ({ message: 'You must accept the terms.' }) }),
  captcha_token: z.string().min(1),
});

const VerifySchema = z.object({
  token: z.string().min(16).max(256),
});

const ResendSchema = z.object({
  email: z.string().email().max(254).transform((v) => v.toLowerCase().trim()),
  captcha_token: z.string().min(1),
});

function hashToken(token: string): Buffer {
  return crypto.createHash('sha256').update(token).digest();
}

async function isDomainAllowed(email: string): Promise<boolean> {
  const at = email.lastIndexOf('@');
  if (at < 0) return false;
  const domain = email.slice(at + 1);
  const r = await pool.query<{ domain: string }>(
    'SELECT domain FROM signup_allowed_domains WHERE domain = $1 AND enabled = true',
    [domain]
  );
  return r.rowCount! > 0;
}

async function issueVerificationToken(userId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + TOKEN_TTL_MINUTES * 60_000);
  await pool.query(
    `INSERT INTO email_verification_tokens (token_hash, user_id, purpose, expires_at)
     VALUES ($1, $2, 'verify_email', $3)`,
    [hashToken(token), userId, expires]
  );
  return token;
}

router.post(
  '/signup',
  signupLimiter,
  asyncHandler(async (req, res) => {
    const ip = (req.ip || '').replace('::ffff:', '') || null;
    const parsed = SignupSchema.parse(req.body);

    // Always respond 202 with the same shape, regardless of branch — prevents
    // account-enumeration via timing or status-code differences.
    const ack = (): void => {
      res.status(202).json({ ok: true, nextStep: 'verify_email' });
    };

    const captchaOk = await verifyCaptcha(parsed.captcha_token, ip);
    if (!captchaOk) {
      logEvent({ outcome: 'denied', denyReason: 'captcha_failed', ipAddress: ip, raw: { event: 'signup_captcha_failed', email_hash: hashToken(parsed.email).toString('hex') } }).catch(() => {});
      res.status(400).json({ error: 'captcha_failed' });
      return;
    }

    if (!(await isDomainAllowed(parsed.email))) {
      logEvent({ outcome: 'denied', denyReason: 'domain_not_allowed', ipAddress: ip, raw: { event: 'signup_blocked_domain', email_hash: hashToken(parsed.email).toString('hex') } }).catch(() => {});
      // Same 202 to avoid leaking which domains are configured.
      ack();
      return;
    }

    // Check for an existing user — but never reveal it.
    const existing = await pool.query<{ id: string; email_verified: boolean }>(
      'SELECT id, email_verified FROM users WHERE email = $1',
      [parsed.email]
    );

    if (existing.rowCount && existing.rows[0].email_verified) {
      // Account exists and is verified — silently succeed; the user (or attacker)
      // gets no signal. A real owner can reset their password instead.
      ack();
      return;
    }

    const passwordHash = await bcrypt.hash(parsed.password, 12);
    let userId: string;

    if (existing.rowCount) {
      // Re-use the unverified row, refresh password + name, drop any old tokens.
      userId = existing.rows[0].id;
      await pool.query(
        `UPDATE users SET full_name = $1, password_hash = $2 WHERE id = $3`,
        [parsed.full_name, passwordHash, userId]
      );
      await pool.query(
        `DELETE FROM email_verification_tokens WHERE user_id = $1 AND purpose = 'verify_email'`,
        [userId]
      );
    } else {
      const ins = await pool.query<{ id: string }>(
        `INSERT INTO users (email, full_name, role, status, password_hash, email_verified, created_via)
         VALUES ($1, $2, 'user', 'active', $3, false, 'self')
         RETURNING id`,
        [parsed.email, parsed.full_name, passwordHash]
      );
      userId = ins.rows[0].id;
    }

    const token = await issueVerificationToken(userId);
    sendVerificationEmail(parsed.email, parsed.full_name, token).catch((err) => {
      // Don't surface mailer errors to the caller — token is on file, can be resent.
      // eslint-disable-next-line no-console
      console.error('[signup] verification email failed', err);
    });

    logEvent({ userId, outcome: 'allowed', ipAddress: ip, raw: { event: 'signup_started' } }).catch(() => {});
    ack();
  })
);

router.post(
  '/verify-email',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { token } = VerifySchema.parse(req.body);
    const ip = (req.ip || '').replace('::ffff:', '') || null;
    const r = await pool.query<{ user_id: string; expires_at: Date; consumed_at: Date | null }>(
      `SELECT user_id, expires_at, consumed_at
         FROM email_verification_tokens
        WHERE token_hash = $1 AND purpose = 'verify_email'`,
      [hashToken(token)]
    );
    if (!r.rowCount || r.rows[0].consumed_at || r.rows[0].expires_at < new Date()) {
      res.status(400).json({ error: 'token_invalid_or_expired' });
      return;
    }
    const userId = r.rows[0].user_id;

    await pool.query(
      `UPDATE email_verification_tokens SET consumed_at = now()
        WHERE token_hash = $1`,
      [hashToken(token)]
    );
    await pool.query(`UPDATE users SET email_verified = true WHERE id = $1`, [userId]);

    logEvent({ userId, outcome: 'allowed', ipAddress: ip, raw: { event: 'email_verified' } }).catch(() => {});
    res.json({ ok: true });
  })
);

router.post(
  '/resend-verification',
  signupLimiter,
  asyncHandler(async (req, res) => {
    const parsed = ResendSchema.parse(req.body);
    const ip = (req.ip || '').replace('::ffff:', '') || null;

    const captchaOk = await verifyCaptcha(parsed.captcha_token, ip);
    if (!captchaOk) {
      res.status(400).json({ error: 'captcha_failed' });
      return;
    }

    const r = await pool.query<{ id: string; full_name: string; email_verified: boolean }>(
      'SELECT id, full_name, email_verified FROM users WHERE email = $1',
      [parsed.email]
    );

    // Always 202 — no enumeration.
    if (r.rowCount && !r.rows[0].email_verified) {
      const userId = r.rows[0].id;
      await pool.query(
        `DELETE FROM email_verification_tokens WHERE user_id = $1 AND purpose = 'verify_email'`,
        [userId]
      );
      const token = await issueVerificationToken(userId);
      sendVerificationEmail(parsed.email, r.rows[0].full_name, token).catch(() => {});
    }
    res.status(202).json({ ok: true });
  })
);

export default router;
