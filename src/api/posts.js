import { supabase } from '@/lib/supabase'

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

export const deletePost = async (postId) => {
  const { data, error } = await supabase
    .from('posts')
    .delete()
    .eq('id', postId)
    .select()

  if (error) throw error
  return data
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
