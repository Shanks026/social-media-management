---
name: tercero-feature
description: Use this skill whenever the user wants to plan, design, research, or build a new feature for Tercero — or continue building an existing one. Triggers on phrases like "I want to build", "new feature", "let's add", "I'm thinking of adding", "plan this feature", "implement this", "let's do phase 2 of", "continue the X feature", or any description of new product functionality. Also triggers when the user asks to extend or modify an existing feature. This skill researches the feature, analyses technical fit and scope, produces or updates a phased implementation markdown file, and guides Claude Code through the build phase by phase with approval gates. Always use this skill before writing any feature code — the planning doc must exist first.
---

# Tercero Feature Planning & Implementation Skill

You are helping build **Tercero** — a social media agency management SaaS built with React 19, Supabase, TanStack Query, shadcn/ui, and Tailwind CSS 4. Your job is to plan features carefully and then build them one phase at a time, stopping for approval between phases.

---

## Step 1 — Orient Yourself

Read these files before doing anything else:

- `.claude/CLAUDE.md` — architecture, tech stack, conventions
- `.claude/features/00-index.md` — what's planned and what's already been built

Then check whether the user is starting something new or continuing existing work:

**If this looks like a continuation** (e.g. "let's do Phase 2 of campaigns", "continue the documents feature"):
- Find the relevant feature file in `.claude/features/`
- Read it fully — note which phases are complete, what was deferred, what the next phase specifies
- Skip to Step 3 (or Step 4 if the doc is already fully written)

**If this is a new feature idea**:
- Scan `.claude/features/` to check if any existing file covers this — it may already be partially planned
- Proceed to Step 2

---

## Step 2 — Clarify and Analyse (New Features Only)

Before writing any plans, make sure you understand the feature and can recommend a sensible scope.

### Clarify First

If any of these are unclear, ask before proceeding:

- What workflow does this replace or improve? (What does the user currently do in a spreadsheet or external tool?)
- Who uses this — the agency owner only, or do clients interact with it too?
- Is there a specific trigger for wanting this now?

One focused question is better than a list. If the feature is obvious (e.g. "add document tagging"), don't ask — just proceed.

### Analyse and Recommend

Think through the following, then present a clear recommendation to the user. Be direct — don't just list considerations, tell them what you think.

**Does it fit?** How does this feature fit Tercero's core positioning as an agency management platform? Does it replace something agencies currently do in a separate tool?

**What does it reuse?** Map the feature to existing infrastructure: tables, Supabase storage, the public token pattern, the global page + client tab pattern, React Query hooks. Features that reuse existing patterns ship faster and integrate better.

**What's the minimum useful version?** Define Phase 1 as the smallest thing that delivers real value independently. Future phases should each be independently useful too.

**What are the risks?** Call out scope creep risks, dependencies on other features being stable, or anything that might surprise the user during the build.

End your analysis with a concrete proposal:

> "I'd build this as [N] phases. Phase 1 covers [X], which means [user value]. Does this match what you had in mind, or do you want to adjust the scope?"

Wait for approval before writing the feature doc.

---

## Step 3 — Write the Feature Doc

Once scope is agreed, produce a complete feature markdown file using the structure in `referenced/feature-template.md`.

- **File name**: `[NN]-[feature-slug].md` — use the next available number from `00-index.md`
- **File location**: `.claude/features/[NN]-[feature-slug].md`

Write the full document — all phases, all DB schema, all component paths, all checklists. A vague plan creates blockers during the build. The doc should be specific enough that someone else could implement any phase from it without asking questions.

After writing, tell the user:

> "Feature plan saved to `.claude/features/[NN]-[feature-slug].md`. Read it through and let me know if anything needs adjusting before we start Phase 1."

Wait for approval before implementing anything.

---

## Step 4 — Phased Implementation

Implement one phase at a time. Never start a phase until the previous one is explicitly approved.

### Before Starting Each Phase

1. Re-read the phase section from the feature doc — never rely on memory
2. Verify any file paths, tab names, or query key patterns by reading the actual source files before touching them
3. If the phase involves DB changes, apply those first and confirm they work before writing any component code

