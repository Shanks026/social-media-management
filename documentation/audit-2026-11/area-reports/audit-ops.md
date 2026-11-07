# Cleanup / Maintainability Audit — Dashboard, Tasks, Notes, Meetings, Chat, Notifications

Scope: cleanup and maintainability only (no security analysis). No files were edited. Every "unused" claim below was checked with grep across `src/` (tests excluded unless noted).

Legend: **REMOVE** · **CAN STAY** · **NEEDS IMPROVEMENT**

---

## 1. Dashboard (`src/pages/dashboard/`)

| # | Verdict | Finding |
|---|---|---|
| D1 | **REMOVE** | `src/pages/dashboard/DashboardScheduledPosts.jsx` (162 lines) is dead. Nothing imports it, and `Dashboard.jsx` renders `DashboardWeekTimeline` in that slot. It also carries its own direct `supabase.from('clients')` query (`:86-93`). |
| D2 | **NEEDS IMPROVEMENT** | `DashboardMeetingsNotes.jsx:71-80`: "Mark meeting done" calls **`deleteMeeting`**, which permanently deletes the meeting. `src/api/meetings.js:158` `markMeetingCompleted` exists and is what `MeetingsPage` / `meetings/MeetingCard` use. The same delete-as-done pattern is copied into `OverviewTab.jsx:265-267`, `calendar/DayDetailDialog.jsx:70-71` and `components/deliverables/MeetingCard.jsx:19-26` (that one toasts "Meeting marked as done" after a delete). So "done" has two different meanings in the app (see M1). |
| D3 | **NEEDS IMPROVEMENT** | Direct `supabase` calls in dashboard components, against the "everything through `src/api/`" rule:<br>• `DashboardMeetingsNotes.jsx:41-53`: an ad-hoc clients map that duplicates `useClients()`. It also **swallows the error** (`const { data } = await ...` with no `error` check).<br>• `DashboardMeetingsNotes.jsx:56-68`: an upcoming-meetings query that duplicates `fetchUpcomingMeetings` minus `clientId`. It fetches *all* future meetings to show 3, and uses `staleTime: 0` + `refetchOnWindowFocus`, which overrides the app defaults.<br>• `DashboardInvoiceTable.jsx:20-27`: a clients query under key `['clients-list']`. That prefix-overlaps `useClients()`'s `['clients-list', workspaceUserId]` but returns a different shape. It also swallows errors. Use `useClients()` instead.<br>• `DashboardWeekTimeline.jsx:94-104`: a direct meetings query. |
| D4 | **NEEDS IMPROVEMENT** | `DashboardWeekTimeline.jsx` (304 lines) and `pages/clients/clientSections/ClientWeekTimeline.jsx` (274 lines) are largely the same component (~166 diff lines total, and both use direct supabase). Extract one prop-driven `WeekTimeline` (the same pattern as `WorkflowHealth.jsx`). |
| D5 | **NEEDS IMPROVEMENT** | The name `DashboardMeetingsNotes` is stale. The widget shows **Tasks** + Meetings, with no notes at all, yet the tab value is still `'notes'` (`:34`, `TabsTrigger value="notes"`). Rename it to `DashboardTasksMeetings` and the tab to `tasks`. |
| D6 | **NEEDS IMPROVEMENT** | `DashboardMeetingsNotes.jsx:84-100` builds a 4th hand-rolled `memberMap`/`campaignMap`. `src/components/tasks/useTaskLookups.js` already exists for exactly this (see T2). |
| D7 | **NEEDS IMPROVEMENT** | No dashboard widget handles query errors. None of the 11 widgets reads `error`/`isError`. A failed fetch renders as an empty state ("No clients yet", zero KPIs), which violates component-conventions.md "Loading & Error States". |
| D8 | **CAN STAY** (simplify) | `AgencyHealthBar.jsx:27,52,74` re-checks `usePermissions().finance`, but `Dashboard.jsx:107` only mounts it when `finance` is true. The `[1]` skeleton branch and the non-finance path are unreachable. Harmless, but it can be dropped. |
| D9 | **CAN STAY** (simplify) | `Dashboard.jsx:21-71`: `TrialExpiryBanner` and `SubExpiryBanner` are near-identical (same markup, different copy). They could be one `ExpiryBanner({ message, cta })`. |
| D10 | **NEEDS IMPROVEMENT** | Query keys without a workspace scope: `['clients-pipeline-dashboard']` (`ClientHealthGrid.jsx:53`, `api/clients.js:46`), `['meetings','dashboard-upcoming']`, and `['clients-list']`. This is inconsistent with api-conventions.md (`['domain-list', userId]`) and can serve the previous account's cache after switching accounts in one tab. |

