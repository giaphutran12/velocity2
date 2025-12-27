# Plan Then Transfer

Create a detailed implementation plan optimized for parallel agents, then output a copy-paste ready prompt for a fresh implementation session.

## Your Task

Given the user's feature request: `$ARGUMENTS`

### Phase 1: Explore & Plan

1. **Explore the codebase** to understand:
   - Existing patterns and conventions
   - Files that will be affected
   - Dependencies between components

2. **Create a plan file** at `~/.claude/plans/<descriptive-name>.md` with:
   - Overview of the feature
   - User flow
   - Files to create/modify
   - Implementation order

### Phase 2: Optimize for Parallel Execution

Structure the plan so multiple agents can work in parallel WITHOUT file conflicts:

**Parallelization Rules:**
- Group files by dependency (independent files can be parallel)
- Never assign the same file to multiple agents
- Identify which tasks MUST be sequential (shared dependencies)
- Mark clear handoff points between parallel and sequential work

**Example structure:**
```
## Parallel Group 1 (can run simultaneously)
- Agent A: Creates lib/utils.ts, lib/types.ts
- Agent B: Creates components/Button.tsx, components/Card.tsx

## Sequential (after Group 1 completes)
- Agent C: Creates app/page.tsx (imports from both groups above)
```

### Phase 3: Output Handoff Prompt

After writing the plan file, output a **copy-paste ready prompt** in a code block:

```
Implement the feature based on the plan at:
<full path to plan file>

Context:
- <brief project context>
- <key technologies>

Key requirements:
1. <requirement 1>
2. <requirement 2>
...

Follow the plan exactly. Start with step 1.
Run npm run build when done.
```

## Output Format

1. Write the plan file
2. Display the handoff prompt in a code block so user can copy it
3. Say "Plan ready. Copy the prompt above to start a fresh implementation session."
