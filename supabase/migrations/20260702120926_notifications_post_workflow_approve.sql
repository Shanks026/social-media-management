
create or replace function public.approve_internally(p_post_version_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
DECLARE
  v_post_id uuid; v_workspace_id uuid; v_created_by uuid; v_client_id uuid; v_title text;
BEGIN
  IF NOT public.is_workspace_admin() THEN
    RAISE EXCEPTION 'Only owner or admin can approve posts internally';
  END IF;

  SELECT post_id, created_by, client_id, title
    INTO v_post_id, v_created_by, v_client_id, v_title
  FROM post_versions WHERE id = p_post_version_id;

  v_workspace_id := public.get_my_agency_user_id();

  UPDATE post_versions SET status = 'READY'
  WHERE id = p_post_version_id AND status = 'SUBMITTED';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Can only approve SUBMITTED posts';
  END IF;

  INSERT INTO approval_events (post_version_id, post_id, actor_id, workspace_user_id, action)
  VALUES (p_post_version_id, v_post_id, auth.uid(), v_workspace_id, 'approved');

  PERFORM public.emit_notifications(
    v_workspace_id, auth.uid(), array[v_created_by],
    'post_status_changed', 'Your deliverable was approved', v_title,
    'post', v_post_id, '/clients/' || v_client_id || '/posts/' || v_post_id);
END;
$function$;
;