---

## 2. Tasks (`TasksAndReminders.jsx`, `src/pages/tasks/`, `src/components/tasks/`, `src/api/tasks.js`)

| # | Verdict | Finding |
|---|---|---|
| T1 | **NEEDS IMPROVEMENT** | `src/pages/TasksAndReminders.jsx` is **1,044 lines**. It holds `ColHeader`, `SortableColHeader`, `TasksGroup` (:156), `DraggableCard` (:181), `KanbanColumn` (:210), `KanbanTasksView` (:273), `TaskTableRowSkeleton`, `TasksTableView` (:388, ~200 lines) and the page (:595). Split the three views into `src/pages/tasks/views/`. |
| T2 | **NEEDS IMPROVEMENT** | `useTaskLookups()` (`src/components/tasks/useTaskLookups.js`) was built as the single source of `clientMap`/`campaignMap`/`memberMap`, but only `TaskDetailPage`/`TaskWatchers` use it. The same merge logic (team + removed members + self fallback) is re-implemented verbatim in `TasksAndReminders.jsx:651-697`, `TasksTab.jsx:49-86` and `DashboardMeetingsNotes.jsx:84-100`. The copies have already drifted: only `useTaskLookups` merges `job_roles`, and the dashboard copy omits removed members. |
| T3 | **NEEDS IMPROVEMENT** | `CreateTaskDialog.jsx` (484 lines) and `EditTaskDialog.jsx` (468 lines) are about 85% identical. The diff is mostly initial state and the mutation. Each defines its own `PRIORITY_CONFIG` array (`Create:37`, `Edit:35`), and both differ from the canonical `PRIORITY_CONFIG` in `TaskCard.jsx:90`: for example HIGH dot is `bg-amber-400` in the dialogs vs `bg-amber-500` on cards. Extract a `TaskFormDialog({ mode, task })` and derive the priority options from the single map. Neither dialog uses react-hook-form + zod, which component-conventions.md requires. |
| T4 | **NEEDS IMPROVEMENT** | Move `STATUS_CONFIG`/`PRIORITY_CONFIG`/`STATUS_DOT`/`StatusChip` out of `TaskCard.jsx:68-127` into `src/lib/task-statuses.js`, mirroring `src/lib/post-statuses.js`. `NotificationBell.jsx` and `TasksAndReminders.jsx:125-126` import a 504-line card component just for constants. |
| T5 | **NEEDS IMPROVEMENT** | N+1 queries: every `TaskCard` runs its own `useQuery(['task-deliverables', task.id])` (`TaskCard.jsx:234-238`). Inside, `fetchTaskDeliverables` (`api/tasks.js:105-110`) does one `task_posts` query plus one `fetchPostSummary` per linked post. A kanban with 50 cards means 50 or more round trips on page load. Batch these: one `task_posts` select for the visible task ids, or embed the join in `useTasks`. |
| T6 | **NEEDS IMPROVEMENT** | `EditTaskDialog.jsx:~125` seeds `due_at` with `new Date(task.due_at).toISOString().slice(0,16)`. That is a **UTC** string fed to a local `datetime-local` input, so for any non-UTC user the due time shifts by their offset on every edit and save. |
| T7 | **NEEDS IMPROVEMENT** | `TasksAndReminders` (:708, :944) only reads `isLoading`. A `useTasks` error renders the "no tasks" Empty state. |
| T8 | **NEEDS IMPROVEMENT** | Naming drift: the file and component are `TasksAndReminders`, the UI says "Tasks & Todos" (`nav-main.jsx:113`, `TaskDetailPage.jsx:142`), and there is no reminders concept on the page. Rename to `TasksPage.jsx`. "Reminders" actually live elsewhere as client-side toasts (see Overlap section). |
| T9 | **CAN STAY** | The legacy `?task=<id>` redirect (`TasksAndReminders.jsx:710-715`) is small and protects old bookmarks. DB triggers never emitted `?task=` (no hit in `supabase/migrations`), and notification rows expire after 30 days, so it can be dropped whenever convenient. |
| T10 | **NEEDS IMPROVEMENT** | `OverviewTab.jsx:178` (client detail) names the `useTasks()` result `notes`, and runs a localStorage-backed "Reminder: X is due in N hours" toast (`:180-213`, key `notifiedNoteIds`). These are leftovers from when tasks were called notes. Rename, and move the toast into a hook beside `useMeetingReminders`, or drop it (see Overlap). |
| T11 | **NEEDS IMPROVEMENT** — edge function flow | `send-task-assignment-email` is fired client-side and fire-and-forget by `notifyAssignee()` (`api/tasks.js:172-176`), and only from `createTask` (:72) and `reassignTask` (:159). **`updateTask` does not call it**, yet `EditTaskDialog.jsx:214` lets a creator change `assigned_to`. A reassignment through the Edit dialog therefore sends no email, while one through the detail-page rail does. Options: route the dialog's assignee change through `reassignTask`, call `notifyAssignee` when `assigned_to` changes, or move the trigger DB-side to match the "fan-out lives in the DB" rule. The function is also missing from CLAUDE.md's edge-function list. |
| T12 | **CAN STAY** | `src/api/tasks.js` exports are all used (verified each). `fetchTaskPostIds` is used by `EditTaskDialog`; `reassignTask` is used by `TaskDetailPage`. |
| T13 | **NEEDS IMPROVEMENT** | There are no tests for tasks, chat, notifications or meetings. `src/tests/` only has `campaigns/` and `comments/`. |

