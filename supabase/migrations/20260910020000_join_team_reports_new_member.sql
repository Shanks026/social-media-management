-- join_team now reports whether this call actually added someone.
--
-- Links are multi-use and re-opening one is a normal thing to do, so
-- join_team already returns success for a person who had joined before.
-- The welcome email (send-team-welcome, invoked from JoinTeam.jsx) must not
-- fire again for them — the same duplicate-message problem already fixed for
-- the "New team member joined" notification, which is gated on the identical
-- v_inserted check.
--
-- Body is otherwise the mobile-number version (20260910000000) unchanged;
-- only the returned jsonb gains a field.

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

  return jsonb_build_object(
    'success', true,
    'agency_user_id', v_invite.agency_user_id,
    -- false when the person had already joined on this link before, so the
    -- caller can skip the welcome email.
    'is_new_member', v_inserted = 1
  );
end $$;
