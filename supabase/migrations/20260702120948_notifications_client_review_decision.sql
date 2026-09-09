
create or replace function public.update_post_status_by_token(p_token text, p_status text, p_feedback text DEFAULT NULL::text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
DECLARE
  v_version_id uuid;
  v_rec record;
  v_service_key text;
  v_workspace_id uuid;
BEGIN
  SELECT post_version_id INTO v_version_id
  FROM public.share_tokens
  WHERE token = p_token AND expires_at > now() AND is_active = true;

  IF v_version_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired token';
  END IF;

  UPDATE public.post_versions
  SET status = p_status::post_status, client_notes = p_feedback
  WHERE id = v_version_id
  RETURNING id, post_id, client_id, created_by, title, status, target_date, client_notes
  INTO v_rec;

  UPDATE public.share_tokens SET is_active = false WHERE token = p_token;

  IF p_status IN ('SCHEDULED', 'NEEDS_REVISION') THEN
    BEGIN
      SELECT decrypted_secret INTO v_service_key
      FROM vault.decrypted_secrets WHERE name = 'service_role_key';

      IF v_service_key IS NOT NULL THEN
        PERFORM net.http_post(
          url := 'https://ockvcyevnozuczzngrwg.supabase.co/functions/v1/send-approval-email',
          headers := jsonb_build_object('Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_service_key),
          body := jsonb_build_object('record', jsonb_build_object(
            'id', v_rec.id, 'client_id', v_rec.client_id, 'created_by', v_rec.created_by,
            'title', v_rec.title, 'status', v_rec.status, 'target_date', v_rec.target_date,
            'client_notes', v_rec.client_notes)));
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'agency review-decision email failed: %', SQLERRM;
    END;

    BEGIN
      SELECT user_id INTO v_workspace_id FROM public.clients WHERE id = v_rec.client_id;
      PERFORM public.emit_notifications(
        v_workspace_id, NULL, array[v_rec.created_by, v_workspace_id],
        'campaign_reviewed',
        CASE WHEN p_status = 'SCHEDULED' THEN 'Client approved a deliverable'
             ELSE 'Client requested revisions' END,
        v_rec.title, 'post', v_rec.post_id,
        '/clients/' || v_rec.client_id || '/posts/' || v_rec.post_id);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'in-app review notification failed: %', SQLERRM;
    END;
  END IF;
END;
$function$;
;
