-- Branding lives in a public bucket so logos load by public URL (required for
-- branded emails and unauthenticated public review/proposal pages). The only thing
-- the SELECT policy controls is LISTING/enumeration of the branding folder.
--
-- Previously the 'public' role could enumerate every agency's branding files.
-- Remove that. Public-URL rendering is unaffected (public bucket bypasses RLS).
-- The admin portal (superadmin) keeps object-API/list access for management.

drop policy if exists "Allow Public View of Branding" on storage.objects;

create policy "branding_superadmin_read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'post-media'
    and (storage.foldername(name))[1] = 'branding'
    and public.is_superadmin()
  );;
