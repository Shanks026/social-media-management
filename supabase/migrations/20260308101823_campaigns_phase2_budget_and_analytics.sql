
-- 1. Add budget column to campaigns
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS budget NUMERIC(12, 2);

-- 2. Add campaign_id FK to invoices
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_campaign_id ON invoices(campaign_id);

-- 3. Create get_campaign_analytics RPC
CREATE OR REPLACE FUNCTION get_campaign_analytics(p_campaign_id UUID)
RETURNS TABLE (
  total_posts           BIGINT,
  published_posts       BIGINT,
  on_time_posts         BIGINT,
  avg_approval_days     NUMERIC,
  platform_distribution JSONB,
  budget                NUMERIC,
  total_invoiced        NUMERIC,
  total_collected       NUMERIC
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
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
    COALESCE(SUM(i.total_amount) FILTER (WHERE i.status IN ('SENT','OVERDUE','PAID')), 0),
    COALESCE(SUM(i.total_amount) FILTER (WHERE i.status = 'PAID'), 0)
  FROM campaigns c
  LEFT JOIN posts p ON p.campaign_id = c.id
  LEFT JOIN post_versions pv ON pv.id = p.current_version_id
  LEFT JOIN invoices i ON i.campaign_id = p_campaign_id
  WHERE c.id = p_campaign_id
  GROUP BY v_campaign.budget;
END;
$$;
;
