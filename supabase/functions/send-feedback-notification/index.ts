import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { Resend } from 'npm:resend'

const resend = new Resend(Deno.env.get('RESEND_API_KEY'))

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SEVERITY_LABELS: Record<string, string> = {
  low: 'Minor annoyance',
  medium: "It's slowing me down",
  high: "I can't complete my work",
  critical: "I'm completely blocked",
}

const CATEGORY_LABELS: Record<string, string> = {
  feature_request: 'I have a new idea',
  ux_improvement: 'Something could work better',
  performance: 'Something feels off',
  general: 'Other',
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
      type,
      title,
      description,
      severity,
      feature_area,
      steps_to_reproduce,
      category,
      expected_benefit,
      submitterEmail,
      planName,
      agencyName,
      userName,
    } = body

    const adminEmail = Deno.env.get('SUPER_ADMIN_EMAIL')
    if (!adminEmail) {
      return new Response('SUPER_ADMIN_EMAIL not configured', { status: 500, headers: corsHeaders })
    }

    const isBug = type === 'bug_report'
    const subject = isBug ? `[Bug Report] ${title}` : `[Suggestion] ${title}`

    const metaRows = [
      userName ? `<tr><td style="padding:6px 0;color:#6B7280;font-size:13px;width:160px;vertical-align:top;">Name</td><td style="padding:6px 0;font-size:13px;">${escapeHtml(userName)}</td></tr>` : '',
      `<tr><td style="padding:6px 0;color:#6B7280;font-size:13px;width:160px;vertical-align:top;">Email</td><td style="padding:6px 0;font-size:13px;">${escapeHtml(submitterEmail ?? 'Unknown')}</td></tr>`,
      agencyName ? `<tr><td style="padding:6px 0;color:#6B7280;font-size:13px;vertical-align:top;">Agency</td><td style="padding:6px 0;font-size:13px;">${escapeHtml(agencyName)}</td></tr>` : '',
      planName ? `<tr><td style="padding:6px 0;color:#6B7280;font-size:13px;vertical-align:top;">Plan</td><td style="padding:6px 0;font-size:13px;text-transform:capitalize;">${escapeHtml(planName)}</td></tr>` : '',
      isBug && severity ? `<tr><td style="padding:6px 0;color:#6B7280;font-size:13px;vertical-align:top;">Urgency</td><td style="padding:6px 0;font-size:13px;font-weight:600;">${escapeHtml(SEVERITY_LABELS[severity] ?? severity)}</td></tr>` : '',
      isBug && feature_area ? `<tr><td style="padding:6px 0;color:#6B7280;font-size:13px;vertical-align:top;">Feature area</td><td style="padding:6px 0;font-size:13px;">${escapeHtml(feature_area)}</td></tr>` : '',
      !isBug && category ? `<tr><td style="padding:6px 0;color:#6B7280;font-size:13px;vertical-align:top;">Type</td><td style="padding:6px 0;font-size:13px;font-weight:600;">${escapeHtml(CATEGORY_LABELS[category] ?? category)}</td></tr>` : '',
    ].filter(Boolean).join('')

    const extraBlocks = [
      description ? `
        <div style="background:#F9FAFB;border:1px solid #E5E7EB;padding:16px;margin-bottom:12px;">
          <p style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#9CA3AF;margin:0 0 8px;">${isBug ? 'What happened' : 'Description'}</p>
          <p style="font-size:14px;color:#111827;margin:0;white-space:pre-wrap;">${escapeHtml(description)}</p>
        </div>` : '',
      isBug && steps_to_reproduce ? `
        <div style="background:#F9FAFB;border:1px solid #E5E7EB;padding:16px;margin-bottom:12px;">
          <p style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#9CA3AF;margin:0 0 8px;">Additional context</p>
          <p style="font-size:14px;color:#111827;margin:0;white-space:pre-wrap;">${escapeHtml(steps_to_reproduce)}</p>
        </div>` : '',
      !isBug && expected_benefit ? `
        <div style="background:#F9FAFB;border:1px solid #E5E7EB;padding:16px;margin-bottom:12px;">
          <p style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#9CA3AF;margin:0 0 8px;">What this would allow</p>
          <p style="font-size:14px;color:#111827;margin:0;white-space:pre-wrap;">${escapeHtml(expected_benefit)}</p>
        </div>` : '',
    ].filter(Boolean).join('')

    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:auto;background:#ffffff;color:#111827;border:1px solid #E5E7EB;">
        <div style="padding:32px 40px 0;">
          <p style="font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#6B7280;margin:0 0 20px;">Tercero · Admin Notification</p>
          <div style="margin-bottom:8px;">
            <span style="display:inline-block;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;padding:3px 8px;border-radius:2px;background:${isBug ? '#FEF2F2' : '#F5F3FF'};color:${isBug ? '#DC2626' : '#7C3AED'};">${isBug ? 'Bug Report' : 'Suggestion'}</span>
          </div>
          <h1 style="font-size:22px;font-weight:700;margin:0 0 24px;color:#111827;line-height:1.3;">${escapeHtml(title)}</h1>
        </div>

        <div style="padding:0 40px 32px;">
          <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
            <tbody>${metaRows}</tbody>
          </table>
          ${extraBlocks}
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
