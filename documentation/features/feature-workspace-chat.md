# Feature: Workspace Chat (Idea)

## Status
Idea / not scoped. No phases, no implementation plan — this doc exists to capture the thinking so it can be picked up later.

## Purpose

Team members in an agency workspace currently have no way to talk to each other inside Tercero. Anything that isn't tied to a specific record (a post, a campaign, a task) has nowhere to go — it happens in Slack, WhatsApp, or email, outside the app entirely.

Tercero already has a form of this: the **comments** system (`comments` table — `entity_type` `post|campaign`, `mentioned_uids[]`, soft-delete, fan-out via `tg_notify_comment_added`). That's *contextual, async* discussion tied to a record. Workspace chat would be something different — *freeform, real-time* conversation not tied to any one record. The two should stay conceptually distinct: comments are "notes on this thing," chat is "talking to this person/team."

## Why this is a bigger lift than it looks

Every other realtime-ish thing in Tercero (notifications bell, team member list, `comments`) uses the same shape: a row is inserted, a DB trigger fans out, Supabase Realtime is used purely as an **invalidator** (subscribe → `invalidateQueries` → refetch). That's fine when "a few seconds of staleness" is invisible.

Chat breaks that assumption. Users expect near-instant delivery, message ordering, typing indicators, and presence (who's online). That requires actually using Supabase Realtime's `broadcast` and `presence` channel types, not just table-change invalidation — a pattern nothing else in the app uses today.

## The honest competitive question

Agencies almost certainly already have Slack or Teams for internal chat. Pitching "team chat" as a Slack replacement is a weak position — Tercero won't out-Slack Slack, and switching costs for an established team chat habit are high.

The more defensible angle is **context**: chat that lives next to the work — a thread tied to a client or a task — so a team doesn't have to tab out to Slack and lose the connection to the record they're discussing. That's a different product than "general workspace chat," and it's where this would actually differentiate rather than compete head-on.

## How Slack does it (for reference)

| Capability | Slack behavior |
|---|---|
| Channels | Persistent topic rooms, public or private, membership-based |
| DMs | 1:1 and small-group private threads |
| Delivery | Websocket push; typing indicators, read receipts, online/away/offline presence |
| Threads | Replies nested under a parent message, kept out of the main channel view |
| Reactions | Emoji on any message |
| Mentions | `@user`, `@channel`, `@here`, each with different notification behavior |
| History & search | Full-text search across all channels the user can see; infinite scroll back |
| Unread/mute | Per-channel unread counts, mute, notification preferences |
| Files | Inline file/media sharing |
| Editing | Message edit/delete with edit history |

Most of the scope risk in a chat feature lives in search, per-channel notification preferences, and threads — those are where "just add chat" quietly turns into a multi-quarter chat product.

## What "leveling with it" would actually require

1. **Real transport layer** — Supabase Realtime `broadcast` (message delivery) + `presence` (online status), as a new pattern alongside the existing invalidate-only usage.
2. **New tables** — something like `chat_channels`, `chat_channel_members`, `chat_messages`, workspace-scoped (`workspace_id`, the same owner-UID scoping as everything else), reusing the `mentioned_uids[]` / soft-delete conventions from `comments`.
3. **Pagination** — cursor-based message history; nothing else in Tercero needs this since comment threads are short.
4. **Notification integration** — chat needs per-channel mute/unread state, which the existing `emit_notifications()` helper and `notifications` table don't track today.
5. **Presence UI** — online indicator on team member avatars, typing indicator — new UI pattern.
6. **Storage** — a new bucket if inline file sharing is in scope.

## Direction, if pursued

Contextual team chat, not a Slack clone:
- A single workspace-wide channel (everyone in the agency) plus 1:1 DMs between team members, as the smallest useful slice.
- Per-client or per-task channels as the actual differentiator, once the base transport/notification work exists.
- Reactions, threads, and search deliberately deferred — they're where scope balloons, and the value of contextual chat doesn't depend on having them.

## Open questions

- Is this a paid-tier feature (`useSubscription()` flag) or available to everyone?
- Does DM history need to survive a team member being removed from the workspace?
- Should client-facing users (external) ever see any of this, or is it strictly internal-only?
