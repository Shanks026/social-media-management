CREATE OR REPLACE FUNCTION public.create_post_draft_v3(
  p_client_id         UUID,
  p_title             TEXT,
  p_content           TEXT,
  p_media_urls        TEXT[],
  p_platform          TEXT[],
  p_user_id           UUID,
  p_target_date       TIMESTAMPTZ DEFAULT NULL,
  p_admin_notes       TEXT        DEFAULT NULL,
  p_platform_schedules JSONB      DEFAULT NULL,
  p_campaign_id       UUID        DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
AS $function$
DECLARE
    v_post_id    UUID;
    v_version_id UUID;
BEGIN
    INSERT INTO public.posts (client_id, campaign_id)
    VALUES (p_client_id, p_campaign_id)
    RETURNING id INTO v_post_id;

    INSERT INTO public.post_versions (
        post_id,
        client_id,
        version_number,
        status,
        content,
        media_urls,
        platform,
        created_by,
        title,
        target_date,
        admin_notes,
        platform_schedules
    )
    VALUES (
        v_post_id,
        p_client_id,
        1,
        'DRAFT',
        p_content,
        p_media_urls,
        p_platform,
        p_user_id,
        p_title,
        p_target_date,
        p_admin_notes,
        p_platform_schedules
    )
    RETURNING id INTO v_version_id;

    UPDATE public.posts
    SET current_version_id = v_version_id
    WHERE id = v_post_id;

    RETURN v_version_id;
END;
$function$;;
