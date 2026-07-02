import { supabase } from '@/lib/supabase'
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns'
import { resolveWorkspace } from '@/lib/workspace'

/**
 * Fetches all posts for a client, joining the current version data.
 */
export async function fetchAllPostsByClient(clientId) {
  const { data, error } = await supabase
    .from('posts')
    .select(
      `
      id,
      client_id,
      campaign_id,
      campaigns ( name ),
      post_versions!fk_current_version (
        id,
        title,
        content,
        media_urls,
        platform,
        status,
        version_number,
        created_at,
        updated_at,
        published_at,
        target_date,
        admin_notes,
        platform_schedules,
        deliverable_type,
        created_by
      )
    `,
    )
    .eq('client_id', clientId)

  if (error) throw error

  return data.map((post) => {
    // Note: post.post_versions will be a single object, not an array,
    // because fk_current_version is a many-to-one relationship.
    const latest = post.post_versions || {}
    return {
      ...latest,
      platforms: latest.platform || [],
      id: post.id,
      version_id: latest.id,
      actual_post_id: post.id,
      client_id: post.client_id,
      display_date: latest.created_at || new Date().toISOString(),
      campaign_id: post.campaign_id,
      campaign_name: post.campaigns?.name,
      created_by: latest.created_by || null,
    }
  })
}

/**
 * HELPER: Extracts the storage path from a public URL
 * Use this to ensure we are sending the correct path to .remove()
 */
const getPathFromUrl = (url) => {
  if (!url) return null
  const bucketSegment = '/public/post-media/'
  if (url.includes(bucketSegment)) {
    return url.split(bucketSegment)[1]
  }
  return null
}

// Queries the storage API for a file's byte size before deletion
const getFileSize = async (path) => {
  const parts = path.split('/')
  const folder = parts.slice(0, -1).join('/')
  const filename = parts[parts.length - 1]
  const { data } = await supabase.storage
    .from('post-media')
    .list(folder, { search: filename })
  return data?.[0]?.metadata?.size ?? 0
}

/**
 * Fetches details for a post, joining client branding data.
 */
export async function fetchPostDetails(id) {
  // 1. Try to fetch assuming 'id' is a Parent Post ID
  const { data: parentData } = await supabase
    .from('posts')
    .select(
      `
      id,
      client_id,
      clients ( name, logo_url, email, social_links, industry, is_internal ),
      post_versions!fk_current_version (
        *,
        share_tokens (token, is_active)
      )
    `,
    )
    .eq('id', id)
    .maybeSingle()

  if (parentData?.post_versions) {
    return {
      ...parentData.post_versions,
      platforms: parentData.post_versions.platform || [],
      actual_post_id: parentData.id,
      clients: parentData.clients,
    }
  }

  // 2. FALLBACK: Try to fetch assuming 'id' is a Version ID
  const { data: versionData, error } = await supabase
    .from('post_versions')
    .select(
      `
      *,
      share_tokens (token, is_active),
      posts!post_versions_post_id_fkey (
        id,
        client_id,
        clients ( name, logo_url, email, social_links, industry, is_internal )
      )
    `,
    )
    .eq('id', id)
    .maybeSingle()

  if (error) throw error

  if (versionData) {
    return {
      ...versionData,
      platforms: versionData.platform || [],
      actual_post_id: versionData.posts.id,
      clients: versionData.posts.clients,
    }
  }

  throw new Error('Post or Version not found')
}

export async function createDraftPost({
  clientId,
  content, // Coming from form.content
  mediaUrls, // If they are already uploaded
  platforms,
  title,
  target_date,
  adminNotes,
  userId,
  platformSchedules,
  campaignId,
  deliverableType,
}) {
  const { error } = await supabase.rpc('create_post_draft_v3', {
    p_client_id: clientId,
    p_title: title,
    p_content: content, // This maps to "content" in your response
    p_media_urls: mediaUrls || [],
    p_platform: platforms || [],
    p_user_id: userId,
    p_target_date: target_date ?? null,
    p_admin_notes: adminNotes || null,
    p_platform_schedules: platformSchedules ?? null,
    p_campaign_id: campaignId ?? null,
    p_deliverable_type: deliverableType ?? null,
  })

  if (error) throw error
}

