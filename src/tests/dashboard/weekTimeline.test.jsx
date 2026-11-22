import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { addDays, setHours, startOfDay } from 'date-fns'
import { createWrapper } from '../test-utils'

// #198: one week timeline for the dashboard (the workspace) and a Client's
// overview, tested at the agreed seam: the real component on the real API
// hooks, with only the Supabase client stubbed.

vi.mock('@/lib/supabase', async () => {
  const { createSupabaseStub } = await import('@/tests/api/supabaseStub')
  const sb = createSupabaseStub()
  return { supabase: sb.client, __stub: sb }
})

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'owner-1' }, workspaceUserId: 'owner-1' }),
}))

import { __stub as sb } from '@/lib/supabase'
import WeekTimeline from '@/components/WeekTimeline'

const today = startOfDay(new Date())
const at = (daysAhead, hour = 12) => setHours(addDays(today, daysAhead), hour).toISOString()

// A row as the week query returns it: the Deliverable with its current
// Version and its Client.
function deliverable({ id, title, daysAhead, platform = ['instagram'], client = 'acme' }) {
  const clients = {
    acme: { id: 'c-acme', name: 'Acme Coffee', logo_url: null, is_internal: false },
    bright: { id: 'c-bright', name: 'Brightline Fitness', logo_url: null, is_internal: false },
  }
  return {
    id,
    client_id: clients[client].id,
    post_versions: { id: `v-${id}`, title, status: 'SCHEDULED', platform, target_date: at(daysAhead) },
    clients: clients[client],
  }
}

// Shows where the app navigated, so a test can check a link's target.
function Location() {
  const { pathname, search } = useLocation()
  return <output data-testid="location">{pathname + search}</output>
}

function renderTimeline(props = {}) {
  const Wrapper = createWrapper()
  return render(
    <MemoryRouter>
      <Wrapper>
        <WeekTimeline {...props} />
        <Location />
      </Wrapper>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  sb.reset()
  sb.answer('meetings', 'select', { data: [], error: null })
})

describe('WeekTimeline for one Client', () => {
  it("shows the Client's Deliverables under their day, without Client avatars", async () => {
    sb.answer('posts', 'select', {
      data: [deliverable({ id: 'p1', title: 'Autumn latte teaser', daysAhead: 0 })],
      error: null,
    })

    renderTimeline({ clientId: 'c-acme' })

    await waitFor(() => expect(screen.getByText('1 deliverable · 0 meetings')).toBeInTheDocument())
    expect(screen.getByText('Today')).toBeInTheDocument()
    expect(screen.getByText('1 deliverable')).toBeInTheDocument()
    expect(screen.getByAltText('Instagram')).toBeInTheDocument()
    expect(screen.queryByTitle('Acme Coffee')).not.toBeInTheDocument()
  })

  it('asks the database for this Client, Scheduled or Approved, from the start of today to the end of day 6', async () => {
    sb.answer('posts', 'select', { data: [], error: null })

    renderTimeline({ clientId: 'c-acme' })

    await waitFor(() => expect(screen.getByText('0 deliverables · 0 meetings')).toBeInTheDocument())
    const posts = sb.calls.filter((c) => c.table === 'posts')
    const arg = (method, column) => posts.find((c) => c.method === method && c.args[0] === column)?.args[1]

    expect(arg('in', 'post_versions.status')).toEqual(['SCHEDULED', 'APPROVED'])
    expect(new Date(arg('gte', 'post_versions.target_date'))).toEqual(today)
    // The end of day 6: anything on day 7 is outside the window.
    const end = new Date(arg('lte', 'post_versions.target_date'))
    expect(end > new Date(at(6, 23))).toBe(true)
    expect(end < addDays(today, 7)).toBe(true)
    expect(arg('eq', 'client_id')).toBe('c-acme')
    expect(arg('eq', 'clients.user_id')).toBeUndefined()
  })

  it("shows the Client's meetings under their day, and links to the Client's calendar", async () => {
    sb.answer('posts', 'select', { data: [], error: null })
    sb.answer('meetings', 'select', {
      data: [{ id: 'm1', title: 'Quarterly review', datetime: at(1, 15), client_id: 'c-acme' }],
      error: null,
    })

    renderTimeline({ clientId: 'c-acme' })

    await waitFor(() => expect(screen.getByText('Quarterly review')).toBeInTheDocument())
    expect(screen.getByText('Tomorrow')).toBeInTheDocument()
    expect(screen.getByText('0 deliverables · 1 meeting')).toBeInTheDocument()
    expect(sb.filters('meetings')).toContainEqual(['client_id', 'c-acme'])

    fireEvent.click(screen.getByRole('button', { name: 'Open calendar' }))
    expect(screen.getByTestId('location')).toHaveTextContent('/clients/c-acme?tab=calendar')
  })
})

describe('WeekTimeline for the workspace (dashboard)', () => {
  it("asks for the workspace's Deliverables, not one Client's", async () => {
    sb.answer('posts', 'select', { data: [], error: null })

    renderTimeline()

    await waitFor(() => expect(screen.getByText('0 deliverables · 0 meetings')).toBeInTheDocument())
    expect(sb.filters('posts')).toContainEqual(['clients.user_id', 'owner-1'])
    expect(sb.filters('posts').some(([column]) => column === 'client_id')).toBe(false)
    expect(sb.filters('meetings').some(([column]) => column === 'client_id')).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: 'Open calendar' }))
    expect(screen.getByTestId('location')).toHaveTextContent('/calendar')
  })

  it("groups each day's Deliverables with the Clients they're for", async () => {
    sb.answer('posts', 'select', {
      data: [
        deliverable({ id: 'p1', title: 'Latte teaser', daysAhead: 2, client: 'acme' }),
        deliverable({ id: 'p2', title: 'Trainer Q&A', daysAhead: 2, client: 'bright', platform: ['youtube'] }),
        deliverable({ id: 'p3', title: 'Loyalty card', daysAhead: 4, client: 'acme' }),
      ],
      error: null,
    })

    renderTimeline()

    await waitFor(() => expect(screen.getByText('3 deliverables · 0 meetings')).toBeInTheDocument())
    expect(screen.getByText('2 deliverables')).toBeInTheDocument()
    expect(screen.getByText('1 deliverable')).toBeInTheDocument()
    expect(screen.getAllByTitle('Acme Coffee')).toHaveLength(2)
    expect(screen.getAllByTitle('Brightline Fitness')).toHaveLength(1)
    expect(screen.getByAltText('YouTube')).toBeInTheDocument()
  })
})
