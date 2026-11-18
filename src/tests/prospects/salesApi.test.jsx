import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// #154: the sales modules (Proposals, Prospects, Outreach) follow ADR 0007.
// Plain functions are tested against a recording supabase stub; the hooks are
// tested only for the cache keys they invalidate.

const calls = []
// Per-table answers; anything unlisted resolves { data: null, error: null }.
let answers = {}

function chain(table) {
  const node = {}
  let op = 'select'
  for (const method of ['insert', 'update', 'delete', 'select', 'eq', 'neq', 'in', 'order']) {
    node[method] = (...args) => {
      if (['insert', 'update', 'delete'].includes(method)) op = method
      calls.push({ table, method, args })
      return node
    }
  }
  const settle = () => Promise.resolve(answers[`${table}.${op}`] ?? { data: null, error: null })
  node.single = settle
  node.maybeSingle = settle
  node.then = (resolve, reject) => settle().then(resolve, reject)
  return node
}

const removed = []
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table) => chain(table),
    rpc: (name, args) => {
      calls.push({ rpc: name, args })
      return Promise.resolve({ data: null, error: null })
    },
    storage: {
      from: () => ({
        remove: (paths) => {
          removed.push(...paths)
          return Promise.resolve({ error: null })
        },
      }),
    },
  },
}))
vi.mock('@/lib/workspace', () => ({
  resolveWorkspace: () => Promise.resolve({ workspaceUserId: 'ws-1' }),
}))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ workspaceUserId: 'ws-1' }) }))

import {
  proposalKeys,
  createProposal,
  deleteProposal,
  ProposalLimitError,
} from '@/api/proposals'
import {
  prospectKeys,
  createProspect,
  updateProspect,
  deleteProspect,
  markProspectConverted,
  useUpdateProspect,
  useDeleteProspect,
} from '@/api/prospects'
import { prospectActivityKeys, logActivity, useLogActivity } from '@/api/prospectActivities'
import { documentKeys } from '@/api/documents'

beforeEach(() => {
  calls.length = 0
  removed.length = 0
  answers = {}
})

const writes = (table, method) => calls.filter((c) => c.table === table && c.method === method)

describe('sales key factories', () => {
  it('scope list keys by workspace and nest them under the domain prefix', () => {
    expect(proposalKeys.list('ws-1')).toEqual([
      'proposals', 'list', 'ws-1', { clientId: null, prospectId: null },
    ])
    expect(proposalKeys.list('ws-1')).not.toEqual(proposalKeys.list('ws-2'))
    expect(proposalKeys.list('ws-1').slice(0, 2)).toEqual(proposalKeys.lists())
    expect(prospectKeys.list('ws-1', { status: 'NEW' })).toEqual([
      'prospects', 'list', 'ws-1', { search: '', status: 'NEW' },
    ])
    expect(prospectKeys.list('ws-1').slice(0, 2)).toEqual(prospectKeys.lists())
    expect(prospectKeys.detail('p1')).toEqual(['prospects', 'detail', 'p1'])
    expect(prospectActivityKeys.list('p1')).toEqual(['prospect-activities', 'p1'])
  })
})

describe('proposal plain functions', () => {
  it('createProposal refuses at the plan limit', async () => {
    answers['agency_subscriptions.select'] = { data: { proposals_limit: 5 }, error: null }
    answers['proposals.select'] = { count: 5, data: null, error: null }
    await expect(createProposal({ title: 'X' })).rejects.toBeInstanceOf(ProposalLimitError)
    expect(writes('proposals', 'insert')).toEqual([])
  })

  it('createProposal stamps the workspace and inserts line items in order', async () => {
    answers['agency_subscriptions.select'] = { data: { proposals_limit: null }, error: null }
    answers['proposals.insert'] = { data: { id: 'pr1' }, error: null }
    await createProposal({ title: 'X', line_items: [{ description: 'A', amount: 10 }] })
    expect(writes('proposals', 'insert')[0].args[0]).toEqual({ title: 'X', agency_user_id: 'ws-1' })
    expect(writes('proposal_line_items', 'insert')[0].args[0]).toEqual([
      { proposal_id: 'pr1', description: 'A', amount: 10, sort_order: 0 },
    ])
  })

  it('deleteProposal archives anything past draft instead of deleting it', async () => {
    await deleteProposal({ id: 'pr1', status: 'SENT' })
    expect(writes('proposals', 'delete')).toEqual([])
    expect(writes('proposals', 'update')[0].args[0].status).toBe('ARCHIVED')
  })
})

