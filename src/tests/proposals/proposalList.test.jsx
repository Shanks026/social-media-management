import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route, useParams } from 'react-router-dom'
import { createWrapper } from '../test-utils'

// #202: a Client's Proposals tab takes the one Proposals list layout (spec
// #200). The real list and API hooks run on the recording Supabase stub; only
// the Supabase client and the auth context are replaced.

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
  proposal_type: 'built',
  file_url: null,
  ...extra,
})

const WORKSPACE = [
  proposal('a1', 'DRAFT', { title: 'Spring launch' }),
  proposal('a2', 'SENT', { title: 'Retainer renewal', prospect_name: 'Initech' }),
  proposal('a3', 'SENT', { title: 'Brand refresh', proposal_type: 'uploaded' }),
  proposal('a4', 'ARCHIVED', { title: 'Old pitch' }),
  proposal('b1', 'DRAFT', { title: 'Globex audit', client_id: 'client-b', client_name: 'Globex' }),
]

function answerWorkspace(rows, proposalsLimit = null) {
  sb.answer('rpc.get_proposals_with_totals', { data: rows, error: null })
  sb.answer('agency_subscriptions', 'select', {
    data: { proposals_limit: proposalsLimit, current_storage_used: 0, max_storage_bytes: 0 },
    error: null,
  })
}

function DetailPage() {
  const { proposalId } = useParams()
  return <p>Detail of {proposalId}</p>
}

function renderTab(clientId = 'client-a') {
  const Wrapper = createWrapper()
  return render(
    <Wrapper>
      <MemoryRouter initialEntries={['/clients/x']}>
        <Routes>
          <Route path="/clients/x" element={<ProposalTab clientId={clientId} />} />
          <Route path="/proposals/:proposalId" element={<DetailPage />} />
        </Routes>
      </MemoryRouter>
    </Wrapper>,
  )
}

const rowOf = (title) => screen.getByRole('link', { name: title }).closest('tr')

beforeEach(() => sb.reset())

describe('a Client’s Proposals tab: layout', () => {
  it('shows the columns Proposal, Total, Status, Valid Until and Created', async () => {
    answerWorkspace(WORKSPACE)
    renderTab()
    await screen.findByText('Spring launch')

    const headers = screen.getAllByRole('columnheader').map((h) => h.textContent)
    expect(headers.slice(0, 5)).toEqual(['Proposal', 'Total', 'Status', 'Valid Until', 'Created'])
  })

  it('lists only this Client’s Proposals, with no Client line under the title', async () => {
    answerWorkspace(WORKSPACE)
    renderTab()
    await screen.findByText('Spring launch')

    expect(screen.queryByText('Globex audit')).not.toBeInTheDocument()
    expect(screen.queryByText('Acme')).not.toBeInTheDocument()
  })

  it('makes the title a real link to the Proposal', async () => {
    answerWorkspace(WORKSPACE)
    renderTab()

    const link = await screen.findByRole('link', { name: 'Spring launch' })
    expect(link).toHaveAttribute('href', '/proposals/a1')
  })

  it('opens the Proposal when its row is clicked anywhere', async () => {
    answerWorkspace(WORKSPACE)
    renderTab()
    await screen.findByText('Spring launch')

    const totalCell = within(rowOf('Spring launch')).getAllByRole('cell')[1]
    await userEvent.click(totalCell)
    expect(await screen.findByText('Detail of a1')).toBeInTheDocument()
  })
})

