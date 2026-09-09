
-- 1. Add deliverable_type column to post_versions
ALTER TABLE public.post_versions 
ADD COLUMN IF NOT EXISTS deliverable_type TEXT;

-- 2. Update create_post_draft_v3 to accept p_deliverable_type
CREATE OR REPLACE FUNCTION public.create_post_draft_v3(
    p_client_id uuid, 
    p_title text, 
    p_content text, 
    p_media_urls text[], 
    p_platform text[], 
    p_user_id uuid, 
    p_target_date timestamp with time zone DEFAULT NULL::timestamp with time zone, 
    p_admin_notes text DEFAULT NULL::text, 
    p_platform_schedules jsonb DEFAULT NULL::jsonb, 
    p_campaign_id uuid DEFAULT NULL::uuid,
    p_deliverable_type text DEFAULT NULL::text
)
RETURNS uuid
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
        platform_schedules,
        deliverable_type
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
        p_platform_schedules,
        p_deliverable_type
    )
    RETURNING id INTO v_version_id;

    UPDATE public.posts
    SET current_version_id = v_version_id
    WHERE id = v_post_id;

    RETURN v_version_id;
END;
$function$;

-- 3. Update create_revision_version to carry deliverable_type forward
CREATE OR REPLACE FUNCTION public.create_revision_version(
    p_parent_version_id uuid, 
    p_user_id uuid, 
    p_admin_notes text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
AS $function$
DECLARE
    v_post_id uuid;
    v_new_version_id uuid;
    v_old_version_record RECORD;
BEGIN
    SELECT * INTO v_old_version_record
    FROM public.post_versions
    WHERE id = p_parent_version_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Parent version not found';
    END IF;

    v_post_id := v_old_version_record.post_id;

    INSERT INTO public.post_versions (
        post_id, client_id, title, content, media_urls,
        platform, status, version_number, created_by,
        target_date, admin_notes, platform_schedules, deliverable_type
    )
    VALUES (
        v_post_id,
        v_old_version_record.client_id,
        v_old_version_record.title,
        v_old_version_record.content,
        v_old_version_record.media_urls,
        v_old_version_record.platform,
        'DRAFT',
        v_old_version_record.version_number + 1,
        p_user_id,
        v_old_version_record.target_date,
        p_admin_notes,
        v_old_version_record.platform_schedules,
        v_old_version_record.deliverable_type
    )
    RETURNING id INTO v_new_version_id;

    UPDATE public.post_versions
    SET status = 'ARCHIVED'
    WHERE id = p_parent_version_id;

    UPDATE public.posts
    SET current_version_id = v_new_version_id
    WHERE id = v_post_id;

    RETURN v_new_version_id;
END;
$function$;
;
