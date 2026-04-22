CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$ BEGIN
  CREATE TYPE user_status AS ENUM ('active', 'suspended', 'deactivated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE group_source AS ENUM ('idp_synced', 'local');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE app_protocol AS ENUM ('https', 'ssh', 'rdp');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE policy_status AS ENUM ('draft', 'active', 'disabled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE device_enrollment AS ENUM ('pending', 'enrolled', 'quarantined', 'revoked');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE access_outcome AS ENUM ('allowed', 'denied');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE alert_severity AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE alert_status AS ENUM ('open', 'acknowledged', 'resolved', 'false_positive');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  external_id text,
  email text UNIQUE NOT NULL,
  full_name text NOT NULL,
  department text,
  role text NOT NULL DEFAULT 'user',
  manager_id uuid REFERENCES users(id),
  status user_status NOT NULL DEFAULT 'active',
  password_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz
);

CREATE TABLE IF NOT EXISTS groups (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text UNIQUE NOT NULL,
  description text,
  source group_source NOT NULL DEFAULT 'local',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_groups (
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  group_id uuid REFERENCES groups(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, group_id)
);

CREATE TABLE IF NOT EXISTS applications (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  description text,
  icon_url text,
  app_url text NOT NULL,
  protocol app_protocol NOT NULL DEFAULT 'https',
  required_mfa boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS policies (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  description text,
  status policy_status NOT NULL DEFAULT 'draft',
  priority int NOT NULL DEFAULT 100,
  rules jsonb NOT NULL DEFAULT '{}',
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS devices (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  os text,
  enrollment_status device_enrollment NOT NULL DEFAULT 'pending',
  last_posture_check timestamptz,
  posture_score int DEFAULT 0,
  managed boolean NOT NULL DEFAULT false,
  disk_encrypted boolean NOT NULL DEFAULT false,
  registered_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS access_events (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  timestamp timestamptz NOT NULL DEFAULT now(),
  user_id uuid REFERENCES users(id),
  application_id uuid REFERENCES applications(id),
  device_id uuid REFERENCES devices(id),
  policy_id uuid REFERENCES policies(id),
  outcome access_outcome NOT NULL,
  deny_reason text,
  ip_address inet,
  geo_country text,
  session_id uuid,
  raw_event jsonb NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  device_id uuid REFERENCES devices(id),
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  ip_address inet,
  user_agent text
);

CREATE TABLE IF NOT EXISTS alerts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  severity alert_severity NOT NULL,
  type text NOT NULL,
  user_id uuid REFERENCES users(id),
  device_id uuid REFERENCES devices(id),
  status alert_status NOT NULL DEFAULT 'open',
  assigned_to uuid REFERENCES users(id),
  triggered_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  context jsonb NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS access_events_timestamp_idx ON access_events (timestamp DESC);
CREATE INDEX IF NOT EXISTS access_events_user_idx ON access_events (user_id);
CREATE INDEX IF NOT EXISTS access_events_app_idx ON access_events (application_id);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions (user_id, revoked_at);
CREATE INDEX IF NOT EXISTS alerts_status_sev_idx ON alerts (status, severity);
