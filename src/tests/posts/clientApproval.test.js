import { describe, it, expect, vi, beforeEach } from 'vitest'

// Sending for Client approval (#175, ADR 0004): the database changes the
// status and queues the approval email in one step, so the browser makes no
// email call and can't send one after a failed status change (B10).
// Resend Link isn't a status change and still calls the edge function; a
// failed send there reads in plain words (B5), not supabase-js's
// "Edge Function returned a non-2xx status code".

const rpc = vi.fn()
const invoke = vi.fn()
const eq = vi.fn()

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (...a) => rpc(...a),
    functions: { invoke: (...a) => invoke(...a) },
    from: () => ({ update: () => ({ eq: (...a) => eq(...a) }) }),
  },
}))

import { sendPostForClientApproval, resendApprovalLink } from '@/api/posts'

const RAW = 'Edge Function returned a non-2xx status code'
const draft = { id: 'v1', status: 'DRAFT', clients: { email: 'client@example.test' } }

describe('sendPostForClientApproval', () => {
  beforeEach(() => {
    rpc.mockReset().mockResolvedValue({ data: null, error: null })
    invoke.mockReset().mockResolvedValue({ data: null, error: null })
  })

  it('goes through send_post_for_approval and makes no email call itself', async () => {
    await sendPostForClientApproval(draft)
    expect(rpc).toHaveBeenCalledWith('send_post_for_approval', { p_post_version_id: 'v1' })
    expect(invoke).not.toHaveBeenCalled()
  })

  it('throws the database refusal', async () => {
    rpc.mockResolvedValue({ data: null, error: new Error('Only an Owner or Admin can send a deliverable for approval') })
    await expect(sendPostForClientApproval(draft)).rejects.toThrow('Only an Owner or Admin')
    expect(invoke).not.toHaveBeenCalled()
  })
})

describe('resendApprovalLink', () => {
  beforeEach(() => {
    invoke.mockReset().mockResolvedValue({ data: null, error: null })
    eq.mockReset().mockResolvedValue({ error: null })
  })

  it('asks the edge function for a fresh link by Version id', async () => {
    await resendApprovalLink(draft)
    expect(invoke).toHaveBeenCalledWith('send-approval-email', {
      body: { record: { id: 'v1', status: 'PENDING_APPROVAL' } },
    })
  })

  it('reports an email failure in plain words', async () => {
    invoke.mockResolvedValue({ data: null, error: new Error(RAW) })

    const err = await resendApprovalLink(draft).catch((e) => e)
    expect(err.message).not.toContain('non-2xx')
    expect(err.message).toMatch(/couldn't be sent/)
  })

  it('sends nothing when the old links cannot be deactivated', async () => {
    eq.mockResolvedValue({ error: new Error('db down') })

    await expect(resendApprovalLink(draft)).rejects.toThrow('db down')
    expect(invoke).not.toHaveBeenCalled()
  })
})
