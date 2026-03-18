# Bulk Actions — Workflow Tab (Client-Scoped)

> **Status:** Deferred to Phase 2
> **Complexity:** Medium

---

## Feature Overview

Bulk selection and actions on posts within the client Workflow tab (`DraftPostList`), allowing agencies to act on multiple posts at once rather than one at a time.

---

## Complexity Assessment

### Easy Parts
- Checkbox UI on each post card — shadcn `Checkbox` already installed
- `selectedIds: Set<string>` state in `DraftPostList`
- "Select All / Deselect All" toggle in `WorkflowTab` header
- Floating action bar (visible when `selection.size > 0`)
- Bulk delete — wrap existing `deletePost()` in a sequential Promise loop

### What Makes It Medium
1. **No batch API exists** — all current functions (`deletePost`, `updatePost`, status changes) are single-post. Bulk send-for-approval requires a new Supabase RPC or sequential calls with aggregate error handling.
2. **Status-aware action bar** — selections may span mixed statuses. The action bar must compute the intersection of what's allowed:
   - "Send for Approval" only enabled if **all** selected posts are `DRAFT`
   - "Delete" enabled if **all** selected posts are non-`PUBLISHED`
   - Actions disabled with explanatory tooltip when mixed statuses block them
3. **Partial failure UX** — if 4 of 5 deletes succeed, the UI must surface the failure without losing the successful state.

### What's Not Hard
- No complex DB transactions needed — each post operation is already atomic
- Cache invalidation keys are already established
- No new routes, dialogs, or pages required

---

## Why Phase 2 (Not Phase 1)

- Bulk actions are a **power-user efficiency feature**, not a core demo moment
- Phase 1 story ("post → workflow → client approval") is complete without it
- Mixed-status edge cases carry demo risk if rushed
- Phase 1 has higher-ROI polish work available first (e.g. wiring up the unwired search/filter in WorkflowTab)
- By Phase 2, real usage will clarify which statuses need bulk ops most

---

## Phase 2 Scope

### Actions to Include

| Action | Eligible Statuses | Notes |
|---|---|---|
| Send for Approval | `DRAFT` only | Requires new `update_posts_status_batch` RPC |
| Delete | All except `PUBLISHED` | Loop existing `deletePost()` |
| ~~Create New Version~~ | — | **Not bulk-able** — each revision needs individual version chain context |
| ~~Edit~~ | — | **Not meaningful in bulk** — skip |

### Files to Modify

| File | Change |
|---|---|
| `src/pages/posts/DraftPostList.jsx` | Selection state, checkbox UI, floating action bar |
| `src/pages/clients/clientSections/WorkflowTab.jsx` | "Select all" toggle in header |
| `src/api/posts.js` | `deleteMultiplePosts(postIds[])` wrapper function |
| Supabase migration | `update_posts_status_batch(p_post_ids, p_status)` RPC |

---

## Status Gating Reference

| Status | Send for Approval | Delete | Create New Version | Edit |
|---|---|---|---|---|
| `DRAFT` | ✅ | ✅ | — | ✅ (single only) |
| `PENDING_APPROVAL` | — | ✅ | — | ✅ (single only) |
| `NEEDS_REVISION` | — | ✅ | — (not bulk) | — |
| `SCHEDULED` | — | ✅ | — | — |
| `ARCHIVED` | — | ✅ | — | — |
| `PUBLISHED` | — | ❌ disabled | — | — |
