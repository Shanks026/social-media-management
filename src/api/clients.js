import { supabase } from '@/lib/supabase'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/context/AuthContext'
import { resolveWorkspace } from '@/lib/workspace'
import { getUrgencyStatus } from '@/lib/client-helpers'

export function useClients() {
  const { workspaceUserId } = useAuth()
  return useQuery({
    queryKey: ['clients-list', workspaceUserId],
    queryFn: async () => {
      if (!workspaceUserId) return { internalAccount: null, realClients: [] }

      const { data, error } = await supabase
        .from('clients')
        .select('id, name, logo_url, is_internal, email')
        .eq('user_id', workspaceUserId)

      if (error) throw error

      return {
        internalAccount: data?.find((c) => c.is_internal) || null,
        realClients: data?.filter((c) => !c.is_internal) || [],
      }
    },
    enabled: !!workspaceUserId,
  })
}

/**
 * HELPER: Extracts the storage path from a public URL
 */
const getPathFromUrl = (url) => {
  if (!url) return null
  // Pattern: .../public/post-media/FOLDER/FILE
  const bucketSegment = '/public/post-media/'
  return url.includes(bucketSegment) ? url.split(bucketSegment)[1] : null
}

/**
 * Returns clients whose next_post_at is overdue or urgent (< 24h).
 * Shares the same query cache as ClientHealthGrid.
 */
export function useUrgentClients() {
  return useQuery({
    queryKey: ['clients-pipeline-dashboard'],
    queryFn: () => fetchClients(),
    staleTime: 30000,
    select: (data) =>
      (data?.clients ?? [])
        .filter((c) => !c.is_internal)
        .filter((c) => {
          const urgency = getUrgencyStatus(c.pipeline?.next_post_at)
          return urgency?.label === 'Overdue' || urgency?.label === 'Urgent'
        })
        .map((c) => ({ id: c.id, name: c.name, logo_url: c.logo_url, next_post_at: c.pipeline.next_post_at })),
  })
}

/**
 * Fetch all clients with pipeline analytics
 */
export async function fetchClients(filters = {}) {
  const {
    search = '',
    industry = 'all',
    tier = 'all',
    urgency = 'all',
    status = 'ACTIVE',
  } = filters

  const { workspaceUserId } = await resolveWorkspace()

  const { data, error } = await supabase.rpc('get_clients_with_pipeline', {
    p_user_id: workspaceUserId,
    p_search: search,
    p_industry: industry,
    p_tier: tier,
    p_urgency: urgency,
    p_status: status,
  })

  if (error) throw error

  const clients = (data.clients || []).map((c) => ({
    id: c.id,
    name: c.name,
    status: c.status,
    client_type: c.client_type ?? null,
    logo_url: c.logo_url,
    tier: c.tier,
    industry: c.industry,
    is_internal: c.is_internal,
    platforms: c.platforms || [],
    active_campaigns: Number(c.active_campaigns ?? 0),
    avg_monthly_retainer: Number(c.avg_monthly_retainer ?? 0),
    profit_margin: c.profit_margin != null ? Number(c.profit_margin) : null,
    created_at: c.created_at,
    pipeline: {
      drafts: Number(c.drafts),
      pending: Number(c.pending),
      revisions: Number(c.revisions),
      scheduled: Number(c.scheduled),
      next_post_at: c.next_scheduled,
    },
  }))

  return {
    clients,
    counts: data.counts || { all: 0, urgent: 0, upcoming: 0, idle: 0 },
  }
}

/**
 * Create a client
 */
export async function createClient(payload) {
  const { workspaceUserId } = await resolveWorkspace()

  const { data, error } = await supabase
    .from('clients')
    .insert({
      ...payload,
      user_id: workspaceUserId,
    })
    .select()
    .single()

  if (error) throw error

  // Trigger welcome email
  try {
    const { error: fnError } = await supabase.functions.invoke('send-client-welcome', {
      body: { record: data },
    })
    if (fnError) console.error('[send-client-welcome] failed:', fnError)
  } catch (err) {
    console.error('[send-client-welcome] error:', err)
  }

  return data
}

/**
 * Update a client
 */
export const updateClient = async (id, data) => {
  const { data: result, error } = await supabase
    .from('clients')
    .update(data) // 'data' must be a plain object { name: '...', ... }
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return result
}
/**
 * Update a client's status (ACTIVE, PAUSED, ARCHIVED)
 */
export async function updateClientStatus(clientId, status) {
  const { error } = await supabase
    .from('clients')
    .update({ status })
    .eq('id', clientId)
  if (error) throw error
}

