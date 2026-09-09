-- Member mobile number: optional on the join form, visible to owner/admin only.
--
-- Stored in auth.users.raw_user_meta_data alongside first_name / last_name /
-- full_name, which join_team already writes there. A phone number belongs to
-- the person, not to their membership of one workspace — someone in two
-- agencies has one number — so it does not want a column on agency_members.
-- It also means the member can maintain it themselves from Profile Settings,
-- the same way they already maintain their name and avatar.
--
-- Not to be confused with agency_subscriptions.mobile_number, which is the
-- agency's own contact number shown on invoices.

-- join_team gains an optional mobile number. Defaulted, so the 3-arg call
-- shape keeps working and no caller is forced to change.
create or replace function public.join_team(
  p_token text, p_first_name text, p_last_name text,
  p_mobile_number text default null)
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
  v_mobile      text := nullif(trim(coalesce(p_mobile_number, '')), '');
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

  -- Best-effort: never let chat block someone joining the team.
  if coalesce(v_sub.chat, false) then
    begin
      perform public.ensure_workspace_channel();
    exception when others then
      null;  -- self-heals on the member's first visit to /chat
    end;
  end if;

  update auth.users
  set raw_user_meta_data = raw_user_meta_data || jsonb_build_object(
    'first_name', v_first_name, 'last_name', v_last_name,
    'full_name', v_first_name || ' ' || v_last_name)
    -- Only written when supplied: the field is optional, and a blank retry
    -- must not wipe a number the person already has.
    || case when v_mobile is null then '{}'::jsonb
            else jsonb_build_object('mobile_number', v_mobile) end
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

-- get_team_members returns the number, but only to owner/admin. Gated in the
-- function rather than the UI: this is contact data, and hiding it in the
-- component would still ship it over the wire to every member.
-- is_workspace_admin() is owner OR admin OR superadmin.
-- Adding a column to a RETURNS TABLE is a signature change, so DROP + CREATE.
drop function if exists public.get_team_members(uuid);

create function public.get_team_members(p_agency_user_id uuid)
returns table(
  id uuid, member_user_id uuid, system_role text, permissions jsonb,
  joined_at timestamp with time zone, email text, first_name text,
  last_name text, full_name text, avatar_url text, roles_and_responsibilities text,
  mobile_number text)
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
    am.roles_and_responsibilities,
    case
      when public.is_workspace_admin() or am.member_user_id = auth.uid()
        then (au.raw_user_meta_data->>'mobile_number')::text
      else null
    end
  from agency_members am
  join auth.users au on au.id = am.member_user_id
  where am.agency_user_id = p_agency_user_id
    and p_agency_user_id = public.get_my_agency_user_id()
    and am.is_active = true
  order by am.joined_at asc;
$function$;
