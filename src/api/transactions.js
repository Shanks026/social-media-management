// Transactions API (ADR 0007): the key factory, a plain async function per
// mutation (the unit-test surface, callable outside React), and a hook that
// wraps each one and owns the cache invalidation.
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { resolveWorkspace } from '@/lib/workspace'
import { campaignKeys } from '@/api/campaigns'
import { clientKeys } from '@/api/clients'

// ─── Query keys ───────────────────────────────────────────────────────────────

export const transactionKeys = {
  all: ['transactions'],
  list: (workspaceId, filters = {}) => ['transactions', 'list', workspaceId, { ...filters }],
  overview: (workspaceId) => ['transactions', 'overview', workspaceId],
  byCampaign: (campaignId) => ['transactions', 'campaign', campaignId],
}

// A transaction moves the ledger, the overview, campaign budgets and client
// profitability.
export function invalidateMoney(queryClient) {
  queryClient.invalidateQueries({ queryKey: transactionKeys.all })
  queryClient.invalidateQueries({ queryKey: campaignKeys.all })
  queryClient.invalidateQueries({ queryKey: clientKeys.all })
}

// ─── Reads ────────────────────────────────────────────────────────────────────

export function useTransactions(filters = {}, options = {}) {
  const { workspaceUserId } = useAuth()
  const { clientId, limit } = filters

  return useQuery({
    queryKey: transactionKeys.list(workspaceUserId, filters),
    queryFn: async () => {
      let query = supabase
        .from('transactions')
        .select(
          `
          *,
          client:client_id (
            id,
            name,
            logo_url,
            is_internal
          )
        `,
        )
        .order('date', { ascending: false })

      if (clientId) query = query.eq('client_id', clientId)
      if (filters.startDate) query = query.gte('date', filters.startDate)
      if (filters.endDate) query = query.lte('date', filters.endDate)
      if (limit) query = query.limit(limit)

      const { data, error } = await query
      if (error) throw error
      return data
    },
    enabled: !!workspaceUserId,
    ...options,
  })
}

export function useFinanceOverview() {
  const { workspaceUserId } = useAuth()

  return useQuery({
    queryKey: transactionKeys.overview(workspaceUserId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('view_finance_overview')
        .select('*')
        .eq('user_id', workspaceUserId)
        .maybeSingle()

      if (error) throw error

      return (
        data || {
          total_income: 0,
          total_one_off_expenses: 0,
          monthly_recurring_burn: 0,
        }
      )
    },
    enabled: !!workspaceUserId,
  })
}

export function useCampaignTransactions(campaignId) {
  return useQuery({
    queryKey: transactionKeys.byCampaign(campaignId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('campaign_id', campaignId)
        .order('date', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    enabled: !!campaignId,
    staleTime: 30000,
    retry: 1,
  })
}

// ─── Mutations ────────────────────────────────────────────────────────────────

// The form sends 'agency' / '' for "no client" and 'none' for "no campaign".
const toClientId = (value) => (!value || value === 'agency' ? null : value)
const toCampaignId = (value) => (value && value !== 'none' ? value : null)

export async function createTransaction(formData) {
  const { workspaceUserId } = await resolveWorkspace()

  const { data, error } = await supabase
    .from('transactions')
    .insert({
      user_id: workspaceUserId,
      type: formData.type,
      amount: parseFloat(formData.amount),
      date: formData.date,
      category: formData.category,
      description: formData.description,
      status: formData.status || 'PAID',
      client_id: toClientId(formData.client_id),
      campaign_id: toCampaignId(formData.campaign_id),
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export function useCreateTransaction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createTransaction,
    onSuccess: () => invalidateMoney(queryClient),
  })
}

export async function updateTransaction({ id, updates }) {
  const { data, error } = await supabase
    .from('transactions')
    .update({
      type: updates.type,
      amount: typeof updates.amount === 'string' ? parseFloat(updates.amount) : updates.amount,
      date: updates.date,
      category: updates.category,
      description: updates.description,
      status: updates.status,
      client_id: toClientId(updates.client_id),
      campaign_id: toCampaignId(updates.campaign_id),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateTransaction,
    onSuccess: () => invalidateMoney(queryClient),
  })
}

export async function deleteTransaction(id) {
  const { error } = await supabase.from('transactions').delete().eq('id', id)
  if (error) throw error
  return true
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteTransaction,
    onSuccess: () => invalidateMoney(queryClient),
  })
}