/**
 * Deletes a post AND all its associated media from storage
 */
// api/posts.js

export const deletePost = async (postId) => {
  try {
    const { data: versions, error: fetchError } = await supabase
      .from('post_versions')
      .select('media_urls')
      .eq('post_id', postId)

    if (fetchError) throw fetchError

    const allUrls = versions.flatMap((v) => v.media_urls || [])
    const uniquePaths = [...new Set(allUrls.map(getPathFromUrl))].filter(
      Boolean,
    )

    console.log('Attempting to delete these paths from bucket:', uniquePaths)

    // api/posts.js -> inside deletePost function
    if (uniquePaths.length > 0) {
      // Get total size for storage tracking before deletion
      let totalBytes = 0
      try {
        const sizes = await Promise.all(uniquePaths.map(getFileSize))
        totalBytes = sizes.reduce((sum, s) => sum + s, 0)
      } catch {
        // non-fatal
      }

      const { error: storageError } = await supabase.storage
        .from('post-media')
        .remove(uniquePaths)

      if (storageError) {
        console.error('Storage cleanup failed:', storageError)
        throw storageError
      }

      if (totalBytes > 0) {
        try {
          const { workspaceUserId } = await resolveWorkspace()
          await supabase.rpc('decrement_storage_used', {
            p_user_id: workspaceUserId,
            p_bytes: totalBytes,
          })
        } catch {
          // non-fatal
        }
      }
    }

    const { data: dbData, error: dbError } = await supabase
      .from('posts')
      .delete()
      .eq('id', postId)
      .select()

    if (dbError) throw dbError
    return dbData
  } catch (error) {
    console.error('Detailed Delete Error:', error)
    throw error
  }
}

export async function updatePost(
  versionId,
  { title, content, mediaUrls, platforms, target_date, admin_notes, platformSchedules, campaignId, postId, deliverableType },
) {
  const { data, error } = await supabase
    .from('post_versions')
    .update({
      title,
      content,
      media_urls: mediaUrls,
      platform: platforms,
      target_date: target_date ?? null,
      admin_notes: admin_notes,
      platform_schedules: platformSchedules ?? null,
      deliverable_type: deliverableType ?? null,
    })
    .eq('id', versionId)
    .in('status', ['DRAFT', 'PENDING_APPROVAL', 'CHANGES_REQUESTED'])
    .select()

  if (error) throw error

  if (data?.length === 0) {
    throw new Error('Update failed: Only editable posts can be modified.')
  }

  // Update campaign_id on the posts row when postId is provided
  if (postId !== undefined && campaignId !== undefined) {
    const { error: postError } = await supabase
      .from('posts')
      .update({ campaign_id: campaignId || null })
      .eq('id', postId)
    if (postError) throw postError
  }

  return data
}

export async function markPostDelivered(versionId, deliveryNote) {
  const patch = { status: 'DELIVERED' }
  if (deliveryNote?.trim()) patch.admin_notes = deliveryNote.trim()

  const { error } = await supabase
    .from('post_versions')
    .update(patch)
    .eq('id', versionId)
    .eq('status', 'APPROVED')

  if (error) throw error
}

export async function createRevision(versionId, userId, adminNotes) {
  // Ensure we are passing exactly what the Postgres function expects
  const { data, error } = await supabase.rpc('create_revision_version', {
    p_parent_version_id: versionId,
    p_user_id: userId,
    p_admin_notes: adminNotes || '', // Fallback to empty string if null
  })

  if (error) {
    console.error('RPC Error Details:', error)
    throw error
  }
  return data // This should return the UUID of the new version
}
/**
 * Manual revision helper
 * Follows custom instruction: Parent version status -> 'ARCHIVED'
 */
export const createPostRevision = async (
  parentPostId,
  previousVersionId,
  newVersionData,
) => {
  const { data: newVersion, error: insertError } = await supabase
    .from('post_versions')
    .insert([
      {
        ...newVersionData,
        post_id: parentPostId,
        status: 'DRAFT',
        version_number: (newVersionData.version_number || 1) + 1,
      },
    ])
    .select()
    .single()

  if (insertError) throw insertError

  // [2026-01-25] Requirement: Move parent version's status to 'ARCHIVED'
  await supabase
    .from('post_versions')
    .update({ status: 'ARCHIVED' })
    .eq('id', previousVersionId)

  // Update parent using the physical column name
  await supabase
    .from('posts')
    .update({ current_version_id: newVersion.id })
    .eq('id', parentPostId)

  return newVersion
}

