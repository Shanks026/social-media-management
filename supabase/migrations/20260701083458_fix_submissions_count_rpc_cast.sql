
CREATE OR REPLACE FUNCTION public.get_my_submissions_count(
  p_status text DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count bigint;
BEGIN
  SELECT COUNT(*)
  INTO v_count
  FROM public.approval_events ae
  JOIN public.post_versions pv ON pv.id = ae.post_version_id
  WHERE ae.action = 'submitted'
    AND ae.actor_id = auth.uid()
    AND ae.workspace_user_id = public.get_my_agency_user_id()
    AND (p_status IS NULL OR pv.status::text = p_status);
  RETURN v_count;
END;
$$;
;
