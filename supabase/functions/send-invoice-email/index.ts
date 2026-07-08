import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Buffer } from 'node:buffer'
import { Resend } from 'npm:resend'

const resend = new Resend(Deno.env.get('RESEND_API_KEY'))

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function getBranding(supabase: any, userId: string) {
  const { data: sub } = await supabase
    .from('agency_subscriptions')
    .select('agency_name, logo_url, logo_horizontal_url, branding_agency_sidebar, branding_powered_by')
    .eq('user_id', userId)
    .single()

  const showAgency = sub?.branding_agency_sidebar ?? false
  const poweredBy = sub?.branding_powered_by ?? true

  return {
    name: sub?.agency_name || 'Tercero',
    logo: sub?.logo_url,
    horizontalLogo: sub?.logo_horizontal_url,
    showAgencyBranding: showAgency,
    isVelocity: showAgency && poweredBy,
    isQuantum: showAgency && !poweredBy,
  }
}

function renderEmailHeader(branding: any) {
  if (!branding.showAgencyBranding) {
    return `<p style="font-size: 13px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #6B7280; margin: 0 0 32px;">Tercero</p>`
  }
  const logo = branding.horizontalLogo || branding.logo
  if (logo) {
    return `<img src="${logo}" alt="${branding.name}" style="height: 32px; width: auto; margin-bottom: 32px; display: block;" />`
  }
  return `<p style="font-size: 13px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #6B7280; margin: 0 0 32px;">${branding.name}</p>`
}

function renderEmailFooter(branding: any) {
  if (branding.isQuantum) return ''
  if (branding.isVelocity) {
    return `
      <div style="border-top: 1px solid #F3F4F6; padding: 20px 48px; text-align: center;">
        <p style="color: #D1D5DB; font-size: 11px; margin: 0;">Powered by Tercero</p>
      </div>
    `
  }
  return `
    <div style="border-top: 1px solid #F3F4F6; padding: 20px 48px; text-align: center;">
      <p style="color: #D1D5DB; font-size: 11px; margin: 0;">Tercero 2026</p>
    </div>
  `
}

function fmtDate(d: string | null) {
  if (!d) return null
  try {
    return new Date(d).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  } catch {
    return null
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const {
      recipient_email,
      recipient_name,
      agency_user_id,
      invoice_number,
      total_formatted,
      due_date,
      notes,
      pdf_base64,
      filename,
    } = await req.json()

    if (!recipient_email || !agency_user_id || !pdf_base64) {
      return new Response('Missing required fields', { status: 400, headers: corsHeaders })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SERVICE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const branding = await getBranding(supabase, agency_user_id)

    const name = recipient_name || 'there'
    const invNo = invoice_number || 'Invoice'
    const dueLine = fmtDate(due_date)

    const { data, error } = await resend.emails.send({
      from: `${branding.name} <notifications@tercerospace.com>`,
      to: [recipient_email],
      subject: `Invoice ${invNo} from ${branding.name}`,
      attachments: [
        {
          filename: filename || `${invNo}.pdf`,
          content: Buffer.from(pdf_base64, 'base64'),
        },
      ],
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: auto; background: #ffffff; color: #111827; border: 1px solid #E5E7EB;">
          <div style="padding: 40px 48px 0;">
            ${renderEmailHeader(branding)}
          </div>
          <div style="padding: 0 48px 40px;">
            <h1 style="font-size: 26px; font-weight: 700; line-height: 1.2; margin: 0 0 16px; color: #111827;">You've received an invoice</h1>
            <p style="font-size: 15px; color: #6B7280; line-height: 1.6; margin: 0 0 24px;">
              Hi ${name},<br>
              ${branding.name} has sent you invoice <strong style="color: #111827;">${invNo}</strong>. The PDF is attached to this email.
            </p>
            <div style="border: 1px solid #E5E7EB; border-radius: 8px; padding: 20px 24px; margin: 0 0 24px;">
              <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                <tr>
                  <td style="color: #6B7280; padding: 4px 0;">Invoice</td>
                  <td style="text-align: right; font-weight: 600; color: #111827; padding: 4px 0;">${invNo}</td>
                </tr>
                ${total_formatted ? `
                <tr>
                  <td style="color: #6B7280; padding: 4px 0;">Amount due</td>
                  <td style="text-align: right; font-weight: 700; color: #111827; padding: 4px 0;">${total_formatted}</td>
                </tr>` : ''}
                ${dueLine ? `
                <tr>
                  <td style="color: #6B7280; padding: 4px 0;">Due date</td>
                  <td style="text-align: right; font-weight: 600; color: #111827; padding: 4px 0;">${dueLine}</td>
                </tr>` : ''}
              </table>
            </div>
            ${notes ? `<p style="font-size: 13px; color: #6B7280; line-height: 1.6; margin: 0 0 8px;">${notes}</p>` : ''}
            <p style="font-size: 13px; color: #9CA3AF; margin: 0;">The full invoice is attached as a PDF. Please reply to this email if you have any questions.</p>
          </div>
          ${renderEmailFooter(branding)}
        </div>
      `,
    })

    if (error) return new Response(JSON.stringify(error), { status: 500, headers: corsHeaders })
    return new Response(JSON.stringify(data), { headers: corsHeaders })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders })
  }
})
