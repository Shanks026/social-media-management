
DROP FUNCTION IF EXISTS public.get_campaigns_with_post_summary(uuid, uuid);

CREATE OR REPLACE FUNCTION public.get_campaigns_with_post_summary(
  p_user_id   UUID,
  p_client_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id               UUID,
  client_id        UUID,
  client_name      TEXT,
  name             TEXT,
  goal             TEXT,
  description      TEXT,
  status           TEXT,
  start_date       DATE,
  end_date         DATE,
  created_at       TIMESTAMPTZ,
  updated_at       TIMESTAMPTZ,
  total_posts      BIGINT,
  draft_count      BIGINT,
  pending_count    BIGINT,
  revision_count   BIGINT,
  scheduled_count  BIGINT,
  published_count  BIGINT,
  archived_count   BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    c.id,
    c.client_id,
    cl.name        AS client_name,
    c.name,
    c.goal,
    c.description,
    c.status,
    c.start_date,
    c.end_date,
    c.created_at,
    c.updated_at,
    COUNT(p.id)                                                                       AS total_posts,
    COUNT(p.id) FILTER (WHERE pv.status = 'DRAFT'::post_status)                      AS draft_count,
    COUNT(p.id) FILTER (WHERE pv.status = 'PENDING_APPROVAL'::post_status)            AS pending_count,
    COUNT(p.id) FILTER (WHERE pv.status = 'NEEDS_REVISION'::post_status)              AS revision_count,
    COUNT(p.id) FILTER (WHERE pv.status = 'SCHEDULED'::post_status)                   AS scheduled_count,
    COUNT(p.id) FILTER (WHERE pv.status = 'PUBLISHED'::post_status)                   AS published_count,
    COUNT(p.id) FILTER (WHERE pv.status = 'ARCHIVED'::post_status)                    AS archived_count
  FROM campaigns c
  LEFT JOIN clients cl ON cl.id = c.client_id
  LEFT JOIN posts p ON p.campaign_id = c.id
  LEFT JOIN post_versions pv ON pv.id = p.current_version_id
  WHERE c.user_id = p_user_id
    AND (p_client_id IS NULL OR c.client_id = p_client_id)
  GROUP BY c.id, cl.name
  ORDER BY c.created_at DESC;
$$;
;
