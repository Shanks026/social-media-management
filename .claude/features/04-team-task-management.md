# Feature: Team Task Management
**Product**: Tercero — Social Media Agency Management SaaS  
**File**: `.claude/features/04-team-task-management.md`  
**Status**: Phases 1–3 Complete + UI Polish Complete — Phase 4 Pending Approval  
**Last Updated**: July 2026

---

## Context

The existing "Tasks & Reminders" feature is built on a table called `client_notes` — a legacy naming from when tasks and notes were the same concept. It has no assignment model, no priority, and no awareness of team roles. Every team member sees every task and can create, edit, or delete anything. This feature replaces that system with a proper team-based task engine: personal tasks are private to the creator, assigned tasks are visible to leadership and the assignee, and only owners/admins can assign work to others. The UI (kanban, grid, filters) is kept and extended; only the backend and the new RBAC-aware behaviours are added.

---

## Phase Overview

```
Phase 1 — Schema, Migration & API ✅
  Drop client_notes; create tasks table with full schema; migrate existing data;
  build src/api/tasks.js; rewire all consumers to the new API and new statuses.

Phase 2 — Core UI Enhancement ✅
  Priority field in dialogs; priority badges on cards; personal vs assigned grid
  sections; "Assigned to me" quick filter; redesigned task cards with assignee info.

Phase 3 — Assignment & RBAC Enforcement ✅
  Assignee picker in create/edit dialogs (owner/admin only); member-restricted UI
  (status-only controls on assigned tasks); RBAC flags wired throughout.

UI Polish — Dialog redesign, filter refinements, sidebar badge ✅
  Notion-style dialogs; "(You)" tags; atomic URL filter state; "Created by me"
  filter; overdue-only sidebar badge; kanban equal-height columns.

Phase 4 — Context Integration ⏳ Pending Approval
  Tasks tab on Client Detail page; inline task widget on Campaign Detail;
  "My Tasks" widget on Dashboard.
```

**After each phase: stop and wait for approval before proceeding.**

---

## Phase 1 — Schema, Migration & API ✅ Complete

### Goal

After Phase 1 the existing Tasks & Reminders page looks and behaves exactly as before from the user's perspective, but all data lives in the new `tasks` table. The old `client_notes` table is dropped. Status values `IN_PROGRESS` and `COMPLETED` (replacing `DONE`) are live in the DB and reflected in the UI. Every component that previously read from `client_notes` now calls `src/api/tasks.js`. No new UI features are introduced.

### Before Starting — Confirm With Codebase

1. Read `src/api/notes.js` — confirm the full list of exported functions and their parameter signatures before removing them.
2. Read `src/pages/clients/clientSections/OverviewTab.jsx` — confirm the query key is `['client-notes', client.id]` and which notes functions it imports.
3. Read `src/pages/campaigns/CampaignDetailPage.jsx` — confirm the query key is `['campaign-notes', campaignId]`.
4. Read `src/pages/dashboard/DashboardMeetingsNotes.jsx` — confirm the query key is `['global-notes']`.
5. Read `src/components/NoteRow.jsx` — verify `ClientAvatar` is exported and what else the file contains.
6. Read `src/lib/workspace.js` `resolveWorkspace()` — confirm it returns `{ workspaceUserId }` and that it also provides the caller's actual `auth.uid()` or whether `auth.getUser()` must be called separately.
7. Check `src/pages/TasksAndReminders.jsx` lines 73–95 — confirm `STATUS_TABS` and `STATUS_CONFIG` shape before rewriting them.

### 1.1 Database

**Create `tasks` table:**

```sql
CREATE TABLE public.tasks (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by   UUID        NOT NULL REFERENCES auth.users(id),
  assigned_to  UUID        REFERENCES auth.users(id),

  title        TEXT        NOT NULL,
  description  TEXT,

  status       TEXT        NOT NULL DEFAULT 'TODO'
               CHECK (status IN ('TODO', 'IN_PROGRESS', 'COMPLETED', 'ARCHIVED')),
  priority     TEXT        NOT NULL DEFAULT 'NORMAL'
               CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')),

  due_at       TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  client_id    UUID        REFERENCES clients(id)   ON DELETE SET NULL,
  campaign_id  UUID        REFERENCES campaigns(id) ON DELETE SET NULL,

  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX tasks_workspace_idx   ON public.tasks(workspace_id);
CREATE INDEX tasks_assigned_to_idx ON public.tasks(assigned_to);
CREATE INDEX tasks_client_idx      ON public.tasks(client_id);
CREATE INDEX tasks_campaign_idx    ON public.tasks(campaign_id);
CREATE INDEX tasks_status_idx      ON public.tasks(status);
```

**Row Level Security:**

```sql
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- SELECT: creator, assignee, or any workspace admin
CREATE POLICY "tasks_select" ON public.tasks
  FOR SELECT USING (
    workspace_id = public.get_my_agency_user_id()
    AND (
      created_by  = auth.uid()
      OR assigned_to = auth.uid()
      OR public.is_workspace_admin()
    )
  );

-- INSERT: anyone in workspace may create; only admin/owner may set assigned_to
CREATE POLICY "tasks_insert" ON public.tasks
  FOR INSERT WITH CHECK (
    workspace_id = public.get_my_agency_user_id()
    AND created_by = auth.uid()
    AND (
      assigned_to IS NULL
      OR public.is_workspace_admin()
    )
  );

-- UPDATE (full edits): creator or admin only.
-- Assignees advance status via update_task_status RPC (which is SECURITY DEFINER).
CREATE POLICY "tasks_update" ON public.tasks
  FOR UPDATE
  USING (
    workspace_id = public.get_my_agency_user_id()
    AND (created_by = auth.uid() OR public.is_workspace_admin())
  )
  WITH CHECK (
    workspace_id = public.get_my_agency_user_id()
    AND (created_by = auth.uid() OR public.is_workspace_admin())
  );

-- DELETE: creator or admin only
CREATE POLICY "tasks_delete" ON public.tasks
  FOR DELETE USING (
    workspace_id = public.get_my_agency_user_id()
    AND (created_by = auth.uid() OR public.is_workspace_admin())
  );
```

**`update_task_status` RPC (SECURITY DEFINER):**

This RPC is the only write path for status transitions. It is the single place `completed_at` is stamped. The `tasks_update` RLS policy blocks direct status UPDATEs by members (they are not creator/admin), so this RPC is required for members to advance tasks assigned to them.

