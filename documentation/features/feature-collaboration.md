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

## Problem
Feedback on a post or campaign goes to Slack/WhatsApp and gets lost. No way to keep discussion tied to the specific work item.

## Goal
Flat, in-app comment threads on posts and campaigns so team discussion lives next to the work — replacing the need for a generic chat room.

## Locked Decisions
| # | Decision |
|---|---|
| 1 | **Flat comments, not nested.** Chronological feed like the prospect outreach log. Nested replies deferred. |
| 2 | **Minimal @mentions.** A member picker in the composer; a mention fans out a `comment_added` notification to the mentioned user. No rich autocomplete-as-you-type in v1. |
| 3 | **No attachments in v1.** Text only. (`note-media` bucket is the precedent if added later.) |
| 4 | **Post surface = toggleable right panel** mirroring `VersionSidebar` (the `PostDetails` layout is already `flex-row` with a conditional right sidebar). Revisit if it feels cramped. |
| 5 | **Campaign surface = a 4th "Discussion" tab** alongside Deliverables / Finance / Activity. |
| 6 | **Edit = author-only; delete = author + admin.** Both enforced in RLS via `author_user_id = auth.uid()` / `is_workspace_admin()` (helper already exists). |
| 7 | **Discord-style reactions, curated emoji set (12), no shadcn `Bubble`.** shadcn's `Bubble`/`BubbleReactions` was evaluated and rejected — `BubbleReactions` is a subcomponent of the chat-bubble family (reactions "overlap the bubble edge"), so adopting it means adopting `Bubble`'s two-party `align: start/end` + `variant` chat-shell too. Reactions are built as a standalone pill row under `CommentRow` instead — no bubble shape, no picker, a fixed emoji set. |

