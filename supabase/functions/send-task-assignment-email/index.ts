import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Resend } from 'npm:resend'

const resend = new Resend(Deno.env.get('RESEND_API_KEY'))

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Tells someone that a task is now theirs. The one internal-workflow event
// that emails, because assignment is the only one that moves responsibility
// onto a specific person — status changes are progress on work they already
// hold, and go to the in-app bell alone (see tg_notify_task_changes).
//
// Takes ONLY a task_id. The recipient address, the actor's name and the
// opt-out are all resolved server-side, so an authenticated caller cannot
// point this at an arbitrary address and send mail from our domain. Every
// skip returns 200, not an error: the caller fires this after the assignment
// has already been written, and a bounced email must never surface as a
// failed reassignment.
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  try {
    const { task_id } = await req.json()
    if (!task_id) return json({ error: 'Missing task_id' }, 400)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SERVICE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const authHeader = req.headers.get('Authorization') || ''
    if (!authHeader) return json({ error: 'Missing Authorization header' }, 401)

    const { data: { user: actor }, error: userError } =
      await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (userError || !actor) return json({ error: 'Invalid JWT' }, 401)

    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .select('id, title, workspace_id, assigned_to, due_at, priority')
      .eq('id', task_id)
      .maybeSingle()
    if (taskError) return json({ error: taskError.message }, 500)
    if (!task) return json({ error: 'Task not found' }, 404)

    // The actor must belong to the task's workspace. Without this an
    // authenticated user from any other workspace could enumerate task ids
    // and trigger mail to strangers.
    const isWorkspaceOwner = actor.id === task.workspace_id
    if (!isWorkspaceOwner) {
      const { data: actorMembership } = await supabase
        .from('agency_members')
        .select('id')
        .eq('agency_user_id', task.workspace_id)
        .eq('member_user_id', actor.id)
        .eq('is_active', true)
        .maybeSingle()
      if (!actorMembership) return json({ error: 'Not a member of this workspace' }, 403)
    }

    if (!task.assigned_to) return json({ skipped: 'unassigned' })
    // You just did this yourself — the in-app bell already excludes the actor.
    if (task.assigned_to === actor.id) return json({ skipped: 'self_assignment' })

    const { data: assigneeMembership } = await supabase
      .from('agency_members')
      .select('email_task_assignments, is_active')
      .eq('agency_user_id', task.workspace_id)
      .eq('member_user_id', task.assigned_to)
      .maybeSingle()
    if (!assigneeMembership?.is_active) return json({ skipped: 'assignee_inactive' })
    if (assigneeMembership.email_task_assignments === false) return json({ skipped: 'opted_out' })

    const { data: assigneeAuth } = await supabase.auth.admin.getUserById(task.assigned_to)
    const to = assigneeAuth?.user?.email
    if (!to) return json({ skipped: 'no_email' })

    const assigneeName =
      (assigneeAuth.user.user_metadata?.full_name as string | undefined)?.split(' ')[0] || 'there'
    const actorName =
      (actor.user_metadata?.full_name as string | undefined) ||
      actor.email ||
      'A teammate'

    const { data: agency } = await supabase
      .from('agency_subscriptions')
      .select('agency_name')
      .eq('user_id', task.workspace_id)
      .maybeSingle()
    const agencyName = agency?.agency_name || 'your team'

    const appUrl = Deno.env.get('APP_URL') || 'https://tercerospace.com'
    const dueLabel = task.due_at
      ? new Date(task.due_at).toLocaleDateString('en-GB', {
          day: 'numeric', month: 'short', year: 'numeric',
        })
      : null

    const { data, error } = await resend.emails.send({
      from: 'Tercero <notifications@tercerospace.com>',
      to: [to],
      subject: `${actorName} assigned you a task`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: auto; background: #ffffff; color: #111827; border: 1px solid #E5E7EB;">
          <div style="padding: 40px 48px 0;">
            <p style="font-size: 13px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #6B7280; margin: 0 0 32px;">Tercero</p>
          </div>
          <div style="padding: 0 48px 40px;">
            <h1 style="font-size: 26px; font-weight: 700; line-height: 1.2; margin: 0 0 16px; color: #111827;">This one's yours, ${assigneeName}.</h1>
            <p style="font-size: 15px; color: #6B7280; line-height: 1.6; margin: 0 0 32px;">
              <strong style="color: #111827;">${actorName}</strong> assigned you a task in ${agencyName}.
            </p>

            <div style="border-top: 1px solid #E5E7EB; padding: 24px 0;">
              <p style="font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #9CA3AF; margin: 0 0 6px;">Task</p>
              <p style="font-size: 17px; font-weight: 600; color: #111827; margin: 0 0 4px;">${task.title}</p>
              ${dueLabel ? `<p style="font-size: 13px; color: #6B7280; margin: 0;">Due ${dueLabel}</p>` : ''}
            </div>

            <div style="border-top: 1px solid #E5E7EB; padding: 24px 0 32px;">
              <a href="${appUrl}/tasks/${task.id}" style="display: inline-block; background: #111827; color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none; padding: 12px 24px; border-radius: 6px;">Open task</a>
            </div>
          </div>
          <div style="border-top: 1px solid #F3F4F6; padding: 20px 48px; text-align: center;">
            <p style="color: #9CA3AF; font-size: 11px; margin: 0 0 4px;">You can turn these off in Settings &rsaquo; Profile.</p>
            <p style="color: #D1D5DB; font-size: 11px; margin: 0;">Tercero 2026</p>
          </div>
        </div>
      `,
    })

    if (error) return json(error, 500)
    return json(data)
  } catch (err: any) {
    return json({ error: err.message }, 500)
  }
})
