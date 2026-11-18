import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { createWrapper } from '../test-utils'

// Regression test for audit bug B1: "Mark meeting done" used to call
// deleteMeeting on the dashboard, client overview, calendar day dialog and
// calendar meeting card, so marking a meeting done destroyed it.

vi.mock('@/lib/supabase', async () => {
  const { createSupabaseStub } = await import('@/tests/api/supabaseStub')
  const sb = createSupabaseStub()
  return { supabase: sb.client, __stub: sb }
})
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ workspaceUserId: 'ws-1' }) }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { __stub as sb } from '@/lib/supabase'
import { useMarkMeetingDone } from '@/hooks/useMarkMeetingDone'

describe('useMarkMeetingDone', () => {
  beforeEach(() => sb.reset())

  it('marks the meeting completed instead of deleting it', async () => {
    const { result } = renderHook(() => useMarkMeetingDone(), {
      wrapper: createWrapper(),
    })

    result.current.markMeetingDone('meeting-1')

    await waitFor(() => expect(sb.writes('meetings', 'update')).toHaveLength(1))
    expect(sb.writes('meetings', 'update')[0].args[0].completed_at).toBeTruthy()
    expect(sb.filters('meetings')).toContainEqual(['id', 'meeting-1'])
    expect(sb.writes('meetings', 'delete')).toEqual([])
  })
})
