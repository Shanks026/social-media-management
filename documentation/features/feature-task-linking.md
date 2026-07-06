# Task Linking — Campaign & Deliverable Attachments

Complete the half-built campaign link on tasks, and add an equivalent link to a specific deliverable (post).

> **Status: ✅ COMPLETE** (all phases shipped). The feature grew beyond the original
> single-link plan during the build:
> - **Deliverables are many-to-many**, not single-link — a `task_posts` join table
>   (`ON DELETE CASCADE`) replaced the planned single `tasks.post_id` column. A task can
>   link any number of deliverables.
> - **Client is optional.** A task can be "General (no client)" and link deliverables
>   across *any* client (including internal). The tasks-page filter separates
>   **General** from **Internal**.
> - **Reverse view shipped** on the post detail page ("Linked tasks · N").
> - Campaign linking stays **single-link** as originally planned.
>
> Only two items remain explicitly deferred (see end): a campaign-side reverse view and
> multi-campaign linking.

## Problem

`tasks.campaign_id` already exists as a column, and `CreateTaskDialog` already has a working client → campaign picker that sets it — but the feature dead-ends there. `EditTaskDialog` has no campaign field at all (can't add or change it after creation), and `TaskCard` never displays it, so a task can have a campaign tagged and show zero indication of it anywhere. It's built halfway and effectively invisible.

There's also no way to link a task to a specific **deliverable** (post) at all — no column, no picker. For an agency tool where most work *is* deliverables, "fix the caption on this Instagram post" as a task with no link back to the actual post is a missed connection.

## Goal

A task can optionally be tagged with a campaign and/or a specific deliverable, visible as a badge on the card, settable and editable via the existing dialogs, consistent with how `client_id` already works.

## Locked Decision

**Structured field, not an @ mention.** Considered and rejected inline `@mention`-style linking (referencing a post/campaign by typing `@` in the title/description, the same mechanism used for people-mentions in comments). Reasons:
- `client_id`/`campaign_id`/`assigned_to` are already structured dropdown fields on tasks — a `post_id` field is the same shape, not a new pattern.
- "Which deliverable is this about" is metadata (like due date or priority), not part of a sentence — unlike a person-mention, which is inherently conversational.
- A structured FK is queryable for free (`WHERE post_id = X` → "all tasks for this deliverable"); an inline mention would require text parsing to get the same view.
- Post/campaign names can repeat or be renamed — a picker resolving to a stable ID avoids the disambiguation problem a text mention would need its own UI to solve.
- The campaign half of this already exists as a structured field — going the mention route means discarding that work, not extending it.

## Data Model

```sql
-- tasks.campaign_id already exists:
--   FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL

-- Deliverable linking is many-to-many (a task can reference several posts).
-- The original single tasks.post_id column was superseded by a join table:
create table public.task_posts (
  task_id      uuid not null references public.tasks(id) on delete cascade,
  post_id      uuid not null references public.posts(id) on delete cascade,
  workspace_id uuid not null,
  created_at   timestamptz not null default now(),
  primary key (task_id, post_id)
);
```

Campaign stays single-link (`campaign_id` with `ON DELETE SET NULL`). Deliverables
went **many-to-many** via `task_posts` (see Phase 2). `ON DELETE CASCADE` on `post_id`
means deleting a post cleanly removes its link rows — no stale references (the reason
the join table was chosen over a `post_id uuid[]` array column). RLS scopes all rows by
`workspace_id = get_my_agency_user_id()`, `to authenticated`.

`tasks.client_id` is **nullable and optional** — a null client means "General (no
client)", a task not tied to any one client (see Phase 2.5). Because `task_posts` never
constrains a linked post's client to the task's client, a General task can link
deliverables from *any* client (including internal).

## Reuse Points (from codebase review)

- **Picker UX precedent:** `CreateTaskDialog.jsx` already has a client → campaign cascading `Select` (via `fetchActiveCampaignsByClient(clientId)` in `src/api/campaigns.js`). The deliverable picker should mirror this exactly — same component shape, same interaction.
- **Data source for the deliverable picker:** `fetchAllPostsByClient(clientId)` already exists in `src/api/posts.js`, shaped identically to `fetchActiveCampaignsByClient`. No new API function needed for the basic case — reuse it directly.
- **Display precedent:** `TaskCard.jsx` already renders a client chip (`ClientAvatar` + name) from `clientMap[String(task.client_id)]`. The campaign/deliverable badges should follow the same "resolve id → map → small chip" pattern, not a new visual language.

## Implementation Phases

