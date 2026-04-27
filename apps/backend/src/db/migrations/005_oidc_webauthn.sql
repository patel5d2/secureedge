-- 005: OIDC SSO + WebAuthn Passkeys
-- Additive-only migration — no column drops or renames.

-- ── OIDC Identity Provider Configuration ──────────────────────────────

CREATE TABLE IF NOT EXISTS idp_configs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_name text NOT NULL,             -- e.g. 'okta', 'azure_ad', 'google'
  display_name text NOT NULL,              -- e.g. 'Sign in with Okta'
  issuer_url text NOT NULL,                -- OIDC issuer (discovery URL)
  client_id text NOT NULL,
  client_secret_enc text NOT NULL,         -- encrypted at rest
  redirect_uri text NOT NULL,
  scopes text NOT NULL DEFAULT 'openid email profile',
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Link users to their IdP identity
ALTER TABLE users ADD COLUMN IF NOT EXISTS idp_provider text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS idp_subject text;

-- Prevent duplicate SSO accounts
CREATE UNIQUE INDEX IF NOT EXISTS users_idp_identity_idx
  ON users (idp_provider, idp_subject)
  WHERE idp_provider IS NOT NULL AND idp_subject IS NOT NULL;

-- ── WebAuthn Credentials ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS webauthn_credentials (
  id text PRIMARY KEY,                     -- base64url credential ID
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  public_key bytea NOT NULL,               -- COSE public key
  counter bigint NOT NULL DEFAULT 0,
  device_type text,                        -- 'singleDevice' | 'multiDevice'
  backed_up boolean NOT NULL DEFAULT false,
  transports text[],                       -- e.g. {'usb','ble','nfc','internal'}
  friendly_name text,                      -- user-assigned label
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);

CREATE INDEX IF NOT EXISTS webauthn_creds_user_idx ON webauthn_credentials (user_id);
