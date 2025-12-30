# DRR-D3: RingCentral Call Recording Schema

**Decision ID:** D3
**Date:** 2025-12-29
**Status:** ACCEPTED
**Winner:** H9 (Hybrid - Core Normalized + JSONB Insights)
**R_eff:** 0.85

---

## Context

Boss wants RingCentral call recording data migrated to Supabase for broker call analytics. Requirements include:
- Diarized transcripts with speaker attribution
- AI insights (Summary, NextSteps, AIScore, CallNotes)
- Full-text search across transcripts
- Metrics (talk ratio, sentiment, pace)
- Linkable to Velocity deals/borrowers

The RingSense API returns variable-length arrays (speakerInfo, insights) that don't fit cleanly into normalized tables.

## Decision

**We chose H9: Hybrid - Core Normalized + JSONB Insights**

Single `rc_recordings` table with:
- Normalized core fields for efficient B-tree queries (source_record_id, owner_extension_id, domain, timestamps)
- JSONB columns for variable-length data (speaker_info, insights)
- Dedicated `transcript_text` column for FTS (populated by sync script flattening the transcript)

## Rationale

1. **Simplicity:** 1 table vs H8's 7 tables — easier maintenance, fewer JOINs
2. **Flexibility:** JSONB accommodates RingSense API changes without migrations
3. **FTS solved:** Dedicated column with GIN index enables transcript search (~50ms)
4. **Performance validated:** GIN indexes provide 100x speedup for JSONB path queries
5. **Industry pattern:** AWS recommends hybrid for external API data (E13)

**Evidence chain:**
- E11: JSONB GIN performance research (CL3)
- E12: PostgreSQL FTS performance research (CL3)
- E13: Hybrid pattern validation - AWS (CL3)
- E14: Internal validation - migration applied, endpoint responds (CL3)

**Rejected alternatives:**
- H8 (Fully Normalized): Incomplete — no FTS spec, over-normalized for variable data
- H10 (JSONB-First): INVALID — no FTS solution for transcript search
- H11 (Transcript-Optimized): Over-engineered for uncertain scale

## Consequences

**Positive:**
- Single table simplifies sync script and queries
- JSONB flexibility reduces future migration burden
- FTS enables boss's transcript search requirement

**Negative:**
- JSONB queries slightly slower than normalized JOINs (acceptable trade-off)
- Sync script must flatten transcript for FTS column
- No referential integrity on JSONB contents

**Next steps:**
1. Implement POST handler for `/api/sync-rc`
2. Flatten transcript array to `transcript_text` in sync script
3. Test FTS with real RingCentral data
4. [FUTURE] Link recordings to VL deals via phone number matching

## Validity

**Revisit when:**
- Recording volume exceeds 100k rows (may need partitioning)
- FTS performance degrades (consider H11 dedicated transcript table)
- RingSense API adds new insight types (verify JSONB handles gracefully)

**Estimated validity:** 12-18 months
