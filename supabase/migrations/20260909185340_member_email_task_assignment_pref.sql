-- Per-member opt-out for assignment emails. Defaults to true so existing
-- members keep getting them once the sender ships; the column is what makes
-- "stop emailing me" answerable without turning the feature off for everyone.
alter table public.agency_members
  add column if not exists email_task_assignments boolean not null default true;

-- The only UPDATE policy on agency_members is agency_members_update_owner
-- (auth.uid() = agency_user_id), so a member cannot write their own row —
-- which is exactly who needs to set this. SECURITY DEFINER, scoped in the
-- WHERE clause to the caller's own row in their own workspace, so it can
-- never touch anyone else's. Mirrors update_member_access / set_member_job_roles.
create or replace function public.set_my_email_task_assignments(p_enabled boolean)
returns void
language sql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
  update public.agency_members
  set email_task_assignments = coalesce(p_enabled, true)
  where member_user_id = auth.uid()
    and agency_user_id = public.get_my_agency_user_id();
$$;

revoke all on function public.set_my_email_task_assignments(boolean) from public;
revoke all on function public.set_my_email_task_assignments(boolean) from anon;
grant execute on function public.set_my_email_task_assignments(boolean) to authenticated;;
