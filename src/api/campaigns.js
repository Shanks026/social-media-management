import { supabase } from '@/lib/supabase'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

// ─── Read ─────────────────────────────────────────────────────────────────────

export function useCampaigns({ clientId } = {}) {
  return useQuery({
    queryKey: ['campaigns', 'list', { clientId: clientId ?? null }],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      const { data, error } = await supabase.rpc(
        'get_campaigns_with_post_summary',
        { p_user_id: user.id, p_client_id: clientId ?? null },
      )
      if (error) throw error
      return data ?? []
    },
    staleTime: 30000,
    retry: 1,
  })
}

export function useCampaign(campaignId) {
  return useQuery({
    queryKey: ['campaigns', 'detail', campaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('campaigns')
        .select('*, clients ( id, name, email, logo_url )')
        .eq('id', campaignId)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!campaignId,
    staleTime: 30000,
    retry: 1,
  })
}

// Plain async — called inside useEffect in DraftPostForm on client change
export async function fetchActiveCampaignsByClient(clientId) {
  const { data, error } = await supabase
    .from('campaigns')
    .select('id, name')
    .eq('client_id', clientId)
    .eq('status', 'Active')
    .order('name')
  if (error) throw error
  return data ?? []
}

export function useCampaignAnalytics(campaignId) {
  return useQuery({
    queryKey: ['campaigns', 'analytics', campaignId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_campaign_analytics', {
        p_campaign_id: campaignId,
      })
      if (error) throw error
      const row = Array.isArray(data) ? data[0] : data
      return {
        total_posts: Number(row?.total_posts ?? 0),
        published_posts: Number(row?.published_posts ?? 0),
        on_time_posts: Number(row?.on_time_posts ?? 0),
        avg_approval_days: row?.avg_approval_days ?? null,
        platform_distribution: row?.platform_distribution ?? {},
        budget: row?.budget ?? null,
        total_invoiced: Number(row?.total_invoiced ?? 0),
        total_collected: Number(row?.total_collected ?? 0),
      }
    },
    enabled: !!campaignId,
    staleTime: 30000,
    retry: 1,
  })
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export function useCreateCampaign() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload) => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      const { data, error } = await supabase
        .from('campaigns')
        .insert({ ...payload, user_id: user.id })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns', 'list'] })
    },
  })
}

export function useUpdateCampaign() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }) => {
      const { data, error } = await supabase
        .from('campaigns')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['campaigns', 'list'] })
      queryClient.invalidateQueries({
        queryKey: ['campaigns', 'detail', data.id],
      })
    },
  })
}

export function useDeleteCampaign() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id) => {
      // ON DELETE SET NULL — posts are safely orphaned, never deleted
      const { error } = await supabase.from('campaigns').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns', 'list'] })
    },
  })
}

// ─── Post-Campaign Linking ────────────────────────────────────────────────────

export function useAssignPostsToCampaign() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ postIds, campaignId }) => {
      const { error } = await supabase
        .from('posts')
        .update({ campaign_id: campaignId })
        .in('id', postIds)
      if (error) throw error
    },
    onSuccess: (_, { campaignId }) => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] })
      queryClient.invalidateQueries({ queryKey: ['global-posts'] })
      queryClient.invalidateQueries({ queryKey: ['draft-posts'] })
      queryClient.invalidateQueries({ queryKey: ['calendar'] })
      queryClient.invalidateQueries({ queryKey: ['global-calendar'] })
    },
  })
}

export function useUnlinkPostFromCampaign() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (postId) => {
      const { error } = await supabase
        .from('posts')
        .update({ campaign_id: null })
        .eq('id', postId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] })
      queryClient.invalidateQueries({ queryKey: ['global-posts'] })
      queryClient.invalidateQueries({ queryKey: ['draft-posts'] })
    },
  })
}

export function useAssignPostCampaign() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ postId, campaignId }) => {
      const { error } = await supabase
        .from('posts')
        .update({ campaign_id: campaignId || null })
        .eq('id', postId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] })
      queryClient.invalidateQueries({ queryKey: ['global-posts'] })
      queryClient.invalidateQueries({ queryKey: ['draft-posts'] })
      queryClient.invalidateQueries({ queryKey: ['calendar'] })
      queryClient.invalidateQueries({ queryKey: ['global-calendar'] })
    },
  })
}

// ─── Campaign Invoices ────────────────────────────────────────────────────────

export function useCampaignInvoices(campaignId) {
  return useQuery({
    queryKey: ['campaigns', 'invoices', campaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('id, invoice_number, total, status, due_date, created_at')
        .eq('campaign_id', campaignId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    enabled: !!campaignId,
    staleTime: 30000,
  })
}

export function useRegenerateCampaignReviewToken() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (campaignId) => {
      const { data, error } = await supabase
        .from('campaigns')
        .update({ 
          review_token: crypto.randomUUID(),
          review_token_active: true 
        })
        .eq('id', campaignId)
        .select('review_token')
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (_, campaignId) => {
      queryClient.invalidateQueries({ queryKey: ['campaigns', 'detail', campaignId] })
    },
  })
}

export function useMarkReviewSent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (campaignId) => {
      const { error } = await supabase
        .from('campaigns')
        .update({ last_review_sent_at: new Date().toISOString() })
        .eq('id', campaignId)
      if (error) throw error
    },
    onSuccess: (_, campaignId) => {
      queryClient.invalidateQueries({ queryKey: ['campaigns', 'detail', campaignId] })
    },
  })
}

// ─── Campaign Review (Phase 3) ────────────────────────────────────────────────

// Unauthenticated — token from URL param; SECURITY DEFINER RPC
export function useCampaignReview(token) {
  return useQuery({
    queryKey: ['campaigns', 'review', token],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_campaign_by_review_token', {
        p_token: token,
      })
      if (error) throw error
      return data?.[0] ?? null // null = invalid / expired token
    },
    enabled: !!token,
    staleTime: 0, // always fresh — client reviews in real time
    retry: 1,
  })
}

// Called per post in CampaignReview action handlers
// postReviewToken = share_tokens.token for that post version
export async function submitCampaignPostReview(postReviewToken, status, feedback) {
  const { error } = await supabase.rpc('update_post_status_by_token', {
    p_token: postReviewToken,
    p_status: status,
    p_feedback: feedback,
  })
  if (error) throw error
}

// ─── Unlinked Posts ───────────────────────────────────────────────────────────

// Fetch unlinked posts for a client (posts without a campaign_id)
export async function fetchUnlinkedPostsByClient(clientId) {
  const { data, error } = await supabase
    .from('posts')
    .select(`
      id,
      client_id,
      campaign_id,
      post_versions!fk_current_version (
        id, title, status, platform, target_date, media_urls
      )
    `)
    .eq('client_id', clientId)
    .is('campaign_id', null)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((post) => ({
    id: post.id,
    title: post.post_versions?.title || 'Untitled',
    status: post.post_versions?.status || 'DRAFT',
    platforms: post.post_versions?.platform || [],
    target_date: post.post_versions?.target_date,
    media_urls: post.post_versions?.media_urls || [],
  }))
}
