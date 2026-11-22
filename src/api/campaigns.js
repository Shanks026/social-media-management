// Campaigns API (ADR 0007): the key factory, a plain async function per
// mutation (the unit-test surface, callable outside React), and a hook that
// wraps each one and owns the cache invalidation. Components never call
// useQuery/useMutation/invalidateQueries or import supabase for campaigns.
import { supabase } from '@/lib/supabase'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/context/AuthContext'
import { resolveWorkspace } from '@/lib/workspace'
import { campaignKeys, postKeys } from '@/api/queryKeys'

export { campaignKeys }


// ─── Reads ────────────────────────────────────────────────────────────────────

export function useCampaigns({ clientId } = {}) {
  const { workspaceUserId } = useAuth()
  return useQuery({
    queryKey: campaignKeys.list(workspaceUserId, { clientId }),
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        'get_campaigns_with_post_summary',
        { p_client_id: clientId ?? null }, // the caller's workspace (ADR 0008)
      )
      if (error) throw error
      return data ?? []
    },
    enabled: !!workspaceUserId,
    staleTime: 30000,
    retry: 1,
  })
}

export function useCampaign(campaignId) {
  return useQuery({
    queryKey: campaignKeys.detail(campaignId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('campaigns')
        .select('*, clients ( id, name, email, logo_url, is_internal )')
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

export async function fetchActiveCampaignsByClient(clientId) {
  const { data, error } = await supabase
    .from('campaigns')
    .select('id, name')
    .eq('client_id', clientId)
    .eq('status', 'ACTIVE')
    .order('name')
  if (error) throw error
  return data ?? []
}

// Active campaigns for one client (the task, meeting and deliverable dialogs).
export function useActiveCampaignsByClient(clientId, { enabled = true } = {}) {
  return useQuery({
    queryKey: campaignKeys.activeByClient(clientId),
    queryFn: () => fetchActiveCampaignsByClient(clientId),
    enabled: !!clientId && enabled,
  })
}

export function useCampaignAnalytics(campaignId) {
  return useQuery({
    queryKey: campaignKeys.analytics(campaignId),
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

export function useCampaignInvoices(campaignId) {
  return useQuery({
    queryKey: campaignKeys.invoices(campaignId),
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

// Unauthenticated — token from URL param; SECURITY DEFINER RPC
export function useCampaignReview(token) {
  return useQuery({
    queryKey: campaignKeys.review(token),
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

// Posts without a campaign, for one client.
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

// Under the 'campaigns' prefix so linking posts refreshes it.
export function useUnlinkedPostsByClient(clientId, { enabled = true } = {}) {
  return useQuery({
    queryKey: campaignKeys.unlinkedPosts(clientId),
    queryFn: () => fetchUnlinkedPostsByClient(clientId),
    enabled: !!clientId && enabled,
  })
}

// ─── Mutations: plain functions ───────────────────────────────────────────────

export async function createCampaign(payload) {
  const { workspaceUserId } = await resolveWorkspace()
  const { data, error } = await supabase
    .from('campaigns')
    .insert({ ...payload, user_id: workspaceUserId })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateCampaign({ id, ...payload }) {
  const { data, error } = await supabase
    .from('campaigns')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

// ON DELETE SET NULL — posts are safely orphaned, never deleted
export async function deleteCampaign(id) {
  const { error } = await supabase.from('campaigns').delete().eq('id', id)
  if (error) throw error
}

export async function assignPostsToCampaign({ postIds, campaignId }) {
  const { error } = await supabase
    .from('posts')
    .update({ campaign_id: campaignId })
    .in('id', postIds)
  if (error) throw error
}

export async function assignPostCampaign({ postId, campaignId }) {
  const { error } = await supabase
    .from('posts')
    .update({ campaign_id: campaignId || null })
    .eq('id', postId)
  if (error) throw error
}

export async function regenerateCampaignReviewToken(campaignId) {
  const { data, error } = await supabase
    .from('campaigns')
    .update({
      review_token: crypto.randomUUID(),
      review_token_active: true,
    })
    .eq('id', campaignId)
    .select('review_token')
    .single()
  if (error) throw error
  return data
}

export async function markReviewSent(campaignId) {
  const { error } = await supabase
    .from('campaigns')
    .update({ last_review_sent_at: new Date().toISOString() })
    .eq('id', campaignId)
  if (error) throw error
}

// Per post, from the public review page. postReviewToken is share_tokens.token
// for that post version.
export async function sendCampaignReviewEmail({ clientEmail, clientName, campaignName, reviewUrl }) {
  const { error } = await supabase.functions.invoke('send-campaign-review-email', {
    body: {
      client_email: clientEmail,
      client_name: clientName,
      campaign_name: campaignName,
      review_url: reviewUrl,
    },
  })
  if (error) throw error
}

// decision is 'APPROVE' or 'REQUEST_REVISIONS'; the database picks the status
// and returns it.
export async function submitCampaignPostReview(postReviewToken, decision, feedback) {
  const { data, error } = await supabase.rpc('submit_review_decision', {
    p_token: postReviewToken,
    p_decision: decision,
    p_feedback: feedback,
  })
  if (error) throw error
  return data
}

// ─── Mutations: hooks that own invalidation ───────────────────────────────────

export function useCreateCampaign() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createCampaign,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: campaignKeys.all }),
  })
}

export function useUpdateCampaign() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateCampaign,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: campaignKeys.all }),
  })
}

export function useDeleteCampaign() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteCampaign,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: campaignKeys.all }),
  })
}

function invalidateCampaignPostLinks(queryClient) {
  queryClient.invalidateQueries({ queryKey: campaignKeys.all })
  queryClient.invalidateQueries({ queryKey: postKeys.all })
}

export function useAssignPostsToCampaign() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: assignPostsToCampaign,
    onSuccess: () => invalidateCampaignPostLinks(queryClient),
  })
}

export function useAssignPostCampaign() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: assignPostCampaign,
    onSuccess: () => invalidateCampaignPostLinks(queryClient),
  })
}

export function useRegenerateCampaignReviewToken() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: regenerateCampaignReviewToken,
    onSuccess: (_, campaignId) =>
      queryClient.invalidateQueries({ queryKey: campaignKeys.detail(campaignId) }),
  })
}

export function useMarkReviewSent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: markReviewSent,
    onSuccess: (_, campaignId) =>
      queryClient.invalidateQueries({ queryKey: campaignKeys.detail(campaignId) }),
  })
}
