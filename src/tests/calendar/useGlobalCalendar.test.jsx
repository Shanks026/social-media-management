import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { createWrapper } from '../test-utils'

// Regression test for audit bug B2: the calendar passed user.id to
// get_global_calendar, which filters clients by c.user_id = p_user_id. For an
// invited member user.id is not the workspace owner's uid, so their calendar
// came back empty.

const rpc = vi.fn()

vi.mock('@/lib/supabase', () => ({
  supabase: { rpc: (...args) => rpc(...args) },
}))

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'member-uid' },
    workspaceUserId: 'owner-uid',
  }),
}))

import { useGlobalCalendar } from '@/api/posts'

describe('useGlobalCalendar', () => {
  beforeEach(() => {
    rpc.mockReset().mockResolvedValue({ data: [], error: null })
  })

  it('scopes the calendar to the workspace owner, not the signed-in member', async () => {
    renderHook(
      () => useGlobalCalendar({ currentMonth: new Date(2026, 10, 7) }),
      { wrapper: createWrapper() },
    )

    await waitFor(() => expect(rpc).toHaveBeenCalled())
    expect(rpc).toHaveBeenCalledWith(
      'get_global_calendar',
      expect.objectContaining({ p_user_id: 'owner-uid' }),
    )
  })
})
