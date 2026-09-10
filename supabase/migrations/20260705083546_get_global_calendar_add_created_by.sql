-- Add the deliverable's original creator to the calendar RPC so the UI can gate
-- the delete action (creator or admin) without a separate fetch.
DROP FUNCTION IF EXISTS public.get_global_calendar(uuid, timestamptz, timestamptz);

CREATE OR REPLACE FUNCTION public.get_global_calendar(p_user_id uuid, p_start_date timestamptz, p_end_date timestamptz)
RETURNS TABLE(
  post_id uuid, version_id uuid, version_number integer, title text, content text,
  status post_status, platforms text[], media_urls text[], target_date timestamptz,
  client_id uuid, client_name text, client_logo text, created_by uuid
)
LANGUAGE plpgsql
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
    WHERE c.user_id = p_user_id
      AND pv.target_date >= p_start_date
      AND pv.target_date <= p_end_date
      AND pv.id = p.current_version_id;
END;
$function$;;
