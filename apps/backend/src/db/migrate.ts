import fs from 'fs';
import path from 'path';
import { pool } from './client';
import { redactDatabaseUrl, config } from '../config';

async function ensureMigrationsTable(): Promise<void> {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       name text PRIMARY KEY,
       run_at timestamptz NOT NULL DEFAULT now()
     )`
  );
}

async function listApplied(): Promise<Set<string>> {
  const r = await pool.query<{ name: string }>(
    'SELECT name FROM schema_migrations'
  );
  return new Set(r.rows.map((row) => row.name));
}

export async function runMigrations(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log(`[migrate] using db: ${redactDatabaseUrl(config.DATABASE_URL)}`);
  await ensureMigrationsTable();
  const applied = await listApplied();

  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (applied.has(file)) {
      // eslint-disable-next-line no-console
      console.log(`[migrate] skip (already applied): ${file}`);
      continue;
    }
    const full = path.join(migrationsDir, file);
    const sql = fs.readFileSync(full, 'utf8');
    // eslint-disable-next-line no-console
    console.log(`[migrate] applying: ${file}`);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query(
        'INSERT INTO schema_migrations(name) VALUES ($1) ON CONFLICT DO NOTHING',
        [file]
      );
      await client.query('COMMIT');
      // eslint-disable-next-line no-console
      console.log(`[migrate] ok: ${file}`);
    } catch (err) {
      await client.query('ROLLBACK');
      // eslint-disable-next-line no-console
      console.error(`[migrate] failed: ${file}`, err);
      throw err;
    } finally {
      client.release();
    }
  }
}

if (require.main === module) {
  runMigrations()
    .then(async () => {
      // eslint-disable-next-line no-console
      console.log('[migrate] complete');
      await pool.end();
      process.exit(0);
    })
    .catch(async (err) => {
      // eslint-disable-next-line no-console
      console.error('[migrate] error', err);
      await pool.end().catch(() => undefined);
      process.exit(1);
    });
}
