-- Confirmed via a rolled-back transaction test: the new assignee was getting
-- BOTH 'task_assigned' ("You were assigned") AND the generic 'task_reassigned'
-- "watching" broadcast for the same event. Cause: trg_log_task_activity fires
-- before trg_notify_task_changes (alphabetical AFTER-trigger order on the same
-- table/event), so by the time v_watchers is computed, the just-created
-- assignment row is already in task_activity, making the new assignee count as
-- their own watcher. Fix: exclude both old and new assignee from the generic
-- "watching" broadcast — they already get their own tailored message.
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
  -- against the other recipients and strips the actor, so overlap is harmless
  -- EXCEPT where two different notification *types* would both target the
  -- same person for the same event (see reassignment branch below).
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
    if old.assigned_to is not null then
      perform public.emit_notifications(
        new.workspace_id, v_actor, array[old.assigned_to],
        'task_reassigned', 'A task you held was reassigned', new.title,
        'task', new.id, '/tasks');
    end if;
    -- Generic "watching" broadcast excludes old/new assignee — they already
    -- got the two tailored messages above; without this exclusion the new
    -- assignee in particular received a redundant second notification row.
    perform public.emit_notifications(
      new.workspace_id, v_actor,
      array(
        select w from unnest(v_watchers) as w
        where w is distinct from old.assigned_to and w is distinct from new.assigned_to
      ),
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
;
