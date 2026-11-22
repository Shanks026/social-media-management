-- #179 (ADR 0008): the first review of every SECURITY DEFINER function users
-- can call (supabase/tests/definer_functions.test.sql keeps the allow-list).
-- What it turned up:
--
--   1. admin_get_clients() had no caller check: any signed-in user could list
--      every agency's name, emails and plan (it reads auth.users). It now
--      requires a superadmin, like the other admin_* functions.
--   1b. get_campaign_analytics(uuid) read any campaign by id: a signed-in
--      user of another workspace saw its post counts, and (being their own
--      workspace's Owner) its budget and invoice totals. It now returns no
--      row for a campaign outside the caller's workspace.
--   2. generate_version_token(uuid) had no caller check: any signed-in user
--      could mint a review link for another workspace's Version by id. Only
--      send-approval-email (service role) calls it, so users lose it.
--   3. cleanup_old_notifications() and notify_overdue_invoices() are pg_cron
--      jobs (run as postgres) that anon and authenticated could also run.
--   4. Functions that refuse an anonymous caller anyway, or only make sense
--      signed in, lose anon (Supabase's default privileges grant it to every
--      new function).
--   5. Two DEFINER trigger functions had no search_path.

-- 1. Superadmin only.
CREATE OR REPLACE FUNCTION public.admin_get_clients()
RETURNS TABLE(user_id uuid, agency_name text, email text, auth_email text, auth_full_name text,
              plan_name text, is_active boolean, trial_ends_at timestamp with time zone,
              subscription_ends_at timestamp with time zone, current_storage_used bigint,
              max_storage_bytes bigint, created_at timestamp with time zone, logo_url text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN QUERY
  SELECT
    s.user_id,
    s.agency_name,
    s.email,
    u.email::text                        AS auth_email,
    u.raw_user_meta_data->>'full_name'   AS auth_full_name,
    s.plan_name,
    s.is_active,
    s.trial_ends_at,
    s.subscription_ends_at,
    s.current_storage_used,
    s.max_storage_bytes,
    s.created_at,
    s.logo_url
  FROM agency_subscriptions s
  JOIN auth.users u ON u.id = s.user_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_get_clients() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_clients() TO authenticated, service_role;

-- 1b. Only the caller's workspace's campaigns. Unchanged otherwise.
CREATE OR REPLACE FUNCTION public.get_campaign_analytics(p_campaign_id uuid)
RETURNS TABLE(total_posts bigint, published_posts bigint, on_time_posts bigint, avg_approval_days numeric,
              platform_distribution jsonb, budget numeric, total_invoiced numeric, total_collected numeric)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_campaign campaigns%ROWTYPE;
  v_fin boolean := public.can_access_finance();
BEGIN
  SELECT * INTO v_campaign FROM campaigns WHERE id = p_campaign_id;
  IF NOT FOUND OR v_campaign.user_id IS DISTINCT FROM public.get_my_agency_user_id() THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    COUNT(p.id)::BIGINT,
    COUNT(p.id) FILTER (WHERE pv.status = 'PUBLISHED')::BIGINT,
    COUNT(p.id) FILTER (
      WHERE pv.status = 'PUBLISHED'
        AND pv.published_at IS NOT NULL
        AND pv.target_date  IS NOT NULL
        AND pv.published_at <= pv.target_date::TIMESTAMPTZ
    )::BIGINT,
    ROUND(
      AVG(
        EXTRACT(EPOCH FROM (pv.updated_at - pv.created_at)) / 86400.0
      ) FILTER (
        WHERE pv.status IN ('SCHEDULED', 'PUBLISHED')
          AND pv.updated_at > pv.created_at
      ),
      1
    ),
    COALESCE(
      (SELECT jsonb_object_agg(plat, cnt) FROM (
        SELECT unnest(pv2.platform) AS plat, COUNT(*) AS cnt
        FROM posts p2
        JOIN post_versions pv2 ON pv2.id = p2.current_version_id
        WHERE p2.campaign_id = p_campaign_id
        GROUP BY plat
      ) sub),
      '{}'::jsonb
    ),
    CASE WHEN v_fin THEN v_campaign.budget ELSE NULL END,
    CASE WHEN v_fin THEN COALESCE(SUM(i.total) FILTER (WHERE i.status IN ('SENT','OVERDUE','PAID')), 0) ELSE NULL END,
    CASE WHEN v_fin THEN COALESCE(SUM(i.total) FILTER (WHERE i.status = 'PAID'), 0) ELSE NULL END
  FROM campaigns c
  LEFT JOIN posts p ON p.campaign_id = c.id
  LEFT JOIN post_versions pv ON pv.id = p.current_version_id
  LEFT JOIN invoices i ON i.campaign_id = p_campaign_id
  WHERE c.id = p_campaign_id
  GROUP BY v_campaign.budget;
END;
$function$;

-- 2. and 3. System-only.
REVOKE ALL ON FUNCTION public.generate_version_token(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_version_token(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.cleanup_old_notifications() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_old_notifications() TO service_role;

REVOKE ALL ON FUNCTION public.notify_overdue_invoices() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_overdue_invoices() TO service_role;

-- 4. Signed-in only.
DO $$
DECLARE
  f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.admin_get_client_detail(uuid)',
    'public.approve_internally(uuid)',
    'public.request_internal_changes(uuid, text)',
    'public.submit_for_internal_approval(uuid)',
    'public.delete_approval_events(uuid[])',
    'public.get_approval_log(text, integer, integer)',
    'public.get_approval_log_count(text)',
    'public.get_my_submissions(text, integer, integer)',
    'public.get_my_submissions_count(text)',
    'public.get_removed_members(uuid)',
    'public.get_team_members(uuid)',
    'public.update_member_access(uuid, text, jsonb, text)',
    'public.update_task_status(uuid, text)',
    'public.task_reference_exists(uuid)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', f);
  END LOOP;
END $$;

-- 5. search_path.
ALTER FUNCTION public.set_meeting_creator_id() SET search_path TO 'public', 'pg_temp';
ALTER FUNCTION public.set_post_version_updated_by() SET search_path TO 'public', 'pg_temp';
