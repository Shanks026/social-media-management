-- Helper: client ids belonging to the caller's workspace. SECURITY DEFINER so the
-- storage policy resolves deterministically without depending on clients' own RLS.
create or replace function public.my_workspace_client_ids()
returns setof text
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select c.id::text
  from public.clients c
  where c.user_id = public.get_my_agency_user_id()
$$;

revoke execute on function public.my_workspace_client_ids() from public, anon;
grant execute on function public.my_workspace_client_ids() to authenticated;

-- post-media (public bucket): previously ANY authenticated user could list the
-- entire bucket (every tenant's files). Restrict listing to the caller's own
-- client folders ('{client_id}/...'), which is all getFileSize() needs. Public
-- viewing is via public URLs and bypasses RLS, so display is unaffected.
drop policy if exists "post_media_read" on storage.objects;
create policy "post_media_read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'post-media'
    and (storage.foldername(name))[1] in (select public.my_workspace_client_ids())
  );

-- proposal-files (public bucket): previously ANY authenticated user could list the
-- entire bucket. Scope to the caller's own workspace folder ('{workspace_user_id}/...').
-- No code lists this bucket; public review reads via public URLs.
drop policy if exists "proposal_files_public_read" on storage.objects;
create policy "proposal_files_read_own" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'proposal-files'
    and (storage.foldername(name))[1] = public.get_my_agency_user_id()::text
  );;