// api/posts.js

/**
 * Removes a single image from a post version and deletes it from storage.
 */
export async function deleteIndividualMedia(
  versionId,
  urlToDelete,
  currentMediaUrls,
) {
  const path = getPathFromUrl(urlToDelete)
  if (!path) throw new Error('Invalid media path')

  // 1. Update the Database for THIS version first
  const updatedUrls = currentMediaUrls.filter((url) => url !== urlToDelete)
  const { error: dbError } = await supabase
    .from('post_versions')
    .update({ media_urls: updatedUrls })
    .eq('id', versionId)

  if (dbError) throw dbError

  // 2. CHECK: Is any other version of this post (or any other post) still using this URL?
  const { count } = await supabase
    .from('post_versions')
    .select('*', { count: 'exact', head: true })
    .contains('media_urls', [urlToDelete])

  // 3. Only delete from storage if count is 0 (no other version references it)
  if (count === 0) {
    let sizeBytes = 0
    try {
      sizeBytes = await getFileSize(path)
    } catch {
      // non-fatal
    }

    const { error: storageError } = await supabase.storage
      .from('post-media')
      .remove([path])

    if (storageError) console.error('Storage cleanup failed:', storageError)

    if (sizeBytes > 0) {
      try {
        const { workspaceUserId } = await resolveWorkspace()
        await supabase.rpc('decrement_storage_used', {
          p_user_id: workspaceUserId,
          p_bytes: sizeBytes,
        })
      } catch {
        // non-fatal
      }
    }
  }

  return updatedUrls
}

/**
 * Called from DraftPostForm (edit mode) before updatePost.
 * Checks each removed URL — if only the current version references it (count <= 1),
 * deletes from the bucket and decrements the storage counter.
 */
export async function cleanupRemovedMedia(urlsToRemove) {
  if (!urlsToRemove.length) return

  let totalFreedBytes = 0
  const pathsToDelete = []

  for (const url of urlsToRemove) {
    const path = getPathFromUrl(url)
    if (!path) continue

    // At this point the URL is still in the DB for the current version being edited.
    // count === 1 means only this version uses it → safe to delete from bucket.
    const { count } = await supabase
      .from('post_versions')
      .select('*', { count: 'exact', head: true })
      .contains('media_urls', [url])

    if (count <= 1) {
      try {
        const sizeBytes = await getFileSize(path)
        totalFreedBytes += sizeBytes
      } catch {
        // non-fatal
      }
      pathsToDelete.push(path)
    }
  }

  if (pathsToDelete.length > 0) {
    await supabase.storage.from('post-media').remove(pathsToDelete)

    if (totalFreedBytes > 0) {
      try {
        const { workspaceUserId } = await resolveWorkspace()
        await supabase.rpc('decrement_storage_used', {
          p_user_id: workspaceUserId,
          p_bytes: totalFreedBytes,
        })
      } catch {
        // non-fatal
      }
    }
  }
}

export async function fetchGlobalCalendar({ userId, currentMonth }) {
  const startDate = startOfWeek(startOfMonth(currentMonth)).toISOString()
  const endDate = endOfWeek(endOfMonth(currentMonth)).toISOString()

  const { data, error } = await supabase.rpc('get_global_calendar', {
    p_user_id: userId,
    p_start_date: startDate,
    p_end_date: endDate,
  })

  if (error) throw error

  // The data now includes media_urls (array) and version_number (int)
  return data || []
}

export async function regeneratePostShareToken(versionId) {
  // 1. Invalidate old tokens
  await supabase
    .from('share_tokens')
    .update({ is_active: false })
    .eq('post_version_id', versionId)

  // 2. Create new token
  const token = Math.random().toString(36).substring(2, 15)
  const { data, error } = await supabase
    .from('share_tokens')
    .insert([{ post_version_id: versionId, token, is_active: true }])
    .select()
    .single()

  if (error) throw error
  return data
}

