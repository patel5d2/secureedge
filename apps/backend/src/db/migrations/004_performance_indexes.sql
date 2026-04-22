-- Additional indexes for production performance
-- Composite index for audit log filtering by user + time
CREATE INDEX IF NOT EXISTS access_events_user_ts_idx ON access_events (user_id, timestamp DESC);

-- Composite index for dashboard "denied in last 24h" queries
CREATE INDEX IF NOT EXISTS access_events_outcome_ts_idx ON access_events (outcome, timestamp DESC);

-- Index for policy lookup by status (covers the hot path in policy engine)
CREATE INDEX IF NOT EXISTS policies_status_priority_idx ON policies (status, priority ASC, created_at ASC);

-- Updated_at columns for applications and groups
ALTER TABLE applications ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE groups ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
