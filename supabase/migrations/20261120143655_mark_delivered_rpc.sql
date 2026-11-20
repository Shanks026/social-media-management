-- #172 (ADR 0004 tracer): marking a Deliverable delivered goes through a
-- database function instead of a browser UPDATE.
--
-- deliverable_event() is the shared internal helper every transition function
-- will reuse: it checks the move, sets the transaction-local transition flag
-- around the write, and runs the side effects (in-app notifications). The
-- status trigger doesn't require the flag yet; that is the contract ticket
-- (#178), once every transition goes through a function.

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
  v_note text;
  v_prev_flag text;
BEGIN
  SELECT pv.id, pv.post_id, pv.client_id, pv.created_by, pv.title, pv.status::text AS status
    INTO v_rec
  FROM post_versions pv
  WHERE pv.id = p_version_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Deliverable version % not found', p_version_id USING ERRCODE = 'no_data_found';
  END IF;

  CASE p_event
    WHEN 'DELIVER' THEN
      v_from := ARRAY['APPROVED']; v_to := 'DELIVERED'; v_action := 'mark delivered';
    ELSE
      RAISE EXCEPTION 'Unknown deliverable event: %', p_event;
  END CASE;

  IF NOT (v_rec.status = ANY (v_from)) THEN
    RAISE EXCEPTION 'Cannot % a deliverable that is %', v_action, v_rec.status;
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
  END IF;

  PERFORM set_config('tercero.deliverable_transition', coalesce(v_prev_flag, ''), true);

  -- Side effects.
  SELECT user_id INTO v_workspace_id FROM clients WHERE id = v_rec.client_id;

  IF p_event = 'DELIVER' THEN
    PERFORM public.emit_notifications(
      v_workspace_id, auth.uid(), ARRAY[v_rec.created_by],
      'post_status_changed', 'Your deliverable was delivered', v_rec.title,
      'post', v_rec.post_id,
      '/clients/' || v_rec.client_id || '/deliverables/' || v_rec.post_id);
  END IF;
END;
$function$;

ALTER FUNCTION public.deliverable_event(uuid, text, jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.deliverable_event(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.deliverable_event(uuid, text, jsonb) TO service_role;

-- DEFINER because it calls the internal helper, which users can't execute.
-- It authorizes the caller first (ADR 0008): an Owner or Admin, acting on a
-- Deliverable in their own workspace.
CREATE OR REPLACE FUNCTION public.mark_delivered(
  p_version_id uuid,
  p_note text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_workspace_admin() THEN
    RAISE EXCEPTION 'Only an Owner or Admin can mark a deliverable delivered'
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

  PERFORM public.deliverable_event(p_version_id, 'DELIVER', jsonb_build_object('note', p_note));
END;
$function$;

ALTER FUNCTION public.mark_delivered(uuid, text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.mark_delivered(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_delivered(uuid, text) TO authenticated, service_role;
