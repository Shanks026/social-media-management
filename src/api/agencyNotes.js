import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { resolveWorkspace } from '@/lib/workspace'

export function useAgencyNotes() {
  const { workspaceUserId } = useAuth()
  return useQuery({
    queryKey: ['agency-notes', 'list', { userId: workspaceUserId }],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('user_id', workspaceUserId)
        .order('updated_at', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!workspaceUserId,
    staleTime: 30000,
    retry: 1,
  })
}

export function useAgencyNoteById(noteId) {
  return useQuery({
    queryKey: ['agency-notes', 'detail', noteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('id', noteId)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!noteId,
    staleTime: 30000,
    retry: 1,
  })
}

export async function createAgencyNote({ title, body, client_id = null }) {
  const { workspaceUserId } = await resolveWorkspace()
  const { data, error } = await supabase
    .from('notes')
    .insert([{ title, body: body || '', client_id, user_id: workspaceUserId }])
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateAgencyNote(noteId, updates) {
  const { data, error } = await supabase
    .from('notes')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', noteId)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteAgencyNote(noteId) {
  const { error } = await supabase.from('notes').delete().eq('id', noteId)
  if (error) throw error
  return true
}
