import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { createWrapper } from '../test-utils'

// Regression test for audit bug B2: the calendar passed user.id to
// get_global_calendar, so an invited member's calendar came back empty. Since
// #180 (ADR 0008) the function resolves the caller's workspace itself, so the
// browser sends no id at all; workspaceUserId only scopes the cache.

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

  it('sends only the date range; the database resolves the workspace', async () => {
    renderHook(
      () => useGlobalCalendar({ currentMonth: new Date(2026, 10, 7) }),
      { wrapper: createWrapper() },
    )

    await waitFor(() => expect(rpc).toHaveBeenCalled())
    const [name, args] = rpc.mock.calls[0]
    expect(name).toBe('get_global_calendar')
    expect(Object.keys(args).sort()).toEqual(['p_end_date', 'p_start_date'])
  })
})
