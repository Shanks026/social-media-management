-- #180 (ADR 0008): the read functions that took a workspace id get new
-- signatures without it and resolve the workspace with
-- get_my_agency_user_id(): the calendar, the client pipeline, the campaign
-- summary, the Proposals totals (Owner/Admin only, as RLS) and the two
-- team-member lists. The bodies are otherwise unchanged.
--
-- Expand → contract: the old signatures stay as they are (with their #169
-- checks) for browsers still running the previous bundle, and #182 drops
-- them. PostgREST picks the overload by argument names, so both work.
-- None of the new ones is callable by anon.

CREATE OR REPLACE FUNCTION public.get_global_calendar(p_start_date timestamp with time zone, p_end_date timestamp with time zone)
 RETURNS TABLE(post_id uuid, version_id uuid, version_number integer, title text, content text, status text, platforms text[], media_urls text[], target_date timestamp with time zone, client_id uuid, client_name text, client_logo text, created_by uuid)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
    RETURN QUERY
    SELECT
        p.id AS post_id,
        pv.id AS version_id,
        pv.version_number,
        pv.title,
        pv.content,
        pv.status,
        pv.platform AS platforms,
        pv.media_urls,
        pv.target_date,
        p.client_id,
        c.name AS client_name,
        c.logo_url AS client_logo,
        p.created_by
    FROM public.posts p
    JOIN public.post_versions pv ON p.id = pv.post_id
    JOIN public.clients c ON p.client_id = c.id
    WHERE c.user_id = public.get_my_agency_user_id()
      AND pv.target_date >= p_start_date
      AND pv.target_date <= p_end_date
      AND pv.id = p.current_version_id;
