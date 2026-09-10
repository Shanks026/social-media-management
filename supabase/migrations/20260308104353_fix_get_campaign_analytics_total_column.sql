
CREATE OR REPLACE FUNCTION public.get_campaign_analytics(p_campaign_id uuid)
RETURNS TABLE(
  total_posts         bigint,
  published_posts     bigint,
  on_time_posts       bigint,
  avg_approval_days   numeric,
  platform_distribution jsonb,
  budget              numeric,
  total_invoiced      numeric,
  total_collected     numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $function$
DECLARE v_campaign campaigns%ROWTYPE;
BEGIN
  SELECT * INTO v_campaign FROM campaigns WHERE id = p_campaign_id;
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
    NULL::NUMERIC,
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
    v_campaign.budget,
    COALESCE(SUM(i.total) FILTER (WHERE i.status IN ('SENT','OVERDUE','PAID')), 0),
    COALESCE(SUM(i.total) FILTER (WHERE i.status = 'PAID'), 0)
  FROM campaigns c
  LEFT JOIN posts p ON p.campaign_id = c.id
  LEFT JOIN post_versions pv ON pv.id = p.current_version_id
  LEFT JOIN invoices i ON i.campaign_id = p_campaign_id
  WHERE c.id = p_campaign_id
  GROUP BY v_campaign.budget;
END;
$function$;
;
