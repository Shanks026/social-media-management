-- Feature 10, Phase 2: retire agency_members.functional_role.
--
-- The junction table (agency_member_job_roles) becomes the only source of truth
-- for job titles. Every reader in src/ was migrated first — verified with
-- `grep -rn "functional_role" src/` returning nothing but comments.
--
-- Five functions read or write the column, so they are rewritten in the same
-- migration as the drop. Doing the drop alone would break all five.

-- 1. set_member_job_roles loses the Phase 1 legacy-column sync. That sync only
--    existed so the old single-value display sites kept working through Phase
--    1; they now read the junction table directly.
create or replace function public.set_member_job_roles(
  p_member_user_id uuid, p_job_role_ids uuid[])
returns void language plpgsql security definer set search_path = public as $$
declare v_workspace uuid := public.get_my_agency_user_id();
begin
  if not public.is_workspace_owner() then
    raise exception 'Only the workspace owner can assign job roles';
  end if;

  if not exists (
    select 1 from agency_members
    where agency_user_id = v_workspace and member_user_id = p_member_user_id
  ) then
    raise exception 'Member not found';
  end if;

  -- Every id must belong to this workspace: stops a crafted request linking a
  -- member to another agency's role row.
  if exists (
    select 1 from unnest(coalesce(p_job_role_ids, '{}'::uuid[])) as rid
    where not exists (
      select 1 from agency_job_roles r where r.id = rid and r.workspace_id = v_workspace
    )
  ) then
    raise exception 'Unknown job role for this workspace';
  end if;

  delete from agency_member_job_roles
  where workspace_id = v_workspace and member_user_id = p_member_user_id
    and job_role_id <> all (coalesce(p_job_role_ids, '{}'::uuid[]));

  insert into agency_member_job_roles (workspace_id, member_user_id, job_role_id)
  select v_workspace, p_member_user_id, rid
  from unnest(coalesce(p_job_role_ids, '{}'::uuid[])) as rid
  on conflict do nothing;
end $$;

revoke execute on function public.set_member_job_roles(uuid, uuid[]) from public, anon;
grant execute on function public.set_member_job_roles(uuid, uuid[]) to authenticated;

-- 2. update_member_access drops p_functional_role. Job titles have their own
--    RPC now, so this function is purely about access again.
drop function if exists public.update_member_access(uuid, text, jsonb, text, text);

create or replace function public.update_member_access(
  p_member_id uuid,
  p_system_role text,
  p_permissions jsonb,
  p_roles_and_responsibilities text default null::text)
returns void language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
declare v_target agency_members%rowtype;
begin
  if not public.is_workspace_owner() then
    raise exception 'Only the workspace owner can manage team access';
  end if;

  select * into v_target
  from agency_members
  where id = p_member_id and agency_user_id = public.get_my_agency_user_id();

  if not found then
    raise exception 'Member not found';
  end if;

  if v_target.system_role = 'owner' or v_target.member_user_id = v_target.agency_user_id then
    raise exception 'The owner row cannot be modified';
  end if;

  if p_system_role not in ('admin', 'member') then
    raise exception 'Role must be admin or member';
  end if;

  if p_permissions is null or p_permissions->>'documents' not in ('none', 'view', 'manage') then
    raise exception 'permissions.documents must be none, view, or manage';
  end if;

  update agency_members
  set
    system_role                = p_system_role,
    permissions                = p_permissions,
    roles_and_responsibilities = coalesce(p_roles_and_responsibilities, roles_and_responsibilities)
  where id = p_member_id;
end $$;

-- 3. join_team drops p_functional_role — a member no longer self-declares a job
--    title on the join form. Otherwise byte-for-byte the reusable-links version
--    from 20260909150000 (multi-use links, idempotent repeat click, /team link).
drop function if exists public.join_team(text, text, text, text);

create or replace function public.join_team(
  p_token text, p_first_name text, p_last_name text)
returns jsonb language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
declare
  v_invite      agency_invites%rowtype;
  v_member_uid  uuid := auth.uid();
  v_system_role text;
  v_permissions jsonb;
  v_sub         agency_subscriptions%rowtype;
  v_seat_count  int;
  v_inserted    int;
  v_first_name  text := trim(p_first_name);
  v_last_name   text := trim(p_last_name);
begin
  if v_member_uid is null then
    return jsonb_build_object('error', 'Not authenticated');
  end if;

  -- Expiry (and revocation, which is a backdated expiry) is the only gate.
  select * into v_invite from agency_invites
  where token = p_token and expires_at > now();

  if not found then
    return jsonb_build_object('error', 'This invite link is no longer valid. Ask your workspace owner for a new one.');
  end if;

  v_system_role := coalesce(v_invite.system_role, 'member');
  v_permissions := case v_system_role
    when 'admin' then '{"documents":"manage"}'::jsonb
    else              coalesce(v_invite.permissions, '{"documents":"view"}'::jsonb)
  end;

  select * into v_sub from agency_subscriptions where user_id = v_invite.agency_user_id;
  if v_sub.max_team_members is not null then
    select count(*) into v_seat_count from agency_members
    where agency_user_id = v_invite.agency_user_id and is_active = true;
    if v_seat_count >= v_sub.max_team_members then
      return jsonb_build_object('error', 'TEAM_SEAT_LIMIT_REACHED');
    end if;
  end if;

  insert into agency_members (agency_user_id, member_user_id, system_role, permissions)
  values (v_invite.agency_user_id, v_member_uid, v_system_role, v_permissions)
  on conflict (agency_user_id, member_user_id) do nothing;

  get diagnostics v_inserted = row_count;

  perform public.ensure_workspace_channel();

  update auth.users
  set raw_user_meta_data = raw_user_meta_data || jsonb_build_object(
    'first_name', v_first_name, 'last_name', v_last_name,
    'full_name', v_first_name || ' ' || v_last_name)
  where id = v_member_uid;

  if v_inserted = 1 then
    update agency_invites
    set use_count   = use_count + 1,
        accepted_at = coalesce(accepted_at, now())
    where id = v_invite.id;

    perform public.emit_notifications(
      v_invite.agency_user_id, v_member_uid,
      public.workspace_admin_uids(v_invite.agency_user_id),
      'team_member_joined', 'New team member joined',
      trim(v_first_name || ' ' || v_last_name) || ' joined your workspace',
      'team', null, '/team');
  end if;

  return jsonb_build_object('success', true, 'agency_user_id', v_invite.agency_user_id);
end $$;

-- 4. get_team_members and get_removed_members return functional_role in their
--    TABLE signature. Both are LANGUAGE sql STABLE — reproduced verbatim from
--    their deployed definitions with only that column removed. Changing a
--    RETURNS TABLE shape needs DROP + CREATE, not CREATE OR REPLACE.
drop function if exists public.get_team_members(uuid);

create function public.get_team_members(p_agency_user_id uuid)
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
  where am.agency_user_id = p_agency_user_id and am.is_active = true
  order by am.joined_at asc;
$function$;

drop function if exists public.get_removed_members(uuid);

create function public.get_removed_members(p_agency_user_id uuid)
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
  where am.agency_user_id = p_agency_user_id and am.is_active = false
  order by am.joined_at asc;
$function$;

-- 5. Finally, the column itself — and the matching one on invites, which became
--    unused when the job title came off the join form in Phase 1.
alter table public.agency_members drop column functional_role;
alter table public.agency_invites drop column if exists functional_role;
