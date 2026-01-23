import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Resend } from 'npm:resend'

const resend = new Resend(Deno.env.get('RESEND_API_KEY'))

// This should be the email you used to sign up for Resend
const ADMIN_EMAIL = 'YOUR_RESEND_SIGNUP_EMAIL@example.com'

serve(async (req) => {
  const { record } = await req.json()

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  // --- SCENARIO 1: SEND TO CLIENT (Requesting Approval) ---
  if (record.status === 'PENDING_APPROVAL') {
    const { data: clientInfo } = await supabase
      .from('clients')
      .select('email, name')
      .eq('id', record.client_id)
      .single()

    const { data: tokenData } = await supabase.rpc('generate_version_token', {
      p_version_id: record.id,
    })

    const magicLink = `${Deno.env.get('FRONTEND_URL')}/review/${tokenData}`

    const { data, error } = await resend.emails.send({
      from: 'Social Portal <onboarding@resend.dev>',
      to: [clientInfo.email],
      subject: `Review Required: ${record.title || 'New Social Post'}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee;">
          <h2 style="color: #333;">New Content Ready for Approval</h2>
          <p>Hi ${clientInfo.name},</p>
          <p>A new post version has been submitted for your review.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${magicLink}" style="background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
              Review & Approve
            </a>
          </div>
          <p style="font-size: 12px; color: #666;">This link will expire in 14 days.</p>
        </div>
      `,
    })

    if (error) return new Response(JSON.stringify(error), { status: 500 })
    return new Response(JSON.stringify(data))
  }

  // --- SCENARIO 2: SEND TO ADMIN (Client has Approved or Rejected) ---
  if (record.status === 'APPROVED' || record.status === 'NEEDS_REVISION') {
    const { data: clientInfo } = await supabase
      .from('clients')
      .select('name')
      .eq('id', record.client_id)
      .single()

    const statusLabel =
      record.status === 'APPROVED' ? '✅ APPROVED' : '❌ REVISIONS REQUESTED'
    const feedback = record.client_notes || 'No comments provided.'

    const { data, error } = await resend.emails.send({
      from: 'Social Portal <onboarding@resend.dev>',
      to: [ADMIN_EMAIL],
      subject: `Client Update: ${record.title} is ${record.status}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee;">
          <h2 style="color: #333;">Post Status Update</h2>
          <p><strong>Client:</strong> ${clientInfo?.name}</p>
          <p><strong>Post:</strong> ${record.title}</p>
          <p><strong>New Status:</strong> ${statusLabel}</p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
          <p><strong>Client Feedback:</strong></p>
          <blockquote style="background: #f9f9f9; padding: 15px; border-left: 4px solid #000; font-style: italic;">
            "${feedback}"
          </blockquote>
          <p><a href="${Deno.env.get('FRONTEND_URL')}/clients/${record.client_id}">Go to Dashboard</a></p>
        </div>
      `,
    })

    if (error) return new Response(JSON.stringify(error), { status: 500 })
    return new Response(JSON.stringify(data))
  }

  return new Response('Ignored: Status change does not require notification.')
})
