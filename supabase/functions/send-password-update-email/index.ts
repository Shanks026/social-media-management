import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Resend } from 'npm:resend'

const resend = new Resend(Deno.env.get('RESEND_API_KEY'))

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )
    
    // Get the user from the JWT to ensure they can only send emails to themselves
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      console.error('Auth error in Edge Function:', userError)
      return new Response(JSON.stringify({ error: 'Unauthorized', details: userError }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { email, type } = await req.json()
    
    // Ensure the email matches the authenticated user
    if (email !== user.email) {
      return new Response(JSON.stringify({ error: 'Email mismatch' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let subject = ''
    let title = ''
    let message = ''

    if (type === 'reset') {
      subject = 'Your password has been reset'
      title = 'Password Reset Successful'
      message = 'This email is to confirm that the password for your Tercero account has just been reset using the "Forgot Password" process.'
    } else if (type === 'change') {
      subject = 'Your password has been changed'
      title = 'Password Changed Successfully'
      message = 'This email is to confirm that the password for your Tercero account has just been changed from your account settings.'
    } else {
      return new Response(JSON.stringify({ error: 'Invalid type provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: auto; background: #ffffff; color: #111827;">
        <div style="padding: 40px 48px 0;">
          <p style="font-size: 13px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #6B7280; margin: 0 0 32px;">Tercero</p>
        </div>
        <div style="padding: 0 48px 40px;">
          <h1 style="font-size: 26px; font-weight: 700; line-height: 1.2; margin: 0 0 16px; color: #111827;">${title}</h1>
          <p style="font-size: 15px; color: #6B7280; line-height: 1.6; margin: 0 0 32px;">Hi there,<br>${message}</p>
          <p style="font-size: 14px; color: #6B7280; line-height: 1.6; margin: 0;">If you did not make this change, please contact support immediately to secure your account.</p>
        </div>
        <div style="border-top: 1px solid #F3F4F6; padding: 20px 48px;">
          <p style="color: #D1D5DB; font-size: 11px; margin: 0;">Tercero &mdash; Ark Labs 2026</p>
        </div>
      </div>
    `

    const { data, error } = await resend.emails.send({
      from: 'Tercero <notifications@tercerospace.com>',
      to: [email],
      subject,
      html,
    })

    if (error) {
      return new Response(JSON.stringify(error), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
