-- Track sync failures for retry
CREATE TABLE rc_sync_failures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_record_id TEXT NOT NULL,
  extension_id TEXT NOT NULL,
  error_message TEXT,
  failed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  retried_at TIMESTAMPTZ,
  resolved BOOLEAN NOT NULL DEFAULT false
);

-- Index for finding unresolved failures
CREATE INDEX idx_rc_sync_failures_unresolved
  ON rc_sync_failures (resolved, extension_id)
  WHERE resolved = false;

-- Unique constraint to avoid duplicate failure entries
CREATE UNIQUE INDEX idx_rc_sync_failures_unique
  ON rc_sync_failures (source_record_id)
  WHERE resolved = false;

COMMENT ON TABLE rc_sync_failures IS 'Tracks failed RC recording syncs for retry';
