import { config } from '../config';
import { logger } from '../lib/logger';

const TURNSTILE_VERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

// Cloudflare's published "always-passes" sitekey/secret pair, documented at
// https://developers.cloudflare.com/turnstile/troubleshooting/testing/.
// Used as a default in non-production so the sign-up flow works end-to-end
// without anyone having to log into Cloudflare. NEVER use these in prod.
const TEST_SECRET_ALWAYS_PASSES = '1x0000000000000000000000000000000AA';

interface TurnstileResponse {
  success: boolean;
  'error-codes'?: string[];
}

/**
 * Verify a Cloudflare Turnstile token. Returns true on success.
 *
 * In production, TURNSTILE_SECRET is required — if missing, every request
 * fails closed.
 * In non-production, if no secret is set we fall back to the published test
 * secret (which validates the published test sitekey on the frontend).
 */
export async function verifyCaptcha(token: string | undefined, ip: string | null): Promise<boolean> {
  const isProd = config.NODE_ENV === 'production';
  let secret = process.env.TURNSTILE_SECRET || '';

  if (!secret) {
    if (isProd) {
      logger.error('TURNSTILE_SECRET not set in production — captcha verification cannot run');
      return false;
    }
    secret = TEST_SECRET_ALWAYS_PASSES;
  }

  if (!token) return false;
  // Server-side fast path used by flows that don't render a widget
  // (e.g. the "resend verification email" button). Disabled in production.
  if (!isProd && token === 'dev-bypass') return true;

  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip) body.set('remoteip', ip);
    const res = await fetch(TURNSTILE_VERIFY, { method: 'POST', body });
    if (!res.ok) return false;
    const json = (await res.json()) as TurnstileResponse;
    return !!json.success;
  } catch (err) {
    logger.warn({ err }, 'turnstile verification network error');
    return false;
  }
}
