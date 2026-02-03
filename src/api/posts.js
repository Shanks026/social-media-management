import { supabase } from '@/lib/supabase'
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns'

/**
 * Fetches all posts for a client, joining the current version data.
 */
export async function fetchAllPostsByClient(clientId) {
  const { data, error } = await supabase
    .from('posts')
    .select(
      `
      id,
      post_versions!fk_current_version (
        id,
        title,
        content,
        media_urls,
        platform,
        status,
        version_number,
        created_at,
        target_date,
        admin_notes
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
      id: post.id,
      version_id: latest.id,
      actual_post_id: post.id,
      display_date: latest.created_at || new Date().toISOString(),
    }
  })
}

/**
 * HELPER: Extracts the storage path from a public URL
 * Use this to ensure we are sending the correct path to .remove()
 */
const getPathFromUrl = (url) => {
  if (!url) return null

  // This looks for the public URL pattern and snips everything before the bucket name
  // Pattern: .../public/post-media/YOUR_FILE_PATH
  const bucketSegment = '/public/post-media/'
  if (url.includes(bucketSegment)) {
    return url.split(bucketSegment)[1]
  }
  return null
}

/**
 * Fetches details for a post.
 * Smart logic: Checks if ID is a Post ID OR a Version ID.
 */
export async function fetchPostDetails(id) {
  // 1. Try to fetch assuming 'id' is a Parent Post ID
  const { data: parentData } = await supabase
    .from('posts')
    .select(
      `
      id,
      client_id,
      clients ( name, logo_url ),
      post_versions!fk_current_version (*)
    `,
    )
    .eq('id', id)
    .maybeSingle()

  if (parentData?.post_versions) {
    return {
      ...parentData.post_versions,
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
      posts!post_versions_post_id_fkey (
        id,
        client_id,
        clients ( name, logo_url )
      )
    `,
    )
    .eq('id', id)
    .maybeSingle()

  if (error) {
    console.error('Supabase Error:', error)
    throw error
  }

  if (versionData) {
    return {
      ...versionData,
      actual_post_id: versionData.posts.id,
      clients: versionData.posts.clients,
    }
  }

  throw new Error('Post or Version not found')
}

export async function createDraftPost({
  clientId,
  content, // Coming from form.content
  images, // Usually what the form holds before they are URLs
  mediaUrls, // If they are already uploaded
  platforms,
  title,
  target_date,
  adminNotes,
  userId,
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
      // We MUST destructure { data, error } here
      const { data, error: storageError } = await supabase.storage
        .from('post-media')
        .remove(uniquePaths)

      // Now 'data' is defined and can be logged
      console.log('Supabase storage removal response:', data)

      if (storageError) {
        console.error('Storage cleanup failed:', storageError)
        throw storageError
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
  { title, content, mediaUrls, platforms, target_date, admin_notes },
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
    })
    .eq('id', versionId)
    .eq('status', 'DRAFT')
    .select()

  if (error) throw error

  if (data?.length === 0) {
    throw new Error('Update failed: Only drafts can be modified.')
  }

  return data
}

// api/posts.js

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

  // 3. Only delete from storage if count is 0
  if (count === 0) {
    const { data, error: storageError } = await supabase.storage
      .from('post-media')
      .remove([path])

    if (storageError) console.error('Storage cleanup failed:', storageError)
    console.log('File deleted from bucket as it is no longer referenced:', data)
  } else {
    console.log(
      `File kept in bucket: ${count} other versions still reference it.`,
    )
  }

  return updatedUrls
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
