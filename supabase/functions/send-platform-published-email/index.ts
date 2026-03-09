import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Resend } from 'npm:resend'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const resend = new Resend(Deno.env.get('RESEND_API_KEY'))

function formatPlatform(p: string): string {
  const map: Record<string, string> = {
    instagram: 'Instagram',
    linkedin: 'LinkedIn',
    twitter: 'Twitter / X',
    facebook: 'Facebook',
    youtube: 'YouTube',
    google_business: 'Google Business',
  }
  return map[p.toLowerCase()] ?? p.charAt(0).toUpperCase() + p.slice(1)
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
  const body = await req.json()
  const { post_version_id, platform, all_published } = body
  console.log('[send-platform-published-email] invoked', { post_version_id, platform, all_published })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  // Fetch post version
  const { data: version, error: vErr } = await supabase
    .from('post_versions')
    .select('id, title, platform, platform_schedules, status, client_id')
    .eq('id', post_version_id)
    .single()

  if (vErr || !version) {
    console.error('[send-platform-published-email] version not found', vErr)
    return new Response('Post version not found', { headers: corsHeaders, status: 404 })
  }

  // Guard: if all_published, verify DB status is PUBLISHED to prevent double-send on re-fire
  if (all_published && version.status !== 'PUBLISHED') {
    console.log('[send-platform-published-email] skipped: status =', version.status)
    return new Response('Skipped: status not yet PUBLISHED', { headers: corsHeaders, status: 200 })
  }

  // Fetch client
  const { data: client, error: cErr } = await supabase
    .from('clients')
    .select('email, name, is_internal, user_id')
    .eq('id', version.client_id)
    .single()

  if (cErr || !client?.email) {
    console.error('[send-platform-published-email] client not found', cErr, 'client_id:', version.client_id)
    return new Response('Client email not found', { headers: corsHeaders, status: 400 })
  }

  // Skip internal clients — agency manages their own content, no need to self-notify
  if (client.is_internal) {
    console.log('[send-platform-published-email] skipped: internal client')
    return new Response('Skipped: internal client', { headers: corsHeaders })
  }

  const branding = await getBranding(supabase, client.user_id)

  const postTitle = version.title || 'Untitled Post'
  const platformLabel = formatPlatform(platform)
  const publishedDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  let subject: string
  let bodyHtml: string

  if (all_published) {
    // All platforms are now live — send the "all published" summary email
    const allPlatforms = (version.platform as string[]).map(formatPlatform).join(', ')
    subject = `🚀 All posts are now live: "${postTitle}"`
    bodyHtml = `
      <h1 style="font-size: 26px; font-weight: 700; line-height: 1.2; margin: 0 0 16px; color: #111827;">All platforms are now live</h1>
      <p style="font-size: 15px; color: #6B7280; line-height: 1.6; margin: 0 0 32px;">Hi ${client.name},<br>Your content has been published across all scheduled platforms and is now fully live.</p>

      <div style="border-top: 1px solid #E5E7EB; padding: 24px 0;">
        <p style="font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #9CA3AF; margin: 0 0 6px;">Post</p>
        <p style="font-size: 17px; font-weight: 600; color: #111827; margin: 0;">${postTitle}</p>
      </div>

      <div style="border-top: 1px solid #E5E7EB; padding: 24px 0;">
        <p style="font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #9CA3AF; margin: 0 0 6px;">Published on</p>
        <p style="font-size: 15px; font-weight: 500; color: #111827; margin: 0;">${allPlatforms}</p>
      </div>

      <div style="border-top: 1px solid #E5E7EB; padding: 24px 0 32px;">
        <p style="font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #9CA3AF; margin: 0 0 6px;">Date</p>
        <p style="font-size: 15px; font-weight: 500; color: #111827; margin: 0;">${publishedDate}</p>
      </div>

      <p style="font-size: 14px; color: #6B7280; line-height: 1.6; margin: 0;">If you have any questions or feedback, please reach out to your account manager.</p>
    `
  } else {
    // Single platform just went live
    subject = `🚀 Your ${platformLabel} post is now live: "${postTitle}"`
    bodyHtml = `
      <h1 style="font-size: 26px; font-weight: 700; line-height: 1.2; margin: 0 0 16px; color: #111827;">Your ${platformLabel} post is live</h1>
      <p style="font-size: 15px; color: #6B7280; line-height: 1.6; margin: 0 0 32px;">Hi ${client.name},<br>Your content has been published on ${platformLabel} and is now live.</p>

      <div style="border-top: 1px solid #E5E7EB; padding: 24px 0;">
        <p style="font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #9CA3AF; margin: 0 0 6px;">Post</p>
        <p style="font-size: 17px; font-weight: 600; color: #111827; margin: 0;">${postTitle}</p>
      </div>

      <div style="border-top: 1px solid #E5E7EB; padding: 24px 0;">
        <p style="font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #9CA3AF; margin: 0 0 6px;">Platform</p>
        <p style="font-size: 15px; font-weight: 500; color: #111827; margin: 0;">${platformLabel}</p>
      </div>

      <div style="border-top: 1px solid #E5E7EB; padding: 24px 0 32px;">
        <p style="font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #9CA3AF; margin: 0 0 6px;">Date Published</p>
        <p style="font-size: 15px; font-weight: 500; color: #111827; margin: 0;">${publishedDate}</p>
      </div>

      <p style="font-size: 14px; color: #6B7280; line-height: 1.6; margin: 0;">Your other platforms may publish on their own scheduled dates. You'll receive a final confirmation once everything is live.</p>
    `
  }

  const { data, error } = await resend.emails.send({
    from: `${branding.name} <notifications@tercerospace.com>`,
    to: [client.email],
    subject,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: auto; background: #ffffff; color: #111827; border: 1px solid #E5E7EB;">
        <div style="padding: 40px 48px 0;">
          ${renderEmailHeader(branding)}
        </div>
        <div style="padding: 0 48px 40px;">
          ${bodyHtml}
        </div>
        ${renderEmailFooter(branding)}
      </div>
    `,
  })

  if (error) {
    console.error('[send-platform-published-email] resend error', error)
    return new Response(JSON.stringify(error), { headers: corsHeaders, status: 500 })
  }
  console.log('[send-platform-published-email] sent ok', data?.id)
  return new Response(JSON.stringify(data), { headers: corsHeaders })
  } catch (err) {
    console.error('[send-platform-published-email] unhandled error', err)
    return new Response(JSON.stringify({ error: String(err) }), { headers: corsHeaders, status: 500 })
  }
})
