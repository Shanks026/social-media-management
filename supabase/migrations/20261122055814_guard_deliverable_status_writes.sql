-- #178 (ADR 0004), the contract step: the database refuses any Deliverable
-- status change that doesn't come from a transition function, whoever sends
-- it (browser, service role, cron, SQL editor). #173–#177 are deployed, so
-- no open browser still writes a status itself.
--
--   1. The internal-review functions (submit, approve, request changes) set
--      the transition flag around their write, like deliverable_event does.
--      approve_internally and request_internal_changes also gain the
--      workspace check they lacked (an Admin could act on another
--      workspace's Version by id), through assert_deliverable_admin.
--   2. enforce_post_status_transition refuses, unless the flag is on:
--        - on UPDATE, a change to status, published_at, or any platform's
--          published_at inside platform_schedules (dates and content stay
--          editable);
--        - on INSERT, a Version that doesn't start as an unpublished DRAFT.
--      It still checks the transition table. It now fires on INSERT too.
--   3. The review link's old p_status signature is dropped (#176 kept it for
--      pages opened before that deploy).

-- 1. Internal review.
CREATE OR REPLACE FUNCTION public.submit_for_internal_approval(p_post_version_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_post_id uuid; v_workspace_id uuid; v_created_by uuid; v_client_id uuid; v_title text;
  v_prev_flag text;
BEGIN
  SELECT post_id, created_by, client_id, title
    INTO v_post_id, v_created_by, v_client_id, v_title
  FROM post_versions WHERE id = p_post_version_id;

  IF v_created_by IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'You can only submit your own deliverables';
  END IF;

  v_workspace_id := public.get_my_agency_user_id();

  v_prev_flag := current_setting('tercero.deliverable_transition', true);
  PERFORM set_config('tercero.deliverable_transition', 'on', true);

  UPDATE post_versions SET status = 'SUBMITTED', submitted_by = auth.uid()
  WHERE id = p_post_version_id AND status IN ('DRAFT', 'CHANGES_REQUESTED');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Can only submit DRAFT or CHANGES_REQUESTED posts';
  END IF;

  PERFORM set_config('tercero.deliverable_transition', coalesce(v_prev_flag, ''), true);

  INSERT INTO approval_events (post_version_id, post_id, actor_id, workspace_user_id, action)
  VALUES (p_post_version_id, v_post_id, auth.uid(), v_workspace_id, 'submitted');

  PERFORM public.emit_notifications(
    v_workspace_id, auth.uid(), public.workspace_admin_uids(v_workspace_id),
    'post_status_changed', 'New deliverable submitted for review', v_title,
    'post', v_post_id, '/clients/' || v_client_id || '/deliverables/' || v_post_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.approve_internally(p_post_version_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_post_id uuid; v_workspace_id uuid; v_created_by uuid; v_client_id uuid; v_title text;
  v_prev_flag text;
BEGIN
  PERFORM public.assert_deliverable_admin(p_post_version_id, 'approve a deliverable internally');

  SELECT post_id, created_by, client_id, title
    INTO v_post_id, v_created_by, v_client_id, v_title
  FROM post_versions WHERE id = p_post_version_id;

  v_workspace_id := public.get_my_agency_user_id();

  v_prev_flag := current_setting('tercero.deliverable_transition', true);
  PERFORM set_config('tercero.deliverable_transition', 'on', true);

  UPDATE post_versions SET status = 'READY'
  WHERE id = p_post_version_id AND status = 'SUBMITTED';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Can only approve SUBMITTED posts';
  END IF;

  PERFORM set_config('tercero.deliverable_transition', coalesce(v_prev_flag, ''), true);

  INSERT INTO approval_events (post_version_id, post_id, actor_id, workspace_user_id, action)
  VALUES (p_post_version_id, v_post_id, auth.uid(), v_workspace_id, 'approved');

  PERFORM public.emit_notifications(
    v_workspace_id, auth.uid(), array[v_created_by],
    'post_status_changed', 'Your deliverable was approved', v_title,
    'post', v_post_id, '/clients/' || v_client_id || '/deliverables/' || v_post_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.request_internal_changes(p_post_version_id uuid, p_notes text DEFAULT NULL::text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_post_id uuid; v_workspace_id uuid; v_created_by uuid; v_client_id uuid; v_title text;
  v_prev_flag text;
BEGIN
  PERFORM public.assert_deliverable_admin(p_post_version_id, 'request changes on a deliverable');

  SELECT post_id, created_by, client_id, title
    INTO v_post_id, v_created_by, v_client_id, v_title
  FROM post_versions WHERE id = p_post_version_id;

  v_workspace_id := public.get_my_agency_user_id();

  v_prev_flag := current_setting('tercero.deliverable_transition', true);
  PERFORM set_config('tercero.deliverable_transition', 'on', true);

  UPDATE post_versions SET status = 'CHANGES_REQUESTED', admin_notes = p_notes
  WHERE id = p_post_version_id AND status = 'SUBMITTED';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Can only request changes on SUBMITTED posts';
  END IF;

  PERFORM set_config('tercero.deliverable_transition', coalesce(v_prev_flag, ''), true);

  INSERT INTO approval_events (post_version_id, post_id, actor_id, workspace_user_id, action, notes)
  VALUES (p_post_version_id, v_post_id, auth.uid(), v_workspace_id, 'changes_requested', p_notes);

  PERFORM public.emit_notifications(
    v_workspace_id, auth.uid(), array[v_created_by],
    'post_status_changed', 'Changes requested on your deliverable', coalesce(p_notes, v_title),
    'post', v_post_id, '/clients/' || v_client_id || '/deliverables/' || v_post_id);
END;
$function$;

-- 2. The guard.
--    Each platform's published_at, as {platform: published_at}, without the
--    unpublished ones, so editing a platform's date or adding an unpublished
--    platform isn't a publish.
CREATE OR REPLACE FUNCTION public.platform_published_at(p_schedules jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT coalesce(jsonb_strip_nulls(jsonb_object_agg(s.key, s.value -> 'published_at')), '{}'::jsonb)
  FROM jsonb_each(CASE WHEN jsonb_typeof(p_schedules) = 'object' THEN p_schedules ELSE '{}'::jsonb END) s
  WHERE jsonb_typeof(s.value) = 'object';
$function$;

CREATE OR REPLACE FUNCTION public.enforce_post_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_in_transition boolean := coalesce(current_setting('tercero.deliverable_transition', true), '') = 'on';
  allowed text[];
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT v_in_transition
       AND (NEW.status IS DISTINCT FROM 'DRAFT'
            OR NEW.published_at IS NOT NULL
            OR public.platform_published_at(NEW.platform_schedules) <> '{}'::jsonb) THEN
      RAISE EXCEPTION 'A new deliverable version starts as an unpublished DRAFT'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
    RETURN NEW;
  END IF;

  IF NOT v_in_transition
     AND (OLD.status IS DISTINCT FROM NEW.status
          OR OLD.published_at IS DISTINCT FROM NEW.published_at
          OR public.platform_published_at(OLD.platform_schedules)
             IS DISTINCT FROM public.platform_published_at(NEW.platform_schedules)) THEN
    RAISE EXCEPTION 'A deliverable''s status and publish dates change only through its actions (submit, approve, schedule, publish, …), not a direct update'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF OLD.status IS DISTINCT FROM NEW.status THEN
    allowed := CASE OLD.status::text
      WHEN 'DRAFT'             THEN ARRAY['SUBMITTED','PENDING_APPROVAL','SCHEDULED','APPROVED','ARCHIVED']
      WHEN 'SUBMITTED'         THEN ARRAY['READY','CHANGES_REQUESTED','ARCHIVED']
      WHEN 'CHANGES_REQUESTED' THEN ARRAY['SUBMITTED','ARCHIVED']
      WHEN 'READY'             THEN ARRAY['PENDING_APPROVAL','SCHEDULED','APPROVED','ARCHIVED']
      WHEN 'PENDING_APPROVAL'  THEN ARRAY['SCHEDULED','APPROVED','NEEDS_REVISION','ARCHIVED']
      WHEN 'NEEDS_REVISION'    THEN ARRAY['ARCHIVED']
      WHEN 'SCHEDULED'         THEN ARRAY['PUBLISHED','ARCHIVED']
      WHEN 'APPROVED'          THEN ARRAY['DELIVERED','ARCHIVED']
      ELSE                          ARRAY[]::text[]
    END;
    IF NOT (NEW.status::text = ANY (allowed)) THEN
      RAISE EXCEPTION 'Invalid post status transition: % → %', OLD.status, NEW.status;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- Was BEFORE UPDATE OF status; published_at and platform_schedules count
-- too, and so do new rows.
DROP TRIGGER trg_post_version_status_transition ON public.post_versions;
CREATE TRIGGER trg_post_version_status_transition
  BEFORE INSERT OR UPDATE ON public.post_versions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_post_status_transition();

-- 3. The old review-link signature.
DROP FUNCTION public.update_post_status_by_token(text, text, text);
