# Feature: Task Collaboration — History, Watchers & Detail Page
**Product**: Tercero — Social Media Agency Management SaaS  
**File**: `.claude/features/09-task-collaboration.md`  
**Status**: Planned — verified against live DB (project `ockvcyevnozuczzngrwg`) via MCP  
**Last Updated**: August 2026

---

## Context

Tasks are currently a flat record: one assignee, no history, no conversation, and a
detail view that only exists as a sheet. Agency work doesn't move that way — a reel
goes videographer → editor → strategist → social media manager, and today only an
owner or admin can move it, while everyone who touched it loses sight of it the moment
they hand it on.

This feature makes a task a place work actually lives: any member can hand a task on,
everyone who has held it keeps access and gets notified, and the task graduates from a
sheet to a real page (`/tasks/:taskId`) with Deliverables, Comments and Activity tabs —
the same graduation prospects, proposals, campaigns and deliverables already made.

Tasks stay a **record**, not an approval workflow. The deliverable approval loop
(`DRAFT → SUBMITTED → READY → PENDING_APPROVAL`) is untouched, and the two state
machines stay decoupled in both directions except for one explicit, one-way rule in
Phase 4.

---

## Phase Overview

```
Phase 1 — Handoff, History & Watchers
  Any member can reassign; every assignment and status change is recorded in
  task_activity; past assignees keep access and get notified.

Phase 2 — Task Detail Page
  /tasks/:taskId with a meta rail and Deliverables + Activity tabs. The sheet
  stays as a lean peek. Watchers chip (eye + count + hover card).

Phase 3 — Comments on Tasks
  Widen the comments table to entity_type 'task' with task-scoped RLS and
  fan-out, and add the Comments tab.

Phase 4 — Deliverable-Driven Auto-Completion
  When every deliverable linked to a task is PUBLISHED or DELIVERED, the task
  auto-completes with a system actor.
```

**After each phase: stop and wait for approval before proceeding.**

---

## Phase 1 — Handoff, History & Watchers ✅ Complete

### Goal

After Phase 1, a videographer can finish a shoot and hand the task to the editor
themselves, instead of asking an admin to do it. Everyone who has ever held the task —
plus its creator — keeps access to it and is notified when it moves again, so the person
who shot the footage can still see what happened to it. Every assignment and status
change is recorded, so "who was this assigned to, and who assigned it" is answerable.
No new pages yet; the existing sheet and dialogs gain the new capability.

### Before Starting — Verified Against the Live Database

This section was originally a checklist to confirm before writing SQL. It has since
been verified directly against the live Supabase project (`ockvcyevnozuczzngrwg`) via
MCP. Findings that changed the plan are called out; everything else confirmed exactly
as assumed.

1. **`tasks` RLS — confirmed, and it's stricter than first assumed.**
   ```
   tasks_select  (SELECT): workspace_id = get_my_agency_user_id() AND
                           (created_by = auth.uid() OR assigned_to = auth.uid() OR is_workspace_admin())
   tasks_insert  (INSERT): workspace_id = get_my_agency_user_id() AND created_by = auth.uid() AND
                           (assigned_to IS NULL OR is_workspace_admin())
   tasks_update  (UPDATE): workspace_id = get_my_agency_user_id() AND
                           (created_by = auth.uid() OR is_workspace_admin())
   ```
   **`tasks_update` has no `assigned_to`-specific carve-out — it blocks the entire row for
   non-creator/non-admin.** A member cannot execute *any* UPDATE against a task they
   didn't create, including one that only touches `assigned_to`. This means handoff
   cannot be "just widen the policy" — it requires a SECURITY DEFINER RPC (§1.1,
   `reassign_task`), exactly the shape `update_task_status` already uses for status.
2. **`is_workspace_admin()` — confirmed, and it includes the owner.** Its actual body is
   `is_workspace_owner() OR (system_role IN ('admin','superadmin'))`. So everywhere this
   doc says "admin", read it as **owner OR admin OR superadmin** — there's no separate
   owner check needed anywhere.
3. **`tg_notify_task_changes()` — read in full; confirmed the exact gap.**
   - On INSERT: notifies `assigned_to` only.
   - On UPDATE: if `assigned_to` changed (and is not null), notifies the **new** assignee
     only — the outgoing assignee gets nothing, not even a "this moved off you" ping.
   - On UPDATE: if `status` changed, notifies `[assigned_to, created_by]` only — no
     watchers.
   - Link is hardcoded to `/tasks` (matches `routes.js`'s current mapping; Phase 2 fixes
     this).
   Phase 1 replaces this function body (§1.1) to add the outgoing assignee and the
   watcher set to both branches.
4. **`update_task_status(p_task_id uuid, p_new_status text)`** — confirmed SECURITY
   DEFINER; param is `p_new_status`, not `p_status`. Stamps/clears `completed_at`. Phase
   1 does not modify this function — `reassign_task` is a new, separate RPC.
5. **`src/lib/permissions.js`** — `canAssignTasks` is `full` (owner/admin/superadmin).
   Confirmed consumers: `TasksAndReminders.jsx:868`, `TasksTab.jsx:196`,
   `CreateTaskDialog.jsx:120`, `EditTaskDialog.jsx:104`, `TaskCard.jsx:535`. Its meaning
   is unchanged by this phase (§1.2).
6. **`get_team_members(p_agency_user_id)`** — confirmed return columns include
   `system_role`, `functional_role`, `avatar_url`, `full_name` (built from
   `raw_user_meta_data`, falling back to email). Covers the assignee filter and the
   Phase 2 watcher hover card.
7. **`get_my_agency_user_id()`** — confirmed: `COALESCE(` owner path via
   `agency_subscriptions`, `agency_members` path via `member_user_id = auth.uid() AND
   is_active`)`.
8. **`agency_members` columns** — confirmed: `agency_user_id`, `member_user_id`,
   `system_role`, `is_active`, `functional_role`, `permissions`. Matches §1.1's
   `enforce_task_assignment` exactly.
9. **No existing `task_activity` / `task_assignments` table, and no naming collision**
   with the new trigger/function names against the live trigger list on `tasks`
   (`trg_notify_task_changes` only) or `comments` (`trg_notify_comment_added` only).
10. **No security advisor currently flags `tasks`, `comments`, `task_posts`, or
    `notifications`** — clean baseline before this migration.

### 1.1 Database

**New table — `task_activity`**

Deliberately narrow: two event types, not a general audit log. It serves three jobs —
the Activity tab (Phase 2), the watcher set, and the "Assigned By" field that is
currently wrong.

```sql
create table public.task_activity (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null,
  task_id       uuid not null references public.tasks(id) on delete cascade,
  type          text not null check (type in ('assigned','status_changed')),
  actor_user_id uuid,          -- auth.uid() that caused it; NULL = system (Phase 4)
  from_user_id  uuid,          -- 'assigned': previous assignee (NULL = was unassigned)
  to_user_id    uuid,          -- 'assigned': new assignee     (NULL = unassigned)
  from_status   text,          -- 'status_changed'
  to_status     text,          -- 'status_changed'
  created_at    timestamptz not null default now()
);

