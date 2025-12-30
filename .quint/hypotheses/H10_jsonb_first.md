# H10: JSONB-First with Generated Columns

**Decision:** D3 - RingCentral Call Recording Migration
**Approach:** Radical
**Status:** L0_CONJECTURE
**Created:** 2025-12-29

## Summary

Store the entire RingCentral payload as a single JSONB column. Use PostgreSQL generated columns to extract commonly-queried fields for indexing. Maximum flexibility, minimum sync complexity.

## Method (Recipe)

```sql
-- Single table with raw payload
CREATE TABLE rc_recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- The entire payload as-is
  raw_payload JSONB NOT NULL,

  -- Generated columns for queryable fields
  source_record_id TEXT GENERATED ALWAYS AS (raw_payload->>'sourceRecordId') STORED,
  source_session_id TEXT GENERATED ALWAYS AS (raw_payload->>'sourceSessionId') STORED,
  title TEXT GENERATED ALWAYS AS (raw_payload->>'title') STORED,
  domain TEXT GENERATED ALWAYS AS (raw_payload->>'domain') STORED,
  call_direction TEXT GENERATED ALWAYS AS (raw_payload->>'callDirection') STORED,
  owner_extension_id TEXT GENERATED ALWAYS AS (raw_payload->>'ownerExtensionId') STORED,
  recording_duration_ms INT GENERATED ALWAYS AS ((raw_payload->>'recordingDurationMs')::int) STORED,
  recording_start_time TIMESTAMPTZ GENERATED ALWAYS AS ((raw_payload->>'recordingStartTime')::timestamptz) STORED,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint on generated column
CREATE UNIQUE INDEX idx_rc_recordings_source_unique ON rc_recordings(source_record_id);

-- Query indexes on generated columns
CREATE INDEX idx_rc_recordings_owner ON rc_recordings(owner_extension_id);
CREATE INDEX idx_rc_recordings_domain ON rc_recordings(domain);
CREATE INDEX idx_rc_recordings_start ON rc_recordings(recording_start_time);

-- GIN index for deep JSONB queries
CREATE INDEX idx_rc_recordings_payload ON rc_recordings USING GIN (raw_payload jsonb_path_ops);
```

## Scope (G)

- Applies when: Schema is unstable or unknown
- Requires: PostgreSQL 12+ for generated columns
- Best for: Rapid prototyping, schema-less storage, full payload preservation

## Rationale

```json
{
  "anomaly": "Need to store nested RingCentral payload in queryable format",
  "approach": "Store raw, extract what you need via generated columns",
  "alternatives_rejected": [
    "Full normalization (schema not fully known)",
    "Hybrid (still requires manual field mapping)"
  ],
  "pros": [
    "Simplest sync logic - just INSERT the payload",
    "No data loss - entire payload preserved",
    "Schema changes require no migrations",
    "Generated columns provide SQL query capability",
    "Can add new generated columns anytime"
  ],
  "cons": [
    "Larger storage footprint",
    "Complex JSONB queries for nested data",
    "No referential integrity",
    "Full-text search on transcript requires workaround"
  ]
}
```

## Sync Code (Ultra Simple)

```typescript
async function syncRecording(payload: RingCentralPayload) {
  await supabase
    .from('rc_recordings')
    .upsert({
      raw_payload: payload,
      synced_at: new Date().toISOString()
    }, {
      onConflict: 'source_record_id'
    });
}
```

## Evidence Required

- E6: Storage size comparison vs normalized
- E7: Query performance on generated columns
- E8: JSONB path query performance for insights
