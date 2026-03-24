import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { resolveWorkspace } from '@/lib/workspace'

// ─── Query Keys ────────────────────────────────────────────────────────────────

export const documentKeys = {
  list: (filters) => ['documents', 'list', filters ?? {}],
  detail: (id) => ['documents', 'detail', id],
  collections: (clientId) => ['document-collections', clientId],
  allCollections: () => ['document-collections', 'all'],
}

// ─── Read Hooks ────────────────────────────────────────────────────────────────

/**
 * Fetch documents. Optionally filtered by clientId, prospectId, category, status.
 * When no clientId or prospectId is provided, returns all documents for the user.
 */
export function useDocuments({ clientId, prospectId, category, status } = {}) {
  const { workspaceUserId } = useAuth()

  return useQuery({
    queryKey: documentKeys.list({ clientId, prospectId, category, status }),
    queryFn: async () => {
      let query = supabase
        .from('client_documents')
        .select('*, clients(name, is_internal, logo_url), prospects(business_name)')
        .eq('user_id', workspaceUserId)
        .order('created_at', { ascending: false })

      if (clientId) query = query.eq('client_id', clientId)
      if (prospectId) query = query.eq('prospect_id', prospectId)
      if (category) query = query.eq('category', category)
      if (status) query = query.eq('status', status)

      const { data, error } = await query
      if (error) throw error
      return data
    },
    enabled: !!workspaceUserId,
  })
}

/**
 * Fetch a single document by ID.
 */