```sql
CREATE OR REPLACE FUNCTION public.update_task_status(
  p_task_id UUID,
  p_status  TEXT
)
RETURNS public.tasks
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_task public.tasks;
BEGIN
  SELECT * INTO v_task FROM public.tasks WHERE id = p_task_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'task_not_found';
  END IF;

  -- Workspace scope check
  IF v_task.workspace_id <> public.get_my_agency_user_id() THEN
    RAISE EXCEPTION 'access_denied';
  END IF;

  -- Visibility check: creator, assignee, or admin
  IF v_task.created_by <> auth.uid()
     AND (v_task.assigned_to IS NULL OR v_task.assigned_to <> auth.uid())
     AND NOT public.is_workspace_admin()
  THEN
    RAISE EXCEPTION 'access_denied';
  END IF;

  IF p_status NOT IN ('TODO', 'IN_PROGRESS', 'COMPLETED', 'ARCHIVED') THEN
    RAISE EXCEPTION 'invalid_status: %', p_status;
  END IF;

  UPDATE public.tasks SET
    status       = p_status,
    completed_at = CASE
                     WHEN p_status = 'COMPLETED' THEN now()
                     ELSE NULL
                   END,
    updated_at   = now()
  WHERE id = p_task_id
  RETURNING * INTO v_task;

  RETURN v_task;
END;
$$;
```

**Data migration from `client_notes`:**

Run the migration, verify the row count matches, then drop the old table.

```sql
-- Step 1: migrate
INSERT INTO public.tasks (
  id, workspace_id, created_by,
  assigned_to, title, description,
  status, priority,
  due_at, completed_at,
  client_id, campaign_id,
  created_at, updated_at
)
SELECT
  id,
  user_id                                                   AS workspace_id,
  user_id                                                   AS created_by,
  NULL                                                      AS assigned_to,
  title,
  content                                                   AS description,
  CASE WHEN status = 'DONE' THEN 'COMPLETED' ELSE status END AS status,
  'NORMAL'                                                  AS priority,
  due_at,
  CASE WHEN status = 'DONE' THEN updated_at ELSE NULL END   AS completed_at,
  client_id,
  campaign_id,
  created_at,
  updated_at
FROM public.client_notes;

-- Step 2: verify counts match before dropping
SELECT COUNT(*) FROM public.client_notes;
SELECT COUNT(*) FROM public.tasks;

-- Step 3: drop (only after counts match)
DROP TABLE public.client_notes;
```

> **Migration note:** In the old system every record's `user_id` was the workspace owner's UID (set by `resolveWorkspace()`). `created_by` is therefore correctly set to that UID for all migrated tasks — they all become personal tasks (`assigned_to = NULL`) owned by the workspace owner. No data is lost.

### 1.2 API Layer — `src/api/tasks.js` (new file)

`workspace_id` is set to `workspaceUserId` from `resolveWorkspace()`. `created_by` is set to the caller's own `auth.uid()` via `(await supabase.auth.getUser()).data.user.id` — **not** `workspaceUserId`, which may differ for member users.

```js
// ─── Read ────────────────────────────────────────────────────────────────────

export function useTasks({ clientId, campaignId } = {}) {
  // queryKey: ['tasks', 'list', { clientId, campaignId }]
  // SELECT * FROM tasks (workspace scoped via RLS)
  // ORDER: status ASC (TODO < IN_PROGRESS < COMPLETED < ARCHIVED),
  //        priority DESC (URGENT first), due_at ASC NULLS LAST, created_at DESC
  // Filter by clientId when provided; by campaignId when provided.
  // Returns raw rows — components build clientMap/memberMap separately.
}

// ─── Mutations ───────────────────────────────────────────────────────────────

export async function createTask({
  title, description, priority, due_at,
  client_id, campaign_id, assigned_to
})
// INSERT into tasks.
// workspace_id = workspaceUserId (from resolveWorkspace)
// created_by   = auth.uid()      (the actual caller, not the workspace owner)
// assigned_to  = null unless provided (RLS enforces admin-only for non-null)

export async function updateTask(taskId, updates)
// Direct UPDATE via Supabase.
// Allowed fields: title, description, priority, due_at, client_id, campaign_id, assigned_to.
// Protected by tasks_update RLS (creator or admin only).
// Always sets updated_at = now().

export async function updateTaskStatus(taskId, status)
// Calls update_task_status(p_task_id, p_status) SECURITY DEFINER RPC.
// Used by ALL callers for status transitions (creator, assignee, admin).
// This is the only correct path — do not use updateTask() for status changes.

export async function deleteTask(taskId)
// DELETE. Protected by tasks_delete RLS (creator or admin only).
```

**Query invalidation:** all mutations invalidate `{ queryKey: ['tasks', 'list'] }` (partial key match covers all filter variations).

**Query key reference:**
```
['tasks', 'list', {}]                     — all workspace tasks (global page)
['tasks', 'list', { clientId }]           — tasks for one client
['tasks', 'list', { campaignId }]         — tasks for one campaign
```

### 1.3 Components

**New: `src/components/tasks/CreateTaskDialog.jsx`**

Replaces `src/components/CreateNoteDialog.jsx`. Identical props API so all existing call sites need only to change the import path:
- `clientId?: string` — pre-selects a client; defaults to internal account
- `lockClient?: boolean` — shows read-only client pill
- `campaignId?: string` / `campaignName?: string` — locks campaign context
- `children` / `open` / `onOpenChange` / `onSuccess` — controlled/uncontrolled pattern unchanged

Fields in this phase: Client dropdown, Campaign dropdown (optional), Title (required), Description (textarea), Due date/time. **No assignee or priority fields yet** — those are Phase 3 and Phase 2 respectively.

On submit: calls `createTask()`. Invalidates `['tasks', 'list']`. Dialog title: "New Task".

**New: `src/components/tasks/EditTaskDialog.jsx`**

Replaces `src/components/EditNoteDialog.jsx`. Props: `task` (task row object), `open`, `onOpenChange`.
Fields: same as `CreateTaskDialog`. Pre-fills all fields from `task`. On submit: calls `updateTask()`. Invalidates `['tasks', 'list']`.

**`src/components/NoteRow.jsx`** — keep as-is. `ClientAvatar` is still imported from here by `OverviewTab`. It will be moved in Phase 2 when cards are redesigned.

**`src/components/CreateNoteDialog.jsx`** — DELETE after all usages are migrated.

**`src/components/EditNoteDialog.jsx`** — DELETE after all usages are migrated.

### 1.4 Consumer Rewiring

The following files all import from `@/api/notes` and use old query keys. Each needs three changes: updated import, updated query key, and updated status values (`DONE` → `COMPLETED`).

