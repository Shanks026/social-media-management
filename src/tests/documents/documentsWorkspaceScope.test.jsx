import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// #211: with no scope, the Documents list covers the whole workspace and the
// Documents page is its heading (spec #208). Same seam as the other scopes.

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
import DocumentsPage from '@/pages/documents/DocumentsPage'
import { HeaderProvider } from '@/components/misc/header-context'
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

const CLIENTS = [
  { id: 'internal', name: 'Our agency', is_internal: true, logo_url: null },
  { id: 'client-a', name: 'Acme', is_internal: false, logo_url: null },
  { id: 'client-b', name: 'Globex', is_internal: false, logo_url: null },
]
const PROSPECTS = [{ id: 'prospect-1', business_name: 'Initech' }]

const DOCS = [
  doc('own', { display_name: 'Agency handbook', client_id: 'internal', clients: { name: 'Our agency', is_internal: true, logo_url: null } }),
  doc('a1', { display_name: 'Acme contract', category: 'Contract' }),
  doc('a2', { display_name: 'Acme brief', collection_id: 'col-a' }),
  doc('b1', {
    display_name: 'Globex brand kit',
    client_id: 'client-b',
    clients: { name: 'Globex', is_internal: false, logo_url: null },
  }),
  doc('p1', {
    display_name: 'Initech pitch',
    client_id: null,
    prospect_id: 'prospect-1',
    category: 'Pitch Deck',
    clients: null,
    prospects: { business_name: 'Initech' },
  }),
  doc('a-old', { display_name: 'Acme old terms', status: 'ARCHIVED' }),
]

const COLLECTIONS = [
  collection('col-a'),
  collection('col-b', {
    client_id: 'client-b',
    clients: { id: 'client-b', name: 'Globex', logo_url: null },
  }),
]

function answerWorkspace({ docs = DOCS, collections = COLLECTIONS, plan } = {}) {
  sb.answer('client_documents', 'select', { data: docs, error: null })
  sb.answer('document_collections', 'select', { data: collections, error: null })
  sb.answer('clients', 'select', { data: CLIENTS, error: null })
  sb.answer('prospects', 'select', { data: PROSPECTS, error: null })
  answerSubscription(sb, plan)
}

const renderTab = () => renderList(<DocumentsTab />)

async function pick(name, option) {
  await userEvent.click(screen.getByRole('combobox', { name }))
  await userEvent.click(await screen.findByRole('option', { name: option }))
}

beforeEach(() => {
  sb.reset()
  asOwner()
})