create index task_activity_task_created_idx
  on public.task_activity (task_id, created_at desc);

-- Participant lookup (watchers). Partial index — only assignment rows matter.
create index task_activity_participants_idx
  on public.task_activity (task_id, to_user_id)
  where type = 'assigned';
```

**Logging trigger**

```sql
create or replace function public.tg_log_task_activity()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.assigned_to is not null then
      insert into task_activity (workspace_id, task_id, type, actor_user_id, to_user_id)
      values (new.workspace_id, new.id, 'assigned', auth.uid(), new.assigned_to);
    end if;
    insert into task_activity (workspace_id, task_id, type, actor_user_id, to_status)
    values (new.workspace_id, new.id, 'status_changed', auth.uid(), new.status);
    return new;
  end if;

  if new.assigned_to is distinct from old.assigned_to then
    insert into task_activity (workspace_id, task_id, type, actor_user_id, from_user_id, to_user_id)
    values (new.workspace_id, new.id, 'assigned', auth.uid(), old.assigned_to, new.assigned_to);
  end if;

  if new.status is distinct from old.status then
    insert into task_activity (workspace_id, task_id, type, actor_user_id, from_status, to_status)
    values (new.workspace_id, new.id, 'status_changed', auth.uid(), old.status, new.status);
  end if;

  return new;
end $$;

-- Naming follows the project's existing convention exactly: notify-style AFTER
-- functions are prefixed tg_ (tg_notify_task_changes, tg_notify_comment_added);
-- their triggers are prefixed trg_ with the same suffix.
create trigger trg_log_task_activity
  after insert or update on public.tasks
  for each row execute function public.tg_log_task_activity();
```

**Participant helper — SECURITY DEFINER, and it must be**

`tasks_select` will reference `task_activity`, and `task_activity`'s own SELECT policy
references task visibility. Left as plain SQL that is infinite recursion. The helper
bypasses RLS to break the cycle.

```sql
create or replace function public.is_task_participant(p_task_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from task_activity ta
    where ta.task_id = p_task_id
      and ta.type = 'assigned'
      and ta.to_user_id = auth.uid()
  );
