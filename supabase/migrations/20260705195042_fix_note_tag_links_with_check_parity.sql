
-- The Phase 2 migration's note_tag_links WITH CHECK only allowed the author
-- to insert/update tag links, dropping the workspace/shared-write branch that
-- Phase 1 had (and that this policy's own USING clause still has). That silently
-- blocked any non-author workspace member from tagging a plain Workspace note —
-- a regression against the locked "today's workspace-note behavior is unchanged"
-- decision. Restore parity, using write-permission (not just any share) for the
-- shared case, matching the same "can edit content" semantics as notes_update.
DROP POLICY "note_tag_links_visibility_scoped" ON public.note_tag_links;
CREATE POLICY "note_tag_links_visibility_scoped" ON public.note_tag_links
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM notes n
      WHERE n.id = note_tag_links.note_id
        AND n.user_id = get_my_agency_user_id()
        AND (
          n.created_by = auth.uid()
          OR n.visibility = 'workspace'
          OR (n.visibility = 'shared' AND my_note_share_permission(n.id) IS NOT NULL)
        )
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM notes n
      WHERE n.id = note_tag_links.note_id
        AND n.user_id = get_my_agency_user_id()
        AND (
          n.created_by = auth.uid()
          OR n.visibility = 'workspace'
          OR (n.visibility = 'shared' AND my_note_share_permission(n.id) = 'write')
        )
    )
  );
;
