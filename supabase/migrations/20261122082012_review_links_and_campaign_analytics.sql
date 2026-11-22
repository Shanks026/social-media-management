-- Follow-ups from #179's review.
--
-- 1. Review links (share_tokens). Holding an active token lets anyone decide
--    as the Client (submit_review_decision). The share_tokens_workspace
--    policy let every workspace user, Members included, read, insert (with
--    a token of their choosing) and update links, so a Member could mint a
--    link for a Deliverable awaiting the Client and approve it themselves,
--    past ADR 0004's actor rule. Links are now written only by
--    send-approval-email (service role), which also deactivates the old ones
--    when it mints a new one; Owner/Admin may still read them.
--
-- 2. get_campaign_analytics joined posts and invoices in one query, so with
--    several of each every count and sum was multiplied (a campaign with 3
--    posts and 2 invoices reported 6 posts and invoice totals x3). Each
--    figure is now computed on its own. The #179 workspace check stays.

-- 1.
DROP POLICY share_tokens_workspace ON public.share_tokens;

CREATE POLICY share_tokens_admin_read ON public.share_tokens
  FOR SELECT TO authenticated
  USING (
    public.is_workspace_admin()
    AND EXISTS (
      SELECT 1 FROM post_versions pv JOIN clients c ON c.id = pv.client_id
      WHERE pv.id = share_tokens.post_version_id AND c.user_id = public.get_my_agency_user_id()
    )
  );

REVOKE INSERT, UPDATE, DELETE ON public.share_tokens FROM anon, authenticated;

-- 2.
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
  WITH cur AS (
    SELECT pv.*
    FROM posts p
    JOIN post_versions pv ON pv.id = p.current_version_id
    WHERE p.campaign_id = p_campaign_id
  ),
  inv AS (
    SELECT
      COALESCE(SUM(i.total) FILTER (WHERE i.status IN ('SENT', 'OVERDUE', 'PAID')), 0) AS invoiced,
      COALESCE(SUM(i.total) FILTER (WHERE i.status = 'PAID'), 0) AS collected
    FROM invoices i
    WHERE i.campaign_id = p_campaign_id
  )
  SELECT
    (SELECT COUNT(*) FROM posts WHERE campaign_id = p_campaign_id)::bigint,
    (SELECT COUNT(*) FROM cur WHERE status = 'PUBLISHED')::bigint,
    (SELECT COUNT(*) FROM cur
      WHERE status = 'PUBLISHED' AND published_at IS NOT NULL AND target_date IS NOT NULL
        AND published_at <= target_date::timestamptz)::bigint,
    (SELECT ROUND(AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 86400.0), 1)
       FROM cur WHERE status IN ('SCHEDULED', 'PUBLISHED') AND updated_at > created_at),
    COALESCE((SELECT jsonb_object_agg(plat, cnt) FROM (
       SELECT unnest(platform) AS plat, COUNT(*) AS cnt FROM cur GROUP BY 1) s), '{}'::jsonb),
    CASE WHEN v_fin THEN v_campaign.budget END,
    CASE WHEN v_fin THEN (SELECT invoiced FROM inv) END,
    CASE WHEN v_fin THEN (SELECT collected FROM inv) END;
END;
$function$;
