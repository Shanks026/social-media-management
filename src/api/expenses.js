import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

export const expenseKeys = {
  all: ['expenses'],
  list: (filters) => [...expenseKeys.all, 'list', { ...filters }],
  burnRate: () => [...expenseKeys.all, 'burn-rate'],
}

// --- 1. FETCH ALL EXPENSES ---
export function useExpenses() {
  const { user } = useAuth()

  return useQuery({
    queryKey: expenseKeys.list(),
    queryFn: async () => {
      if (!user) throw new Error('User not authenticated')

      const { data, error } = await supabase
        .from('expenses')
        // FIX: Removed comments from inside this string
        .select(
          `
          id,
          name,
          cost,
          billing_cycle,
          next_billing_date,
          category,
          created_at,
          assigned_client_id,
          assigned_client:assigned_client_id (
            id,
            name,
            logo_url
          )
        `,
        )
        .order('next_billing_date', { ascending: true })

      if (error) throw error
      return data
    },
    enabled: !!user,
  })
}

// --- 2. FETCH BURN RATE ---
export function useBurnRate() {
  const { user } = useAuth()

  return useQuery({
    queryKey: expenseKeys.burnRate(),
    queryFn: async () => {
      if (!user) return 0

      const { data, error } = await supabase
        .from('view_monthly_burn_rate')
        .select('total_monthly_burn')
        .eq('user_id', user.id)
        .maybeSingle()

      if (error) throw error
      return data?.total_monthly_burn || 0
    },
    enabled: !!user,
  })
}

// --- 3. CREATE EXPENSE ---
export function useCreateExpense() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (formData) => {
      const sanitizedClientId =
        !formData.assigned_client_id ||
        formData.assigned_client_id === '' ||
        formData.assigned_client_id === 'myself'
          ? null
          : formData.assigned_client_id

      const payload = {
        user_id: user.id,
        name: formData.name,
        cost: parseFloat(formData.cost),
        billing_cycle: formData.billing_cycle,
        next_billing_date: formData.next_billing_date,
        category: formData.category,
        assigned_client_id: sanitizedClientId,
      }

      const { data, error } = await supabase
        .from('expenses')
        .insert(payload)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries(expenseKeys.all)
    },
  })
}

// --- 4. UPDATE EXPENSE ---
export function useUpdateExpense() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, updates }) => {
      const cleanUpdates = { ...updates }

      if (
        cleanUpdates.assigned_client_id === 'myself' ||
        cleanUpdates.assigned_client_id === ''
      ) {
        cleanUpdates.assigned_client_id = null
      }

      if (cleanUpdates.cost) {
        cleanUpdates.cost = parseFloat(cleanUpdates.cost)
      }

      const { data, error } = await supabase
        .from('expenses')
        .update(cleanUpdates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries(expenseKeys.all)
    },
  })
}

// --- 5. DELETE EXPENSE ---
export function useDeleteExpense() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('expenses').delete().eq('id', id)

      if (error) throw error
      return true
    },
    onSuccess: () => {
      queryClient.invalidateQueries(expenseKeys.all)
    },
  })
}
