# Feature Doc Template

Use this exact structure when writing a new feature planning doc.
Replace all `[placeholders]` with actual content.

---

```markdown
# Feature: [Feature Name]
**Product**: Tercero — Social Media Agency Management SaaS  
**File**: `.claude/features/[NN]-[feature-slug].md`  
**Status**: Planned  
**Last Updated**: [Month Year]

---

## Context

[2–3 sentences explaining why this feature exists and what problem it solves.
Reference the existing pattern it follows if applicable — e.g. "follows the same
pattern as Meetings and Notes".]

---

## Phase Overview

\`\`\`
Phase 1 — [Short name]
  [One sentence description]

Phase 2 — [Short name]
  [One sentence description]

[Add more phases if needed. Typically 2–4.]
\`\`\`

**After each phase: stop and wait for approval before proceeding.**

---

## Phase 1 — [Name]

### Goal
[One paragraph. What does a user get at the end of this phase? What can they do
that they couldn't do before?]

### Before Starting — Confirm With Codebase
[List 3–5 specific things Claude Code should verify by reading actual files before
writing any code. E.g. existing tab names, import paths, query key patterns.]

### 1.1 Database

[List every new table, column change, index, RLS policy, and storage bucket
needed for this phase. Include full SQL. If no DB changes, say "No database
changes in this phase."]

### 1.2 API Layer

[Describe the new file or additions to an existing API file.
List all hooks and functions with their signatures and purpose.
Describe upload/delete flows step by step if relevant.]

### 1.3 Components

[List every new component file with its path and purpose.
Describe props, behaviour, and key UI elements for each.
Include the file tree structure.]

### 1.4 [Feature] Integration

[Describe changes to existing pages or components — e.g. adding a tab,
adding a nav item, adding a route. Be specific about file names.]

### 1.5 Impact on Existing Features

[Table of any existing features affected, what changes, and what to watch for.]

### 1.6 What This Phase Does NOT Include

[Explicit list of things that are out of scope for this phase.]

### 1.7 Phase 1 Checklist — Before Marking Complete

[Every item that must be true for this phase to be considered done.
Written as verifiable statements, not tasks.]

- [ ] [Specific, verifiable item]
- [ ] [Specific, verifiable item]
- [ ] [...]

**→ Stop here. Show the result and wait for approval.**

---

## Phase 2 — [Name]

### Goal
[...]

### Before Starting — Confirm Phase 1 is Approved

[Repeat the same structure as Phase 1 for each subsequent phase.]

---

## Data Model Summary (Final State After All Phases)

\`\`\`
[ASCII tree showing how new data relates to existing Agency/Client structure]
\`\`\`

### `[new_table]` — Schema
| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `user_id` | UUID | RLS, FK → auth.users |
| [...] | [...] | [...] |

### Storage Bucket (if applicable)
| Bucket | Access | Path |
|---|---|---|
| `[bucket-name]` | Private / Public | `[path pattern]` |

---

## Impact on Existing Features

| Existing Feature | Impact | Action Required |
|---|---|---|
| [...] | [...] | [...] |

---

## Out of Scope (All Phases)

[Explicit list of things that will NOT be built in this feature.
Be specific — future phases, related ideas, things that came up during
planning but were cut.]

- [Item] — [brief reason or "future build"]
- [...]
```