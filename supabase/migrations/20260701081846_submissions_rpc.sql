
-- Returns all deliverables the current user submitted for internal approval,
-- with the latest decision event (approved / changes_requested) joined in.
CREATE OR REPLACE FUNCTION public.get_my_submissions(
  p_status    text    DEFAULT NULL,
  p_page      integer DEFAULT 0,
  p_page_size integer DEFAULT 25
)
RETURNS TABLE (
  submission_event_id uuid,
  submitted_at        timestamptz,
  post_version_id     uuid,
  post_id             uuid,
  post_title          text,
  post_content        text,
  post_media_urls     jsonb,
  post_platform       text[],
  current_status      text,
  client_id           uuid,
  client_name         text,
  client_logo_url     text,
  decision_action     text,
  decision_at         timestamptz,
  decision_notes      text,
  actor_name          text,
  actor_email         text,
  actor_avatar_url    text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ae.id                                                         AS submission_event_id,
    ae.created_at                                                 AS submitted_at,
    pv.id                                                         AS post_version_id,
    p.id                                                          AS post_id,
    pv.title                                                      AS post_title,
    pv.content                                                    AS post_content,
    pv.media_urls                                                 AS post_media_urls,
    pv.platform                                                   AS post_platform,
    pv.status                                                     AS current_status,
    c.id                                                          AS client_id,
    c.name                                                        AS client_name,
    c.logo_url                                                    AS client_logo_url,
    da.action                                                     AS decision_action,
    da.created_at                                                 AS decision_at,
    da.notes                                                      AS decision_notes,
    COALESCE(du.raw_user_meta_data->>'full_name', du.email)::text AS actor_name,
    du.email::text                                                AS actor_email,
    (du.raw_user_meta_data->>'avatar_url')::text                  AS actor_avatar_url
  FROM public.approval_events ae
  JOIN public.post_versions pv ON pv.id = ae.post_version_id
  JOIN public.posts p          ON p.id  = ae.post_id
  JOIN public.clients c        ON c.id  = p.client_id
  LEFT JOIN LATERAL (
    SELECT ae2.action, ae2.created_at, ae2.notes, ae2.actor_id
    FROM public.approval_events ae2
    WHERE ae2.post_version_id = ae.post_version_id
      AND ae2.action <> 'submitted'
    ORDER BY ae2.created_at DESC
    LIMIT 1
  ) da ON true
  LEFT JOIN auth.users du ON du.id = da.actor_id
  WHERE ae.action = 'submitted'
    AND ae.actor_id = auth.uid()
    AND ae.workspace_user_id = public.get_my_agency_user_id()
    AND (p_status IS NULL OR pv.status = p_status)
  ORDER BY ae.created_at DESC
  LIMIT  p_page_size
  OFFSET p_page * p_page_size;
END;
$$;

-- Count variant for tab badges and pagination
CREATE OR REPLACE FUNCTION public.get_my_submissions_count(
  p_status text DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count bigint;
BEGIN
  SELECT COUNT(*)
  INTO v_count
  FROM public.approval_events ae
  JOIN public.post_versions pv ON pv.id = ae.post_version_id
  WHERE ae.action = 'submitted'
    AND ae.actor_id = auth.uid()
    AND ae.workspace_user_id = public.get_my_agency_user_id()
    AND (p_status IS NULL OR pv.status = p_status);
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_submissions(text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_submissions_count(text) TO authenticated;
;
