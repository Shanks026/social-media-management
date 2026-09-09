
CREATE OR REPLACE FUNCTION public.submit_for_internal_approval(p_post_version_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_post_id         uuid;
  v_workspace_id    uuid;
  v_created_by      uuid;
BEGIN
  SELECT post_id, created_by INTO v_post_id, v_created_by
  FROM post_versions WHERE id = p_post_version_id;

  IF v_created_by IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'You can only submit your own deliverables';
  END IF;

  v_workspace_id := public.get_my_agency_user_id();

  UPDATE post_versions
  SET status = 'SUBMITTED', submitted_by = auth.uid()
  WHERE id = p_post_version_id AND status IN ('DRAFT', 'CHANGES_REQUESTED');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Can only submit DRAFT or CHANGES_REQUESTED posts';
  END IF;

  INSERT INTO approval_events (post_version_id, post_id, actor_id, workspace_user_id, action)
  VALUES (p_post_version_id, v_post_id, auth.uid(), v_workspace_id, 'submitted');
END;
$$;
;
