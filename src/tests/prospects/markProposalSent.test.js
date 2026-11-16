import { describe, it, expect, vi, beforeEach } from 'vitest'

// #143 seam: sending a Proposal advances an early-stage Prospect to
// PROPOSAL_SENT and logs the stage change, and leaves later stages alone.

let prospectStatus
const writes = []

// Minimal chainable stand-in for the supabase-js query builder: records each
// write and answers the two reads markProposalSent makes.
function query(table) {
  const q = { table, op: 'select', payload: null }
  const chain = {
    select: () => chain,
    eq: () => chain,
    in: () => chain,
    update: (payload) => { q.op = 'update'; q.payload = payload; return chain },
    insert: (payload) => { q.op = 'insert'; q.payload = payload; return chain },
    maybeSingle: () => chain,
    single: () => chain,
    then: (resolve) => {
      if (q.op !== 'select') writes.push({ table, op: q.op, payload: q.payload })
      if (table === 'proposals') return resolve({ data: { prospect_id: 'p1' }, error: null })
      if (table === 'prospects' && q.op === 'select') return resolve({ data: { status: prospectStatus }, error: null })
      return resolve({ data: null, error: null })
    },
  }
  return chain
}

vi.mock('@/lib/supabase', () => ({ supabase: { from: (t) => query(t) } }))
vi.mock('@/lib/workspace', () => ({
  resolveWorkspace: async () => ({ workspaceUserId: 'ws1' }),
}))

import { markProposalSent } from '@/api/proposals'

const prospectWrites = () => writes.filter((w) => w.table === 'prospects')
const activityWrites = () => writes.filter((w) => w.table === 'prospect_activities')

describe('markProposalSent', () => {
  beforeEach(() => {
    writes.length = 0
  })

  it('advances a Prospect in Discovery call to Proposal sent and logs it', async () => {
    prospectStatus = 'DISCOVERY_CALL'

    const result = await markProposalSent('prop1')

    expect(result).toEqual({ prospectId: 'p1', advanced: true })
    expect(prospectWrites()).toEqual([
      expect.objectContaining({ op: 'update', payload: expect.objectContaining({ status: 'PROPOSAL_SENT' }) }),
    ])
    expect(activityWrites()[0].payload).toEqual(expect.objectContaining({
      type: 'status_change',
      body: 'Status changed from Discovery Call to Proposal Sent',
      metadata: { from_status: 'DISCOVERY_CALL', to_status: 'PROPOSAL_SENT' },
    }))
  })

  it('advances a Prospect that asked for changes, on resend', async () => {
    prospectStatus = 'CHANGES_REQUESTED'
    expect((await markProposalSent('prop1')).advanced).toBe(true)
  })

  it('leaves a Prospect that is already further along', async () => {
    for (const later of ['PROPOSAL_SENT', 'PROPOSAL_ACCEPTED', 'CONTRACT_SENT', 'WON', 'LOST']) {
      writes.length = 0
      prospectStatus = later
      expect((await markProposalSent('prop1')).advanced).toBe(false)
      expect(prospectWrites()).toEqual([])
      expect(activityWrites()).toEqual([])
    }
  })
})
