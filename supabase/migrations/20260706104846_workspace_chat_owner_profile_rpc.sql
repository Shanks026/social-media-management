-- Resolves the workspace owner's basic profile for the chat DM list. Isolated
-- from get_team_members (which only returns agency_members rows, never the
-- owner) rather than extending that shared RPC — keeps this change scoped to
-- chat with zero risk to its other consumers (Tasks, Notifications, Team
-- settings). Derives the workspace from the caller's own session via
-- get_my_agency_user_id() — unlike get_team_members, it does not trust a
-- caller-supplied workspace id.

create or replace function public.get_my_workspace_owner()
returns table (
  user_id uuid,
  email text,
  first_name text,
  last_name text,
  full_name text,
  avatar_url text
)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select
    au.id,
    au.email::text,
    (au.raw_user_meta_data->>'first_name')::text,
    (au.raw_user_meta_data->>'last_name')::text,
    coalesce((au.raw_user_meta_data->>'full_name')::text, au.email::text),
    (au.raw_user_meta_data->>'avatar_url')::text
  from auth.users au
  where au.id = public.get_my_agency_user_id();
$$;

revoke execute on function public.get_my_workspace_owner() from public, anon;
grant execute on function public.get_my_workspace_owner() to authenticated;;
