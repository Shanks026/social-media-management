import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { createWrapper } from '../test-utils'

// #204: the Proposals page is its heading around the one Proposals list with
// no scope (spec #200). The real page, list and API hooks run on the recording
// Supabase stub; only the Supabase client and the auth context are replaced.

vi.mock('@/lib/supabase', async () => {
  const { createSupabaseStub } = await import('@/tests/api/supabaseStub')
  const sb = createSupabaseStub()
  return { supabase: sb.client, __stub: sb }
})

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'owner-uid' }, workspaceUserId: 'owner-uid' }),
}))

import { __stub as sb } from '@/lib/supabase'
import ProposalsPage from '@/pages/proposals/ProposalsPage'
import { HeaderProvider } from '@/components/misc/header-context'

// Radix Select needs these in jsdom.
beforeAll(() => {
  Element.prototype.hasPointerCapture ??= () => false
  Element.prototype.releasePointerCapture ??= () => {}
  Element.prototype.scrollIntoView ??= () => {}
})

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
  proposal('b1', 'SENT', { title: 'Globex audit', client_id: 'client-b', client_name: 'Globex' }),
  proposal('p1', 'SENT', {
    title: 'Initech pitch',
    client_id: null,
    client_name: null,
    prospect_id: 'prospect-1',
    prospect_name: 'Initech',
  }),
  proposal('a2', 'ARCHIVED', { title: 'Old pitch' }),
]

const CLIENTS = [
  { id: 'client-a', name: 'Acme', is_internal: false },
  { id: 'client-b', name: 'Globex', is_internal: false },
  { id: 'internal', name: 'Our agency', is_internal: true },
]

function answerWorkspace(rows, proposalsLimit = null) {
  sb.answer('rpc.get_proposals_with_totals', { data: rows, error: null })
  sb.answer('clients', 'select', { data: CLIENTS, error: null })
  sb.answer('agency_subscriptions', 'select', {
    data: { proposals_limit: proposalsLimit, current_storage_used: 0, max_storage_bytes: 0 },
    error: null,
  })
}

function renderPage() {
  const Wrapper = createWrapper()
  return render(
    <Wrapper>
      <MemoryRouter>
        <HeaderProvider>
          <ProposalsPage />
        </HeaderProvider>
      </MemoryRouter>
    </Wrapper>,
  )
}

const rowOf = (title) => screen.getByRole('link', { name: title }).closest('tr')
const titles = () =>
  screen.queryAllByRole('link').map((l) => l.textContent)

async function chooseClient(name) {
  await userEvent.click(screen.getByRole('combobox', { name: 'Client' }))
  await userEvent.click(await screen.findByRole('option', { name }))
}

beforeEach(() => sb.reset())

describe('the Proposals page: Client or Prospect line', () => {
  it('names the Client under each title', async () => {
    answerWorkspace(WORKSPACE)
    renderPage()
    await screen.findByText('Spring launch')

    expect(within(rowOf('Spring launch')).getByText('Acme')).toBeInTheDocument()
    expect(within(rowOf('Globex audit')).getByText('Globex')).toBeInTheDocument()
  })

  it('names the Prospect and marks it as a Prospect', async () => {
    answerWorkspace(WORKSPACE)
    renderPage()
    await screen.findByText('Initech pitch')

    const row = within(rowOf('Initech pitch'))
    expect(row.getByText('Initech')).toBeInTheDocument()
    expect(row.getByText('(prospect)')).toBeInTheDocument()
    expect(within(rowOf('Spring launch')).queryByText('(prospect)')).not.toBeInTheDocument()
  })
})

describe('the Proposals page: Client filter', () => {
  it('lists every non-archived Proposal under All clients', async () => {
    answerWorkspace(WORKSPACE)
    renderPage()
    await screen.findByText('Spring launch')

    expect(titles()).toEqual(['Spring launch', 'Globex audit', 'Initech pitch'])
  })

  it('offers All clients, Prospects and each Client, not the internal account', async () => {
    answerWorkspace(WORKSPACE)
    renderPage()
    await screen.findByText('Spring launch')

    await userEvent.click(screen.getByRole('combobox', { name: 'Client' }))
    const options = (await screen.findAllByRole('option')).map((o) => o.textContent)
    expect(options).toEqual(['All clients', 'Prospects', 'Acme', 'Globex'])
  })

  it('narrows to one Client', async () => {
    answerWorkspace(WORKSPACE)
    renderPage()
    await screen.findByText('Spring launch')

    await chooseClient('Globex')
    expect(titles()).toEqual(['Globex audit'])
  })

  it('narrows to Prospects only', async () => {
    answerWorkspace(WORKSPACE)
    renderPage()
    await screen.findByText('Spring launch')

    await chooseClient('Prospects')
    expect(titles()).toEqual(['Initech pitch'])
  })

  it('offers Reset while a Client is chosen, and Reset shows all clients again', async () => {
    answerWorkspace(WORKSPACE)
    renderPage()
    await screen.findByText('Spring launch')
    expect(screen.queryByRole('button', { name: 'Reset' })).not.toBeInTheDocument()

    await chooseClient('Globex')
    await userEvent.click(screen.getByRole('button', { name: 'Reset' }))

    expect(titles()).toEqual(['Spring launch', 'Globex audit', 'Initech pitch'])
    expect(screen.getByRole('combobox', { name: 'Client' })).toHaveTextContent('All clients')
    expect(screen.queryByRole('button', { name: 'Reset' })).not.toBeInTheDocument()
  })
})

describe('the Proposals page: heading', () => {
  it('shows the same active count as the usage counter', async () => {
    answerWorkspace(WORKSPACE, 5)
    renderPage()

    expect(await screen.findByText('3 of 5 used')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /^Proposals\s*3$/ })).toBeInTheDocument()
  })

  it('keeps the description, with "New Proposal" in the list’s toolbar', async () => {
    answerWorkspace(WORKSPACE)
    renderPage()
    await screen.findByText('Spring launch')

    expect(
      screen.getByText('Upload and track proposals sent to clients and prospects.'),
    ).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /New Proposal/ })).toHaveLength(1)
    expect(screen.getAllByPlaceholderText('Search proposals...')).toHaveLength(1)
  })
})

describe('the Proposals page: empty state', () => {
  it('says the workspace has no Proposals yet, and offers "Upload a proposal"', async () => {
    answerWorkspace([])
    renderPage()

    expect(await screen.findByText('No proposals in this workspace yet.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Upload a proposal' }))
    expect(await screen.findByRole('dialog', { name: 'Upload Proposal' })).toBeInTheDocument()
  })

  it('says nothing matches when the Client filter has none', async () => {
    answerWorkspace(WORKSPACE.filter((p) => p.client_id))
    renderPage()
    await screen.findByText('Spring launch')

    await chooseClient('Prospects')
    expect(screen.getByText('No proposals match your filters.')).toBeInTheDocument()
  })
})