describe('a Client’s Proposals tab: search', () => {
  async function searchFor(text) {
    const box = screen.getByPlaceholderText('Search proposals...')
    await userEvent.clear(box)
    if (text) await userEvent.type(box, text)
  }

  it('matches the title, the Client’s name and the Prospect’s name', async () => {
    answerWorkspace(WORKSPACE)
    renderTab()
    await screen.findByText('Spring launch')

    await searchFor('spring')
    expect(screen.getByText('Spring launch')).toBeInTheDocument()
    expect(screen.queryByText('Brand refresh')).not.toBeInTheDocument()

    await searchFor('acme')
    expect(screen.getByText('Spring launch')).toBeInTheDocument()
    expect(screen.getByText('Brand refresh')).toBeInTheDocument()

    await searchFor('initech')
    expect(screen.getByText('Retainer renewal')).toBeInTheDocument()
    expect(screen.queryByText('Spring launch')).not.toBeInTheDocument()
  })

  it('offers Reset only while searching, and Reset clears the search', async () => {
    answerWorkspace(WORKSPACE)
    renderTab()
    await screen.findByText('Spring launch')
    expect(screen.queryByRole('button', { name: 'Reset' })).not.toBeInTheDocument()

    await searchFor('initech')
    await userEvent.click(screen.getByRole('button', { name: 'Reset' }))

    expect(screen.getByPlaceholderText('Search proposals...')).toHaveValue('')
    expect(screen.getByText('Spring launch')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reset' })).not.toBeInTheDocument()
  })
})

async function openMenuOf(title) {
  await userEvent.click(within(rowOf(title)).getByRole('button', { name: 'Actions' }))
  return screen.findByRole('menu')
}

describe('a Client’s Proposals tab: row menu', () => {
  it('offers Edit and Delete for a built Draft, and no "View Details"', async () => {
    answerWorkspace(WORKSPACE)
    renderTab()
    await screen.findByText('Spring launch')

    const menu = await openMenuOf('Spring launch')
    const items = within(menu).getAllByRole('menuitem').map((i) => i.textContent)
    expect(items).toEqual(['Edit', 'Delete'])
  })

  it('hides Edit for an uploaded Proposal', async () => {
    answerWorkspace(WORKSPACE)
    renderTab()
    await screen.findByText('Brand refresh')

    const menu = await openMenuOf('Brand refresh')
    const items = within(menu).getAllByRole('menuitem').map((i) => i.textContent)
    expect(items).toEqual(['Archive'])
  })

  it('hides Edit for an archived Proposal', async () => {
    answerWorkspace(WORKSPACE)
    renderTab()
    await screen.findByText('Spring launch')
    await userEvent.click(screen.getByRole('tab', { name: /Archived/ }))
    await screen.findByText('Old pitch')

    const menu = await openMenuOf('Old pitch')
    expect(within(menu).queryByRole('menuitem', { name: 'Edit' })).not.toBeInTheDocument()
  })

  it('deletes a Draft after confirming', async () => {
    answerWorkspace(WORKSPACE)
    renderTab()
    await screen.findByText('Spring launch')

    const menu = await openMenuOf('Spring launch')
    await userEvent.click(within(menu).getByRole('menuitem', { name: 'Delete' }))
    const confirm = await screen.findByRole('alertdialog')
    await userEvent.click(within(confirm).getByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(sb.writes('proposals', 'delete')).toHaveLength(1))
    expect(sb.writes('proposals', 'update')).toHaveLength(0)
  })

  it('archives anything else after confirming', async () => {
    answerWorkspace(WORKSPACE)
    renderTab()
    await screen.findByText('Retainer renewal')

    const menu = await openMenuOf('Retainer renewal')
    await userEvent.click(within(menu).getByRole('menuitem', { name: 'Archive' }))
    const confirm = await screen.findByRole('alertdialog')
    await userEvent.click(within(confirm).getByRole('button', { name: 'Archive' }))

    await waitFor(() => expect(sb.writes('proposals', 'update')).toHaveLength(1))
    expect(sb.writes('proposals', 'update')[0].args[0]).toMatchObject({ status: 'ARCHIVED' })
    expect(sb.writes('proposals', 'delete')).toHaveLength(0)
  })
})

describe('a Client’s Proposals tab: empty state', () => {
  it('says there are none for this Client yet, and offers "Upload a proposal"', async () => {
    answerWorkspace(WORKSPACE)
    renderTab('client-empty')

    expect(await screen.findByText('No proposals for this client yet.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Upload a proposal' }))
    expect(await screen.findByRole('dialog', { name: 'Upload Proposal' })).toBeInTheDocument()
  })

  it('says nothing matches, without the upload button, when a search is on', async () => {
    answerWorkspace(WORKSPACE)
    renderTab()
    await screen.findByText('Spring launch')

    await userEvent.type(screen.getByPlaceholderText('Search proposals...'), 'zzz')
    expect(screen.getByText('No proposals match your filters.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Upload a proposal' })).not.toBeInTheDocument()
  })

  it('says nothing matches when a status tab has none', async () => {
    answerWorkspace(WORKSPACE)
    renderTab()
    await screen.findByText('Spring launch')

    await userEvent.click(screen.getByRole('tab', { name: /^Declined/ }))
    expect(await screen.findByText('No proposals match your filters.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Upload a proposal' })).not.toBeInTheDocument()
  })
})

describe('a Client’s Proposals tab: status tabs', () => {
  it('counts each status, with "All" leaving out archived Proposals', async () => {
    answerWorkspace(WORKSPACE)
    renderTab()
    await screen.findByText('Spring launch')

    expect(screen.getByRole('tab', { name: /^All\s*3$/ })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: /^Draft\s*1$/ })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /^Sent\s*2$/ })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /^Archived\s*1$/ })).toBeInTheDocument()
    expect(screen.queryByText('Old pitch')).not.toBeInTheDocument()
  })

  it('lists archived Proposals under Archived, and only those', async () => {
    answerWorkspace(WORKSPACE)
    renderTab()
    await screen.findByText('Spring launch')

    await userEvent.click(screen.getByRole('tab', { name: /Archived/ }))
    expect(await screen.findByText('Old pitch')).toBeInTheDocument()
    expect(screen.queryByText('Spring launch')).not.toBeInTheDocument()
  })
})
