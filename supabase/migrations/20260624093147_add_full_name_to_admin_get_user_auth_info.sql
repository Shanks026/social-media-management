-- RETURNS TABLE shape change requires drop + recreate.
drop function if exists public.admin_get_user_auth_info(uuid);

create function public.admin_get_user_auth_info(target_user_id uuid)
returns table (
  id                 uuid,
  email              text,
  full_name          text,
  phone              text,
  created_at         timestamptz,
  last_sign_in_at    timestamptz,
  email_confirmed_at timestamptz,
  banned_until       timestamptz
)
language plpgsql
security definer
set search_path to 'public', 'pg_temp', 'auth'
as $$
begin
  if not public.is_superadmin() then
    raise exception 'Only a superadmin can read user auth info';
  end if;
  return query
    select u.id,
           u.email::text,
           (u.raw_user_meta_data ->> 'full_name')::text,
           u.phone::text,
           u.created_at,
           u.last_sign_in_at,
           u.email_confirmed_at,
           u.banned_until
    from auth.users u
    where u.id = target_user_id;
end;
$$;

revoke execute on function public.admin_get_user_auth_info(uuid) from public, anon;
grant execute on function public.admin_get_user_auth_info(uuid) to authenticated;;
