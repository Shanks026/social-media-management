
create or replace function public.request_internal_changes(p_post_version_id uuid, p_notes text DEFAULT NULL::text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
DECLARE
  v_post_id uuid; v_workspace_id uuid; v_created_by uuid; v_client_id uuid; v_title text;
BEGIN
  IF NOT public.is_workspace_admin() THEN
    RAISE EXCEPTION 'Only owner or admin can request changes';
  END IF;

  SELECT post_id, created_by, client_id, title
    INTO v_post_id, v_created_by, v_client_id, v_title
  FROM post_versions WHERE id = p_post_version_id;

  v_workspace_id := public.get_my_agency_user_id();

  UPDATE post_versions SET status = 'CHANGES_REQUESTED', admin_notes = p_notes
  WHERE id = p_post_version_id AND status = 'SUBMITTED';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Can only request changes on SUBMITTED posts';
  END IF;

  INSERT INTO approval_events (post_version_id, post_id, actor_id, workspace_user_id, action, notes)
  VALUES (p_post_version_id, v_post_id, auth.uid(), v_workspace_id, 'changes_requested', p_notes);

  PERFORM public.emit_notifications(
    v_workspace_id, auth.uid(), array[v_created_by],
    'post_status_changed', 'Changes requested on your deliverable', coalesce(p_notes, v_title),
    'post', v_post_id, '/clients/' || v_client_id || '/posts/' || v_post_id);
END;
$function$;
;
