-- Track MFA verification server-side on the session row instead of a forgeable cookie.
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS mfa_verified_at timestamptz;