// ── Phase 5: Internal approval workflow ──────────────────────────────────────

export async function submitForInternalApproval(versionId) {
  const { error } = await supabase.rpc('submit_for_internal_approval', {
    p_post_version_id: versionId,
  })
  if (error) throw error
}

export async function approveInternally(versionId) {
  const { error } = await supabase.rpc('approve_internally', {
    p_post_version_id: versionId,
  })
  if (error) throw error
}

export async function requestInternalChanges(versionId, notes) {
  const { error } = await supabase.rpc('request_internal_changes', {
    p_post_version_id: versionId,
    p_notes: notes || null,
  })
  if (error) throw error
}

import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/context/AuthContext'

export function usePendingApprovals() {
  const { workspaceUserId } = useAuth()
  return useQuery({
    queryKey: ['pending-approvals', workspaceUserId],
    enabled: !!workspaceUserId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('post_versions')
        .select(`
          id,
          title,
          content,
          media_urls,
          platform,
          target_date,
          admin_notes,
          updated_at,
          submitted_by,
          deliverable_type,
          posts!post_versions_post_id_fkey (
            id,
            client_id,
            clients ( id, name, logo_url, is_internal )
          )
        `)
        .eq('status', 'SUBMITTED')
        .order('updated_at', { ascending: true })

      if (error) throw error

      return (data || []).map((v) => ({
        ...v,
        actual_post_id: v.posts?.id,
        client_id: v.posts?.client_id,
        client: v.posts?.clients,
        platforms: v.platform || [],
      }))
    },
  })
}

export function usePendingApprovalsCount() {
  const { workspaceUserId } = useAuth()
  return useQuery({
    queryKey: ['pending-approvals-count', workspaceUserId],
    enabled: !!workspaceUserId,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('post_versions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'SUBMITTED')

      if (error) throw error
      return count ?? 0
    },
  })
}

export function useApprovalLog({ action = null, page = 0, pageSize = 25 } = {}) {
  const { workspaceUserId } = useAuth()
  return useQuery({
    queryKey: ['approval-log', workspaceUserId, action, page],
    enabled: !!workspaceUserId,
    queryFn: async () => {
      const [{ data, error }, { data: countData, error: countError }] = await Promise.all([
        supabase.rpc('get_approval_log', {
          p_action: action ?? null,
          p_limit: pageSize,
          p_offset: page * pageSize,
        }),
        supabase.rpc('get_approval_log_count', { p_action: action ?? null }),
      ])
      if (error) throw error
      if (countError) throw countError
      return { events: data ?? [], total: Number(countData ?? 0) }
    },
  })
}

export function useApprovalLogCount(action) {
  const { workspaceUserId } = useAuth()
  return useQuery({
    queryKey: ['approval-log', workspaceUserId, action, 'count'],
    enabled: !!workspaceUserId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_approval_log_count', {
        p_action: action ?? null,
      })
      if (error) throw error
      return Number(data ?? 0)
    },
  })
}

export async function deleteApprovalEvents(ids) {
  const { error } = await supabase.rpc('delete_approval_events', { p_ids: ids })
  if (error) throw error
}

export function useMySubmissions({ status = null, page = 0, pageSize = 25 } = {}) {
  const { workspaceUserId } = useAuth()
  return useQuery({
    queryKey: ['my-submissions', workspaceUserId, status, page],
    enabled: !!workspaceUserId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_my_submissions', {
        p_status: status ?? null,
        p_page: page,
        p_page_size: pageSize,
      })
      if (error) throw error
      return data ?? []
    },
  })
}

export function useMySubmissionsCount(status = null) {
  const { workspaceUserId } = useAuth()
  return useQuery({
    queryKey: ['my-submissions', workspaceUserId, status, 'count'],
    enabled: !!workspaceUserId,
    staleTime: 30_000,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_my_submissions_count', {
        p_status: status ?? null,
      })
      if (error) throw error
      return Number(data ?? 0)
    },
  })
}

import { useMutation, useQueryClient } from '@tanstack/react-query'
export function useRegeneratePostShareToken() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (versionId) => regeneratePostShareToken(versionId),
    onSuccess: (_, versionId) => {
      queryClient.invalidateQueries({ queryKey: ['post-version', versionId] })
    },
  })
}
