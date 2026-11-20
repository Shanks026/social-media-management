-- #173 (ADR 0004): an Owner or Admin schedules a Social deliverable, or
-- approves a non-social one, through a database function instead of a browser
-- UPDATE. Both reuse deliverable_event() from #172, which gains the SCHEDULE
-- and APPROVE events.

-- 1. The caller check every Owner/Admin transition function starts with
--    (ADR 0008): an Owner or Admin, acting on a Version in their own workspace.
CREATE OR REPLACE FUNCTION public.assert_deliverable_admin(p_version_id uuid, p_action text)
RETURNS void
LANGUAGE plpgsql
STABLE
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
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

ALTER FUNCTION public.assert_deliverable_admin(uuid, text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.assert_deliverable_admin(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assert_deliverable_admin(uuid, text) TO service_role;

-- 2. The shared helper learns SCHEDULE and APPROVE.
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
  v_social boolean;
  v_per_platform boolean;
  v_prev_flag text;
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
  ELSE
    UPDATE post_versions SET status = v_to WHERE id = p_version_id;
  END IF;

  PERFORM set_config('tercero.deliverable_transition', coalesce(v_prev_flag, ''), true);

  -- Side effects: tell the creator (emit_notifications drops the actor).
  SELECT user_id INTO v_workspace_id FROM clients WHERE id = v_rec.client_id;

  PERFORM public.emit_notifications(
    v_workspace_id, auth.uid(), ARRAY[v_rec.created_by],
    'post_status_changed', v_title, v_rec.title,
    'post', v_rec.post_id,
    '/clients/' || v_rec.client_id || '/deliverables/' || v_rec.post_id);
END;
$function$;

-- 3. mark_delivered uses the shared caller check.
CREATE OR REPLACE FUNCTION public.mark_delivered(
  p_version_id uuid,
  p_note text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  PERFORM public.assert_deliverable_admin(p_version_id, 'mark a deliverable delivered');
  PERFORM public.deliverable_event(p_version_id, 'DELIVER', jsonb_build_object('note', p_note));
END;
$function$;

-- 4. The two new actions. DEFINER because they call the internal helpers,
--    which users can't execute; the caller check runs first.
CREATE OR REPLACE FUNCTION public.schedule_deliverable(
  p_version_id uuid,
  p_target_date timestamptz DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  PERFORM public.assert_deliverable_admin(p_version_id, 'schedule a deliverable');
  PERFORM public.deliverable_event(p_version_id, 'SCHEDULE', jsonb_build_object('target_date', p_target_date));
END;
$function$;

ALTER FUNCTION public.schedule_deliverable(uuid, timestamptz) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.schedule_deliverable(uuid, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.schedule_deliverable(uuid, timestamptz) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.approve_deliverable(p_version_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  PERFORM public.assert_deliverable_admin(p_version_id, 'approve a deliverable');
  PERFORM public.deliverable_event(p_version_id, 'APPROVE');
END;
$function$;

ALTER FUNCTION public.approve_deliverable(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.approve_deliverable(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_deliverable(uuid) TO authenticated, service_role;
