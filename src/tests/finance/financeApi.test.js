import { describe, it, expect, vi, beforeEach } from 'vitest'

// #155: invoices, expenses and transactions follow ADR 0007.

vi.mock('@/lib/supabase', async () => {
  const { createSupabaseStub } = await import('@/tests/api/supabaseStub')
  const sb = createSupabaseStub()
  return { supabase: sb.client, __stub: sb }
})
vi.mock('@/lib/workspace', () => ({
  resolveWorkspace: () => Promise.resolve({ workspaceUserId: 'ws-1' }),
}))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ workspaceUserId: 'ws-1' }) }))

import { __stub as sb } from '@/lib/supabase'
import { renderMutation } from '@/tests/api/mutationHarness'
import {
  invoiceKeys,
  recurringInvoiceKeys,
  createInvoice,
  updateInvoice,
  fetchInvoiceItems,
  useUpdateInvoice,
  useCreateInvoice,
} from '@/api/invoices'
import { expenseKeys, updateExpense, createExpense, useUpdateExpense } from '@/api/expenses'
import { transactionKeys, createTransaction } from '@/api/transactions'
import { campaignKeys } from '@/api/campaigns'
import { clientKeys } from '@/api/clients'
import { subscriptionKeys } from '@/api/useSubscription'

beforeEach(() => sb.reset())

describe('finance key factories', () => {
  it('scope list keys by workspace under one root per domain', () => {
    expect(invoiceKeys.list('ws-1', { status: 'PAID' })).toEqual(['invoices', 'list', 'ws-1', { status: 'PAID' }])
    expect(invoiceKeys.list('ws-1')).not.toEqual(invoiceKeys.list('ws-2'))
    expect(invoiceKeys.nextNumber('ws-1')[0]).toBe('invoices')
    expect(recurringInvoiceKeys.list('ws-1')[2]).toBe('ws-1')
    expect(expenseKeys.burnRate('ws-1')).toEqual(['expenses', 'burn-rate', 'ws-1'])
    expect(transactionKeys.overview('ws-1')).toEqual(['transactions', 'overview', 'ws-1'])
    // campaign transactions sit under the transactions root, so every money
    // change refreshes them
    expect(transactionKeys.byCampaign('c1').slice(0, 1)).toEqual(transactionKeys.all)
  })
})

describe('invoice plain functions', () => {
  it('createInvoice numbers it from the agency counter, then advances the counter', async () => {
    sb.answer('agency_subscriptions', 'select', { data: { next_invoice_number: 7 }, error: null })
    sb.answer('invoices', 'insert', { data: { id: 'i1' }, error: null })
    await createInvoice({
      invoice: { client_id: 'c1', due_date: '2026-12-01' },
      items: [{ description: 'Retainer', quantity: 2, unit_price: 50 }],
    })
    const [row] = sb.writes('invoices', 'insert')[0].args
    expect(row).toMatchObject({ user_id: 'ws-1', status: 'DRAFT', subtotal: 100, total: 100 })
    expect(row.invoice_number).toMatch(/^INV-\d{4}-007$/)
    expect(sb.writes('agency_subscriptions', 'update')[0].args[0]).toEqual({ next_invoice_number: 8 })
  })

  it('marking an invoice PAID records the income transaction', async () => {
    sb.answer('invoices', 'update', {
      data: { id: 'i1', client_id: 'c1', total: 300, invoice_number: 'INV-2026-001', client: { name: 'Acme' } },
      error: null,
    })
    await updateInvoice({ id: 'i1', updates: { status: 'PAID' } })
    const [tx] = sb.writes('transactions', 'insert')[0].args
    expect(tx).toMatchObject({ user_id: 'ws-1', invoice_id: 'i1', type: 'INCOME', amount: 300, status: 'PAID' })
    expect(sb.writes('transactions', 'delete')).toEqual([])
  })

  it('moving an invoice off PAID removes its transaction, and says so when that fails', async () => {
    sb.answer('invoices', 'update', { data: { id: 'i1' }, error: null })
    await updateInvoice({ id: 'i1', updates: { status: 'SENT' } })
    expect(sb.writes('transactions', 'delete')).toHaveLength(1)

    sb.answer('transactions', 'delete', { data: null, error: new Error('denied') })
    await expect(updateInvoice({ id: 'i1', updates: { status: 'VOID' } })).rejects.toThrow('denied')
  })

  it('fetchInvoiceItems reads one invoice\'s items and throws on error', async () => {
    sb.answer('invoice_items', 'select', { data: [{ id: 'li1' }], error: null })
    expect(await fetchInvoiceItems('i1')).toEqual([{ id: 'li1' }])
    expect(sb.filters('invoice_items')).toContainEqual(['invoice_id', 'i1'])

    sb.answer('invoice_items', 'select', { data: null, error: new Error('nope') })
    await expect(fetchInvoiceItems('i1')).rejects.toThrow('nope')
  })
})

describe('expense and transaction plain functions', () => {
  it('createExpense maps "myself" to no client', async () => {
    await createExpense({ name: 'Figma', cost: '12.5', assigned_client_id: 'myself' })
    expect(sb.writes('expenses', 'insert')[0].args[0]).toMatchObject({
      user_id: 'ws-1', cost: 12.5, assigned_client_id: null,
    })
  })

  it('updateExpense leaves an absent client assignment alone', async () => {
    await updateExpense({ id: 'e1', updates: { name: 'Renamed' } })
    expect(sb.writes('expenses', 'update')[0].args[0]).toEqual({ name: 'Renamed' })
  })

  it('createTransaction maps the form sentinels to nulls', async () => {
    await createTransaction({ type: 'EXPENSE', amount: '40', client_id: 'agency', campaign_id: 'none' })
    expect(sb.writes('transactions', 'insert')[0].args[0]).toMatchObject({
      user_id: 'ws-1', amount: 40, client_id: null, campaign_id: null, status: 'PAID',
    })
  })
})

describe('finance hooks own their invalidation', () => {
  it('changing an invoice refreshes invoices, the ledger, campaigns and clients', async () => {
    sb.answer('invoices', 'update', { data: { id: 'i1', client_id: 'c1' }, error: null })
    const { result, invalidated } = renderMutation(useUpdateInvoice)
    await result.current.mutateAsync({ id: 'i1', updates: { status: 'SENT' } })
    expect(invalidated()).toEqual(
      expect.arrayContaining([invoiceKeys.all, transactionKeys.all, campaignKeys.all, clientKeys.all]),
    )
  })

  it('creating an invoice also refreshes the subscription row (its number counter)', async () => {
    sb.answer('agency_subscriptions', 'select', { data: { next_invoice_number: 1 }, error: null })
    sb.answer('invoices', 'insert', { data: { id: 'i1' }, error: null })
    const { result, invalidated } = renderMutation(useCreateInvoice)
    await result.current.mutateAsync({ invoice: { client_id: 'c1' }, items: [] })
    expect(invalidated()).toContainEqual(subscriptionKeys.all)
  })

  it('changing an expense refreshes expenses and the overview\'s monthly burn', async () => {
    const { result, invalidated } = renderMutation(useUpdateExpense)
    await result.current.mutateAsync({ id: 'e1', updates: { cost: '20' } })
    expect(invalidated()).toEqual(expect.arrayContaining([expenseKeys.all, transactionKeys.all]))
    // never the bare-array form, which v5 reads as "invalidate everything"
    expect(invalidated()).not.toContain(undefined)
  })
})
