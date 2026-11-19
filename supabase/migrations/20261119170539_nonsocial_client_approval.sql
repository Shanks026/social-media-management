-- #167: a Client couldn't approve a non-social Deliverable through its review
-- link. Both review pages send APPROVED when the Version has no platforms, but
-- the transition table only allowed PENDING_APPROVAL → SCHEDULED, so the RPC
-- failed and the Client saw "Something went wrong".
--
-- 1. Allow PENDING_APPROVAL → APPROVED.
CREATE OR REPLACE FUNCTION public.enforce_post_status_transition()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  allowed text[] := CASE OLD.status::text
    WHEN 'DRAFT'             THEN ARRAY['SUBMITTED','PENDING_APPROVAL','SCHEDULED','APPROVED','ARCHIVED']
    WHEN 'SUBMITTED'         THEN ARRAY['READY','CHANGES_REQUESTED','ARCHIVED']
    WHEN 'CHANGES_REQUESTED' THEN ARRAY['SUBMITTED','ARCHIVED']
    WHEN 'READY'             THEN ARRAY['PENDING_APPROVAL','SCHEDULED','APPROVED','ARCHIVED']
    WHEN 'PENDING_APPROVAL'  THEN ARRAY['SCHEDULED','APPROVED','NEEDS_REVISION','ARCHIVED']
    WHEN 'NEEDS_REVISION'    THEN ARRAY['ARCHIVED']
    WHEN 'SCHEDULED'         THEN ARRAY['PUBLISHED','ARCHIVED']
    WHEN 'APPROVED'          THEN ARRAY['DELIVERED','ARCHIVED']
    WHEN 'DELIVERED'         THEN ARRAY[]::text[]
    WHEN 'PUBLISHED'         THEN ARRAY[]::text[]
    WHEN 'ARCHIVED'          THEN ARRAY[]::text[]
    ELSE                          ARRAY[]::text[]
  END;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    IF NOT (NEW.status::text = ANY(allowed)) THEN
      RAISE EXCEPTION 'Invalid post status transition: % → %', OLD.status, NEW.status;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$

;

-- 2. Tell the agency about a non-social approval too (email + in-app), as for
--    SCHEDULED. Moving the "SCHEDULED or APPROVED" choice into this function
--    is ADR 0004 work (#176).
CREATE OR REPLACE FUNCTION public.update_post_status_by_token(p_token text, p_status text, p_feedback text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_version_id uuid;
  v_rec record;
  v_service_key text;
  v_project_url text;
  v_workspace_id uuid;
BEGIN
  SELECT post_version_id INTO v_version_id
  FROM public.share_tokens
  WHERE token = p_token AND expires_at > now() AND is_active = true;

  IF v_version_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired token';
  END IF;

  UPDATE public.post_versions
  SET status = p_status, client_notes = p_feedback
  WHERE id = v_version_id
  RETURNING id, post_id, client_id, created_by, title, status, target_date, client_notes
  INTO v_rec;

  UPDATE public.share_tokens SET is_active = false WHERE token = p_token;

  IF p_status IN ('SCHEDULED', 'APPROVED', 'NEEDS_REVISION') THEN
    BEGIN
      SELECT decrypted_secret INTO v_service_key
      FROM vault.decrypted_secrets WHERE name = 'service_role_key';
      SELECT decrypted_secret INTO v_project_url
      FROM vault.decrypted_secrets WHERE name = 'project_url';

      IF v_service_key IS NOT NULL AND v_project_url IS NOT NULL THEN
        PERFORM net.http_post(
          url := rtrim(v_project_url, '/') || '/functions/v1/send-approval-email',
          headers := jsonb_build_object('Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_service_key),
          body := jsonb_build_object('record', jsonb_build_object(
            'id', v_rec.id, 'client_id', v_rec.client_id, 'created_by', v_rec.created_by,
            'title', v_rec.title, 'status', v_rec.status, 'target_date', v_rec.target_date,
            'client_notes', v_rec.client_notes)));
      ELSE
        RAISE WARNING 'agency review-decision email skipped: vault secret % missing',
          CASE WHEN v_project_url IS NULL THEN 'project_url' ELSE 'service_role_key' END;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'agency review-decision email failed: %', SQLERRM;
    END;

    BEGIN
      SELECT user_id INTO v_workspace_id FROM public.clients WHERE id = v_rec.client_id;
      PERFORM public.emit_notifications(
        v_workspace_id, NULL, array[v_rec.created_by, v_workspace_id],
        'campaign_reviewed',
        CASE WHEN p_status IN ('SCHEDULED', 'APPROVED') THEN 'Client approved a deliverable'
             ELSE 'Client requested revisions' END,
        v_rec.title, 'post', v_rec.post_id,
        '/clients/' || v_rec.client_id || '/posts/' || v_rec.post_id);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'in-app review notification failed: %', SQLERRM;
    END;
  END IF;
END;
$function$

;
