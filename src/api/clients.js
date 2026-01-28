import { supabase } from '@/lib/supabase'

/**
 * Fetch all clients for the current authenticated user
 */
/**
 * Fetch all clients for the current authenticated user with Pipeline Analytics
 */
// src/api/clients.js

export async function fetchClients() {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('Not authenticated')

  const { data, error } = await supabase.rpc('get_clients_with_pipeline', {
    p_user_id: user.id,
  })

  if (error) throw error

  return data.map((client) => ({
    id: client.id,
    name: client.name,
    status: client.status,
    logo_url: client.logo_url,
    tier: client.tier,
    industry: client.industry, // Ensure industry is passed
    platforms: client.platforms || [], // Extract platforms here
    created_at: client.created_at,
    pipeline: {
      drafts: Number(client.drafts),
      pending: Number(client.pending),
      revisions: Number(client.revisions),
      scheduled: Number(client.scheduled),
      next_post_at: client.next_post_at,
    },
  }))
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
