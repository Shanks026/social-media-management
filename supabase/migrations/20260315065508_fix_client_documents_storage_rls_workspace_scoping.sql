
-- Fix storage policies for client-documents to use workspace scoping
-- instead of auth.uid(), so team members can access workspace owner's files.

DROP POLICY IF EXISTS "Users upload own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users read own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users delete own documents" ON storage.objects;

CREATE POLICY "Users upload own documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'client-documents'
  AND (storage.foldername(name))[1] = (get_my_agency_user_id())::text
);

CREATE POLICY "Users read own documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'client-documents'
  AND (storage.foldername(name))[1] = (get_my_agency_user_id())::text
);

CREATE POLICY "Users delete own documents"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'client-documents'
  AND (storage.foldername(name))[1] = (get_my_agency_user_id())::text
);
;
