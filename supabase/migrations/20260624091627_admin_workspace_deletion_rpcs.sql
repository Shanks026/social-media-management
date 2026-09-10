-- Superadmin gate: caller has an active superadmin membership row.
create or replace function public.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select exists (
    select 1 from agency_members
    where member_user_id = auth.uid()
      and system_role = 'superadmin'
      and is_active = true
  )
$$;

-- Schedule grace-period deletion for an arbitrary workspace (admin portal).
create or replace function public.admin_schedule_workspace_deletion(target_user_id uuid, days int default 14)
returns timestamptz
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare v_when timestamptz;
begin
  if not public.is_superadmin() then
    raise exception 'Only a superadmin can schedule workspace deletion';
  end if;
  if days is null or days < 1 then
    raise exception 'days must be a positive integer';
  end if;
  if not exists (select 1 from agency_subscriptions where user_id = target_user_id) then
    raise exception 'Workspace not found';
  end if;
  v_when := now() + make_interval(days => days);
  update agency_subscriptions
     set scheduled_for_deletion_at = v_when, updated_at = now()
   where user_id = target_user_id;
  return v_when;
end;
$$;

-- Cancel a scheduled deletion for an arbitrary workspace (admin portal).
create or replace function public.admin_cancel_workspace_deletion(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if not public.is_superadmin() then
    raise exception 'Only a superadmin can cancel workspace deletion';
  end if;
  update agency_subscriptions
     set scheduled_for_deletion_at = null, updated_at = now()
   where user_id = target_user_id;
end;
$$;

-- Lock down execution to authenticated callers only (gate is enforced inside).
revoke execute on function public.is_superadmin() from public, anon;
revoke execute on function public.admin_schedule_workspace_deletion(uuid, int) from public, anon;
revoke execute on function public.admin_cancel_workspace_deletion(uuid) from public, anon;
grant execute on function public.is_superadmin() to authenticated;
grant execute on function public.admin_schedule_workspace_deletion(uuid, int) to authenticated;
grant execute on function public.admin_cancel_workspace_deletion(uuid) to authenticated;;
