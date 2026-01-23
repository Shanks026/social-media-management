import { supabase } from '@/lib/supabase'

export async function fetchAllPostsByClient(clientId) {
  const { data, error } = await supabase
    .from('posts')
    .select(
      `
      id,
      created_at,
      current_version:post_versions!fk_current_version (
        id,
        title,
        content,
        media_urls,
        platform,
        status,
        version_number,
        created_at
      )
    `,
    )
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })

  if (error) throw error

  // Flatten the response so the UI doesn't have to change much
  return data.map((post) => ({
    ...post.current_version,
    post_id: post.id,
    actual_post_id: post.id, // useful for deletion/navigation
  }))
}

export async function createDraftPost({
  clientId,
  content,
  mediaUrls,
  platforms,
  title,
}) {
  // The keys on the left (e.g., p_client_id) must match the SQL arguments exactly
  const { error } = await supabase.rpc('create_post_draft', {
    p_client_id: clientId,
    p_title: title, // This is now the 2nd argument in our new SQL
    p_content: content,
    p_media_urls: mediaUrls,
    p_platform: platforms, // This is the array from your Badge UI
  })

  if (error) throw error
}

export const deletePost = async (postId) => {
  // Simple direct delete.
  // Because of ON DELETE CASCADE, this will automatically
  // remove all entries in 'post_versions' too.
  const { data, error } = await supabase
    .from('posts')
    .delete()
    .eq('id', postId)
    .select() // Adding select() helps verify if a row was actually deleted

  if (error) throw error
  return data
}
/**
 * Updates an existing post version only if it is a DRAFT.
 */
/**
 * Updates an existing post version only if it is a DRAFT.
 */
export async function updatePost(
  versionId,
  { title, content, mediaUrls, platforms }, // Destructure platforms
) {
  const { data, error } = await supabase
    .from('post_versions')
    .update({
      title,
      content,
      media_urls: mediaUrls,
      platform: platforms, // Map to the 'platform' column in DB (which is text[])
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
