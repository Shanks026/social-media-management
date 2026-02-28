import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Resend } from 'npm:resend'

const resend = new Resend(Deno.env.get('RESEND_API_KEY'))

// Capitalize platform names nicely
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
    const postTitle = record.title || 'Untitled Post'

    const { data, error } = await resend.emails.send({
      from: 'Tercero <notifications@tercerospace.com>',
      to: [clientInfo.email],
      subject: `Action Required: Review "${postTitle}"`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: auto; background: #ffffff; color: #111827;">
          <div style="padding: 40px 48px 0;">
            <p style="font-size: 13px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #6B7280; margin: 0 0 32px;">Tercero</p>
          </div>
          <div style="padding: 0 48px 40px;">
            <h1 style="font-size: 26px; font-weight: 700; line-height: 1.2; margin: 0 0 16px; color: #111827;">New content awaiting your review</h1>
            <p style="font-size: 15px; color: #6B7280; line-height: 1.6; margin: 0 0 32px;">Hi ${clientInfo.name},<br>A post has been submitted and is ready for your review and approval.</p>

            <div style="border-top: 1px solid #E5E7EB; padding: 24px 0;">
              <p style="font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #9CA3AF; margin: 0 0 6px;">Post</p>
              <p style="font-size: 17px; font-weight: 600; color: #111827; margin: 0;">${postTitle}</p>
            </div>

            <div style="border-top: 1px solid #E5E7EB; padding: 32px 0;">
              <a href="${magicLink}" style="display: inline-block; background: #111827; color: #ffffff; padding: 13px 28px; text-decoration: none; font-size: 14px; font-weight: 600; letter-spacing: 0.01em;">Review &amp; Respond &rarr;</a>
            </div>

            <p style="font-size: 13px; color: #9CA3AF; margin: 0;">This link is private and expires in 14 days.</p>
          </div>
          <div style="border-top: 1px solid #F3F4F6; padding: 20px 48px;">
            <p style="color: #D1D5DB; font-size: 11px; margin: 0;">Tercero &mdash; Ark Labs 2026</p>
          </div>
        </div>
      `,
    })

    if (error) return new Response(JSON.stringify(error), { status: 500 })
    return new Response(JSON.stringify(data))
  }

  // --- SCENARIO 2: NOTIFY POST CREATOR (SCHEDULED or NEEDS_REVISION) ---
  if (record.status === 'SCHEDULED' || record.status === 'NEEDS_REVISION') {
    const { data: clientInfo } = await supabase
      .from('clients')
      .select('name, is_internal')
      .eq('id', record.client_id)
      .single()

    // Internal posts: the agency scheduled it themselves.
    // Sending a "your post was approved" email back to the agency is noise — skip it.
    if (record.status === 'SCHEDULED' && clientInfo?.is_internal === true) {
      return new Response('Skipped: internal post self-scheduled, no notification needed.')
    }

    const { data: creatorData } = await supabase.auth.admin.getUserById(record.created_by)
    const creatorEmail = creatorData?.user?.email
    if (!creatorEmail) {
      return new Response('Creator email not found', { status: 400 })
    }

    const clientName = clientInfo?.name || 'Your client'
    const postTitle = record.title || 'Untitled Post'
    const targetDate = record.target_date
      ? new Date(record.target_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
      : null

    let subject = ''
    let bodyHtml = ''

    if (record.status === 'SCHEDULED') {
      subject = `✅ Approved & Scheduled by ${clientName}: "${postTitle}"`
      bodyHtml = `
        <h1 style="font-size: 26px; font-weight: 700; line-height: 1.2; margin: 0 0 16px; color: #111827;">Your post was approved</h1>
        <p style="font-size: 15px; color: #6B7280; line-height: 1.6; margin: 0 0 32px;">${clientName} has reviewed your content and given the green light for publication.</p>

        <div style="border-top: 1px solid #E5E7EB; padding: 24px 0;">
          <p style="font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #9CA3AF; margin: 0 0 6px;">Post</p>
          <p style="font-size: 17px; font-weight: 600; color: #111827; margin: 0;">${postTitle}</p>
        </div>

        <div style="border-top: 1px solid #E5E7EB; padding: 24px 0 32px;">
          <p style="font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #9CA3AF; margin: 0 0 6px;">Approved by</p>
          <p style="font-size: 15px; font-weight: 500; color: #111827; margin: 0 0 ${targetDate ? '20px' : '0'};">${clientName}</p>
          ${targetDate ? `
          <p style="font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #9CA3AF; margin: 0 0 6px;">Scheduled for</p>
          <p style="font-size: 15px; font-weight: 600; color: #111827; margin: 0;">${targetDate}</p>
          ` : ''}
        </div>

        <p style="font-size: 14px; color: #6B7280; line-height: 1.6; margin: 0;">This version is now locked. No further action is required.</p>
      `
    } else {
      const clientNotes = record.client_notes || 'No additional notes provided.'
      subject = `✍️ Revision Requested by ${clientName}: "${postTitle}"`
      bodyHtml = `
        <h1 style="font-size: 26px; font-weight: 700; line-height: 1.2; margin: 0 0 16px; color: #111827;">Revision requested</h1>
        <p style="font-size: 15px; color: #6B7280; line-height: 1.6; margin: 0 0 32px;">${clientName} has reviewed your post and requested changes before it can be approved.</p>

        <div style="border-top: 1px solid #E5E7EB; padding: 24px 0;">
          <p style="font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #9CA3AF; margin: 0 0 6px;">Post</p>
          <p style="font-size: 17px; font-weight: 600; color: #111827; margin: 0;">${postTitle}</p>
        </div>

        <div style="border-top: 1px solid #E5E7EB; padding: 24px 0 32px;">
          <p style="font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #9CA3AF; margin: 0 0 12px;">Feedback from ${clientName}</p>
          <p style="font-size: 15px; color: #374151; line-height: 1.7; white-space: pre-wrap; margin: 0; padding-left: 12px; border-left: 2px solid #D1D5DB;">${clientNotes}</p>
        </div>

        <p style="font-size: 14px; color: #6B7280; line-height: 1.6; margin: 0;">Please address the feedback above and submit a new version for review.</p>
      `
    }

    const { data, error } = await resend.emails.send({
      from: 'Tercero <notifications@tercerospace.com>',
      to: [creatorEmail],
      subject,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: auto; background: #ffffff; color: #111827;">
          <div style="padding: 40px 48px 0;">
            <p style="font-size: 13px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #6B7280; margin: 0 0 32px;">Tercero</p>
          </div>
          <div style="padding: 0 48px 40px;">
            ${bodyHtml}
          </div>
          <div style="border-top: 1px solid #F3F4F6; padding: 20px 48px;">
            <p style="color: #D1D5DB; font-size: 11px; margin: 0;">Tercero &mdash; Ark Labs 2026</p>
          </div>
        </div>
      `,
    })

    if (error) return new Response(JSON.stringify(error), { status: 500 })
    return new Response(JSON.stringify(data))
  }

  // --- SCENARIO 3: NOTIFY CLIENT (Post is PUBLISHED) ---
  if (record.status === 'PUBLISHED') {
    const { data: clientInfo } = await supabase
      .from('clients')
      .select('email, name')
      .eq('id', record.client_id)
      .single()

    if (!clientInfo?.email) {
      return new Response('Client email not found', { status: 400 })
    }

    const postTitle = record.title || 'Untitled Post'
    const platforms: string[] = record.platform || []
    const platformList = platforms.length > 0
      ? platforms.map(formatPlatform).join(', ')
      : 'Not specified'
    const publishedDate = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    const targetDate = record.target_date
      ? new Date(record.target_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
      : null

    const { data, error } = await resend.emails.send({
      from: 'Tercero <notifications@tercerospace.com>',
      to: [clientInfo.email],
      subject: `🚀 Your post is live: "${postTitle}"`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: auto; background: #ffffff; color: #111827;">
          <div style="padding: 40px 48px 0;">
            <p style="font-size: 13px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #6B7280; margin: 0 0 32px;">Tercero</p>
          </div>
          <div style="padding: 0 48px 40px;">
            <h1 style="font-size: 26px; font-weight: 700; line-height: 1.2; margin: 0 0 16px; color: #111827;">Your post is now live</h1>
            <p style="font-size: 15px; color: #6B7280; line-height: 1.6; margin: 0 0 32px;">Hi ${clientInfo.name},<br>The content you approved has been published and is now live across the selected platforms.</p>

            <div style="border-top: 1px solid #E5E7EB; padding: 24px 0;">
              <p style="font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #9CA3AF; margin: 0 0 6px;">Post</p>
              <p style="font-size: 17px; font-weight: 600; color: #111827; margin: 0;">${postTitle}</p>
            </div>

            <div style="border-top: 1px solid #E5E7EB; padding: 24px 0;">
              <p style="font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #9CA3AF; margin: 0 0 6px;">Published on</p>
              <p style="font-size: 15px; font-weight: 500; color: #111827; margin: 0;">${platformList}</p>
            </div>

            <div style="border-top: 1px solid #E5E7EB; padding: 24px 0;">
              <p style="font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #9CA3AF; margin: 0 0 6px;">Date Published</p>
              <p style="font-size: 15px; font-weight: 500; color: #111827; margin: 0;">${publishedDate}</p>
            </div>

            ${targetDate ? `
            <div style="border-top: 1px solid #E5E7EB; padding: 24px 0;">
              <p style="font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #9CA3AF; margin: 0 0 6px;">Originally Scheduled For</p>
              <p style="font-size: 15px; font-weight: 500; color: #111827; margin: 0;">${targetDate}</p>
            </div>
            ` : ''}

            <div style="border-top: 1px solid #E5E7EB; padding: 32px 0 0;">
              <p style="font-size: 14px; color: #6B7280; line-height: 1.6; margin: 0;">If you have any questions or feedback, please don't hesitate to reach out to your account manager.</p>
            </div>
          </div>
          <div style="border-top: 1px solid #F3F4F6; padding: 20px 48px;">
            <p style="color: #D1D5DB; font-size: 11px; margin: 0;">Tercero &mdash; Ark Labs 2026</p>
          </div>
        </div>
      `,
    })

    if (error) return new Response(JSON.stringify(error), { status: 500 })
    return new Response(JSON.stringify(data))
  }

  return new Response('Ignored: Status change does not require notification.')
})
