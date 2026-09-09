-- Invite links become multi-use: valid until they expire or are revoked,
-- however many people join on them.
--
-- Before this, join_team stamped accepted_at and both token lookups filtered
-- accepted_at IS NULL, so the first person to join burned the link for
-- everyone behind them — the reported "invite link shows invalid after I
-- onboard a user". The seat limit, not the token, is what caps how many people
-- can actually land: join_team already re-checks max_team_members per join and
-- that is unchanged.
--
-- accepted_at is kept, but demoted from "this link is spent" to "first time
-- anyone used it". use_count carries the real usage signal.

alter table public.agency_invites
  add column if not exists use_count integer not null default 0;

comment on column public.agency_invites.accepted_at is
  'First time anyone joined on this link. NOT a spent flag — links are multi-use until expires_at.';
comment on column public.agency_invites.use_count is
  'How many members have joined on this link.';

-- Retire every currently-live link. Two reasons, one required and one asked
-- for: previously-accepted links (including an admin-role one) would otherwise
-- silently come back to life the moment the accepted_at filter is dropped; and
-- every existing link was handed out under single-use expectations, so none of
-- them should quietly become a reusable admission ticket. The owner issues
-- fresh links after this. Revoking is already expressed as backdating
-- expires_at (see useRevokeInvite), so this uses the same mechanism.
update public.agency_invites
set expires_at = now()
where expires_at > now();

-- Seed the counter for links that were used under the old single-use rule, so
-- the Team page doesn't report 0 joins on a link that plainly had one.
update public.agency_invites
set use_count = 1
where accepted_at is not null and use_count = 0;

-- ─── Token lookup: expiry is now the only gate ──────────────────────────────
create or replace function public.get_invite_by_token(p_token text)
returns json
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_invite              agency_invites%rowtype;
  v_agency_name         text;
  v_logo_url            text;
  v_logo_horizontal_url text;
begin
  select * into v_invite
  from agency_invites
  where token = p_token
    and expires_at > now();

  if not found then
    return json_build_object('valid', false, 'error', 'This invite link is invalid or has expired.');
  end if;

  select agency_name, logo_url, logo_horizontal_url
  into v_agency_name, v_logo_url, v_logo_horizontal_url
  from agency_subscriptions where user_id = v_invite.agency_user_id;

  return json_build_object(
    'valid',               true,
    'agency_name',         v_agency_name,
    'logo_url',            v_logo_url,
    'logo_horizontal_url', v_logo_horizontal_url,
    'system_role',         coalesce(v_invite.system_role, 'member')
  );
end;
$function$;

-- ─── Join: reusable, and idempotent for a repeat click ──────────────────────
create or replace function public.join_team(
  p_token text, p_first_name text, p_last_name text, p_functional_role text default null::text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
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

  -- Still the real cap on how many people a link can bring in.
  select * into v_sub from agency_subscriptions where user_id = v_invite.agency_user_id;
  if v_sub.max_team_members is not null then
    select count(*) into v_seat_count from agency_members
    where agency_user_id = v_invite.agency_user_id and is_active = true;
    if v_seat_count >= v_sub.max_team_members then
      return jsonb_build_object('error', 'TEAM_SEAT_LIMIT_REACHED');
    end if;
  end if;

  insert into agency_members (agency_user_id, member_user_id, system_role, functional_role, permissions)
  values (v_invite.agency_user_id, v_member_uid, v_system_role, p_functional_role, v_permissions)
  on conflict (agency_user_id, member_user_id) do nothing;

  get diagnostics v_inserted = row_count;

  -- Auto-add the new member to the workspace chat channel (creates it on first use).
  perform public.ensure_workspace_channel();

  update auth.users
  set raw_user_meta_data = raw_user_meta_data || jsonb_build_object(
    'first_name', v_first_name, 'last_name', v_last_name,
    'full_name', v_first_name || ' ' || v_last_name)
  where id = v_member_uid;

  -- Only count a genuinely new member, and only announce one. Re-opening the
  -- link as someone who already joined is now a plausible thing to do, and it
  -- previously fired a duplicate "New team member joined" every time.
  if v_inserted = 1 then
    update agency_invites
    set use_count   = use_count + 1,
        accepted_at = coalesce(accepted_at, now())   -- first use only
    where id = v_invite.id;

    perform public.emit_notifications(
      v_invite.agency_user_id, v_member_uid,
      public.workspace_admin_uids(v_invite.agency_user_id),
      'team_member_joined', 'New team member joined',
      trim(v_first_name || ' ' || v_last_name) || ' joined your workspace',
      -- Was '/settings', which has no team tab: Settings.jsx's VALID_TABS is
      -- ['profile','agency','invoice','danger'] and silently falls back to
      -- Profile, so this notification never reached the team list.
      'team', null, '/team');
  end if;

  return jsonb_build_object('success', true, 'agency_user_id', v_invite.agency_user_id);
end;
$function$;
