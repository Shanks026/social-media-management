import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { resolveWorkspace } from '@/lib/workspace'

export const noteShareKeys = {
  list: (noteId) => ['note-shares', 'list', noteId],
}

export function useNoteShares(noteId) {
  return useQuery({
    queryKey: noteShareKeys.list(noteId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('note_shares')
        .select('*')
        .eq('note_id', noteId)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data
    },
    enabled: !!noteId,
  })
}

export async function shareNote({ noteId, memberUserId, permission = 'read' }) {
  return shareNoteWithMany({ noteId, memberUserIds: [memberUserId], permission })
}

/** Share a note with several teammates at once (single insert + visibility update). */
export async function shareNoteWithMany({ noteId, memberUserIds, permission = 'read' }) {
  const { user } = await resolveWorkspace()
  const { data, error } = await supabase
    .from('note_shares')
    .insert(
      memberUserIds.map((memberUserId) => ({
        note_id: noteId,
        member_user_id: memberUserId,
        permission,
        invited_by: user.id,
      })),
    )
    .select()
  if (error) throw error

  const { error: visError } = await supabase
    .from('notes')
    .update({ visibility: 'shared' })
    .eq('id', noteId)
  if (visError) throw visError

  return data
}

export async function updateNoteSharePermission(shareId, permission) {
  const { data, error } = await supabase
    .from('note_shares')
    .update({ permission })
    .eq('id', shareId)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function removeNoteShare(shareId) {
  const { error } = await supabase.from('note_shares').delete().eq('id', shareId)
  if (error) throw error
  return true
}