/**
 * Delete a client and all associated data and storage files.
 * DB cascade handles: posts, post_versions, campaigns, meetings, notes,
 *   invoices, recurring_invoices, client_documents, document_collections,
 *   proposals, approvals, schedules, client_users.
 * Transactions/expenses keep their rows but client_id is set to NULL.
 * This function additionally cleans up storage files before deletion.
 */
export async function deleteClient(clientId) {
  try {
    const { workspaceUserId } = await resolveWorkspace()

    // 1. Fetch the client logo URL
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('logo_url')
      .eq('id', clientId)
      .single()

    if (clientError) throw clientError

    // 2. Fetch all post-media URLs from every post version for this client
    const { data: versions, error: fetchError } = await supabase
      .from('post_versions')
      .select('media_urls, posts!post_versions_post_id_fkey!inner(client_id)')
      .eq('posts.client_id', clientId)

    if (fetchError) throw fetchError

    // 3. Fetch all document storage paths and sizes for this client
    const { data: docs, error: docsError } = await supabase
      .from('client_documents')
      .select('storage_path, file_size_bytes')
      .eq('client_id', clientId)

    if (docsError) throw docsError

    // 4. Build post-media storage paths
    const postMediaUrls = versions?.flatMap((v) => v.media_urls || []) || []
    if (client.logo_url) postMediaUrls.push(client.logo_url)

    const postMediaPaths = [...new Set(postMediaUrls.map(getPathFromUrl))].filter(Boolean)

    // 5. Build document storage paths and total size
    const documentPaths = (docs || []).map((d) => d.storage_path).filter(Boolean)
    const totalDocBytes = (docs || []).reduce((sum, d) => sum + (d.file_size_bytes || 0), 0)

    // 6. Delete post-media files
    if (postMediaPaths.length > 0) {
      const { error: storageError } = await supabase.storage
        .from('post-media')
        .remove(postMediaPaths)

      if (storageError) {
        console.error('post-media cleanup failed during client deletion:', storageError)
      } else {
        console.log(`Removed ${postMediaPaths.length} post-media files.`)
      }
    }

    // 7. Delete document files and decrement storage counter
    if (documentPaths.length > 0) {
      const { error: docStorageError } = await supabase.storage
        .from('client-documents')
        .remove(documentPaths)

      if (docStorageError) {
        console.error('client-documents cleanup failed during client deletion:', docStorageError)
      } else {
        console.log(`Removed ${documentPaths.length} document files.`)
      }
    }

    // Decrement storage counter for all deleted documents (even if storage removal errored,
    // the DB rows will be cascade-deleted so the bytes are gone from the user's perspective)
    if (totalDocBytes > 0) {
      await supabase.rpc('decrement_storage_used', {
        p_user_id: workspaceUserId,
        p_bytes: totalDocBytes,
      }).throwOnError()
    }

    // 8. Delete the client row — DB cascade handles all child records
    const { error: dbError } = await supabase
      .from('clients')
      .delete()
      .eq('id', clientId)

    if (dbError) throw dbError
  } catch (error) {
    console.error('Full Client Delete Error:', error)
    throw error
  }
}

/**
 * Fetch single client by ID, including computed financial metrics
 */
export async function fetchClientById(id) {
  const [{ data, error }, { data: txData, error: txError }] = await Promise.all([
    supabase.from('clients').select('*').eq('id', id).single(),
    supabase
      .from('transactions')
      .select('type, status, category, amount')
      .eq('client_id', id)
      .eq('status', 'PAID'),
  ])

  if (error) throw error
  if (txError) throw txError

  const paidIncome = (txData || [])
    .filter((t) => t.type === 'INCOME')
    .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0)

  const paidExpenses = (txData || [])
    .filter((t) => t.type === 'EXPENSE')
    .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0)

  const retainerIncome = (txData || [])
    .filter((t) => t.type === 'INCOME' && t.category?.toLowerCase().includes('retainer'))
    .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0)

  const monthsActive = Math.max(
    (Date.now() - new Date(data.created_at).getTime()) / (30.44 * 24 * 60 * 60 * 1000),
    1,
  )

  const avg_monthly_retainer = Math.round((retainerIncome / monthsActive) * 100) / 100
  const profit_margin =
    paidIncome > 0
      ? Math.round(((paidIncome - paidExpenses) / paidIncome) * 1000) / 10
      : null

  return { ...data, avg_monthly_retainer, profit_margin }
}

export async function fetchInternalClient() {
  const { workspaceUserId } = await resolveWorkspace()

  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('user_id', workspaceUserId)
    .eq('is_internal', true)
    .maybeSingle()

  if (error) throw error
  return data
}
