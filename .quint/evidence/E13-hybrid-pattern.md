---
id: e13-hybrid-pattern
type: external-research
source: web
created: 2025-12-29T15:00:00Z
hypothesis: .quint/hypotheses/H9_hybrid_jsonb.md
assumption_tested: "Hybrid (normalized + JSONB) is a valid and recommended pattern"
valid_until: 2026-06-29
decay_action: refresh
congruence:
  level: high
  penalty: 0.00
  source_context: "E-commerce, CMS, SaaS with variable data schemas"
  our_context: "Call recordings with variable insights from RingCentral API"
  justification: "Same pattern - stable core fields + variable nested data from external API"
sources:
  - url: https://aws.amazon.com/blogs/database/postgresql-as-a-json-database-advanced-patterns-and-best-practices/
    title: PostgreSQL as a JSON Database (AWS)
    type: tech-blog
    accessed: 2025-12-29
    credibility: high
  - url: https://medium.com/@cjun1775/hybrid-table-design-combining-sql-columns-and-jsonb-for-optimal-performance-and-flexibility-1159fcf91978
    title: Hybrid Table Design
    type: tech-blog
    accessed: 2025-12-29
    credibility: medium
  - url: https://www.architecture-weekly.com/p/postgresql-jsonb-powerful-storage
    title: PostgreSQL JSONB - Powerful Storage
    type: tech-blog
    accessed: 2025-12-29
    credibility: medium
scope:
  applies_to: "External API data with stable metadata + variable nested structures"
  not_valid_for: "Highly relational data requiring complex joins across nested elements"
---

# Research: Hybrid Normalized + JSONB Pattern

## Purpose
Validate that the hybrid approach (normalized core + JSONB for variable data) is industry-recommended.

## Findings

### AWS Best Practices
- "The most efficient way to leverage JSONB in PostgreSQL is to combine columns and JSONB"
- "Use JSONB as a 'catch-all' to handle the variable parts of your schema"
- Example: Stripe webhook data stored as-is in JSONB

### Real-World Examples

1. **E-commerce products**: id, name, price (normalized) + attributes (JSONB)
2. **Customer data**: id, email, created_at (normalized) + source_data, preferences (JSONB)
3. **CMS articles**: id, title, content (normalized) + metadata (JSONB)
4. **External API data**: Store exactly as received (avoids normalization across 5+ tables)

### Our Use Case Match

| Their Pattern | Our H9 Implementation |
|---------------|----------------------|
| Stable metadata columns | source_record_id, owner_extension_id, domain, etc. |
| Variable nested data as JSONB | insights (Transcript, Summary, AIScore, etc.) |
| GIN index on JSONB | idx_rc_recordings_insights |

## Synthesis

H9 follows the exact pattern recommended by AWS and used in production by major companies. The pattern is particularly suited for:
- External API data (RingCentral)
- Variable schema elements (insights types may change)
- Avoiding complex migrations when API evolves

## Verdict

- [x] Assumption **SUPPORTED** by external evidence (with congruence: high)

## Recommendations

Current H9 design is validated by industry best practices. No changes needed.
