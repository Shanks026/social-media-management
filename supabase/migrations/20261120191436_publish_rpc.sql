-- #174 (ADR 0004): publishing goes through database functions, and the
-- Client's "published" email is queued from the database for every publish,
-- a single platform included, instead of from a React handler.
--
--   mark_published(version)                 whole Deliverable → PUBLISHED
--   mark_platform_published(version, platform)  one platform; the last one → PUBLISHED
--
-- An Owner or Admin may publish, and so may the system (the service role:
-- the auto-publishing job to come). A Member may not.

-- 1. Queue an edge function call through pg_net with the Vault secrets.
--    pg_net sends after the transaction commits, so a rolled-back transition
--    sends nothing. Internal: users can't call it.
CREATE OR REPLACE FUNCTION public.queue_edge_function(p_function text, p_body jsonb)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_service_key text;
  v_project_url text;
BEGIN
  SELECT decrypted_secret INTO v_service_key FROM vault.decrypted_secrets WHERE name = 'service_role_key';
  SELECT decrypted_secret INTO v_project_url FROM vault.decrypted_secrets WHERE name = 'project_url';

  IF v_service_key IS NULL OR v_project_url IS NULL THEN
    RAISE WARNING '% not queued: vault secret % missing', p_function,
      CASE WHEN v_project_url IS NULL THEN 'project_url' ELSE 'service_role_key' END;
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := rtrim(v_project_url, '/') || '/functions/v1/' || p_function,
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'Authorization', 'Bearer ' || v_service_key),
    body := p_body);
EXCEPTION WHEN OTHERS THEN
  -- An email is a side effect: never undo the transition because of it.
  RAISE WARNING '% not queued: %', p_function, SQLERRM;
END;
$function$;

