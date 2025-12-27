# Agent Instructions

## Dev Workflow

- Use `&apos;` instead of `'` in JSX markup only (NOT in JS strings - they render literally)
- **ALWAYS** run `npm run build` at task completion (main agent only)
- Subagents: make changes and report back, NO builds
- Be super honest about everything.
- **NEVER read .env files** - environment variables are private
- Use parallel agents whenever it makes sense to speed up the process, save main agent context window
- `/api/sync` and `/api/verify` require `Authorization: Bearer $CRON_SECRET` header

## UI Components (shadcn/ui)

- **ALWAYS use shadcn/ui components** for UI elements - they're in `components/ui/`
- Available: Button, Input, Card, Table, Badge, Dialog, Label, Skeleton, Tabs, etc.
- Import from `@/components/ui/button`, `@/components/ui/input`, etc.
- Use shadcn patterns over custom Tailwind when a component exists

## Communication (User = Junior Dev)

- Always include **file path + line number**
- Explain simple → technical. But do not overexplain
- When user asks "how to" → give instructions, don't do it for them
- DO NOT EVER READ .env file

## Nia MCP (PRIORITY)

**ALWAYS prefer Nia MCP tools over standard tools when applicable** - saves tokens, time, and improves code quality:

## Supabase

- Use Supabase MCP to search for docs related to supabase
- Use supabase cli when possible, it's faster than using the ui
- Use supabase cli whenever possible

### Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
SUPABASE_SERVICE_ROLE_KEY
CRON_SECRET
```

## Playwright MCP

- Use this to verify ui, and read files that would otherwise be hard to read (pdf, images)

## FPF Glossary (Quick Reference)

### Knowledge Layers (Epistemic Status)

| Layer       | Name          | Meaning                        | How to reach        |
| ----------- | ------------- | ------------------------------ | ------------------- |
| **L0**      | Conjecture    | Unverified hypothesis          | `quint_propose`     |
| **L1**      | Substantiated | Logically verified             | `quint_verify` PASS |
| **L2**      | Corroborated  | Empirically validated          | `quint_test` PASS   |
| **invalid** | Falsified     | Failed verification/validation | FAIL verdict        |

### Core Concepts

**Holon** — A knowledge unit (hypothesis, decision, evidence) stored in `.quint/`. Holons have identity, layer, kind, and assurance scores.

**Kind** — Classification of holon:

- `system` — Code, architecture, technical implementation
- `episteme` — Process, documentation, methodology

**Scope (G)** — Where a claim applies. "Redis caching" might have scope "read-heavy endpoints, >1000 RPS".

**R_eff (Effective Reliability)** — Computed trust score (0-1). NOT estimated — must be calculated via `quint_calculate_r`.

**WLNK (Weakest Link)** — R_eff = min(evidence_scores), never average. A chain is only as strong as its weakest link.

### Structural Relations (B.1.1)

Relations are declared during hypothesis creation (Phase 1), not as standalone operations.

**ComponentOf** — System A is physical/functional part of System B.

- Created via: `quint_propose(..., depends_on=["A"], kind="system")`
- WLNK effect: `B.R_eff ≤ A.R_eff`
- Use for: modules, services, subsystems

**ConstituentOf** — Epistemic claim A supports claim B.

- Created via: `quint_propose(..., depends_on=["A"], kind="episteme")`
- WLNK effect: `B.R_eff ≤ A.R_eff`
- Use for: arguments, proofs, documentation

**MemberOf** — A belongs to collection B (non-mereological).

- Created via: `quint_propose(..., decision_context="B")`
- No R_eff propagation
- Use for: grouping alternatives in a decision space

**CL (Congruence Level)** — How well evidence transfers across contexts:

- CL3: Same context (internal test) — no penalty
- CL2: Similar context (related project) — minor penalty
- CL1: Different context (external docs) — significant penalty

**DRR (Design Rationale Record)** — Persisted decision with context, rationale, consequences. Created via `quint_decide`.

**Epistemic Debt** — Accumulated staleness when evidence expires. Managed via `/q-decay`.

**Transformer Mandate** — Systems cannot transform themselves. Humans decide; agents document. Autonomous architectural decisions = protocol violation.

### State Machine Phases

```
IDLE → ABDUCTION → DEDUCTION → INDUCTION → DECISION → IDLE
       (q1)         (q2)         (q3)        (q4→q5)
```

Each phase has preconditions. Skipping phases = blocked tools.
