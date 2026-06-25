import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { resolveWorkspace } from '@/lib/workspace'

// Embed each note's tags via the junction; consumers should never see the
// PostgREST join alias (api-conventions.md). Flatten to a sorted `tags` array
// and drop the raw `note_tag_links` key.
const NOTE_SELECT = '*, note_tag_links ( note_tags ( id, name, color ) )'

function normalizeNote(row) {
  if (!row) return row
  const { note_tag_links, ...rest } = row
  const tags = (note_tag_links ?? [])
    .map((l) => l.note_tags)
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name))
  return { ...rest, tags }
}

export function useAgencyNotes() {
  const { workspaceUserId } = useAuth()
  return useQuery({
    queryKey: ['agency-notes', 'list', { userId: workspaceUserId }],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notes')
        .select(NOTE_SELECT)
        .eq('user_id', workspaceUserId)
        .order('updated_at', { ascending: false })
      if (error) throw error
      return data.map(normalizeNote)
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
        .select(NOTE_SELECT)
        .eq('id', noteId)
        .single()
      if (error) throw error
      return normalizeNote(data)
    },
    enabled: !!noteId,
    staleTime: 30000,
    retry: 1,
  })
}

export async function createAgencyNote({ title, body, client_id = null }) {
  const { user, workspaceUserId } = await resolveWorkspace()
  const meta = user.user_metadata ?? {}
  const { data, error } = await supabase
    .from('notes')
    .insert([{
      title,
      body: body || '',
      client_id,
      user_id: workspaceUserId,
      created_by: user.id,
      created_by_name: meta.full_name ?? meta.email ?? null,
    }])
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