END;
$function$;
REVOKE ALL ON FUNCTION public.get_global_calendar(timestamp with time zone, timestamp with time zone) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_global_calendar(timestamp with time zone, timestamp with time zone) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_clients_with_pipeline(p_search text DEFAULT ''::text, p_industry text DEFAULT 'all'::text, p_tier text DEFAULT 'all'::text, p_urgency text DEFAULT 'all'::text, p_status text DEFAULT 'ACTIVE'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_result JSONB;
  v_ws uuid := public.get_my_agency_user_id();
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
    WHERE c.user_id = v_ws
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
      (SELECT COUNT(*) FROM campaigns WHERE client_id = c.id AND status = 'ACTIVE') as active_campaigns,
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
    WHERE c.user_id = v_ws
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
REVOKE ALL ON FUNCTION public.get_clients_with_pipeline(text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_clients_with_pipeline(text, text, text, text, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_campaigns_with_post_summary(p_client_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, client_id uuid, client_name text, client_avatar text, name text, goal text, description text, status text, start_date date, end_date date, created_at timestamp with time zone, updated_at timestamp with time zone, total_posts bigint, draft_count bigint, pending_count bigint, revision_count bigint, approved_count bigint, scheduled_count bigint, published_count bigint, archived_count bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT
    c.id, c.client_id,
    cl.name        AS client_name,
    cl.logo_url    AS client_avatar,
    c.name, c.goal, c.description, c.status,
    c.start_date, c.end_date, c.created_at, c.updated_at,
    COUNT(p.id)                                                     AS total_posts,
    COUNT(p.id) FILTER (WHERE pv.status = 'DRAFT')                  AS draft_count,
    COUNT(p.id) FILTER (WHERE pv.status = 'PENDING_APPROVAL')       AS pending_count,
    COUNT(p.id) FILTER (WHERE pv.status = 'NEEDS_REVISION')         AS revision_count,
    COUNT(p.id) FILTER (WHERE pv.status = 'APPROVED')               AS approved_count,
    COUNT(p.id) FILTER (WHERE pv.status = 'SCHEDULED')              AS scheduled_count,
    COUNT(p.id) FILTER (WHERE pv.status = 'PUBLISHED')              AS published_count,
    COUNT(p.id) FILTER (WHERE pv.status = 'ARCHIVED')               AS archived_count
  FROM campaigns c
  LEFT JOIN clients cl ON cl.id = c.client_id
  LEFT JOIN posts p ON p.campaign_id = c.id
  LEFT JOIN post_versions pv ON pv.id = p.current_version_id
  WHERE c.user_id = public.get_my_agency_user_id()
    AND (p_client_id IS NULL OR c.client_id = p_client_id)
  GROUP BY c.id, cl.name, cl.logo_url
  ORDER BY c.created_at DESC;
$function$;
REVOKE ALL ON FUNCTION public.get_campaigns_with_post_summary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_campaigns_with_post_summary(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_proposals_with_totals(p_client_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, agency_user_id uuid, client_id uuid, prospect_id uuid, prospect_name text, prospect_email text, title text, status text, introduction text, scope_notes text, payment_terms text, contract_duration text, valid_until date, share_token text, first_viewed_at timestamp with time zone, sent_at timestamp with time zone, accepted_at timestamp with time zone, declined_at timestamp with time zone, decline_reason text, created_at timestamp with time zone, updated_at timestamp with time zone, total_value numeric, client_name text, client_logo_url text, proposal_type text, file_url text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT
    p.id,
    p.agency_user_id,
    p.client_id,
    p.prospect_id,
    p.prospect_name,
    p.prospect_email,
    p.title,
    CASE
      WHEN p.status NOT IN ('DRAFT', 'ACCEPTED', 'DECLINED', 'ARCHIVED')
        AND p.valid_until IS NOT NULL
        AND p.valid_until < CURRENT_DATE
      THEN 'EXPIRED'
      ELSE p.status
    END AS status,
    p.introduction,
    p.scope_notes,
    p.payment_terms,
    p.contract_duration,
    p.valid_until,
    p.share_token,
    p.first_viewed_at,
    p.sent_at,
    p.accepted_at,
    p.declined_at,
    p.decline_reason,
    p.created_at,
    p.updated_at,
    COALESCE(
      p.total_value,
      (SELECT SUM(li.amount) FROM proposal_line_items li WHERE li.proposal_id = p.id),
      0
    ) AS total_value,
    c.name       AS client_name,
    c.logo_url   AS client_logo_url,
    p.proposal_type,
    p.file_url
  FROM proposals p
  LEFT JOIN clients c ON c.id = p.client_id
  WHERE p.agency_user_id = public.get_my_agency_user_id()
    AND public.is_workspace_admin()
    AND (p_client_id IS NULL OR p.client_id = p_client_id)
  ORDER BY p.created_at DESC;
$function$;
REVOKE ALL ON FUNCTION public.get_proposals_with_totals(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_proposals_with_totals(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_team_members()
 RETURNS TABLE(id uuid, member_user_id uuid, system_role text, permissions jsonb, joined_at timestamp with time zone, email text, first_name text, last_name text, full_name text, avatar_url text, roles_and_responsibilities text, mobile_number text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select
    am.id, am.member_user_id, am.system_role,
    am.permissions, am.joined_at,
    au.email::text,
    (au.raw_user_meta_data->>'first_name')::text,
    (au.raw_user_meta_data->>'last_name')::text,
    coalesce((au.raw_user_meta_data->>'full_name')::text, au.email::text),
    (au.raw_user_meta_data->>'avatar_url')::text,
    am.roles_and_responsibilities,
    case
      when public.is_workspace_admin() or am.member_user_id = auth.uid()
        then (au.raw_user_meta_data->>'mobile_number')::text
      else null
    end
  from agency_members am
  join auth.users au on au.id = am.member_user_id
  where am.agency_user_id = public.get_my_agency_user_id()
    and am.is_active = true
  order by am.joined_at asc;
$function$;
REVOKE ALL ON FUNCTION public.get_team_members() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_team_members() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_removed_members()
 RETURNS TABLE(id uuid, member_user_id uuid, system_role text, permissions jsonb, joined_at timestamp with time zone, email text, first_name text, last_name text, full_name text, avatar_url text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select
    am.id, am.member_user_id, am.system_role,
    am.permissions, am.joined_at,
    au.email::text,
    (au.raw_user_meta_data->>'first_name')::text,
    (au.raw_user_meta_data->>'last_name')::text,
    coalesce((au.raw_user_meta_data->>'full_name')::text, au.email::text),
    (au.raw_user_meta_data->>'avatar_url')::text
  from agency_members am
  join auth.users au on au.id = am.member_user_id
  where am.agency_user_id = public.get_my_agency_user_id()
    and am.is_active = false
  order by am.joined_at asc;
$function$;
REVOKE ALL ON FUNCTION public.get_removed_members() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_removed_members() TO authenticated, service_role;
