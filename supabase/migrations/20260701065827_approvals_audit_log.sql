
-- ── 1. approval_events audit table ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.approval_events (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  post_version_id   uuid        NOT NULL REFERENCES public.post_versions(id) ON DELETE CASCADE,
  post_id           uuid        NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  actor_id          uuid        NOT NULL REFERENCES auth.users(id),
  workspace_user_id uuid        NOT NULL REFERENCES auth.users(id),
  action            text        NOT NULL CHECK (action IN ('submitted', 'approved', 'changes_requested')),
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_approval_events_workspace_created
  ON public.approval_events(workspace_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_approval_events_post_version
  ON public.approval_events(post_version_id);

ALTER TABLE public.approval_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "approval_events_select"
  ON public.approval_events FOR SELECT
  USING (workspace_user_id = public.get_my_agency_user_id());

CREATE POLICY "approval_events_delete"
  ON public.approval_events FOR DELETE
  USING (workspace_user_id = public.get_my_agency_user_id() AND public.is_workspace_admin());

-- ── 2. submit_for_internal_approval — now logs event ─────────────────────────
CREATE OR REPLACE FUNCTION public.submit_for_internal_approval(p_post_version_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_post_id         uuid;
  v_workspace_id    uuid;
BEGIN
  SELECT post_id INTO v_post_id
  FROM post_versions WHERE id = p_post_version_id;

  v_workspace_id := public.get_my_agency_user_id();

  UPDATE post_versions
  SET status = 'SUBMITTED', submitted_by = auth.uid()
  WHERE id = p_post_version_id AND status IN ('DRAFT', 'CHANGES_REQUESTED');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Can only submit DRAFT or CHANGES_REQUESTED posts';
  END IF;

  INSERT INTO approval_events (post_version_id, post_id, actor_id, workspace_user_id, action)
  VALUES (p_post_version_id, v_post_id, auth.uid(), v_workspace_id, 'submitted');
END;
$$;

-- ── 3. approve_internally — now logs event ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.approve_internally(p_post_version_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_post_id         uuid;
  v_workspace_id    uuid;
BEGIN
  IF NOT public.is_workspace_admin() THEN
    RAISE EXCEPTION 'Only owner or admin can approve posts internally';
  END IF;

  SELECT post_id INTO v_post_id
  FROM post_versions WHERE id = p_post_version_id;

  v_workspace_id := public.get_my_agency_user_id();

  UPDATE post_versions SET status = 'READY'
  WHERE id = p_post_version_id AND status = 'SUBMITTED';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Can only approve SUBMITTED posts';
  END IF;

  INSERT INTO approval_events (post_version_id, post_id, actor_id, workspace_user_id, action)
  VALUES (p_post_version_id, v_post_id, auth.uid(), v_workspace_id, 'approved');
END;
$$;

-- ── 4. request_internal_changes — now logs event ──────────────────────────────
CREATE OR REPLACE FUNCTION public.request_internal_changes(
  p_post_version_id uuid,
  p_notes           text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_post_id         uuid;
  v_workspace_id    uuid;
BEGIN
  IF NOT public.is_workspace_admin() THEN
    RAISE EXCEPTION 'Only owner or admin can request changes';
  END IF;

  SELECT post_id INTO v_post_id
  FROM post_versions WHERE id = p_post_version_id;

  v_workspace_id := public.get_my_agency_user_id();

  UPDATE post_versions
  SET status = 'CHANGES_REQUESTED', admin_notes = p_notes
  WHERE id = p_post_version_id AND status = 'SUBMITTED';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Can only request changes on SUBMITTED posts';
  END IF;

  INSERT INTO approval_events (post_version_id, post_id, actor_id, workspace_user_id, action, notes)
  VALUES (p_post_version_id, v_post_id, auth.uid(), v_workspace_id, 'changes_requested', p_notes);
END;
$$;

-- ── 5. get_approval_log — paginated history ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_approval_log(
  p_action  text DEFAULT NULL,
  p_limit   int  DEFAULT 25,
  p_offset  int  DEFAULT 0
)
RETURNS TABLE (
  id              uuid,
  post_version_id uuid,
  post_id         uuid,
  action          text,
  notes           text,
  created_at      timestamptz,
  post_title      text,
  client_id       uuid,
  client_name     text,
  client_logo_url text,
  actor_name      text,
  actor_email     text,
  actor_avatar_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    ae.id,
    ae.post_version_id,
    ae.post_id,
    ae.action,
    ae.notes,
    ae.created_at,
    pv.title                                                        AS post_title,
    c.id                                                            AS client_id,
    c.name                                                          AS client_name,
    c.logo_url                                                      AS client_logo_url,
    COALESCE(
      (au.raw_user_meta_data->>'full_name')::text,
      au.email::text
    )                                                               AS actor_name,
    au.email::text                                                  AS actor_email,
    (au.raw_user_meta_data->>'avatar_url')::text                    AS actor_avatar_url
  FROM   approval_events ae
  JOIN   post_versions pv ON pv.id = ae.post_version_id
  JOIN   posts         p  ON p.id  = ae.post_id
  JOIN   clients       c  ON c.id  = p.client_id
  JOIN   auth.users    au ON au.id = ae.actor_id
  WHERE  ae.workspace_user_id = public.get_my_agency_user_id()
    AND (p_action IS NULL OR ae.action = p_action)
  ORDER BY ae.created_at DESC
  LIMIT  p_limit
  OFFSET p_offset;
$$;

-- ── 6. get_approval_log_count — for pagination total ─────────────────────────
CREATE OR REPLACE FUNCTION public.get_approval_log_count(
  p_action text DEFAULT NULL
)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COUNT(*)
  FROM approval_events
  WHERE workspace_user_id = public.get_my_agency_user_id()
    AND (p_action IS NULL OR action = p_action);
$$;

-- ── 7. delete_approval_events — manual log cleanup ────────────────────────────
CREATE OR REPLACE FUNCTION public.delete_approval_events(
  p_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_workspace_admin() THEN
    RAISE EXCEPTION 'Only owner or admin can delete approval log entries';
  END IF;

  DELETE FROM approval_events
  WHERE id = ANY(p_ids)
    AND workspace_user_id = public.get_my_agency_user_id();
END;
$$;
;
