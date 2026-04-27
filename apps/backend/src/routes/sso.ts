import { Router } from 'express';
import { config, isOidcEnabled } from '../config';
import { pool } from '../db/client';
import { signToken } from '../middleware/auth';
import { cacheSession } from '../db/redis';
import { asyncHandler } from '../middleware/errors';
import { logger } from '../lib/logger';

const router = Router();

// ── In-memory state store (production: use Redis) ─────────────────────
const pendingStates = new Map<string, { codeVerifier: string; nonce: string; returnTo: string; expiresAt: number }>();

// Clean up expired states every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of pendingStates) {
    if (val.expiresAt < now) pendingStates.delete(key);
  }
}, 5 * 60_000);

/**
 * GET /api/auth/sso/config
 * Public endpoint — returns SSO availability for the frontend.
 */
router.get('/config', (_req, res) => {
  if (!isOidcEnabled()) {
    res.json({ enabled: false });
    return;
  }
  res.json({
    enabled: true,
    providerName: config.OIDC_PROVIDER_NAME,
    loginUrl: '/api/auth/sso/login',
  });
});

/**
 * GET /api/auth/sso/login
 * Redirects the user to the OIDC provider's authorization endpoint.
 */
router.get(
  '/login',
  asyncHandler(async (_req, res) => {
    if (!isOidcEnabled()) {
      res.status(404).json({ error: 'sso_not_configured' });
      return;
    }

    // openid-client v6 API
    const oidc = await import('openid-client');

    const oidcConfig = await oidc.discovery(
      new URL(config.OIDC_ISSUER),
      config.OIDC_CLIENT_ID,
      config.OIDC_CLIENT_SECRET
    );

    const state = oidc.randomState();
    const nonce = oidc.randomNonce();
    const codeVerifier = oidc.randomPKCECodeVerifier();
    const codeChallenge = await oidc.calculatePKCECodeChallenge(codeVerifier);

    pendingStates.set(state, {
      codeVerifier,
      nonce,
      returnTo: '/portal',
      expiresAt: Date.now() + 10 * 60_000, // 10 minute TTL
    });

    const authUrl = oidc.buildAuthorizationUrl(oidcConfig, {
      redirect_uri: config.OIDC_REDIRECT_URI,
      scope: 'openid email profile',
      state,
      nonce,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    res.redirect(authUrl.href);
  })
);

/**
 * GET /api/auth/sso/callback
 * OIDC callback — validates the authorization code, performs JIT provisioning,
 * creates a session, sets the JWT cookie, and redirects to the portal.
 */
router.get(
  '/callback',
  asyncHandler(async (req, res) => {
    if (!isOidcEnabled()) {
      res.status(404).json({ error: 'sso_not_configured' });
      return;
    }

    const oidc = await import('openid-client');

    const oidcConfig = await oidc.discovery(
      new URL(config.OIDC_ISSUER),
      config.OIDC_CLIENT_ID,
      config.OIDC_CLIENT_SECRET
    );

    // Reconstruct the current URL from the request
    const currentUrl = new URL(
      `${req.protocol}://${req.get('host')}${req.originalUrl}`
    );

    // Extract state from the callback params
    const state = currentUrl.searchParams.get('state');
    const stateData = state ? pendingStates.get(state) : undefined;
    if (!stateData) {
      logger.warn({ state }, 'SSO callback: invalid or expired state');
      res.redirect('/login?error=sso_state_invalid');
      return;
    }
    pendingStates.delete(state!);

    if (stateData.expiresAt < Date.now()) {
      res.redirect('/login?error=sso_state_expired');
      return;
    }

    // Exchange code for tokens
    let tokens;
    try {
      tokens = await oidc.authorizationCodeGrant(oidcConfig, currentUrl, {
        pkceCodeVerifier: stateData.codeVerifier,
        expectedNonce: stateData.nonce,
        expectedState: state!,
      });
    } catch (err) {
      logger.error({ err }, 'SSO callback: token exchange failed');
      res.redirect('/login?error=sso_token_error');
      return;
    }

    const claims = tokens.claims();
    if (!claims) {
      res.redirect('/login?error=sso_no_claims');
      return;
    }

    const sub = claims.sub;
    const email = claims.email as string | undefined;
    const name = (claims.name as string) || (claims.preferred_username as string) || email || sub;

    if (!email) {
      logger.warn({ sub }, 'SSO callback: no email in id_token claims');
      res.redirect('/login?error=sso_no_email');
      return;
    }

    // ── JIT User Provisioning ─────────────────────────────────────────
    const providerName = config.OIDC_PROVIDER_NAME.toLowerCase();

    // First: look up by IdP identity
    let userRow = await pool.query<{
      id: string;
      email: string;
      full_name: string;
      role: string;
      status: string;
    }>(
      `SELECT id, email, full_name, role, status
         FROM users
         WHERE idp_provider = $1 AND idp_subject = $2`,
      [providerName, sub]
    );

    let user = userRow.rows[0];

    if (!user) {
      // Second: check if a local account with this email already exists
      userRow = await pool.query(
        `SELECT id, email, full_name, role, status
           FROM users WHERE email = $1`,
        [email]
      );
      user = userRow.rows[0];

      if (user) {
        // Link existing account to IdP
        await pool.query(
          `UPDATE users SET idp_provider = $1, idp_subject = $2 WHERE id = $3`,
          [providerName, sub, user.id]
        );
        logger.info({ userId: user.id, email }, 'SSO: linked existing user to IdP');
      } else {
        // Create new user via JIT provisioning
        const newUser = await pool.query<{
          id: string;
          email: string;
          full_name: string;
          role: string;
          status: string;
        }>(
          `INSERT INTO users (email, full_name, role, status, idp_provider, idp_subject)
           VALUES ($1, $2, 'user', 'active', $3, $4)
           RETURNING id, email, full_name, role, status`,
          [email, name, providerName, sub]
        );
        user = newUser.rows[0];
        logger.info({ userId: user.id, email }, 'SSO: JIT-provisioned new user');
      }
    }

    if (user.status !== 'active') {
      res.redirect('/login?error=account_not_active');
      return;
    }

    // Update last login
    await pool.query('UPDATE users SET last_login_at = now() WHERE id = $1', [user.id]);

    // Create session
    const ip = (req.ip || '').replace('::ffff:', '') || null;
    const ua = req.headers['user-agent'] || null;
    const sessionRow = await pool.query<{ id: string }>(
      `INSERT INTO sessions (user_id, started_at, expires_at, ip_address, user_agent)
       VALUES ($1, now(), now() + ($2 || ' seconds')::interval, $3::inet, $4)
       RETURNING id`,
      [user.id, String(config.SESSION_TTL_SECONDS), ip, ua]
    );
    const sessionId = sessionRow.rows[0].id;
    await cacheSession(sessionId, user.id, config.SESSION_TTL_SECONDS);

    // SSO users skip MFA step — the IdP handles authentication strength
    const token = signToken(user, sessionId, true);
    res.cookie('se_token', token, {
      httpOnly: true,
      sameSite: 'strict',
      secure: config.NODE_ENV === 'production',
      maxAge: config.SESSION_TTL_SECONDS * 1000,
      path: '/',
    });

    // Redirect to frontend
    const frontendOrigin = config.CORS_ORIGIN || 'http://localhost:5173';
    res.redirect(`${frontendOrigin}/portal`);
  })
);

export default router;
