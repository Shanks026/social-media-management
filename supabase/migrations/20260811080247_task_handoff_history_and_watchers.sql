-- Phase 1 of task collaboration (.claude/features/09-task-collaboration.md):
-- member-to-member handoff, assignment/status history, and watcher-aware
-- notifications. Verified against live schema via MCP before writing.

-- ── 1. task_activity: narrow history table (assignment + status only) ──────
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

-- Watcher lookup. Partial index — only assignment rows matter.
create index task_activity_participants_idx
  on public.task_activity (task_id, to_user_id)
  where type = 'assigned';

-- ── 2. Logging trigger — records every assignment + status change ─────────
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

create trigger trg_log_task_activity
  after insert or update on public.tasks
  for each row execute function public.tg_log_task_activity();

-- ── 3. is_task_participant — SECURITY DEFINER to avoid RLS recursion ──────
-- tasks_select (below) references this; this function reads task_activity,
-- whose own SELECT policy defers to tasks visibility. Plain SQL here would be
-- infinite recursion, so this bypasses RLS the same way is_workspace_admin() does.
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

-- ── 4. Widen tasks_select to include past assignees ────────────────────────
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
-- tasks_insert / tasks_update / tasks_delete are intentionally left untouched.
-- tasks_update in particular still blocks any direct UPDATE from a non-creator,
-- non-admin member — confirmed live before this migration. reassign_task (below)
-- is therefore the only door open to a member for changing assigned_to, exactly
-- how update_task_status is the only door for changing status.

-- ── 5. reassign_task — the actual handoff mechanism ────────────────────────
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

  -- Target-side validity (active member, not owner/superadmin) is enforced by
  -- trg_enforce_task_assignment below — it fires on this UPDATE regardless of
  -- SECURITY DEFINER, since only RLS (not triggers) is bypassed.
  update public.tasks set assigned_to = p_assigned_to, updated_at = now()
  where id = p_task_id;
end $$;

revoke execute on function public.reassign_task(uuid, uuid) from public, anon;
grant execute on function public.reassign_task(uuid, uuid) to authenticated;

-- ── 6. task_activity RLS ────────────────────────────────────────────────────
alter table public.task_activity enable row level security;

create policy "task_activity_select" on public.task_activity for select using (
  workspace_id = get_my_agency_user_id()
  and exists (select 1 from public.tasks t where t.id = task_id)  -- tasks RLS applies
);
-- No INSERT/UPDATE/DELETE policies: rows are written only by the SECURITY DEFINER
-- trigger. Nothing may forge or rewrite history.

-- ── 7. Assignment target enforcement ────────────────────────────────────────
-- tasks_insert already gates *who may set* assigned_to (assigned_to IS NULL OR
-- is_workspace_admin()), but nothing previously gated *who may be set* — an
-- admin could assign a task to the workspace owner and nothing would stop it.
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

create trigger trg_enforce_task_assignment
  before insert or update on public.tasks
  for each row execute function public.enforce_task_assignment();

-- ── 8. Backfill — existing tasks have no history yet ───────────────────────
insert into task_activity (workspace_id, task_id, type, actor_user_id, to_user_id, created_at)
select workspace_id, id, 'assigned', created_by, assigned_to, created_at
from tasks where assigned_to is not null;

insert into task_activity (workspace_id, task_id, type, actor_user_id, to_status, created_at)
select workspace_id, id, 'status_changed', created_by, status, created_at
from tasks;

-- ── 9. Watcher-aware notifications — full replacement of the live function ─
-- Confirmed live behavior before this migration: notified only the NEW
-- assignee on handoff (outgoing assignee got nothing at all) and only
-- [assigned_to, created_by] on status change (no watchers). This replaces the
-- function body; the existing trigger (trg_notify_task_changes, AFTER INSERT
-- OR UPDATE) is untouched. Link stays '/tasks', matching the two prior fixes
-- to this function (fix_task_notification_link, fix_task_notification_link_v2).
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

  -- Watchers = creator + every past assignee. emit_notifications de-dupes
  -- against the other recipients and strips the actor, so overlap is harmless.
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