### Phase 1 — Finish the campaign link ✅ SHIPPED
- Added a campaign `Select` to `EditTaskDialog.jsx`, mirroring `CreateTaskDialog`'s client → campaign cascade (`fetchActiveCampaignsByClient`), including the client-change-resets-campaign behavior.
- Added a campaign badge to `TaskCard.jsx` (card face, detail sheet, and table row) via a `campaignMap` built in each consumer (`TasksTab`, `TasksAndReminders`) from `useCampaigns()` (no `clientId` → all workspace campaigns).
- Added a campaign filter to `TasksTab` (only rendered when at least one visible task actually has a campaign linked, to avoid a permanently-empty dropdown).
- **Card-face treatment ended up different from the original plan:** rather than a text badge next to the client name, the campaign shows as a **circular icon-only badge** (`Megaphone` in a `secondary`-variant `Badge`, `title` attribute for the name on hover) sitting in the top row beside the status/priority badges — grouped with the "⋮" menu button on the right via a shared `ml-auto` flex container. The sheet's campaign field is a clickable blue underlined `Link` to `/campaigns/{id}`.
- **Bugs found and fixed along the way (unplanned, but real):**
  - `TaskDetailSheet` was referenced in `TasksAndReminders.jsx`'s table view but never exported/imported — a pre-existing `ReferenceError` crash on opening a row from that view. Fixed by exporting it from `TaskCard.jsx`.
  - Default task sort was due-date-first almost everywhere (`useTasks`, `useMyTasks`), and `TasksAndReminders.jsx`'s main page additionally re-sorted by priority on top of that (`sortByPriority`), which silently overrode any query-level ordering fix. All three now sort purely by `created_at desc` — dead `sortByPriority`/`PRIORITY_ORDER` code removed.
- **Deliverable:** campaign linking is a real, end-to-end feature — visible, editable, filterable.

### Phase 2 — Add deliverable (post) linking ✅ SHIPPED (multi-select)

