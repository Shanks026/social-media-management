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

// Delete rows and stop on the first failure: deleting auth accounts after a
// failed row delete would leave the workspace half-purged with no way back in.
async function deleteRows(admin: any, table: string, column: string, value: string) {
  const { error } = await admin.from(table).delete().eq(column, value)
  if (error) throw new Error(`delete ${table} failed: ${error.message}`)
}

// Permanently purge a single workspace: storage files, all DB data, auth accounts.
async function purgeWorkspace(admin: any, workspaceUserId: string) {
  // Who the purge deletes, decided while membership rows still exist: the owner,
  // plus members whose last workspace this is. Members who belong to another
  // workspace keep their account and any uploads outside this workspace's folders.
  const { data: members, error: membersErr } = await admin
    .from('agency_members').select('member_user_id').eq('agency_user_id', workspaceUserId)
  if (membersErr) throw membersErr
  const memberIds = [...new Set((members || []).map((m: any) => m.member_user_id).filter(Boolean))]
    .filter((id) => id !== workspaceUserId) as string[]
  const staying = new Set<string>()
  if (memberIds.length) {
    const { data: elsewhere, error } = await admin
      .from('agency_members').select('member_user_id')
      .in('member_user_id', memberIds).neq('agency_user_id', workspaceUserId)
    if (error) throw error
    for (const m of elsewhere || []) staying.add(m.member_user_id)
  }
  const deletedMemberIds = memberIds.filter((id) => !staying.has(id))

  const { data: sub } = await admin
    .from('agency_subscriptions')
    .select('logo_url, logo_horizontal_url, signature_url')
    .eq('user_id', workspaceUserId)
    .maybeSingle()

  const { data: clients } = await admin
    .from('clients').select('id, logo_url').eq('user_id', workspaceUserId)
  const clientIds = (clients || []).map((c: any) => c.id)

  // Gather every storage path BEFORE deleting rows. Linked files first: they
  // cover service-role uploads (no owner) and files outside the workspace's folders.
  const paths: Record<string, string[]> = {
    'post-media': [], 'client-documents': [], 'proposal-files': [], 'note-media': [],
  }

  if (sub) {
    paths['post-media'].push(
      pathFromPublicUrl(sub.logo_url, 'post-media')!,
      pathFromPublicUrl(sub.logo_horizontal_url, 'post-media')!,
      pathFromPublicUrl(sub.signature_url, 'post-media')!,
    )
  }
  for (const c of clients || []) {
    const p = pathFromPublicUrl(c.logo_url, 'post-media')
    if (p) paths['post-media'].push(p)
  }
  if (clientIds.length) {
    const { data: versions } = await admin
      .from('post_versions')
      .select('media_urls, posts!post_versions_post_id_fkey!inner(client_id)')
      .in('posts.client_id', clientIds)
    for (const v of versions || []) {
      for (const url of v.media_urls || []) {
        const p = pathFromPublicUrl(url, 'post-media')
        if (p) paths['post-media'].push(p)
      }
    }
    const { data: docs } = await admin
      .from('client_documents').select('storage_path').in('client_id', clientIds)
    for (const d of docs || []) if (d.storage_path) paths['client-documents'].push(d.storage_path)
  }
  const { data: proposals } = await admin
    .from('proposals').select('file_url').eq('agency_user_id', workspaceUserId).not('file_url', 'is', null)
  for (const p of proposals || []) {
    const path = pathFromPublicUrl(p.file_url, 'proposal-files')
    if (path) paths['proposal-files'].push(path)
  }

  // Then every file uploaded by a deleted user or stored under the workspace's
  // folders, linked or not: avatars, replaced branding, note media, orphans (#68).
  const { data: objects, error: objectsErr } = await admin.rpc('workspace_purge_storage_objects', {
    p_workspace: workspaceUserId,
    p_uids: [workspaceUserId, ...deletedMemberIds],
  })
  if (objectsErr) throw objectsErr
  for (const o of objects || []) (paths[o.bucket_id] ??= []).push(o.name)

  for (const [bucket, list] of Object.entries(paths)) await removeInChunks(admin.storage, bucket, list)

  // Delete DB data. Clients cascade to every client-scoped descendant (deliverables,
  // invoices, documents, meetings, notes on a client). The rest is deleted by its
  // workspace column, so nothing still points at a member when their account goes:
  // tasks, notes and approval events reference users with NO ACTION.
  if (clientIds.length) await deleteRows(admin, 'clients', 'user_id', workspaceUserId)
  await deleteRows(admin, 'tasks', 'workspace_id', workspaceUserId) // cascades task_posts, task_activity
  await deleteRows(admin, 'notes', 'user_id', workspaceUserId) // cascades note_shares
  await deleteRows(admin, 'comments', 'workspace_id', workspaceUserId)
  await deleteRows(admin, 'notifications', 'workspace_id', workspaceUserId)
  await deleteRows(admin, 'approval_events', 'workspace_user_id', workspaceUserId)
  await deleteRows(admin, 'invoices', 'user_id', workspaceUserId)
  await deleteRows(admin, 'expenses', 'user_id', workspaceUserId)
  await deleteRows(admin, 'transactions', 'user_id', workspaceUserId)
  await deleteRows(admin, 'prospects', 'user_id', workspaceUserId)
  await deleteRows(admin, 'agency_invites', 'agency_user_id', workspaceUserId)
  await deleteRows(admin, 'user_feedback', 'workspace_user_id', workspaceUserId)
  await deleteRows(admin, 'admin_feedback', 'user_id', workspaceUserId)
  await deleteRows(admin, 'agency_member_job_roles', 'workspace_id', workspaceUserId)
  await deleteRows(admin, 'agency_job_roles', 'workspace_id', workspaceUserId)
  await deleteRows(admin, 'agency_members', 'agency_user_id', workspaceUserId)
  await deleteRows(admin, 'agency_subscriptions', 'user_id', workspaceUserId)

  // Delete auth accounts (cascading chat, campaigns, proposals and the like).
  for (const memberId of deletedMemberIds) {
    const { error } = await admin.auth.admin.deleteUser(memberId)
    if (error) console.error(`Failed to delete member auth ${memberId}:`, error.message)
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
