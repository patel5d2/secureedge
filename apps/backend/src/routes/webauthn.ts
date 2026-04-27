import { Router } from 'express';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type VerifiedRegistrationResponse,
  type VerifiedAuthenticationResponse,
} from '@simplewebauthn/server';
import { config } from '../config';
import { pool } from '../db/client';
import { requireAuth, signToken } from '../middleware/auth';
import { asyncHandler } from '../middleware/errors';

const router = Router();

// All WebAuthn endpoints require the user to be logged in (at least with password)
router.use(requireAuth);

// ── In-memory challenge store (production: use Redis) ─────────────────
const pendingChallenges = new Map<string, { challenge: string; expiresAt: number }>();
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of pendingChallenges) {
    if (val.expiresAt < now) pendingChallenges.delete(key);
  }
}, 60_000);

interface StoredCredential {
  id: string;
  user_id: string;
  public_key: Buffer;
  counter: number;
  device_type: string | null;
  backed_up: boolean;
  transports: string[] | null;
  friendly_name: string | null;
  created_at: string;
  last_used_at: string | null;
}

async function getUserCredentials(userId: string): Promise<StoredCredential[]> {
  const r = await pool.query<StoredCredential>(
    `SELECT id, user_id, public_key, counter, device_type, backed_up, transports, friendly_name, created_at, last_used_at
       FROM webauthn_credentials WHERE user_id = $1`,
    [userId]
  );
  return r.rows;
}

// Use string type for transports to avoid type compatibility issues
type Transport = 'ble' | 'cable' | 'hybrid' | 'internal' | 'nfc' | 'smart-card' | 'usb';

// ── Registration ──────────────────────────────────────────────────────

/**
 * POST /api/auth/webauthn/register/options
 * Generate registration options for a new passkey.
 */
