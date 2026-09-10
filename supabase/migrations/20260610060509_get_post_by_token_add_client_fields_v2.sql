
DROP FUNCTION IF EXISTS public.get_post_by_token(text);

CREATE FUNCTION public.get_post_by_token(p_token text)
RETURNS TABLE (
  id uuid,
  title text,
  content text,
  media_urls text[],
  platform text[],
  version_number integer,
  created_at timestamptz,
  client_name text,
  client_id uuid,
  user_id uuid,
  target_date timestamptz,
  platform_schedules jsonb,
  client_logo_url text,
  client_industry text,
  client_social_links jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
    c.name          AS client_name,
    c.id            AS client_id,
    c.user_id       AS user_id,
    pv.target_date,
    pv.platform_schedules,
    c.logo_url      AS client_logo_url,
    c.industry      AS client_industry,
    c.social_links  AS client_social_links
  FROM public.share_tokens st
  JOIN public.post_versions pv ON st.post_version_id = pv.id
  JOIN public.clients c ON pv.client_id = c.id
  WHERE st.token = p_token
    AND st.expires_at > now()
    AND st.is_active = true;
END;
$$;
;
