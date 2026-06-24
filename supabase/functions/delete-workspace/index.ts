import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Two-mode purge function (verify_jwt disabled; auth handled in code):
//
//  1. Cron batch sweep — invoked by pg_cron with the service-role key as the
//     Bearer token. Purges every workspace whose grace period
//     (agency_subscriptions.scheduled_for_deletion_at) has elapsed.
//
//  2. Superadmin immediate purge — invoked from the admin portal with the
//     caller's session JWT and a { workspace_user_id, reason } body. Verifies
//     the caller is an active superadmin, then immediately purges that one
//     workspace regardless of its schedule.
//
// Both modes funnel through the same canonical purgeWorkspace() teardown.

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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SERVICE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const auth = req.headers.get('Authorization') || ''
    const admin = createClient(supabaseUrl, serviceKey)

    // ── Mode 1: cron batch sweep (service-role bearer) ──
    if (auth === `Bearer ${serviceKey}`) {
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
    }

    // ── Mode 2: superadmin immediate purge (caller session JWT) ──
    if (!auth) return json({ error: 'Unauthorized' }, 401)

    let body: any = {}
    try { body = await req.json() } catch { /* empty body */ }
    const targetId: string | undefined = body?.workspace_user_id
    const reason: string = (body?.reason || '').toString().trim()
    if (!targetId) return json({ error: 'workspace_user_id is required' }, 400)

    // Verify the caller's JWT and that they are an active superadmin.
    const publishableKey = Deno.env.get('PUBLISHABLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY')!
    const caller = createClient(supabaseUrl, publishableKey, {
      global: { headers: { Authorization: auth } },
    })
    const { data: { user }, error: userErr } = await caller.auth.getUser()
    if (userErr || !user) return json({ error: 'Unauthorized' }, 401)

    const { data: sa } = await admin
      .from('agency_members')
      .select('id')
      .eq('member_user_id', user.id)
      .eq('system_role', 'superadmin')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()
    if (!sa) return json({ error: 'Forbidden' }, 403)

    // Confirm the target workspace exists before tearing it down.
    const { data: targetSub } = await admin
      .from('agency_subscriptions')
      .select('user_id')
      .eq('user_id', targetId)
      .maybeSingle()
    if (!targetSub) return json({ error: 'Workspace not found' }, 404)

    // Audit trail (surfaced in function logs): who purged what and why.
    console.log(`[immediate-purge] superadmin=${user.id} target=${targetId} reason=${JSON.stringify(reason)}`)

    await purgeWorkspace(admin, targetId)
    return json({ success: true, purged: 1 })
  } catch (err) {
    return json({ error: (err as Error).message }, 500)
  }
})
