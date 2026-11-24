import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// #209: a Client's Documents tab is the one Documents list layout (spec #208).
// The real list and API hooks run on the recording Supabase stub; only the
// Supabase client and the auth context are replaced.

vi.mock('@/lib/supabase', async () => {
  const { createSupabaseStub } = await import('@/tests/api/supabaseStub')
  const sb = createSupabaseStub()
  return { supabase: sb.client, __stub: sb }
})

vi.mock('@/context/AuthContext', async () => {
  const { auth } = await import('./documentsHarness')
  return { useAuth: () => auth }
})

import { __stub as sb } from '@/lib/supabase'
import DocumentsTab from '@/components/documents/DocumentsTab'
import {
  asOwner,
  asMember,
  doc,
  collection,
  answerSubscription,
  renderList,
  shimRadix,
} from './documentsHarness'

beforeAll(shimRadix)

const DOCS = [
  doc('contract', { display_name: 'Master contract', category: 'Contract' }),
  doc('brief', { display_name: 'Spring brief', category: 'Creative Brief', collection_id: 'col-1' }),
  doc('logo', { display_name: 'Logo pack', category: 'Brand Assets' }),
  doc('old', { display_name: 'Old terms', category: 'Contract', status: 'ARCHIVED' }),
]

function answerClient({ docs = DOCS, collections = [collection('col-1')], plan = {} } = {}) {
  sb.answer('client_documents', 'select', { data: docs, error: null })
  sb.answer('document_collections', 'select', { data: collections, error: null })
  answerSubscription(sb, plan)
}

function renderTab() {
  return renderList(<DocumentsTab clientId="client-a" />)
}

async function pick(name, option) {
  await userEvent.click(screen.getByRole('combobox', { name }))
  await userEvent.click(await screen.findByRole('option', { name: option }))
}

beforeEach(() => {
  sb.reset()
  asOwner()
})

describe('a Client’s Documents tab: tabs', () => {
  it('shows All, Collections and Ungrouped with counts, leaving archived out by default', async () => {
    answerClient()
    renderTab()
    await screen.findByText('Master contract')

    expect(screen.getByRole('tab', { name: /^All\s*3$/ })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: /^Collections\s*1$/ })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /^Ungrouped\s*2$/ })).toBeInTheDocument()
    expect(screen.queryByText('Old terms')).not.toBeInTheDocument()
  })

  it('asks the database for this Client’s documents only', async () => {
    answerClient()
    renderTab()
    await screen.findByText('Master contract')

    expect(sb.filters('client_documents')).toContainEqual(['client_id', 'client-a'])
  })

  it('keeps the chosen tab in the address bar and opens from it', async () => {
    answerClient()
    renderTab()
    await screen.findByText('Master contract')

    await userEvent.click(screen.getByRole('tab', { name: /^Ungrouped/ }))
    expect(screen.getByTestId('search')).toHaveTextContent('doc_tab=ungrouped')
    expect(screen.queryByText('Collection col-1')).not.toBeInTheDocument()
    expect(screen.getByText('Logo pack')).toBeInTheDocument()
  })

  it('lists the Client’s collections directly, with their documents', async () => {
    answerClient()
    renderTab()
    await screen.findByText('Master contract')

    await userEvent.click(screen.getByRole('tab', { name: /^Collections/ }))
    expect(await screen.findByText('Collection col-1')).toBeInTheDocument()
    expect(screen.queryByText('Acme')).not.toBeInTheDocument()
  })
})

