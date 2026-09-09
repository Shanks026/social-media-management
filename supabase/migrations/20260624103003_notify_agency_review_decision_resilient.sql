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
BEGIN
  -- 1. Find the version ID associated with this token
  SELECT post_version_id INTO v_version_id
  FROM public.share_tokens
  WHERE token = p_token AND expires_at > now() AND is_active = true;

  IF v_version_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired token';
  END IF;

  -- 2. Update the status and feedback, capturing the fields the email needs
  UPDATE public.post_versions
  SET
    status = p_status::post_status,
    client_notes = p_feedback
  WHERE id = v_version_id
  RETURNING id, client_id, created_by, title, status, target_date, client_notes
  INTO v_rec;

  -- 3. Invalidate the token used
  UPDATE public.share_tokens
  SET is_active = false
  WHERE token = p_token;

  -- 4. Notify the agency (post creator) when the client approves (SCHEDULED) or
  --    requests changes (NEEDS_REVISION). Best-effort: wrapped so a Vault/pg_net
  --    failure can never roll back or block the client's decision.
  IF p_status IN ('SCHEDULED', 'NEEDS_REVISION') THEN
    BEGIN
      SELECT decrypted_secret INTO v_service_key
      FROM vault.decrypted_secrets
      WHERE name = 'service_role_key';

      IF v_service_key IS NOT NULL THEN
        PERFORM net.http_post(
          url := 'https://ockvcyevnozuczzngrwg.supabase.co/functions/v1/send-approval-email',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_service_key
          ),
          body := jsonb_build_object('record', jsonb_build_object(
            'id', v_rec.id,
            'client_id', v_rec.client_id,
            'created_by', v_rec.created_by,
            'title', v_rec.title,
            'status', v_rec.status,
            'target_date', v_rec.target_date,
            'client_notes', v_rec.client_notes
          ))
        );
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'agency review-decision notification failed: %', SQLERRM;
    END;
  END IF;
END;
$function$;;