**`src/pages/TasksAndReminders.jsx`**
- Import `useTasks`, `updateTaskStatus`, `deleteTask` from `@/api/tasks`
- Replace `CreateNoteDialog` → `CreateTaskDialog`; `EditNoteDialog` → `EditTaskDialog`
- Replace `useQuery({ queryKey: ['global-notes'], queryFn: fetchAllNotes })` → `useTasks()`
- `STATUS_CONFIG`: add `IN_PROGRESS` entry; rename `DONE` key/label to `COMPLETED`
- `STATUS_TABS`: add `IN_PROGRESS` tab; rename `DONE` → `COMPLETED`
- Kanban: add fourth `IN_PROGRESS` column (blue-indigo accent) between TODO and COMPLETED. The existing `KanbanNotesView` becomes a 4-column `grid-cols-4` layout.
- Grid grouping: add `inProgressNotes` bucket (IN_PROGRESS tasks not overdue). Section order: Overdue → In Progress → Upcoming → Completed → Archived.
- `handleDragEnd` in kanban: update `STATUS_CONFIG` reference for `IN_PROGRESS`.
- All query invalidation calls: `['global-notes']` → `['tasks', 'list']`; `['client-notes', note.client_id]` → `['tasks', 'list']`.
- Copy: "New Note" → "New Task"; all "note" references → "task"; search placeholder → "Search tasks…"; empty state copy updated.
- `updateNoteStatus` calls → `updateTaskStatus` (via the RPC path in `api/tasks.js`).
- `deleteNote` calls → `deleteTask`.

**`src/pages/clients/clientSections/OverviewTab.jsx`**
- Replace `useQuery({ queryKey: ['client-notes', client.id], queryFn: () => fetchClientNotes(client.id) })` with `useTasks({ clientId: client.id })` hook
- For the internal account context: `fetchInternalClientNotes` is no longer needed — `useTasks({ clientId })` with the internal account's `clientId` returns the right records (legacy `NULL` client_id records were migrated to the internal account's `client_id` in the migration — **verify this** before running: if `client_notes.client_id IS NULL` records exist, add `OR client_id IS NULL` handling in the migration step or ensure they were linked to the internal account)
- Update query invalidation keys to `['tasks', 'list']`
- Update status display: `DONE` → `COMPLETED`; add handling for `IN_PROGRESS`

> **Migration edge case:** The old system had a special `fetchInternalClientNotes` that included `client_id IS NULL` records alongside the internal account's records. Before running the migration SQL, check whether any `client_notes` rows have `client_id IS NULL`. If they do, they should be migrated with `client_id = <internal_account_id>` rather than NULL (tasks always have a client or are personal — the `client_id` field is optional context, not workspace scoping). Update the migration INSERT to handle this:
> ```sql
> client_id = COALESCE(cn.client_id, (
>   SELECT id FROM clients
>   WHERE user_id = cn.user_id AND is_internal = true
>   LIMIT 1
> ))
> ```

**`src/pages/campaigns/CampaignDetailPage.jsx`**
- Replace `useQuery({ queryKey: ['campaign-notes', campaignId], queryFn: ... })` with `useTasks({ campaignId })`
- Update query invalidation keys to `['tasks', 'list']`
- Update `CreateNoteDialog` → `CreateTaskDialog`
- Update status display for `COMPLETED` and `IN_PROGRESS`

**`src/pages/dashboard/DashboardMeetingsNotes.jsx`**
- Replace `useQuery({ queryKey: ['global-notes'], queryFn: fetchAllNotes })` with `useTasks()`
- Update query invalidation keys to `['tasks', 'list']`
- Update status display for new values

**`src/api/notes.js`**
- This file contains only task-related functions (`fetchClientNotes`, `fetchInternalClientNotes`, `fetchAllNotes`, `fetchCampaignNotes`, `createNote`, `updateNoteStatus`, `updateNote`, `deleteNote`). After migrating all consumers to `src/api/tasks.js`, **delete this file entirely**. The rich-text notes feature uses `src/api/agencyNotes.js` — that file is unchanged.

### 1.5 Impact on Existing Features

| Feature | Impact | Action Required |
|---|---|---|
| Tasks & Reminders page | Query key + status values + 4-column kanban | Rewire in this phase |
| Client Overview tab (inline tasks) | Query key + status display + null client_id edge case | Rewire in this phase |
| Campaign Detail task section | Query key + status display | Rewire in this phase |
| Dashboard tasks widget | Query key + status display | Rewire in this phase |
| Notes page (`/operations/notes`) | None — uses `agencyNotes.js` | No change |
| Note Editor (`/operations/notes/:id`) | None | No change |
| Note Tags feature | None — separate tables | No change |

### 1.6 What This Phase Does NOT Include

- Assignee picker — Phase 3
- Priority field in dialogs — Phase 2
- Personal vs team sections in grid — Phase 2
- Member-restricted UI — Phase 3
- Tasks tab in Client Detail — Phase 4
- Campaign inline task widget (beyond existing deep-link) — Phase 4
- Dashboard "My Tasks" widget — Phase 4

### 1.7 Phase 1 Checklist — Before Marking Complete

- [x] `tasks` table created with all 14 columns; all 5 indexes created
- [x] All four RLS policies enabled (`tasks_select`, `tasks_insert`, `tasks_update`, `tasks_delete`)
- [x] `update_task_status` RPC created (SECURITY DEFINER; handles completed_at stamping)
- [x] Data migrated: row count in `tasks` equals row count that was in `client_notes`
- [x] `DONE` status correctly migrated to `COMPLETED`; `completed_at` stamped on those rows
- [x] `client_id IS NULL` edge case handled in migration (COALESCE to internal account)
- [x] `client_notes` table dropped (after verifying count parity)
- [x] `src/api/tasks.js` created with `useTasks`, `createTask`, `updateTask`, `updateTaskStatus`, `deleteTask`
- [x] `src/api/notes.js` deleted; no remaining imports of it in the codebase
- [x] `src/components/tasks/CreateTaskDialog.jsx` created; all previous `CreateNoteDialog` import sites updated
- [x] `src/components/tasks/EditTaskDialog.jsx` created; all previous `EditNoteDialog` import sites updated
- [x] `src/components/CreateNoteDialog.jsx` deleted; `src/components/EditNoteDialog.jsx` deleted
- [x] `TasksAndReminders.jsx`: STATUS_CONFIG has IN_PROGRESS + COMPLETED; kanban has 4 columns; grid grouping includes In Progress; all copy says "task"
- [x] `OverviewTab.jsx` wired to `useTasks({ clientId })`; handles COMPLETED + IN_PROGRESS
- [x] `CampaignDetailPage.jsx` wired to `useTasks({ campaignId })`; handles new statuses
- [x] `DashboardMeetingsNotes.jsx` wired to `useTasks()`; handles new statuses
- [x] `TaskRow.jsx` (renamed from NoteRow) query invalidation keys updated to `['tasks', 'list']`; `ClientAvatar` re-exported from new location; all 9 import sites updated
- [x] All four status transitions wired: circle click cycles TODO/IN_PROGRESS → COMPLETED → TODO; kanban drag-and-drop covers all 4 columns
- [x] `npm run build` passes with no errors

