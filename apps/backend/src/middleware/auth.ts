import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { pool } from '../db/client';
import { isSessionCached, cacheSession, invalidateSession } from '../db/redis';
import { AuthUser } from '../types';

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  sid?: string;
  mfa?: boolean;
}

function extractToken(req: Request): string | null {
  const cookieToken = (req.cookies && req.cookies['se_token']) as
    | string
    | undefined;
  if (cookieToken) return cookieToken;
  const hdr = req.headers.authorization;
  if (hdr && hdr.startsWith('Bearer ')) return hdr.slice(7);
  return null;
}

async function loadUser(userId: string): Promise<AuthUser | null> {
  const r = await pool.query<AuthUser>(
    `SELECT id, email, role, full_name FROM users WHERE id = $1 AND status = 'active'`,
    [userId]
  );
  return r.rows[0] || null;
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  try {
    const payload = jwt.verify(token, config.JWT_SECRET) as JwtPayload;
    const user = await loadUser(payload.sub);
    if (!user) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }

    // Session revocation check — Redis cache first, then DB fallback
    if (payload.sid) {
      const cached = await isSessionCached(payload.sid);
      if (cached === null) {
        // Cache miss — check DB
        const session = await pool.query(
          `SELECT id FROM sessions
           WHERE id = $1 AND revoked_at IS NULL AND expires_at > now()`,
          [payload.sid]
        );
        if (session.rows.length === 0) {
          res.status(401).json({ error: 'session_expired_or_revoked' });
          return;
        }
        // Re-cache valid session
        await cacheSession(payload.sid, payload.sub, config.SESSION_TTL_SECONDS);
      }
      // cached === true → session is valid in Redis, skip DB
    }

    req.user = user;
    if (payload.sid) req.sessionId = payload.sid;
    req.mfaVerified = payload.mfa === true;
    next();
  } catch {
    res.status(401).json({ error: 'unauthorized' });
  }
}

export async function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const token = extractToken(req);
  if (!token) return next();
  try {
    const payload = jwt.verify(token, config.JWT_SECRET) as JwtPayload;
    const user = await loadUser(payload.sub);
    if (user) {
      req.user = user;
      if (payload.sid) req.sessionId = payload.sid;
    }
  } catch {
    /* swallow */
  }
  next();
}

export function signToken(
  user: { id: string; email: string; role: string },
  sessionId?: string,
  mfa: boolean = false
): string {
  const payload: JwtPayload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    mfa,
  };
  if (sessionId) payload.sid = sessionId;
  return jwt.sign(payload, config.JWT_SECRET, {
    expiresIn: config.SESSION_TTL_SECONDS,
  });
}
