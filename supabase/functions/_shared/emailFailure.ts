// When an email the database queued fails to send, nobody is watching a
// browser to see a toast, so the edge function tells the workspace's
// Owner/Admins with an `email_failed` in-app notification (ADR 0004, #174).
//
// A blocked or redirected send (EMAIL_MODE, ADR 0005) is policy, not failure.
// Pure apart from the client passed in, so Vitest can test it
// (src/tests/edge/emailFailure.test.js).

import type { EmailOutcome } from './emailPolicy.ts'

type RpcClient = {
  // deno-lint-ignore no-explicit-any
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: any; error: any }>
}

export type EmailFailureContext = {
  /** the workspace owner's id (clients.user_id) */
  workspaceId: string
  title: string
  body?: string | null
  entityType?: string | null
  entityId?: string | null
  link?: string | null
}

/**
 * Notifies the workspace's Owner/Admins when `outcome` is a real delivery
 * failure. Never throws.
 *
 * @returns true when a notification was written
 */
export async function reportEmailFailure(
  supabase: RpcClient,
  outcome: Pick<EmailOutcome, 'error' | 'blocked'>,
  ctx: EmailFailureContext,
): Promise<boolean> {
  if (!outcome.error || outcome.blocked) return false

  try {
    const { data: admins, error: adminsError } = await supabase.rpc('workspace_admin_uids', {
      p_workspace_id: ctx.workspaceId,
    })
    if (adminsError) throw adminsError

    const { error } = await supabase.rpc('emit_notifications', {
      p_workspace_id: ctx.workspaceId,
      p_actor: null,
      p_recipients: admins ?? [ctx.workspaceId],
      p_type: 'email_failed',
      p_title: ctx.title,
      p_body: ctx.body ?? null,
      p_entity_type: ctx.entityType ?? null,
      p_entity_id: ctx.entityId ?? null,
      p_link: ctx.link ?? null,
    })
    if (error) throw error
    return true
  } catch (err) {
    console.error('[email] could not record email_failed', JSON.stringify({ ctx, err }))
    return false
  }
}