describe('a Client’s Documents tab: filters', () => {
  it('searches by name once typing pauses', async () => {
    answerClient()
    renderTab()
    await screen.findByText('Master contract')

    await userEvent.type(screen.getByPlaceholderText('Search documents…'), 'logo')
    expect(await screen.findByText('Logo pack')).toBeInTheDocument()
    await vi.waitFor(() => expect(screen.queryByText('Master contract')).not.toBeInTheDocument())
  })

  it('filters by status: Archived shows only archived, All shows both', async () => {
    answerClient()
    renderTab()
    await screen.findByText('Master contract')

    await pick('Status', 'Archived')
    expect(screen.getByText('Old terms')).toBeInTheDocument()
    expect(screen.queryByText('Master contract')).not.toBeInTheDocument()

    await pick('Status', 'All statuses')
    expect(screen.getByText('Old terms')).toBeInTheDocument()
    expect(screen.getByText('Master contract')).toBeInTheDocument()
  })

  it('filters by the Client categories', async () => {
    answerClient()
    renderTab()
    await screen.findByText('Master contract')

    await userEvent.click(screen.getByRole('combobox', { name: 'Category' }))
    expect(await screen.findByRole('option', { name: 'Brand Guidelines' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Pitch Deck' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('option', { name: 'Contract' }))

    expect(screen.getByText('Master contract')).toBeInTheDocument()
    expect(screen.queryByText('Logo pack')).not.toBeInTheDocument()
  })

  it('offers Clear filters only while one is set, and it restores the list', async () => {
    answerClient()
    renderTab()
    await screen.findByText('Master contract')
    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument()

    await pick('Category', 'Contract')
    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }))

    expect(screen.getByText('Logo pack')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument()
  })
})

describe('a Client’s Documents tab: toolbar', () => {
  it('offers Upload and New Collection to someone who manages documents', async () => {
    answerClient()
    renderTab()
    await screen.findByText('Master contract')

    expect(screen.getByRole('button', { name: /Upload Document/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /New Collection/ })).toBeEnabled()
  })

  it('shows New Collection locked, with the reason, on a Plan without collections', async () => {
    answerClient({ plan: { collections: false } })
    renderTab()
    await screen.findByText('Master contract')

    const button = screen.getByRole('button', { name: /New Collection/ })
    expect(button).toBeDisabled()
    await userEvent.hover(button.parentElement)
    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      'Collections are available on Velocity and above',
    )
  })

  it('gives a Member with view-only access no Upload, no New Collection and no manage actions', async () => {
    asMember('view')
    answerClient()
    renderTab()
    await screen.findByText('Master contract')

    expect(screen.queryByRole('button', { name: /Upload Document/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /New Collection/ })).not.toBeInTheDocument()

    for (const tab of [/^All/, /^Collections/, /^Ungrouped/]) {
      await userEvent.click(screen.getByRole('tab', { name: tab }))
      if (tab.source === '^Collections') {
        await userEvent.click(await screen.findByText('Collection col-1'))
        expect(screen.queryByRole('button', { name: 'Collection actions' })).not.toBeInTheDocument()
      }
      for (const trigger of screen.getAllByRole('button', { name: 'Document actions' })) {
        await userEvent.click(trigger)
        const menu = await screen.findByRole('menu')
        expect(within(menu).getAllByRole('menuitem').map((i) => i.textContent)).toEqual(['Download'])
        await userEvent.keyboard('{Escape}')
      }
    }
  })

  it('gives a Member with manage access the manage actions', async () => {
    asMember('manage')
    answerClient()
    renderTab()
    await screen.findByText('Master contract')

    expect(screen.getByRole('button', { name: /Upload Document/ })).toBeInTheDocument()
    await userEvent.click(screen.getAllByRole('button', { name: 'Document actions' })[0])
    const menu = await screen.findByRole('menu')
    expect(within(menu).getByRole('menuitem', { name: /Archive/ })).toBeInTheDocument()
  })
})

describe('a Client’s Documents tab: empty states', () => {
  it('invites an upload when there are no documents', async () => {
    answerClient({ docs: [] })
    renderTab()

    expect(
      await screen.findByText('Upload a contract, brief, or brand asset to get started.'),
    ).toBeInTheDocument()
  })

  it('offers "View archived (N)" when only archived documents exist', async () => {
    answerClient({ docs: [DOCS[3]] })
    renderTab()

    await userEvent.click(await screen.findByRole('button', { name: 'View archived (1)' }))
    expect(await screen.findByText('Old terms')).toBeInTheDocument()
  })

  it('says nothing matches, and offers Clear filters, when filters match nothing', async () => {
    answerClient()
    renderTab()
    await screen.findByText('Master contract')

    await userEvent.type(screen.getByPlaceholderText('Search documents…'), 'zzz')
    expect(await screen.findByText('No documents match your filters')).toBeInTheDocument()
    const clears = screen.getAllByRole('button', { name: 'Clear filters' })
    await userEvent.click(clears[clears.length - 1])
    expect(await screen.findByText('Master contract')).toBeInTheDocument()
  })

  it('offers New Collection on the Collections tab when there are none', async () => {
    answerClient({ collections: [] })
    renderTab()
    await screen.findByText('Master contract')

    await userEvent.click(screen.getByRole('tab', { name: /^Collections/ }))
    expect(await screen.findByText('No collections yet')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /New Collection/ }).length).toBeGreaterThan(1)
  })

  it('explains that every document is in a collection on an empty Ungrouped tab', async () => {
    answerClient({ docs: [DOCS[1]] })
    renderTab()
    await screen.findByText('Collection col-1')

    await userEvent.click(screen.getByRole('tab', { name: /^Ungrouped/ }))
    expect(await screen.findByText('No ungrouped documents')).toBeInTheDocument()
    expect(screen.getByText('All documents are organised into collections.')).toBeInTheDocument()
  })
})

describe('a Client’s Documents tab: loading and errors', () => {
  it('shows placeholder rows while loading', async () => {
    answerClient()
    sb.answer('client_documents', 'select', () => new Promise(() => {}))
    const { container } = renderTab()

    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0)
  })

  it('says the load failed, never an empty list', async () => {
    answerClient()
    sb.answer('client_documents', 'select', { data: null, error: { message: 'boom' } })
    renderTab()

    expect(await screen.findByText(/Failed to load documents: boom/)).toBeInTheDocument()
    expect(screen.queryByText(/Upload a contract/)).not.toBeInTheDocument()
  })
})
