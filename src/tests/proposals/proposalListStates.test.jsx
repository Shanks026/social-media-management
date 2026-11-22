import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, renderHook, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { createWrapper } from '../test-utils'

// Code review on spec #200: the one Proposals list's error and loading states,
// and status-tab counts under the Client filter and search. Same seam as the other Proposals tests:
// the real list and API hooks on the recording Supabase stub.

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
  proposal('a2', 'SENT', { title: 'Retainer renewal' }),
  proposal('b1', 'SENT', { title: 'Globex audit', client_id: 'client-b', client_name: 'Globex' }),
  proposal('b2', 'DRAFT', { title: 'Globex brief', client_id: 'client-b', client_name: 'Globex' }),
]

const CLIENTS = [
  { id: 'client-a', name: 'Acme', is_internal: false },
  { id: 'client-b', name: 'Globex', is_internal: false },
]

function answerWorkspace(rpcAnswer, proposalsLimit = 5) {
  sb.answer('rpc.get_proposals_with_totals', rpcAnswer)
  sb.answer('clients', 'select', { data: CLIENTS, error: null })
  sb.answer('agency_subscriptions', 'select', {
    data: { proposals_limit: proposalsLimit, current_storage_used: 0, max_storage_bytes: 0 },
    error: null,
  })
}

const never = () => new Promise(() => {})

function renderList(ui = <ProposalTab />) {
  const Wrapper = createWrapper()
  return render(
    <Wrapper>
      <MemoryRouter>{ui}</MemoryRouter>
    </Wrapper>,
  )
}

const tabNamed = (label) => screen.getByRole('tab', { name: new RegExp(`^${label}`) })
const countOn = (label) => tabNamed(label).textContent.replace(label, '')

beforeEach(() => sb.reset())

describe('the Proposals list: when the Proposals cannot be read', () => {
  it('says so, instead of the empty state and its upload button', async () => {
    answerWorkspace({ data: null, error: { message: 'permission denied' } })
    renderList()

    expect(await screen.findByText(/Couldn.t load proposals/, {}, { timeout: 4000 })).toBeInTheDocument()
    expect(screen.queryByText("You haven't created any proposals yet.")).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Upload a proposal/ })).not.toBeInTheDocument()
  })
})

describe('the Proposals list: status-tab counts', () => {
  it('count what the Client filter leaves', async () => {
    answerWorkspace({ data: WORKSPACE, error: null })
    renderList()
    await screen.findByText('Spring launch')
    expect(countOn('All')).toBe('4')
    expect(countOn('Sent')).toBe('2')

    await userEvent.click(screen.getByRole('combobox', { name: 'Client' }))
    await userEvent.click(await screen.findByRole('option', { name: 'Globex' }))

    expect(countOn('All')).toBe('2')
    expect(countOn('Sent')).toBe('1')
    expect(countOn('Draft')).toBe('1')
  })

  it('count what the search leaves, whichever status tab is chosen', async () => {
    answerWorkspace({ data: WORKSPACE, error: null })
    renderList()
    await screen.findByText('Spring launch')

    await userEvent.click(tabNamed('Sent'))
    await userEvent.type(screen.getByPlaceholderText('Search proposals...'), 'Globex')

    expect(countOn('All')).toBe('2')
    expect(countOn('Sent')).toBe('1')
    expect(countOn('Draft')).toBe('1')
  })
})

describe('the Plan limit while the Proposals load', () => {
  it('reports that it is loading', async () => {
    answerWorkspace(never)
    const { result } = renderHook(() => useProposalLimit(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.limit).toBe(5))
    expect(result.current.isLoading).toBe(true)
  })

  it('hides the counter and keeps "New Proposal" from opening the upload dialog', async () => {
    answerWorkspace(never)
    renderList(<ProposalTab clientId="client-a" />)

    const button = await screen.findByRole('button', { name: /New Proposal/ })
    await waitFor(() => expect(sb.rpcs('get_proposals_with_totals')).toHaveLength(1))
    expect(button).toBeDisabled()
    expect(screen.queryByText(/ used$/)).not.toBeInTheDocument()
  })
})
