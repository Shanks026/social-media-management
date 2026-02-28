import { supabase } from '@/lib/supabase'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/context/AuthContext'

/**
 * Builds a Supabase query for global posts with dynamic filters.
 */
function buildPostsQuery(userId, filters = {}) {
  const { search, status, clientId, platform, dateRange } = filters

  let query = supabase
    .from('posts')
    .select(
      `
      id,
      client_id,
      clients!inner (
        id,
        name,
        logo_url,
        is_internal
      ),
      post_versions!fk_current_version (
        id,
        title,
        content,
        media_urls,
        platform,
        status,
        version_number,
        target_date,
        created_at,
        updated_at
      )
    `,
    )
    .eq('clients.user_id', userId)

  // --- Client Context Logic ---
  if (clientId === 'INTERNAL') {
    query = query.eq('clients.is_internal', true)
  } else if (clientId === 'CLIENTS') {
    query = query.eq('clients.is_internal', false)
  } else if (clientId && clientId !== 'all') {
    query = query.eq('client_id', clientId)
  }

  // --- Status filter (applied on post_versions) ---
  if (status && status !== 'ALL') {
    query = query.eq('post_versions.status', status)
  }

  // --- Platform filter (platform is text[], use contains) ---
  if (platform && platform !== 'all') {
    query = query.contains('post_versions.platform', [platform])
  }

  // --- Search (ilike on content) ---
  if (search) {
    query = query.ilike('post_versions.content', `%${search}%`)
  }

  // --- Date range ---
  if (dateRange?.from) {
    query = query.gte('post_versions.target_date', dateRange.from.toISOString())
  }
  if (dateRange?.to) {
    query = query.lte('post_versions.target_date', dateRange.to.toISOString())
  }

  return query.order('created_at', { ascending: false })
}

/**
 * Normalize raw Supabase response into a flat array of posts.
 */
function normalizePosts(data) {
  if (!data) return []
  return data
    .filter((row) => row.post_versions) // skip posts with no current version
    .map((row) => {
      const v = row.post_versions
      const c = row.clients
      return {
        id: row.id,
        client_id: row.client_id,
        version_id: v.id,
        title: v.title,
        content: v.content,
        media_urls: v.media_urls || [],
        platforms: v.platform || [],
        status: v.status,
        version_number: v.version_number,
        target_date: v.target_date,
        created_at: v.created_at,
        updated_at: v.updated_at,
        // Client info
        client_name: c?.name || 'Unknown',
        client_logo: c?.logo_url,
        is_internal: c?.is_internal || false,
      }
    })
}

/**
 * Hook: Fetch all posts across every client with dynamic filters.
 *
 * @param {Object} filters - { search, status, clientId, platform, dateRange }
 */
export function useGlobalPosts(filters = {}) {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['global-posts', user?.id, filters],
    queryFn: async () => {
      const { data, error } = await buildPostsQuery(user.id, filters)
      if (error) throw error
      return normalizePosts(data)
    },
    enabled: !!user?.id,
    staleTime: 1000 * 30, // 30s
  })
}

/**
 * Hook: Fetch lightweight status counts for tabs.
 * Returns { all, DRAFT, SCHEDULED, PUBLISHED, FAILED }
 */
export function usePostCounts() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['global-post-counts', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('posts')
        .select(
          `
          id,
          clients!inner ( is_internal ),
          post_versions!fk_current_version ( status )
        `,
        )
        .eq('clients.user_id', user.id)

      if (error) throw error

      const counts = {
        all: 0,
        DRAFT: 0,
        PENDING_APPROVAL: 0,
        SCHEDULED: 0,
        NEEDS_REVISION: 0,
        PUBLISHED: 0,
        ARCHIVED: 0,
      }
      for (const row of data || []) {
        if (!row.post_versions) continue
        counts.all++
        const s = row.post_versions.status
        if (s in counts) counts[s]++
      }
      return counts
    },
    enabled: !!user?.id,
    staleTime: 1000 * 30,
  })
}