describe('the workspace Documents list', () => {
  it('lists every active document in the workspace, with its owner on each card', async () => {
    answerWorkspace()
    renderTab()

    for (const name of ['Agency handbook', 'Acme contract', 'Initech pitch']) {
      expect(await screen.findByText(name)).toBeInTheDocument()
    }
    expect(screen.queryByText('Acme old terms')).not.toBeInTheDocument()
    expect(sb.filters('client_documents')).not.toContainEqual(expect.arrayContaining(['client_id']))
  })

  it('narrows to the workspace’s own account, one Client or one Prospect', async () => {
    answerWorkspace()
    renderTab()
    await screen.findByText('Acme contract')

    await pick('Client or prospect', /Our agency/)
    expect(screen.getByText('Agency handbook')).toBeInTheDocument()
    expect(screen.queryByText('Acme contract')).not.toBeInTheDocument()

    await pick('Client or prospect', /Globex/)
    expect(screen.getByText('Globex brand kit')).toBeInTheDocument()
    expect(screen.queryByText('Agency handbook')).not.toBeInTheDocument()

    await pick('Client or prospect', /Initech/)
    expect(screen.getByText('Initech pitch')).toBeInTheDocument()
    expect(screen.queryByText('Globex brand kit')).not.toBeInTheDocument()
  })

  it('on picking a Prospect, switches to Prospect categories and hides Collections and Ungrouped', async () => {
    answerWorkspace()
    renderTab()
    await screen.findByText('Acme contract')
    expect(screen.getByRole('tab', { name: /Collections/ })).toBeInTheDocument()

    await pick('Client or prospect', /Initech/)
    expect(screen.queryByRole('tab', { name: /Collections/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: /Ungrouped/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /New Collection/ })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('combobox', { name: 'Category' }))
    expect(await screen.findByRole('option', { name: 'Pitch Deck' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Brand Guidelines' })).not.toBeInTheDocument()
  })

  it('moves off the Collections tab when a Prospect is picked', async () => {
    answerWorkspace()
    renderList(<DocumentsTab />, { route: '/?doc_tab=collections' })
    await screen.findByText('Collection col-a')

    await pick('Client or prospect', /Initech/)
    expect(await screen.findByText('Initech pitch')).toBeInTheDocument()
    expect(screen.getByTestId('search')).toHaveTextContent('doc_tab=all')
  })

  it('groups collections under their Client, and lists them flat once a Client is picked', async () => {
    answerWorkspace()
    renderList(<DocumentsTab />, { route: '/?doc_tab=collections' })
    await screen.findByText('Collection col-a')

    const acme = screen.getByText('Acme').closest('div')
    expect(acme.parentElement).toHaveTextContent('Collection col-a')
    expect(acme.parentElement).not.toHaveTextContent('Collection col-b')
    expect(screen.getByText('Globex').closest('div').parentElement).toHaveTextContent('Collection col-b')

    await pick('Client or prospect', /Globex/)
    expect(screen.getByText('Collection col-b')).toBeInTheDocument()
    expect(screen.queryByText('Collection col-a')).not.toBeInTheDocument()
    expect(screen.queryByText('Acme')).not.toBeInTheDocument()
  })

  it('clears the Client/Prospect filter with Clear filters', async () => {
    answerWorkspace()
    renderTab()
    await screen.findByText('Acme contract')

    await pick('Client or prospect', /Globex/)
    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(screen.getByText('Acme contract')).toBeInTheDocument()
  })

  it('gives a Member with view-only access no manage actions on the Ungrouped tab', async () => {
    asMember('view')
    answerWorkspace()
    renderList(<DocumentsTab />, { route: '/?doc_tab=ungrouped' })
    await screen.findByText('Acme contract')

    expect(screen.queryByRole('button', { name: /Upload Document/ })).not.toBeInTheDocument()
    for (const trigger of screen.getAllByRole('button', { name: 'Document actions' })) {
      await userEvent.click(trigger)
      const menu = await screen.findByRole('menu')
      expect(within(menu).getAllByRole('menuitem').map((i) => i.textContent)).toEqual(['Download'])
      await userEvent.keyboard('{Escape}')
    }
  })

  it('lets the upload dialog choose the workspace, a Client or a Prospect', async () => {
    answerWorkspace()
    sb.answer('client_documents', 'insert', { data: { id: 'new' }, error: null })
    renderTab()
    await screen.findByText('Acme contract')

    await userEvent.click(screen.getByRole('button', { name: /Upload Document/ }))
    const input = await waitFor(() => {
      const el = document.querySelector('input[type="file"]')
      expect(el).not.toBeNull()
      return el
    })
    await userEvent.upload(input, new File(['%PDF'], 'kit.pdf', { type: 'application/pdf' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getAllByRole('combobox', { hidden: true })[0])
    await userEvent.click(await screen.findByRole('option', { name: /Globex/ }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Upload', hidden: true }))

    await waitFor(() => expect(sb.writes('client_documents', 'insert')).toHaveLength(1))
    expect(sb.writes('client_documents', 'insert')[0].args[0]).toMatchObject({ client_id: 'client-b' })
  })
})

describe('the Documents page', () => {
  function renderPage() {
    return renderList(
      <HeaderProvider>
        <DocumentsPage />
      </HeaderProvider>,
    )
  }

  it('shows its heading and description around the list', async () => {
    answerWorkspace()
    renderPage()

    expect(await screen.findByRole('heading', { name: /^Documents/ })).toBeInTheDocument()
    expect(screen.getByText('All documents across your clients and workspace.')).toBeInTheDocument()
    expect(await screen.findByText('Acme contract')).toBeInTheDocument()
  })

  it('counts the workspace’s active documents, and the count does not follow the filters', async () => {
    answerWorkspace()
    renderPage()
    await screen.findByText('Acme contract')

    const heading = screen.getByRole('heading', { name: /^Documents/ })
    expect(heading).toHaveTextContent('Documents 5')

    await pick('Client or prospect', /Globex/)
    await pick('Status', 'All statuses')
    expect(heading).toHaveTextContent('Documents 5')
  })

  it('offers Upload and New Collection in the list’s toolbar, not the heading', async () => {
    answerWorkspace()
    renderPage()
    await screen.findByText('Acme contract')

    const heading = screen.getByRole('heading', { name: /^Documents/ })
    expect(heading.parentElement).not.toHaveTextContent('Upload Document')
    expect(screen.getAllByRole('button', { name: /Upload Document/ })).toHaveLength(1)
    expect(screen.getAllByRole('button', { name: /New Collection/ })).toHaveLength(1)
  })
})