---

## 3. Notes (`Notes.jsx`, `NoteEditorPage.jsx`, `src/components/notes/`, `agencyNotes`/`noteTags`/`noteShares`/`noteMedia` APIs)

This is the cleanest feature in scope. It has proper loading, error and empty states in both pages (`Notes.jsx:302-311`, `NoteEditorPage.jsx:270-284`), no direct supabase calls in components, and a normalized API (`agencyNotes.js:11-19`).

| # | Verdict | Finding |
|---|---|---|
| N1 | **REMOVE** (minor) | `shareNote()` (`api/noteShares.js:25-27`) is unused. Its only reference is a code comment in `NoteVisibilityToggle.jsx:12`. Callers use `shareNoteWithMany`. |
| N2 | **NEEDS IMPROVEMENT** | `NoteEditorPage.jsx:179-186`: the unmount cleanup `clearTimeout(saveTimer.current)` **discards** a pending debounced save (600 ms, `:194`). The flush only exists in `handleBack` (`:230-245`), so leaving through the sidebar, a header link or a browser back within 600 ms of typing drops the last edit. Flush `valuesRef.current` on unmount when `dirtyRef.current` is set, rather than clearing the timer. |
| N3 | **CAN STAY** | All `src/components/notes/*` files and `editor/*` are imported somewhere. `TagPicker`/`TagPill` are also reused by `team/JobRolePicker.jsx` and `JobRolePill.jsx`. That reuse is good, but they now live under `notes/` while being generic; consider moving them to `components/ui/` or `components/shared/`. |
| N4 | **NEEDS IMPROVEMENT** (docs) | `.claude/rules/routing.md` still maps `/operations/notes → NotesAndReminders`, but the component is `Notes`. The file also omits `/tasks`, `/tasks/:taskId`, `/operations/notes/:noteId` and `/chat`. No feature doc exists for Notes (sharing, tags, visibility). |
| N5 | **CAN STAY** | `NoteEditorPage.jsx` (490 lines) is large but cohesive (an editor shell with auto-save). It is not a split priority. |

---

## 4. Meetings (`MeetingsPage.jsx`, `src/components/meetings/`, `src/components/MeetingRow.jsx`, `CreateMeetingDialog.jsx`, `src/api/meetings.js`)

