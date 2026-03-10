import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { resolveWorkspace } from '@/lib/workspace'
import { transactionKeys } from '@/api/transactions'

// --- KEYS FOR CACHING ---
export const invoiceKeys = {
  all: ['invoices'],
  list: (filters) => [...invoiceKeys.all, 'list', { ...filters }],
  detail: (id) => [...invoiceKeys.all, 'detail', id],
  nextNumber: () => [...invoiceKeys.all, 'nextNumber'],
}

export const recurringInvoiceKeys = {
  all: ['recurring_invoices'],
  list: (filters) => [...recurringInvoiceKeys.all, 'list', { ...filters }],
  detail: (id) => [...recurringInvoiceKeys.all, 'detail', id],
}

// --- 1. FETCH INVOICES (List) ---
export function useInvoices(filters = {}, options = {}) {
  const { workspaceUserId } = useAuth()
  const { clientId, status } = filters

  return useQuery({
    ...options,
    queryKey: invoiceKeys.list(filters),
    queryFn: async () => {
      if (!workspaceUserId) throw new Error('User not authenticated')

      let query = supabase
        .from('invoices')
        .select(
          `
          *,
          client:client_id (
            id,
            name,
            logo_url,
            email,
            is_internal
          )
        `,
        )
        .order('created_at', { ascending: false })

      if (clientId) {
        query = query.eq('client_id', clientId)
      }

      if (status && status !== 'ALL') {
        query = query.eq('status', status)
      }

      const { data, error } = await query
      if (error) throw error
      return data
    },
    enabled: !!workspaceUserId,
  })
}

// --- 2. FETCH SINGLE INVOICE WITH ITEMS ---
export function useInvoice(id) {
  const { workspaceUserId } = useAuth()

  return useQuery({
    queryKey: invoiceKeys.detail(id),
    queryFn: async () => {
      if (!workspaceUserId) throw new Error('User not authenticated')

      // Fetch invoice with client
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .select(
          `
          *,
          client:client_id (
            id,
            name,
            logo_url,
            email,
            is_internal
          )
        `,
        )
        .eq('id', id)
        .single()

      if (invoiceError) throw invoiceError

      // Fetch items for this invoice
      const { data: items, error: itemsError } = await supabase
        .from('invoice_items')
        .select('*')
        .eq('invoice_id', id)
        .order('created_at', { ascending: true })

      if (itemsError) throw itemsError

      return { ...invoice, items: items || [] }
    },
    enabled: !!workspaceUserId && !!id,
  })
}

// --- 3. FETCH NEXT INVOICE NUMBER ---
export function useNextInvoiceNumber() {
  const { workspaceUserId } = useAuth()

  return useQuery({
    queryKey: invoiceKeys.nextNumber(),
    queryFn: async () => {
      if (!workspaceUserId) throw new Error('User not authenticated')

      const { data, error } = await supabase
        .from('agency_subscriptions')
        .select('next_invoice_number')
        .eq('user_id', workspaceUserId)
        .single()

      if (error) throw error

      const num = data?.next_invoice_number || 1
      const year = new Date().getFullYear()
      return {
        number: num,
        formatted: `INV-${year}-${String(num).padStart(3, '0')}`,
      }
    },
    enabled: !!workspaceUserId,
  })
}

