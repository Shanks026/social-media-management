-- #102: drop the legacy v1 tables schedules, approvals and client_users
-- (decided in #73). All three hold 0 rows, so nothing is archived.
--
-- Order matters: everything that references the tables goes first, so the
-- DROP TABLEs need no CASCADE (a CASCADE could silently take more with it).

-- 1. get_clients_with_pipeline stops joining schedules -----------------------
-- The LEFT JOIN only ever added NULLs (schedules is empty), so
-- COALESCE(s.scheduled_for, pv.target_date) is always pv.target_date and the
-- output is unchanged. Body is otherwise identical to the baseline.
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
    LEFT JOIN post_versions pv ON c.id = pv.client_id
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
    LEFT JOIN post_versions pv ON c.id = pv.client_id
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

-- 2. The only writers of the legacy tables ------------------------------------
drop function public.schedule_post(uuid, uuid, timestamp with time zone);
drop function public.submit_approval(uuid, uuid, boolean, text);

-- 3. The posts policy that reads client_users ---------------------------------
-- A permissive FOR ALL policy granting post access to rows in client_users
-- (the never-built client portal). The table is empty, so it grants nothing
-- today; the workspace-scoped posts_* policies cover every real access path.
drop policy internal_client_access on public.posts;

-- 4. The tables (their own policies and FKs go with them) ---------------------
drop table public.schedules;
drop table public.approvals;
drop table public.client_users;