| # | Verdict | Finding |
|---|---|---|
| M1 | **NEEDS IMPROVEMENT** (highest in this area) | "Done" has two meanings. `MeetingsPage` and `components/meetings/MeetingCard.jsx:68-77` set `completed_at` through `markMeetingCompleted`/`unmarkMeetingCompleted`. The dashboard, client overview, calendar day dialog and calendar `deliverables/MeetingCard` **delete** the row instead (see D2). The completed-meetings tab in `MeetingsPage` can never show meetings closed from those four surfaces. Standardize on `markMeetingCompleted` and move the mutation into one shared hook. |
| M2 | **NEEDS IMPROVEMENT** | There are three meeting presentation components:<br>• `src/components/MeetingRow.jsx` (231 lines), used by Dashboard, OverviewTab and DayDetailDialog<br>• `src/components/meetings/MeetingCard.jsx` (297 lines), used by MeetingsPage and MeetingsTab<br>• `src/components/deliverables/MeetingCard.jsx` (122 lines), used by CalendarPostCard<br><br>Each owns its own mutations and invalidation lists. `MeetingRow` and `CreateMeetingDialog` sit at the `components/` root rather than in `components/meetings/`. Consolidate the mutations at minimum. |
| M3 | **REMOVE** | `fetchUpcomingMeeting` (singular, `api/meetings.js:34-53`) has no callers. |
| M4 | **REMOVE** | `CampaignDetailPage.jsx:56` imports `MeetingRow` but never uses it (it is the only occurrence in the file). |
| M5 | **NEEDS IMPROVEMENT** | `api/meetings.js` exports only plain fetchers with no `useXxx` hooks, so every consumer writes its own `useQuery` with its own key. The live keys are `['meetings', clientId]`, `['meetings','dashboard-upcoming']`, `['meetings','week-timeline',…]`, `['global-meetings', client]`, `['campaign-meetings', id]`, `['upcomingMeetings', clientId]` and `['todayMeetings', userId]`. As a result every mutation hand-lists 3 or 4 invalidations (`CreateMeetingDialog.jsx:175-179`, `meetings/MeetingCard.jsx:53-55`, `deliverables/MeetingCard.jsx:22-25`), and they don't match: `deliverables/MeetingCard` misses `global-meetings`, and `meetings/MeetingCard` misses `todayMeetings`. Add `useMeetings`/`useUpcomingMeetings` hooks under a single `['meetings', …]` root. |
| M6 | **NEEDS IMPROVEMENT** | `MeetingsPage.jsx` (680 lines) has its own `DraggableCard`/`KanbanColumn` (`:111-174`). These are near-copies of `TasksAndReminders.jsx:181-272` (the tasks version adds collapsing). Extract a shared `components/kanban/` (column, draggable card, DnD context wrapper) for both. |
| M7 | **NEEDS IMPROVEMENT** | `src/hooks/useMeetingReminders.js:11-15` fetches today's meetings with no `completed_at` filter, so it toasts "Upcoming Meeting" for meetings already marked complete. |
| M8 | **CAN STAY** | `ClientAvatar` is defined five times (`components/tasks/ClientAvatar.jsx`, `CreateMeetingDialog.jsx:42`, `CampaignDialog.jsx:46`, `ApprovalsPage.jsx:123`, `SubmissionsPage.jsx:69`). This is cross-cutting rather than meetings-specific, but `CreateMeetingDialog` should import the tasks one (or a shared one). |

---

## 5. Chat (`src/pages/chat/`, `src/components/chat/`, `src/components/sidebar/chat-sidebar.jsx`, `src/api/chat.js`)

