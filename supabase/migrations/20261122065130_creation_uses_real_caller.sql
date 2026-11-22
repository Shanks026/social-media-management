-- #181 (ADR 0008): creating a Deliverable and creating a revision record the
-- real caller (auth.uid()) as created_by, instead of a p_user_id the browser
-- sends. created_by decides whether a Member may delete their own
-- Deliverable, so it must not be the caller's to choose. Generating an
-- invoice from a recurring template resolves the workspace itself.
--
-- New signatures without the parameter; src/api switches to them. The old
-- signatures stay until #182 for browsers on the previous bundle, but they
-- delegate to the new ones and ignore p_user_id, so the spoof closes now.

-- 1. Create a Deliverable (INVOKER: RLS decides which clients the caller may use).
CREATE OR REPLACE FUNCTION public.create_post_draft_v3(
  p_client_id uuid,
  p_title text,
  p_content text,
  p_media_urls text[],
  p_platform text[],
  p_target_date timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_admin_notes text DEFAULT NULL::text,
  p_platform_schedules jsonb DEFAULT NULL::jsonb,
  p_campaign_id uuid DEFAULT NULL::uuid,
  p_deliverable_type text DEFAULT NULL::text
) RETURNS uuid
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_post_id uuid;
  v_version_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in to create a deliverable' USING ERRCODE = 'insufficient_privilege';
  END IF;

  INSERT INTO public.posts (client_id, campaign_id)
  VALUES (p_client_id, p_campaign_id)
  RETURNING id INTO v_post_id;

  INSERT INTO public.post_versions (
    post_id, client_id, version_number, status, content, media_urls, platform,
    created_by, title, target_date, admin_notes, platform_schedules, deliverable_type
  )
  VALUES (
    v_post_id, p_client_id, 1, 'DRAFT', p_content, p_media_urls, p_platform,
    v_uid, p_title, p_target_date, p_admin_notes, p_platform_schedules, p_deliverable_type
  )
  RETURNING id INTO v_version_id;

  UPDATE public.posts SET current_version_id = v_version_id WHERE id = v_post_id;

  RETURN v_version_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_post_draft_v3(uuid, text, text, text[], text[], timestamp with time zone, text, jsonb, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_post_draft_v3(uuid, text, text, text[], text[], timestamp with time zone, text, jsonb, uuid, text) TO authenticated, service_role;

-- The old signature ignores p_user_id from now on.
CREATE OR REPLACE FUNCTION public.create_post_draft_v3(
  p_client_id uuid, p_title text, p_content text, p_media_urls text[], p_platform text[], p_user_id uuid,
  p_target_date timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_admin_notes text DEFAULT NULL::text, p_platform_schedules jsonb DEFAULT NULL::jsonb,
  p_campaign_id uuid DEFAULT NULL::uuid, p_deliverable_type text DEFAULT NULL::text
) RETURNS uuid
LANGUAGE sql
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT public.create_post_draft_v3(
    p_client_id => p_client_id, p_title => p_title, p_content => p_content,
    p_media_urls => p_media_urls, p_platform => p_platform, p_target_date => p_target_date,
    p_admin_notes => p_admin_notes, p_platform_schedules => p_platform_schedules,
    p_campaign_id => p_campaign_id, p_deliverable_type => p_deliverable_type);
$function$;

REVOKE ALL ON FUNCTION public.create_post_draft_v3(uuid, text, text, text[], text[], uuid, timestamp with time zone, text, jsonb, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_post_draft_v3(uuid, text, text, text[], text[], uuid, timestamp with time zone, text, jsonb, uuid, text) TO authenticated, service_role;

-- 2. Create a revision: the body from #177, without p_user_id.
CREATE OR REPLACE FUNCTION public.create_revision_version(
  p_parent_version_id uuid,
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

ALTER FUNCTION public.create_revision_version(uuid, text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.create_revision_version(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_revision_version(uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.create_revision_version(
  p_parent_version_id uuid, p_user_id uuid, p_admin_notes text DEFAULT NULL::text
) RETURNS uuid
LANGUAGE sql
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT public.create_revision_version(p_parent_version_id => p_parent_version_id, p_admin_notes => p_admin_notes);
$function$;
-- Now INVOKER: it only delegates, so it needs no rights of its own.
ALTER FUNCTION public.create_revision_version(uuid, uuid, text) SECURITY INVOKER;

-- 3. Generate an invoice from a recurring template, in the caller's workspace.
--    (The pg_cron job drafts through draft_invoice_from_template directly.)
CREATE OR REPLACE FUNCTION public.generate_invoice_from_template(p_template_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to generate an invoice' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NOT public.can_access_finance() THEN
    RAISE EXCEPTION 'Insufficient permissions: finance access required' USING ERRCODE = 'insufficient_privilege';
  END IF;

  PERFORM 1
  FROM recurring_invoices
  WHERE id = p_template_id AND user_id = public.get_my_agency_user_id()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Template not found or access denied' USING ERRCODE = 'no_data_found';
  END IF;

  RETURN public.draft_invoice_from_template(p_template_id, CURRENT_DATE);
END;
$function$;

ALTER FUNCTION public.generate_invoice_from_template(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.generate_invoice_from_template(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_invoice_from_template(uuid) TO authenticated, service_role;
