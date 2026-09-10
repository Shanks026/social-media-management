import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { Resend } from 'npm:resend'

const resend = new Resend(Deno.env.get('RESEND_API_KEY'))

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Sent to a teammate who has just joined an existing workspace via an invite
// link. Distinct from send-signup-welcome, which greets someone who created
// their *own* agency — a joiner has no workspace to set up, so the copy points
// them at the work instead.
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email, name, agency_name, system_role } = await req.json()

    if (!email) {
      return new Response(JSON.stringify({ error: 'Missing email' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const firstName = name?.split(' ')[0] || 'there'
    const agency = agency_name || 'your team'
    const roleLabel = system_role === 'admin' ? 'Admin' : 'Member'
    const appUrl = Deno.env.get('APP_URL') || 'https://tercerospace.com'

    const { data, error } = await resend.emails.send({
      from: 'Tercero <notifications@tercerospace.com>',
      to: [email],
      subject: `Welcome aboard, ${firstName}. ${agency} just got bigger`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: auto; background: #ffffff; color: #111827; border: 1px solid #E5E7EB;">
          <div style="padding: 40px 48px 0;">
            <p style="font-size: 13px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #6B7280; margin: 0 0 32px;">Tercero</p>
          </div>
          <div style="padding: 0 48px 40px;">
            <h1 style="font-size: 26px; font-weight: 700; line-height: 1.2; margin: 0 0 16px; color: #111827;">Good to have you, ${firstName}.</h1>
            <p style="font-size: 15px; color: #6B7280; line-height: 1.6; margin: 0 0 32px;">
              You’re officially part of <strong style="color: #111827;">${agency}</strong> now. Everything the team has on, from clients and content to the deadlines nobody wants to think about, is all in one place. Have a poke around.
            </p>

            <div style="border-top: 1px solid #E5E7EB; padding: 24px 0;">
              <p style="font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #9CA3AF; margin: 0 0 6px;">Signed in as</p>
              <p style="font-size: 17px; font-weight: 600; color: #111827; margin: 0 0 4px;">${email}</p>
              <p style="font-size: 13px; color: #6B7280; margin: 0;">${roleLabel}</p>
            </div>

            <div style="border-top: 1px solid #E5E7EB; padding: 24px 0 32px;">
              <p style="font-size: 14px; color: #6B7280; line-height: 1.7; margin: 0 0 24px;">
                Head to Tasks first. Anything with your name on it is waiting there. Your job titles and access are set by whoever runs the workspace, so give them a nudge if something looks off.
              </p>
              <a href="${appUrl}/tasks" style="display: inline-block; background: #111827; color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none; padding: 12px 24px; border-radius: 6px;">Open Tercero</a>
            </div>
          </div>
          <div style="border-top: 1px solid #F3F4F6; padding: 20px 48px; text-align: center;">
            <p style="color: #D1D5DB; font-size: 11px; margin: 0;">Tercero 2026</p>
          </div>
        </div>
      `,
    })

    if (error) {
      return new Response(JSON.stringify(error), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
