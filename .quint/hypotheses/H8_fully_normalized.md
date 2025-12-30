# H8: Fully Normalized Schema

**Decision:** D3 - RingCentral Call Recording Migration
**Approach:** Conservative
**Status:** L0_CONJECTURE
**Created:** 2025-12-29

## Summary

Create separate PostgreSQL tables for every entity: recordings, speakers, utterances, summaries, highlights, next_steps, ai_scores, and call_notes. Full relational design with foreign keys.

## Method (Recipe)

```sql
-- Core recording table
CREATE TABLE rc_recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
  created_at TIMESTAMPTZ DEFAULT NOW(),
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

-- Speakers (from speakerInfo array)
CREATE TABLE rc_speakers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recording_id UUID REFERENCES rc_recordings(id) ON DELETE CASCADE,
  speaker_id TEXT,
  speaker_index INT,
  -- additional speaker metadata
  UNIQUE(recording_id, speaker_index)
);

-- Utterances (diarized transcript)
CREATE TABLE rc_utterances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recording_id UUID REFERENCES rc_recordings(id) ON DELETE CASCADE,
  speaker_id TEXT,
  utterance_index INT,
  text TEXT,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  UNIQUE(recording_id, utterance_index)
);

-- Summaries
CREATE TABLE rc_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recording_id UUID REFERENCES rc_recordings(id) ON DELETE CASCADE,
  summary_type TEXT, -- 'abstractive', 'short', 'long', 'extractive'
  content TEXT
);

-- Similar tables for: rc_highlights, rc_next_steps, rc_ai_scores, rc_call_notes
```

## Scope (G)

- Applies when: Full SQL query capability needed
- Requires: Multiple migrations, complex sync logic
- Best for: Analytics dashboards, complex joins, reporting

## Rationale

```json
{
  "anomaly": "Need to store nested RingCentral payload in queryable format",
  "approach": "Traditional normalized relational design matching existing VL schema pattern",
  "alternatives_rejected": ["None yet - this is the baseline"],
  "pros": [
    "Full SQL query capability",
    "Referential integrity with foreign keys",
    "Consistent with existing vl_* tables",
    "Easy aggregation queries (COUNT, SUM, etc.)"
  ],
  "cons": [
    "7+ new tables required",
    "Complex sync logic (must handle all child tables)",
    "Schema changes require migrations",
    "More storage for indexes"
  ]
}
```

## Evidence Required

- E6: Test sync performance with 1000 recordings
- E7: Query performance for transcript search
