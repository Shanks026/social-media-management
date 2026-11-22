import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, renderHook, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { createWrapper } from '../test-utils'

// #201: the Plan's Proposal limit has one owner, useProposalLimit(). The real
// Proposals list and API hooks run on top of the recording Supabase stub; only
// the Supabase client and the auth context are replaced (spec #200).

vi.mock('@/lib/supabase', async () => {
  const { createSupabaseStub } = await import('@/tests/api/supabaseStub')
  const sb = createSupabaseStub()
  return { supabase: sb.client, __stub: sb }
})

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'owner-uid' }, workspaceUserId: 'owner-uid' }),
}))

import { __stub as sb } from '@/lib/supabase'
import { useProposalLimit } from '@/api/proposals'
import { ProposalTab } from '@/components/proposals/ProposalTab'
import ProposalsPage from '@/pages/proposals/ProposalsPage'
import { HeaderProvider } from '@/components/misc/header-context'

const proposal = (id, status, extra = {}) => ({
  id,
  title: `Proposal ${id}`,
  status,
  client_id: 'client-a',
  client_name: 'Acme',
  prospect_id: null,
  prospect_name: null,
  total_value: 1000,
  valid_until: null,
  created_at: '2026-11-01T00:00:00Z',
  proposal_type: 'file',
  file_url: null,
  ...extra,
})

// Five non-archived in the workspace (two of them for another Client), plus
// two archived ones that must not count.
const WORKSPACE = [
  proposal('p1', 'DRAFT'),
  proposal('p2', 'SENT'),
  proposal('p3', 'ACCEPTED'),
  proposal('p4', 'SENT', { client_id: 'client-b', client_name: 'Globex' }),
  proposal('p5', 'DRAFT', { client_id: 'client-b', client_name: 'Globex' }),
  proposal('p6', 'ARCHIVED'),
  proposal('p7', 'ARCHIVED', { client_id: 'client-b', client_name: 'Globex' }),
]

function answerWorkspace(rows, proposalsLimit) {
  sb.answer('rpc.get_proposals_with_totals', { data: rows, error: null })
  sb.answer('agency_subscriptions', 'select', {
    data: { proposals_limit: proposalsLimit, current_storage_used: 0, max_storage_bytes: 0 },
    error: null,
  })
}

function renderInApp(ui) {
  const Wrapper = createWrapper()
  return render(
    <Wrapper>
      <MemoryRouter>
        <HeaderProvider>{ui}</HeaderProvider>
      </MemoryRouter>
    </Wrapper>,
  )
}

beforeEach(() => sb.reset())

describe('useProposalLimit', () => {
  it('counts the workspace’s non-archived Proposals against the Plan’s limit', async () => {
    answerWorkspace(WORKSPACE, 5)
    const { result } = renderHook(() => useProposalLimit(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.limit).toBe(5))
    await waitFor(() => expect(result.current.used).toBe(5))
    expect(result.current.atLimit).toBe(true)
  })

  it('has no limit, and is never at it, on an unlimited Plan', async () => {
    answerWorkspace(WORKSPACE, null)
    const { result } = renderHook(() => useProposalLimit(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.used).toBe(5))
    expect(result.current.limit).toBeNull()
    expect(result.current.atLimit).toBe(false)
  })

  it('is below the limit when archived Proposals would otherwise fill it', async () => {
    answerWorkspace(WORKSPACE, 6)
    const { result } = renderHook(() => useProposalLimit(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.limit).toBe(6))
    await waitFor(() => expect(result.current.used).toBe(5))
    expect(result.current.atLimit).toBe(false)
  })
})

describe('the Proposals page', () => {
  it('shows "used of limit" and the active count in the heading', async () => {
    answerWorkspace(WORKSPACE, 6)
    renderInApp(<ProposalsPage />)

    expect(await screen.findByText('5 of 6 used')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Proposals\s*5/ })).toBeInTheDocument()
  })

  it('shows no counter on an unlimited Plan', async () => {
    answerWorkspace(WORKSPACE, null)
    renderInApp(<ProposalsPage />)

    await screen.findByText('Proposal p1')
    expect(screen.queryByText(/ used$/)).not.toBeInTheDocument()
  })

  it('opens the upgrade prompt from "New Proposal" at the limit', async () => {
    answerWorkspace(WORKSPACE, 5)
    renderInApp(<ProposalsPage />)

    await screen.findByText('5 of 5 used')
    await userEvent.click(screen.getByRole('button', { name: /New Proposal/ }))
    expect(await screen.findByText('Proposal Limit Reached')).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Upload Proposal' })).not.toBeInTheDocument()
  })

  it('opens the upload dialog from "New Proposal" below the limit', async () => {
    answerWorkspace(WORKSPACE, 6)
    renderInApp(<ProposalsPage />)

    await screen.findByText('5 of 6 used')
    await userEvent.click(screen.getByRole('button', { name: /New Proposal/ }))
    expect(await screen.findByRole('dialog', { name: 'Upload Proposal' })).toBeInTheDocument()
    expect(screen.queryByText('Proposal Limit Reached')).not.toBeInTheDocument()
  })
})

describe('a Client’s Proposals tab', () => {
  it('counts the whole workspace, not just this Client', async () => {
    answerWorkspace(WORKSPACE, 6)
    renderInApp(<ProposalTab clientId="client-b" />)

    expect(await screen.findByText('5 of 6 used')).toBeInTheDocument()
  })

  it('lists only this Client’s Proposals', async () => {
    answerWorkspace(WORKSPACE, 6)
    renderInApp(<ProposalTab clientId="client-b" />)

    expect(await screen.findByText('Proposal p4')).toBeInTheDocument()
    expect(screen.getByText('Proposal p5')).toBeInTheDocument()
    expect(screen.queryByText('Proposal p1')).not.toBeInTheDocument()
  })

  it('loads the workspace’s Proposals once, for the list and the limit together', async () => {
    answerWorkspace(WORKSPACE, 6)
    renderInApp(<ProposalTab clientId="client-b" />)

    await screen.findByText('5 of 6 used')
    expect(sb.rpcs('get_proposals_with_totals')).toHaveLength(1)
  })

  it('shows no counter on an unlimited Plan', async () => {
    answerWorkspace(WORKSPACE, null)
    renderInApp(<ProposalTab clientId="client-b" />)

    await screen.findByText('Proposal p4')
    expect(screen.queryByText(/ used$/)).not.toBeInTheDocument()
  })

  it('opens the upgrade prompt at the limit and the upload dialog below it', async () => {
    answerWorkspace(WORKSPACE, 5)
    const { unmount } = renderInApp(<ProposalTab clientId="client-b" />)

    await screen.findByText('5 of 5 used')
    await userEvent.click(screen.getByRole('button', { name: /New Proposal/ }))
    expect(await screen.findByText('Proposal Limit Reached')).toBeInTheDocument()
    unmount()

    sb.reset()
    answerWorkspace(WORKSPACE, 6)
    renderInApp(<ProposalTab clientId="client-b" />)
    await screen.findByText('5 of 6 used')
    await userEvent.click(screen.getByRole('button', { name: /New Proposal/ }))
    expect(await screen.findByRole('dialog', { name: 'Upload Proposal' })).toBeInTheDocument()
  })
})
