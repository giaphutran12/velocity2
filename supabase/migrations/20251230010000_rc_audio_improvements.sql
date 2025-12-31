-- RC Audio Improvements: Better file naming and error tracking
-- Links brokers to RC extensions for organized audio storage

-- Link brokers to RC extensions
ALTER TABLE vl_brokers ADD COLUMN IF NOT EXISTS rc_extension_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_vl_brokers_rc_extension
  ON vl_brokers(rc_extension_id) WHERE rc_extension_id IS NOT NULL;

-- Backfill Garry (known extension)
UPDATE vl_brokers SET rc_extension_id = '660583043' WHERE name = 'Garry Singh';

-- Track download errors for visibility
ALTER TABLE rc_recordings ADD COLUMN IF NOT EXISTS download_error TEXT;

COMMENT ON COLUMN vl_brokers.rc_extension_id IS 'RingCentral extension ID for linking call recordings';
COMMENT ON COLUMN rc_recordings.download_error IS 'Last download error message, cleared on success';
