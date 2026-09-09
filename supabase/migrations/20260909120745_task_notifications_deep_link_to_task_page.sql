-- Phase 2 (09-task-collaboration): point task notifications at the task's own
-- page instead of the bare list.
--
-- resolveNotificationRoute() treats notifications.link as authoritative and
-- only falls back to its entity map when link is null. Every task notification
-- row is stamped '/tasks' by this trigger, so widening the client-side map
-- alone would never take effect. The link has to be stamped at the source.
--
-- Body is otherwise byte-for-byte the deployed version (including the
-- duplicate-notification fix from 20260811081828); only the five link
-- arguments change from '/tasks' to '/tasks/' || new.id.

create or replace function public.tg_notify_task_changes()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_actor    uuid := auth.uid();
  v_watchers uuid[];
  v_link     text := '/tasks/' || new.id;
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
        'task', new.id, v_link);
    end if;
    if old.assigned_to is not null then
      perform public.emit_notifications(
        new.workspace_id, v_actor, array[old.assigned_to],
        'task_reassigned', 'A task you held was reassigned', new.title,
        'task', new.id, v_link);
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
      'task', new.id, v_link);
  end if;

  if new.status is distinct from old.status then
    perform public.emit_notifications(
      new.workspace_id, v_actor, array[new.assigned_to, new.created_by] || v_watchers,
      'task_updated', 'Task status updated to ' || new.status, new.title,
      'task', new.id, v_link);
  end if;

  return new;
end $function$;

-- Existing rows still carry the old bare '/tasks' link. Rewriting them is
-- safe: entity_id already holds the task id, so the new link is derived, not
-- guessed, and /tasks/:taskId handles a since-deleted task with its own
-- not-found state.
update public.notifications
set link = '/tasks/' || entity_id
where entity_type = 'task' and entity_id is not null and link = '/tasks';;
