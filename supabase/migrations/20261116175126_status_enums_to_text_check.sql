-- #141 / ADR 0006: statuses are text + CHECK, never Postgres enums.
--
-- Converts post_versions.status (enum post_status, 11 values) and
-- transactions.status (enum transaction_status, 3 values) to text with a
-- CHECK listing the same values, then drops both types. The objects that
-- depend on the enums are dropped and recreated unchanged apart from their
-- casts:
--   * view client_pipeline_analytics           (compares against ::post_status)
--   * get_global_calendar(...)                  (RETURNS TABLE(... status post_status ...))
--   * get_campaigns_with_post_summary(...)      (SQL body casts ::post_status)
--   * update_post_status_by_token(...)          (casts p_status::post_status)
--   * triggers tg_autocomplete_tasks and trg_post_version_status_transition
--     (both `UPDATE OF status`, which pins the column's type)
--   * RLS policy posts_workspace_delete (reads the current version's status)
-- Values and casing are unchanged, so no app change is needed.

-- 1. Drop what pins the types ----------------------------------------------
DROP VIEW public.client_pipeline_analytics;
DROP FUNCTION public.get_global_calendar(uuid, timestamp with time zone, timestamp with time zone);
DROP TRIGGER tg_autocomplete_tasks ON public.post_versions;
DROP TRIGGER trg_post_version_status_transition ON public.post_versions;
DROP POLICY posts_workspace_delete ON public.posts;

-- 2. Retype the columns and add the CHECKs -----------------------------------
ALTER TABLE public.post_versions
    ALTER COLUMN status TYPE text USING status::text;

ALTER TABLE public.post_versions
    ADD CONSTRAINT post_versions_status_check CHECK (status = ANY (ARRAY[
        'DRAFT', 'SUBMITTED', 'CHANGES_REQUESTED', 'READY',
        'PENDING_APPROVAL', 'NEEDS_REVISION', 'APPROVED', 'SCHEDULED',
        'PUBLISHED', 'DELIVERED', 'ARCHIVED'
    ]::text[]));

-- The column was nullable; a NULL meant the default, PAID. Fill any before
-- adding NOT NULL so the push can't fail on an old row.
UPDATE public.transactions SET status = 'PAID' WHERE status IS NULL;

ALTER TABLE public.transactions
    ALTER COLUMN status DROP DEFAULT,
    ALTER COLUMN status TYPE text USING status::text,
    ALTER COLUMN status SET DEFAULT 'PAID',
    ALTER COLUMN status SET NOT NULL;

ALTER TABLE public.transactions
    ADD CONSTRAINT transactions_status_check CHECK (status = ANY (ARRAY[
        'PAID', 'PENDING', 'OVERDUE'
    ]::text[]));

DROP TYPE public.post_status;
DROP TYPE public.transaction_status;

-- 3. Recreate the dependents ---------------------------------------------
CREATE TRIGGER tg_autocomplete_tasks AFTER UPDATE OF status ON public.post_versions
    FOR EACH ROW EXECUTE FUNCTION public.tg_autocomplete_tasks_on_publish();
CREATE TRIGGER trg_post_version_status_transition BEFORE UPDATE OF status ON public.post_versions
    FOR EACH ROW EXECUTE FUNCTION public.enforce_post_status_transition();

-- Deliverable deletion rule (unchanged): Owner/Admin always; a Member only
-- their own Deliverable while its current Version is DRAFT/SUBMITTED/ARCHIVED.
CREATE POLICY posts_workspace_delete ON public.posts FOR DELETE USING (
    (EXISTS (SELECT 1 FROM public.clients
             WHERE clients.id = posts.client_id
               AND clients.user_id = public.get_my_agency_user_id()))
    AND (public.is_workspace_admin()
         OR (posts.created_by = auth.uid()
             AND EXISTS (SELECT 1 FROM public.post_versions pv
                         WHERE pv.id = posts.current_version_id
                           AND pv.status = ANY (ARRAY['DRAFT', 'SUBMITTED', 'ARCHIVED']::text[]))))
);

CREATE VIEW public.client_pipeline_analytics WITH (security_invoker = on) AS
 SELECT c.id AS client_id,
    count(pv.id) FILTER (WHERE pv.status = 'DRAFT') AS drafts,
    count(pv.id) FILTER (WHERE pv.status = 'PENDING_APPROVAL') AS pending,
    count(pv.id) FILTER (WHERE pv.status = 'NEEDS_REVISION') AS revisions,
    count(pv.id) FILTER (WHERE pv.status = 'SCHEDULED') AS scheduled,
    min(pv.target_date) FILTER (WHERE pv.status = 'SCHEDULED' AND pv.target_date > now()) AS next_post_at
   FROM public.clients c
     LEFT JOIN public.posts p ON c.id = p.client_id
     LEFT JOIN public.post_versions pv ON p.current_version_id = pv.id
  GROUP BY c.id;

GRANT ALL ON TABLE public.client_pipeline_analytics TO anon, authenticated, service_role;

CREATE FUNCTION public.get_global_calendar(p_user_id uuid, p_start_date timestamp with time zone, p_end_date timestamp with time zone)
 RETURNS TABLE(post_id uuid, version_id uuid, version_number integer, title text, content text, status text, platforms text[], media_urls text[], target_date timestamp with time zone, client_id uuid, client_name text, client_logo text, created_by uuid)
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
$function$;

GRANT ALL ON FUNCTION public.get_global_calendar(uuid, timestamp with time zone, timestamp with time zone) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_campaigns_with_post_summary(p_user_id uuid, p_client_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, client_id uuid, client_name text, client_avatar text, name text, goal text, description text, status text, start_date date, end_date date, created_at timestamp with time zone, updated_at timestamp with time zone, total_posts bigint, draft_count bigint, pending_count bigint, revision_count bigint, approved_count bigint, scheduled_count bigint, published_count bigint, archived_count bigint)
 LANGUAGE sql
 STABLE
AS $function$
  SELECT
    c.id, c.client_id,
    cl.name        AS client_name,
    cl.logo_url    AS client_avatar,
    c.name, c.goal, c.description, c.status,
    c.start_date, c.end_date, c.created_at, c.updated_at,
    COUNT(p.id)                                                     AS total_posts,
    COUNT(p.id) FILTER (WHERE pv.status = 'DRAFT')                  AS draft_count,
    COUNT(p.id) FILTER (WHERE pv.status = 'PENDING_APPROVAL')       AS pending_count,
    COUNT(p.id) FILTER (WHERE pv.status = 'NEEDS_REVISION')         AS revision_count,
    COUNT(p.id) FILTER (WHERE pv.status = 'APPROVED')               AS approved_count,
    COUNT(p.id) FILTER (WHERE pv.status = 'SCHEDULED')              AS scheduled_count,
    COUNT(p.id) FILTER (WHERE pv.status = 'PUBLISHED')              AS published_count,
    COUNT(p.id) FILTER (WHERE pv.status = 'ARCHIVED')               AS archived_count
  FROM campaigns c
  LEFT JOIN clients cl ON cl.id = c.client_id
  LEFT JOIN posts p ON p.campaign_id = c.id
  LEFT JOIN post_versions pv ON pv.id = p.current_version_id
  WHERE c.user_id = p_user_id
    AND (p_client_id IS NULL OR c.client_id = p_client_id)
  GROUP BY c.id, cl.name, cl.logo_url
  ORDER BY c.created_at DESC;
$function$;

-- Same body as before; only `p_status::post_status` became `p_status`.
-- An unknown value is now rejected by post_versions_status_check instead of
-- the enum cast.
CREATE OR REPLACE FUNCTION public.update_post_status_by_token(p_token text, p_status text, p_feedback text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_version_id uuid;
  v_rec record;
  v_service_key text;
  v_project_url text;
  v_workspace_id uuid;
BEGIN
  SELECT post_version_id INTO v_version_id
  FROM public.share_tokens
  WHERE token = p_token AND expires_at > now() AND is_active = true;

  IF v_version_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired token';
  END IF;

  UPDATE public.post_versions
  SET status = p_status, client_notes = p_feedback
  WHERE id = v_version_id
  RETURNING id, post_id, client_id, created_by, title, status, target_date, client_notes
  INTO v_rec;

  UPDATE public.share_tokens SET is_active = false WHERE token = p_token;

  IF p_status IN ('SCHEDULED', 'NEEDS_REVISION') THEN
    BEGIN
      SELECT decrypted_secret INTO v_service_key
      FROM vault.decrypted_secrets WHERE name = 'service_role_key';
      SELECT decrypted_secret INTO v_project_url
      FROM vault.decrypted_secrets WHERE name = 'project_url';

      IF v_service_key IS NOT NULL AND v_project_url IS NOT NULL THEN
        PERFORM net.http_post(
          url := rtrim(v_project_url, '/') || '/functions/v1/send-approval-email',
          headers := jsonb_build_object('Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_service_key),
          body := jsonb_build_object('record', jsonb_build_object(
            'id', v_rec.id, 'client_id', v_rec.client_id, 'created_by', v_rec.created_by,
            'title', v_rec.title, 'status', v_rec.status, 'target_date', v_rec.target_date,
            'client_notes', v_rec.client_notes)));
      ELSE
        RAISE WARNING 'agency review-decision email skipped: vault secret % missing',
          CASE WHEN v_project_url IS NULL THEN 'project_url' ELSE 'service_role_key' END;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'agency review-decision email failed: %', SQLERRM;
    END;

    BEGIN
      SELECT user_id INTO v_workspace_id FROM public.clients WHERE id = v_rec.client_id;
      PERFORM public.emit_notifications(
        v_workspace_id, NULL, array[v_rec.created_by, v_workspace_id],
        'campaign_reviewed',
        CASE WHEN p_status = 'SCHEDULED' THEN 'Client approved a deliverable'
             ELSE 'Client requested revisions' END,
        v_rec.title, 'post', v_rec.post_id,
        '/clients/' || v_rec.client_id || '/posts/' || v_rec.post_id);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'in-app review notification failed: %', SQLERRM;
    END;
  END IF;
END;
$function$;
