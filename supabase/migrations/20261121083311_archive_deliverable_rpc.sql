-- #177 (ADR 0004): archiving a Deliverable goes through a database function.
--
--   1. deliverable_event learns ARCHIVE (from any status except DELIVERED,
--      PUBLISHED and ARCHIVED; the creator is told) and SUPERSEDE (the
--      NEEDS_REVISION Version a new Version replaces; nobody is told). Both
--      deactivate the Version's review links.
--   2. archive_deliverable(version): Owner/Admin may archive any open
--      Deliverable; a Member only one they created (posts.created_by), while
--      it is DRAFT or SUBMITTED, the same rule as deletion.
--   3. create_revision_version archived the old Version with a raw UPDATE.
--      It now archives through SUPERSEDE, so #178's guard won't refuse it.
--      That makes it SECURITY DEFINER (deliverable_event is revoked from
--      users), so it checks the caller's workspace itself, revises only the
--      current Version, and stamps created_by with the real caller (ADR 0008);
--      p_user_id stays in the signature, unused, until #181/#182.

-- 1. The shared helper learns ARCHIVE and SUPERSEDE.
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
  v_client_decision boolean := p_event IN ('CLIENT_APPROVE', 'CLIENT_REQUEST_REVISIONS');
  v_prev_flag text;
  v_now timestamptz := now();
BEGIN
  SELECT pv.id, pv.post_id, pv.client_id, pv.created_by, pv.title, pv.status::text AS status,
         pv.platform, pv.platform_schedules, pv.content
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
    WHEN 'SEND_FOR_APPROVAL' THEN
      -- DRAFT: an Owner/Admin's own work; READY: a Member's, after internal review.
      v_from := ARRAY['DRAFT', 'READY']; v_to := 'PENDING_APPROVAL'; v_action := 'send for client approval';
      v_title := 'Your deliverable was sent for client approval';
    WHEN 'CLIENT_APPROVE' THEN
      -- The Client's approval: a Social deliverable is then scheduled, a
      -- non-social one is approved and waits to be delivered.
      v_from := ARRAY['PENDING_APPROVAL'];
      v_to := CASE WHEN v_social THEN 'SCHEDULED' ELSE 'APPROVED' END;
      v_action := 'approve';
      v_title := 'Client approved a deliverable';
    WHEN 'CLIENT_REQUEST_REVISIONS' THEN
      v_from := ARRAY['PENDING_APPROVAL']; v_to := 'NEEDS_REVISION'; v_action := 'request revisions on';
      v_title := 'Client requested revisions';
    WHEN 'ARCHIVE' THEN
      -- Who may archive what is archive_deliverable's check; this is the move.
      v_from := ARRAY['DRAFT', 'SUBMITTED', 'CHANGES_REQUESTED', 'READY', 'PENDING_APPROVAL',
                      'NEEDS_REVISION', 'SCHEDULED', 'APPROVED'];
      v_to := 'ARCHIVED'; v_action := 'archive';
      v_title := 'Your deliverable was archived';
    WHEN 'SUPERSEDE' THEN
      -- A new Version replaces this one after the Client asked for revisions
      -- (create_revision_version). A versioning step: nobody is notified.
      v_from := ARRAY['NEEDS_REVISION']; v_to := 'ARCHIVED'; v_action := 'create a new version of';
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
  ELSIF p_event = 'SEND_FOR_APPROVAL' THEN
    IF nullif(btrim(v_rec.content), '') IS NULL THEN
      RAISE EXCEPTION 'Add content to this deliverable before sending it for approval';
    END IF;
    IF EXISTS (
      SELECT 1 FROM post_versions
      WHERE post_id = v_rec.post_id AND id <> p_version_id
        AND status IN ('PENDING_APPROVAL', 'APPROVED', 'SCHEDULED')
    ) THEN
      RAISE EXCEPTION 'This deliverable already has an active approval lifecycle';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM clients WHERE id = v_rec.client_id AND nullif(btrim(email), '') IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'This client has no email address, so there is nobody to send the approval link to';
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
  ELSIF v_client_decision THEN
    -- The Client's feedback, if any (the approval sends none from the
    -- Campaign review page, and may send some from the single review page).
    UPDATE post_versions
    SET status = v_to,
        client_notes = nullif(btrim(p_details ->> 'feedback'), '')
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

  -- SEND_FOR_APPROVAL: the Client gets the review link (the edge function
  -- mints it). A Client decision: the creator gets the agency's email. Either
  -- way the edge function reads the Version from the database.
  IF p_event = 'SEND_FOR_APPROVAL' OR v_client_decision THEN
    PERFORM public.queue_edge_function('send-approval-email', jsonb_build_object(
      'record', jsonb_build_object('id', p_version_id, 'status', v_to)));
  END IF;

  IF v_to = 'ARCHIVED' THEN
    UPDATE share_tokens SET is_active = false
    WHERE post_version_id = p_version_id AND is_active;
  END IF;

  IF p_event = 'SUPERSEDE' THEN
    NULL;
  ELSIF v_client_decision THEN
    -- The Client has no account: no actor. The creator and the Owner hear.
    PERFORM public.emit_notifications(
      v_workspace_id, NULL, ARRAY[v_rec.created_by, v_workspace_id],
      'campaign_reviewed', v_title, v_rec.title,
      'post', v_rec.post_id,
      '/clients/' || v_rec.client_id || '/deliverables/' || v_rec.post_id);
  ELSIF v_to IS DISTINCT FROM v_rec.status THEN
    -- The creator hears when the status moves (emit_notifications drops the actor).
    PERFORM public.emit_notifications(
      v_workspace_id, auth.uid(), ARRAY[v_rec.created_by],
      'post_status_changed', v_title, v_rec.title,
      'post', v_rec.post_id,
      '/clients/' || v_rec.client_id || '/deliverables/' || v_rec.post_id);
  END IF;
