# Collaboration Features

Two related features that give Tercero an internal collaboration layer without building a full chat system.

1. **In-App Notifications** — a header bell that surfaces real-time, role-aware activity. **(building first)**
2. **Contextual Comments** — threaded discussion on posts and campaigns. (later; builds on notifications)

---

# Feature 1 — In-App Notifications

## Problem
All activity in Tercero triggers emails only. If a user is already in the app and a teammate changes a post status, assigns a task, or a campaign gets approved, there's no in-app signal. The app feels static, and email is the only feedback channel.

## Goal
A notification bell in the `AppShell` header that surfaces real-time activity relevant to the current user, respecting their role and what they have access to. Each user sees only their own notifications.

## Locked Decisions
| # | Decision |
|---|---|
| 1 | **Email is untouched.** In-app notifications are purely additive. We decide later, per-type, which ones also warrant an email. |
| 2 | **One personal notification model for all roles in v1.** No separate owner "activity feed" — the owner gets the same per-recipient bell as everyone else (and is naturally a recipient of the broad operational events). A workspace-wide activity log is a deferred future extension. |
| 3 | **REVISED in Phase 3 → notification creation lives wherever the state change lives.** The original plan (client-side `notify()` in every mutation) doesn't survive the codebase: most state changes happen inside `SECURITY DEFINER` RPCs, and two flows (client review via token, team join) are unauthenticated / run as another user, where a client-side insert cannot satisfy RLS. So: client-side `notify()` for plain table writes; a SQL `emit_notifications()` helper called inside the RPC/trigger for everything else. Both helpers enforce the same rules (de-dupe, strip actor). |
| 4 | **30-day retention with auto-delete** of read+old notifications. |

