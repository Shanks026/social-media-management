-- Phase 4 (09-task-collaboration): deliverable-driven auto-completion.
--
-- When every deliverable linked to a task reaches PUBLISHED or DELIVERED, the
-- task completes itself — so the sidebar's overdue badge stops counting work
-- that shipped weeks ago.
--
-- Two things the plan's §4.1 sketch left open, both closed here:
--
--   1. It carried a bare `-- Notify watchers with a NULL actor` comment where
--      the fan-out belonged, with no code. Written below.
--
--   2. It said (§4.2) the activity row "is written by the Phase 1 trigger",
--      while (§4.1) requiring a system actor. Those contradict: the deployed
--      tg_log_task_activity stamps auth.uid() unconditionally, which is the
--      uid of whoever published the deliverable. Left alone, the feed would
--      read "Chris moved this from In Progress to Completed" about a status
--      change Chris never made — and tg_notify_task_changes would separately
--      fire its generic "Task status updated to COMPLETED" from Chris, on top
--      of this phase's system notification. Two notifications, one wrong
--      attribution.
--
-- Both are solved by one transaction-local flag, `app.task_system_update`,
-- set around the UPDATE below and read by the two Phase 1 triggers. It is set
-- with is_local => true, so it can never outlive the statement's transaction
-- or leak across a pooled connection, and it is reset immediately after.

-- ─── 1. Phase 1's activity logger learns about system-initiated updates ──────
create or replace function public.tg_log_task_activity()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  -- NULL actor = the system did this, not a person. Phase 4 sets the flag
  -- when a task completes because its deliverables shipped; TaskActivityFeed
  -- already renders a null actor as "Tercero".
  v_actor uuid := case
    when coalesce(current_setting('app.task_system_update', true), '') = 'on' then null
    else auth.uid()
  end;
begin
  if tg_op = 'INSERT' then
    if new.assigned_to is not null then
      insert into task_activity (workspace_id, task_id, type, actor_user_id, to_user_id)
      values (new.workspace_id, new.id, 'assigned', v_actor, new.assigned_to);
    end if;
    insert into task_activity (workspace_id, task_id, type, actor_user_id, to_status)
    values (new.workspace_id, new.id, 'status_changed', v_actor, new.status);
    return new;
  end if;

  if new.assigned_to is distinct from old.assigned_to then
    insert into task_activity (workspace_id, task_id, type, actor_user_id, from_user_id, to_user_id)
    values (new.workspace_id, new.id, 'assigned', v_actor, old.assigned_to, new.assigned_to);
  end if;

  if new.status is distinct from old.status then
    insert into task_activity (workspace_id, task_id, type, actor_user_id, from_status, to_status)
    values (new.workspace_id, new.id, 'status_changed', v_actor, old.status, new.status);
  end if;

  return new;
end $$;

-- ─── 2. Phase 1's notifier yields the status branch to Phase 4 ───────────────
-- Byte-for-byte the deployed version apart from the guard on the status
-- branch: when the flag is on, tg_autocomplete_tasks_on_publish is emitting
-- its own tailored, system-actor notification for exactly this change, so the
-- generic "Task status updated to COMPLETED" would be a duplicate attributed
-- to the wrong person.
create or replace function public.tg_notify_task_changes()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_actor    uuid := auth.uid();
  v_watchers uuid[];
  v_link     text := '/tasks/' || new.id;
  v_system   boolean := coalesce(current_setting('app.task_system_update', true), '') = 'on';