## Design Principles (from codebase review)
- **Lift the UX from the prospect outreach log.** [ProspectOutreachTab.jsx](../../src/pages/prospects/prospectSections/ProspectOutreachTab.jsx) already implements the inline composer, chronological feed, delete-with-confirm, timeline markers, skeletons, and emoji empty state. Reuse the shape.
- **Store the real author, not the workspace owner.** The prospect log stores `user_id = workspaceUserId`, so it can't attribute authors. Comments MUST store `author_user_id = auth.uid()` (the actual caller — the `created_by` rule from CLAUDE.md) so we can show who said what.
- **Author attribution infra already exists.** Reuse the `memberMap` pattern from [TasksTab.jsx:41-52](../../src/components/tasks/TasksTab.jsx#L41-L52): `useTeamMembers()` → `{ user_id: { full_name, avatar_url } }`. No new infra.
- **Realtime is an invalidator.** Subscribe to `comments` filtered by `entity_type + entity_id`; on any event, `invalidateQueries`. Same pattern as `team.js` and the notification bell.
- **Notification fan-out via a DB trigger.** Comment inserts are plain authenticated table writes, but the fan-out (thread participants + mentioned users, minus actor) is cleanest and spam-proof in an `AFTER INSERT` trigger calling the existing `emit_notifications()` helper — consistent with Phase 3 of the notifications feature.

## Data Model
```
comments
  id              uuid pk
  workspace_id    uuid          → owner UID (scopes to workspace)
  entity_type     text          → 'post' | 'campaign'
  entity_id       uuid          → the post_id / campaign_id
  author_user_id  uuid          → auth.uid() of the writer (attribution key)
  body            text
  mentioned_uids  uuid[]        → users @mentioned in this comment (for fan-out)
  created_at      timestamptz   default now()
  updated_at      timestamptz
  deleted_at      timestamptz   → soft delete (nullable)
```
**RLS:**
- SELECT: `workspace_id = get_my_agency_user_id()` (all workspace members read).
- INSERT: `workspace_id = get_my_agency_user_id()` and `author_user_id = auth.uid()`.
- UPDATE (edit): `author_user_id = auth.uid()`.
- DELETE (soft): `author_user_id = auth.uid() OR is_workspace_admin()`.

**Index:** `(entity_type, entity_id, created_at)` for the thread query.

## Fan-out (comment_added)
On `AFTER INSERT`, notify (minus the author):
- All prior **thread participants** (distinct `author_user_id` on the same entity).
- Any **@mentioned users** (`mentioned_uids`).
- For posts: the post's `created_by` (deliverable owner) even if they haven't commented yet.

## Reactions Data Model (Phase 5)

```
comment_reactions
  id            uuid pk
  comment_id    uuid    → fk comments.id, on delete cascade
  user_id       uuid    → auth.uid() of the reactor
  emoji         text    → one of REACTION_EMOJIS (check constraint)
  created_at    timestamptz default now()
  unique (comment_id, user_id, emoji)  -- toggle key: one row per person per emoji per comment
```

**Curated set (12, fixed — no open picker):** 👍 👎 ❤️ 😂 😮 😢 🎉 🙌 🔥 👀 ✅ 🤔

**RLS:**
- SELECT: workspace members, via join to the parent comment's `workspace_id = get_my_agency_user_id()`.
- INSERT/DELETE: `user_id = auth.uid()` — you can only add/remove your own reaction.

**Toggle behavior (Discord-style):** clicking an emoji you haven't used on that comment adds it; clicking one you have removes it. Implemented as a single `toggle_comment_reaction(p_comment_id, p_emoji)` RPC (atomic check-then-insert-or-delete — avoids a client-side race between reading state and writing it, same reasoning as `soft_delete_comment`).

**No notification fan-out.** Reactions are intentionally silent — the whole point is a lightweight acknowledgment that doesn't warrant a bell notification. (Revisit only if users ask for it.)

**Realtime:** `comment_reactions` has no `entity_id` column, so it can't reuse the `entity_id=eq.` server-side filter the `comments` channel uses. Subscribe unfiltered and check `payload.new/old.comment_id` against the currently-loaded comment ids client-side before invalidating — cheap given a thread is at most a few dozen comments, and avoids denormalizing `entity_type`/`entity_id` onto the reactions table just for filtering.

---

## Implementation Phases — ✅ ALL SHIPPED (Phases 1–6 + post-launch polish)

### Phase 1 — Foundation (DB + API) ✅
- `comments` table + indexes + RLS (migration).
- Add `comments` to the Realtime publication.
- `AFTER INSERT` trigger → `emit_notifications('comment_added', …)` fanning out to participants + mentions (minus author).
- `src/api/comments.js`:
  - `useComments({ entityType, entityId })` — list query + realtime invalidation.
  - `createComment`, `updateComment`, `softDeleteComment` mutations.
- **Deliverable:** comments can be created/read/edited/deleted via the API; testable, no UI.

### Phase 2 — Comment thread component ✅
- Shared `<CommentThread entityType entityId />` (`src/components/comments/CommentThread.jsx`): composer + feed, reusing the outreach-log UX.
- Author avatar + name via the `memberMap` pattern; relative timestamps.
- Edit (author) and delete (author + admin) with confirm dialog; soft-delete renders as "comment removed" or is hidden.
- Skeletons + emoji empty state.
- **Deliverable:** a drop-in thread component, verified standalone.

### Phase 3 — Surface integration ✅
- **Campaign:** "Discussion" tab (4th tab) in `CampaignDetailPage` → `<CommentThread entityType="campaign" entityId={campaignId} />`.
- **Post:** "Comments" item in the `PostContent` actions dropdown toggles a right panel in `PostDetails` (mirrors `VersionSidebar`, mutually exclusive with History) → `<CommentThread entityType="post" entityId={post.actual_post_id} />`. Uses the **parent post id** (stable across versions), which is what the fan-out trigger expects.
- **Deliverable:** comments live on both surfaces.

### Phase 4 — Mentions + polish ✅
- Minimal @mention, Teams-style: typing `@` inline opens a filtered autocomplete menu (↑/↓ navigate, Enter/Tab select, Esc dismiss); tracks `mentionedUids` (only kept if the token survives in the final text). Mentions in posted comments are highlighted via the pure `splitMentions()` helper (`src/lib/mentions.js`), muted-pill styling shared between composer chips and rendered mentions (`MENTION_CLASS`).
- Composer rebuilt on shadcn's `InputGroup`/`InputGroupTextarea`/`InputGroupAddon` (`src/components/ui/input-group.jsx`, already in the project) to match a rounded chat-input shell: borderless textarea, bottom addon row with a circular `+` button (opens the mention menu) and a circular send button.
- Fixed a missed cache invalidation — posting/editing/deleting now calls `invalidateQueries` directly instead of relying solely on the Realtime round-trip, so the thread updates immediately for the author.
- Accessibility: aria-labels on composer, mention menu, edit/delete, and the feed region.
- Tests: `src/tests/comments/` — `mentions.test.js` (7 cases: longest-match, reconstruction, non-mention `@`) + `CommentThread.test.jsx` (5 cases: empty state, author attribution, mention highlight, post flow, soft-delete tombstone). 12 passing.
- **Deliverable:** production-ready. ✅

### Phase 5 — Reactions ✅
- `comment_reactions` table + RLS + `toggle_comment_reaction` RPC (atomic add-or-remove). Emoji set expanded to 14: the original 12 plus ➕ / ➖, enforced by a DB check constraint kept in sync with `REACTION_EMOJIS` in `src/api/comments.js`.
- `useComments` joins reactions into the thread query; realtime extended with an unfiltered `comment_reactions` listener that invalidates only when the changed row's `comment_id` belongs to the currently-loaded thread (no `entity_id` column to filter on server-side).
- UI split in two, not combined: `ReactionTriggerButton` (opens the emoji grid) lives in the hover action-icon row next to edit/delete, open to every workspace member regardless of `canModify`; `ReactionPillsRow` renders *only* when a comment has ≥1 reaction (no reserved empty space on comments with none). Reacted-by-me state is a `ring-2 ring-indigo-400` on the existing muted pill, not a color swap; a lone reaction (count = 1) hides the number and shows just the emoji.
- Security: found and fixed a pre-existing gap while at it — `soft_delete_comment` (Phase 1) and the new `toggle_comment_reaction` both had stray `anon` EXECUTE grants; revoked, now `authenticated`-only.
- **Deliverable:** Discord-style reactions, shipped. Verified via direct DB toggle/constraint tests (no automated test file — see Known Gaps).

### Phase 6 — Notification deep-linking ✅
- `tg_notify_comment_added` appends `?comment={id}` to the notification link instead of pointing only at the entity page.
- `PostDetails` / `CampaignDetailPage` read that param on load and auto-open the comments panel / auto-switch to the Discussion tab.
- `CommentThread` scrolls the target comment into view and briefly highlights it (fades over ~1s), then strips the query param after 2.5s (`replace: true`, no history pollution). Handles the edge case where the linked comment was later soft-deleted (tombstone keeps the same `id` so scroll-to still lands in the right place).
- **Deliverable:** clicking a `comment_added` notification lands you on the actual comment, not just the top of the thread.

### Post-launch polish (rounds of UI iteration)
- Composer rebuilt again on `ScrollArea` for the feed (fixes a CSS overflow-axis quirk: `overflow-y-auto` alone was implicitly making the x-axis scrollable too whenever any child was a pixel too wide).
- Mentions of others render in indigo; mentions of *you* render in a distinct rose highlight (`MY_MENTION_CLASS`) — reuses the same "this needs your attention" rose already established by the notification bell.
- **Role badges (Crown/ChessKnight for owner/admin) were tried and explicitly reverted.** Two placement attempts (avatar corner overlay, then inline next to the name) both hit real problems — flex-stretch broke the corner overlay's positioning, and 12px chess-piece silhouettes aren't legible. On reflection, role badges add little value in a small-team workspace where everyone already knows who the owner/admins are, so they were dropped in favor of a simple **"You" pill** next to the author's own name (`isAuthor` check) — same pattern GitHub/Slack/Teams use, and it solves a real scanning problem role badges didn't.
- Timestamp switched from `date-fns`'s verbose `formatDistanceToNow` to a local compact formatter (`just now` / `5m ago` / `3h ago`), paired with `truncate` on the name and `shrink-0` on the timestamp/actions, to stop long names colliding with the timestamp in the narrow panel.
- Comments cascade-delete when their parent post or campaign is deleted, via `AFTER DELETE` triggers on `posts`/`campaigns` (their `entity_id` is polymorphic, so it can't be a real FK — this was a real gap, now closed and verified).

### Known Gaps (not urgent, noted for later)
- **No automated tests for Phases 5/6** (reactions, deep-linking) — verified manually via direct DB calls during development. Phases 1–4 have 12 passing tests in `src/tests/comments/`; reactions/deep-linking don't have equivalent coverage yet.
- **Touch/mobile discoverability** — react, edit, and delete all live behind `opacity-0 group-hover:opacity-100`, which doesn't work on devices with no hover state. Fine for desktop-only usage; would need a rethink if Tercero is ever used on tablets.
- No pagination on the comment feed — acceptable for the "contextual notes" use case this was scoped for; would need revisiting if any single thread ever grows into the hundreds.

### Deferred (future, not started)
- Nested replies / threading.
- Attachments (`note-media` bucket).
- Client visibility (future client portal).
- Resolve-thread / mark-as-addressed.