// --- 4. CREATE INVOICE ---
export function useCreateInvoice() {
  const queryClient = useQueryClient()
  const { workspaceUserId } = useAuth()

  return useMutation({
    mutationFn: async ({ invoice, items }) => {
      if (!workspaceUserId) throw new Error('User not authenticated')

      // 1. Get and format invoice number
      const { data: agencySub, error: subError } = await supabase
        .from('agency_subscriptions')
        .select('next_invoice_number')
        .eq('user_id', workspaceUserId)
        .single()

      if (subError) throw subError

      const num = agencySub.next_invoice_number || 1
      const year = new Date().getFullYear()
      const invoiceNumber = `INV-${year}-${String(num).padStart(3, '0')}`

      // 2. Calculate totals from items
      const subtotal = items.reduce(
        (sum, item) => sum + item.quantity * item.unit_price,
        0,
      )

      // 3. Insert invoice
      const { data: newInvoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          user_id: workspaceUserId,
          client_id: invoice.client_id,
          invoice_number: invoiceNumber,
          status: 'DRAFT',
          issue_date:
            invoice.issue_date || new Date().toISOString().split('T')[0],
          due_date: invoice.due_date,
          category: invoice.category || null,
          subtotal,
          total: subtotal, // No tax for now
          notes: invoice.notes || null,
          payment_terms: invoice.payment_terms || null,
          campaign_id: invoice.campaign_id || null,
        })
        .select()
        .single()

      if (invoiceError) throw invoiceError

      // 4. Insert line items
      if (items.length > 0) {
        const itemPayloads = items.map((item) => ({
          invoice_id: newInvoice.id,
          transaction_id: item.transaction_id || null,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total: item.quantity * item.unit_price,
        }))

        const { error: itemsError } = await supabase
          .from('invoice_items')
          .insert(itemPayloads)

        if (itemsError) throw itemsError
      }

      // 5. Increment invoice number
      const { error: updateError } = await supabase
        .from('agency_subscriptions')
        .update({ next_invoice_number: num + 1 })
        .eq('user_id', workspaceUserId)

      if (updateError) throw updateError

      return newInvoice
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invoiceKeys.all })
    },
  })
}

// --- 5. UPDATE INVOICE ---
export function useUpdateInvoice() {
  const queryClient = useQueryClient()
  const { workspaceUserId } = useAuth()

  return useMutation({
    mutationFn: async ({ id, updates }) => {
      if (!workspaceUserId) throw new Error('User not authenticated')

      const payload = {}
      if (updates.status !== undefined) payload.status = updates.status
      if (updates.client_id !== undefined) payload.client_id = updates.client_id
      if (updates.issue_date !== undefined)
        payload.issue_date = updates.issue_date
      if (updates.due_date !== undefined) payload.due_date = updates.due_date
      if (updates.category !== undefined) payload.category = updates.category
      if (updates.notes !== undefined) payload.notes = updates.notes
      if (updates.payment_terms !== undefined)
        payload.payment_terms = updates.payment_terms
      if (updates.pdf_url !== undefined) payload.pdf_url = updates.pdf_url
      payload.updated_at = new Date().toISOString()

      // If line items are being updated, recalculate totals
      if (updates.items) {
        const subtotal = updates.items.reduce(
          (sum, item) => sum + item.quantity * item.unit_price,
          0,
        )
        payload.subtotal = subtotal
        payload.total = subtotal // No tax for MVP
      }

      // 1. Update invoice
      const { data: updatedInvoice, error } = await supabase
        .from('invoices')
        .update(payload)
        .eq('id', id)
        .select(
          `
          *,
          client:client_id (
            id,
            name
          )
        `,
        )
        .single()

      if (error) throw error

      // 2. Replace line items if provided
      if (updates.items) {
        // Delete old items
        const { error: delError } = await supabase
          .from('invoice_items')
          .delete()
          .eq('invoice_id', id)

        if (delError) throw delError

        // Insert new items
        if (updates.items.length > 0) {
          const itemPayloads = updates.items.map((item) => ({
            invoice_id: id,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total: item.quantity * item.unit_price,
          }))

          const { error: insError } = await supabase
            .from('invoice_items')
            .insert(itemPayloads)

          if (insError) throw insError
        }
      }

      // 3. Auto-create INCOME transaction when marking as PAID
      if (updates.status === 'PAID') {
        const { error: txError } = await supabase.from('transactions').insert({
          user_id: workspaceUserId,
          client_id: updatedInvoice.client_id,
          invoice_id: updatedInvoice.id,
          type: 'INCOME',
          amount: updatedInvoice.total || 0,
          date: new Date().toISOString().split('T')[0],
          category: updatedInvoice.category || 'Other',
          description: `Payment received — ${updatedInvoice.invoice_number}${updatedInvoice.client?.name ? ` (${updatedInvoice.client.name})` : ''}`,
          status: 'PAID',
        })

        if (txError) throw txError
      }

      // 4. Remove linked transaction if reverting FROM paid to another status
      //    (e.g. accidentally marked as paid)
      if (updates.status && updates.status !== 'PAID') {
        // Delete any auto-created transaction for this invoice
        await supabase.from('transactions').delete().eq('invoice_id', id)
      }

      return updatedInvoice
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invoiceKeys.all })
      queryClient.invalidateQueries({ queryKey: transactionKeys.all })
    },
  })
}

