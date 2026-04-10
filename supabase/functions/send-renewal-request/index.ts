import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { Resend } from 'npm:resend'

const resend = new Resend(Deno.env.get('RESEND_API_KEY'))

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const {
      requestType,   // 'renewal' | 'upgrade'
      agencyName,
      agencyEmail,   // workspace owner email
      currentPlan,
      requestedPlan, // only for upgrade
      additionalNotes,
    } = body

    const adminEmail = Deno.env.get('SUPER_ADMIN_EMAIL')
    if (!adminEmail) {
      return new Response('SUPER_ADMIN_EMAIL not configured', { status: 500, headers: corsHeaders })
    }

    const isRenewal = requestType === 'renewal'
    const typeLabel = isRenewal ? 'Renewal Request' : 'Upgrade Request'
    const subject = isRenewal
      ? `[Renewal Request] ${agencyName} — ${currentPlan}`
      : `[Upgrade Request] ${agencyName} — ${currentPlan} → ${requestedPlan}`

    const badgeColor = isRenewal ? '#FEF3C7' : '#EDE9FE'
    const badgeText = isRenewal ? '#92400E' : '#6D28D9'

    const metaRows = [
      `<tr><td style="padding:6px 0;color:#6B7280;font-size:13px;width:160px;vertical-align:top;">Agency</td><td style="padding:6px 0;font-size:13px;">${escapeHtml(agencyName ?? 'Unknown')}</td></tr>`,
      `<tr><td style="padding:6px 0;color:#6B7280;font-size:13px;vertical-align:top;">Email</td><td style="padding:6px 0;font-size:13px;">${escapeHtml(agencyEmail ?? 'Unknown')}</td></tr>`,
      `<tr><td style="padding:6px 0;color:#6B7280;font-size:13px;vertical-align:top;">Current Plan</td><td style="padding:6px 0;font-size:13px;text-transform:capitalize;">${escapeHtml(currentPlan ?? 'Unknown')}</td></tr>`,
      !isRenewal && requestedPlan
        ? `<tr><td style="padding:6px 0;color:#6B7280;font-size:13px;vertical-align:top;">Requested Plan</td><td style="padding:6px 0;font-size:13px;font-weight:600;text-transform:capitalize;">${escapeHtml(requestedPlan)}</td></tr>`
        : '',
    ].filter(Boolean).join('')

    const notesBlock = additionalNotes ? `
      <div style="background:#F9FAFB;border:1px solid #E5E7EB;padding:16px;margin-top:16px;">
        <p style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#9CA3AF;margin:0 0 8px;">Additional Notes</p>
        <p style="font-size:14px;color:#111827;margin:0;white-space:pre-wrap;">${escapeHtml(additionalNotes)}</p>
      </div>` : ''

    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:auto;background:#ffffff;color:#111827;border:1px solid #E5E7EB;">
        <div style="padding:32px 40px 0;">
          <p style="font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#6B7280;margin:0 0 20px;">Tercero · Admin Notification</p>
          <div style="margin-bottom:8px;">
            <span style="display:inline-block;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;padding:3px 8px;border-radius:2px;background:${badgeColor};color:${badgeText};">${typeLabel}</span>
          </div>
          <h1 style="font-size:22px;font-weight:700;margin:0 0 24px;color:#111827;line-height:1.3;">
            ${isRenewal ? `${escapeHtml(agencyName ?? 'An agency')} wants to renew their subscription` : `${escapeHtml(agencyName ?? 'An agency')} has requested a plan upgrade`}
          </h1>
        </div>
        <div style="padding:0 40px 32px;">
          <table style="width:100%;border-collapse:collapse;margin-bottom:8px;">
            <tbody>${metaRows}</tbody>
          </table>
          ${notesBlock}
        </div>
        <div style="border-top:1px solid #F3F4F6;padding:16px 40px;text-align:center;">
          <p style="color:#D1D5DB;font-size:11px;margin:0;">Tercero 2026 · Admin Notification</p>
        </div>
      </div>
    `

    const { data, error } = await resend.emails.send({
      from: 'Tercero Notifications <notifications@tercerospace.com>',
      to: [adminEmail],
      subject,
      html,
    })

    if (error) return new Response(JSON.stringify(error), { status: 500, headers: corsHeaders })
    return new Response(JSON.stringify(data), { headers: corsHeaders })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders })
  }
})
