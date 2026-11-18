// Invoices API (ADR 0007): the key factories, a plain async function per
// mutation (the unit-test surface, callable outside React), and a hook that
// wraps each one and owns the cache invalidation.
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { resolveWorkspace } from '@/lib/workspace'
import { invalidateMoney } from '@/api/transactions'
import { invoiceKeys, recurringInvoiceKeys, subscriptionKeys } from '@/api/queryKeys'

export { invoiceKeys, recurringInvoiceKeys }

// An invoice shows up in the invoice lists, campaign invoices/analytics and
// client billing; paying or voiding one also moves the ledger. invalidateMoney
// covers transactions, campaigns and clients.
function invalidateInvoices(queryClient) {
  queryClient.invalidateQueries({ queryKey: invoiceKeys.all })
  invalidateMoney(queryClient)
}

const formatInvoiceNumber = (num) =>
  `INV-${new Date().getFullYear()}-${String(num).padStart(3, '0')}`

// --- 1. FETCH INVOICES (List) ---
export function useInvoices(filters = {}, options = {}) {
  const { workspaceUserId } = useAuth()
  const { clientId, status } = filters

  return useQuery({
    ...options,
    queryKey: invoiceKeys.list(workspaceUserId, filters),
    queryFn: async () => {

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
            address,
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
            address,
            is_internal
          )
        `,
        )
        .eq('id', id)
        .single()

      if (invoiceError) throw invoiceError

      return { ...invoice, items: await fetchInvoiceItems(id) }
    },
    enabled: !!workspaceUserId && !!id,
  })
}

/** An invoice's line items, oldest first (the PDF and email need them). */
export async function fetchInvoiceItems(invoiceId) {
  const { data, error } = await supabase
    .from('invoice_items')
    .select('*')
    .eq('invoice_id', invoiceId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data || []
}

// --- 3. FETCH NEXT INVOICE NUMBER ---
export function useNextInvoiceNumber() {
  const { workspaceUserId } = useAuth()

  return useQuery({
    queryKey: invoiceKeys.nextNumber(workspaceUserId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agency_subscriptions')
        .select('next_invoice_number')
        .eq('user_id', workspaceUserId)
        .single()

      if (error) throw error

      const num = data?.next_invoice_number || 1
      return { number: num, formatted: formatInvoiceNumber(num) }
    },
    enabled: !!workspaceUserId,
  })
}

// --- 4. CREATE INVOICE ---
export async function createInvoice({ invoice, items }) {
  const { workspaceUserId } = await resolveWorkspace()

  // 1. Get and format invoice number
  const { data: agencySub, error: subError } = await supabase
    .from('agency_subscriptions')
    .select('next_invoice_number')
    .eq('user_id', workspaceUserId)
    .single()

  if (subError) throw subError

  const num = agencySub.next_invoice_number || 1
  const invoiceNumber = formatInvoiceNumber(num)

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
}

export function useCreateInvoice() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createInvoice,
    onSuccess: () => {
      invalidateInvoices(queryClient)
      // creating one advances agency_subscriptions.next_invoice_number
      queryClient.invalidateQueries({ queryKey: subscriptionKeys.all })
    },
  })
}

// --- 5. UPDATE INVOICE ---
/**
 * Update an Invoice. Marking it PAID records the INCOME transaction; moving
 * it to any other status removes that transaction again.
 */
export async function updateInvoice({ id, updates }) {
  const { workspaceUserId } = await resolveWorkspace()

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
    const { error: txDeleteError } = await supabase
      .from('transactions')
      .delete()
      .eq('invoice_id', id)
    if (txDeleteError) throw txDeleteError
  }

  return updatedInvoice
}

export function useUpdateInvoice() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateInvoice,
    onSuccess: () => invalidateInvoices(queryClient),
  })
}

// --- 6. DELETE INVOICE ---
// Deleting an invoice cascades to invoice_items AND the linked transaction
// (via invoice_id FK with ON DELETE CASCADE on both tables)
export async function deleteInvoice(id) {
  const { error } = await supabase.from('invoices').delete().eq('id', id)
  if (error) throw error
  return true
}

export function useDeleteInvoice() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteInvoice,
    onSuccess: () => invalidateInvoices(queryClient),
  })
}

// --- 7. FETCH RECURRING INVOICES ---
export function useRecurringInvoices(filters = {}, options = {}) {
  const { workspaceUserId } = useAuth()
  const { clientId } = filters

  return useQuery({
    ...options,
    queryKey: recurringInvoiceKeys.list(workspaceUserId, filters),
    queryFn: async () => {
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
export async function createRecurringInvoice(payload) {
  const { workspaceUserId } = await resolveWorkspace()
  const { data, error } = await supabase
    .from('recurring_invoices')
    .insert({ ...payload, user_id: workspaceUserId })
    .select()
    .single()
  if (error) throw error
  return data
}

export function useCreateRecurringInvoice() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createRecurringInvoice,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: recurringInvoiceKeys.all }),
  })
}

// --- 9. UPDATE RECURRING INVOICE ---
export async function updateRecurringInvoice({ id, updates }) {
  const { data, error } = await supabase
    .from('recurring_invoices')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export function useUpdateRecurringInvoice() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateRecurringInvoice,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: recurringInvoiceKeys.all }),
  })
}

// --- 10. DELETE RECURRING INVOICE ---
export async function deleteRecurringInvoice(id) {
  const { error } = await supabase.from('recurring_invoices').delete().eq('id', id)
  if (error) throw error
  return true
}

export function useDeleteRecurringInvoice() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteRecurringInvoice,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: recurringInvoiceKeys.all }),
  })
}

// --- 11. GENERATE INVOICE FROM RECURRING TEMPLATE ---
export async function generateFromRecurring(templateId) {
  const { workspaceUserId } = await resolveWorkspace()

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
}

export function useGenerateFromRecurring() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: generateFromRecurring,
    onSuccess: () => {
      invalidateInvoices(queryClient)
      queryClient.invalidateQueries({ queryKey: recurringInvoiceKeys.all })
    },
  })
}