describe('prospect plain functions', () => {
  it('createProspect stamps the workspace owner as user_id', async () => {
    await createProspect({ business_name: 'Acme' })
    expect(writes('prospects', 'insert')[0].args[0]).toEqual({ business_name: 'Acme', user_id: 'ws-1' })
  })

  it('updateProspect logs a stage move as Outreach, and not the _prevStatus field', async () => {
    answers['prospects.update'] = { data: { id: 'p1' }, error: null }
    await updateProspect({ id: 'p1', status: 'CONTACTED', _prevStatus: 'NEW' })
    expect(writes('prospects', 'update')[0].args[0]).not.toHaveProperty('_prevStatus')
    const [log] = writes('prospect_activities', 'insert')
    expect(log.args[0]).toMatchObject({
      prospect_id: 'p1',
      type: 'status_change',
      metadata: { from_status: 'NEW', to_status: 'CONTACTED' },
    })
  })

  it('updateProspect logs nothing when the stage is unchanged', async () => {
    answers['prospects.update'] = { data: { id: 'p1' }, error: null }
    await updateProspect({ id: 'p1', notes: 'hi', _prevStatus: 'NEW' })
    expect(writes('prospect_activities', 'insert')).toEqual([])
  })

  it('deleteProspect deletes draft proposals with their file and archives the rest', async () => {
    answers['proposals.select'] = {
      data: [
        { id: 'd1', status: 'DRAFT', file_url: 'https://x/storage/v1/object/public/proposal-files/ws-1/d1/a.pdf' },
        { id: 's1', status: 'SENT', file_url: null },
      ],
      error: null,
    }
    await deleteProspect('p1')
    expect(removed).toEqual(['ws-1/d1/a.pdf'])
    expect(calls.find((c) => c.table === 'proposals' && c.method === 'in' && c.args[1].includes('d1')))
      .toBeTruthy()
    expect(writes('proposals', 'update')[0].args[0].status).toBe('ARCHIVED')
    expect(writes('prospects', 'delete')).toHaveLength(1)
  })

  it('deleteProspect stops before deleting when its proposals cannot be read', async () => {
    answers['proposals.select'] = { data: null, error: new Error('denied') }
    await expect(deleteProspect('p1')).rejects.toThrow('denied')
    expect(writes('prospects', 'delete')).toEqual([])
  })

  it('markProspectConverted links the client and throws on failure', async () => {
    await markProspectConverted({ prospectId: 'p1', clientId: 'c1' })
    expect(writes('prospects', 'update')[0].args[0].converted_client_id).toBe('c1')

    answers['prospects.update'] = { data: null, error: new Error('nope') }
    await expect(markProspectConverted({ prospectId: 'p1', clientId: 'c1' })).rejects.toThrow('nope')
  })
})

describe('outreach plain functions', () => {
  it('logActivity stamps the workspace and defaults the time', async () => {
    answers['prospect_activities.insert'] = { data: { id: 'a1', prospect_id: 'p1' }, error: null }
    await logActivity({ prospect_id: 'p1', type: 'call', body: 'Rang them' })
    const row = writes('prospect_activities', 'insert')[0].args[0]
    expect(row).toMatchObject({ prospect_id: 'p1', user_id: 'ws-1', type: 'call', body: 'Rang them' })
    expect(row.occurred_at).toBeTruthy()
  })
})

describe('sales hooks own their invalidation', () => {
  function setup(useHook) {
    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
    const spy = vi.spyOn(queryClient, 'invalidateQueries')
    const wrapper = ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
    const { result } = renderHook(useHook, { wrapper })
    const invalidated = () => spy.mock.calls.map(([arg]) => arg.queryKey)
    return { result, invalidated }
  }

  it('moving a Prospect stage refreshes its lists, detail and Outreach', async () => {
    answers['prospects.update'] = { data: { id: 'p1' }, error: null }
    const { result, invalidated } = setup(useUpdateProspect)
    await result.current.mutateAsync({ id: 'p1', status: 'CONTACTED', _prevStatus: 'NEW' })
    await waitFor(() => expect(invalidated()).toHaveLength(3))
    expect(invalidated()).toEqual([
      prospectKeys.lists(),
      prospectKeys.detail('p1'),
      prospectActivityKeys.list('p1'),
    ])
  })

  it('logging Outreach refreshes that Prospect\'s activity feed', async () => {
    answers['prospect_activities.insert'] = { data: { id: 'a1', prospect_id: 'p1' }, error: null }
    const { result, invalidated } = setup(useLogActivity)
    await result.current.mutateAsync({ prospect_id: 'p1', type: 'email' })
    await waitFor(() => expect(invalidated()).toEqual([prospectActivityKeys.list('p1')]))
  })

  it('deleting a Prospect refreshes prospects, proposals and documents', async () => {
    answers['proposals.select'] = { data: [], error: null }
    const { result, invalidated } = setup(useDeleteProspect)
    await result.current.mutateAsync('p1')
    await waitFor(() =>
      expect(invalidated()).toEqual([prospectKeys.lists(), proposalKeys.all, documentKeys.all]),
    )
  })
})
