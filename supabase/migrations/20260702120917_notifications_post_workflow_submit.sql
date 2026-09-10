
create or replace function public.submit_for_internal_approval(p_post_version_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
DECLARE
  v_post_id uuid; v_workspace_id uuid; v_created_by uuid; v_client_id uuid; v_title text;
BEGIN
  SELECT post_id, created_by, client_id, title
    INTO v_post_id, v_created_by, v_client_id, v_title
  FROM post_versions WHERE id = p_post_version_id;

  IF v_created_by IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'You can only submit your own deliverables';
  END IF;

  v_workspace_id := public.get_my_agency_user_id();

  UPDATE post_versions SET status = 'SUBMITTED', submitted_by = auth.uid()
  WHERE id = p_post_version_id AND status IN ('DRAFT', 'CHANGES_REQUESTED');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Can only submit DRAFT or CHANGES_REQUESTED posts';
  END IF;

  INSERT INTO approval_events (post_version_id, post_id, actor_id, workspace_user_id, action)
  VALUES (p_post_version_id, v_post_id, auth.uid(), v_workspace_id, 'submitted');

  PERFORM public.emit_notifications(
    v_workspace_id, auth.uid(), public.workspace_admin_uids(v_workspace_id),
    'post_status_changed', 'New deliverable submitted for review', v_title,
    'post', v_post_id, '/clients/' || v_client_id || '/posts/' || v_post_id);
END;
$function$;
;