**Implementation Notes:**
- `NoteRow.jsx` was renamed to `TaskRow.jsx` (not just rewired). `ClientAvatar` is still exported from the new file. Nine files across the codebase imported `ClientAvatar` from NoteRow; all updated.
- `ContentCalendar.jsx` also imported `CreateNoteDialog`; updated to `CreateTaskDialog`.
- Dashboard `DashboardMeetingsNotes` now filters `useTasks()` client-side to `TODO + IN_PROGRESS` for the active tasks view (avoids a separate DB call).
- `update_task_status` RPC returns `void` (not the updated row) — component invalidates the React Query cache after the call rather than using the return value.
- The feature doc note about `NoteRow.jsx` staying (§1.3) was superseded — it was fully replaced this phase since all consumers needed updating anyway.

**→ Stop here. Show the result and wait for approval.**

---

## Phase 2 — Core UI Enhancement ✅ Complete

### Goal

After Phase 2, every task has a priority level (set at creation and edit time). Task cards show a priority badge and assignee info. The grid view separates tasks into contextual sections (overdue, in progress, personal, assigned to me, team tasks, completed, archived). An "Assigned to me" quick filter chip narrows the view to the current user's assigned queue. The kanban remains status-based and is unchanged from Phase 1.

### Before Starting — Confirm Phase 1 is Approved