## Design Principles (from codebase review)
- **Realtime is an invalidator, not a data pipe.** Follow the existing `team.js` pattern: subscribe to the `notifications` channel filtered by `recipient_user_id`, and on any event call `invalidateQueries()` to refetch the count + list. Do not manually merge pushed rows into cache. See [team.js:27-49](../../src/api/team.js#L27-L49).
- **Count + list mirrors the overdue-task badge.** `useMyOverdueTaskCount()` in [tasks.js:89](../../src/api/tasks.js#L89) is the shape template: a lightweight count query for the badge, a separate list query for the panel.
- **Never notify the actor.** Mutations run as the acting user; fan-out must always exclude the actor (`recipient !== actorUid`). This is the single most important rule — miss it and the feature feels broken.
- **Fan-out is simple because the role model is small.** Roles: `owner`, `admin`, `member`, `superadmin` ([permissions.js](../../src/lib/permissions.js)). Capability-scoped fan-out (e.g. `finance`) resolves to owner+admin+superadmin.

## Data Model

```
notifications
  id              uuid pk
  workspace_id    uuid    → the owner's UID (scopes to workspace)
  recipient_user_id uuid  → the user who sees this (RLS key)
  actor_user_id   uuid    → who caused it (for "Alex did X" + self-exclusion)
  type            text    → 'post_status_changed' | 'task_assigned' | ...
  title           text    → "Post status updated"
  body            text    → "Summer Campaign Draft moved to Pending"
  entity_type     text    → 'post' | 'task' | 'campaign' | 'invoice' | 'team'
  entity_id       uuid    → record to navigate to on click (nullable)
  link            text    → optional explicit route override (nullable)
  read_at         timestamptz  → null = unread
  created_at      timestamptz  default now()
```

**RLS:**
- SELECT / UPDATE: `recipient_user_id = auth.uid()` — users only ever see/mutate their own rows.
- INSERT: performed by mutation functions; allowed for workspace members (guarded by `workspace_id = get_my_agency_user_id()`).
- No DELETE by clients — retention cleanup runs server-side.

**Indexes:** `(recipient_user_id, read_at)` for the unread-count query; `(recipient_user_id, created_at desc)` for the list.

## Fan-out Rules
| Notification type | Recipients | Source of recipients |
|---|---|---|
| `post_status_changed` | Post creator + workspace owner (minus actor) | `posts.created_by`, workspace owner UID |
| `task_assigned` | Assignee only | `tasks.assigned_to` |
| `task_updated` | Assignee + task creator (minus actor) | `tasks.assigned_to`, `tasks.created_by` |
| `campaign_review_shared` | Workspace owner | owner UID |
| `campaign_reviewed` (approve / request revision) | Post author + workspace owner (minus actor) | post author, owner UID |
| `team_member_joined` | Workspace owner + admins | `get_team_members` filtered to owner/admin |
| `invoice_overdue` | All `finance` holders (= owner + admins) | `get_team_members` filtered to owner/admin |
| `comment_added` (Feature 2) | Post author + prior commenters (minus actor) | comments table |

## Shared Helper
One module `src/api/notifications.js` exposes:

```js
// Insert notification rows. De-dupes recipients, strips the actor,
// no-ops on empty recipient list.
export async function notify({
  workspaceId, actorUserId, recipients, // array of uids
  type, title, body, entityType, entityId, link,
})
```

Mutation functions call `notify(...)` in one line at the same points they currently invoke `send-*` email functions — those call sites are the ready-made trigger inventory ([search for `functions.invoke('send-`](../../src/api)).

## UI
- **Bell** in `AppShell` header, beside the theme toggle. Red unread-count badge (mirrors overdue-task badge styling).
- **Panel** — popover/sheet, newest-first list. Each row: type icon, title, body, relative timestamp (`formatDistanceToNow`), unread highlight.
- **Interactions:** clicking a row navigates to `link` or the `entity_type`/`entity_id` route and marks it read; "Mark all read" button at top; empty state via the `empty-states` skill.

## Retention
A scheduled cleanup (Supabase cron / `pg_cron` or edge function) deletes notifications where `created_at < now() - interval '30 days'`. Read state does not affect deletion — 30 days is a hard age cap.

## Open Questions (non-blocking)
- Per-user notification preferences (mute types) — deferred to a later phase.
- Which types also send email — revisit after v1 is live.
- Desktop/browser push — out of scope.

---

## Implementation Phases

### Phase 1 — Foundation (DB + API + helper)
- Create `notifications` table, indexes, RLS policies (migration).
- Add `notifications` to the Supabase Realtime publication.
- Build `src/api/notifications.js`:
  - `notify(...)` helper (insert, de-dupe, actor-strip).
  - `useUnreadNotificationCount()` — count query (badge).
  - `useNotifications()` — list query + realtime invalidation subscription.
  - `markNotificationRead(id)`, `markAllNotificationsRead()` mutations.
- **Deliverable:** notifications can be created and read via the API; no UI yet. Unit-testable.

### Phase 2 — Bell UI
- `NotificationBell` component in `AppShell` header (badge + panel).
- Panel list rows with type icons, relative time, unread state, empty state.
- Click-to-navigate + mark read; "Mark all read".
- Realtime badge increment verified live.
- **Deliverable:** working bell, but only fed by whatever triggers exist. Wire one trigger (task assignment) as the proof-of-life.

### Phase 3 — Trigger wiring (fan-out) ✅ SHIPPED
Implemented at the DB level (see revised Decision 3). A shared SQL helper
`emit_notifications(workspace_id, actor, recipients[], type, title, body, entity_type, entity_id, link)`
de-dupes recipients and strips the actor; a companion `workspace_admin_uids(workspace_id)`
resolves the owner+admin recipient set. Both are `SECURITY DEFINER` with EXECUTE revoked
from `public`/`anon`/`authenticated` (only internal definer callers invoke them).

Wired triggers:
- **Tasks** → `tg_notify_task_changes` trigger on `public.tasks` (AFTER INSERT/UPDATE):
  - `task_assigned` on insert-with-assignee and on reassignment (`assigned_to` change).
  - `task_updated` on status change → assignee + creator.
  - A trigger (not client-side) because the edit form resends `assigned_to` every save;
    only `OLD IS DISTINCT FROM NEW` is spam-proof.
- **Post workflow** (RPCs extended): `submit_for_internal_approval` → notifies owner+admins
  ("needs review"); `approve_internally` → notifies creator ("approved");
  `request_internal_changes` → notifies creator ("changes requested").
- **Client review via token** (`update_post_status_by_token`, unauthenticated): on
  `SCHEDULED`/`NEEDS_REVISION`, `campaign_reviewed` → post creator + workspace owner
  (actor NULL — external client). Wrapped in its own exception block so it can never
  block the client's decision.
- **Team join** (`join_team`): `team_member_joined` → owner + admins (new member excluded).

Verified end-to-end via rolled-back/cleaned-up smoke test (assign + status change fired,
dedup confirmed). Security advisors cleared for the new objects (trigger fn RPC-revoked,
`notifications` policies scoped `to authenticated`).

**Deferred to Phase 4:** `invoice_overdue` — time-based, no mutation fires it; needs a
scheduled (pg_cron) check. `campaign_review_shared` — intentionally dropped as low-value
noise (actor is usually the owner → self-excludes to zero recipients).

### Phase 4 — Retention + polish
- Scheduled 30-day cleanup job (pg_cron).
- `invoice_overdue` notification via the same scheduled job (evaluate invoices past due,
  fan out to `workspace_admin_uids`, guard against re-notifying the same invoice).
- Loading/skeleton states, error states, accessibility pass on the panel.
- Tests: fan-out rules (correct recipients, actor excluded), read/unread transitions.
- **Deliverable:** production-ready feature.

### Deferred (future phases)
- Per-user notification preferences (mute by type).
- Workspace-wide **activity log** page for owners (chronological, filterable — separate from the personal bell, same `notifications` table can back it).
- Email-parity decisions per notification type.

---

# Feature 2 — Contextual Comments

> Planned after Notifications. Summarized here; to be expanded when we start it.

## Problem
Feedback on a post or campaign goes to Slack/WhatsApp and gets lost. No way to keep discussion tied to the specific work item.

## Goal
Threaded comments directly on posts and campaigns so team discussion lives next to the work — replacing the need for a generic chat room.

## Core Concept
- `comments` table: `id`, `workspace_id`, `entity_type` (post/campaign), `entity_id`, `author_user_id`, `body`, `created_at`, `updated_at`, `deleted_at` (soft delete).
- RLS: workspace members read all comments in their workspace; only the author can edit/delete their own.
- Realtime subscription filtered by `entity_type + entity_id`.
- **Integrates with Notifications:** a new comment emits a `comment_added` notification to the post author + prior commenters.

## Surfaces
- **Post detail** — comment thread in the right panel alongside post metadata.
- **Campaign detail** — campaign-level discussion tab or side panel.

## Open Questions
- File/image attachments in comments?
- `@mentions` — display-only or trigger a targeted notification?
- Client visibility (relevant to a future client portal)?
- Edit/delete window vs. open-ended?
