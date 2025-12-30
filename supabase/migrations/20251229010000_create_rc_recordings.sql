-- RingCentral Call Recordings table (H9 Hybrid JSONB schema)
-- Normalized core fields for efficient queries, JSONB for variable-length insights

CREATE TABLE rc_recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Normalized core fields (queryable)
  source_record_id TEXT UNIQUE NOT NULL,
  source_session_id TEXT,
  title TEXT,
  rs_record_uri TEXT,
  domain TEXT CHECK (domain IN ('pbx', 'rcv', 'rcx', 'nice-incontact', 'ms-teams')),
  call_direction TEXT CHECK (call_direction IN ('Inbound', 'Outbound')),
  owner_extension_id TEXT,
  recording_duration_ms INT,
  recording_start_time TIMESTAMPTZ,
  creation_time TIMESTAMPTZ,
  last_modified_time TIMESTAMPTZ,

  -- JSONB for variable-length arrays
  speaker_info JSONB DEFAULT '[]',

  -- JSONB for insights (all 7 types: Transcript, Summary, etc.)
  insights JSONB DEFAULT '{}',

  -- Full-text search on transcript (populated by sync script)
  transcript_text TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_rc_recordings_source ON rc_recordings(source_record_id);
CREATE INDEX idx_rc_recordings_owner ON rc_recordings(owner_extension_id);
CREATE INDEX idx_rc_recordings_domain ON rc_recordings(domain);
CREATE INDEX idx_rc_recordings_start ON rc_recordings(recording_start_time);

-- GIN indexes for JSONB queries
CREATE INDEX idx_rc_recordings_insights ON rc_recordings USING GIN (insights);
CREATE INDEX idx_rc_recordings_speakers ON rc_recordings USING GIN (speaker_info);

-- Full-text search index on transcript
CREATE INDEX idx_rc_recordings_transcript_fts ON rc_recordings
  USING GIN (to_tsvector('english', COALESCE(transcript_text, '')));

-- Enable RLS
ALTER TABLE rc_recordings ENABLE ROW LEVEL SECURITY;

-- Policy: authenticated users can read all recordings
CREATE POLICY "authenticated_read_rc_recordings"
  ON rc_recordings FOR SELECT
  TO authenticated
  USING (true);

-- Policy: service role can do everything (for sync script)
CREATE POLICY "service_all_rc_recordings"
  ON rc_recordings FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
