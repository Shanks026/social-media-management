
create or replace function public.tg_notify_task_changes()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_actor uuid := auth.uid();
begin
  if (tg_op = 'INSERT') then
    if new.assigned_to is not null then
      perform public.emit_notifications(
        new.workspace_id, v_actor, array[new.assigned_to],
        'task_assigned', 'You were assigned a task', new.title,
        'task', new.id, '/operations/tasks');
    end if;
    return new;
  end if;

  if (tg_op = 'UPDATE') then
    if new.assigned_to is distinct from old.assigned_to
       and new.assigned_to is not null then
      perform public.emit_notifications(
        new.workspace_id, v_actor, array[new.assigned_to],
        'task_assigned', 'You were assigned a task', new.title,
        'task', new.id, '/operations/tasks');
    end if;

    if new.status is distinct from old.status then
      perform public.emit_notifications(
        new.workspace_id, v_actor, array[new.assigned_to, new.created_by],
        'task_updated', 'Task status updated to ' || new.status, new.title,
        'task', new.id, '/operations/tasks');
    end if;
    return new;
  end if;

  return null;
end;
$$;
;
