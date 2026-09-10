
-- Per user decision: tighten Workspace-visibility note deletion to author or
-- workspace admin/owner, mirroring the existing Post-deletion pattern
-- (is_workspace_admin() override + author-only for regular members). Shared
-- notes are untouched — they remain author-only for delete, per the Phase 2
-- decision that write-access collaborators never get delete rights.
DROP POLICY "notes_delete" ON public.notes;
CREATE POLICY "notes_delete" ON public.notes
  FOR DELETE USING (
    user_id = get_my_agency_user_id()
    AND (
      created_by = auth.uid()
      OR (visibility = 'workspace' AND is_workspace_admin())
    )
  );
;
