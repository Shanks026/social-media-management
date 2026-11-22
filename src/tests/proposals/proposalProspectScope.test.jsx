import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { createWrapper } from '../test-utils'

// #203: a Prospect's Proposals tab uses the one Proposals list (spec #200),
// scoped by the Prospect record. The real list and API hooks run on the
// recording Supabase stub; only the Supabase client and auth are replaced.

vi.mock('@/lib/supabase', async () => {
  const { createSupabaseStub } = await import('@/tests/api/supabaseStub')
  const sb = createSupabaseStub()
  return { supabase: sb.client, __stub: sb }
})

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'owner-uid' }, workspaceUserId: 'owner-uid' }),
}))

import { __stub as sb } from '@/lib/supabase'
import { ProposalTab } from '@/components/proposals/ProposalTab'

const INITECH = { id: 'prospect-i', business_name: 'Initech', email: 'bill@initech.test' }

const proposal = (id, status, extra = {}) => ({
  id,
  title: `Proposal ${id}`,
  status,
  client_id: null,
  client_name: null,
  prospect_id: 'prospect-i',
  prospect_name: 'Initech',
  total_value: 1000,
  valid_until: null,
  created_at: '2026-11-01T00:00:00Z',
  proposal_type: 'built',
  file_url: null,
  ...extra,
})

const WORKSPACE = [
  proposal('p1', 'DRAFT', { title: 'Initech pitch' }),
  proposal('p2', 'SENT', { title: 'Initech retainer' }),
  proposal('q1', 'DRAFT', { title: 'Hooli pitch', prospect_id: 'prospect-h', prospect_name: 'Hooli' }),
  proposal('c1', 'SENT', {
    title: 'Acme renewal', client_id: 'client-a', client_name: 'Acme', prospect_id: null, prospect_name: null,
  }),
]

function answerWorkspace(rows, proposalsLimit = null) {
  sb.answer('rpc.get_proposals_with_totals', { data: rows, error: null })
  sb.answer('agency_subscriptions', 'select', {
    data: { proposals_limit: proposalsLimit, current_storage_used: 0, max_storage_bytes: 0 },
    error: null,
  })
}

function renderTab(element = <ProposalTab prospect={INITECH} />) {
  const Wrapper = createWrapper()
  return render(
    <Wrapper>
      <MemoryRouter initialEntries={['/prospects/x']}>
        <Routes>
          <Route path="/prospects/x" element={element} />
          <Route path="/proposals/:proposalId" element={<p>Detail</p>} />
        </Routes>
      </MemoryRouter>
    </Wrapper>,
  )
}

beforeEach(() => sb.reset())

describe('a Prospect’s Proposals tab', () => {
  it('lists only this Prospect’s Proposals, from the workspace list', async () => {
    answerWorkspace(WORKSPACE)
    renderTab()

    expect(await screen.findByText('Initech pitch')).toBeInTheDocument()
    expect(screen.getByText('Initech retainer')).toBeInTheDocument()
    expect(screen.queryByText('Hooli pitch')).not.toBeInTheDocument()
    expect(screen.queryByText('Acme renewal')).not.toBeInTheDocument()
  })

  it('shows no Client line and no Client filter', async () => {
    answerWorkspace(WORKSPACE)
    renderTab()
    await screen.findByText('Initech pitch')

    const headers = screen.getAllByRole('columnheader').map((h) => h.textContent)
    expect(headers.slice(0, 5)).toEqual(['Proposal', 'Total', 'Status', 'Valid Until', 'Created'])
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(screen.queryByText('Initech')).not.toBeInTheDocument()
  })

  it('says there are none for this Prospect yet', async () => {
    answerWorkspace(WORKSPACE)
    renderTab(<ProposalTab prospect={{ id: 'prospect-empty', business_name: 'Nobody', email: null }} />)

    expect(await screen.findByText('No proposals for this prospect yet.')).toBeInTheDocument()
  })

  it('starts a new Proposal already for this Prospect, with their id, name and email', async () => {
    answerWorkspace(WORKSPACE)
    sb.answer('proposals', 'insert', { data: { id: 'new-1' }, error: null })
    renderTab()
    await screen.findByText('Initech pitch')

    await userEvent.click(screen.getByRole('button', { name: 'New Proposal' }))
    const dialog = await screen.findByRole('dialog', { name: 'Upload Proposal' })
    expect(within(dialog).getByText('Initech')).toBeInTheDocument()

    await userEvent.type(within(dialog).getByLabelText(/Title/), 'Initech Q1')
    const pdf = new File(['%PDF'], 'pitch.pdf', { type: 'application/pdf' })
    await userEvent.upload(dialog.querySelector('input[type="file"]'), pdf)
    await userEvent.click(within(dialog).getByRole('button', { name: /^Upload/ }))

    await waitFor(() => expect(sb.writes('proposals', 'insert')).toHaveLength(1))
    expect(sb.writes('proposals', 'insert')[0].args[0]).toMatchObject({
      client_id: null,
      prospect_id: 'prospect-i',
      prospect_name: 'Initech',
      prospect_email: 'bill@initech.test',
    })
  })

  it('refuses a Client and a Prospect together', () => {
    answerWorkspace(WORKSPACE)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => renderTab(<ProposalTab clientId="client-a" prospect={INITECH} />)).toThrow(
      /Client or a Prospect/,
    )
    console.error.mockRestore()
  })
})