$$;
revoke execute on function public.is_task_participant(uuid) from public, anon;
grant execute on function public.is_task_participant(uuid) to authenticated;
```

**Widen `tasks_select`** — confirmed live definition, safe to `drop policy` by exact name.

```sql
drop policy "tasks_select" on public.tasks;
create policy "tasks_select" on public.tasks for select using (
  workspace_id = get_my_agency_user_id()
  and (
    is_workspace_admin()
    or created_by = auth.uid()
    or assigned_to = auth.uid()
    or is_task_participant(id)     -- past assignees keep access
  )
);
```

**`tasks_update` is deliberately left untouched.** It stays `created_by = auth.uid() OR
is_workspace_admin()` for both `USING` and `WITH CHECK`. A member still cannot run a
direct `UPDATE tasks SET ...` for any reason — including one that only sets
`assigned_to`. The only door open to a non-creator, non-admin member is the new
`reassign_task` RPC below, which is SECURITY DEFINER and therefore bypasses this policy
by design, the same way `update_task_status` already bypasses it for status. This
keeps the blast radius of "members can now write to tasks they don't own" limited to
exactly one column, instead of reopening the whole row.

**`reassign_task` RPC — the actual handoff mechanism.**

```sql
create or replace function public.reassign_task(p_task_id uuid, p_assigned_to uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_task public.tasks;
begin
  select * into v_task from public.tasks where id = p_task_id;

  if not found then
    raise exception 'task_not_found';
  end if;

  if v_task.workspace_id <> public.get_my_agency_user_id() then
    raise exception 'access_denied';
  end if;

  -- Caller must already be a participant: creator, current assignee, a past
  -- assignee, or an admin. Mirrors tasks_select exactly — you can only hand off
  -- work you already have a hand in.
  if v_task.created_by <> auth.uid()
     and (v_task.assigned_to is null or v_task.assigned_to <> auth.uid())
     and not public.is_task_participant(p_task_id)
     and not public.is_workspace_admin()
  then
    raise exception 'access_denied';
  end if;

  -- Target-side validity (active member, not owner/superadmin) is enforced by the
  -- trg_enforce_task_assignment BEFORE trigger below — it fires on this UPDATE
  -- regardless of SECURITY DEFINER, since only RLS (not triggers) is bypassed.
  update public.tasks set assigned_to = p_assigned_to, updated_at = now()
  where id = p_task_id;
end $$;

revoke execute on function public.reassign_task(uuid, uuid) from public, anon;
grant execute on function public.reassign_task(uuid, uuid) to authenticated;
```

**`task_activity` RLS**

```sql
alter table public.task_activity enable row level security;

create policy "task_activity_select" on public.task_activity for select using (
  workspace_id = get_my_agency_user_id()
  and exists (select 1 from public.tasks t where t.id = task_id)  -- tasks RLS applies
);
-- No INSERT/UPDATE/DELETE policies: rows are written only by the SECURITY DEFINER
-- trigger. Nothing may forge or rewrite history.
```

**Assignment enforcement — confirmed the rule previously existed only as a hidden form
field (`CreateTaskDialog`/`EditTaskDialog` stripping owner/superadmin from the options
list), not a DB constraint on the *target*.** `tasks_insert`'s `assigned_to IS NULL OR
is_workspace_admin()` gates *who may set* `assigned_to`, but nothing gates *who may be
set* — an admin could currently assign a task to the owner via a crafted request, and
nothing would stop it. This trigger closes that gap and is the single source of truth
both `reassign_task` and the ordinary insert/update paths rely on.

```sql
create or replace function public.enforce_task_assignment()
returns trigger language plpgsql security definer set search_path = public as $$
declare target_role text;
begin
  if new.assigned_to is null
     or (tg_op = 'UPDATE' and new.assigned_to is not distinct from old.assigned_to) then
    return new;
  end if;

  select system_role into target_role
  from agency_members
  where agency_user_id = new.workspace_id
    and member_user_id = new.assigned_to
    and is_active = true;

  if target_role is null then
    raise exception 'Assignee is not an active member of this workspace';
  end if;

  if target_role in ('owner','superadmin') then
    raise exception 'Tasks cannot be assigned to the workspace owner';
  end if;

  return new;
end $$;

-- Guard-style functions in this codebase (enforce_post_status_transition,
-- prevent_illegal_updates) skip the tg_ prefix; only the trigger gets trg_.
create trigger trg_enforce_task_assignment
  before insert or update on public.tasks
  for each row execute function public.enforce_task_assignment();
```

**Backfill** — existing tasks have no history and would render an empty Activity tab.

```sql
insert into task_activity (workspace_id, task_id, type, actor_user_id, to_user_id, created_at)
select workspace_id, id, 'assigned', created_by, assigned_to, created_at
from tasks where assigned_to is not null;

insert into task_activity (workspace_id, task_id, type, actor_user_id, to_status, created_at)
select workspace_id, id, 'status_changed', created_by, status, created_at
from tasks;
```

**Watcher fan-out — full replacement of `tg_notify_task_changes`.** The confirmed live
version (see Before Starting §3) never notifies the outgoing assignee on handoff and
never notifies watchers at all. This replaces the function body; the trigger itself
(`trg_notify_task_changes`, already `AFTER INSERT OR UPDATE`) is untouched.

```sql
create or replace function public.tg_notify_task_changes()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_actor    uuid := auth.uid();
  v_watchers uuid[];
begin
  if (tg_op = 'INSERT') then
    if new.assigned_to is not null then
      perform public.emit_notifications(
        new.workspace_id, v_actor, array[new.assigned_to],
        'task_assigned', 'You were assigned a task', new.title,
        'task', new.id, '/tasks');
    end if;
    return new;
  end if;

  -- Watchers = creator + every past assignee (task_activity.to_user_id). Computed
  -- once per row; emit_notifications de-dupes against the other recipients and
  -- strips the actor, so overlap with assignee/creator is harmless.
  v_watchers := array(
    select distinct to_user_id from task_activity
    where task_id = new.id and type = 'assigned' and to_user_id is not null
  ) || new.created_by;

  if new.assigned_to is distinct from old.assigned_to then
    if new.assigned_to is not null then
      perform public.emit_notifications(
        new.workspace_id, v_actor, array[new.assigned_to],
        'task_assigned', 'You were assigned a task', new.title,
        'task', new.id, '/tasks');
    end if;
    -- The outgoing assignee previously got nothing at all on handoff.
    if old.assigned_to is not null then
      perform public.emit_notifications(
        new.workspace_id, v_actor, array[old.assigned_to],
        'task_reassigned', 'A task you held was reassigned', new.title,
        'task', new.id, '/tasks');
    end if;
    perform public.emit_notifications(
      new.workspace_id, v_actor, v_watchers,
      'task_reassigned', 'A task you''re watching was reassigned', new.title,
      'task', new.id, '/tasks');
  end if;

  if new.status is distinct from old.status then
    perform public.emit_notifications(
      new.workspace_id, v_actor, array[new.assigned_to, new.created_by] || v_watchers,
      'task_updated', 'Task status updated to ' || new.status, new.title,
      'task', new.id, '/tasks');
  end if;

  return new;
end $$;
```

Due-date and priority edits deliberately do not go through this trigger — it only fires
on `assigned_to`/`status`, per the `IS DISTINCT FROM` guards.

### 1.2 API Layer

`src/api/tasks.js`:

```js
// Read — activity feed for one task, newest first.
export function useTaskActivity(taskId)
//   queryKey: ['tasks', 'activity', taskId]
//   enabled: !!taskId

// Read — watcher user ids for one task (creator + past assignees, minus current
// assignee). Derived from the same activity query; no extra round trip.
export function useTaskWatchers(task)
//   Returns member-id array. Phase 2's chip resolves them via useTeamMembers().

// Mutation — narrow handoff. Calls the reassign_task(p_task_id, p_assigned_to) RPC
// (tasks_update RLS blocks a direct .update() for non-admin/non-creator callers —
// this is the only path, mirroring updateTaskStatus's call to update_task_status).
export async function reassignTask(taskId, assignedTo) {
  const { error } = await supabase.rpc('reassign_task', {
    p_task_id: taskId,
    p_assigned_to: assignedTo,
  })
  if (error) throw error
}
//   Invalidate: ['tasks','list'], ['tasks','activity',taskId]
```

`src/lib/permissions.js` — no change to `canAssignTasks`. It keeps its current meaning
(owner/admin) and keeps gating the **assignee filter** on list pages, which is a
management view. Handoff is a separate, unconditional capability for members.

### 1.3 Components

No new component files in this phase.

**`src/components/tasks/EditTaskDialog.jsx`** — remove the `canAssignTasks &&`
wrapper on the Assignee field. Safe because this dialog only ever opens for
`canEdit` (owner/creator, gated one level up in `TaskCard.jsx`), and `tasks_update`
RLS already permits a creator to change any field on their own task — `assigned_to`
included, no extra restriction there. The wrapper was UI-only redundancy, not a
real gate.

**`src/components/tasks/CreateTaskDialog.jsx`** — **left unchanged, `canAssignTasks`
gate stays.** `tasks_insert` RLS (confirmed live, unmodified by this migration)
requires `assigned_to IS NULL OR is_workspace_admin()` — a plain member cannot set
an assignee at *creation* time, full stop. This phase only added a handoff path
(`reassign_task`) for tasks that already exist; letting a member pick an assignee
on the create form would submit an INSERT the database still rejects. Widening
creation-time assignment (or letting a member self-assign at creation) is a
separate, undecided change — not in scope here.

Both dialogs keep the existing `assigneeOptions` filter that strips
`owner`/`superadmin` from the picker.

**`src/components/tasks/TaskCard.jsx` (`TaskDetailSheet`)**
- Add a **Reassign** control on the Assigned To row, available to the current assignee
  even when they lack full edit rights (`canEdit = isOwner || isCreator` stays as-is for
  the edit dialog). Handing work on is not the same permission as rewriting the task.
  Calls `reassignTask()`, which invokes the `reassign_task` RPC — not `updateTask()`.
- Fix **Assigned By**: it currently renders `task.created_by` under an "Assigned By"
  label (`TaskCard.jsx:347`). Read the latest `task_activity` assignment row's
  `actor_user_id` instead, falling back to `created_by` when there is no history.

**`src/components/notifications/NotificationBell.jsx`**
- Add a `task_reassigned` entry to `TYPE_CONFIG` (confirmed `notifications.type` has no
  DB check constraint — it's free text — so this is a UI-only addition, not a
  migration). Without it, reassignment notifications still work but fall back to the
  generic `Bell` icon/muted color instead of a distinct treatment.

### 1.4 Integration

No routing or nav changes in this phase.

### 1.5 Impact on Existing Features

| Feature | Impact | Watch for |
|---|---|---|
| Task visibility | `tasks_select` widens to past assignees | Members seeing more tasks than before — intended, but verify no cross-workspace leak |
| Chat task references | `task_reference_exists()` follows `tasks_select`, so past assignees can now resolve a reference | Confirm the "no access" path still works for genuine non-participants |
| Notifications | New watcher recipients on status/reassign | Volume — a long revision cycle pings a growing watcher list |
| Overdue task count | Unchanged (`assigned_to OR created_by`) | Members can now self-assign, so counts may shift |

### 1.6 What This Phase Does NOT Include

- No task detail page, no tabs, no watcher chip UI (Phase 2)
- No comments (Phase 3)
- No auto-completion (Phase 4)
- No unwatch/mute — deliberately deferred until real notification volume is observed
- No change to who may **edit** a task (still owner/creator)
- Owner/superadmin remain unassignable

### 1.7 Phase 1 Checklist — Before Marking Complete

- [x] `task_activity` exists with both indexes and RLS enabled, no write policies —
      confirmed via direct query against `pg_policies`/`information_schema.triggers`
- [x] `trg_log_task_activity` records assignment and status rows on insert and update —
      confirmed with a rolled-back live transaction test (see Implementation Notes)
- [x] `is_task_participant()` is SECURITY DEFINER and revoked from public/anon —
      confirmed via `get_advisors`; required a second follow-up migration (see notes)
- [x] `tasks_select` includes past assignees; migration applied without a recursion
      error (SECURITY DEFINER breaks the cycle by construction) — a genuine
      cross-workspace-leak test still wants a second real user account to fully close
- [x] `trg_enforce_task_assignment` exists and is wired to both INSERT and UPDATE;
      target-role rejection logic verified by reading the deployed function back,
      not yet exercised against a live attempt to assign the owner
- [x] A direct `.update({ assigned_to })` by a plain member is still rejected by
      `tasks_update` RLS — logically guaranteed since that policy was left
      byte-for-byte unchanged (confirmed via `pg_policies` before and after)
- [ ] `reassign_task` succeeds for creator, current assignee, and past assignee; fails
      with `access_denied` for a non-participant member — **not yet tested as a real
      non-admin authenticated user**; the rolled-back transaction test ran as the
      Postgres role, which bypasses RLS/RPC-caller checks entirely
- [x] Backfill ran; every pre-existing task has at least one activity row — confirmed
      (5 tasks → 10 rows: 5 `assigned` + 5 `status_changed`)
- [ ] A member can reassign a task to another member and to an admin — needs a live
      multi-account test in the running app
- [ ] A member who hands off a task can still open it afterwards — same, needs a live
      multi-account test
- [x] `tg_notify_task_changes` notifies: new assignee, outgoing assignee (new type —
      `task_reassigned`), and all *other* watchers on reassignment; assignee + creator +
      watchers on status change — confirmed via a rolled-back transaction test, which
      caught and fixed a real bug first (see Implementation Notes)
- [x] `task_reassigned` renders with a real icon in the bell, not the generic fallback —
      `TYPE_CONFIG` entry added, `ArrowRightLeft`/fuchsia
- [x] "Assigned By" in the sheet shows who actually assigned it, not the creator —
      reads the latest `task_activity` row's `actor_user_id`, falls back to `created_by`
- [x] `npm run lint` clean across every changed file

**Remaining before this phase is fully proven, not just structurally correct:** a live
smoke test in the running app with two real (non-owner, non-admin) member accounts —
one hands a task to the other, confirms the sheet updates, confirms both the outgoing
and incoming member see the right notifications, and confirms a non-participant member
still can't see or reassign the task. Everything DB-side has been verified directly
against the live project; what hasn't been verified is the RLS-as-a-real-authenticated-
user path, since SQL run via MCP executes as Postgres and bypasses that layer entirely.

**Implementation Notes**

- **`CreateTaskDialog` kept its `canAssignTasks` gate; only `EditTaskDialog`'s was
  removed.** The plan as originally written said "remove the wrapper on the Assignee
  field" for both dialogs. Re-checked against the live `tasks_insert` policy before
  touching either file: it still requires `assigned_to IS NULL OR is_workspace_admin()`
  at *creation* time — untouched by this phase, which only added a handoff path
  (`reassign_task`) for tasks that already exist. Removing the gate on
  `CreateTaskDialog` would have let a member pick an assignee that the INSERT then
  rejects. `EditTaskDialog` is different: it only ever opens for `canEdit`
  (owner/creator, gated one level up in `TaskCard.jsx`), and `tasks_update` RLS already
  lets a creator set any field on their own task — the wrapper there was UI-only
  redundancy, not a real restriction, so removing it is safe.
- **Two follow-up migrations were needed to fully lock down the new trigger
  functions**, beyond what the original plan anticipated. `get_advisors` flagged
  `enforce_task_assignment()` and `tg_log_task_activity()` as directly callable via
  `/rest/v1/rpc/...` by both `anon` and `authenticated` — pure trigger functions with
  no legitimate direct-call use case. `REVOKE ... FROM PUBLIC, anon` (matching this
  project's existing `security_revoke_trigger_functions_from_public` precedent) cleared
  `anon` but not `authenticated` — Supabase grants `EXECUTE` to `authenticated` via a
  separate default-privilege mechanism, independent of the `PUBLIC` grant. A second,
  explicit `REVOKE ... FROM authenticated` was required. `reassign_task` and
  `is_task_participant` remain intentionally callable by `authenticated` (that's the
  point of both) and still show up in the advisor — confirmed this matches the existing
  accepted baseline for this class of RPC (`update_task_status`, `task_reference_exists`
  are flagged identically and already accepted).
- **A real notification bug was caught and fixed via a rolled-back-transaction test,
  before this phase was called done.** The new assignee was receiving two separate
  notification rows for one reassignment: `task_assigned` ("You were assigned a task")
  and the generic `task_reassigned` "watching" broadcast. Cause: `trg_log_task_activity`
  fires before `trg_notify_task_changes` (Postgres runs same-event AFTER triggers on a
  table in alphabetical name order), so by the time `tg_notify_task_changes` computes
  the watcher list, the just-created assignment row is already in `task_activity` —
  making the brand-new assignee count as their own watcher. Fixed by excluding both the
  outgoing and incoming assignee from the generic broadcast (each already gets a
  tailored message). Verified fixed with a second identical test, wrapped in
  `BEGIN; ... ROLLBACK;` so nothing persisted in either test.
- **Three migrations total, applied via MCP `apply_migration`, with matching files
  written to `supabase/migrations/`** for git history: `20260811080247` (main),
  `20260811080419` + `20260811080513` (the two advisor-driven revokes), `20260811081828`
  (the notification-duplicate fix).

**→ Stop here. Show the result and wait for approval.**

---

## Phase 2 — Task Detail Page ✅ Complete

### Goal

A task becomes linkable. `/tasks/:taskId` renders the full record — details in a right
meta rail, tabs for Deliverables and Activity in the main column, and a watchers chip
showing who is following. Notifications, chat references and a deliverable's linked-task
list all point at a real URL instead of the bare `/tasks` list. The sheet survives as a
quick peek from the kanban board.

### Before Starting — Confirm Phase 1 is Approved

1. Read `src/pages/posts/postDetails/PostContent.jsx` for the established
   main-column + meta-rail layout (`lg:w-2/3` / `lg:w-1/3`, `MetaItem` rows) — the task
   page mirrors it.
2. Confirm `TasksAndReminders.jsx`'s `?task=<id>` deep-link handling so it can redirect.
3. Confirm `resolveNotificationRoute` in `src/components/notifications/routes.js` maps
   `task → /tasks`.
4. Confirm `src/components/ui/hover-card.jsx` exports `HoverCard`, `HoverCardTrigger`,
   `HoverCardContent`.

### 2.1 Database

No database changes in this phase.

### 2.2 API Layer

`src/api/tasks.js` — add `useTaskById(taskId)` (`['tasks','detail',taskId]`) returning
the task with client, campaign and assignee ids resolved.

### 2.3 Components

```
src/pages/tasks/
  TaskDetailPage.jsx        — route component; useHeader breadcrumbs
  TaskMetaRail.jsx          — status select, assignee, assigned by, client,
                              campaign, due, watchers chip
  TaskActivityFeed.jsx      — renders task_activity, newest first
src/components/tasks/
  TaskWatchers.jsx          — Eye icon + count; HoverCard listing avatar,
                              name, functional_role (NAMED_ROLE_COLORS dot)
```

Tabs in the main column: **Deliverables · Activity** (Comments added in Phase 3).
Deliverables tab reuses `DeliverablePreviewRow` from `TaskCard.jsx`.

### 2.4 Integration

- `src/App.jsx` — add `/tasks/:taskId` inside the protected group.
- `src/components/notifications/routes.js` — `task → /tasks/${entity_id}`.
- `src/components/tasks/PostLinkedTasks.jsx` — rows link to the page (keep the sheet
  for in-place triage, or switch to navigation — decide during the build).
- `TaskDetailSheet` — add an "Open task" link; body stays as-is.
- `TasksAndReminders.jsx` — `?task=<id>` redirects to `/tasks/:taskId`.

### 2.5 Impact on Existing Features

| Feature | Impact | Action |
|---|---|---|
| Notification routing | Task notifications deep-link properly | Old rows still say `/tasks`; acceptable |
| Chat task references | Can link to the page | Update `ChatThread`'s task route |
| Kanban/list flow | Unchanged — sheet still opens on card click | Verify no double navigation |

### 2.6 What This Phase Does NOT Include

- Comments tab (Phase 3), auto-completion (Phase 4)
- No editing from the page beyond what the sheet already allows
- No mobile-specific layout beyond the existing responsive stack

### 2.7 Phase 2 Checklist — Before Marking Complete

- [x] `/tasks/:taskId` renders for creator, assignee, past assignee and admin —
      visibility is entirely `tasks_select`'s (widened in Phase 1 to include past
      assignees via `is_task_participant`); the page adds no gate of its own. The
      multi-account leg is the same one Phase 1 still owes.
- [x] A non-participant member gets the not-found/no-access path, not a blank page —
      and the two are told apart: `useTaskExists` (`task_reference_exists` RPC) runs
      only once the row comes back invisible, so 🔒 "You don't have access" and 🗑️
      "Task not found" are distinct states. Same distinction `ChatEntityCard` already
      draws for chat references.
- [x] Meta rail matches the deliverable page's rail conventions — same
      `lg:w-2/3` / `lg:w-1/3` split, same `lg:sticky lg:top-20` aside, and `MetaItem`
      copied verbatim (`grid-cols-[96px_1fr]`, same type scale) from `PostContent.jsx`
- [x] Watchers chip shows the correct count; hover lists avatar, name, job role —
      `TaskWatchers.jsx`, `getRolePalette()` dot on `functional_role`
- [x] Activity feed renders assignment and status rows with actor names — including
      the unassign, first-assign and create-status cases, and a `NULL` actor renders
      as "Tercero" ready for Phase 4's system-actor rows
- [x] Notification click lands on the task page — required a migration the plan
      didn't anticipate (see Implementation Notes). Applied to the live project;
      `tg_notify_task_changes` now stamps `/tasks/<id>` on all five emit calls,
      verified by reading the deployed function back. The backfill was a no-op — the
      workspace holds no task notification rows yet (only `invoice` and `post`), so
      no historical row needed rewriting.
- [x] `?task=<id>` redirects; sheet still opens from the board
- [x] `npm run lint` clean across every changed file (and `npm run build` passes;
      the new Tailwind classes were verified present in `dist/assets/*.css`)

**Implementation Notes**

- **§2.1's "no database changes in this phase" was wrong, and the phase can't fully
  land without one.** `resolveNotificationRoute()` returns `notification.link`
  *before* consulting its entity map — the map is only a fallback for rows with no
  link. Every task notification row is stamped `'/tasks'` by
  `tg_notify_task_changes`, so changing `task: '/tasks'` → `` task: `/tasks/${entity_id}` ``
  in `routes.js` (done) has no effect on any real notification. The link has to be
  stamped at the source. Migration **applied** to `ockvcyevnozuczzngrwg` via MCP:
  `supabase/migrations/20260909101500_task_notifications_deep_link_to_task_page.sql`
  — replaces the function body byte-for-byte except for a `v_link` variable used in
  all five `emit_notifications` calls, and backfills existing `link = '/tasks'` rows
  from their own `entity_id`. A live query confirmed `tg_notify_task_changes` is the
  only function in the schema that stamps a `/tasks` link, so this is the whole fix.
- **`useTaskById` returns the raw row, not a resolved join.** §2.2 said "with client,
  campaign and assignee ids resolved". Every other task surface resolves those through
  `useTaskLookups()` (which also merges removed members so an old assignment still
  shows a name); joining server-side would have given the page a second, divergent
  source for the same three names. The page uses `useTaskLookups()` like the sheet and
  the cards do.
- **`?task=<id>` now redirects unconditionally, without looking the task up first.**
  The old handler searched the loaded list and opened a sheet only on a hit — which
  silently did nothing for a task the list didn't contain. Redirecting on the bare
  param hands that case to `/tasks/:taskId`, which is the only place that can tell
  "deleted" from "outside your RLS scope". The lookup, the two `canEdit`/`canToggle`
  derivations and the second `TaskDetailSheet` instance in `TasksAndReminders.jsx`
  were removed with it. The redirect sits after every hook so hook order is stable.
- **`PostLinkedTasks` keeps the sheet** (§2.4 left this open). Its rows are triage from
  inside a deliverable — navigating away would cost the user their place on the post,
  which is exactly the reason the file's own comment gives for using a sheet. The sheet
  header now carries an "Open task ↗" link, so the page is one click away from every
  sheet instead of replacing it.
- **`DeliverablePreviewRow` was promoted from a local function to a named export** of
  `TaskCard.jsx` so the Deliverables tab renders identical rows to the sheet.
- **Chat task references now point at `/tasks/:taskId`** (`ChatThread.jsx`,
  `ChatEntityCard.jsx`) — the page's own no-access state is strictly better than the
  old landing on a filtered list, and it reuses the same `task_reference_exists` RPC
  the chat card already calls.
- **Status options on the rail mirror the sheet's four exactly** (including ARCHIVED)
  rather than trimming to three, so the same task offers the same moves in both places.
  Reassign is gated `canEdit || isAssignee`, matching the sheet; `reassign_task` (which
  also admits past assignees) remains the real authority.

**→ Stop here. Show the result and wait for approval.**

---

## Phase 3 — Comments on Tasks ✅ Complete

### Goal

Discussion about a task lives on the task. Today "which three angles?" happens in chat
and is lost; after this phase it sits in the task's Comments tab with mentions,
reactions and notifications, reusing the existing `CommentThread`.

### Before Starting — Verified Against the Live Database

Confirmed directly (MCP), same session as Phase 1's verification:

1. **`comments_entity_type_check`** — real constraint name, confirmed:
   `CHECK (entity_type = ANY (ARRAY['post'::text, 'campaign'::text]))`.
2. **`comments` RLS — two policies, both narrower in scope than assumed.**
   ```
   "comments: workspace member can select" (SELECT):
     workspace_id = get_my_agency_user_id()
   "comments: author can insert" (INSERT):
     workspace_id = get_my_agency_user_id() AND author_user_id = auth.uid()
   "comments: author can update" (UPDATE):
     author_user_id = auth.uid()
   ```
   **The INSERT policy has no entity-type scoping at all.** The original plan here only
   rewrote SELECT — that closes the read side but leaves the write side open: without
   also fixing INSERT, any workspace member could *write into* a task's comment thread
   they cannot see, not just fail to read it back. Both must change together.
3. **`tg_notify_comment_added()` — read in full; confirmed a second bug.** It branches
   only on `entity_type = 'post'` vs. an unconditional `else` that assumes `'campaign'`.
   A `'task'` comment would silently fall into that `else` branch, generating a broken
   link (`/campaigns/<task_id>`) and campaign-shaped notification text. This is a
   concrete bug the migration must fix, not an enhancement.
4. **`soft_delete_comment(p_comment_id)`** — confirmed SECURITY DEFINER; checks
   `workspace_id` + (`author_user_id = auth.uid() OR is_workspace_admin()`), with no
   entity-type scoping. **No change needed** — once INSERT is properly scoped (item 2),
   only a legitimate task participant could ever have authored a task comment in the
   first place, so the lack of entity-awareness here is safe by construction, not a gap.

### 3.1 Database

**This is the security-critical phase**, confirmed doubly so by the live read above:
`comments` today lets every workspace member both read *and write* every comment,
because neither policy is entity-aware. Tasks are narrower (creator / assignee /
participant / admin per the widened `tasks_select` from Phase 1). Fixing only SELECT
(the original plan) would still let a non-participant post into a thread they can't see
— fixing both together is required.

```sql
-- 1. Allow the new entity type (real constraint name, confirmed above).
alter table public.comments drop constraint comments_entity_type_check;
alter table public.comments add constraint comments_entity_type_check
  check (entity_type in ('post','campaign','task'));

-- 2. SELECT: task comments follow task visibility; post/campaign unchanged.
drop policy "comments: workspace member can select" on public.comments;
create policy "comments: workspace member can select" on public.comments for select using (
  workspace_id = get_my_agency_user_id()
  and (
    entity_type <> 'task'
    or exists (select 1 from public.tasks t where t.id = entity_id)  -- tasks RLS applies
  )
);

-- 3. INSERT: same scoping on the write side — this is the bug fix, not the original
--    plan's SELECT-only change.
drop policy "comments: author can insert" on public.comments;
create policy "comments: author can insert" on public.comments for insert with check (
  workspace_id = get_my_agency_user_id()
  and author_user_id = auth.uid()
  and (
    entity_type <> 'task'
    or exists (select 1 from public.tasks t where t.id = entity_id)  -- tasks RLS applies
  )
);
-- "comments: author can update" is left untouched — editing your own comment needs no
-- entity check; you could only have authored it if INSERT already let you through.
```

**Fan-out — add the missing `task` branch to `tg_notify_comment_added`.** Currently a
two-way branch (`post` / implicit `campaign`); this makes it three-way. For
`entity_type = 'task'`, notify the task's creator + current assignee + watchers
(mirroring Phase 1's `v_watchers` computation) + mentions, with a `/tasks/...` link
(or `/tasks` until Phase 2 lands the detail route) — not the post-author path.

### 3.2 API Layer

No changes — `useComments({ entityType, entityId })` is already entity-generic.

### 3.3 Components

No new files. Add the **Comments** tab to `TaskDetailPage.jsx` rendering
`<CommentThread entityType="task" entityId={task.id} />`.

### 3.4 Integration

Optional: an unread/count indicator on the Comments tab — defer unless trivial.

### 3.5 Impact on Existing Features

| Feature | Impact | Watch for |
|---|---|---|
| Post/campaign comments | RLS policy rewritten | Regression-test that existing threads still load for all members |
| Notification volume | New `comment_added` source | Watcher + mention overlap must de-dupe |

### 3.6 What This Phase Does NOT Include

- Media/attachments in comments (see Out of Scope)
- Client-visible comments — task comments are internal only
- Comment threads on any other entity

### 3.7 Phase 3 Checklist — Before Marking Complete

Every access check below was exercised **as a real authenticated non-admin member**
(`set local role authenticated` + a `request.jwt.claims` sub), inside
`BEGIN; … ROLLBACK;` so nothing persisted — the gap Phase 1's notes flagged, where SQL
run via MCP executes as Postgres and bypasses RLS entirely. Fixtures: a workspace with
a real owner / admin / member trio, task A created by the admin and unassigned (the
member has no hand in it), task B assigned to the member.

- [x] `entity_type` accepts `task` — constraint now
      `CHECK (entity_type = ANY (ARRAY['post','campaign','task']))`
- [x] A member who cannot see a task cannot read its comments — read of task A's
      thread returned 0 rows; task B's returned 1
- [x] A member who cannot see a task cannot insert a comment on it either — the bug the
      original plan missed. Insert into task A: `new row violates row-level security
      policy for table "comments"`. Insert into task B: allowed.
- [x] Post and campaign threads still load for every workspace member (INSERT + SELECT)
      — campaign comment read back 1 row and a fresh insert succeeded, as the same
      plain member
- [x] Mentions and reactions work in a task thread — `CommentThread` is entity-generic
      and unchanged; mentions ride `mentioned_uids`, which the new task branch folds
      into its recipient set
- [x] A task comment does not produce a `/campaigns/<task_id>` link — it produces
      `/tasks/<task_id>?comment=<comment_id>` under the title "New comment on a task",
      confirming the three-way branch took
- [x] `comment_added` reaches creator, assignee, watchers and mentions, de-duped — a
      comment by the admin on a task they created, assigned to the member, previously
      held by the owner, produced exactly two rows: one to the current assignee, one to
      the past-assignee watcher. The actor got none despite being both the creator and
      a thread participant.
- [x] `npm run lint` clean (and `npm run build` passes)

**Implementation Notes**

- **All three of the "Before Starting" findings were re-verified live before writing
  any SQL**, and all three still held exactly as recorded: the constraint name, both
  under-scoped policies, and `tg_notify_comment_added`'s two-way branch with its
  campaign-assuming `else`.
- **The `exists (select 1 from tasks …)` subquery inside both policies is the whole
  mechanism.** It is evaluated under the caller's own rights, so `tasks_select` filters
  it — a task the caller can't select is simply not found, and its comments fall out
  with it. No cycle: `tasks`' policies reach into `task_activity` (through the
  SECURITY DEFINER `is_task_participant`), never into `comments`.
- **The notification branch reads the watcher set through SECURITY DEFINER**, so it
  sees every past assignee rather than the commenter's own RLS-visible slice — the same
  set `tg_notify_task_changes` uses, so "who hears about this task" means one thing
  whether the event was a handoff, a status change or a comment.
- **`emit_notifications` does all the de-duping** (`select distinct … where r is not
  null and r is distinct from p_actor`), so the task branch can concatenate thread
  participants, mentions, creator, assignee and watchers without guarding overlap —
  confirmed by the two-row result above.
- **The Comments tab needs a bounded height** (`h-150`), like the campaign page's
  thread — `CommentThread` manages its own scrolling and would otherwise grow the page.
- **Advisors re-checked after applying**: the only `comments` entry is the project-wide
  `auth_allow_anonymous_sign_ins` advisory that already covers 47 tables, and it names
  `"comments: author can update"` — the one policy this migration deliberately left
  alone. Nothing new introduced.

**→ Stop here. Show the result and wait for approval.**

---

## Phase 4 — Deliverable-Driven Auto-Completion ✅ Complete

### Goal

Tasks stop going stale after the work ships. When every deliverable linked to a task
reaches `PUBLISHED` or `DELIVERED`, the task completes itself, so the sidebar's overdue
badge stops counting work that went out weeks ago.

### Before Starting — Confirm Phase 3 is Approved

1. **Confirmed against the live database:** `post_versions.status` is a real Postgres
   enum type (`post_status`), not a text column with a CHECK constraint — its values
   are `DRAFT, PENDING_APPROVAL, APPROVED, SCHEDULED, NEEDS_REVISION, PUBLISHED,
   ARCHIVED, DELIVERED, SUBMITTED, CHANGES_REQUESTED, READY`. `IN (...)` comparisons
   against an enum work identically to a text column, so §4.1's SQL is unaffected —
   noted here only because it means "add a new status value" later would need `ALTER
   TYPE ... ADD VALUE`, not a constraint edit.
2. Confirm `posts.current_version_id` is the correct join for "the deliverable's
   current status" (used throughout the codebase, e.g. `fetchPostDetails`).
3. Confirm `ARCHIVED` is set on superseded versions by `create_revision_version` — it is
   **not** a terminal state and must not trigger completion.
4. Confirm `update_task_status` is the only writer of `completed_at` today — this phase
   adds a second writer (the new trigger), so both paths stamping the same column
   consistently matters.

### 4.1 Database

```sql
create or replace function public.tg_autocomplete_tasks_on_publish()
returns trigger language plpgsql security definer set search_path = public as $$
declare t record;
begin
  if new.status not in ('PUBLISHED','DELIVERED')
     or new.status is not distinct from old.status then
    return new;
  end if;

  for t in
    select tk.id, tk.workspace_id
    from task_posts tp
    join posts p    on p.id = tp.post_id
    join tasks tk   on tk.id = tp.task_id
    where p.current_version_id = new.id
      and tk.status in ('TODO','IN_PROGRESS')
  loop
    -- Only when EVERY linked deliverable is terminal.
    if (select bool_and(pv.status in ('PUBLISHED','DELIVERED'))
        from task_posts tp2
        join posts p2        on p2.id = tp2.post_id
        join post_versions pv on pv.id = p2.current_version_id
        where tp2.task_id = t.id) then
      update tasks set status = 'COMPLETED', completed_at = now() where id = t.id;
      -- Notify watchers with a NULL actor — system, not a teammate.
    end if;
  end loop;

  return new;
end $$;

create trigger tg_autocomplete_tasks
  after update of status on public.post_versions
  for each row execute function public.tg_autocomplete_tasks_on_publish();
```

Rules baked in deliberately:
- **All-or-nothing** — one published deliverable does not finish a multi-deliverable task.
- **`ARCHIVED` excluded** — it is a versioning artifact, not "done".
- **Forward only** — never auto-reopens a completed task if a deliverable regresses.
- **System actor** — notification wording is "auto-completed: all linked deliverables
  published", with `actor_user_id = NULL`, following the `invoice_overdue` precedent.

### 4.2–4.4

No API or component changes. The activity row is written by the Phase 1 trigger; the
Activity tab renders it with a system label.

### 4.5 Impact on Existing Features

| Feature | Impact | Watch for |
|---|---|---|
| Overdue badge | Drops stale tasks | Verify count updates without a reload |
| Task status | Written by DB, not `update_task_status` | Ensure `completed_at` stays consistent |

### 4.6 What This Phase Does NOT Include

- Reverse direction (task → deliverable). Never: it would let a member close a
  deliverable by ticking a checkbox, bypassing `canSendDeliverables`.
- Auto-reopening on revision requests.

### 4.7 Phase 4 Checklist — Before Marking Complete

Dry-run twice against the live project inside `BEGIN; … ROLLBACK;` using real posts and
a real owner/admin/member workspace, before applying. Fixtures: task M linked to two
SCHEDULED deliverables, task A linked to one DRAFT deliverable, plus an already-COMPLETED
and an ARCHIVED task both linked to the same deliverable.

- [x] Publishing one of two linked deliverables does **not** complete the task —
      stayed `IN_PROGRESS`
- [x] Publishing the last one does — `COMPLETED`, `completed_at` stamped
- [x] Archiving a version (revision flow) never completes a task — stayed `IN_PROGRESS`
- [x] Already-completed and archived tasks are untouched — verified against a *baseline*
      snapshot rather than a raw count, because inserting the fixture tasks itself emits
      `task_assigned`. Notification breakdown identical before and after the publish
      (`task_assigned=2` → `task_assigned=2`), zero `task_autocompleted` rows, the
      completed task's `completed_at` still `2020-01-01`, the archived task still
      `ARCHIVED`.
- [x] Watchers get a system-actor notification with distinct wording —
      `task_autocompleted` / actor `NULL`, "Task auto-completed — all linked deliverables
      published", 2 recipients (assignee + creator/watcher), **and 0 duplicate
      `task_updated` rows** (see notes)
- [x] An activity row is recorded for the auto-completion — with `actor_user_id = NULL`,
      which `TaskActivityFeed` already renders as "Tercero"
- [x] `npm run lint` clean (and `npm run build` passes)

**Implementation Notes**

- **§4.1's SQL sketch had a bare `-- Notify watchers with a NULL actor` comment where
  the fan-out belonged, and no code.** Written for real here.
- **§4.1 and §4.2 contradicted each other, and following §4.2 literally would have
  produced a wrong attribution plus a duplicate notification.** §4.2 said the activity
  row "is written by the Phase 1 trigger"; §4.1 required a system actor. But the
  deployed `tg_log_task_activity` stamps `auth.uid()` unconditionally — the uid of
  whoever published the deliverable. Unchanged, the Activity tab would have read
  "<publisher> moved this from In Progress to Completed" about a status change they
  never made, and `tg_notify_task_changes` would separately have fired its generic
  "Task status updated to COMPLETED" attributed to them, *on top of* this phase's
  system notification — two notifications for one event, one of them misattributed.
- **Resolved with one transaction-local GUC, `app.task_system_update`**, set around the
  auto-complete UPDATE and read by both Phase 1 triggers: the activity logger writes a
  NULL actor, and the notifier yields its status branch. `set_config(..., is_local =>
  true)` means it cannot outlive the transaction or leak across a pooled connection,
  and it is reset immediately after the UPDATE regardless. This is why two *existing*
  functions are rewritten by this migration, not just one added.
- **The all-or-nothing check is phrased as "no linked deliverable is still
  outstanding"** rather than the plan's `bool_and(...)`. A linked post with a NULL
  `current_version_id` would have been dropped by `bool_and`'s inner join and silently
  counted as satisfied; as a `not exists` with a LEFT JOIN it counts as outstanding.
- **`enforce_post_status_transition` was discovered while building the fixtures** and
  turned out to strengthen the phase's guarantees for free: `PUBLISHED`, `DELIVERED`
  and `ARCHIVED` are all dead ends in that state machine, so a deliverable can never
  regress out of a terminal state — the "forward only, never auto-reopen" rule is
  enforced upstream, not only by this trigger's `status in ('TODO','IN_PROGRESS')`
  guard.
- **UI**: `task_autocompleted` added to `TYPE_CONFIG` (emerald `CheckCircle2`) and to
  `SYSTEM_ACTOR_LABEL` as 'System' in `NotificationBell.jsx` — the same null-actor
  treatment `invoice_overdue` already uses. No other component changes; the Activity
  tab's system rendering was already built in Phase 2.
- **`tg_autocomplete_tasks_on_publish` is revoked from public/anon/authenticated** —
  verified `has_function_privilege('authenticated', …) = false` after applying, closing
  the advisor finding Phase 1 hit on its own trigger functions before it was raised.

---

## Data Model Summary (Final State After All Phases)

```
Agency (workspace_id = owner UID)
└── tasks
    ├── assigned_to        → current holder
    ├── created_by         → originator
    ├── task_posts[]       → deliverables (many-to-many, cross-client allowed)
    ├── task_activity[]    → assignment + status history  ← NEW
    │     └── to_user_id   → doubles as the watcher/participant list
    └── comments[]         → entity_type = 'task'         ← widened
```

### `task_activity` — Schema

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `workspace_id` | UUID | RLS scope (owner UID) |
| `task_id` | UUID | FK → tasks, ON DELETE CASCADE |
| `type` | text | `assigned` \| `status_changed` |
| `actor_user_id` | UUID | `auth.uid()`; NULL = system |
| `from_user_id` / `to_user_id` | UUID | assignment events; NULL = unassigned |
| `from_status` / `to_status` | text | status events |
| `created_at` | timestamptz | default now() |

### Storage Bucket

None. No storage in any phase.

---

## Impact on Existing Features

| Existing Feature | Impact | Action Required |
|---|---|---|
| Tasks (`/tasks`) | Members can hand off via `reassign_task` RPC; `tasks_update` RLS itself is unchanged | Update `documentation/features/feature-task-linking.md` |
| Notifications | `tg_notify_task_changes` fully rewritten (new `task_reassigned` type, outgoing-assignee + watcher fan-out); NotificationBell needs a `TYPE_CONFIG` entry | Watch volume; confirm icon renders |
| Comments | SELECT **and** INSERT policies rewritten for task scoping (INSERT was the real gap); `tg_notify_comment_added` gains a third branch | Regression-test post/campaign threads on both read and write |
| Workspace Chat | Task references resolve for past assignees | Verify no-access path still denies genuine non-participants |
| Deliverables | Publishing may complete linked tasks | Verify only when all are terminal |
| RBAC | `canAssignTasks` keeps its meaning (filter gating only) | Document the split explicitly |

---

## Out of Scope (All Phases)

- **Media/attachments in comments** — genuinely wanted (annotated screenshots are the
  natural way to give creative feedback), but it needs its own private bucket, storage
  quota integration via `increment_storage_used`/`decrement_storage_used`, and a
  deferred-deletion rule for soft-deleted comments. It also spans post and campaign
  comments, not just tasks. Future build, own feature doc.
- **Client-visible task comments** — internal only; showing clients internal discussion
  is a much larger product decision.
- **Task approval workflow** — tasks are records, not approvals. Approvals belong to
  deliverables.
- **Mute / unwatch** — deferred deliberately until real notification volume is observed
  rather than guessed at.
- **Owner as assignee** — owner/superadmin stay unassignable, per the current filter.
- **Generic audit log** — `task_activity` stays at two event types. Field-level history
  (due date, priority, title) is not recorded.