// --- 6. DELETE INVOICE ---
// Deleting an invoice cascades to invoice_items AND the linked transaction
// (via invoice_id FK with ON DELETE CASCADE on both tables)
export function useDeleteInvoice() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('invoices').delete().eq('id', id)

      if (error) throw error
      return true
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invoiceKeys.all })
      // Also invalidate transactions since a linked transaction may have been cascade-deleted
      queryClient.invalidateQueries({ queryKey: transactionKeys.all })
    },
  })
}

// --- 7. FETCH RECURRING INVOICES ---
export function useRecurringInvoices(filters = {}, options = {}) {
  const { workspaceUserId } = useAuth()
  const { clientId } = filters

  return useQuery({
    ...options,
    queryKey: recurringInvoiceKeys.list(filters),
    queryFn: async () => {
      if (!workspaceUserId) throw new Error('User not authenticated')

      let query = supabase
        .from('recurring_invoices')
        .select(`
          *,
          client:client_id (id, name, logo_url, email)
        `)
        .order('next_invoice_date', { ascending: true })

      if (clientId) {
        query = query.eq('client_id', clientId)
      }

      const { data, error } = await query
      if (error) throw error
      return data
    },
    enabled: !!workspaceUserId,
  })
}

// --- 8. CREATE RECURRING INVOICE ---
export function useCreateRecurringInvoice() {
  const queryClient = useQueryClient()
  const { workspaceUserId } = useAuth()

  return useMutation({
    mutationFn: async (payload) => {
      if (!workspaceUserId) throw new Error('User not authenticated')

      const { data, error } = await supabase
        .from('recurring_invoices')
        .insert({ ...payload, user_id: workspaceUserId })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: recurringInvoiceKeys.all })
    },
  })
}

// --- 9. UPDATE RECURRING INVOICE ---
export function useUpdateRecurringInvoice() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, updates }) => {

      const { data, error } = await supabase
        .from('recurring_invoices')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: recurringInvoiceKeys.all })
    },
  })
}

// --- 10. DELETE RECURRING INVOICE ---
export function useDeleteRecurringInvoice() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase
        .from('recurring_invoices')
        .delete()
        .eq('id', id)

      if (error) throw error
      return true
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: recurringInvoiceKeys.all })
    },
  })
}

// --- 11. GENERATE INVOICE FROM RECURRING TEMPLATE ---
export function useGenerateFromRecurring() {
  const queryClient = useQueryClient()
  const { workspaceUserId } = useAuth()

  return useMutation({
    mutationFn: async (templateId) => {
      if (!workspaceUserId) throw new Error('User not authenticated')

      // Call the atomic RPC to generate the invoice
      const { data: invoiceId, error: rpcError } = await supabase.rpc(
        'generate_invoice_from_template',
        {
          p_template_id: templateId,
          p_user_id: workspaceUserId,
        },
      )

      if (rpcError) throw rpcError

      // Fetch the newly created invoice to return it (for the onSuccess handler)
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('id', invoiceId)
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invoiceKeys.all })
      queryClient.invalidateQueries({ queryKey: recurringInvoiceKeys.all })
    },
  })
}
