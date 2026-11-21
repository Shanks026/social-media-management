import { describe, it, expect, vi, beforeEach } from 'vitest'

// A chainable supabase stub that records every call, so the plain functions
// can be tested without React or a network.
const calls = []
let result = { data: null, error: null }

function chain(table) {
  const node = {}
  for (const method of ['insert', 'update', 'delete', 'select', 'eq', 'in', 'is', 'order']) {
    node[method] = (...args) => {
      calls.push({ table, method, args })
      return node
    }
  }
  node.single = () => Promise.resolve(result)
  node.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject)
  return node
}

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table) => chain(table),
    rpc: (name, args) => {
      calls.push({ rpc: name, args })
      return Promise.resolve(result)
    },
  },
}))
vi.mock('@/lib/workspace', () => ({
  resolveWorkspace: () => Promise.resolve({ workspaceUserId: 'ws-1' }),
}))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ workspaceUserId: 'ws-1' }) }))

import {
  campaignKeys,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  assignPostsToCampaign,
  assignPostCampaign,
  submitCampaignPostReview,
} from '@/api/campaigns'

beforeEach(() => {
  calls.length = 0
  result = { data: null, error: null }
})

describe('campaignKeys', () => {
  it('nests every key under the campaigns prefix', () => {
    expect(campaignKeys.all).toEqual(['campaigns'])
    expect(campaignKeys.detail('c1')).toEqual(['campaigns', 'detail', 'c1'])
    expect(campaignKeys.analytics('c1')[0]).toBe('campaigns')
    expect(campaignKeys.invoices('c1')[0]).toBe('campaigns')
    expect(campaignKeys.activeByClient('cl1')).toEqual(['campaigns', 'active-by-client', 'cl1'])
  })

  it('scopes the list by workspace and client filter', () => {
    expect(campaignKeys.list('ws-1')).toEqual(['campaigns', 'list', 'ws-1', { clientId: null }])
    expect(campaignKeys.list('ws-1', { clientId: 'cl1' })[3]).toEqual({ clientId: 'cl1' })
    expect(campaignKeys.list('ws-1')).not.toEqual(campaignKeys.list('ws-2'))
  })
})

describe('campaign plain functions', () => {
  it('createCampaign stamps the workspace owner as user_id', async () => {
    result = { data: { id: 'c1' }, error: null }
    const created = await createCampaign({ name: 'Launch', client_id: 'cl1' })
    expect(created).toEqual({ id: 'c1' })
    const insert = calls.find((c) => c.method === 'insert')
    expect(insert.table).toBe('campaigns')
    expect(insert.args[0]).toEqual({ name: 'Launch', client_id: 'cl1', user_id: 'ws-1' })
  })

  it('updateCampaign sends the id as a filter, not a column', async () => {
    result = { data: { id: 'c1' }, error: null }
    await updateCampaign({ id: 'c1', name: 'Renamed' })
    const update = calls.find((c) => c.method === 'update')
    expect(update.args[0].name).toBe('Renamed')
    expect(update.args[0]).not.toHaveProperty('id')
    expect(update.args[0].updated_at).toBeTruthy()
    expect(calls.find((c) => c.method === 'eq').args).toEqual(['id', 'c1'])
  })

  it('deleteCampaign deletes by id', async () => {
    await deleteCampaign('c1')
    expect(calls.find((c) => c.method === 'delete')).toBeTruthy()
    expect(calls.find((c) => c.method === 'eq').args).toEqual(['id', 'c1'])
  })

  it('assignPostsToCampaign links many posts at once', async () => {
    await assignPostsToCampaign({ postIds: ['p1', 'p2'], campaignId: 'c1' })
    expect(calls.find((c) => c.method === 'update').args[0]).toEqual({ campaign_id: 'c1' })
    expect(calls.find((c) => c.method === 'in').args).toEqual(['id', ['p1', 'p2']])
  })

  it('assignPostCampaign unlinks with a null campaign', async () => {
    await assignPostCampaign({ postId: 'p1', campaignId: '' })
    expect(calls.find((c) => c.method === 'update').args[0]).toEqual({ campaign_id: null })
  })

  it('throws the supabase error instead of swallowing it', async () => {
    result = { data: null, error: new Error('boom') }
    await expect(deleteCampaign('c1')).rejects.toThrow('boom')
    await expect(createCampaign({ name: 'x' })).rejects.toThrow('boom')
  })

  it('submitCampaignPostReview sends a decision to the public RPC', async () => {
    await submitCampaignPostReview('tok', 'REQUEST_REVISIONS', 'more punch')
    expect(calls[0]).toEqual({
      rpc: 'submit_review_decision',
      args: { p_token: 'tok', p_decision: 'REQUEST_REVISIONS', p_feedback: 'more punch' },
    })
  })
})
