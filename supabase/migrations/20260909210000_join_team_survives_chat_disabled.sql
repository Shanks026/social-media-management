-- Fix: joining a workspace with chat disabled failed the entire join.
--
-- join_team called `perform public.ensure_workspace_channel()` bare. That
-- function RAISES 'chat_not_available_on_plan' when the workspace's chat flag
-- is off — which is every Ignite workspace — and the exception propagated out
-- of join_team, rolling back the whole transaction.
--
-- The person was left with an auth account (created client-side by
-- supabase.auth.signUp before the RPC runs, so it survives the rollback) and no
-- agency_members row: signed in, belonging to nothing, with a link that now
-- reports success on retry only if chat is on. Reproduced against the live
-- schema with chat = false: join_team raised, and the member row was absent.
--
-- Chat membership is a *side effect* of joining, not part of it. Two guards:
--   1. Skip when the workspace has chat off — the expected, non-exceptional case.
--   2. Swallow anything else, because no chat failure should cost someone their
--      seat on the team.
-- Neither loses anything: ensure_workspace_channel() is idempotent and already
-- runs on first load of /chat, which is how pre-existing members were
-- backfilled. A member who skips it here is added the moment they open chat.
--
-- Body is otherwise the Phase 2 version (20260909190000) unchanged.

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
  where id = v_member_uid;

  -- Only count a genuinely new member, and only announce one.
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
