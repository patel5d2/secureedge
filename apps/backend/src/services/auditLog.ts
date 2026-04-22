import { pool } from '../db/client';
import { AccessEvent, AccessOutcome } from '../types';

export interface LogEventInput {
  userId?: string | null;
  applicationId?: string | null;
  deviceId?: string | null;
  policyId?: string | null;
  outcome: AccessOutcome;
  denyReason?: string | null;
  ipAddress?: string | null;
  country?: string | null;
  sessionId?: string | null;
  raw?: Record<string, unknown>;
}

export interface EnrichedAccessEvent extends AccessEvent {
  user_name?: string | null;
  user_email?: string | null;
  app_name?: string | null;
}

type Subscriber = (event: EnrichedAccessEvent) => void;
const subscribers: Set<Subscriber> = new Set();

export function subscribe(fn: Subscriber): void {
  subscribers.add(fn);
}
export function unsubscribe(fn: Subscriber): void {
  subscribers.delete(fn);
}

function broadcast(ev: EnrichedAccessEvent): void {
  for (const s of subscribers) {
    try {
      s(ev);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[auditLog] subscriber error', e);
    }
  }
}

export async function logEvent(input: LogEventInput): Promise<EnrichedAccessEvent> {
  const r = await pool.query<AccessEvent>(
    `INSERT INTO access_events
       (user_id, application_id, device_id, policy_id, outcome, deny_reason, ip_address, geo_country, session_id, raw_event)
     VALUES ($1, $2, $3, $4, $5::access_outcome, $6, $7::inet, $8, $9, $10::jsonb)
     RETURNING *`,
    [
      input.userId || null,
      input.applicationId || null,
      input.deviceId || null,
      input.policyId || null,
      input.outcome,
      input.denyReason || null,
      input.ipAddress || null,
      input.country || null,
      input.sessionId || null,
      JSON.stringify(input.raw || {}),
    ]
  );
  const ev = r.rows[0];
  // Enrich
  let user_name: string | null = null;
  let user_email: string | null = null;
  let app_name: string | null = null;
  if (ev.user_id) {
    const u = await pool.query<{ full_name: string; email: string }>(
      'SELECT full_name, email FROM users WHERE id = $1',
      [ev.user_id]
    );
    if (u.rows[0]) {
      user_name = u.rows[0].full_name;
      user_email = u.rows[0].email;
    }
  }
  if (ev.application_id) {
    const a = await pool.query<{ name: string }>(
      'SELECT name FROM applications WHERE id = $1',
      [ev.application_id]
    );
    if (a.rows[0]) app_name = a.rows[0].name;
  }
  const enriched: EnrichedAccessEvent = { ...ev, user_name, user_email, app_name };
  broadcast(enriched);
  return enriched;
}

export async function recentEvents(limit = 20): Promise<EnrichedAccessEvent[]> {
  const safeLimit = Math.min(Math.max(1, limit), 500);
  const r = await pool.query<EnrichedAccessEvent>(
    `SELECT e.*, u.full_name AS user_name, u.email AS user_email, a.name AS app_name
       FROM access_events e
       LEFT JOIN users u ON u.id = e.user_id
       LEFT JOIN applications a ON a.id = e.application_id
       ORDER BY e.timestamp DESC
       LIMIT $1`,
    [safeLimit]
  );
  return r.rows;
}