router.post(
  '/register/options',
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const existingCreds = await getUserCredentials(user.id);

    const options = await generateRegistrationOptions({
      rpName: config.WEBAUTHN_RP_NAME,
      rpID: config.WEBAUTHN_RP_ID,
      userID: new TextEncoder().encode(user.id),
      userName: user.email,
      userDisplayName: user.full_name,
      attestationType: 'none',
      excludeCredentials: existingCreds.map((c) => ({
        id: c.id,
        transports: (c.transports || []) as Transport[],
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
    });

    pendingChallenges.set(user.id + ':reg', {
      challenge: options.challenge,
      expiresAt: Date.now() + 5 * 60_000,
    });

    res.json(options);
  })
);

/**
 * POST /api/auth/webauthn/register/verify
 * Verify the registration response and store the credential.
 */
router.post(
  '/register/verify',
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const body = req.body as { response: Record<string, unknown>; friendlyName?: string };

    const pending = pendingChallenges.get(user.id + ':reg');
    if (!pending || pending.expiresAt < Date.now()) {
      res.status(400).json({ error: 'challenge_expired' });
      return;
    }
    pendingChallenges.delete(user.id + ':reg');

    let verification: VerifiedRegistrationResponse;
    try {
      verification = await verifyRegistrationResponse({
        response: body.response as unknown as Parameters<typeof verifyRegistrationResponse>[0]['response'],
        expectedChallenge: pending.challenge,
        expectedOrigin: config.WEBAUTHN_ORIGIN,
        expectedRPID: config.WEBAUTHN_RP_ID,
      });
    } catch (err) {
      res.status(400).json({ error: 'verification_failed', detail: (err as Error).message });
      return;
    }

    if (!verification.verified || !verification.registrationInfo) {
      res.status(400).json({ error: 'verification_failed' });
      return;
    }

    const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;

    await pool.query(
      `INSERT INTO webauthn_credentials (id, user_id, public_key, counter, device_type, backed_up, transports, friendly_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        credential.id,
        user.id,
        Buffer.from(credential.publicKey),
        credential.counter,
        credentialDeviceType,
        credentialBackedUp,
        credential.transports || null,
        body.friendlyName || 'Passkey',
      ]
    );

    res.json({ verified: true, credentialId: credential.id });
  })
);

// ── Authentication ────────────────────────────────────────────────────

/**
 * POST /api/auth/webauthn/authenticate/options
 * Generate authentication options for an existing passkey.
 */
router.post(
  '/authenticate/options',
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const creds = await getUserCredentials(user.id);

    if (creds.length === 0) {
      res.status(404).json({ error: 'no_passkeys', message: 'No passkeys registered.' });
      return;
    }

    const options = await generateAuthenticationOptions({
      rpID: config.WEBAUTHN_RP_ID,
      allowCredentials: creds.map((c) => ({
        id: c.id,
        transports: (c.transports || []) as Transport[],
      })),
      userVerification: 'preferred',
    });

    pendingChallenges.set(user.id + ':auth', {
      challenge: options.challenge,
      expiresAt: Date.now() + 5 * 60_000,
    });

    res.json(options);
  })
);

/**
 * POST /api/auth/webauthn/authenticate/verify
 * Verify the authentication assertion, update counter, re-issue JWT with mfa: true.
 */
router.post(
  '/authenticate/verify',
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const body = req.body as { response: Record<string, unknown> };

    const pending = pendingChallenges.get(user.id + ':auth');
    if (!pending || pending.expiresAt < Date.now()) {
      res.status(400).json({ error: 'challenge_expired' });
      return;
    }
    pendingChallenges.delete(user.id + ':auth');

    // Find the credential being used
    const credId = (body.response as { id?: string }).id;
    if (!credId) {
      res.status(400).json({ error: 'missing_credential_id' });
      return;
    }

    const credRow = await pool.query<StoredCredential>(
      `SELECT * FROM webauthn_credentials WHERE id = $1 AND user_id = $2`,
      [credId, user.id]
    );
    const storedCred = credRow.rows[0];
    if (!storedCred) {
      res.status(400).json({ error: 'credential_not_found' });
      return;
    }

    let verification: VerifiedAuthenticationResponse;
    try {
      verification = await verifyAuthenticationResponse({
        response: body.response as unknown as Parameters<typeof verifyAuthenticationResponse>[0]['response'],
        expectedChallenge: pending.challenge,
        expectedOrigin: config.WEBAUTHN_ORIGIN,
        expectedRPID: config.WEBAUTHN_RP_ID,
        credential: {
          id: storedCred.id,
          publicKey: new Uint8Array(storedCred.public_key),
          counter: storedCred.counter,
          transports: (storedCred.transports || []) as Transport[],
        },
      });
    } catch (err) {
      res.status(400).json({ error: 'verification_failed', detail: (err as Error).message });
      return;
    }

    if (!verification.verified) {
      res.status(400).json({ error: 'verification_failed' });
      return;
    }

    // Update counter and last_used_at
    await pool.query(
      `UPDATE webauthn_credentials SET counter = $1, last_used_at = now() WHERE id = $2`,
      [verification.authenticationInfo.newCounter, credId]
    );

    // Mark MFA verified in session
    if (req.sessionId) {
      await pool.query(
        `UPDATE sessions SET mfa_verified_at = now() WHERE id = $1`,
        [req.sessionId]
      );
    }

    // Re-issue JWT with mfa: true
    const newToken = signToken(user, req.sessionId, true);
    res.cookie('se_token', newToken, {
      httpOnly: true,
      sameSite: 'strict',
      secure: config.NODE_ENV === 'production',
      maxAge: config.SESSION_TTL_SECONDS * 1000,
      path: '/',
    });

    res.json({ verified: true });
  })
);

// ── Credential management ─────────────────────────────────────────────

/**
 * GET /api/auth/webauthn/credentials
 * List the current user's passkeys.
 */
router.get(
  '/credentials',
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const creds = await getUserCredentials(user.id);
    res.json({
      credentials: creds.map((c) => ({
        id: c.id,
        friendlyName: c.friendly_name,
        deviceType: c.device_type,
        backedUp: c.backed_up,
        createdAt: c.created_at,
        lastUsedAt: c.last_used_at,
      })),
    });
  })
);

/**
 * DELETE /api/auth/webauthn/credentials/:id
 * Remove a passkey.
 */
router.delete(
  '/credentials/:id',
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const credId = req.params.id;
    await pool.query(
      `DELETE FROM webauthn_credentials WHERE id = $1 AND user_id = $2`,
      [credId, user.id]
    );
    res.json({ ok: true });
  })
);

export default router;
