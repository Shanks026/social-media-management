
DROP FUNCTION IF EXISTS get_team_members(uuid);

CREATE FUNCTION get_team_members(p_agency_user_id uuid)
RETURNS TABLE (
  id              uuid,
  member_user_id  uuid,
  system_role     text,
  functional_role text,
  joined_at       timestamptz,
  email           text,
  first_name      text,
  last_name       text,
  full_name       text,
  avatar_url      text
)
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT
    am.id,
    am.member_user_id,
    am.system_role,
    am.functional_role,
    am.joined_at,
    au.email::text,
    (au.raw_user_meta_data->>'first_name')::text,
    (au.raw_user_meta_data->>'last_name')::text,
    COALESCE(
      (au.raw_user_meta_data->>'full_name')::text,
      au.email::text
    ),
    (au.raw_user_meta_data->>'avatar_url')::text
  FROM agency_members am
  JOIN auth.users au ON au.id = am.member_user_id
  WHERE am.agency_user_id = p_agency_user_id
    AND am.is_active = true
  ORDER BY am.joined_at ASC;
$$;
;
