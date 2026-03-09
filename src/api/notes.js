import { supabase } from '@/lib/supabase'

export async function fetchClientNotes(clientId) {
  if (!clientId) throw new Error('Client ID is required')

  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData?.user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('client_notes')
    .select('*')
    .eq('user_id', userData.user.id)
    .eq('client_id', clientId)
    .order('status', { ascending: false })
    .order('due_at', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

// For the internal client workspace: includes notes explicitly assigned to the
// internal account AND legacy notes created before the workspace existed (client_id IS NULL).
export async function fetchInternalClientNotes(clientId) {
  if (!clientId) throw new Error('Client ID is required')

  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData?.user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('client_notes')
    .select('*')
    .eq('user_id', userData.user.id)
    .or(`client_id.eq.${clientId},client_id.is.null`)
    .order('status', { ascending: false })
    .order('due_at', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

export async function fetchAllNotes() {
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData?.user) {
    throw new Error('Not authenticated')
  }

  const { data, error } = await supabase
    .from('client_notes')
    .select('*')
    .eq('user_id', userData.user.id)
    .order('status', { ascending: false })
    .order('due_at', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

export async function fetchCampaignNotes(campaignId) {
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData?.user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('client_notes')
    .select('*')
    .eq('user_id', userData.user.id)
    .eq('campaign_id', campaignId)
    .order('status', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

export async function createNote(noteData) {
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData?.user) {
    throw new Error('Not authenticated')
  }

  const { data, error } = await supabase
    .from('client_notes')
    .insert([{ ...noteData, user_id: userData.user.id }])
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateNoteStatus(noteId, status) {
  const { data, error } = await supabase
    .from('client_notes')
    .update({ status })
    .eq('id', noteId)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateNote(noteId, updates) {
  const { data, error } = await supabase
    .from('client_notes')
    .update(updates)
    .eq('id', noteId)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteNote(noteId) {
  const { error } = await supabase
    .from('client_notes')
    .delete()
    .eq('id', noteId)

  if (error) throw error
  return true
}
