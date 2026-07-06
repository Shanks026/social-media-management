# Feature: Workspace Chat

## Status
**✅ v1 shipped — Phases 1–6 complete.** Workspace-wide channel + 1:1 DMs, mentions, reactions, notification deep-linking, and unread tracking are all live. See [Deferred](#deferred-future-not-started) for what's intentionally out of scope.

## Problem
Team members in an agency workspace have no way to talk to each other inside Tercero for anything that isn't tied to a specific record. Contextual **comments** (`comments` table) cover "notes on this post/campaign," but a freeform "hey, quick thing about the app / an idea / a problem" conversation has nowhere to go — it happens in Slack, WhatsApp, or email, and the team loses the connection to the work they're in.

## Goal
Keep those discussions **inside the app**. A team member with a question, an idea, or a problem about the work should be able to raise it without tabbing out. This is a **stickiness / retention** feature, not a Slack replacement — we are deliberately not competing on chat features.

Two conceptual layers stay distinct:
- **Comments** = *contextual, async* — notes tied to a record (post/campaign). Already shipped.
- **Chat** = *freeform* — talking to the team or a person, tied to no record.

## Locked Decisions
| # | Decision | Rationale |
|---|---|---|
| 1 | **Two surfaces only: one workspace-wide channel (all members, auto-created) + 1:1 DMs.** No groups, no custom/topic channels, no per-client/per-task channels in v1. | Agencies using this are small teams. A single shared room + private DMs covers "discuss with the team" and "discuss with one person" without channel-membership management. |
| 2 | **Transport = invalidate-on-insert (the existing pattern), not `broadcast`.** Realtime is used purely as an invalidator (subscribe → `invalidateQueries` → refetch), exactly like `comments`, `notifications`, and `team.js`. | It's what the whole app already does, ships fastest, and fully satisfies the goal — nobody's judging sub-second latency here, they just don't want to leave the tab. `broadcast` is a clean drop-in upgrade later (see [Transport](#transport-note)) with **zero schema change**. |
| 3 | **Reactions: yes — a near-literal copy of the comment reaction system.** Same fixed `REACTION_EMOJIS` set, same atomic toggle-RPC approach, same pills-row-under-message UI, open to any workspace member. | Comments already solved this end-to-end ([comments.js:130](../../src/api/comments.js#L130), `ReactionPillsRow`/`ReactionTriggerButton` in [CommentThread.jsx](../../src/components/comments/CommentThread.jsx#L86-L162)). No new pattern to invent. |
| 4 | **Mentions: yes — the same @mention UX as comments.** Inline `@` autocomplete against `useTeamMembers()`, tracked `mentioned_uids[]`, highlighted on render via `splitMentions()`. | Reuse [mentions.js](../../src/lib/mentions.js) + the composer built on `InputGroup`. |
| 5 | **Notifications are mention-driven in the workspace channel, delivery-driven in DMs.** A new DM message notifies the other participant; a workspace-channel message notifies **only @mentioned users**, never all members. | Notifying every member on every workspace-channel message is spam and would make the feature feel broken. Mirrors the comment fan-out philosophy. |
| 6 | **Gated to Velocity & Quantum** via a new `chat` subscription flag. Ignite/Trial see it **visible-but-locked** (Lock icon + "Available on Velocity & Quantum" tooltip), never hidden. | User decision — don't give everything on Ignite. Uses the exact `requiresFlag` pattern already in [nav-main.jsx:160-177](../../src/components/sidebar/nav-main.jsx#L160-L177). See the `feature-gating` skill. |
| 7 | **Dedicated sidebar-swap layout.** Opening Chat closes the main app sidebar and opens a chat-specific sidebar (channel + DM list) in its place. The main sidebar cannot be reopened while inside Chat; it returns automatically when the user navigates to any non-chat route. | User's requested placement. See [Layout](#layout--the-sidebar-swap). |
| 8 | **shadcn `message` primitives for the message UI.** Adopt `@shadcn/message` (pure presentational divs — `Message`, `MessageAvatar`, `MessageContent`, `MessageHeader`, `MessageFooter`), ported to JSX like the rest of the project. | Purpose-built for exactly this, trivially portable. |
| 9 | **On hold (explicitly deferred, not "coming soon"):** read receipts, typing indicators, online/away presence, threads, search, per-channel mute/notification prefs, file attachments. | None are needed for the stated goal. Presence/typing specifically require `broadcast`/`presence` channel types this codebase doesn't use — out of scope for v1. |

## Design Principles (from codebase review)
- **Realtime is an invalidator, not a data pipe.** Subscribe to `chat_messages` filtered by `channel_id`; on any event, `invalidateQueries` for that channel's thread. Identical to [comments.js:24-59](../../src/api/comments.js#L24-L59) and [notifications.js:94-115](../../src/api/notifications.js#L94-L115).
- **Store the real author, not the workspace owner.** `author_user_id = auth.uid()` (the actual caller — the `created_by` rule from CLAUDE.md), so we can attribute who said what. Never `workspaceUserId`.
- **Author attribution infra already exists.** Reuse the `memberMap` pattern: `useTeamMembers()` → `{ user_id: { full_name, avatar_url } }` ([team.js:22](../../src/api/team.js#L22)). No new infra.
- **Fan-out lives where the state change lives — in the DB.** Message-insert notifications go through an `AFTER INSERT` trigger calling the existing `emit_notifications()` helper, consistent with `tg_notify_comment_added`. No client-side `notify()`.
- **Reactions have no `entity_id`.** Same as `comment_reactions`: subscribe unfiltered and check `payload.new/old.message_id` against the loaded thread client-side before invalidating (avoids denormalizing channel_id onto the reactions table just for filtering).

## Data Model

```
chat_channels
  id             uuid pk
  workspace_id   uuid          → owner UID (scopes to workspace)
  type           text          → 'workspace' | 'dm'  (check constraint)
  created_at     timestamptz   default now()
  -- exactly one type='workspace' row per workspace (partial unique index);
  -- DM channels are created on demand between two members.

chat_channel_members
  channel_id     uuid          → fk chat_channels.id, on delete cascade
  user_id        uuid          → member of this channel (auth.uid())
  last_read_at   timestamptz   → drives unread counts (nullable)
  created_at     timestamptz   default now()
  primary key (channel_id, user_id)
  -- workspace channel: every workspace member is a member.
  -- dm channel: exactly the two participants.

chat_messages
  id             uuid pk
  workspace_id   uuid          → owner UID (scopes to workspace)
  channel_id     uuid          → fk chat_channels.id, on delete cascade
  author_user_id uuid          → auth.uid() of the sender (attribution key)
  body           text
  mentioned_uids uuid[]        → users @mentioned (for fan-out)
  created_at     timestamptz   default now()
  updated_at     timestamptz
  deleted_at     timestamptz   → soft delete (nullable)

chat_message_reactions
  id             uuid pk
  message_id     uuid          → fk chat_messages.id, on delete cascade
  user_id        uuid          → auth.uid() of the reactor
  emoji          text          → one of REACTION_EMOJIS (check constraint, kept in sync)
  created_at     timestamptz   default now()
  unique (message_id, user_id, emoji)
```

**RLS**
- `chat_channels` SELECT: `workspace_id = get_my_agency_user_id()` **and** the caller is a row in `chat_channel_members` (so you can't read DMs you're not in). INSERT/UPDATE via RPC only.
- `chat_channel_members` SELECT: rows where `user_id = auth.uid()` OR channels the caller belongs to (for rendering DM participant). Managed by RPCs.
- `chat_messages` SELECT: caller is a member of `channel_id` (subquery against `chat_channel_members`). INSERT: `workspace_id = get_my_agency_user_id()`, `author_user_id = auth.uid()`, and caller is a channel member. UPDATE (edit): `author_user_id = auth.uid()`. Soft-delete: `author_user_id = auth.uid() OR is_workspace_admin()`.
- `chat_message_reactions`: SELECT via join to a message in a channel the caller belongs to; INSERT/DELETE `user_id = auth.uid()` only.

**Indexes:** `chat_messages (channel_id, created_at desc)` for the thread + pagination; `chat_channel_members (user_id)` for "my channels"; partial unique on `chat_channels (workspace_id) where type='workspace'`.

**Key RPCs** (SECURITY DEFINER where they cross the member set):
- `get_or_create_dm_channel(p_other_user_id)` → returns the channel id for the 1:1 between caller and the other user, creating it (+ both membership rows) if absent. Deterministic lookup so two people opening each other's DM converge on one channel.
- `ensure_workspace_channel()` → returns the workspace channel id, creating it + backfilling membership on first use. Also called when a member joins (hook into `join_team`) so new members get added.
- `toggle_chat_reaction(p_message_id, p_emoji)` → atomic add-or-remove (copy of `toggle_comment_reaction`).
- `mark_channel_read(p_channel_id)` → sets `last_read_at = now()` for the caller's membership row (drives unread badges).

## Fan-out (chat_message_added trigger)
`AFTER INSERT` on `chat_messages`, via `emit_notifications()` (minus the author):
- **DM channel** → the other participant. Type `chat_dm`, link to `/chat/dm/{channelId}`.
- **Workspace channel** → only `mentioned_uids`. Type `chat_mention`, link to `/chat`.

No fan-out on reactions (silent, same as comments).

## Layout — the sidebar swap
`AppShell` renders `<AppSidebar>` inside a `SidebarProvider` ([AppShell.jsx](../../src/components/misc/AppShell.jsx)). **Both sidebars are mounted at once while in Chat** — the main sidebar doesn't disappear, it collapses to its icon-only rail (still fully navigable to every other page) and `ChatSidebar` renders as a second, fixed-width panel beside it:

- `SidebarProvider`'s `open` state is lifted into `AppShell` (`sidebarOpen`) and controlled. An effect that fires only on the chat/non-chat **boundary** (not on every navigation) forces it `false` on entering `/chat` and back to `true` on leaving — a manually-collapsed sidebar elsewhere in the app is never fought.
- `onOpenChange` rejects any attempt to set `open=true` while `isChatRoute` is true, blocking the trigger/keyboard-shortcut reopen path. It unlocks automatically the moment the route changes away from `/chat`.
- `ChatSidebar` uses `<Sidebar collapsible="none">` — a plain fixed-width panel, deliberately *not* tied to the shared open/collapsed state (two `<Sidebar>`s sharing one `SidebarProvider`'s `state` would otherwise collapse together, which is exactly what we don't want).
- **Header stays visible** (no full-bleed takeover) — decided in favor of shell consistency over the `isSetupOpen`-style full-screen overlay precedent. `ChatPage` fills the remaining viewport height below the header (`h-[calc(100vh-4rem)]`) so a future scrollable thread has a fixed frame to work within.

`ChatSidebar` reuses `useTeamMembers()` for the DM list (one row per teammate, click → `get_or_create_dm_channel`) and shows the single workspace channel pinned at top, each with an unread dot/count from `last_read_at`. A "back to Tercero" arrow in its header navigates to `/dashboard`.

## Transport note
The "HTTP now, websocket later" question from the discussion: even the invalidate-on-insert pattern already rides a Supabase Realtime **websocket** — the difference is only what the handler does on a change (refetch the thread vs. append a pushed payload). Upgrading to `broadcast` later means changing the message-list handler to consume the pushed row instead of refetching — **same tables, same channel subscription, no migration**. So we ship on invalidate-on-insert and only revisit if it feels laggy in practice. Low regret.

## Subscription flag wiring
- Add a `chat` boolean column to `agency_subscriptions` (true for Trial/Velocity/Quantum — Trial mirrors Quantum, same as every other Velocity+ flag; false for Ignite).
- Surface it in `useSubscription()` return alongside the other flags: `chat: sub.chat ?? false` ([useSubscription.js:146-155](../../src/api/useSubscription.js#L146-L155)).
- Add the Chat nav item with `requiresFlag: 'chat'` — the existing lock/tooltip machinery handles the rest.
- Update `documentation/subscription-features.md` (canonical matrix) with the Chat row.
- Note: gating resolves by `workspaceUserId` (the owner's plan), so it applies uniformly to invited members — no per-member drift.

---

## Implementation Phases

### Phase 1 — Foundation (DB + API), no UI ✅ Complete
- [x] Migration: `chat_channels`, `chat_channel_members`, `chat_messages`, `chat_message_reactions` + indexes + RLS.
- [x] Add all four tables to the Realtime publication.
- [x] RPCs: `ensure_workspace_channel`, `get_or_create_dm_channel`, `toggle_chat_reaction`, `mark_channel_read`.
- [x] `AFTER INSERT` trigger `tg_notify_chat_message` → `emit_notifications()` per the fan-out rules.
- [x] `chat` flag: add column to `agency_subscriptions`, set per plan, expose in `useSubscription()`.
- [x] `src/api/chat.js`:
  - `useMyChannels()` — workspace channel + DMs the caller is in, with unread state.
  - `useChannelMessages(channelId)` — thread query + realtime invalidation (+ reactions join).
  - `sendMessage`, `editMessage`, `softDeleteMessage`, `toggleChatReaction`, `markChannelRead` mutations.
  - `getOrCreateDmChannel(otherUserId)`.
- **Deliverable:** channels/messages/reactions work via the API; testable, no UI. ✅

#### Implementation Notes
- **RLS recursion avoidance:** a naive self-referential policy on `chat_channel_members` (checking "is the caller a member of this row's channel" by subquerying the same table) hits Postgres's infinite-recursion guard. Fixed with two `STABLE SECURITY DEFINER` helper functions — `is_chat_channel_member(channel_id)` and `is_chat_message_channel_member(message_id)` — same technique `get_my_agency_user_id()` already uses. All four tables' SELECT policies route through these.
- **Two RPCs added beyond the Phase 1 bullet list, both required by decisions already locked earlier in this doc, not scope creep:**
  - `soft_delete_chat_message(p_message_id)` — the documented RLS rule ("author OR admin can soft-delete") can't be expressed as a plain UPDATE policy; needs a `SECURITY DEFINER` RPC exactly like `soft_delete_comment`.
  - `get_my_chat_channels()` — the documented `useMyChannels()` shape ("with unread state" + DM-partner resolution) is a genuine aggregation (per-channel unread count needs a different threshold per row, and identifying "who's the other DM participant" needs a join), so it follows the existing "RPC for complex aggregation" pattern (`get_team_members`, `get_campaigns_with_post_summary`). It's `SECURITY INVOKER` (default) — the caller's own RLS already permits everything it reads, no elevation needed.
- **`join_team` was modified** (one line: `perform ensure_workspace_channel();` after the membership insert) so new members are auto-added to the workspace channel on joining, per the locked design.
- **Trial plan bug caught during backfill:** the initial `chat` backfill only set `velocity`/`quantum` to `true`, missing that Trial mirrors Quantum for every other Velocity+ flag in `documentation/subscription-features.md` (`calendar_export`, `finance_accrual`, etc.). Corrected before finishing the phase; `documentation/subscription-features.md` updated (Teams table, DB Flag Values, all four seed SQL blocks) to keep `chat` consistent with that precedent.
- **Trigger function locked down:** `tg_notify_chat_message()` initially kept Postgres's default PUBLIC execute grant, which the security advisor flagged as directly callable via `/rest/v1/rpc/...` by `anon`. Revoked all execute (matching `emit_notifications`) — trigger functions don't need direct callability.
- Security advisors re-run after both fixes: only the two RLS-helper functions (`is_chat_channel_member`, `is_chat_message_channel_member`) remain flagged as anon/authenticated-executable, which mirrors the accepted, pre-existing pattern for `get_my_agency_user_id()`/`is_workspace_admin()` (also unrevoked, also just return a boolean/uuid derived from `auth.uid()` — not a data leak on their own).

### Phase 2 — Sidebar swap + routing + gating ✅ Complete
- [x] `/chat` route, gated via a `ChatRoute` wrapper that redirects to `/dashboard` when `sub.chat` is false — the same pattern `ReportsRoute`/`SubscriptionsRoute` already use, not a new mechanism.
- [x] Chat nav item with `requiresFlag: 'chat'` in `nav-main.jsx`, placed right after Dashboard — visible-but-locked (Lock icon) on Ignite via the existing nav machinery, no changes needed there.
- [x] `AppShell`: main sidebar forced to icon-rail + locked while in `/chat`, restored on leaving; `ChatSidebar` mounted alongside it (see Layout section above — this is a correction from the original swap-based plan, made after a manual test showed the main sidebar should stay reachable, not disappear).
- [x] `ChatSidebar`: pinned workspace channel + DM list from `useTeamMembers()`, unread indicators, back-to-dashboard arrow.
- **Deliverable:** you can open Chat, see the main sidebar collapse to icons while `ChatSidebar` appears beside it, and pick a channel/DM (empty message pane is fine). ✅

#### Implementation Notes
- **Sidebar behavior corrected mid-phase after manual testing.** The original plan called for `ChatSidebar` to *replace* `AppSidebar` outright. Manual testing showed this fully removed the ability to navigate to other pages while in Chat, which wasn't the intent — the actual requirement (confirmed by the user) was for the main sidebar to persist in its collapsed icon-rail form (still clickable for navigation) alongside `ChatSidebar`, not disappear. Implemented via a controlled `SidebarProvider.open` lifted into `AppShell`, forced/locked by route, plus `ChatSidebar` opting out of the shared collapse state via `collapsible="none"`.
- **Owner-in-DM-list gap closed with an isolated fetch (follow-up, per user decision).** Shipped Phase 2 initially with a known gap — members couldn't see/DM the owner via `useTeamMembers()`, based on the (incorrect, see below) assumption that owners never have an `agency_members` row. Resolved by adding `get_my_workspace_owner()` (new `SECURITY DEFINER` RPC, `authenticated`-only, derives the workspace from the caller's own `get_my_agency_user_id()` — no caller-supplied workspace id to mistrust) and a matching `useWorkspaceOwner()` hook in `src/api/chat.js`. Deliberately isolated from `get_team_members` rather than extending it — zero risk to its other consumers (Tasks, Notifications, Team settings).
- **Caught via a manual-test screenshot: the owner appeared twice.** Querying the actual data showed why — on this workspace, the owner (`agency_subscriptions.user_id`) *also* has a self-referential `agency_members` row (`agency_user_id = member_user_id`, `system_role = 'owner'`), so `useTeamMembers()` already returned her once. My initial merge logic added the `useWorkspaceOwner()` fetch unconditionally, duplicating her. Fixed by de-duplicating: the synthetic owner entry is only added when their id isn't already present in the `useTeamMembers()` result, so `ChatSidebar` renders exactly one row per person regardless of which shape a given workspace's data happens to be in (older workspaces without an owner self-row vs. newer ones with it).
- **Unrelated pre-existing issue noticed in passing, not fixed here:** `get_team_members(p_agency_user_id)` trusts its caller-supplied workspace id with no check that the caller actually belongs to that workspace — in principle any authenticated user could pass a different workspace's owner UID and read that workspace's member list (names, emails, avatars). Flagged to the user; out of scope for this feature since it touches shared infra used well beyond chat.
- `/chat` gating redirects to `/dashboard` rather than rendering an inline "locked" page — matches `ReportsRoute`/`SubscriptionsRoute`, not the speculative "rendered even when locked" wording from the original Phase 2 bullet (written before the actual route-gating precedent was checked against the codebase).

### Phase 3 — Message thread UI ✅ Complete
- [x] Port `@shadcn/message` primitives into `src/components/ui/message.jsx` (JSX).
- [x] `ChatThread` component: message list (own messages `align="end"`), author avatar/name via `memberMap`, compact relative timestamps, composer on `InputGroup` (mirrors the comment composer), send/edit/soft-delete, skeletons + empty state.
- [x] Realtime invalidation live; author-side immediate `invalidateQueries` (don't rely solely on the realtime round-trip — the lesson from comments Phase 4).
- [x] **Decision made: hand-rolled scroll-to-bottom, not `@shadcn/message-scroller`.** See Implementation Notes.
- **Deliverable:** working workspace-channel chat, sending/receiving live. ✅

#### Implementation Notes
- **`@shadcn/message-scroller` decision: no.** Went with a plain `useEffect` that calls `scrollIntoView({ block: 'end' })` on a bottom sentinel div whenever the channel or message count changes, inside the existing `ScrollArea` component (same one `CommentThread` already uses — no new dependency). Reasoning: chat threads here have no pagination yet and are small, so "always scroll to latest" is the simplest correct behavior; `@shadcn/message-scroller` would have pulled in a new runtime dependency (`@shadcn/react`, not copy-paste source like normal shadcn components) for a "stick unless the user scrolled up" refinement that isn't needed yet. Revisit if/when pagination lands and threads get long.
- **`formatCompactTimeAgo` promoted to a shared helper.** It only existed, unexported, inside `CommentThread.jsx`. Since `ChatThread` needed the identical behavior, moved it to `src/lib/helper.js` (alongside `formatDate`/`formatFileSize`) and updated `CommentThread` to import it — a one-function extraction, not a broader refactor, and it removes what would otherwise have been a second copy of the same logic.
- **Author lookup consolidated into one hook, not copied a third time.** `ChatThread` needs the same "teammates + owner, de-duplicated" member map `ChatSidebar` already built in Phase 2 — copying that merge logic again risked exactly the kind of drift that caused the Phase 2 duplicate-owner bug. Extracted it into `useMemberMap()` in `src/api/chat.js` (composes `useTeamMembers` + `useWorkspaceOwner` + the current user), and refactored `ChatSidebar` to use it too. One place now owns "who can I see in chat."
- **`message.jsx` port is intentionally partial.** Only `Message`, `MessageAvatar`, `MessageContent`, `MessageHeader` were ported — `MessageFooter` and the avatar/footer overlap CSS hook (`group-has-data-[slot=message-footer]/message:-translate-y-8`) were dropped since nothing in this phase uses a footer. Add them back if a later phase needs that layout.
- Composer supports `⌘/Ctrl + Enter` to send, matches the comment composer's convention. Mentions and reactions are deliberately absent — those are Phase 5 and Phase 6.

### Phase 4 — DMs ✅ Complete
- [x] DM open flow from `ChatSidebar` → `getOrCreateDmChannel` → thread.
- [x] DM notification fan-out verified (`chat_dm` → other participant).
- **Deliverable:** 1:1 DMs alongside the workspace channel. ✅

#### Implementation Notes
- **No new app code needed.** `ChatSidebar.openDm()`, `ChatThread`, and `ChatPage`'s header were all built channel-agnostic during Phases 2–3 — they already work identically for the workspace channel and any DM. This phase was pure end-to-end verification, not construction.
- **Verified at the DB level** with rolled-back/cleaned-up smoke tests impersonating two real workspace users (Ryan, a member, and Claire, the owner) via `SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claim.sub = '<uuid>'` — the same technique the Notifications feature used for its own Phase 3 verification:
  - `get_or_create_dm_channel` is idempotent (calling it twice as Ryan returns the same channel id) **and** bidirectionally convergent (Claire opening a DM with Ryan lands on the exact same channel Ryan already opened with her).
  - RLS lets Ryan insert into the channel and lets Claire read it; `get_my_chat_channels()` correctly reports `unread_count: 1` for Claire after Ryan's message.
  - The `chat_dm` notification fan-out fires correctly.
- **False alarm during verification, worth recording:** the first pass showed 0 notifications for Claire and looked like a real bug. It wasn't — the test queried `notifications` *while still impersonating Ryan* (before switching identity to Claire later in the script), and `notifications: recipient can select` (`recipient_user_id = auth.uid()`) correctly hid Claire's row from Ryan's own query. The trigger (`SECURITY DEFINER`, owned by `postgres` with `BYPASSRLS`) had already inserted it correctly — confirmed once the check ran as Claire instead. No code changed as a result; this is a note on how to test this correctly next time, not a fix.
- All test data (messages, the notification, the DM channel created during debugging) was committed briefly to make a trigger-internal debug log observable, then deleted immediately after — verified zero residue in `chat_messages`, `notifications`, and the temporary `chat_debug_log` table (dropped).

### Phase 5 — Mentions + notification deep-linking ✅ Complete
- [x] `@` autocomplete in the composer (reuse `mentions.js` + the comment composer machinery); `mentioned_uids` tracked and highlighted on render (`MENTION_CLASS` / `MY_MENTION_CLASS`).
- [x] Workspace-channel messages fan out `chat_mention` only to mentioned users.
- [x] Clicking a chat notification lands in the right channel and scrolls to the message.
- **Deliverable:** mentions work; notifications are non-spammy and deep-link correctly. ✅

#### Implementation Notes
- **Mention detection/styling promoted to `src/lib/mentions.js` instead of copied a second time.** `detectMention()`, `MENTION_CLASS`, and `MY_MENTION_CLASS` existed only as unexported locals in `CommentThread.jsx`. Moved them into the shared `mentions.js` module (alongside `splitMentions`, already shared) and updated `CommentThread` to import from there — one definition, not two that could drift, continuing the pattern from Phases 2–3 (`useMemberMap`, `formatCompactTimeAgo`).
- **New `OWN_MENTION_CLASS` for messages you sent.** `MENTION_CLASS`/`MY_MENTION_CLASS` assume a neutral `bg-muted` background (comments, and other people's chat bubbles). Your own bubble is the solid `bg-chat-self` color, so an indigo/rose pill would clash — own-message mentions use a lighter `bg-white/20` overlay pill instead, regardless of who's mentioned (distinguishing "mentioned me" from "mentioned someone else" matters for messages *others* send, not your own).
- **Deep-link scroll-to-message implemented, not just channel selection** (the "if cheap" part of the deliverable) — `ChatThread` now reads `?message=<id>` the same way `CommentThread` reads `?comment=<id>`: scroll into view, highlight for ~2.5s, strip the param. Each message row got a stable `id="chat-message-<id>"` for this.
- **Found and fixed a real gap from Phases 1 and 4, not new to this phase:** `tg_notify_chat_message()`'s notification `link` was hardcoded to a bare `/chat` for *every* chat notification — DMs included. Clicking any chat notification silently landed on the auto-selected workspace channel (per Phase 3's default-select), never the actual DM or the specific message. Fixed by building `v_link := '/chat?channel=' || new.channel_id || '&message=' || new.id` once and using it for both the DM and mention branches. This was verifiable but not verified in Phase 4 — that pass checked fan-out *correctness* (right recipient, right type) but not the *link content*, which is where the bug was hiding.
- **Verified at the DB level** (same rolled-back/committed-and-cleaned-up technique as Phase 4): a workspace-channel message mentioning exactly one of four other members produced exactly one `chat_mention` notification, to exactly that member, with a `link` containing the correct `channel` and `message` ids. Confirms the "only mentioned users, never all members" rule holds and the deep link is well-formed.

### Phase 6 — Reactions + unread polish ✅ Complete
- [x] `chat_message_reactions` UI: `ReactionTriggerButton` + `ReactionPillsRow` (near-literal copy of comments', pointed at `toggleChatReaction`/`CHAT_REACTION_EMOJIS`). Realtime listener from Phase 1 (`useChannelMessages`) already handled invalidation — no wiring needed here.
- [x] Unread badges: `mark_channel_read` on channel open **and** kept fresh while the channel is actively open (see notes) — unread dot/count in `ChatSidebar`. Main-sidebar Chat nav badge stayed out of scope (optional per this doc, not requested).
- [x] Tests: fan-out (verified Phases 4–5), RLS (can't read a DM you're not in — verified below), reaction toggle (verified below), unread transitions.
- **Deliverable:** production-ready v1. ✅

#### Implementation Notes
- **Unread badge could reappear while you were actively looking at the conversation — fixed.** `mark_channel_read` was previously called only at the moment `ChatSidebar` was clicked. A message arriving *after* that (while the conversation was still open) would flip the unread badge back on, since nothing re-marked it read. `ChatThread` now also calls `markChannelRead` whenever its message count changes while mounted, not just on open — so the badge stays cleared for whichever conversation you're actually looking at. `ChatSidebar`'s click-time call is kept too, purely for the instant "clears the moment I click" feel before the thread even loads.
- **Real bug found and fixed: the edit button was visible (and always-failing) for admins on other people's messages.** `canModify` conflated two different questions — "can edit" and "can delete" — as one flag (`isOwn || isAdmin`), which the Pencil/Trash icons both read. Since the DB's `chat_messages: author can update` RLS policy is author-only with **no** admin override (unlike delete), an admin clicking Edit on someone else's message would always hit a silent permission-denied failure. Split into two props: `canModify` (author-only, gates Edit) and `canDelete` (author, or admin **scoped to the workspace channel**, gates Delete) — matching the `soft_delete_comment` precedent's actual rule, which this had drifted from.
- **Real privacy gap found and fixed: admins could delete messages in DMs they weren't even part of.** `soft_delete_chat_message`'s admin-override checked only `is_workspace_admin()`, with no check that the admin was a member of the *specific* channel — and since the RPC is `SECURITY DEFINER`/`BYPASSRLS`, it could reach into a private 1:1 DM between two other people, something RLS would normally block that admin from even reading. Fixed by scoping the admin-override to `channel type = 'workspace'` only; DM messages can now only be deleted by their own author, regardless of role. This wasn't a deliberate decision anyone made — it was inherited unmodified from `soft_delete_comment`, where the "public room" assumption (comments live on shared posts/campaigns, not private 1:1s) holds but doesn't transfer to DMs.
- **Verified at the DB level** (same rolled-back-transaction technique as Phases 4–5, impersonating real users):
  - Admin delete-override: blocked (`access_denied`) against a DM the admin isn't part of; succeeds against a workspace-channel message.
  - RLS: a non-participant admin sees zero rows for both the DM's `chat_channels` row and its `chat_messages` row — fully invisible, not just delete-blocked.
  - Reactions: a non-member is blocked from reacting to a message in a DM they can't see (`access_denied`); a real member's toggle correctly adds then removes the same reaction on repeat calls.
- **Reactions UI rebuilt on shadcn's actual `Bubble`/`BubbleReactions`, not a copied comment-style pills row (correction after initial build).** The very first pass at this phase reused `CommentThread`'s standalone `ReactionPillsRow` pattern (a wrapping row of pills below the message text) — but comments deliberately rejected shadcn's `Bubble` family for this ("`BubbleReactions` is a subcomponent of the chat-bubble family... adopting it means adopting `Bubble`'s two-party align/variant chat-shell too" — see `feature-collaboration.md`). That rejection was about comments not wanting a bubble *shape* at all. Chat already *is* a bubble UI (`Message`/`align=start|end`, colored own-message bubbles), so the reasoning that ruled `Bubble` out for comments doesn't apply here — it's the natural fit. Ported `src/components/ui/bubble.jsx` (`Bubble`, `BubbleContent`, `BubbleReactions`) and rebuilt `ChatMessageRow`'s bubble on it; reactions now render inside `BubbleReactions`, which overlaps the bubble's bottom edge (shadcn's intended treatment) instead of sitting in a separate row underneath.
- **One real wiring problem found while integrating `Bubble`:** its built-in `variant`s color `BubbleContent` via a compound descendant+attribute selector (`*:data-[slot=bubble-content]:bg-primary`), which has *higher* CSS specificity than a plain utility class passed directly to `BubbleContent` — so naively passing `className="bg-chat-self"` to `BubbleContent` would have silently lost to the variant's own background rule. Fixed by adding a `self` variant to the `bubble.jsx` port (same pattern as the existing `default`/`muted`/`outline`/etc. branches, just pointed at `--chat-self`) — a real variant branch, not a className override, so it doesn't fight the specificity of the others. `muted` (already built in) is used as-is for other people's messages.

---

## Deferred (future, not started)
- **`broadcast` transport upgrade** — only if invalidate-on-insert feels laggy in practice. No schema change.
- **Presence + typing indicators** — needs Realtime `presence`/`broadcast`; new pattern.
- **Per-client / per-task channels** — the real long-term differentiator (chat that lives next to the work), once the base transport + notification plumbing exists. This is where contextual chat beats Slack rather than competing with it.
- **Threads, full-text search, per-channel mute/notification preferences** — where "just add chat" balloons into a multi-quarter product. Kept out on purpose.
- **File attachments** — a new bucket (the `note-media`/`post-media` buckets are the precedent) if added.
- **Group DMs / custom channels.**

## Open Questions (non-blocking)
- Header-visible vs. full-bleed chat layout (decide Phase 2).
- Does DM history survive a member being removed from the workspace? (Lean: soft-keep messages, drop the removed user's membership row so it disappears from their list.)
- Should client-facing/external users ever see any of this? (Lean: strictly internal, same as comments.)
- Message history pagination — cursor-based on `(channel_id, created_at desc)`; likely fine to defer until a thread grows large, same call comments made.
