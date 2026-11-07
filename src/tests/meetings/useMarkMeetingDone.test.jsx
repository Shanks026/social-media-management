import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { createWrapper } from '../test-utils'

// Regression test for audit bug B1: "Mark meeting done" used to call
// deleteMeeting on the dashboard, client overview, calendar day dialog and
// calendar meeting card, so marking a meeting done destroyed it.

const markMeetingCompleted = vi.fn()
const deleteMeeting = vi.fn()

vi.mock('@/api/meetings', () => ({
  markMeetingCompleted: (...args) => markMeetingCompleted(...args),
  deleteMeeting: (...args) => deleteMeeting(...args),
}))

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { useMarkMeetingDone } from '@/hooks/useMarkMeetingDone'

describe('useMarkMeetingDone', () => {
  beforeEach(() => {
    markMeetingCompleted.mockReset().mockResolvedValue(undefined)
    deleteMeeting.mockReset().mockResolvedValue(undefined)
  })

  it('marks the meeting completed instead of deleting it', async () => {
    const { result } = renderHook(() => useMarkMeetingDone(), {
      wrapper: createWrapper(),
    })

    result.current.markMeetingDone('meeting-1')

    await waitFor(() => expect(markMeetingCompleted).toHaveBeenCalledWith('meeting-1'))
    expect(deleteMeeting).not.toHaveBeenCalled()
  })
})
