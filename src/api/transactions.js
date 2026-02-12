import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

// --- KEYS FOR CACHING ---
export const transactionKeys = {
  all: ['transactions'],
  list: (filters) => [...transactionKeys.all, 'list', { ...filters }],
  overview: () => [...transactionKeys.all, 'overview'],
}

// --- 1. FETCH TRANSACTIONS (Ledger) ---
export function useTransactions(filters = {}) {
  const { user } = useAuth()
  const { clientId, limit } = filters

  return useQuery({
    queryKey: transactionKeys.list(filters),
    queryFn: async () => {
      if (!user) throw new Error('User not authenticated')

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

      if (clientId) {
        query = query.eq('client_id', clientId)
      }

      if (limit) {
        query = query.limit(limit)
      }

      const { data, error } = await query
      if (error) throw error
      return data
    },
    enabled: !!user,
  })
}

// --- 2. FETCH FINANCE OVERVIEW ---
export function useFinanceOverview() {
  const { user } = useAuth()

  return useQuery({
    queryKey: transactionKeys.overview(),
    queryFn: async () => {
      if (!user) return null

      const { data, error } = await supabase
        .from('view_finance_overview')
        .select('*')
        .eq('user_id', user.id)
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
    enabled: !!user,
  })
}

// --- 3. CREATE TRANSACTION ---
export function useCreateTransaction() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (formData) => {
      // Data Sanitization
      const sanitizedClientId =
        !formData.client_id ||
        formData.client_id === '' ||
        formData.client_id === 'agency'
          ? null
          : formData.client_id

      const payload = {
        user_id: user.id,
        type: formData.type,
        amount: parseFloat(formData.amount),
        date: formData.date,
        category: formData.category,
        description: formData.description,
        status: formData.status || 'PAID',
        client_id: sanitizedClientId,
      }

      const { data, error } = await supabase
        .from('transactions')
        .insert(payload)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: transactionKeys.all })
    },
  })
}

// --- 4. UPDATE TRANSACTION (Corrected) ---
export function useUpdateTransaction() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, updates }) => {
      // 1. Sanitize the client_id just like in useCreate
      const sanitizedClientId =
        !updates.client_id ||
        updates.client_id === '' ||
        updates.client_id === 'agency'
          ? null
          : updates.client_id

      // 2. Prepare clean payload
      const payload = {
        type: updates.type,
        amount:
          typeof updates.amount === 'string'
            ? parseFloat(updates.amount)
            : updates.amount,
        date: updates.date,
        category: updates.category,
        description: updates.description,
        status: updates.status,
        client_id: sanitizedClientId,
      }

      const { data, error } = await supabase
        .from('transactions')
        .update(payload)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      // Invalidate everything under 'transactions' to refresh Ledger and Overview
      queryClient.invalidateQueries({ queryKey: transactionKeys.all })
    },
  })
}

// --- 5. DELETE TRANSACTION ---
export function useDeleteTransaction() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id)

      if (error) throw error
      return true
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: transactionKeys.all })
    },
  })
}
