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
        .select('*')
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