**Shipped as many-to-many, not single-link.** After the picker landed, the scope
was widened so a task can link **multiple** deliverables (e.g. "fix captions on these
3 posts" as one task). This superseded the single `tasks.post_id` FK:
- Migration `task_posts_multi_link`: created the `task_posts` join table (PK
  `(task_id, post_id)`, `ON DELETE CASCADE` both sides, `workspace_id` for RLS),
  backfilled the one existing `post_id` value, then dropped `tasks.post_id`.
  Chosen over a `post_id uuid[]` column for clean cascade-on-delete and indexed
  reverse queries.
- `src/api/tasks.js`: `createTask`/`updateTask` accept `post_ids` (written via
  `replaceTaskDeliverables` — clear + insert; `updateTask` only touches links when
  `post_ids` is passed, so inline edits never wipe them). `fetchTaskPostIds` seeds
  the edit dialog; `fetchTaskDeliverables` resolves summaries for display.
- `DeliverablePickerSection` is now multi-select: checkbox rows that stay open on
  pick, and a collapsed summary showing stacked thumbnails + "N deliverables linked".
- `EditTaskDialog` seeds its selection from `task_posts` (once per open, via a ref
  guard so a background refetch can't clobber in-progress edits) since the link no
  longer lives on the task row.
- `TaskCard`: detail sheet lists all linked deliverables (label pluralizes); card face
  shows a single count badge (icon + N).

Original single-select build notes (superseded but kept for context):



**Picker mechanism — locked after discussion.** `CreateTaskDialog`/`EditTaskDialog` are already `Dialog`s, so a second `Dialog` for picking a deliverable (the same modal `LinkPostsToCampaignDialog` uses for campaign↔post linking) would mean stacking a modal over a modal — a real problem (Radix focus-trap/scroll-lock conflicts between nested `Dialog`s), not just a style preference. **`Popover` instead** — already the proven pattern in this codebase for exactly this shape of problem (the `@mention` picker and emoji-reaction picker in `CommentThread.jsx`, the list in `NotificationBell.jsx`), and Radix's `Popover` composes safely inside a `Dialog`.

- A plain text `Select` (the campaign picker's shape) doesn't work for deliverables: campaigns are few and distinctly named, but a client can have dozens of posts with generic, repeating titles ("Instagram Post") — indistinguishable without a thumbnail, platform, and date.
- **Visual precedent:** `LinkPostsToCampaignDialog.jsx` already renders exactly this — thumbnail (or `Play` icon for video), title, target date, status badge, platform icons, searchable. New picker mirrors that row styling, but **single-select** (click a row → selected + popover closes; no separate confirm button, since that dialog's confirm button exists only because it's multi-select-with-checkboxes).
- **No new data-layer work** — `fetchAllPostsByClient(clientId)` (`src/api/posts.js`) already returns `media_urls`, `platform`, `status`, `target_date`, and the linked campaign name per post.

Build plan:
- Migration: `tasks.post_id` column + FK (`ON DELETE SET NULL`), matching `campaign_id`'s shape.
- `src/api/tasks.js`: extend `createTask`/`updateTask` to accept `post_id` (no `useTasks` change needed — it already does `select('*')`).
- New `DeliverablePickerPopover` component (search input + scrollable rich list in a `Popover`, single-select) — reused identically in `CreateTaskDialog` and `EditTaskDialog`, same reuse relationship the campaign picker already has between those two files. Independent of the campaign selection (not scoped by it) — simpler, and a task can reasonably link to a deliverable without also being tied to that deliverable's campaign.
- `TaskDetailSheet`: replace what would've been a plain link with a compact preview row (thumbnail + title + platform icons + status badge), clickable through to the post detail page — a title alone doesn't give enough visual confirmation of *which* post it is.
- `TaskCard.jsx`: same circular icon-only badge treatment as campaign (top row, grouped with the menu button) for visual consistency, using a deliverable-appropriate icon (e.g. `FileText` or `Image`).
- **Deliverable:** tasks can be tied to a specific post, visible and editable, consistent with the campaign link — without ever stacking a modal on a modal.

### Phase 2.5 — Optional client + cross-client deliverables ✅ SHIPPED

Client became **optional** so a task can be "General (no client)" and link deliverables
across *any* client (e.g. "re-grade the colour on these 5 posts" spanning clients, or
internal work). No migration — `tasks.client_id` was already nullable.

- `src/api/posts.js`: added `fetchAllDeliverables(userId)` — every deliverable across all
  clients, same per-item shape as `fetchAllPostsByClient` plus `client_name` /
  `client_logo` / `is_internal` for labelling. (Mirrors the existing `useGlobalPosts`
  join pattern.)
- **Both dialogs:** client dropdown gains a **"General (no client)"** option (empty
  selection). The deliverable picker **branches on client** — a client selected → scoped
  to that client (fast); no client → `fetchAllDeliverables` across every client. New
  global tasks default to General; opening from a client's page still preselects it.
  Submit writes `client_id: null` for General (removed the old silent auto-attach to the
  internal account).
- `DeliverablePickerSection`: new `showClient` prop — in General mode each row shows a
  small client chip (logo + name, or "Internal") so repeating titles across clients are
  distinguishable.
- `TaskCard`: card footer, detail sheet, and the table-view client column all render
  **"General (no client)"** when `client_id` is null. The detail sheet also shows each
  deliverable's own client (for General tasks only, where deliverables can be cross-client).
- **Display gotcha fixed:** `clientMap` builders in `TasksAndReminders.jsx` and
  `DashboardMeetingsNotes.jsx` used to map the `'null'` key to the internal account (a
  leftover from the old "no client = internal work" model), which made every clientless
  task render as Internal. Removed — a null lookup now misses and falls through to
  "General (no client)". Genuine internal-account tasks (real client id) are unaffected.

### Phase 3 — Polish ✅ SHIPPED

- **Empty/removed states** — handled by the schema: `ON DELETE CASCADE` on `task_posts.post_id`
  removes link rows when a post is deleted, so the UI self-corrects (verified: deleting a
  post in the DB dropped it from its tasks). No blank-chip case to guard.
- **Tests** — create/edit persists the right `post_ids`, the `replaceTaskDeliverables`
  add/remove/clear diff, General (null-client) round-trips, cross-client links resolve, and
  cascade-on-delete all pass.
- **Filter split (General vs Internal)** — the tasks-page client filter now has a
  **"General (no client)"** option distinct from **"Internal"**. `general` filters
  `!t.client_id`; `internal` filters real internal-account tasks
  (`t.client_id && clientMap[t.client_id]?.is_internal`). No longer conflated.
- **Reverse view ("N tasks" on the post detail page)** — `useTasksForPost(postId)`
  (`src/api/tasks.js`) reverse-joins `task_posts → tasks`; the `PostLinkedTasks` component
  (`src/components/tasks/PostLinkedTasks.jsx`) renders a compact "Linked tasks · N" list
  (priority dot, title, due date, task-status pill → `/tasks`) near the bottom of
  `PostContent`. Renders nothing when a post has no linked tasks. Uses `post.actual_post_id`
  (the real `posts.id`, matching `task_posts.post_id`).

### Deferred (future)
- Campaign-side "Tasks" view (symmetric reverse view on the campaign detail page — the post
  side shipped above; campaign side not yet done).
- Multi-**campaign** linking (campaign is still single-link; only deliverables went many-to-many — see Phase 2).
