
-- Drop the permissive ALL policy
DROP POLICY IF EXISTS document_collections_workspace_scoped ON public.document_collections;

-- SELECT: workspace-scoped + must not be 'none' level
CREATE POLICY dc_select ON public.document_collections
  FOR SELECT
  USING (
    user_id = public.get_my_agency_user_id()
    AND public.my_documents_level() <> 'none'
  );

-- INSERT: must be 'manage' level
CREATE POLICY dc_insert ON public.document_collections
  FOR INSERT
  WITH CHECK (
    user_id = public.get_my_agency_user_id()
    AND public.my_documents_level() = 'manage'
  );

-- UPDATE: must be 'manage' level
CREATE POLICY dc_update ON public.document_collections
  FOR UPDATE
  USING (
    user_id = public.get_my_agency_user_id()
    AND public.my_documents_level() = 'manage'
  )
  WITH CHECK (
    user_id = public.get_my_agency_user_id()
    AND public.my_documents_level() = 'manage'
  );

-- DELETE: must be 'manage' level
CREATE POLICY dc_delete ON public.document_collections
  FOR DELETE
  USING (
    user_id = public.get_my_agency_user_id()
    AND public.my_documents_level() = 'manage'
  );
;
