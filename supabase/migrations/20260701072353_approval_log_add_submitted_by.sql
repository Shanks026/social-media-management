
DROP FUNCTION IF EXISTS public.get_approval_log(text, int, int);

CREATE FUNCTION public.get_approval_log(
  p_action  text DEFAULT NULL,
  p_limit   int  DEFAULT 25,
  p_offset  int  DEFAULT 0
)
RETURNS TABLE (
  id                    uuid,
  post_version_id       uuid,
  post_id               uuid,
  action                text,
  notes                 text,
  created_at            timestamptz,
  post_title            text,
  post_content          text,
  post_media_urls       text[],
  client_id             uuid,
  client_name           text,
  client_logo_url       text,
  actor_name            text,
  actor_email           text,
  actor_avatar_url      text,
  submitter_name        text,
  submitter_email       text,
  submitter_avatar_url  text
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
    pv.content                                                      AS post_content,
    pv.media_urls                                                   AS post_media_urls,
    c.id                                                            AS client_id,
    c.name                                                          AS client_name,
    c.logo_url                                                      AS client_logo_url,
    COALESCE(
      (actor.raw_user_meta_data->>'full_name')::text,
      actor.email::text
    )                                                               AS actor_name,
    actor.email::text                                               AS actor_email,
    (actor.raw_user_meta_data->>'avatar_url')::text                 AS actor_avatar_url,
    COALESCE(
      (submitter.raw_user_meta_data->>'full_name')::text,
      submitter.email::text
    )                                                               AS submitter_name,
    submitter.email::text                                           AS submitter_email,
    (submitter.raw_user_meta_data->>'avatar_url')::text             AS submitter_avatar_url
  FROM   approval_events ae
  JOIN   post_versions pv   ON pv.id  = ae.post_version_id
  JOIN   posts         p    ON p.id   = ae.post_id
  JOIN   clients       c    ON c.id   = p.client_id
  JOIN   auth.users    actor      ON actor.id = ae.actor_id
  LEFT JOIN auth.users submitter  ON submitter.id = pv.submitted_by
  WHERE  ae.workspace_user_id = public.get_my_agency_user_id()
    AND (p_action IS NULL OR ae.action = p_action)
  ORDER BY ae.created_at DESC
  LIMIT  p_limit
  OFFSET p_offset;
$$;
;
