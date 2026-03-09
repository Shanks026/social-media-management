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

function renderEmailHeader(branding: any, isInternal: boolean) {
  if (isInternal || !branding.showAgencyBranding) {
    return `<p style="font-size: 13px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #6B7280; margin: 0 0 32px;">Tercero</p>`
  }

  const logo = branding.horizontalLogo || branding.logo
  if (logo) {
    return `<img src="${logo}" alt="${branding.name}" style="height: 32px; width: auto; margin-bottom: 32px; display: block;" />`
  }

  return `<p style="font-size: 13px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #6B7280; margin: 0 0 32px;">${branding.name}</p>`
}

function renderEmailFooter(branding: any, isInternal: boolean) {
  if (!isInternal && branding.isQuantum) return ''

  if (!isInternal && branding.isVelocity) {
    return `
      <div style="border-top: 1px solid #F3F4F6; padding: 20px 48px; text-align: center;">
        <p style="color: #D1D5DB; font-size: 11px; margin: 0;">Powered by Tercero</p>
      </div>
    `
  }

  // Ignite or Internal
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
    const { record } = await req.json()

    const clientEmail = record.email
    const clientName = record.name
    const isInternal = record.is_internal === true

    if (!clientEmail) {
      return new Response('No client email — skipping.', { status: 200, headers: corsHeaders })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Verify JWT manually for better debugging and control
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid JWT', details: userError }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const branding = await getBranding(supabase, record.user_id)
    const agencyName = branding.name

    let subject: string
    let bodyHtml: string

    if (isInternal) {
      // ── INTERNAL: Agency onboarding themselves ──────────────────
      subject = `🎉 Welcome aboard — your workspace is ready`
      bodyHtml = `
        <h1 style="font-size: 26px; font-weight: 700; line-height: 1.2; margin: 0 0 16px; color: #111827;">Your workspace is live. Let's get to work.</h1>
        <p style="font-size: 15px; color: #6B7280; line-height: 1.6; margin: 0 0 32px;">
          Congratulations on setting up <strong style="color: #111827;">${clientName}</strong> — your internal workspace is fully configured and ready to go.
          Think of it as your creative command centre: a dedicated space to plan, draft, and manage your own social presence without the noise.
        </p>

        <div style="border-top: 1px solid #E5E7EB; padding: 24px 0;">
          <p style="font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #9CA3AF; margin: 0 0 6px;">Workspace</p>
          <p style="font-size: 17px; font-weight: 600; color: #111827; margin: 0;">${clientName}</p>
        </div>

        <div style="border-top: 1px solid #E5E7EB; padding: 24px 0 32px;">
          <p style="font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #9CA3AF; margin: 0 0 6px;">Type</p>
          <p style="font-size: 15px; font-weight: 500; color: #111827; margin: 0;">Internal Workspace</p>
        </div>

        <p style="font-size: 14px; color: #6B7280; line-height: 1.7; margin: 0;">
          Start by scheduling your first post or invite your team to collaborate. Everything you build here stays yours — polished, on-brand, and ready to publish on your schedule.
        </p>
      `
    } else {
      // ── EXTERNAL: Agency onboarding a new client ─────────────────
      subject = `🚀 You're in — ${agencyName} has set you up`
      bodyHtml = `
        <h1 style="font-size: 26px; font-weight: 700; line-height: 1.2; margin: 0 0 16px; color: #111827;">Welcome, ${clientName}.</h1>
        <p style="font-size: 15px; color: #6B7280; line-height: 1.6; margin: 0 0 32px;">
          Great news — <strong style="color: #111827;">${agencyName}</strong> has set up your dedicated workspace.
          From here, your content is professionally managed, reviewed with your input, and published on time — every time.
        </p>

        <div style="border-top: 1px solid #E5E7EB; padding: 24px 0;">
          <p style="font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #9CA3AF; margin: 0 0 6px;">Your Workspace</p>
          <p style="font-size: 17px; font-weight: 600; color: #111827; margin: 0;">${clientName}</p>
        </div>

        <div style="border-top: 1px solid #E5E7EB; padding: 24px 0 32px;">
          <p style="font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #9CA3AF; margin: 0 0 6px;">Managed by</p>
          <p style="font-size: 15px; font-weight: 500; color: #111827; margin: 0;">${agencyName}</p>
        </div>

        <p style="font-size: 14px; color: #6B7280; line-height: 1.7; margin: 0;">
          When your team has content ready for your eyes, you'll get a private review link directly in your inbox — no logins, no complexity.
          Just your view, your feedback, and your approval. That's the whole deal.
        </p>
      `
    }

    const { data, error } = await resend.emails.send({
      from: `${branding.name} <notifications@tercerospace.com>`,
      to: [clientEmail],
      subject,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: auto; background: #ffffff; color: #111827; border: 1px solid #E5E7EB;">
          <div style="padding: 40px 48px 0;">
            ${renderEmailHeader(branding, isInternal)}
          </div>
          <div style="padding: 0 48px 40px;">
            ${bodyHtml}
          </div>
          ${renderEmailFooter(branding, isInternal)}
        </div>
      `,
    })

    if (error) return new Response(JSON.stringify(error), { status: 500, headers: corsHeaders })
    return new Response(JSON.stringify(data), { headers: corsHeaders })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders })
  }
})
