import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Resend } from 'npm:resend'

const resend = new Resend(Deno.env.get('RESEND_API_KEY'))

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// --- BRANDING HELPERS ---
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { client_email, client_name, campaign_name, review_url } = await req.json()

    if (!client_email || !review_url) {
      return new Response('Missing required fields', { status: 400, headers: corsHeaders })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Lookup client to find the agency (user_id)
    const { data: client } = await supabase
      .from('clients')
      .select('user_id')
      .eq('email', client_email)
      .limit(1)
      .single()

    const branding = await getBranding(supabase, client?.user_id || '')

    const name = client_name || 'there'
    const campaignLabel = campaign_name || 'Campaign Review'

    const { data, error } = await resend.emails.send({
      from: `${branding.name} <notifications@tercerospace.com>`,
      to: [client_email],
      subject: `Action Required: Review posts for "${campaignLabel}"`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: auto; background: #ffffff; color: #111827; border: 1px solid #E5E7EB;">
          <div style="padding: 40px 48px 0;">
            ${renderEmailHeader(branding)}
          </div>
          <div style="padding: 0 48px 40px;">
            <h1 style="font-size: 26px; font-weight: 700; line-height: 1.2; margin: 0 0 16px; color: #111827;">Posts ready for your review</h1>
            <p style="font-size: 15px; color: #6B7280; line-height: 1.6; margin: 0 0 32px;">Hi ${name},<br>Your agency has submitted posts for the <strong style="color: #111827;">${campaignLabel}</strong> campaign. Please review and approve or request revisions.</p>

            <div style="border-top: 1px solid #E5E7EB; padding: 32px 0;">
              <a href="${review_url}" style="display: inline-block; background: #111827; color: #ffffff; padding: 13px 28px; text-decoration: none; font-size: 14px; font-weight: 600; letter-spacing: 0.01em;">Review Posts &rarr;</a>
            </div>

            <p style="font-size: 13px; color: #9CA3AF; margin: 0;">This link lets you review all pending posts in one session. You can approve or request changes for each one.</p>
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
