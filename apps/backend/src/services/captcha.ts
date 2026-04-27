import { config } from '../config';
import { logger } from '../lib/logger';

const TURNSTILE_VERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

interface TurnstileResponse {
  success: boolean;
  'error-codes'?: string[];
}

/**
 * Verify a Cloudflare Turnstile token. Returns true on success.
 *
 * Bypassed when:
 *   - NODE_ENV !== 'production' AND no TURNSTILE_SECRET is configured
 *     (so local dev and unit tests don't need a live key)
 *   - Token is the literal 'dev-bypass' in non-production
 */
export async function verifyCaptcha(token: string | undefined, ip: string | null): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET || '';
  const bypassable = config.NODE_ENV !== 'production';

  if (!secret) {
    if (bypassable) return true;
    logger.error('TURNSTILE_SECRET not set in production — captcha verification cannot run');
    return false;
  }

  if (!token) return false;
  if (bypassable && token === 'dev-bypass') return true;

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