export function useDocument(id) {
  const { workspaceUserId } = useAuth()

  return useQuery({
    queryKey: documentKeys.detail(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_documents')
        .select('*, clients(name, is_internal, logo_url)')
        .eq('id', id)
        .eq('user_id', workspaceUserId)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!id && !!workspaceUserId,
  })
}

// ─── Signed URL ────────────────────────────────────────────────────────────────

/**
 * Generate a 60-minute signed URL for a storage path.
 */
export async function getDocumentSignedUrl(storagePath) {
  const { data, error } = await supabase.storage
    .from('client-documents')
    .createSignedUrl(storagePath, 3600)
  if (error) throw error
  return data.signedUrl
}

// ─── Mutations ─────────────────────────────────────────────────────────────────

/**
 * Upload a file to storage and insert a metadata row.
 * Rolls back the storage upload if the DB insert fails.
 */
function sanitizeFilename(name) {
  // Strip emoji and non-ASCII, collapse spaces/unsafe chars to underscores
  return name
    .replace(/[^\x00-\x7F]/g, '')   // remove non-ASCII (emoji, accented chars, etc.)
    .replace(/[^a-zA-Z0-9._-]/g, '_') // replace remaining unsafe chars
    .replace(/_+/g, '_')              // collapse multiple underscores
    .replace(/^_|_$/g, '')            // trim leading/trailing underscores
    || 'file'                          // fallback if everything was stripped
}

export async function uploadDocument({ clientId, prospectId, file, displayName, category, collectionId, notes }) {
  const { workspaceUserId } = await resolveWorkspace()
  const documentId = crypto.randomUUID()
  const safeFilename = sanitizeFilename(file.name)

  // Scope storage path to client or prospect context
  const storagePath = prospectId
    ? `${workspaceUserId}/prospects/${prospectId}/${documentId}/${safeFilename}`
    : `${workspaceUserId}/${clientId}/${documentId}/${safeFilename}`

  // 1. Upload to storage
  const { error: uploadError } = await supabase.storage
    .from('client-documents')
    .upload(storagePath, file)
  if (uploadError) throw uploadError

  // 2. Insert metadata row
  const { data, error: insertError } = await supabase
    .from('client_documents')
    .insert({
      user_id: workspaceUserId,
      ...(clientId ? { client_id: clientId } : {}),
      ...(prospectId ? { prospect_id: prospectId } : {}),
      display_name: displayName,
      original_filename: file.name,
      storage_path: storagePath,
      file_size_bytes: file.size,
      mime_type: file.type || 'application/octet-stream',
      category: category || 'Other',
      ...(notes ? { notes } : {}),
      ...(collectionId ? { collection_id: collectionId } : {}),
    })
    .select()
    .single()

  if (insertError) {
    // Rollback storage upload
    await supabase.storage.from('client-documents').remove([storagePath])
    throw insertError
  }

  // 3. Update agency storage usage
  await supabase.rpc('increment_storage_used', {
    p_user_id: workspaceUserId,
    p_bytes: file.size,
  }).throwOnError()

  return data
}

/**
 * Update document display name, category, and/or collection.
 * Pass collectionId = null to remove from collection (ungrouped).
 */
export async function updateDocument(id, { displayName, category, collectionId, notes }) {
  const payload = {}
  if (displayName !== undefined) payload.display_name = displayName
  if (category !== undefined) payload.category = category
  if (collectionId !== undefined) payload.collection_id = collectionId ?? null
  if (notes !== undefined) payload.notes = notes || null
  payload.updated_at = new Date().toISOString()

  const { data, error } = await supabase
    .from('client_documents')
    .update(payload)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

/**
 * Archive a document (set status = 'Archived').
 */
export async function archiveDocument(id) {
  const { data, error } = await supabase
    .from('client_documents')
    .update({ status: 'Archived', updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

/**
 * Restore an archived document back to Active.
 */
export async function unarchiveDocument(id) {
  const { data, error } = await supabase
    .from('client_documents')
    .update({ status: 'Active', updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

/**
 * Move a document into a collection, or remove it from its current collection.
 * Pass collectionId = null to make the document ungrouped.
 */
export async function moveDocumentToCollection(documentId, collectionId) {
  const { error } = await supabase
    .from('client_documents')
    .update({
      collection_id: collectionId ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', documentId)
  if (error) throw error
}

/**
 * Delete a document from storage and remove its metadata row.
 */
export async function deleteDocument({ id, storagePath, fileSizeBytes, userId }) {
  // 1. Delete from storage
  const { error: storageError } = await supabase.storage
    .from('client-documents')
    .remove([storagePath])
  if (storageError) throw storageError

  // 2. Delete metadata row
  const { error: dbError } = await supabase
    .from('client_documents')
    .delete()
    .eq('id', id)
  if (dbError) throw dbError

  // 3. Decrement agency storage usage
  await supabase.rpc('decrement_storage_used', {
    p_user_id: userId,
    p_bytes: fileSizeBytes,
  }).throwOnError()
}

// ─── Collections ───────────────────────────────────────────────────────────────

/**
 * Fetch all collections across all clients for the current user.
 * Includes a clients join so callers can group by client name.
 */
export function useAllCollections() {
  const { workspaceUserId } = useAuth()

  return useQuery({
    queryKey: documentKeys.allCollections(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('document_collections')
        .select('*, clients(id, name, logo_url)')
        .eq('user_id', workspaceUserId)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data
    },
    enabled: !!workspaceUserId,
  })
}

/**
 * Fetch all collections for a specific client.
 */
export function useCollections(clientId) {
  const { workspaceUserId } = useAuth()

  return useQuery({
    queryKey: documentKeys.collections(clientId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('document_collections')
        .select('*')
        .eq('client_id', clientId)
        .eq('user_id', workspaceUserId)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data
    },
    enabled: !!clientId && !!workspaceUserId,
  })
}

/**
 * Create a new collection for a client.
 */
export async function createCollection({ clientId, name, description }) {
  const { workspaceUserId } = await resolveWorkspace()
  const { data, error } = await supabase
    .from('document_collections')
    .insert({
      user_id: workspaceUserId,
      client_id: clientId,
      name,
      description: description || null,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

/**
 * Rename a collection or update its description.
 */
export async function updateCollection(id, { name, description }) {
  const payload = { updated_at: new Date().toISOString() }
  if (name !== undefined) payload.name = name
  if (description !== undefined) payload.description = description ?? null

  const { data, error } = await supabase
    .from('document_collections')
    .update(payload)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

/**
 * Delete a collection. Documents inside become ungrouped (collection_id → null).
 */
export async function deleteCollection(id) {
  const { error } = await supabase
    .from('document_collections')
    .delete()
    .eq('id', id)
  if (error) throw error
}
