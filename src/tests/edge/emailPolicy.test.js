import { describe, it, expect, vi } from 'vitest'
import {
  resolveEmailMode,
  redirectAddress,
  deliverEmail,
} from '../../../supabase/functions/_shared/emailPolicy.ts'

const payload = {
  from: 'Agency <notifications@tercerospace.com>',
  to: ['Jane Doe <jane.doe@acme.com>'],
  cc: 'ops@acme.com',
  bcc: ['audit@acme.com', 'audit@other.org'],
  subject: 'Review "Launch post"',
  html: '<p>hi</p>',
}

function run(mode, send = vi.fn().mockResolvedValue({ data: { id: 'em_1' }, error: null })) {
  const log = vi.fn()
  const result = deliverEmail(payload, { fn: 'send-approval-email', template: 'approval-request', mode, send, log })
  return { result, send, log }
}

describe('resolveEmailMode', () => {
  it('blocks when unset, empty or unknown', () => {
    expect(resolveEmailMode(undefined)).toBe('block')
    expect(resolveEmailMode('')).toBe('block')
    expect(resolveEmailMode('production')).toBe('block')
  })
  it('accepts the three modes, case-insensitively', () => {
    expect(resolveEmailMode('live')).toBe('live')
    expect(resolveEmailMode(' Redirect ')).toBe('redirect')
    expect(resolveEmailMode('BLOCK')).toBe('block')
  })
})

describe('redirectAddress', () => {
  it('keeps the original local part as the +label', () => {
    expect(redirectAddress('Jane Doe <Jane.Doe@acme.com>')).toBe('delivered+jane.doe@resend.dev')
    expect(redirectAddress('o\'neil+x@acme.com')).toBe('delivered+o-neil-x@resend.dev')
  })
})

describe('deliverEmail', () => {
  it('block: sends nothing and logs the original recipients', async () => {
    const { result, send, log } = run('block')
    const out = await result
    expect(send).not.toHaveBeenCalled()
    expect(out).toMatchObject({ blocked: true, error: null, mode: 'block' })
    expect(log).toHaveBeenCalledWith('info', 'email blocked', expect.objectContaining({
      fn: 'send-approval-email',
      template: 'approval-request',
      original: { to: ['Jane Doe <jane.doe@acme.com>'], cc: ['ops@acme.com'], bcc: ['audit@acme.com', 'audit@other.org'] },
    }))
  })

  it('redirect: rewrites to, cc and bcc to resend.dev and logs the original', async () => {
    const { result, send, log } = run('redirect')
    await result
    const sent = send.mock.calls[0][0]
    expect(sent.to).toEqual(['delivered+jane.doe@resend.dev'])
    expect(sent.cc).toEqual(['delivered+ops@resend.dev'])
    // two originals with the same local part collapse into one test inbox
    expect(sent.bcc).toEqual(['delivered+audit@resend.dev'])
    expect(sent.from).toBe(payload.from)
    expect(sent.html).toBe(payload.html)
    const [, message, fields] = log.mock.calls[0]
    expect(message).toBe('email redirected')
    expect(fields.original.to).toEqual(['Jane Doe <jane.doe@acme.com>'])
  })

  it('live: sends the payload untouched', async () => {
    const { result, send } = run('live')
    const out = await result
    expect(send).toHaveBeenCalledWith(payload)
    expect(out).toMatchObject({ data: { id: 'em_1' }, error: null, blocked: false })
  })

  it('returns and logs a provider error', async () => {
    const send = vi.fn().mockResolvedValue({ data: null, error: { name: 'validation_error', message: 'bad from' } })
    const { result, log } = run('live', send)
    const out = await result
    expect(out.error).toEqual({ name: 'validation_error', message: 'bad from' })
    expect(log).toHaveBeenCalledWith('error', 'email failed', expect.objectContaining({ fn: 'send-approval-email' }))
  })

  it('turns a thrown exception into an error instead of throwing', async () => {
    const send = vi.fn().mockRejectedValue(new Error('network down'))
    const { result } = run('redirect', send)
    const out = await result
    expect(out.error).toMatchObject({ name: 'send_threw', message: 'network down' })
  })

  it('fails when there is no recipient, in every mode', async () => {
    for (const mode of ['live', 'redirect', 'block']) {
      const send = vi.fn()
      const out = await deliverEmail({ ...payload, to: [null] }, { fn: 'f', template: 't', mode, send, log: vi.fn() })
      expect(send).not.toHaveBeenCalled()
      expect(out.error?.name).toBe('missing_recipient')
    }
  })
})
