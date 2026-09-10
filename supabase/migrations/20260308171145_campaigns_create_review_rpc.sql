
CREATE OR REPLACE FUNCTION get_campaign_by_review_token(p_token UUID)
RETURNS TABLE (
  campaign_id             UUID,
  campaign_name           TEXT,
  goal                    TEXT,
  agency_name             TEXT,
  logo_url                TEXT,
  branding_agency_sidebar BOOLEAN,
  branding_powered_by     BOOLEAN,
  posts                   JSONB
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT
    c.id,
    c.name,
    c.goal,
    ags.agency_name,
    ags.logo_url,
    ags.branding_agency_sidebar,
    ags.branding_powered_by,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'post_id',        p.id,
          'title',          pv.title,
          'content',        pv.content,
          'platform',       pv.platform,
          'target_date',    pv.target_date,
          'media_urls',     pv.media_urls,
          'status',         pv.status,
          'version_number', pv.version_number,
          'review_token',   st.token
        ) ORDER BY pv.target_date NULLS LAST
      ) FILTER (WHERE pv.status = 'PENDING_APPROVAL'),
      '[]'::jsonb
    )
  FROM campaigns c
  JOIN agency_subscriptions ags ON ags.user_id = c.user_id
  LEFT JOIN posts p ON p.campaign_id = c.id
  LEFT JOIN post_versions pv ON pv.id = p.current_version_id
  LEFT JOIN LATERAL (
    SELECT token FROM share_tokens
    WHERE post_version_id = pv.id
      AND expires_at > now()
    ORDER BY created_at DESC
    LIMIT 1
  ) st ON true
  WHERE c.review_token = p_token
  GROUP BY c.id, ags.agency_name, ags.logo_url, ags.branding_agency_sidebar, ags.branding_powered_by;
$$;
;
