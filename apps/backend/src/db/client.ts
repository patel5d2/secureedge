import { Pool } from 'pg';
import { config } from '../config';
import { logger } from '../lib/logger';

export const pool = new Pool({
  connectionString: config.DATABASE_URL,
  max: config.NODE_ENV === 'production' ? 25 : 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  // Abort queries that take > 30s (prevents connection leaks)
  statement_timeout: 30_000,
  idle_in_transaction_session_timeout: 60_000,
} as ConstructorParameters<typeof Pool>[0]);

pool.on('error', (err) => {
  logger.error({ err }, 'unexpected database pool error');
});

export async function pingDb(): Promise<boolean> {
  try {
    const r = await pool.query('SELECT 1 as ok');
    return r.rows[0]?.ok === 1;
  } catch {
    return false;
  }
}
