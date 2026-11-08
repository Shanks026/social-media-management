// The one way edge functions send email. Wraps Resend with the EMAIL_MODE
// fail-safe from ./emailPolicy.ts (ADR 0005): unset means nothing is sent.
//
//   const { data, error } = await sendEmail('send-proposal-email', 'proposal', {
//     from, to: [address], subject, html,
//   })
//   if (error) return new Response(JSON.stringify(error), { status: 500, ... })
//
// Production must have EMAIL_MODE=live set as a function secret BEFORE any
// function using this helper is deployed, or production email stops.

import { Resend } from 'npm:resend'
import { deliverEmail, resolveEmailMode, type EmailOutcome, type EmailPayload } from './emailPolicy.ts'

let client: Resend | null = null
function resend(): Resend {
  client ??= new Resend(Deno.env.get('RESEND_API_KEY'))
  return client
}

function log(level: 'info' | 'error', message: string, fields: Record<string, unknown>) {
  const line = `[email] ${message} ${JSON.stringify(fields)}`
  if (level === 'error') console.error(line)
  else console.log(line)
}

export function sendEmail(fn: string, template: string, payload: EmailPayload): Promise<EmailOutcome> {
  return deliverEmail(payload, {
    fn,
    template,
    mode: resolveEmailMode(Deno.env.get('EMAIL_MODE')),
    // deno-lint-ignore no-explicit-any
    send: (p) => resend().emails.send(p as any) as any,
    log,
  })
}
