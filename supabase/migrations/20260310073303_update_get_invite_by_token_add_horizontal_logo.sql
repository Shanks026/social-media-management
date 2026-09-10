
DROP FUNCTION IF EXISTS get_invite_by_token(text);

CREATE FUNCTION get_invite_by_token(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_invite agency_invites%ROWTYPE;
  v_agency_name text;
  v_logo_url text;
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
  FROM agency_subscriptions
  WHERE user_id = v_invite.agency_user_id;

  RETURN json_build_object(
    'valid', true,
    'agency_name', v_agency_name,
    'logo_url', v_logo_url,
    'logo_horizontal_url', v_logo_horizontal_url
  );
END;
$$;
;