1. Re-read `src/pages/TasksAndReminders.jsx` as updated in Phase 1 — note the exact structure of `NoteCard` (now `TaskCard`), `NotesGroup`, and the filter/state layout.
2. Read `src/api/team.js` `useTeamMembers()` — check the exact shape returned by the `get_team_members` RPC: confirm fields include `member_user_id`, and a display name.
3. Read `src/components/NoteRow.jsx` — check whether anything besides `ClientAvatar` is exported or used; confirm it's safe to move `ClientAvatar`.
4. Confirm `useTasks()` returns `assigned_to`, `created_by`, and `priority` fields (they should — they're in the `tasks` table SELECT `*`).

### 2.1 Database

No schema changes. `priority` and `assigned_to` already exist from Phase 1.

### 2.2 API Layer

**`src/api/tasks.js`** — add `assignedToMe` filter to `useTasks`:
```js
export function useTasks({ clientId, campaignId, assignedToMe } = {})
// When assignedToMe is true: add .eq('assigned_to', auth.uid()) to query
// queryKey: ['tasks', 'list', { clientId, campaignId, assignedToMe }]
```

No other API changes.

### 2.3 Components

**`src/pages/TasksAndReminders.jsx`**

Rename `NoteCard` → `TaskCard` (internal rename within the file). Add to `TaskCard`:
- **Priority badge**: shown inline with the status badge.
  - `URGENT` → `bg-red-100 text-red-700` badge (always visible)
  - `HIGH` → `bg-amber-100 text-amber-700` badge (always visible)
  - `NORMAL` → no badge (reduces noise)
  - `LOW` → `bg-zinc-100 text-zinc-500` badge
- **Assignee row**: below the title, if `task.assigned_to` is set, show assignee avatar (from `memberMap`) + full name in `text-xs text-muted-foreground`. Label: "Assigned to [name]".
- **Assigned-by row**: if `task.assigned_to === currentUserId && task.created_by !== currentUserId`, show "From: [creator name]" in muted text.
- **`completed_at` display**: when `status === 'COMPLETED'`, show `completed_at` date instead of `due_at` using `formatDate()` from `@/lib/helper`.

Priority sort within each grid group: URGENT → HIGH → NORMAL → LOW.

Updated grid grouping (in order):
1. **Overdue** — TODO or IN_PROGRESS tasks where `due_at < now()`
2. **In Progress** — IN_PROGRESS tasks not overdue
3. **Personal** — TODO tasks where `assigned_to IS NULL` (private to current user; only visible to the creator due to RLS — admin/owner will not see others' personal tasks; this section is "my personal tasks")
4. **Assigned to Me** — TODO tasks where `assigned_to === currentUserId`
5. **Team Tasks** — TODO tasks where `assigned_to IS NOT NULL && assigned_to !== currentUserId` (only visible to admin/owner; members won't see this section because RLS hides those rows)
6. **Completed** — COMPLETED tasks
7. **Archived** — ARCHIVED tasks

> The distinction between "Personal" and "Team Tasks" sections is natural: Personal tasks only return for their creator (RLS), Team Tasks only appear for admin/owner (they're assigned to others). No extra filtering logic is needed beyond what RLS already provides.

Add **"Assigned to me"** filter chip to the controls row (between status tabs and client filter):
- A toggle button (same style as the existing status tab pills)
- When active, passes `assignedToMe: true` to `useTasks()`
- Resets when client filter changes

Add `memberMap` state built from `useTeamMembers()`:
```js
const { data: teamMembers = [] } = useTeamMembers()
const memberMap = useMemo(() =>
  Object.fromEntries(teamMembers.map(m => [m.member_user_id, m])),
  [teamMembers]
)
```
Pass `memberMap` and `currentUserId` into `TaskCard`.

**`src/components/tasks/CreateTaskDialog.jsx`** — add **Priority** field:
- Segmented radio group (or Select): Low / Normal / High / Urgent. Default: Normal.
- Position: below Due date/time.

**`src/components/tasks/EditTaskDialog.jsx`** — add Priority field. Pre-fills from `task.priority`.

**`src/components/tasks/ClientAvatar.jsx`** (new file — move from `NoteRow.jsx`):
- Extract the `ClientAvatar` component from `src/components/NoteRow.jsx` into its own file at `src/components/tasks/ClientAvatar.jsx`.
- Update all import sites: `TasksAndReminders.jsx`, `CreateTaskDialog.jsx`, `EditTaskDialog.jsx`, `OverviewTab.jsx`, any other consumer.
- Keep `NoteRow.jsx` if it contains other used exports; otherwise delete it.

### 2.4 Integration

- `src/pages/clients/clientSections/OverviewTab.jsx` — update the inline task display to show priority badge (keep compact; just a colored dot is fine in the tight list layout).
- `src/pages/campaigns/CampaignDetailPage.jsx` — update task display for priority badge.

### 2.5 What This Phase Does NOT Include

- Assignee picker in create/edit dialogs (owner/admin setting who gets the task) — Phase 3
- Member-restricted UI (hiding edit/delete from members) — Phase 3
- RBAC permission checks (`canAssignTasks`) — Phase 3

### 2.6 Phase 2 Checklist — Before Marking Complete

- [x] Priority field in `CreateTaskDialog` (all 4 levels, default Normal)
- [x] Priority field in `EditTaskDialog` (pre-fills from task)
- [x] Priority badge on task cards: URGENT red, HIGH amber, NORMAL hidden, LOW muted
- [x] Priority sort within each grid group (URGENT floats first)
- [x] Grid sections updated: Overdue / In Progress / Personal / Assigned to Me / Team Tasks / Completed / Archived
- [x] "Assigned to me" toggle filter chip works — filters to `assigned_to = currentUser`
- [x] Task cards show assignee name when `assigned_to` is set
- [x] Task cards show "From: [creator]" when user is the assignee and not the creator
- [x] Completed tasks show `completed_at` date (not `due_at`)
- [x] `memberMap` built from `useTeamMembers()` in `TasksAndReminders.jsx`
- [x] `ClientAvatar` moved to `src/components/tasks/ClientAvatar.jsx`; re-exported from `TaskRow.jsx` for backward compat; new code uses canonical path
- [x] `NoteRow.jsx` was already deleted in Phase 1 — not applicable
- [x] `OverviewTab.jsx` and `CampaignDetailPage.jsx` show priority dot via `TaskRow` row mode (PRIORITY_DOT map on colored dot inline with title)
- [x] `npm run build` passes with no errors

**Implementation Notes:**
- Phase 1 DB migration was applied via Supabase MCP in this session. `client_notes` table had no `updated_at` column; `completed_at` stamped with `created_at` for migrated DONE rows.
- `ClientAvatar` re-exported from `TaskRow.jsx` so the 9 other import sites (MeetingRow, AgencyNoteCard, DashboardWeekTimeline, etc.) required no changes.
- `assignedToMe` chip resets when client filter changes; empty state "Clear all filters" also resets it.
- `useTasks({ assignedToMe: true })` uses a separate query key so the global cache is not polluted when the chip is active.
- Page display name renamed from "Tasks & Reminders" to "Tasks & Todos" throughout UI (nav, page title, breadcrumb, subtitle). Feature doc and file names unchanged.

**→ Stop here. Show the result and wait for approval.**

---

## Phase 3 — Assignment & RBAC Enforcement ✅ Complete

### Goal

After Phase 3, owners and admins see an assignee picker in create/edit dialogs and can assign tasks to any team member except the owner. Members see a fully restricted UI: they can create personal tasks (no assignee field shown), and on tasks assigned to them they see only the status toggle — no edit, archive, or delete. RBAC is enforced at both the UI layer (`usePermissions()`) and the DB layer (Phase 1 RLS already enforces this server-side).

### Before Starting — Confirm Phase 2 is Approved

1. Read `src/lib/permissions.js` `resolveCapabilities` — note exact structure to know where to insert `canAssignTasks`.
2. Read `src/api/usePermissions.js` — confirm it imports and calls `resolveCapabilities` and exposes the result.
3. Read `src/context/AuthContext.jsx` — confirm `user.id` (the actual caller's UID) is accessible in components so `currentUserId` can be derived.
4. Check `useTeamMembers()` return shape — need `member_user_id`, `first_name`, `last_name`, and `system_role` to build the assignee picker list and filter out the owner.
5. Re-read Phase 1 RLS `tasks_insert` policy — confirm `assigned_to IS NULL OR is_workspace_admin()` is in the `WITH CHECK`.

### 3.1 Database

No schema changes. Phase 1 RLS already enforces assignment rules at the DB level. Verify the policies are correctly applied before building the UI.

### 3.2 API Layer

**`src/lib/permissions.js` — add `canAssignTasks` capability:**

In `resolveCapabilities({ role, permissions })`, add:
```js
canAssignTasks: full,  // owner/admin only; members false
```

No other API changes. `createTask` and `updateTask` already accept `assigned_to` — the DB rejects it from members via RLS.

### 3.3 Components

**`src/components/tasks/CreateTaskDialog.jsx` — add Assignee picker:**

```jsx
const { canAssignTasks } = usePermissions()
const { data: teamMembers = [] } = useTeamMembers()

// Build assignee options: all active members EXCEPT owner-tier users
// (owners cannot receive assignments; filter by system_role !== 'owner' and !== 'superadmin')
const assigneeOptions = teamMembers.filter(
  m => m.system_role !== 'owner' && m.system_role !== 'superadmin'
)
```

- When `canAssignTasks` is `false` (member): **do not render the Assignee field at all**.
- When `canAssignTasks` is `true` (owner/admin): render a Select dropdown.
  - Default value: "No assignee" (personal task). Sentinel value: `'__none__'`.
  - Options: each active non-owner team member shown as avatar + full name + role badge.
  - "Assign to myself" shortcut as the first real option (owner/admin can assign to themselves — they're non-owner members if they're admin, but owner self-assign is for personal tasks so just default to "No assignee" and let them pick themselves from the list if they're in the member list).
  - On client change: do not reset assignee (tasks can be assigned regardless of client).

Position: below the Campaign dropdown, above Title.

**`src/components/tasks/EditTaskDialog.jsx` — same Assignee picker:**

- When `canAssignTasks` is true: show Assignee picker, pre-filled from `task.assigned_to`.
- When member: no assignee field. Their personal tasks have `assigned_to = null`, which they can't change.
- On submit: calls `updateTask(taskId, { ..., assigned_to })`.

**`src/pages/TasksAndReminders.jsx` — member-restricted `TaskCard`:**

Import `usePermissions()` and `useAuth()`. In `TaskCard`, receive `canAssignTasks` and `currentUserId` as props.

Determine the caller's relationship to the task:
```js
const isCreator  = task.created_by === currentUserId
const isAssignee = task.assigned_to === currentUserId
const canEdit    = canAssignTasks || isCreator
```

Apply:
- **Status toggle** (circle/check button): visible when `isCreator || isAssignee || canAssignTasks`. Calls `updateTaskStatus` via the RPC path.
- **Edit button** (`<Pencil>`): visible only when `canEdit`.
- **Archive button** (`<Archive>`): visible only when `canEdit`.
- **Delete button** (`<Trash2>`): visible only when `canEdit`.
- **Restore button** (on archived tasks): visible only when `canEdit`.

Result: members see the status toggle on tasks assigned to them, and full controls on their own personal tasks. They see read-only cards for tasks they can't act on (though RLS means they shouldn't see unrelated assigned tasks at all).

**Create/New Task button:**
- Visible for all roles (everyone can create personal tasks). No gating on the button itself.
- The dialog internally hides the assignee picker for members.

**`src/pages/clients/clientSections/OverviewTab.jsx`:**
- The "New Task" button or quick-add: always visible (members can create personal tasks linked to the client). `canAssignTasks` determines whether the dialog shows the assignee picker.

**`src/pages/campaigns/CampaignDetailPage.jsx`:**
- Same as OverviewTab — button visible to all, picker gated by `canAssignTasks`.

### 3.4 What This Phase Does NOT Include

- Task notifications on assignment — out of scope (confirmed)
- Bulk assign — future feature
- Restricting which admin can assign to which member (any admin can assign to any non-owner) — by design

### 3.5 Phase 3 Checklist — Before Marking Complete

- [x] `canAssignTasks: full` added to `resolveCapabilities` in `src/lib/permissions.js`
- [x] `CreateTaskDialog`: assignee picker rendered for owner/admin; completely absent for members
- [x] Assignee dropdown excludes owner and superadmin rows
- [x] `EditTaskDialog`: same assignee picker gating; pre-fills from `task.assigned_to`
- [x] Members see full controls (edit/archive/delete) on tasks they personally created
- [x] Members see status-toggle only on tasks assigned to them (no edit/archive/delete)
- [x] Members cannot see the edit/delete/archive buttons on any task they did not create
- [x] `canAssignTasks` flag is `false` for members in `usePermissions()` output
- [ ] DB-level test: member calling `createTask` with `assigned_to` set is rejected by RLS INSERT policy
- [x] `OverviewTab.jsx` "New Task" visible to all; assignee picker gated (by CreateTaskDialog internals)
- [x] `CampaignDetailPage.jsx` "New Task" visible to all; assignee picker gated (by CreateTaskDialog internals)
- [x] `npm run build` passes with no errors

**Implementation Notes:**
- `usePermissions()` called directly inside `TaskCard` — avoids prop-drilling through `TasksGroup` and `KanbanTasksView`.
- `canToggle = isCreator || isAssignee || canAssignTasks` gates the status circle; `canEdit = canAssignTasks || isCreator` gates the entire actions bar.
- Assignee picker uses `full_name || email` fallback — matches the pattern in `TeamSettings.jsx` and `TasksAndReminders.jsx`. The Phase 3 spec referenced `first_name`/`last_name` but the RPC returns `full_name` as a single field.
- DB-level RLS test left unchecked — requires a member-role test account; the policy itself was applied in Phase 1 and has not changed.
- Dropdown menu always rendered when `canToggle || canEdit`; status items gated by `canToggle`; edit/delete gated by `canEdit`. This avoids the empty dropdown problem where members saw no menu at all.

---

## UI Polish ✅ Complete

Additional refinements applied after Phase 3 approval. Not a formal phase — these were incremental improvements made during review.

### Dialog Redesign (CreateTaskDialog + EditTaskDialog)

Both dialogs replaced with a Notion-style document layout:
- Top section: bare `<input>` for title (no border, no label, `text-xl font-semibold`) + `<textarea>` for description (auto-resize, no border)
- `MetaRow` pattern for metadata: label (`w-20 shrink-0 text-xs text-muted-foreground`) + value in a flex row
- Metadata fields in order: Client → Assignee (owner/admin only) → Priority → Due date → Campaign
- `DialogHeader` with `DialogTitle` + `DialogDescription` added above the writing area
- Priority rendered as colored dot pill buttons (`PRIORITY_CONFIG` with `dot` and `active` classes per level) — not a Select or radio group
- Assignee options show: avatar (or initial fallback) + name + `(You)` tag + `SYSTEM_ROLE_PALETTE` role badge at right edge
- Footer: Cancel (ghost) + Save (primary), Save disabled when title is empty
- Red asterisk on mandatory fields was added then removed at user request — no asterisks

### Filter & URL State Refinements

- **`setParams` atomic helper** in `TasksAndReminders.jsx`: fixes React 18 batching bug where two sequential `setSearchParams` calls both read the original `prev`. All multi-param URL updates now go through one `setParams(updates)` call.
- **"Created by me" filter** (`?creator=1` URL param): toggle button in filter bar, visible only when `canAssignTasks` (owner/admin). Filters `filteredTasks` by `task.created_by === currentUserId`.
- **Client select truncation fix**: trigger uses `min-w-0` + `truncate` on inner span; filter icon is `shrink-0`.
- **`selectedClient` and `assignedToMe` params** now reset atomically when switching client filter (single `setParams` call).

### "(You)" Tag

Added in three surfaces when `task.assigned_to === currentUserId` (or `member_user_id === user.id` in option lists):
- **Task card** (grid view): inline after assignee name
- **Kanban card**: same
- **Table view**: same, in the assignee cell
- **Assignee select options** in CreateTaskDialog + EditTaskDialog: inline after name in dropdown option

`memberMap` in `TasksAndReminders.jsx` includes a synthetic entry for the workspace owner (who is not in `agency_members`) built from `user.user_metadata`.

### Kanban Equal Heights

`grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-stretch` — all columns stretch to match the tallest. Each `KanbanColumn` uses `flex flex-col h-full`.

### Sidebar Overdue Badge

- New hook `useMyOverdueTaskCount()` in `src/api/tasks.js`
- Query: `status NOT IN ('COMPLETED','ARCHIVED') AND due_at < now() AND (assigned_to = me OR created_by = me)`
- Query key: `['tasks', 'list', 'overdue-count', user.id]` — nested under `'list'` so existing `['tasks', 'list']` invalidations catch it automatically
- Badge: `bg-amber-500 text-white` on the Tasks & Todos nav item — amber distinguishes "your own overdue" from rose (external approvals) and pink (submissions changes requested)
- A generic TODO count was considered and rejected: it would never reach zero (user controls it themselves), making it noise. Overdue is meaningful because it goes to zero when caught up.

### Tags Decision — Deferred

Tags on tasks were discussed and deferred indefinitely. Tasks have enough structure (client / campaign / priority / status / assignee) to cover most categorization needs. Tags would only be worth revisiting if cross-cutting labels like "blocked" or "waiting-on-client" emerge as a recurring pain point, and even then a fixed label/flag field would be preferable over free-form tags.

---

## Phase 4 — Context Integration

### Goal

After Phase 4, tasks are surfaced in three places beyond the main page: a dedicated Tasks tab in the Client Detail profile, a compact inline task list in Campaign Detail (replacing the existing "Go to tasks" deep-link), and a "My Tasks" widget on the Dashboard. All surfaces are permission-aware and consistent with the RBAC rules from Phase 3.

### Before Starting — Confirm Phase 3 is Approved

1. Read `src/pages/clients/ClientProfileView.jsx` — get the exact list of tab `value` attributes and trigger labels in order; identify where to insert the Tasks tab (expected position: after Workflow, before Documents).
2. Read `src/pages/campaigns/CampaignDetailPage.jsx` — find the existing "Go to tasks" button and the `campaign-notes` section; understand the layout to know where the inline task list fits.
3. Read `src/pages/dashboard/DashboardMeetingsNotes.jsx` in full — understand the existing structure to know what to keep and what to add for the "My Tasks" widget. Do not remove the existing meetings or notes sections.
4. Confirm `useTasks({ clientId })` and `useTasks({ campaignId })` work correctly from Phase 1.
5. Read `.claude/skills/empty-states/SKILL.md` for the correct empty state pattern (used in `TasksTab.jsx`).

### 4.1 Database

No changes.

### 4.2 API Layer

No new functions. `useTasks` with `clientId` and `campaignId` filters cover all new surfaces.

For the Dashboard "My Tasks" widget, a filtered query is needed. The cleanest approach is to pass `assignedToMe: true` in the `useTasks` call and add client-side filtering for `created_by === currentUserId && assigned_to === null` (personal tasks). This can be done in the component or as a new `useMyTasks()` hook in `src/api/tasks.js`:

```js
export function useMyTasks({ limit } = {})
// Returns tasks where (assigned_to = currentUser OR (created_by = currentUser AND assigned_to IS NULL))
// AND status NOT IN ('COMPLETED', 'ARCHIVED')
// Sorted: overdue first (due_at < now()), then by priority DESC, then due_at ASC
// The query can be expressed as: fetch useTasks() and filter client-side, or
// add a dedicated query with two OR conditions. Prefer a dedicated query for efficiency.
```

### 4.3 Components

**New: `src/components/tasks/TasksTab.jsx`**

Compact list view scoped to a client. Props: `clientId?: string`.

Layout:
- Header row: "Tasks" heading + count badge + "New Task" button (opens `CreateTaskDialog` with `clientId` and `lockClient=true`)
- Status filter chips: All / Active (TODO + IN_PROGRESS) / Completed / Archived — compact pills, not the full tab row
- Task list: each row has status icon (circle/check toggle), title, priority badge, assignee avatar, due date chip. No cards — a tight list row.
- Empty state: use `<Empty>` + `<EmptyContent>` pattern per the empty-states skill. Icon: `ClipboardList` from lucide. Title: "No tasks yet". Description: "Assign tasks to the team or create your own to-dos linked to this client."
- Loading state: 4 skeleton rows
- "Open in Tasks" link at the bottom → navigates to `/operations/tasks` (no filter pre-applied in Phase 4)
- Permission-aware: "New Task" button always visible (all roles can create personal tasks); assignee picker inside dialog gated by `canAssignTasks` (already handled by `CreateTaskDialog` from Phase 3)

**`src/pages/clients/ClientProfileView.jsx`**

Insert Tasks tab:
```jsx
// In TabsList — after Workflow trigger:
<TabsTrigger value="tasks">Tasks</TabsTrigger>

// In TabsContent area — after Workflow content:
<TabsContent value="tasks">
  <TasksTab clientId={clientId} />
</TabsContent>
```

Exact insertion point: read the file at build time to confirm the Workflow tab's `value` and insert directly after its `TabsContent` closing tag.

**`src/pages/clients/clientSections/OverviewTab.jsx`**

The existing "Go to tasks" button currently navigates away to `/operations/tasks`. Replace it with a button that switches to the Tasks tab within the same client profile. This requires either:
- (a) A `setActiveTab` callback prop passed down from `ClientProfileView` into `OverviewTab`, or
- (b) A `useNavigate` call to the same client URL with `?tab=tasks` if `ClientProfileView` reads tab from URL params.

At build time, read `ClientProfileView.jsx` to determine whether tabs are URL-driven or state-driven, then pick the correct approach. If neither mechanism exists yet, use approach (a): pass `onGoToTasks={() => setTab('tasks')}` as a prop from `ClientProfileView` into `OverviewTab`.

**`src/pages/campaigns/CampaignDetailPage.jsx`**

Replace the existing "Go to tasks" deep-link with an inline compact task list:
- Use `useTasks({ campaignId })` (already wired in Phase 1)
- Show up to 8 tasks in a compact list (same row style as `TasksTab.jsx`)
- "New Task" button opens `CreateTaskDialog` with `campaignId` and `campaignName` pre-filled and locked
- A "Show more / View all" link that navigates to `/operations/tasks` when there are more than 8 tasks
- Section header: "Tasks" with a count badge
- Empty state: `<Empty>` with `ClipboardList` icon. Title: "No tasks for this campaign". No separate "Go to tasks" button — the full-page link handles navigation.

**`src/pages/dashboard/DashboardMeetingsNotes.jsx` — add "My Tasks" widget:**

Do not remove existing content. Add a "My Tasks" section:
- Uses `useMyTasks({ limit: 5 })` (the new hook from 4.2)
- Shows: status icon (toggleable inline → calls `updateTaskStatus`), title, priority badge, due date, client badge
- "View all" link → `/operations/tasks`
- "New Task" shortcut button → opens `CreateTaskDialog` with no pre-fills
- Empty state: "No pending tasks" with a muted check icon — no full `<Empty>` treatment needed here (it's a dashboard widget)
- Loading: 3 skeleton rows

### 4.4 Integration

**`src/components/sidebar/nav-main.jsx`** — no changes needed. "Tasks & Todos" is already a standalone top-level nav item at `/operations/tasks` with the `ListTodo` icon (promoted from an Operations sub-item between Phase 2 and Phase 3; no `requiresPermission` so visible to all roles).

**Deep-link audit** — search for any remaining references to `['global-notes']`, `['client-notes']`, or `['campaign-notes']` and update them to `['tasks', 'list']`. (These should all have been caught in Phase 1, but verify.)

### 4.5 What This Phase Does NOT Include

- URL-based filter pre-application on the global tasks page (e.g. `/operations/tasks?client=<id>`) — link goes to the full page unfiltered; acceptable for Phase 4
- Kanban view inside `TasksTab.jsx` — compact list only; full kanban is on the dedicated page
- Task comments/threads — out of scope
- Task notifications — out of scope (confirmed)
- Recurring tasks — out of scope
- Sub-tasks / checklists — out of scope

### 4.6 Phase 4 Checklist — Before Marking Complete

- [ ] `TasksTab.jsx` created; accepts `clientId` prop; status filter chips; compact row list; empty state; loading skeleton
- [ ] Client Detail page has a "Tasks" tab in `TabsList`; `TasksTab` renders; tab shows correct client-scoped tasks
- [ ] "New Task" in `TasksTab` opens `CreateTaskDialog` with `clientId` locked; task appears in the list after save
- [ ] Inline status toggle on `TasksTab` rows works (calls `updateTaskStatus`)
- [ ] OverviewTab "Go to tasks" button now navigates to the Tasks tab within the same client profile (not to the global tasks page)
- [ ] Campaign Detail page shows inline task list (up to 8 tasks); "New Task" creates campaign-linked tasks; "Show more / View all" appears when >8
- [ ] Campaign inline task status toggle works
- [ ] Dashboard "My Tasks" widget shows up to 5 of the current user's pending tasks; inline toggle works; "View all" links to `/operations/tasks`; "New Task" shortcut works
- [ ] All three new surfaces respect Phase 3 RBAC (members see status-only; admins see full controls)
- [ ] Empty states correct on Tasks tab and campaign inline list
- [ ] `npm run build` passes with no errors

**→ Stop here. Show the result and wait for approval.**

---

## Data Model Summary (Final State After All Phases)

```
auth.users (owner)
└── agency_subscriptions   (workspace billing)
└── agency_members         (team roles + permissions)
└── tasks                  (NEW — this feature)
    ├── workspace_id       → get_my_agency_user_id() — workspace scope
    ├── created_by         → auth.uid() of the creator
    ├── assigned_to        → auth.uid() of assignee (NULL = personal, private)
    ├── client_id          → optional client context
    └── campaign_id        → optional campaign context
```

### `tasks` — Final Schema

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK, `DEFAULT gen_random_uuid()` |
| `workspace_id` | UUID NOT NULL | FK → `auth.users(id)` ON DELETE CASCADE; RLS scope via `get_my_agency_user_id()` |
| `created_by` | UUID NOT NULL | FK → `auth.users(id)`; the creator's actual UID (not workspace owner) |
| `assigned_to` | UUID | FK → `auth.users(id)`; NULL = personal task; non-null = team task |
| `title` | TEXT NOT NULL | Required |
| `description` | TEXT | Optional |
| `status` | TEXT NOT NULL | CHECK: `TODO` / `IN_PROGRESS` / `COMPLETED` / `ARCHIVED`; default `TODO` |
| `priority` | TEXT NOT NULL | CHECK: `LOW` / `NORMAL` / `HIGH` / `URGENT`; default `NORMAL` |
| `due_at` | TIMESTAMPTZ | Optional deadline |
| `completed_at` | TIMESTAMPTZ | Stamped by `update_task_status` when status → `COMPLETED`; cleared on revert |
| `client_id` | UUID | FK → `clients(id)` ON DELETE SET NULL; optional context |
| `campaign_id` | UUID | FK → `campaigns(id)` ON DELETE SET NULL; optional context |
| `created_at` | TIMESTAMPTZ NOT NULL | `DEFAULT now()` |
| `updated_at` | TIMESTAMPTZ NOT NULL | `DEFAULT now()` |

### RLS Summary

| Policy | Operation | Who |
|---|---|---|
| `tasks_select` | SELECT | Creator OR assignee OR workspace admin |
| `tasks_insert` | INSERT | Any workspace member (personal tasks); admin/owner only for `assigned_to IS NOT NULL` |
| `tasks_update` | UPDATE | Creator OR workspace admin (full edits only) |
| `tasks_delete` | DELETE | Creator OR workspace admin |

### New RPC

| Function | Access | Purpose |
|---|---|---|
| `update_task_status(p_task_id, p_status)` | SECURITY DEFINER | Status transitions for creator, assignee, or admin; stamps/clears `completed_at` atomically |

### New Capability Flag

| Flag | Location | Value |
|---|---|---|
| `canAssignTasks` | `src/lib/permissions.js` `resolveCapabilities` | `true` for owner/admin/superadmin; `false` for members |

---

## Impact on Existing Features

| Existing Feature | Impact | Action Required |
|---|---|---|
| Tasks & Reminders (`/operations/tasks`) | Full rewire; 4 statuses; 4-column kanban; priority + assignee UI | Phases 1–3 |
| Client Overview tab — inline tasks | Query key updated; status display updated | Phase 1 |
| Campaign Detail — task section | Query key updated; Phase 4 upgrades to inline widget | Phases 1 + 4 |
| Dashboard tasks/notes widget | Query key updated; Phase 4 adds My Tasks section | Phases 1 + 4 |
| Notes page (`/operations/notes`) | No change — separate `agencyNotes.js` + `notes` table | None |
| Note Editor | No change | None |
| Note Tags | No change — separate `note_tags` / `note_tag_links` tables | None |
| RBAC (`src/lib/permissions.js`) | `canAssignTasks` added to `resolveCapabilities` | Phase 3 |

---

## Out of Scope (All Phases)

- **Task notifications (email/in-app on assignment)** — confirmed out of scope; future feature
- **Task comments / threads** — future feature
- **@mentions in task descriptions** — future feature
- **Recurring tasks** — future feature
- **Sub-tasks / checklists** — future feature
- **Bulk operations** (bulk assign, bulk archive, bulk status change) — future feature
- **Task templates** — future feature
- **Time tracking against tasks** — future feature
- **Subscription / feature gating** — Tasks available on all plans; no gating needed
- **URL-based filter pre-application on the global tasks page** — link goes to unfiltered global page; acceptable Phase 4 scope
- **Kanban view inside `TasksTab`** — compact list only in the tab context; full kanban on dedicated page
- **Per-client member assignment scoping** (member only sees tasks for clients they're assigned to) — future; out of RBAC scope too
