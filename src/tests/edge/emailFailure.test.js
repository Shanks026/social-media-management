import { describe, it, expect, vi } from 'vitest'
import { reportEmailFailure } from '../../../supabase/functions/_shared/emailFailure.ts'

// #174 (ADR 0004): the published email is sent from the database, so the
// browser can't toast a failure. The edge function tells the workspace's
// Owner/Admins instead, with an `email_failed` in-app notification.

function fakeSupabase({ admins = ['owner-1', 'admin-1'], adminsError = null, emitError = null } = {}) {
  const calls = []
  return {
    calls,
    rpc: vi.fn(async (name, args) => {
      calls.push({ name, args })
      if (name === 'workspace_admin_uids') return { data: adminsError ? null : admins, error: adminsError }
      return { data: null, error: emitError }
    }),
  }
}

const context = {
  workspaceId: 'owner-1',
  title: 'The published email to Acme Coffee failed to send',
  body: 'Autumn latte teaser',
  entityType: 'post',
  entityId: 'post-1',
  link: '/clients/c1/deliverables/post-1',
}

describe('reportEmailFailure', () => {
  it('notifies the Owner/Admins once when the provider refused the email', async () => {
    const sb = fakeSupabase()
    const outcome = { data: null, error: { message: 'Missing API key' }, mode: 'redirect', blocked: false }

    expect(await reportEmailFailure(sb, outcome, context)).toBe(true)

    expect(sb.calls).toEqual([
      { name: 'workspace_admin_uids', args: { p_workspace_id: 'owner-1' } },
      {
        name: 'emit_notifications',
        args: {
          p_workspace_id: 'owner-1',
          p_actor: null,
          p_recipients: ['owner-1', 'admin-1'],
          p_type: 'email_failed',
          p_title: context.title,
          p_body: context.body,
          p_entity_type: 'post',
          p_entity_id: 'post-1',
          p_link: '/clients/c1/deliverables/post-1',
        },
      },
    ])
  })

  it('stays quiet when the email went out', async () => {
    const sb = fakeSupabase()
    const outcome = { data: { id: 'x' }, error: null, mode: 'live', blocked: false }
    expect(await reportEmailFailure(sb, outcome, context)).toBe(false)
    expect(sb.calls).toEqual([])
  })

  it('treats a blocked send (EMAIL_MODE, ADR 0005) as policy, not failure', async () => {
    const sb = fakeSupabase()
    const outcome = { data: { id: null, blocked: true }, error: null, mode: 'block', blocked: true }
    expect(await reportEmailFailure(sb, outcome, context)).toBe(false)
    expect(sb.calls).toEqual([])
  })

  it('reports false, without throwing, when the notification itself fails', async () => {
    const sb = fakeSupabase({ emitError: { message: 'db down' } })
    const outcome = { data: null, error: { message: 'boom' }, mode: 'live', blocked: false }
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(await reportEmailFailure(sb, outcome, context)).toBe(false)
    spy.mockRestore()
  })
})
