-- #68: the workspace purge (delete-workspace edge function) found files only
-- through database links, so avatars, replaced branding, note media and
-- already-orphaned files survived it. This lists every storage object that
-- belongs to a workspace being purged:
--
--   * anything uploaded by a user the purge deletes (p_uids: the owner, plus
--     members whose last workspace this is). Members who stay in another
--     workspace are left out, because their uploads may belong to it;
--   * anything under the workspace's own folder in the buckets keyed by
--     workspace (client-documents, note-media, proposal-files);
--   * anything under one of the workspace's client folders in post-media
--     (deliverable media and client logos), whoever uploaded it.
--
-- storage.objects isn't exposed through PostgREST, hence SECURITY DEFINER.
-- Only the service role may call it: it reveals file names across workspaces.
-- The caller deletes the files through the Storage API, which keeps the
-- storage_usage trigger in step.

create or replace function public.workspace_purge_storage_objects(
  p_workspace uuid,
  p_uids uuid[]
)
returns table (bucket_id text, name text)
language sql
stable
security definer
set search_path = ''
as $$
  select o.bucket_id, o.name
  from storage.objects o
  where o.owner = any (p_uids)
     or (o.bucket_id in ('client-documents', 'note-media', 'proposal-files')
         and (storage.foldername(o.name))[1] = p_workspace::text)
     or (o.bucket_id = 'post-media'
         and (storage.foldername(o.name))[1] in (
           select c.id::text from public.clients c where c.user_id = p_workspace))
$$;

revoke all on function public.workspace_purge_storage_objects(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.workspace_purge_storage_objects(uuid, uuid[]) to service_role;
