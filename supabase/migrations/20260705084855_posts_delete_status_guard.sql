-- Refine deliverable deletion: owner/admin may delete in ANY status; a
-- non-admin creator may delete only before a commitment exists — i.e. while the
-- current version is DRAFT, SUBMITTED, or ARCHIVED. Everything from READY onward
-- (READY, CHANGES_REQUESTED, PENDING_APPROVAL, APPROVED, NEEDS_REVISION,
-- SCHEDULED, DELIVERED, PUBLISHED) is protected from member deletion.
DROP POLICY IF EXISTS posts_workspace_delete ON public.posts;

CREATE POLICY posts_workspace_delete ON public.posts
  FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.clients
            WHERE clients.id = posts.client_id
              AND clients.user_id = public.get_my_agency_user_id())
    AND (
      public.is_workspace_admin()
      OR (
        posts.created_by = auth.uid()
        AND EXISTS (
          SELECT 1 FROM public.post_versions pv
          WHERE pv.id = posts.current_version_id
            AND pv.status::text IN ('DRAFT', 'SUBMITTED', 'ARCHIVED')
        )
      )
    )
  );;
