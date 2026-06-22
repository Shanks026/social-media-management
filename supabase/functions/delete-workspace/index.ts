import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Service-to-service function: invoked by the pg_cron scheduler with the
// service-role key as a Bearer token. It purges every workspace whose grace
// period (agency_subscriptions.scheduled_for_deletion_at) has elapsed.
// Auth is custom (service-role bearer check), so verify_jwt is disabled.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

function pathFromPublicUrl(url: string | null, bucket: string): string | null {
  if (!url) return null
  const seg = `/public/${bucket}/`
  return url.includes(seg) ? url.split(seg)[1] : null
}

async function removeInChunks(storage: any, bucket: string, paths: string[]) {
  const unique = [...new Set(paths.filter(Boolean))]
  for (let i = 0; i < unique.length; i += 100) {
    const chunk = unique.slice(i, i + 100)
    const { error } = await storage.from(bucket).remove(chunk)
    if (error) console.error(`[${bucket}] remove failed for ${chunk.length} files:`, error.message)
  }
}

// Permanently purge a single workspace: storage files, all DB data, auth accounts.
async function purgeWorkspace(admin: any, workspaceUserId: string) {
  const { data: sub } = await admin
    .from('agency_subscriptions')
    .select('logo_url, logo_horizontal_url, signature_url')
    .eq('user_id', workspaceUserId)
    .maybeSingle()

  const { data: clients } = await admin
    .from('clients').select('id, logo_url').eq('user_id', workspaceUserId)
  const clientIds = (clients || []).map((c: any) => c.id)

  // Gather every storage path BEFORE deleting rows.
  const postMediaPaths: string[] = []
  const documentPaths: string[] = []
  const proposalPaths: string[] = []

  if (sub) {
    postMediaPaths.push(
      pathFromPublicUrl(sub.logo_url, 'post-media')!,
      pathFromPublicUrl(sub.logo_horizontal_url, 'post-media')!,
      pathFromPublicUrl(sub.signature_url, 'post-media')!,
    )
  }
  for (const c of clients || []) {
    const p = pathFromPublicUrl(c.logo_url, 'post-media')
    if (p) postMediaPaths.push(p)
  }
  if (clientIds.length) {
    const { data: versions } = await admin
      .from('post_versions')
      .select('media_urls, posts!post_versions_post_id_fkey!inner(client_id)')
      .in('posts.client_id', clientIds)
    for (const v of versions || []) {
      for (const url of v.media_urls || []) {
        const p = pathFromPublicUrl(url, 'post-media')
        if (p) postMediaPaths.push(p)
      }
    }
    const { data: docs } = await admin
      .from('client_documents').select('storage_path').in('client_id', clientIds)
    for (const d of docs || []) if (d.storage_path) documentPaths.push(d.storage_path)
  }
  const { data: proposals } = await admin
    .from('proposals').select('file_url').eq('agency_user_id', workspaceUserId).not('file_url', 'is', null)
  for (const p of proposals || []) {
    const path = pathFromPublicUrl(p.file_url, 'proposal-files')
    if (path) proposalPaths.push(path)
  }

  await removeInChunks(admin.storage, 'post-media', postMediaPaths)
  await removeInChunks(admin.storage, 'client-documents', documentPaths)
  await removeInChunks(admin.storage, 'proposal-files', proposalPaths)

  // Capture members before deleting membership rows.
  const { data: members } = await admin
    .from('agency_members').select('member_user_id').eq('agency_user_id', workspaceUserId)
  const memberIds = [...new Set((members || []).map((m: any) => m.member_user_id).filter(Boolean))]

  // Delete DB data (clients cascade to all client-scoped descendants).
  if (clientIds.length) await admin.from('clients').delete().eq('user_id', workspaceUserId)
  await admin.from('expenses').delete().eq('user_id', workspaceUserId)
  await admin.from('transactions').delete().eq('user_id', workspaceUserId)
  await admin.from('prospects').delete().eq('user_id', workspaceUserId)
  await admin.from('agency_invites').delete().eq('agency_user_id', workspaceUserId)
  await admin.from('user_feedback').delete().eq('workspace_user_id', workspaceUserId)
  await admin.from('admin_feedback').delete().eq('user_id', workspaceUserId)
  await admin.from('agency_members').delete().eq('agency_user_id', workspaceUserId)
  await admin.from('agency_subscriptions').delete().eq('user_id', workspaceUserId)

  // Delete auth accounts. A member is deleted only if this was their last workspace.
  for (const memberId of memberIds as string[]) {
    if (memberId === workspaceUserId) continue
    const { count } = await admin
      .from('agency_members').select('id', { count: 'exact', head: true })
      .eq('member_user_id', memberId)
    if ((count ?? 0) === 0) {
      const { error } = await admin.auth.admin.deleteUser(memberId)
      if (error) console.error(`Failed to delete member auth ${memberId}:`, error.message)
    }
  }
  const { error: ownerErr } = await admin.auth.admin.deleteUser(workspaceUserId)
  if (ownerErr) console.error(`Failed to delete owner auth ${workspaceUserId}:`, ownerErr.message)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const serviceKey = Deno.env.get('SERVICE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    // Custom auth: only the scheduler (which holds the service/secret key) may invoke this.
    const auth = req.headers.get('Authorization') || ''
    if (auth !== `Bearer ${serviceKey}`) return json({ error: 'Forbidden' }, 403)

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey)

    // Find workspaces whose grace period has elapsed.
    const { data: due, error } = await admin
      .from('agency_subscriptions')
      .select('user_id')
      .not('scheduled_for_deletion_at', 'is', null)
      .lte('scheduled_for_deletion_at', new Date().toISOString())
    if (error) throw error

    const userIds = (due || []).map((d: any) => d.user_id)
    for (const uid of userIds) {
      try {
        await purgeWorkspace(admin, uid)
      } catch (e) {
        console.error(`Purge failed for workspace ${uid}:`, (e as Error).message)
      }
    }

    return json({ success: true, purged: userIds.length })
  } catch (err) {
    return json({ error: (err as Error).message }, 500)
  }
})
