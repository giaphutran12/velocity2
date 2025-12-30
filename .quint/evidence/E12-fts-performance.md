---
id: e12-fts-performance
type: external-research
source: web
created: 2025-12-29T15:00:00Z
hypothesis: .quint/hypotheses/H9_hybrid_jsonb.md
assumption_tested: "Full-text search on TEXT column with GIN index is efficient"
valid_until: 2026-06-29
decay_action: refresh
congruence:
  level: high
  penalty: 0.00
  source_context: "PostgreSQL FTS with millions of documents"
  our_context: "Call transcripts, expected <10k recordings"
  justification: "Same PostgreSQL FTS, our scale much smaller"
sources:
  - url: https://risingwave.com/blog/implementing-high-performance-full-text-search-in-postgres/
    title: Implementing High-Performance Full Text Search in Postgres
    type: tech-blog
    accessed: 2025-12-29
    credibility: medium
  - url: https://www.postgresql.org/docs/current/textsearch-controls.html
    title: PostgreSQL FTS Controls
    type: official-docs
    accessed: 2025-12-29
    credibility: high
scope:
  applies_to: "Transcript search using tsquery/tsvector"
  not_valid_for: "Fuzzy matching, phrase proximity (need pg_trgm)"
---

# Research: PostgreSQL Full-Text Search Performance

## Purpose
Validate that FTS on transcript_text column provides acceptable search performance.

## Findings

### Key Points

1. **GIN index on tsvector is essential** - Without it, every query computes tsvector on the fly
2. **Pre-computed tsvector recommended for large datasets** - Our approach (separate TEXT column + GIN) is valid
3. **Query time ~50ms** for indexed searches in production systems
4. **Position limit: 16383** - Words beyond this position have capped positions (long transcripts OK)

### Performance Considerations

- Ranking can be I/O bound with many matches
- For transcripts <100KB, performance is excellent
- Network overhead (350ms) often exceeds query time (50ms)

## Synthesis

Our approach is validated:
1. Dedicated `transcript_text` column avoids on-the-fly extraction
2. GIN index (`to_tsvector('english', COALESCE(transcript_text, ''))`) enables fast search
3. At <10k recordings, performance will be excellent

## Verdict

- [x] Assumption **SUPPORTED** by external evidence (with congruence: high)

## Recommendations

Current implementation is correct. Consider adding `ts_rank()` for relevance sorting in future.
