
-- 1. Add column
ALTER TABLE public.agency_members
  ADD COLUMN IF NOT EXISTS roles_and_responsibilities TEXT;

-- 2. Drop and recreate get_team_members with the new field in its return type
DROP FUNCTION IF EXISTS public.get_team_members(uuid);

CREATE FUNCTION public.get_team_members(p_agency_user_id uuid)
RETURNS TABLE(
  id uuid,
  member_user_id uuid,
  system_role text,
  functional_role text,
  permissions jsonb,
  joined_at timestamp with time zone,
  email text,
  first_name text,
  last_name text,
  full_name text,
  avatar_url text,
  roles_and_responsibilities text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT
    am.id, am.member_user_id, am.system_role, am.functional_role,
    am.permissions, am.joined_at,
    au.email::text,
    (au.raw_user_meta_data->>'first_name')::text,
    (au.raw_user_meta_data->>'last_name')::text,
    COALESCE((au.raw_user_meta_data->>'full_name')::text, au.email::text),
    (au.raw_user_meta_data->>'avatar_url')::text,
    am.roles_and_responsibilities
  FROM agency_members am
  JOIN auth.users au ON au.id = am.member_user_id
  WHERE am.agency_user_id = p_agency_user_id AND am.is_active = true
  ORDER BY am.joined_at ASC;
$$;

-- 3. Update update_member_access to accept and persist the new field
CREATE OR REPLACE FUNCTION public.update_member_access(
  p_member_id uuid,
  p_system_role text,
  p_permissions jsonb,
  p_functional_role text DEFAULT NULL,
  p_roles_and_responsibilities text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
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
    system_role                = p_system_role,
    permissions                = p_permissions,
    functional_role            = COALESCE(p_functional_role, functional_role),
    roles_and_responsibilities = COALESCE(p_roles_and_responsibilities, roles_and_responsibilities)
  WHERE id = p_member_id;
END;
$$;
;
