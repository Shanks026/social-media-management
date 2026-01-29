import { supabase } from '@/lib/supabase'

/**
 * Fetch all clients for the current authenticated user
 */
/**
 * Fetch all clients for the current authenticated user with Pipeline Analytics
 */
// src/api/clients.js

// src/api/clients.js

// src/api/clients.js

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

  // Supabase automatically parses JSONB returns into a JS object
  const { data, error } = await supabase.rpc('get_clients_with_pipeline', {
    p_user_id: user.id,
    p_search: search,
    p_industry: industry,
    p_tier: tier,
    p_urgency: urgency,
  })

  if (error) throw error

  // 'data' is now { clients: [...], counts: {...} }
  const clients = (data.clients || []).map((c) => ({
    id: c.id,
    name: c.name,
    status: c.status,
    logo_url: c.logo_url,
    tier: c.tier,
    industry: c.industry,
    platforms: c.platforms || [],
    created_at: c.created_at,
    pipeline: {
      drafts: Number(c.drafts),
      pending: Number(c.pending),
      revisions: Number(c.revisions),
      scheduled: Number(c.scheduled),
      next_post_at: c.next_scheduled, // Note: Column name is next_scheduled in this RPC version
    },
  }))

  return {
    clients,
    counts: data.counts || { all: 0, urgent: 0, upcoming: 0, idle: 0 },
  }
}
/**
 * Create a client owned by the current authenticated user
 * Payload now includes logo_url from the form
 */
export async function createClient(payload) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new Error('Not authenticated')
  }

  const { error } = await supabase.from('clients').insert({
    ...payload,
    user_id: user.id,
  })

  if (error) throw error
}

/**
 * Update a client (RLS ensures ownership)
 */
export async function updateClient({ id, ...updates }) {
  const { error } = await supabase.from('clients').update(updates).eq('id', id)

  if (error) throw error
}

/**
 * Delete a client (RLS ensures ownership)
 */
export async function deleteClient(id) {
  const { error } = await supabase.from('clients').delete().eq('id', id)

  if (error) throw error
}

/**
 * Fetch a single client by ID (RLS ensures ownership)
 */
export async function fetchClientById(id) {
  const { data, error } = await supabase
    .from('clients')
    .select('*') // Captures logo_url automatically
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}
