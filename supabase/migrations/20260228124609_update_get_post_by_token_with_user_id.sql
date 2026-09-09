
DROP FUNCTION IF EXISTS public.get_post_by_token(text);

CREATE OR REPLACE FUNCTION public.get_post_by_token(p_token text)
RETURNS TABLE(
  id uuid,
  title text,
  content text,
  media_urls text[],
  platform text[],
  version_number integer,
  created_at timestamp with time zone,
  client_name text,
  client_id uuid,
  user_id uuid,
  target_date timestamp with time zone
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
    c.name   AS client_name,
    c.id     AS client_id,
    c.user_id AS user_id,
    pv.target_date
  FROM public.share_tokens st
  JOIN public.post_versions pv ON st.post_version_id = pv.id
  JOIN public.clients c ON pv.client_id = c.id
  WHERE st.token = p_token
    AND st.expires_at > now();
END;
$$;
;
