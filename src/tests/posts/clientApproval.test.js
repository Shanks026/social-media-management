import { describe, it, expect, vi, beforeEach } from 'vitest'

// Regression tests for #104:
// - B10: the approval email went out even when the status change failed,
//   because the dialog awaited `mutate()` (which returns undefined).
// - B5: a failed send surfaced supabase-js's raw
//   "Edge Function returned a non-2xx status code".

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

import {
  sendPostForClientApproval,
  resendApprovalLink,
  ApprovalEmailError,
} from '@/api/posts'

const RAW = 'Edge Function returned a non-2xx status code'
const draft = { id: 'v1', status: 'DRAFT', clients: { email: 'client@example.test' } }

describe('sendPostForClientApproval', () => {
  beforeEach(() => {
    rpc.mockReset().mockResolvedValue({ data: null, error: null })
    invoke.mockReset().mockResolvedValue({ data: null, error: null })
    eq.mockReset().mockResolvedValue({ error: null })
  })

  it('sends no email when the status change fails', async () => {
    rpc.mockResolvedValue({ data: null, error: new Error('permission denied') })

    await expect(sendPostForClientApproval(draft)).rejects.toThrow('permission denied')
    expect(invoke).not.toHaveBeenCalled()
  })

  it('changes the status before sending the email', async () => {
    const order = []
    rpc.mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 10))
      order.push('status')
      return { error: null }
    })
    invoke.mockImplementation(async () => {
      order.push('email')
      return { error: null }
    })

    await sendPostForClientApproval(draft)
    expect(rpc).toHaveBeenCalledWith('send_post_for_approval', { p_post_version_id: 'v1' })
    expect(order).toEqual(['status', 'email'])
  })

  it('skips the status change for a version that is already pending', async () => {
    await sendPostForClientApproval({ ...draft, status: 'PENDING_APPROVAL' })
    expect(rpc).not.toHaveBeenCalled()
    expect(invoke).toHaveBeenCalledOnce()
  })

  it('reports an email failure in plain words, flagged as email-only', async () => {
    invoke.mockResolvedValue({ data: null, error: new Error(RAW) })

    const err = await sendPostForClientApproval(draft).catch((e) => e)
    expect(err).toBeInstanceOf(ApprovalEmailError)
    expect(err.message).not.toContain('non-2xx')
    expect(err.message).toMatch(/couldn't be sent/)
  })
})

describe('resendApprovalLink', () => {
  beforeEach(() => {
    invoke.mockReset().mockResolvedValue({ data: null, error: null })
    eq.mockReset().mockResolvedValue({ error: null })
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
