-- Device posture enrichment columns
ALTER TABLE devices ADD COLUMN IF NOT EXISTS serial_number text;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS firewall_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS os_version text;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS agent_version text;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;

CREATE INDEX IF NOT EXISTS devices_user_idx ON devices (user_id);
CREATE INDEX IF NOT EXISTS devices_enrollment_idx ON devices (enrollment_status);
