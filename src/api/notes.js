import { supabase } from '@/lib/supabase'

export async function fetchClientNotes(clientId) {
  if (!clientId) throw new Error('Client ID is required')

  const { data, error } = await supabase
    .from('client_notes')
    .select('*')
    .eq('client_id', clientId)
    .order('status', { ascending: false }) // 'TODO' comes before 'DONE', 'ARCHIVED'
    .order('due_at', { ascending: true, nullsFirst: false })
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
