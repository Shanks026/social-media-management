import { supabase } from '@/lib/supabase'
import { resolveWorkspace } from '@/lib/workspace'

const BUCKET = 'note-media'
const MAX_BYTES = 50 * 1024 * 1024

export async function uploadNoteMedia(file, noteId) {
  if (file.size > MAX_BYTES) throw new Error('File must be under 50 MB')
  const { workspaceUserId } = await resolveWorkspace()
  const ext = file.name.split('.').pop()
  const path = `${workspaceUserId}/notes/${noteId}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  })
  if (error) throw error
  return path
}

export async function getSignedNoteMediaUrl(path) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600)
  if (error) throw error
  return data.signedUrl
}

export async function deleteNoteMedia(path) {
  const { error } = await supabase.storage.from(BUCKET).remove([path])
  if (error) throw error
}
