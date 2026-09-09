-- Lets a chat viewer distinguish "this task was deleted" from "this task
-- exists, but tasks_select's creator/assigned_to/admin RLS scope means you
-- can't see it" — without ever exposing the task's actual content to a
-- viewer who isn't allowed to see it. Returns a bare boolean only.
create or replace function public.task_reference_exists(p_task_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.tasks
    where id = p_task_id
      and workspace_id = get_my_agency_user_id()
  );
$$;

revoke all on function public.task_reference_exists(uuid) from public;
grant execute on function public.task_reference_exists(uuid) to authenticated;;