begin
  if (tg_op = 'INSERT') then
    if new.assigned_to is not null then
      perform public.emit_notifications(
        new.workspace_id, v_actor, array[new.assigned_to],
        'task_assigned', 'You were assigned a task', new.title,
        'task', new.id, v_link);
    end if;
    return new;
  end if;

  v_watchers := array(
    select distinct to_user_id from task_activity
    where task_id = new.id and type = 'assigned' and to_user_id is not null
  ) || new.created_by;

  if new.assigned_to is distinct from old.assigned_to then
    if new.assigned_to is not null then
      perform public.emit_notifications(
        new.workspace_id, v_actor, array[new.assigned_to],
        'task_assigned', 'You were assigned a task', new.title,
        'task', new.id, v_link);
    end if;
    if old.assigned_to is not null then
      perform public.emit_notifications(
        new.workspace_id, v_actor, array[old.assigned_to],
        'task_reassigned', 'A task you held was reassigned', new.title,
        'task', new.id, v_link);
    end if;
    perform public.emit_notifications(
      new.workspace_id, v_actor,
      array(
        select w from unnest(v_watchers) as w
        where w is distinct from old.assigned_to and w is distinct from new.assigned_to
      ),
      'task_reassigned', 'A task you''re watching was reassigned', new.title,
      'task', new.id, v_link);
  end if;

  if new.status is distinct from old.status and not v_system then
    perform public.emit_notifications(
      new.workspace_id, v_actor, array[new.assigned_to, new.created_by] || v_watchers,
      'task_updated', 'Task status updated to ' || new.status, new.title,
      'task', new.id, v_link);
  end if;

  return new;
end $$;

-- ─── 3. The auto-completion trigger itself ──────────────────────────────────
create or replace function public.tg_autocomplete_tasks_on_publish()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  t          record;
  v_watchers uuid[];
begin
  -- Forward only, and only into a terminal state. ARCHIVED is deliberately
  -- absent: create_revision_version stamps it on superseded versions, so it is
  -- a versioning artifact, not "done".
  if new.status not in ('PUBLISHED', 'DELIVERED')
     or new.status is not distinct from old.status then
    return new;
  end if;

  for t in
    select tk.id, tk.workspace_id, tk.title, tk.created_by, tk.assigned_to
    from task_posts tp
    join posts p  on p.id = tp.post_id
    join tasks tk on tk.id = tp.task_id
    where p.current_version_id = new.id
      and tk.status in ('TODO', 'IN_PROGRESS')   -- never reopen or re-complete
  loop
    -- All-or-nothing: one published deliverable does not finish a
    -- multi-deliverable task. Phrased as "no linked deliverable is still
    -- outstanding" rather than bool_and(...) so that a linked post with no
    -- current version counts as outstanding instead of being skipped by the
    -- join and silently completing the task.
    if not exists (
      select 1
      from task_posts tp2
      join posts p2 on p2.id = tp2.post_id
      left join post_versions pv on pv.id = p2.current_version_id
      where tp2.task_id = t.id
        and (pv.status is null or pv.status not in ('PUBLISHED', 'DELIVERED'))
    ) then
      -- Mark this UPDATE as system-initiated for the two Phase 1 triggers.
      perform set_config('app.task_system_update', 'on', true);

      update tasks
      set status = 'COMPLETED', completed_at = now(), updated_at = now()
      where id = t.id;

      perform set_config('app.task_system_update', 'off', true);

      v_watchers := array(
        select distinct to_user_id from task_activity
        where task_id = t.id and type = 'assigned' and to_user_id is not null
      ) || t.created_by || t.assigned_to;

      -- NULL actor: nobody moved this task, the work shipping did. Follows the
      -- invoice_overdue precedent, which NotificationBell already renders via
      -- SYSTEM_ACTOR_LABEL. Passing NULL as the actor also means nobody is
      -- stripped from the recipient list — including the person who published.
      perform public.emit_notifications(
        t.workspace_id, null, v_watchers,
        'task_autocompleted',
        'Task auto-completed — all linked deliverables published',
        t.title, 'task', t.id, '/tasks/' || t.id);
    end if;
  end loop;

  return new;
end $$;

drop trigger if exists tg_autocomplete_tasks on public.post_versions;
create trigger tg_autocomplete_tasks
  after update of status on public.post_versions
  for each row execute function public.tg_autocomplete_tasks_on_publish();

-- Pure trigger functions have no legitimate direct-call use case. Matches the
-- security_revoke_trigger_functions_from_public precedent, and Phase 1's
-- finding that revoking from PUBLIC does not cover `authenticated`, which
-- Supabase grants through a separate default-privilege mechanism.
revoke execute on function public.tg_autocomplete_tasks_on_publish() from public, anon, authenticated;
