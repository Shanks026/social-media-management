import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { addDays } from 'date-fns'
import { createWrapper } from '../test-utils'

// #199: one plan-expired screen for a locked Trial and a locked paid
// subscription, tested at the agreed seam: the real screen on the real hooks,
// with only the Supabase client stubbed.

vi.mock('@/lib/supabase', async () => {
  const { createSupabaseStub } = await import('@/tests/api/supabaseStub')
  const sb = createSupabaseStub()
  return { supabase: sb.client, __stub: sb }
})

const signOut = vi.fn(() => Promise.resolve())
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'owner-1' }, workspaceUserId: 'owner-1', signOut }),
}))

import { __stub as sb } from '@/lib/supabase'
import PlanExpired from '@/pages/PlanExpired'

const daysFromNow = (n) => addDays(new Date(), n).toISOString()

// The agency_subscriptions row useSubscription reads.
const TRIAL_LOCKED = { plan_name: 'trial', trial_ends_at: daysFromNow(-5), agency_name: 'Northwind Social' }
const TRIAL_ACTIVE = { plan_name: 'trial', trial_ends_at: daysFromNow(10), agency_name: 'Northwind Social' }
const SUB_LOCKED = { plan_name: 'velocity', subscription_ends_at: daysFromNow(-10), agency_name: 'Northwind Social' }
const SUB_ACTIVE = { plan_name: 'velocity', subscription_ends_at: daysFromNow(30), agency_name: 'Northwind Social' }

function renderScreen(variant, row) {
  sb.answer('agency_subscriptions', 'select', { data: row, error: null })
  const Wrapper = createWrapper()
  return render(
    <MemoryRouter initialEntries={['/expired']}>
      <Wrapper>
        <Routes>
          <Route path="/expired" element={<PlanExpired variant={variant} />} />
          <Route path="/dashboard" element={<p>Dashboard page</p>} />
          <Route path="/login" element={<p>Login page</p>} />
        </Routes>
      </Wrapper>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  sb.reset()
  signOut.mockClear()
})

describe('PlanExpired, trial', () => {
  it('tells a locked Trial workspace its trial ended, and offers the plans', async () => {
    renderScreen('trial', TRIAL_LOCKED)

    await waitFor(() => expect(screen.getByText(/Your trial has ended/)).toBeInTheDocument())
    expect(screen.getByText(/Northwind Social put in the work/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Choose a Plan/ })).toBeInTheDocument()
    expect(screen.getByText('Pick the right plan for you')).toBeInTheDocument()
  })

  it('sends a Trial that is not locked to the dashboard', async () => {
    renderScreen('trial', TRIAL_ACTIVE)

    await waitFor(() => expect(screen.getByText('Dashboard page')).toBeInTheDocument())
  })

  it('sends a locked paid subscription away from the trial screen', async () => {
    renderScreen('trial', SUB_LOCKED)

    await waitFor(() => expect(screen.getByText('Dashboard page')).toBeInTheDocument())
  })
})

describe('PlanExpired, subscription', () => {
  it('tells a locked paid workspace its plan ended, and offers renewal and the plans', async () => {
    renderScreen('subscription', SUB_LOCKED)

    await waitFor(() => expect(screen.getByText(/Your Velocity subscription/)).toBeInTheDocument())
    expect(screen.getByText(/Northwind Social's account is currently locked/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Renew Velocity/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Upgrade Plan/ })).toBeInTheDocument()
    expect(screen.getByText('Or upgrade to a higher plan')).toBeInTheDocument()
    expect(screen.queryByText(/Your trial has ended/)).not.toBeInTheDocument()
  })

  it('sends a subscription that is not locked to the dashboard', async () => {
    renderScreen('subscription', SUB_ACTIVE)

    await waitFor(() => expect(screen.getByText('Dashboard page')).toBeInTheDocument())
  })

  it('sends a locked Trial away from the subscription screen', async () => {
    renderScreen('subscription', TRIAL_LOCKED)

    await waitFor(() => expect(screen.getByText('Dashboard page')).toBeInTheDocument())
  })
})

describe('PlanExpired, log out', () => {
  it.each(['trial', 'subscription'])('signs out through the auth context, then opens the login page (%s)', async (variant) => {
    renderScreen(variant, variant === 'trial' ? TRIAL_LOCKED : SUB_LOCKED)

    fireEvent.click(await screen.findByRole('button', { name: /Log out/ }))

    await waitFor(() => expect(screen.getByText('Login page')).toBeInTheDocument())
    expect(signOut).toHaveBeenCalledTimes(1)
  })
})
