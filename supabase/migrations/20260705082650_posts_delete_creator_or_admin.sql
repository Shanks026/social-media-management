-- Restrict deleting a deliverable (post) to its original creator or a workspace
-- admin/owner. Editing stays open to all workspace members (collaboration).

-- 1) Track the original creator on the parent post.
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS created_by uuid;

-- 2) Backfill from each post's earliest (v1) version author.
UPDATE public.posts p
SET created_by = pv.created_by
FROM (
  SELECT DISTINCT ON (post_id) post_id, created_by
  FROM public.post_versions
  ORDER BY post_id, version_number ASC NULLS LAST
) pv
WHERE pv.post_id = p.id AND p.created_by IS NULL;

-- 3) Stamp created_by from the first version on insert (covers every
--    create_post_draft_v3 overload + any future path). SECURITY DEFINER so the
--    internal write isn't blocked by RLS.
CREATE OR REPLACE FUNCTION public.tg_set_post_creator()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.version_number = 1 THEN
    UPDATE public.posts
    SET created_by = NEW.created_by
    WHERE id = NEW.post_id AND created_by IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_post_creator ON public.post_versions;
CREATE TRIGGER trg_set_post_creator
AFTER INSERT ON public.post_versions
FOR EACH ROW EXECUTE FUNCTION public.tg_set_post_creator();

-- 4) Split the FOR ALL workspace policy so DELETE can be restricted without
--    loosening SELECT/INSERT/UPDATE (which stay workspace-scoped = edit-open).
DROP POLICY IF EXISTS posts_workspace_scoped ON public.posts;

CREATE POLICY posts_workspace_select ON public.posts
  FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.clients
                 WHERE clients.id = posts.client_id
                   AND clients.user_id = public.get_my_agency_user_id()));

CREATE POLICY posts_workspace_insert ON public.posts
  FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.clients
                      WHERE clients.id = posts.client_id
                        AND clients.user_id = public.get_my_agency_user_id()));

CREATE POLICY posts_workspace_update ON public.posts
  FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.clients
                 WHERE clients.id = posts.client_id
                   AND clients.user_id = public.get_my_agency_user_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.clients
                      WHERE clients.id = posts.client_id
                        AND clients.user_id = public.get_my_agency_user_id()));

CREATE POLICY posts_workspace_delete ON public.posts
  FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.clients
            WHERE clients.id = posts.client_id
              AND clients.user_id = public.get_my_agency_user_id())
    AND (posts.created_by = auth.uid() OR public.is_workspace_admin())
  );;