### While Building

Build only what the phase specifies. Don't add "nice to haves", don't anticipate Phase 2 requirements, don't refactor nearby code unless the feature requires it.

If you hit a blocker — a table that doesn't exist as expected, a component that works differently than described, a missing dependency — stop immediately. Describe the blocker, propose two or three options, and ask the user which path to take. Don't improvise around blockers silently.

### Completing a Phase

When the phase is done:

1. Go through the phase checklist item by item and verify each one is actually true
2. Update the feature doc:
   - Check off completed checklist items (`[x]`)
   - Add an "Implementation Notes" section below the checklist noting any deviations, decisions made, or scope items deferred to a later phase
   - Update the phase header to `✅ Complete`
3. Tell the user:
   > "Phase [N] complete. Built: [brief summary]. Deviations: [anything that changed from the plan, or 'none']. Ready to move to Phase [N+1] when you are."

Then stop. Wait for explicit go-ahead.

---

## Step 5 — Update the Index

After all phases are complete, update `.claude/features/00-index.md`:

- Add the feature to the Feature Files table with its status
- Add any new DB tables to the Key Database Changes section
- Add any new storage buckets to Shared Infrastructure Notes

---

## Conventions Reference

This is a quick reference. CLAUDE.md and the `referenced/` files are the source of truth — read them if anything here seems incomplete.

### Code Architecture

- Supabase calls live in `src/api/[feature].js` only — never inside components
- Reads → React Query hooks (`useXxxList()`, `useXxxById()`); mutations → plain async functions used with `useMutation`
- Query keys: `['feature', 'list', { filters }]` and `['feature', 'detail', id]`
- Invalidate the relevant list key after every mutation

### UI

- New pages call `useHeader({ title, breadcrumbs })` from `@/components/misc/header-context.jsx`
- Loading states use skeleton screens, not spinners
- Destructive actions use `AlertDialog` (never a plain confirm or inline button)
- All async feedback uses `sonner` toasts — `toast.success()` and `toast.error()`
- Dates are always formatted via `formatDate()` from `@/lib/helper.js`
- Icons are `lucide-react` exclusively

### Forms

- React Hook Form + Zod for every form — validation errors render inline via `<FormMessage />`

### Styling

- Tailwind CSS 4 utility classes only
- shadcn/ui New York style components — import from `@/components/ui/`
- `@/` alias for all internal imports

### Operations Feature Pattern

New operations features (things like Meetings, Notes, Documents) follow this architecture:

```
/[feature]               — Global route in the Operations sidebar group
Client Detail → [Tab]    — Filtered view for one client
```

Same `[Feature]Tab` component handles both contexts — `clientId` prop present = filtered, absent = show all. When uploads need a default client, use the Internal Account (`is_internal = true`).

### Feature Gating

Don't add `can.*()` checks or touch `useSubscription.js` unless gating is explicitly in scope for this feature.

### Storage

- New buckets are private (signed URLs only, never public URLs)
- Path pattern: `{user_id}/{client_id}/{record_id}/{filename}`
- Track storage usage: call `increment_storage_used` / `decrement_storage_used` RPCs on upload/delete
- Use `GREATEST(0, current - N)` when decrementing to prevent negative values

---

## Reference Files

- `referenced/feature-template.md` — exact structure for feature planning docs
- `referenced/tercero-data-patterns.md` — DB patterns, RLS templates, storage patterns, common component patterns

---

## Existing Global Pages

| Feature   | Route                  | Sidebar Group | Client Detail Tab |
| --------- | ---------------------- | ------------- | ----------------- |
| Posts     | `/posts`               | Content       | —                 |
| Calendar  | `/calendar`            | Content       | —                 |
| Meetings  | `/operations/meetings` | Operations    | Workflow          |
| Notes     | `/operations/notes`    | Operations    | Workflow          |
| Documents | `/documents`           | Operations    | Documents         |
| Finance   | `/finance/*`           | Finance       | Overview          |
