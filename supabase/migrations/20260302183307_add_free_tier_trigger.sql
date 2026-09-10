CREATE OR REPLACE FUNCTION public.handle_new_user_subscription()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.agency_subscriptions (
    user_id,
    plan_name,
    max_clients,
    max_storage_bytes,
    basic_whitelabel_enabled,
    full_whitelabel_enabled
  )
  VALUES (
    NEW.id,
    'FREE',
    1,
    5368709120, -- 5GB
    false,
    false
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to call the function on signup
DROP TRIGGER IF EXISTS tr_on_auth_user_created ON auth.users;
CREATE TRIGGER tr_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_subscription();;
