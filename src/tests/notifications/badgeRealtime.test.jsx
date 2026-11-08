import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Regression test for audit bug B13: the bell badge and the open bell panel
// both called useUnreadNotificationCount, which subscribed on the topic
// `notifications:<uid>`. realtime-js returns the SAME channel for a repeated
// topic, so when the panel closed its cleanup removed the badge's channel and
// the badge stopped updating until a reload.

// Fake realtime with realtime-js's topic de-duplication.
const channels = new Map()
let countFetches = 0

vi.mock('@/lib/supabase', () => {
  const channel = (topic) => {
    if (channels.has(topic)) return channels.get(topic)
    const ch = {
      topic,
      removed: false,
      handlers: [],
      on(_type, _filter, cb) {
        this.handlers.push(cb)
        return this
      },
      subscribe() {
        return this
      },
    }
    channels.set(topic, ch)
    return ch
  }
  return {
    supabase: {
      channel,
      removeChannel: (ch) => {
        ch.removed = true
        channels.delete(ch.topic)
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            is: async () => {
              countFetches += 1
              return { count: countFetches, error: null }
            },
          }),
        }),
      }),
    },
  }
})

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1' }, workspaceUserId: 'w1' }),
}))

import { useUnreadNotificationCount, useNotificationStream } from '@/api/notifications'

// Deliver an INSERT to every live (not removed) handler, like the server would.
function emitInsert(row = { id: 'n1' }) {
  for (const ch of channels.values()) {
    if (!ch.removed) ch.handlers.forEach((h) => h({ new: row }))
  }
}

describe('notification badge realtime', () => {
  beforeEach(() => {
    channels.clear()
    countFetches = 0
  })

  it('keeps updating the badge after the bell panel closes', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })
    const wrapper = ({ children }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )

    // The bell: badge count + the single arrival stream.
    const bell = renderHook(
      () => {
        useNotificationStream(() => {})
        return useUnreadNotificationCount()
      },
      { wrapper },
    )
    await waitFor(() => expect(bell.result.current.data).toBe(1))

    // The panel opens (a second count consumer), then closes.
    const panel = renderHook(() => useUnreadNotificationCount(), { wrapper })
    panel.unmount()
    expect(bell.result.current.data).toBe(1)

    act(() => emitInsert())
    await waitFor(() => expect(bell.result.current.data).toBe(2))
  })
})