| # | Verdict | Finding |
|---|---|---|
| C1 | **NEEDS IMPROVEMENT** | `ChatThread.jsx` is **1,021 lines**: `MessageBody` (:81), `groupReactions` (:154), `ReactionTriggerButton` (:172), `BubbleReactionsRow` (:216), `ChatMessageRow` (:256, ~180 lines), and `ChatThread` (:438) with **15 `useState`** plus 8 effects mixing composer, mention, attach-menu, scroll and deep-link logic. Suggested split: `useChatComposer()` (body, mentions, references, attach menu; :455-470, :618-760), `useStickToBottom()` (:507-531), `useDeepLinkHighlight()` (:543-569), `ChatMessageRow.jsx`, `ChatComposer.jsx`. |
| C2 | **NEEDS IMPROVEMENT** | Duplication with `components/comments/CommentThread.jsx` (796 lines): `groupReactions` (Comment:67 / Chat:154), `ReactionTriggerButton` (Comment:85 / Chat:172), and the mention-composer functions `handleBodyChange`/`selectMention`/`removeMention`/`handleMentionButtonClick`/`handleKeyDown` (Comment:444-528 / Chat:618-766) are parallel copies. `lib/mentions.js` already shares the parsing; the composer state machine (`useMentionComposer`) and the reaction UI should be shared too. `CHAT_REACTION_EMOJIS` (`api/chat.js:18`) duplicates `REACTION_EMOJIS` (`api/comments.js:176`) on purpose (separate DB constraints, documented): **CAN STAY**. |
| C3 | **NEEDS IMPROVEMENT** | `ChatThread.jsx:451-452` calls `useTasks()`, the full task list, just to build `visibleTaskIds` for redaction. That fetch happens on every chat open. `ChatEntityCard.jsx` already has a `useTaskExists` / per-reference path. Consider a cheap `useVisibleTaskIds()` (select `id` only) or resolving per reference. |
| C4 | **NEEDS IMPROVEMENT** | `ChatEntityCard.jsx:46-53`: `ChatDeliverableCard` loads **all** global posts (`useGlobalPosts()`) and matches on `version_id`. References store `version_id` (`AttachEntityMenu.jsx:49`), and `useGlobalPosts` returns only *current* versions, so after a revision is created the card will likely flip to "unavailable" (not verified at runtime). Storing `post_id`, or resolving by post, would be more stable. |
| C5 | **NEEDS IMPROVEMENT** | `ChatPage.jsx:44-46` renders an empty `<div>` while loading **and** on error. `useMyChannels` errors, or `ensure_workspace_channel` failing (`api/chat.js:128`, where the RPC result's `error` is ignored), give a blank page with no feedback. Add a skeleton and an error state, and check the `ensure_workspace_channel` error. `ChatThread`'s messages query likewise has no error branch (`:800-815`). |
| C6 | **CAN STAY** | `useMemberMap()` (`api/chat.js:53-79`) is well designed (it includes the owner). It is the right base for a single app-wide member lookup. `useTaskLookups` (tasks), the NotificationBell map and the dashboard map should all converge on one hook (see N-1 below). |
| C7 | **CAN STAY** | The `useId()`-suffixed realtime topic in `useMyChannels` (`api/chat.js:96-114`) correctly works around topic collisions. It is the template the rest of the app should follow (see X1). |
| C8 | **NEEDS IMPROVEMENT** (docs) | `documentation/features/feature-workspace-chat.md:286-287,304` describe `TaskDetailSheet` and `/tasks?task=<id>` links. Both are superseded: `referenceHref` now returns `/tasks/${id}` (`ChatThread.jsx:72-75`) and there is a real `/tasks/:taskId` page. The doc also cites `/clients/:clientId/posts/:versionId`, which is now `/deliverables/`. Add a "superseded" note. |

---

## 6. Notifications (`src/components/notifications/`, `src/api/notifications.js`)

| # | Verdict | Finding |
|---|---|---|
| X0 | **REMOVE** | `notify()` (`api/notifications.js:38-66`) and `notifyFromMutation()` (`:74-81`) have **zero callers** (grep across `src/`). Once they go, the `resolveWorkspace` import (`:5`) is unused too. The JSDoc ("Call this from mutation functions…") actively contradicts the architecture rule that fan-out is DB-side only. Also update CLAUDE.md, which currently says the function "exists but intentionally unused", and `feature-collaboration.md:23`. |
| X1 | **NEEDS IMPROVEMENT** (latent bug) | `useUnreadNotificationCount()` subscribes to the realtime topic `notifications:${user.id}` *inside the hook* (`:94-115`), and it is mounted **twice** while the popover is open (`NotificationBell.jsx:234` in `NotificationPanel`, `:386` in `NotificationBell`). The installed `@supabase/realtime-js` 2.95.3 `channel()` returns the **existing** channel for an identical topic (`node_modules/@supabase/realtime-js/dist/main/RealtimeClient.js:281-291`). When the panel unmounts, its cleanup calls `removeChannel` on that shared channel, which likely kills the bell's live badge updates until a remount. `api/chat.js:96-104` documents exactly this failure mode. The same in-hook pattern exists in `comments.js:37,83`, `team.js:31,109` (`useTeamMembers` is mounted in many places at once) and `chat.js:182`. **Recommend one shared `useRealtimeInvalidate({ table, filter, event, queryKeys })` hook** with a `useId()` topic suffix, replacing all of these copies. |
| X2 | **NEEDS IMPROVEMENT** | `routes.js:18` maps `team → '/settings'`. Team moved to its own `/team` route (CLAUDE.md: "not a Settings tab"), so a team notification without an explicit `link` lands on Profile settings. The `post → '/deliverables'` mapping (:14) is a generic fallback that ignores `entity_id`. |
| X3 | **NEEDS IMPROVEMENT** | `NotificationBell.jsx:235-241` builds its actor map from `useTeamMembers()` only. `get_team_members` never returns the workspace owner (see the `api/chat.js:22-27` comment), so **notifications whose actor is the owner show no name or avatar**. Use `useMemberMap()` from `api/chat.js`. |
| X4 | **REMOVE** | The `chat_dm` entry in `TYPE_CONFIG` (`NotificationBell.jsx:68-71`) is marked "No longer emitted". Emission stopped around 2026-09-10 (`git log`, commit 79993c2), and notifications have 30-day retention, so by 2026-11-07 no `chat_dm` rows should remain, assuming the retention cron is running. |
| X5 | **NEEDS IMPROVEMENT** | `NotificationBell.jsx` (545 lines) holds the type config, row, panel, arrival-card toaster (`:340-383`) and session-summary card. Split the arrival toaster and `TYPE_CONFIG` out into `ArrivalToaster.jsx` and `notificationTypes.js`. `getInitials` (:103) is a 3rd copy (also in `AppHeader.jsx:149` and `nav-header.jsx:55`); move it to `lib/helper.js`. |
| X6 | **CAN STAY** | `useNotificationStream` (`:142-169`) correctly uses its own topic and a ref-held handler. `routes.js` is a good shared resolver. |
| X7 | **CAN STAY** | `NotificationTitle`'s regex over `"Task status updated to X"` (`:90-101`) is a documented, deliberate workaround. |

---

## Overlap: reminders / notes / tasks / meetings

- **No real duplicate data models.** `notes` (rich docs), `tasks` (work items), and `meetings` (scheduled events) are distinct tables with distinct UIs.
- **"Reminders" is not a feature.** It is three unrelated client-side mechanisms: `useMeetingReminders` (AppShell toast, 15 minutes before a meeting), the task-due toast hardcoded in client `OverviewTab.jsx:180-213` (it only fires while that client's overview is open, and is localStorage-deduped), and `SubscriptionReminder`. None of them go through the notifications system, which already has pg_cron (`notify_overdue_invoices`). Recommendation: either fold task-due and meeting-soon alerts into DB-side notifications (a pg_cron job like overdue invoices) or at least centralize them in `src/hooks/`. Then drop the "Reminders" naming (`TasksAndReminders`, the empty-state copy at `:983`).
- **Leftover "notes" naming for tasks:** the `DashboardMeetingsNotes` tab `'notes'`, the `notes` variable and `notifiedNoteIds` in OverviewTab.
- **Member-lookup sprawl (N-1):** five different `memberMap` builders. They are `useTaskLookups`, `useMemberMap` (chat), plus inline copies in TasksAndReminders, TasksTab, DashboardMeetingsNotes and NotificationBell. Each handles owner, removed members and job roles differently. Converge on one `useWorkspaceMembers()`.
- **Kanban duplication:** Tasks and Meetings (M6).

## Stale docs summary

- `.claude/CLAUDE.md` Tasks section: `TaskDetailSheet` no longer exists in `src/` (detail is `/tasks/:taskId` → `TaskDetailPage`). Collaboration section: the "client-side `notify()` exists but intentionally unused" line goes once X0 lands. Edge-function list: missing `send-task-assignment-email`, `send-invoice-email`, `send-team-welcome`, `delete-workspace` and `toggle-maintenance`.
- `.claude/rules/routing.md`: `NotesAndReminders` and the `/clients/:clientId` tab list are stale; it is missing `/tasks*`, `/chat` and `/operations/notes/:noteId`.
- `.claude/rules/supabase-patterns.md`: the "Current functions" list has 3 of 15.
- `documentation/features/feature-task-linking.md:76-80,120`: describes `TaskDetailSheet` exported from `TaskCard.jsx`.
- `documentation/features/feature-workspace-chat.md:286-304`: `?task=` links and the old post route.

## Suggested priority

1. M1/D2: standardize meeting "done" on `markMeetingCompleted`, so meetings stop being deleted.
2. X1: shared `useRealtimeInvalidate` hook (fixes the latent badge bug and removes about 8 copies).
3. X0, D1, M3, M4, N1, X4: dead code removals (quick wins).
4. T11: the Edit dialog's assignee change skips the assignment email. T6: due-date UTC shift.
5. X3/X2: the owner actor name and the team route in notifications.
6. T2 plus one member hook; T3 (task dialog merge); T4 (`lib/task-statuses.js`).
7. Splits: ChatThread (C1/C2), TasksAndReminders (T1), NotificationBell (X5), shared kanban (M6), WeekTimeline (D4).
8. Error states across dashboard, tasks and chat (D7, T7, C5); doc refresh.
