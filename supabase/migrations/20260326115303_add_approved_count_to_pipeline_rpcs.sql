
-- Drop and recreate get_campaigns_with_post_summary with approved_count
DROP FUNCTION IF EXISTS get_campaigns_with_post_summary(UUID, UUID);

CREATE FUNCTION get_campaigns_with_post_summary(p_user_id UUID, p_client_id UUID DEFAULT NULL)
RETURNS TABLE (
  id UUID, client_id UUID, client_name TEXT, client_avatar TEXT,
  name TEXT, goal TEXT, description TEXT, status TEXT,
  start_date DATE, end_date DATE, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ,
  total_posts BIGINT,
  draft_count BIGINT, pending_count BIGINT, revision_count BIGINT,
  approved_count BIGINT, scheduled_count BIGINT,
  published_count BIGINT, archived_count BIGINT
) AS $$
  SELECT
    c.id, c.client_id,
    cl.name        AS client_name,
    cl.logo_url    AS client_avatar,
    c.name, c.goal, c.description, c.status,
    c.start_date, c.end_date, c.created_at, c.updated_at,
    COUNT(p.id)                                                                        AS total_posts,
    COUNT(p.id) FILTER (WHERE pv.status = 'DRAFT'::post_status)                       AS draft_count,
    COUNT(p.id) FILTER (WHERE pv.status = 'PENDING_APPROVAL'::post_status)             AS pending_count,
    COUNT(p.id) FILTER (WHERE pv.status = 'NEEDS_REVISION'::post_status)               AS revision_count,
    COUNT(p.id) FILTER (WHERE pv.status = 'APPROVED'::post_status)                     AS approved_count,
    COUNT(p.id) FILTER (WHERE pv.status = 'SCHEDULED'::post_status)                    AS scheduled_count,
    COUNT(p.id) FILTER (WHERE pv.status = 'PUBLISHED'::post_status)                    AS published_count,
    COUNT(p.id) FILTER (WHERE pv.status = 'ARCHIVED'::post_status)                     AS archived_count
  FROM campaigns c
  LEFT JOIN clients cl ON cl.id = c.client_id
  LEFT JOIN posts p ON p.campaign_id = c.id
  LEFT JOIN post_versions pv ON pv.id = p.current_version_id
  WHERE c.user_id = p_user_id
    AND (p_client_id IS NULL OR c.client_id = p_client_id)
  GROUP BY c.id, cl.name, cl.logo_url
  ORDER BY c.created_at DESC;
$$ LANGUAGE sql STABLE;


