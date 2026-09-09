
CREATE OR REPLACE FUNCTION admin_get_clients()
RETURNS TABLE (
  user_id          uuid,
  plan_name        text,
  trial_ends_at    timestamptz,
  agency_name      text,
  email            text,
  logo_url         text,
  current_storage_used bigint,
  max_storage_bytes    bigint,
  is_active        boolean,
  created_at       timestamptz,
  auth_email       text,
  auth_full_name   text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.user_id,
    s.plan_name,
    s.trial_ends_at,
    s.agency_name,
    s.email,
    s.logo_url,
    s.current_storage_used,
    s.max_storage_bytes,
    s.is_active,
    s.created_at,
    u.email          AS auth_email,
    u.raw_user_meta_data->>'full_name' AS auth_full_name
  FROM agency_subscriptions s
  LEFT JOIN auth.users u ON u.id = s.user_id
  ORDER BY s.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION admin_get_clients() TO anon, authenticated;
;
