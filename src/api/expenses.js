// Expenses API (ADR 0007): the key factory, a plain async function per
// mutation (the unit-test surface, callable outside React), and a hook that
// wraps each one and owns the cache invalidation.
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { resolveWorkspace } from '@/lib/workspace'
import { clientKeys, expenseKeys, transactionKeys } from '@/api/queryKeys'

export { expenseKeys }

// Recurring expenses feed the burn rate, the finance overview (its monthly
// burn) and client profitability.
function invalidateExpenses(queryClient) {
  queryClient.invalidateQueries({ queryKey: expenseKeys.all })
  queryClient.invalidateQueries({ queryKey: transactionKeys.all })
  queryClient.invalidateQueries({ queryKey: clientKeys.all })
}

// ─── Reads ────────────────────────────────────────────────────────────────────

export function useExpenses(filters = {}, options = {}) {
  const { workspaceUserId } = useAuth()

  return useQuery({
    queryKey: expenseKeys.list(workspaceUserId, filters),
    queryFn: async () => {
      let query = supabase
        .from('expenses')
        .select(
          `
          id,
          name,
          cost,
          billing_cycle,
          next_billing_date,
          category,
          created_at,
          is_active,
          assigned_client_id,
          assigned_client:assigned_client_id (
            id,
            name,
            logo_url
          )
        `,
        )
        .order('next_billing_date', { ascending: true })

      if (filters.clientId) {
        query = query.eq('assigned_client_id', filters.clientId)
      }

      const { data, error } = await query
      if (error) throw error
      return data
    },
    enabled: !!workspaceUserId,
    ...options,
  })
}

export function useBurnRate() {
  const { workspaceUserId } = useAuth()

  return useQuery({
    queryKey: expenseKeys.burnRate(workspaceUserId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('view_monthly_burn_rate')
        .select('total_monthly_burn')
        .eq('user_id', workspaceUserId)
        .maybeSingle()

      if (error) throw error
      return data?.total_monthly_burn || 0
    },
    enabled: !!workspaceUserId,
  })
}

// ─── Mutations ────────────────────────────────────────────────────────────────

// The form sends 'myself' / '' for "the agency itself".
const toClientId = (value) => (!value || value === 'myself' ? null : value)

export async function createExpense(formData) {
  const { workspaceUserId } = await resolveWorkspace()

  const { data, error } = await supabase
    .from('expenses')
    .insert({
      user_id: workspaceUserId,
      name: formData.name,
      cost: parseFloat(formData.cost),
      billing_cycle: formData.billing_cycle,
      next_billing_date: formData.next_billing_date,
      category: formData.category,
      is_active: formData.is_active !== undefined ? formData.is_active : true,
      assigned_client_id: toClientId(formData.assigned_client_id),
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export function useCreateExpense() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createExpense,
    onSuccess: () => invalidateExpenses(queryClient),
  })
}

export async function updateExpense({ id, updates }) {
  const cleanUpdates = { ...updates }
  // Only the "agency itself" sentinels become null; an absent field is left
  // out of the update so it doesn't clear the assignment.
  if (cleanUpdates.assigned_client_id === 'myself' || cleanUpdates.assigned_client_id === '') {
    cleanUpdates.assigned_client_id = null
  }
  if (cleanUpdates.cost) cleanUpdates.cost = parseFloat(cleanUpdates.cost)

  const { data, error } = await supabase
    .from('expenses')
    .update(cleanUpdates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export function useUpdateExpense() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateExpense,
    onSuccess: () => invalidateExpenses(queryClient),
  })
}

export async function deleteExpense(id) {
  const { error } = await supabase.from('expenses').delete().eq('id', id)
  if (error) throw error
  return true
}

export function useDeleteExpense() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteExpense,
    onSuccess: () => invalidateExpenses(queryClient),
  })
}

export async function renewSubscription(id) {
  const { data, error } = await supabase.rpc('advance_expense_billing_date', { expense_id: id })
  if (error) throw error
  return data
}

export function useRenewSubscription() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: renewSubscription,
    onSuccess: () => invalidateExpenses(queryClient),
  })
}
