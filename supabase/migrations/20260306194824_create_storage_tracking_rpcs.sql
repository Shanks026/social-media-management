
-- Atomically add bytes to current_storage_used
CREATE OR REPLACE FUNCTION increment_storage_used(p_user_id UUID, p_bytes BIGINT)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE agency_subscriptions
  SET current_storage_used = COALESCE(current_storage_used, 0) + p_bytes
  WHERE user_id = p_user_id;
$$;

-- Atomically subtract bytes from current_storage_used (never goes below 0)
CREATE OR REPLACE FUNCTION decrement_storage_used(p_user_id UUID, p_bytes BIGINT)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE agency_subscriptions
  SET current_storage_used = GREATEST(0, COALESCE(current_storage_used, 0) - p_bytes)
  WHERE user_id = p_user_id;
$$;
;
