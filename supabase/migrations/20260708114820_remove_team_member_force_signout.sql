CREATE OR REPLACE FUNCTION public.remove_team_member(p_member_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_target agency_members%ROWTYPE;
BEGIN
  IF NOT public.is_workspace_owner() THEN
    RAISE EXCEPTION 'Only the workspace owner can remove a member';
  END IF;

  SELECT * INTO v_target
  FROM agency_members
  WHERE id = p_member_id AND agency_user_id = public.get_my_agency_user_id();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Member not found';
  END IF;

  IF v_target.system_role = 'owner' OR v_target.member_user_id = v_target.agency_user_id THEN
    RAISE EXCEPTION 'The owner row cannot be removed';
  END IF;

  UPDATE agency_members SET is_active = false WHERE id = p_member_id;

  -- Force sign-out everywhere: an open session's access token stays valid
  -- until it naturally expires/refreshes, so the client-side realtime
  -- redirect (AuthContext -> /no-access) only catches devices that are
  -- actively subscribed right now. Deleting their session rows invalidates
  -- every refresh token immediately, so every other device is forced to
  -- re-authenticate on its very next request instead of just eventually.
  DELETE FROM auth.sessions WHERE user_id = v_target.member_user_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.remove_team_member(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.remove_team_member(uuid) TO authenticated;
;
