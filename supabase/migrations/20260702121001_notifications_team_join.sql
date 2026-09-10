
create or replace function public.join_team(p_token text, p_first_name text, p_last_name text, p_functional_role text DEFAULT NULL::text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
DECLARE
  v_invite        agency_invites%ROWTYPE;
  v_member_uid    uuid := auth.uid();
  v_system_role   text;
  v_permissions   jsonb;
  v_sub           agency_subscriptions%ROWTYPE;
  v_seat_count    int;
BEGIN
  IF v_member_uid IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  SELECT * INTO v_invite FROM agency_invites
  WHERE token = p_token AND accepted_at IS NULL AND expires_at > now();

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'This invite link is no longer valid. Ask your workspace owner for a new one.');
  END IF;

  v_system_role := coalesce(v_invite.system_role, 'member');
  v_permissions := CASE v_system_role
    WHEN 'admin' THEN '{"documents":"manage"}'::jsonb
    ELSE              '{"documents":"view"}'::jsonb END;

  SELECT * INTO v_sub FROM agency_subscriptions WHERE user_id = v_invite.agency_user_id;
  IF v_sub.max_team_members IS NOT NULL THEN
    SELECT COUNT(*) INTO v_seat_count FROM agency_members
    WHERE agency_user_id = v_invite.agency_user_id AND is_active = true;
    IF v_seat_count >= v_sub.max_team_members THEN
      RETURN jsonb_build_object('error', 'TEAM_SEAT_LIMIT_REACHED');
    END IF;
  END IF;

  INSERT INTO agency_members (agency_user_id, member_user_id, system_role, functional_role, permissions)
  VALUES (v_invite.agency_user_id, v_member_uid, v_system_role, p_functional_role, v_permissions)
  ON CONFLICT (agency_user_id, member_user_id) DO NOTHING;

  UPDATE agency_invites SET accepted_at = now() WHERE id = v_invite.id;

  UPDATE auth.users
  SET raw_user_meta_data = raw_user_meta_data || jsonb_build_object(
    'first_name', p_first_name, 'last_name', p_last_name,
    'full_name', p_first_name || ' ' || p_last_name)
  WHERE id = v_member_uid;

  PERFORM public.emit_notifications(
    v_invite.agency_user_id, v_member_uid,
    public.workspace_admin_uids(v_invite.agency_user_id),
    'team_member_joined', 'New team member joined',
    trim(p_first_name || ' ' || p_last_name) || ' joined your workspace',
    'team', NULL, '/settings');

  RETURN jsonb_build_object('success', true, 'agency_user_id', v_invite.agency_user_id);
END;
$function$;
;
