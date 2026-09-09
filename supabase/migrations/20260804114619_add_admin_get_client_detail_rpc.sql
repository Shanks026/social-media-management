CREATE OR REPLACE FUNCTION public.admin_get_client_detail(target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
begin
  if not is_superadmin() then
    raise exception 'Access denied';
  end if;

  return (
    select to_jsonb(s) from agency_subscriptions s where s.user_id = target_user_id
  );
end;
$$;

REVOKE ALL ON FUNCTION public.admin_get_client_detail(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_get_client_detail(uuid) TO authenticated;;
