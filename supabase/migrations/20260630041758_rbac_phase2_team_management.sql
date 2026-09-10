
-- ── Phase 2: Team Management ─────────────────────────────────────────────────

-- 1. Tighten agency_invites INSERT to explicitly require is_workspace_owner()
DROP POLICY IF EXISTS agency_invites_insert_owner ON public.agency_invites;
CREATE POLICY agency_invites_insert_owner ON public.agency_invites
  FOR INSERT WITH CHECK (
    agency_user_id = public.get_my_agency_user_id()
    AND public.is_workspace_owner()
  );

-- 2. Update join_team: reads functional_role + permissions from invite,
--    drops p_functional_role param, adds server-side seat check
CREATE OR REPLACE FUNCTION public.join_team(p_token text, p_first_name text, p_last_name text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $function$
DECLARE
  v_invite       agency_invites%ROWTYPE;
  v_member_uid   uuid := auth.uid();
  v_permissions  jsonb;
  v_sub          agency_subscriptions%ROWTYPE;
  v_seat_count   int;
BEGIN
  IF v_member_uid IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  SELECT * INTO v_invite
  FROM agency_invites
  WHERE token = p_token
    AND accepted_at IS NULL
    AND expires_at > now();

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'This invite link is no longer valid. Ask your agency owner for a new one.');
  END IF;

  v_permissions := v_invite.permissions;
  IF v_permissions IS NULL
     OR v_permissions->>'documents' NOT IN ('none', 'view', 'manage') THEN
    v_permissions := '{"documents":"view"}'::jsonb;
  END IF;

  SELECT * INTO v_sub FROM agency_subscriptions WHERE user_id = v_invite.agency_user_id;
  IF v_sub.max_team_members IS NOT NULL THEN
    SELECT COUNT(*) INTO v_seat_count
    FROM agency_members
    WHERE agency_user_id = v_invite.agency_user_id AND is_active = true;
    IF v_seat_count >= v_sub.max_team_members THEN
      RETURN jsonb_build_object('error', 'TEAM_SEAT_LIMIT_REACHED');
    END IF;
  END IF;

  INSERT INTO agency_members (agency_user_id, member_user_id, system_role, functional_role, permissions)
  VALUES (v_invite.agency_user_id, v_member_uid, 'member', v_invite.functional_role, v_permissions)
  ON CONFLICT (agency_user_id, member_user_id) DO NOTHING;

  UPDATE agency_invites SET accepted_at = now() WHERE id = v_invite.id;

  UPDATE auth.users
  SET raw_user_meta_data = raw_user_meta_data
    || jsonb_build_object(
         'first_name', p_first_name,
         'last_name',  p_last_name,
         'full_name',  p_first_name || ' ' || p_last_name
       )
  WHERE id = v_member_uid;

  RETURN jsonb_build_object('success', true, 'agency_user_id', v_invite.agency_user_id);
END;
$function$;

-- 3. Update get_invite_by_token: return functional_role for display on join page
CREATE OR REPLACE FUNCTION public.get_invite_by_token(p_token text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $function$
DECLARE
  v_invite              agency_invites%ROWTYPE;
  v_agency_name         text;
  v_logo_url            text;
  v_logo_horizontal_url text;
BEGIN
  SELECT * INTO v_invite
  FROM agency_invites
  WHERE token = p_token
    AND accepted_at IS NULL
    AND expires_at > now();

  IF NOT FOUND THEN
    RETURN json_build_object('valid', false, 'error', 'This invite link is invalid or has expired.');
  END IF;

  SELECT agency_name, logo_url, logo_horizontal_url
  INTO v_agency_name, v_logo_url, v_logo_horizontal_url
  FROM agency_subscriptions WHERE user_id = v_invite.agency_user_id;

  RETURN json_build_object(
    'valid',                true,
    'agency_name',          v_agency_name,
    'logo_url',             v_logo_url,
    'logo_horizontal_url',  v_logo_horizontal_url,
    'functional_role',      v_invite.functional_role
  );
END;
$function$;

-- 4. New update_member_access RPC (owner-only)
CREATE OR REPLACE FUNCTION public.update_member_access(
  p_member_id       uuid,
  p_system_role     text,
  p_permissions     jsonb,
  p_functional_role text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $function$
DECLARE
  v_target agency_members%ROWTYPE;
BEGIN
  IF NOT public.is_workspace_owner() THEN
    RAISE EXCEPTION 'Only the workspace owner can manage team access';
  END IF;

  SELECT * INTO v_target
  FROM agency_members
  WHERE id = p_member_id AND agency_user_id = public.get_my_agency_user_id();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Member not found';
  END IF;

  IF v_target.system_role = 'owner' OR v_target.member_user_id = v_target.agency_user_id THEN
    RAISE EXCEPTION 'The owner row cannot be modified';
  END IF;

  IF p_system_role NOT IN ('admin', 'member') THEN
    RAISE EXCEPTION 'Role must be admin or member';
  END IF;

  IF p_permissions IS NULL OR p_permissions->>'documents' NOT IN ('none', 'view', 'manage') THEN
    RAISE EXCEPTION 'permissions.documents must be none, view, or manage';
  END IF;

  UPDATE agency_members
  SET
    system_role     = p_system_role,
    permissions     = p_permissions,
    functional_role = COALESCE(p_functional_role, functional_role)
  WHERE id = p_member_id;
END;
$function$;

-- 5. get_team_members: add permissions (must drop+recreate to change return type)
DROP FUNCTION IF EXISTS public.get_team_members(uuid);
CREATE FUNCTION public.get_team_members(p_agency_user_id uuid)
RETURNS TABLE(
  id uuid, member_user_id uuid, system_role text, functional_role text,
  permissions jsonb, joined_at timestamptz,
  email text, first_name text, last_name text, full_name text, avatar_url text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $function$
  SELECT
    am.id, am.member_user_id, am.system_role, am.functional_role,
    am.permissions, am.joined_at,
    au.email::text,
    (au.raw_user_meta_data->>'first_name')::text,
    (au.raw_user_meta_data->>'last_name')::text,
    COALESCE((au.raw_user_meta_data->>'full_name')::text, au.email::text),
    (au.raw_user_meta_data->>'avatar_url')::text
  FROM agency_members am
  JOIN auth.users au ON au.id = am.member_user_id
  WHERE am.agency_user_id = p_agency_user_id AND am.is_active = true
  ORDER BY am.joined_at ASC;
$function$;

-- 6. get_removed_members: add permissions
DROP FUNCTION IF EXISTS public.get_removed_members(uuid);
CREATE FUNCTION public.get_removed_members(p_agency_user_id uuid)
RETURNS TABLE(
  id uuid, member_user_id uuid, system_role text, functional_role text,
  permissions jsonb, joined_at timestamptz,
  email text, first_name text, last_name text, full_name text, avatar_url text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $function$
  SELECT
    am.id, am.member_user_id, am.system_role, am.functional_role,
    am.permissions, am.joined_at,
    au.email::text,
    (au.raw_user_meta_data->>'first_name')::text,
    (au.raw_user_meta_data->>'last_name')::text,
    COALESCE((au.raw_user_meta_data->>'full_name')::text, au.email::text),
    (au.raw_user_meta_data->>'avatar_url')::text
  FROM agency_members am
  JOIN auth.users au ON au.id = am.member_user_id
  WHERE am.agency_user_id = p_agency_user_id AND am.is_active = false
  ORDER BY am.joined_at ASC;
$function$;
;
