-- Security: get_team_members / get_removed_members leaked across workspaces.
--
-- Both are SECURITY DEFINER (so RLS does not apply), granted to `authenticated`,
-- and take the workspace id as a parameter that nothing validated. Any signed-in
-- user could pass any workspace uuid and read that workspace's full member list,
-- including email addresses.
--
-- Reproduced live as a plain member of one workspace:
--   own team -> 3 rows (expected); a DIFFERENT workspace -> 1 row with its
--   member's email returned in full.
--
-- Long-standing rather than new, but the Phase 2 rewrite (20260909190000)
-- reproduced both functions verbatim and carried the missing guard forward.
--
-- Fix: require the requested workspace to be the caller's own. A WHERE clause
-- rather than a RAISE, so the functions stay LANGUAGE sql and an out-of-scope
-- request returns zero rows — the same "you simply don't see it" shape as RLS
-- elsewhere in this app, with no change to the client contract.
--
-- Legitimate callers are unaffected: both hooks pass `workspaceUserId`, which
-- is the owner's uid for an owner and the agency's uid for a member — exactly
-- what get_my_agency_user_id() returns in each case.

create or replace function public.get_team_members(p_agency_user_id uuid)
returns table(
  id uuid, member_user_id uuid, system_role text, permissions jsonb,
  joined_at timestamp with time zone, email text, first_name text,
  last_name text, full_name text, avatar_url text, roles_and_responsibilities text)
language sql stable security definer set search_path to 'public', 'pg_temp'
as $function$
  select
    am.id, am.member_user_id, am.system_role,
    am.permissions, am.joined_at,
    au.email::text,
    (au.raw_user_meta_data->>'first_name')::text,
    (au.raw_user_meta_data->>'last_name')::text,
    coalesce((au.raw_user_meta_data->>'full_name')::text, au.email::text),
    (au.raw_user_meta_data->>'avatar_url')::text,
    am.roles_and_responsibilities
  from agency_members am
  join auth.users au on au.id = am.member_user_id
  where am.agency_user_id = p_agency_user_id
    and p_agency_user_id = public.get_my_agency_user_id()
    and am.is_active = true
  order by am.joined_at asc;
$function$;

create or replace function public.get_removed_members(p_agency_user_id uuid)
returns table(
  id uuid, member_user_id uuid, system_role text, permissions jsonb,
  joined_at timestamp with time zone, email text, first_name text,
  last_name text, full_name text, avatar_url text)
language sql stable security definer set search_path to 'public', 'pg_temp'
as $function$
  select
    am.id, am.member_user_id, am.system_role,
    am.permissions, am.joined_at,
    au.email::text,
    (au.raw_user_meta_data->>'first_name')::text,
    (au.raw_user_meta_data->>'last_name')::text,
    coalesce((au.raw_user_meta_data->>'full_name')::text, au.email::text),
    (au.raw_user_meta_data->>'avatar_url')::text
  from agency_members am
  join auth.users au on au.id = am.member_user_id
  where am.agency_user_id = p_agency_user_id
    and p_agency_user_id = public.get_my_agency_user_id()
    and am.is_active = false
  order by am.joined_at asc;
$function$;;
