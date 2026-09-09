
-- Create the note-media private bucket (50 MB file size limit)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'note-media',
  'note-media',
  false,
  52428800,
  array[
    'image/jpeg','image/png','image/gif','image/webp','image/svg+xml',
    'video/mp4','video/webm','video/ogg','video/quicktime'
  ]
)
on conflict (id) do nothing;

-- RLS: workspace members may upload to their own workspace prefix
drop policy if exists "note-media insert" on storage.objects;
create policy "note-media insert"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'note-media' and
  (storage.foldername(name))[1] = get_my_agency_user_id()::text
);

-- RLS: workspace members may read their own workspace files
drop policy if exists "note-media select" on storage.objects;
create policy "note-media select"
on storage.objects for select to authenticated
using (
  bucket_id = 'note-media' and
  (storage.foldername(name))[1] = get_my_agency_user_id()::text
);

-- RLS: workspace members may delete their own workspace files
drop policy if exists "note-media delete" on storage.objects;
create policy "note-media delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'note-media' and
  (storage.foldername(name))[1] = get_my_agency_user_id()::text
);
;
