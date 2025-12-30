---
id: e11-jsonb-gin-performance
type: external-research
source: web
created: 2025-12-29T15:00:00Z
hypothesis: .quint/hypotheses/H9_hybrid_jsonb.md
assumption_tested: "GIN indexes on JSONB are effective for path queries"
valid_until: 2026-06-29
decay_action: refresh
congruence:
  level: high
  penalty: 0.00
  source_context: "PostgreSQL official docs + real-world production examples (10k-1M rows)"
  our_context: "PostgreSQL via Supabase, expected <10k recordings initially"
  justification: "Direct PostgreSQL features, same technology, our scale is smaller than benchmarked cases"
sources:
  - url: https://www.postgresql.org/docs/current/gin.html
    title: PostgreSQL Official GIN Documentation
    type: official-docs
    accessed: 2025-12-29
    credibility: high
  - url: https://medium.com/@sachin.backend.dev/how-gin-indexes-made-our-jsonb-queries-100x-faster-in-postgres-8022eedaf4ce
    title: How GIN Indexes Made Our JSONB Queries 100x Faster
    type: tech-blog
    accessed: 2025-12-29
    credibility: medium
  - url: https://pganalyze.com/blog/gin-index
    title: Understanding Postgres GIN Indexes
    type: tech-blog
    accessed: 2025-12-29
    credibility: high
scope:
  applies_to: "JSONB containment queries, key existence checks"
  not_valid_for: "Equality lookups on single keys (use B-tree instead)"
---

# Research: PostgreSQL JSONB GIN Index Performance

## Purpose
Validate that GIN indexes on JSONB columns provide effective query performance for H9's insights column.

## Hypothesis Reference
- **File:** `.quint/hypotheses/H9_hybrid_jsonb.md`
- **Assumption tested:** GIN indexes on JSONB are effective for path queries

## Congruence Assessment

**Source context:** PostgreSQL production deployments (10k-1M+ rows)
**Our context:** Supabase PostgreSQL, <10k recordings initially

| Dimension | Match | Notes |
|-----------|-------|-------|
| Technology | ✓ | Same PostgreSQL, same GIN implementation |
| Scale | ✓ | Our scale smaller, should perform better |
| Use Case | ✓ | JSONB containment queries for insights |
| Environment | ✓ | Supabase uses standard PostgreSQL |

**Congruence Level:** High
**Penalty:** 0.00
**R_eff:** 1.0

## Findings

### Source 1: PostgreSQL Official Docs

**URL:** https://www.postgresql.org/docs/current/gin.html
**Type:** official-docs
**Credibility:** High

**Key points:**
- GIN indexes support containment operators (@>, @?, @@)
- Two operator classes: `jsonb_ops` (default) and `jsonb_path_ops`
- `jsonb_path_ops` creates smaller indexes (20-30% of table size vs 60-80% for jsonb_ops)
- GIN only supports Bitmap Index Scans (no Index Only Scan)

### Source 2: Real-World Performance (Medium)

**URL:** https://medium.com/@sachin.backend.dev/how-gin-indexes-made-our-jsonb-queries-100x-faster
**Type:** tech-blog
**Credibility:** Medium

**Key points:**
- Query that took 4 minutes returned in <2 seconds with GIN index
- B-tree indexes don't help JSONB nested field queries
- GIN is essential for wildcard/nested JSON queries

### Source 3: pganalyze Analysis

**URL:** https://pganalyze.com/blog/gin-index
**Type:** tech-blog (reputable company)
**Credibility:** High

**Key points:**
- GIN indexes excel at indexing all attributes with single index
- Write overhead higher than B-tree (relevant for frequent updates)
- False positives require recheck (minor overhead)

## Synthesis

GIN indexes on JSONB are highly effective for our use case:
1. We query insights by containment (`@>`) and path queries
2. Our schema evolves (GIN indexes all keys automatically)
3. Write overhead acceptable (sync script runs periodically, not constantly)

**Recommendation:** Use `jsonb_ops` (default) since we may need `?` operator to check key existence.

## Verdict

- [x] Assumption **SUPPORTED** by external evidence (with congruence: high)

## Recommendations

GIN index on `insights` column is appropriate. Consider `jsonb_path_ops` if we only use containment queries and want smaller index size.
