-- 006: Self-serve sign-up + email verification
-- Additive only — no drops or renames.

-- ── Users: verification + provenance ───────────────────────────────────
-- Backfill existing rows to verified=true (they were admin-seeded), then
-- flip the default to false so future inserts must verify.
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT true;
ALTER TABLE users ALTER COLUMN email_verified SET DEFAULT false;

ALTER TABLE users ADD COLUMN IF NOT EXISTS created_via text NOT NULL DEFAULT 'admin';
DO $$ BEGIN
  ALTER TABLE users ADD CONSTRAINT users_created_via_chk
    CHECK (created_via IN ('admin','sso','self','invite'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── One-time tokens: verify-email, invite, password-reset ──────────────
-- Tokens are 32 random bytes; only the SHA-256 hash is stored.
CREATE TABLE IF NOT EXISTS email_verification_tokens (
  token_hash bytea PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose text NOT NULL CHECK (purpose IN ('verify_email','invite','reset_password')),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS evt_user_purpose_idx
  ON email_verification_tokens (user_id, purpose);
CREATE INDEX IF NOT EXISTS evt_expires_idx
  ON email_verification_tokens (expires_at)
  WHERE consumed_at IS NULL;

-- ── Tenant-level allowlist for self-serve sign-up ──────────────────────
-- If empty, self-serve signup is effectively disabled; admin invites and
-- SSO JIT remain unaffected.
CREATE TABLE IF NOT EXISTS signup_allowed_domains (
  domain text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Dev convenience: matches the seeded user emails. Remove or replace in prod.
INSERT INTO signup_allowed_domains (domain) VALUES ('secureedge.dev')
  ON CONFLICT (domain) DO NOTHING;
