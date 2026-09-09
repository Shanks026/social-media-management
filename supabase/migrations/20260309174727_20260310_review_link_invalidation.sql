-- Add is_active flag to share_tokens
ALTER TABLE public.share_tokens ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- Add review_token_active flag to campaigns
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS review_token_active boolean DEFAULT true;

-- Update get_campaign_by_review_token to respect the flag
CREATE OR REPLACE FUNCTION public.get_campaign_by_review_token(p_token uuid)
 RETURNS TABLE(campaign_id uuid, campaign_name text, goal text, agency_name text, logo_url text, branding_agency_sidebar boolean, branding_powered_by boolean, posts jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
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
      AND is_active = true
    ORDER BY created_at DESC
    LIMIT 1
  ) st ON true
  WHERE c.review_token = p_token
    AND c.review_token_active = true
  GROUP BY c.id, ags.agency_name, ags.logo_url, ags.branding_agency_sidebar, ags.branding_powered_by;
$function$;

-- Update get_post_by_token to respect the flag
CREATE OR REPLACE FUNCTION public.get_post_by_token(p_token text)
 RETURNS TABLE(id uuid, title text, content text, media_urls text[], platform text[], version_number integer, created_at timestamp with time zone, client_name text, client_id uuid, user_id uuid, target_date timestamp with time zone, platform_schedules jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    pv.id,
    pv.title,
    pv.content,
    pv.media_urls,
    pv.platform,
    pv.version_number,
    pv.created_at,
    c.name   AS client_name,
    c.id     AS client_id,
    c.user_id AS user_id,
    pv.target_date,
    pv.platform_schedules
  FROM public.share_tokens st
  JOIN public.post_versions pv ON st.post_version_id = pv.id
  JOIN public.clients c ON pv.client_id = c.id
  WHERE st.token = p_token
    AND st.expires_at > now()
    AND st.is_active = true;
END;
$function$;

-- Update update_post_status_by_token to deactivate the token
CREATE OR REPLACE FUNCTION public.update_post_status_by_token(p_token text, p_status text, p_feedback text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_version_id uuid;
BEGIN
  -- 1. Find the version ID associated with this token
  SELECT post_version_id INTO v_version_id
  FROM public.share_tokens
  WHERE token = p_token AND expires_at > now() AND is_active = true;

  IF v_version_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired token';
  END IF;

  -- 2. Update the status and feedback
  UPDATE public.post_versions
  SET 
    status = p_status::post_status, 
    client_notes = p_feedback
  WHERE id = v_version_id;

  -- 3. Invalidate the token used
  UPDATE public.share_tokens
  SET is_active = false
  WHERE token = p_token;

  -- 4. If this was the last pending post in the campaign, optionally invalidate the campaign token?
  -- Or just let the campaign link show "No more posts to review".
END;
$function$;
;
