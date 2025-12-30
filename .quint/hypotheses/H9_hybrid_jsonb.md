# H9: Hybrid - Core Normalized + JSONB Insights

**Decision:** D3 - RingCentral Call Recording Migration
**Approach:** Moderate
**Status:** L1_SUBSTANTIATED
**Created:** 2025-12-29
**Deduction Passed:** 2025-12-29

## Deduction Notes
- ✓ Single table = simple sync (matches boss's "save all info")
- ✓ Core fields normalized for efficient queries (owner, date, domain)
- ✓ JSONB absorbs schema uncertainty (RC API can evolve)
- ✓ FTS via regular TEXT column meets transcript search requirement
- ⚠ transcript_text populated by sync script (PG generated columns can't have subqueries)

## Summary

Normalize core recording fields for efficient querying, but store variable-length insights (Transcript, Summary, etc.) as JSONB columns. Best of both worlds.

## Method (Recipe)

```sql
-- Core recording table with JSONB insights
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

  -- JSONB for insights (all 7 types)
  insights JSONB DEFAULT '{}',

  -- Full-text search on transcript (populated by sync script)
  transcript_text TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_rc_recordings_source ON rc_recordings(source_record_id);
CREATE INDEX idx_rc_recordings_owner ON rc_recordings(owner_extension_id);
CREATE INDEX idx_rc_recordings_domain ON rc_recordings(domain);
CREATE INDEX idx_rc_recordings_start ON rc_recordings(recording_start_time);

-- GIN index for JSONB queries
CREATE INDEX idx_rc_recordings_insights ON rc_recordings USING GIN (insights);
CREATE INDEX idx_rc_recordings_speakers ON rc_recordings USING GIN (speaker_info);

-- Full-text search index
CREATE INDEX idx_rc_recordings_transcript_fts ON rc_recordings
  USING GIN (to_tsvector('english', transcript_text));
```

## Scope (G)

- Applies when: Need queryable core fields + flexible insights storage
- Requires: PostgreSQL with GIN index support (standard)
- Best for: Mixed query patterns, frequent schema changes in insights

## Rationale

```json
{
  "anomaly": "Need to store nested RingCentral payload in queryable format",
  "approach": "Hybrid: normalize what you query, JSONB what varies",
  "alternatives_rejected": [
    "Full normalization (too many tables for uncertain schema)",
    "Full JSONB (can't efficiently query core fields)"
  ],
  "pros": [
    "Single table - simple sync logic",
    "Core fields fully queryable with standard SQL",
    "Insights schema can evolve without migrations",
    "Full-text search on transcript via dedicated column",
    "GIN indexes for JSONB path queries"
  ],
  "cons": [
    "Complex JSONB queries for insight details",
    "Sync script must extract transcript_text (no auto-generation)",
    "JSONB storage slightly larger than normalized"
  ]
}
```

## Query Examples

```sql
-- Find recordings by broker
SELECT * FROM rc_recordings WHERE owner_extension_id = '12345';

-- Search transcripts
SELECT * FROM rc_recordings
WHERE to_tsvector('english', transcript_text) @@ to_tsquery('mortgage & application');

-- Get specific insight
SELECT insights->'Summary' FROM rc_recordings WHERE source_record_id = 'abc123';

-- Find recordings with AI score > 80
SELECT * FROM rc_recordings
WHERE (insights->'AIScore'->0->>'value')::int > 80;
```

## Evidence Required

- E6: Test sync performance with 1000 recordings
- E7: Full-text search performance on transcripts
- E8: JSONB query performance for insight filtering

## External Research (Q3)

| Evidence | Finding | Congruence | Source |
|----------|---------|------------|--------|
| E11 | GIN indexes provide 100x speedup for JSONB queries | High | PostgreSQL docs, pganalyze |
| E12 | FTS with GIN index achieves ~50ms query time | High | PostgreSQL docs |
| E13 | Hybrid pattern is AWS-recommended for external API data | High | AWS, Medium |

All assumptions validated by external research. Ready for empirical testing.
