import { describe, it, expect, vi, beforeEach } from 'vitest'

// Regression test for audit bug B17: resolveWorkspace() ignored an error from
// the agency_members lookup, so an invited member hit by a network blip
// silently resolved to their OWN uid, and their reads and writes went to the
// wrong workspace scope.

let lookup
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: { id: 'member-uid' } }, error: null }) },
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({ maybeSingle: async () => lookup }),
        }),
      }),
    }),
  },
}))

import { resolveWorkspace } from '@/lib/workspace'

describe('resolveWorkspace', () => {
  beforeEach(() => {
    lookup = { data: null, error: null }
  })

  it('throws when the membership lookup fails, instead of using the caller’s own id', async () => {
    lookup = { data: null, error: { message: 'Failed to fetch' } }
    await expect(resolveWorkspace()).rejects.toThrow(/workspace/i)
  })

  it('resolves an invited member to the owner’s workspace', async () => {
    lookup = { data: { agency_user_id: 'owner-uid' }, error: null }
    await expect(resolveWorkspace()).resolves.toMatchObject({ workspaceUserId: 'owner-uid' })
  })

  it('treats no membership row as an owner of their own workspace', async () => {
    lookup = { data: null, error: null }
    await expect(resolveWorkspace()).resolves.toMatchObject({ workspaceUserId: 'member-uid' })
  })
})
