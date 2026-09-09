
-- ── Phase 4: Documents Cap & Confidentiality ──────────────────────────────────
-- Adds is_confidential column, splits the single all-access RLS policy into
-- four level-aware policies, and tightens storage bucket policies.

-- 1. Add is_confidential column
ALTER TABLE public.client_documents
  ADD COLUMN is_confidential boolean NOT NULL DEFAULT false;

-- 2. Backfill sensitive categories as confidential
UPDATE public.client_documents
SET is_confidential = true
WHERE category IN ('Contract', 'NDA', 'Invoice / Finance');

-- 3. Replace single ALL policy with four split policies
DROP POLICY client_documents_workspace_scoped ON public.client_documents;

-- SELECT: workspace + must have some documents access + confidential filter
CREATE POLICY cd_select ON public.client_documents
  FOR SELECT USING (
    user_id = public.get_my_agency_user_id()
    AND public.my_documents_level() <> 'none'
    AND (is_confidential = false OR public.can_view_confidential_docs())
  );

-- INSERT: workspace + manage level only
CREATE POLICY cd_insert ON public.client_documents
  FOR INSERT WITH CHECK (
    user_id = public.get_my_agency_user_id()
    AND public.my_documents_level() = 'manage'
  );

-- UPDATE: workspace + manage level only
CREATE POLICY cd_update ON public.client_documents
  FOR UPDATE
  USING (
    user_id = public.get_my_agency_user_id()
    AND public.my_documents_level() = 'manage'
  )
  WITH CHECK (
    user_id = public.get_my_agency_user_id()
    AND public.my_documents_level() = 'manage'
  );

-- DELETE: workspace + manage level only
CREATE POLICY cd_delete ON public.client_documents
  FOR DELETE USING (
    user_id = public.get_my_agency_user_id()
    AND public.my_documents_level() = 'manage'
  );

-- 4. Tighten storage bucket policies for client-documents
--    Replace workspace-only checks with level-aware checks (defense-in-depth).
--    SELECT: any member with documents != 'none' can read.
--    INSERT/DELETE: manage level only.

DROP POLICY "Users read own documents" ON storage.objects;
DROP POLICY "Users upload own documents" ON storage.objects;
DROP POLICY "Users delete own documents" ON storage.objects;

CREATE POLICY "client_docs_read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'client-documents'
    AND (storage.foldername(name))[1] = (public.get_my_agency_user_id())::text
    AND public.my_documents_level() <> 'none'
  );

CREATE POLICY "client_docs_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'client-documents'
    AND (storage.foldername(name))[1] = (public.get_my_agency_user_id())::text
    AND public.my_documents_level() = 'manage'
  );

CREATE POLICY "client_docs_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'client-documents'
    AND (storage.foldername(name))[1] = (public.get_my_agency_user_id())::text
    AND public.my_documents_level() = 'manage'
  );
;
