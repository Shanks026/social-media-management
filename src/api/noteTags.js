import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { resolveWorkspace } from '@/lib/workspace'

// ─── Reads ───────────────────────────────────────────────────────────────────

export function useNoteTags() {
  const { workspaceUserId } = useAuth()
  return useQuery({
    queryKey: ['note-tags', 'list', { userId: workspaceUserId }],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('note_tags')
        .select('id, name, color, created_at')
        .eq('user_id', workspaceUserId)
        .order('name', { ascending: true })
      if (error) throw error
      return data
    },
    enabled: !!workspaceUserId,
    staleTime: 30000,
    retry: 1,
  })
}

// ─── Mutations ─────────────────────────────────────────────────────────────────

export async function createNoteTag({ name, color }) {
  const { workspaceUserId } = await resolveWorkspace()
  const { data, error } = await supabase
    .from('note_tags')
    .insert([{ name: name.trim(), color, user_id: workspaceUserId }])
    .select('id, name, color, created_at')
    .single()
  if (error) throw error
  return data
}

export async function addTagToNote(noteId, tagId) {
  const { error } = await supabase
    .from('note_tag_links')
    .upsert([{ note_id: noteId, tag_id: tagId }], {
      onConflict: 'note_id,tag_id',
      ignoreDuplicates: true,
    })
  if (error) throw error
  return true
}

export async function removeTagFromNote(noteId, tagId) {
  const { error } = await supabase
    .from('note_tag_links')
    .delete()
    .eq('note_id', noteId)
    .eq('tag_id', tagId)
  if (error) throw error
  return true
}

export async function updateNoteTag(id, { name, color }) {
  const payload = {}
  if (name !== undefined) payload.name = name.trim()
  if (color !== undefined) payload.color = color
  const { data, error } = await supabase
    .from('note_tags')
    .update(payload)
    .eq('id', id)
    .select('id, name, color, created_at')
    .single()
  if (error) throw error
  return data
}

export async function deleteNoteTag(id) {
  const { error } = await supabase.from('note_tags').delete().eq('id', id)
  if (error) throw error
  return true
}