-- Update get_clients_with_pipeline to add approved count
CREATE OR REPLACE FUNCTION get_clients_with_pipeline(
  p_user_id UUID,
  p_search TEXT DEFAULT '',
  p_industry TEXT DEFAULT 'all',
  p_tier TEXT DEFAULT 'all',
  p_urgency TEXT DEFAULT 'all',
  p_status TEXT DEFAULT 'ACTIVE'
)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  WITH all_stats AS (
    SELECT
      c.id as client_id,
      c.is_internal,
      MIN(COALESCE(s.scheduled_for, pv.target_date))
        FILTER (WHERE pv.status IN ('DRAFT', 'PENDING_APPROVAL', 'NEEDS_REVISION', 'SCHEDULED', 'APPROVED')
                AND COALESCE(s.scheduled_for, pv.target_date) > (now() - interval '1 year')) as next_scheduled
    FROM clients c
    LEFT JOIN post_versions pv ON c.id = pv.client_id
    LEFT JOIN schedules s ON pv.id = s.post_version_id
    WHERE c.user_id = p_user_id
      AND (p_status = 'all' OR c.status = p_status)
    GROUP BY c.id, c.is_internal
  ),
  global_counts AS (
    SELECT
      jsonb_build_object(
        'all', COUNT(*) FILTER (WHERE is_internal = false),
        'urgent', COUNT(*) FILTER (WHERE is_internal = false AND next_scheduled < (now() + interval '24 hours')),
        'upcoming', COUNT(*) FILTER (WHERE is_internal = false AND next_scheduled >= (now() + interval '24 hours') AND next_scheduled < (now() + interval '48 hours')),
        'idle', COUNT(*) FILTER (WHERE is_internal = false AND next_scheduled IS NULL)
      ) as counts
    FROM all_stats
  ),
  filtered_list AS (
    SELECT
      c.id, c.name, c.status, c.client_type, c.logo_url, c.tier, c.industry,
      c.platforms, c.created_at, c.is_internal,
      COALESCE(COUNT(pv.id) FILTER (WHERE pv.status = 'DRAFT'), 0) as drafts,
      COALESCE(COUNT(pv.id) FILTER (WHERE pv.status = 'PENDING_APPROVAL'), 0) as pending,
      COALESCE(COUNT(pv.id) FILTER (WHERE pv.status = 'NEEDS_REVISION'), 0) as revisions,
      COALESCE(COUNT(pv.id) FILTER (WHERE pv.status = 'APPROVED'), 0) as approved,
      COALESCE(COUNT(pv.id) FILTER (WHERE pv.status = 'SCHEDULED'), 0) as scheduled,
      MIN(COALESCE(s.scheduled_for, pv.target_date)) FILTER (WHERE pv.status IN ('DRAFT', 'PENDING_APPROVAL', 'NEEDS_REVISION', 'SCHEDULED', 'APPROVED')) as next_scheduled,
      (SELECT COUNT(*) FROM campaigns WHERE client_id = c.id AND status = 'Active') as active_campaigns,
      ROUND(
        COALESCE(
          (SELECT SUM(t.amount) FROM transactions t
           WHERE t.client_id = c.id AND t.type = 'INCOME' AND t.status = 'PAID' AND t.category ILIKE '%retainer%'
          ) / NULLIF(GREATEST(EXTRACT(EPOCH FROM (NOW() - c.created_at)) / (30.44 * 86400), 1), 0),
          0
        )
      , 2) AS avg_monthly_retainer,
      ROUND(
        CASE
          WHEN COALESCE((SELECT SUM(t.amount) FROM transactions t WHERE t.client_id = c.id AND t.type = 'INCOME' AND t.status = 'PAID'), 0) > 0
          THEN (
            COALESCE((SELECT SUM(t.amount) FROM transactions t WHERE t.client_id = c.id AND t.type = 'INCOME' AND t.status = 'PAID'), 0)
            - COALESCE((SELECT SUM(t.amount) FROM transactions t WHERE t.client_id = c.id AND t.type = 'EXPENSE' AND t.status = 'PAID'), 0)
          ) / (SELECT SUM(t.amount) FROM transactions t WHERE t.client_id = c.id AND t.type = 'INCOME' AND t.status = 'PAID') * 100
          ELSE NULL
        END
      , 1) AS profit_margin
    FROM clients c
    LEFT JOIN post_versions pv ON c.id = pv.client_id
    LEFT JOIN schedules s ON pv.id = s.post_version_id
    WHERE c.user_id = p_user_id
      AND (p_status = 'all' OR c.status = p_status)
    GROUP BY c.id
    HAVING
      (p_search = '' OR c.name ILIKE '%' || p_search || '%')
      AND (p_industry = 'all' OR c.industry = p_industry)
      AND (p_tier = 'all' OR c.tier::text = p_tier)
      AND (
        p_urgency = 'all' OR
        (p_urgency = 'urgent' AND MIN(COALESCE(s.scheduled_for, pv.target_date)) FILTER (WHERE pv.status IN ('DRAFT', 'PENDING_APPROVAL', 'NEEDS_REVISION', 'SCHEDULED', 'APPROVED')) < (now() + interval '24 hours')) OR
        (p_urgency = 'upcoming' AND MIN(COALESCE(s.scheduled_for, pv.target_date)) FILTER (WHERE pv.status IN ('DRAFT', 'PENDING_APPROVAL', 'NEEDS_REVISION', 'SCHEDULED', 'APPROVED')) >= (now() + interval '24 hours') AND MIN(COALESCE(s.scheduled_for, pv.target_date)) FILTER (WHERE pv.status IN ('DRAFT', 'PENDING_APPROVAL', 'NEEDS_REVISION', 'SCHEDULED', 'APPROVED')) < (now() + interval '48 hours')) OR
        (p_urgency = 'idle' AND MIN(COALESCE(s.scheduled_for, pv.target_date)) FILTER (WHERE pv.status IN ('DRAFT', 'PENDING_APPROVAL', 'NEEDS_REVISION', 'SCHEDULED', 'APPROVED')) IS NULL)
      )
  )
  SELECT jsonb_build_object(
    'clients', COALESCE((SELECT jsonb_agg(filtered_list) FROM filtered_list), '[]'::jsonb),
    'counts', (SELECT counts FROM global_counts)
  ) INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql STABLE;
;
