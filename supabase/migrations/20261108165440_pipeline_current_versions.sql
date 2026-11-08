-- #111: base each client's next scheduled date (and its status counts) on the
-- CURRENT version of each deliverable only.
--
-- get_clients_with_pipeline joined every post_versions row of a client. Live
-- write paths archive the version they supersede (create_revision_version), so
-- new data is unaffected, but the old create_new_version RPC (dropped in #101)
-- moved posts.current_version_id without archiving the APPROVED version it
-- replaced. Those superseded versions still count as open, so an old target
-- date could make a client look busier or more urgent than it is.
--
-- Change: both CTEs reach versions through posts.current_version_id
--   LEFT JOIN posts p          ON p.client_id = c.id
--   LEFT JOIN post_versions pv ON pv.id = p.current_version_id
-- instead of LEFT JOIN post_versions pv ON c.id = pv.client_id. The body is
-- otherwise identical to 20261108120200_drop_legacy_tables.sql. Signature,
-- owner and grants are unchanged (CREATE OR REPLACE keeps them).
CREATE OR REPLACE FUNCTION public.get_clients_with_pipeline(p_user_id uuid, p_search text DEFAULT ''::text, p_industry text DEFAULT 'all'::text, p_tier text DEFAULT 'all'::text, p_urgency text DEFAULT 'all'::text, p_status text DEFAULT 'ACTIVE'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
AS $function$
DECLARE
  v_result JSONB;
BEGIN
  WITH all_stats AS (
    SELECT
      c.id as client_id,
      c.is_internal,
      MIN(pv.target_date)
        FILTER (WHERE pv.status IN ('DRAFT', 'PENDING_APPROVAL', 'NEEDS_REVISION', 'SCHEDULED', 'APPROVED')
                AND pv.target_date > (now() - interval '1 year')) as next_scheduled
    FROM clients c
    LEFT JOIN posts p ON p.client_id = c.id
    LEFT JOIN post_versions pv ON pv.id = p.current_version_id
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
      MIN(pv.target_date) FILTER (WHERE pv.status IN ('DRAFT', 'PENDING_APPROVAL', 'NEEDS_REVISION', 'SCHEDULED', 'APPROVED')) as next_scheduled,
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
    LEFT JOIN posts p ON p.client_id = c.id
    LEFT JOIN post_versions pv ON pv.id = p.current_version_id
    WHERE c.user_id = p_user_id
      AND (p_status = 'all' OR c.status = p_status)
    GROUP BY c.id
    HAVING
      (p_search = '' OR c.name ILIKE '%' || p_search || '%')
      AND (p_industry = 'all' OR c.industry = p_industry)
      AND (p_tier = 'all' OR c.tier::text = p_tier)
      AND (
        p_urgency = 'all' OR
        (p_urgency = 'urgent' AND MIN(pv.target_date) FILTER (WHERE pv.status IN ('DRAFT', 'PENDING_APPROVAL', 'NEEDS_REVISION', 'SCHEDULED', 'APPROVED')) < (now() + interval '24 hours')) OR
        (p_urgency = 'upcoming' AND MIN(pv.target_date) FILTER (WHERE pv.status IN ('DRAFT', 'PENDING_APPROVAL', 'NEEDS_REVISION', 'SCHEDULED', 'APPROVED')) >= (now() + interval '24 hours') AND MIN(pv.target_date) FILTER (WHERE pv.status IN ('DRAFT', 'PENDING_APPROVAL', 'NEEDS_REVISION', 'SCHEDULED', 'APPROVED')) < (now() + interval '48 hours')) OR
        (p_urgency = 'idle' AND MIN(pv.target_date) FILTER (WHERE pv.status IN ('DRAFT', 'PENDING_APPROVAL', 'NEEDS_REVISION', 'SCHEDULED', 'APPROVED')) IS NULL)
      )
  )
  SELECT jsonb_build_object(
    'clients', COALESCE((SELECT jsonb_agg(filtered_list) FROM filtered_list), '[]'::jsonb),
    'counts', (SELECT counts FROM global_counts)
  ) INTO v_result;

  RETURN v_result;
END;
$function$;