ALTER FUNCTION public.queue_edge_function(text, jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.queue_edge_function(text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.queue_edge_function(text, jsonb) TO service_role;

-- 2. The caller check can admit the system.
DROP FUNCTION public.assert_deliverable_admin(uuid, text);

CREATE FUNCTION public.assert_deliverable_admin(
  p_version_id uuid,
  p_action text,
  p_allow_system boolean DEFAULT false
) RETURNS void
LANGUAGE plpgsql
STABLE
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- The system acts for every workspace, so there is no workspace to check.
  IF p_allow_system AND auth.uid() IS NULL AND auth.role() = 'service_role' THEN
    IF NOT EXISTS (SELECT 1 FROM post_versions WHERE id = p_version_id) THEN
      RAISE EXCEPTION 'Deliverable version % not found', p_version_id USING ERRCODE = 'no_data_found';
    END IF;
    RETURN;
  END IF;

  IF auth.uid() IS NULL OR NOT public.is_workspace_admin() THEN
    RAISE EXCEPTION 'Only an Owner or Admin can %', p_action
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM post_versions pv
    JOIN clients c ON c.id = pv.client_id
    WHERE pv.id = p_version_id
      AND c.user_id = public.get_my_agency_user_id()
  ) THEN
    RAISE EXCEPTION 'Deliverable version % not found', p_version_id USING ERRCODE = 'no_data_found';
  END IF;
END;
$function$;

ALTER FUNCTION public.assert_deliverable_admin(uuid, text, boolean) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.assert_deliverable_admin(uuid, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assert_deliverable_admin(uuid, text, boolean) TO service_role;

-- 3. The shared helper learns PUBLISH and PUBLISH_PLATFORM.
CREATE OR REPLACE FUNCTION public.deliverable_event(
  p_version_id uuid,
  p_event text,
  p_details jsonb DEFAULT '{}'::jsonb
) RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_rec record;
  v_workspace_id uuid;
  v_from text[];
  v_to text;
  v_action text;
  v_title text;
  v_note text;
  v_date timestamptz;
  v_platform text;
  v_schedules jsonb;
  v_all_published boolean;
  v_social boolean;
  v_per_platform boolean;
  v_prev_flag text;
  v_now timestamptz := now();
BEGIN
  SELECT pv.id, pv.post_id, pv.client_id, pv.created_by, pv.title, pv.status::text AS status,
         pv.platform, pv.platform_schedules
    INTO v_rec
  FROM post_versions pv
  WHERE pv.id = p_version_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Deliverable version % not found', p_version_id USING ERRCODE = 'no_data_found';
  END IF;

  v_social := coalesce(cardinality(v_rec.platform), 0) > 0;
  v_per_platform := coalesce(jsonb_typeof(v_rec.platform_schedules) = 'object'
                             AND v_rec.platform_schedules <> '{}'::jsonb, false);

  CASE p_event
    WHEN 'DELIVER' THEN
      v_from := ARRAY['APPROVED']; v_to := 'DELIVERED'; v_action := 'mark delivered';
      v_title := 'Your deliverable was delivered';
    WHEN 'SCHEDULE' THEN
      v_from := ARRAY['DRAFT', 'READY']; v_to := 'SCHEDULED'; v_action := 'schedule';
      v_title := 'Your deliverable was scheduled';
    WHEN 'APPROVE' THEN
      v_from := ARRAY['DRAFT', 'READY']; v_to := 'APPROVED'; v_action := 'approve';
      v_title := 'Your deliverable was approved';
    WHEN 'PUBLISH' THEN
      v_from := ARRAY['SCHEDULED']; v_to := 'PUBLISHED'; v_action := 'publish';
      v_title := 'Your deliverable was published';
    WHEN 'PUBLISH_PLATFORM' THEN
      -- The status moves only when this is the last platform (below).
      v_from := ARRAY['SCHEDULED']; v_to := 'SCHEDULED'; v_action := 'publish';
      v_title := 'Your deliverable was published';
    ELSE
      RAISE EXCEPTION 'Unknown deliverable event: %', p_event;
  END CASE;

  IF NOT (v_rec.status = ANY (v_from)) THEN
    RAISE EXCEPTION 'Cannot % a deliverable that is %', v_action, v_rec.status;
  END IF;

  IF p_event = 'SCHEDULE' THEN
    IF NOT v_social THEN
      RAISE EXCEPTION 'Only a Social deliverable can be scheduled; approve this one instead';
    END IF;
    v_date := (p_details ->> 'target_date')::timestamptz;
    IF NOT v_per_platform AND v_date IS NULL THEN
      RAISE EXCEPTION 'Please select a publish date.';
    END IF;
  ELSIF p_event = 'APPROVE' AND v_social THEN
    RAISE EXCEPTION 'Only a non-social deliverable can be approved; schedule this one instead';
  ELSIF p_event = 'PUBLISH_PLATFORM' THEN
    v_platform := p_details ->> 'platform';
    IF NOT v_per_platform THEN
      RAISE EXCEPTION 'This deliverable has one publish date, not per-platform dates; mark the whole deliverable published';
    END IF;
    IF v_platform IS NULL OR NOT (v_rec.platform_schedules ? v_platform) THEN
      RAISE EXCEPTION 'This deliverable is not scheduled on %', coalesce(v_platform, 'that platform');
    END IF;
    IF v_rec.platform_schedules -> v_platform ->> 'published_at' IS NOT NULL THEN
      RAISE EXCEPTION '% is already marked published', v_platform;
    END IF;

    v_schedules := jsonb_set(v_rec.platform_schedules, ARRAY[v_platform, 'published_at'], to_jsonb(v_now));
    v_all_published := NOT EXISTS (
      SELECT 1 FROM jsonb_each(v_schedules) s WHERE s.value ->> 'published_at' IS NULL);
    IF v_all_published THEN
      v_to := 'PUBLISHED';
    END IF;
  END IF;

  -- The write, with the flag on only for its duration.
  v_prev_flag := current_setting('tercero.deliverable_transition', true);
  PERFORM set_config('tercero.deliverable_transition', 'on', true);

  IF p_event = 'DELIVER' THEN
    v_note := nullif(btrim(p_details ->> 'note'), '');
    UPDATE post_versions
    SET status = v_to,
        admin_notes = coalesce(v_note, admin_notes)
    WHERE id = p_version_id;
  ELSIF p_event = 'SCHEDULE' THEN
    -- A per-platform Deliverable already carries its dates; target_date is
    -- the earliest of them and stays as it is.
    UPDATE post_versions
    SET status = v_to,
        target_date = CASE WHEN v_per_platform THEN target_date ELSE v_date END
    WHERE id = p_version_id;
  ELSIF p_event = 'PUBLISH' THEN
    -- A per-platform Deliverable published as a whole: every platform still
    -- open is published now too.
    UPDATE post_versions
    SET status = v_to,
        published_at = v_now,
        platform_schedules = CASE WHEN v_per_platform THEN (
          SELECT jsonb_object_agg(s.key,
                   CASE WHEN s.value ->> 'published_at' IS NULL
                        THEN s.value || jsonb_build_object('published_at', v_now)
                        ELSE s.value END)
          FROM jsonb_each(platform_schedules) s)
        ELSE platform_schedules END
    WHERE id = p_version_id;
  ELSIF p_event = 'PUBLISH_PLATFORM' THEN
    UPDATE post_versions
    SET platform_schedules = v_schedules,
        status = v_to,
        published_at = CASE WHEN v_all_published THEN v_now ELSE published_at END
    WHERE id = p_version_id;
  ELSE
    UPDATE post_versions SET status = v_to WHERE id = p_version_id;
  END IF;

  PERFORM set_config('tercero.deliverable_transition', coalesce(v_prev_flag, ''), true);

  -- Side effects.
  SELECT user_id INTO v_workspace_id FROM clients WHERE id = v_rec.client_id;

  -- The Client hears about every publish, a single platform included. The
  -- edge function skips the internal account and reports a failed send as an
  -- email_failed notification to the Owner/Admins.
  IF p_event IN ('PUBLISH', 'PUBLISH_PLATFORM') THEN
    PERFORM public.queue_edge_function('send-platform-published-email', jsonb_build_object(
      'post_version_id', p_version_id,
      'platform', v_platform,
      'all_published', p_event = 'PUBLISH' OR v_all_published));
  END IF;

  -- The creator hears when the status moves (emit_notifications drops the actor).
  IF v_to IS DISTINCT FROM v_rec.status THEN
    PERFORM public.emit_notifications(
      v_workspace_id, auth.uid(), ARRAY[v_rec.created_by],
      'post_status_changed', v_title, v_rec.title,
      'post', v_rec.post_id,
      '/clients/' || v_rec.client_id || '/deliverables/' || v_rec.post_id);
  END IF;
END;
$function$;

-- 4. The two actions. DEFINER because they call the internal helpers, which
--    users can't execute; the caller check runs first.
CREATE OR REPLACE FUNCTION public.mark_published(p_version_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  PERFORM public.assert_deliverable_admin(p_version_id, 'publish a deliverable', true);
  PERFORM public.deliverable_event(p_version_id, 'PUBLISH');
END;
$function$;

ALTER FUNCTION public.mark_published(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.mark_published(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_published(uuid) TO authenticated, service_role;

-- Returns true when this was the last platform, so the Deliverable is now PUBLISHED.
CREATE OR REPLACE FUNCTION public.mark_platform_published(p_version_id uuid, p_platform text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  PERFORM public.assert_deliverable_admin(p_version_id, 'publish a deliverable', true);
  PERFORM public.deliverable_event(p_version_id, 'PUBLISH_PLATFORM', jsonb_build_object('platform', p_platform));
  RETURN (SELECT status = 'PUBLISHED' FROM post_versions WHERE id = p_version_id);
END;
$function$;

ALTER FUNCTION public.mark_platform_published(uuid, text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.mark_platform_published(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_platform_published(uuid, text) TO authenticated, service_role;
