// Email fail-safe policy (ADR 0005). Pure logic, no Deno or npm imports, so it
// can be unit-tested from Vitest (src/tests/edge/emailPolicy.test.js).
//
//   EMAIL_MODE=live      deliver as addressed (production only)
//   EMAIL_MODE=redirect  rewrite every to/cc/bcc to delivered+<name>@resend.dev
//   EMAIL_MODE=block     send nothing
//   unset / anything else → block
//
// Resend has no test mode or recipient allow-list, so this is the only guard
// that holds in every environment, even with copied production data.

export type EmailMode = 'live' | 'redirect' | 'block'

export type EmailPayload = {
  from: string
  to: string | string[]
  cc?: string | string[]
  bcc?: string | string[]
  subject: string
  [key: string]: unknown
}

export type SendResult = {
  data: { id?: string | null; [key: string]: unknown } | null
  error: { message: string; name?: string; [key: string]: unknown } | null
}

export type EmailOutcome = SendResult & {
  mode: EmailMode
  /** true when the message was not handed to the provider at all */
  blocked: boolean
}

type Sender = (payload: EmailPayload) => Promise<SendResult>
type Logger = (level: 'info' | 'error', message: string, fields: Record<string, unknown>) => void

const RECIPIENT_FIELDS = ['to', 'cc', 'bcc'] as const

export function resolveEmailMode(raw: string | undefined | null): EmailMode {
  const mode = (raw ?? '').trim().toLowerCase()
  if (mode === 'live' || mode === 'redirect' || mode === 'block') return mode
  return 'block'
}

function toList(value: string | string[] | undefined): string[] {
  if (value == null) return []
  return (Array.isArray(value) ? value : [value]).filter(Boolean)
}

// "Jane Doe <jane.doe@acme.com>" → "jane.doe@acme.com"
function bareAddress(recipient: string): string {
  const match = recipient.match(/<([^>]+)>/)
  return (match ? match[1] : recipient).trim()
}

// jane.doe@acme.com → delivered+jane.doe@resend.dev. Resend's delivered@
// test inbox accepts any +label, so the original local part stays readable.
export function redirectAddress(recipient: string): string {
  const local = bareAddress(recipient).split('@')[0] ?? ''
  const label = local.toLowerCase().replace(/[^a-z0-9._-]/g, '-').replace(/^-+|-+$/g, '')
  return label ? `delivered+${label}@resend.dev` : 'delivered@resend.dev'
}

export function redirectPayload(payload: EmailPayload): EmailPayload {
  const next: EmailPayload = { ...payload }
  for (const field of RECIPIENT_FIELDS) {
    const list = toList(payload[field])
    if (list.length === 0) continue
    next[field] = [...new Set(list.map(redirectAddress))]
  }
  return next
}

export function recipientsOf(payload: EmailPayload): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const field of RECIPIENT_FIELDS) {
    const list = toList(payload[field])
    if (list.length) out[field] = list
  }
  return out
}

/**
 * Applies the EMAIL_MODE policy, sends through `send`, and logs the outcome.
 * Never throws: a provider error or a thrown exception comes back as `error`,
 * so callers can return a non-2xx response instead of a silent success.
 */
export async function deliverEmail(
  payload: EmailPayload,
  opts: { fn: string; template: string; mode: EmailMode; send: Sender; log: Logger },
): Promise<EmailOutcome> {
  const { fn, template, mode, send, log } = opts
  const base = { fn, template, mode, subject: payload.subject }
  const original = recipientsOf(payload)

  if (toList(payload.to).length === 0) {
    const error = { name: 'missing_recipient', message: 'Email has no recipient' }
    log('error', 'email failed', { ...base, original, error })
    return { data: null, error, mode, blocked: true }
  }

  if (mode === 'block') {
    log('info', 'email blocked', { ...base, original })
    return { data: { id: null, blocked: true }, error: null, mode, blocked: true }
  }

  const outgoing = mode === 'redirect' ? redirectPayload(payload) : payload
  const delivered = recipientsOf(outgoing)

  let result: SendResult
  try {
    result = await send(outgoing)
  } catch (err) {
    result = {
      data: null,
      error: { name: 'send_threw', message: err instanceof Error ? err.message : String(err) },
    }
  }

  if (result.error) {
    log('error', 'email failed', { ...base, original, delivered, error: result.error })
    return { data: null, error: result.error, mode, blocked: false }
  }

  log('info', mode === 'redirect' ? 'email redirected' : 'email sent', {
    ...base,
    ...(mode === 'redirect' ? { original } : {}),
    delivered,
    id: result.data?.id ?? null,
  })
  return { data: result.data, error: null, mode, blocked: false }
}
