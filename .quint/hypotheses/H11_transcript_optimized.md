# H11: Transcript-Optimized with Full-Text Search

**Decision:** D3 - RingCentral Call Recording Migration
**Approach:** Progressive
**Status:** L0_CONJECTURE
**Created:** 2025-12-29

## Summary

Optimized for the boss's primary use case: searching and analyzing call transcripts. Stores recording metadata normalized, but creates a dedicated utterances table with full-text search and speaker attribution.

## Method (Recipe)

```sql
-- Core recording table (lean)
CREATE TABLE rc_recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_record_id TEXT UNIQUE NOT NULL,
  source_session_id TEXT,
  title TEXT,
  rs_record_uri TEXT,
  domain TEXT,
  call_direction TEXT,
  owner_extension_id TEXT,
  recording_duration_ms INT,
  recording_start_time TIMESTAMPTZ,
  creation_time TIMESTAMPTZ,
  last_modified_time TIMESTAMPTZ,

  -- Store other insights as JSONB (less frequently queried)
  summary JSONB,
  highlights JSONB,
  next_steps JSONB,
  bulleted_summary JSONB,
  ai_score JSONB,
  call_notes JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

-- Speakers table for diarization
CREATE TABLE rc_speakers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recording_id UUID REFERENCES rc_recordings(id) ON DELETE CASCADE,
  speaker_id TEXT NOT NULL,
  speaker_index INT NOT NULL,
  name TEXT,
  role TEXT, -- 'agent', 'customer', etc.
  UNIQUE(recording_id, speaker_id)
);

-- Utterances table with full-text search (CRITICAL for boss)
CREATE TABLE rc_utterances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recording_id UUID REFERENCES rc_recordings(id) ON DELETE CASCADE,
  speaker_id TEXT NOT NULL,
  utterance_index INT NOT NULL,
  text TEXT NOT NULL,
  start_ms INT,
  end_ms INT,

  -- Full-text search vector
  text_search tsvector GENERATED ALWAYS AS (to_tsvector('english', text)) STORED,

  UNIQUE(recording_id, utterance_index)
);

-- Indexes
CREATE INDEX idx_rc_recordings_owner ON rc_recordings(owner_extension_id);
CREATE INDEX idx_rc_recordings_start ON rc_recordings(recording_start_time);

CREATE INDEX idx_rc_utterances_recording ON rc_utterances(recording_id);
CREATE INDEX idx_rc_utterances_speaker ON rc_utterances(speaker_id);
CREATE INDEX idx_rc_utterances_fts ON rc_utterances USING GIN (text_search);

-- Materialized view for call summaries
CREATE MATERIALIZED VIEW rc_call_analytics AS
SELECT
  r.id,
  r.source_record_id,
  r.owner_extension_id,
  r.recording_duration_ms,
  r.recording_start_time,
  COUNT(DISTINCT u.speaker_id) as speaker_count,
  COUNT(u.id) as utterance_count,
  SUM(LENGTH(u.text)) as total_text_length
FROM rc_recordings r
LEFT JOIN rc_utterances u ON u.recording_id = r.id
GROUP BY r.id;
```

## Scope (G)

- Applies when: Transcript search is the primary use case
- Requires: PostgreSQL full-text search, materialized views
- Best for: Call analytics, conversation search, speaker analysis

## Rationale

```json
{
  "anomaly": "Boss specifically wants diarized transcripts with speaker attribution",
  "approach": "Optimize for the stated requirement - transcript search",
  "alternatives_rejected": [
    "Full JSONB (can't efficiently search utterance text)",
    "No utterances table (loses speaker-level granularity)"
  ],
  "pros": [
    "Blazing fast transcript full-text search",
    "Speaker-level queries (who said what)",
    "Utterance timestamps for playback sync",
    "Analytics via materialized view",
    "Other insights still available as JSONB"
  ],
  "cons": [
    "More complex sync (must parse transcript array)",
    "3 tables instead of 1",
    "Materialized view needs refresh"
  ]
}
```

## Query Examples

```sql
-- Search all transcripts for keywords
SELECT r.*, u.text, u.speaker_id
FROM rc_recordings r
JOIN rc_utterances u ON u.recording_id = r.id
WHERE u.text_search @@ to_tsquery('english', 'mortgage & rate');

-- Find what a specific broker's customers said
SELECT u.text, u.speaker_id, r.title
FROM rc_utterances u
JOIN rc_recordings r ON r.id = u.recording_id
WHERE r.owner_extension_id = '12345'
  AND u.speaker_id != 'agent';

-- Call duration analytics by broker
SELECT * FROM rc_call_analytics
WHERE owner_extension_id = '12345'
ORDER BY recording_start_time DESC;
```

## Evidence Required

- E6: Full-text search performance with 100k utterances
- E7: Speaker-based query performance
- E8: Sync complexity assessment
