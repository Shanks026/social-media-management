
-- Storage RLS: Upload
CREATE POLICY "Users upload own documents"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'client-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Storage RLS: Read
CREATE POLICY "Users read own documents"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'client-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Storage RLS: Delete
CREATE POLICY "Users delete own documents"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'client-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
;
