DROP FUNCTION IF EXISTS public.get_campaigns_with_post_summary(uuid, uuid);

CREATE OR REPLACE FUNCTION public.get_campaigns_with_post_summary(p_user_id uuid, p_client_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, client_id uuid, client_name text, client_avatar text, name text, goal text, description text, status text, start_date date, end_date date, created_at timestamp with time zone, updated_at timestamp with time zone, total_posts bigint, draft_count bigint, pending_count bigint, revision_count bigint, scheduled_count bigint, published_count bigint, archived_count bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  SELECT
    c.id,
    c.client_id,
    cl.name        AS client_name,
    cl.logo_url    AS client_avatar,
    c.name,
    c.goal,
    c.description,
    c.status,
    c.start_date,
    c.end_date,
    c.created_at,
    c.updated_at,
    COUNT(p.id)                                                                       AS total_posts,
    COUNT(p.id) FILTER (WHERE pv.status = 'DRAFT'::post_status)                      AS draft_count,
    COUNT(p.id) FILTER (WHERE pv.status = 'PENDING_APPROVAL'::post_status)            AS pending_count,
    COUNT(p.id) FILTER (WHERE pv.status = 'NEEDS_REVISION'::post_status)              AS revision_count,
    COUNT(p.id) FILTER (WHERE pv.status = 'SCHEDULED'::post_status)                   AS scheduled_count,
    COUNT(p.id) FILTER (WHERE pv.status = 'PUBLISHED'::post_status)                   AS published_count,
    COUNT(p.id) FILTER (WHERE pv.status = 'ARCHIVED'::post_status)                    AS archived_count
  FROM campaigns c
  LEFT JOIN clients cl ON cl.id = c.client_id
  LEFT JOIN posts p ON p.campaign_id = c.id
  LEFT JOIN post_versions pv ON pv.id = p.current_version_id
  WHERE c.user_id = p_user_id
    AND (p_client_id IS NULL OR c.client_id = p_client_id)
  GROUP BY c.id, cl.name, cl.logo_url
  ORDER BY c.created_at DESC;
$function$;