END;
$function$;

-- 2. Archive, with the ADR 0004 actor rule.
CREATE OR REPLACE FUNCTION public.archive_deliverable(p_version_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_rec record;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to archive a deliverable' USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Locked, so the status checked below is the one archived.
  SELECT pv.status::text AS status, p.created_by AS creator, c.user_id AS workspace_id
    INTO v_rec
  FROM post_versions pv
  JOIN posts p ON p.id = pv.post_id
  JOIN clients c ON c.id = pv.client_id
  WHERE pv.id = p_version_id
  FOR UPDATE OF pv;

  IF NOT FOUND OR v_rec.workspace_id IS DISTINCT FROM public.get_my_agency_user_id() THEN
    RAISE EXCEPTION 'Deliverable version % not found', p_version_id USING ERRCODE = 'no_data_found';
  END IF;

  IF NOT public.is_workspace_admin() THEN
    IF v_rec.creator IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'A Member can archive only a deliverable they created'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
    IF v_rec.status NOT IN ('DRAFT', 'SUBMITTED') THEN
      RAISE EXCEPTION 'A Member can archive a deliverable only while it is a draft or submitted, not %', v_rec.status
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;

  PERFORM public.deliverable_event(p_version_id, 'ARCHIVE');
END;
$function$;

ALTER FUNCTION public.archive_deliverable(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.archive_deliverable(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.archive_deliverable(uuid) TO authenticated, service_role;

-- 3. A new Version after the Client asked for revisions.
CREATE OR REPLACE FUNCTION public.create_revision_version(
  p_parent_version_id uuid,
  p_user_id uuid,
  p_admin_notes text DEFAULT NULL::text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_old record;
  v_new_version_id uuid;
BEGIN
  -- p_user_id is ignored: created_by is the real caller (ADR 0008).
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in to create a new version' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT pv.*, c.user_id AS workspace_id, p.current_version_id
    INTO v_old
  FROM post_versions pv
  JOIN clients c ON c.id = pv.client_id
  JOIN posts p ON p.id = pv.post_id
  WHERE pv.id = p_parent_version_id;

  IF NOT FOUND OR v_old.workspace_id IS DISTINCT FROM public.get_my_agency_user_id() THEN
    RAISE EXCEPTION 'Parent version not found' USING ERRCODE = 'no_data_found';
  END IF;

  IF v_old.current_version_id IS DISTINCT FROM p_parent_version_id THEN
    RAISE EXCEPTION 'Only the current version of a deliverable can be revised';
  END IF;

  -- Locks the old Version, checks it is NEEDS_REVISION, archives it.
  PERFORM public.deliverable_event(p_parent_version_id, 'SUPERSEDE');

  INSERT INTO post_versions (
    post_id, client_id, title, content, media_urls,
    platform, status, version_number, created_by,
    target_date, admin_notes, platform_schedules, deliverable_type
  )
  VALUES (
    v_old.post_id, v_old.client_id, v_old.title, v_old.content, v_old.media_urls,
    v_old.platform, 'DRAFT', v_old.version_number + 1, v_uid,
    v_old.target_date, p_admin_notes, v_old.platform_schedules, v_old.deliverable_type
  )
  RETURNING id INTO v_new_version_id;

  UPDATE posts SET current_version_id = v_new_version_id WHERE id = v_old.post_id;

  RETURN v_new_version_id;
END;
$function$;

ALTER FUNCTION public.create_revision_version(uuid, uuid, text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.create_revision_version(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_revision_version(uuid, uuid, text) TO authenticated, service_role;
