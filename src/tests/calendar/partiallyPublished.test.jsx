import { describe, it, expect, vi, beforeEach } from 'vitest'

// Regression tests for audit bug B9: the calendar's "Partially published"
// filter never matched. The filter compared the raw DB status (which is never
// PARTIALLY_PUBLISHED), and get_global_calendar doesn't return
// platform_schedules, so the cells couldn't derive the state either.

const rpc = vi.fn()
const inFn = vi.fn()
const select = vi.fn(() => ({ in: (...a) => inFn(...a) }))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (...a) => rpc(...a),
    from: () => ({ select: (...a) => select(...a) }),
  },
}))

import { fetchGlobalCalendar } from '@/api/posts'
import { matchesPublishStatus } from '@/lib/helper'

const partial = {
  version_id: 'v-partial',
  status: 'SCHEDULED',
  platform_schedules: {
    instagram: { scheduled_at: '2026-11-10T10:00:00Z', published_at: '2026-11-10T10:05:00Z' },
    linkedin: { scheduled_at: '2026-11-11T10:00:00Z', published_at: null },
  },
}
const scheduled = { version_id: 'v-sched', status: 'SCHEDULED', platform_schedules: null }
const published = { version_id: 'v-pub', status: 'PUBLISHED', platform_schedules: null }

describe('matchesPublishStatus', () => {
  it('matches a deliverable published on some of its platforms under PARTIALLY_PUBLISHED', () => {
    expect(matchesPublishStatus(partial, 'PARTIALLY_PUBLISHED')).toBe(true)
    expect(matchesPublishStatus(scheduled, 'PARTIALLY_PUBLISHED')).toBe(false)
  })

  it('matches the other statuses the way the cells show them', () => {
    expect(matchesPublishStatus(scheduled, 'SCHEDULED')).toBe(true)
    expect(matchesPublishStatus(published, 'PUBLISHED')).toBe(true)
    // The cell shows a partial deliverable as partially published, not scheduled
    expect(matchesPublishStatus(partial, 'SCHEDULED')).toBe(false)
    expect(matchesPublishStatus(partial, 'all')).toBe(true)
  })
})

describe('fetchGlobalCalendar', () => {
  beforeEach(() => {
    rpc.mockReset()
    inFn.mockReset()
    select.mockClear()
  })

  it('attaches each version’s platform_schedules so cells and filters can derive the publish state', async () => {
    rpc.mockResolvedValue({
      data: [
        { version_id: 'v-partial', status: 'SCHEDULED' },
        { version_id: 'v-sched', status: 'SCHEDULED' },
      ],
      error: null,
    })
    inFn.mockResolvedValue({
      data: [
        { id: 'v-partial', platform_schedules: partial.platform_schedules },
        { id: 'v-sched', platform_schedules: null },
      ],
      error: null,
    })

    const rows = await fetchGlobalCalendar({ userId: 'owner', currentMonth: new Date(2026, 10, 1) })

    expect(inFn).toHaveBeenCalledWith('id', ['v-partial', 'v-sched'])
    expect(rows.filter((r) => matchesPublishStatus(r, 'PARTIALLY_PUBLISHED')).map((r) => r.version_id))
      .toEqual(['v-partial'])
  })

  it('skips the extra query when the month is empty', async () => {
    rpc.mockResolvedValue({ data: [], error: null })
    expect(await fetchGlobalCalendar({ userId: 'owner', currentMonth: new Date() })).toEqual([])
    expect(inFn).not.toHaveBeenCalled()
  })
})
