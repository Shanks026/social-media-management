import { supabase } from '@/lib/supabase'

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
 * Fetch all clients with pipeline analytics
 */
export async function fetchClients(filters = {}) {
  const {
    search = '',
    industry = 'all',
    tier = 'all',
    urgency = 'all',
  } = filters

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase.rpc('get_clients_with_pipeline', {
    p_user_id: user.id,
    p_search: search,
    p_industry: industry,
    p_tier: tier,
    p_urgency: urgency,
  })

  if (error) throw error

  const clients = (data.clients || []).map((c) => ({
    id: c.id,
    name: c.name,
    status: c.status,
    logo_url: c.logo_url,
    tier: c.tier,
    industry: c.industry,
    is_internal: c.is_internal,
    platforms: c.platforms || [],
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
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('clients')
    .insert({
      ...payload,
      user_id: user.id,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Update a client
 */
export async function updateClient({ id, ...updates }) {
  const { error } = await supabase.from('clients').update(updates).eq('id', id)
  if (error) throw error
}

/**
 * Delete a client, their history, and all associated media
 */
export async function deleteClient(clientId) {
  try {
    // 1. Fetch the Client's logo_url directly
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('logo_url')
      .eq('id', clientId)
      .single()

    if (clientError) throw clientError

    // 2. Fetch all media URLs from all post versions for this client
    const { data: versions, error: fetchError } = await supabase
      .from('post_versions')
      .select(
        `
        media_urls, 
        posts!post_versions_post_id_fkey!inner(client_id)
      `,
      )
      .eq('posts.client_id', clientId)

    if (fetchError) throw fetchError

    // 3. Collect ALL URLs into a single array
    const allUrls = versions?.flatMap((v) => v.media_urls || []) || []

    // Add the logo_url to the deletion queue if it exists
    if (client.logo_url) {
      allUrls.push(client.logo_url)
    }

    // 4. Convert URLs to unique storage paths
    const uniquePaths = [...new Set(allUrls.map(getPathFromUrl))].filter(
      Boolean,
    )

    // 5. Cleanup Storage Bucket (branding/ folder and post assets)
    if (uniquePaths.length > 0) {
      const { error: storageError } = await supabase.storage
        .from('post-media')
        .remove(uniquePaths)

      if (storageError) {
        console.error(
          'Storage cleanup failed during client deletion:',
          storageError,
        )
      } else {
        console.log(
          `Successfully removed ${uniquePaths.length} assets from storage.`,
        )
      }
    }

    // 6. Delete Client row (Cascade handles posts and versions)
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
 * Fetch single client by ID
 */
export async function fetchClientById(id) {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}
