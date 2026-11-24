import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// #210: a Prospect's Documents tab is the one Documents list, scoped to a
// Prospect (spec #208). Same seam as the Client scope tests: the real list on
// the real API hooks, with only the Supabase client and auth replaced.

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
  answerSubscription,
  renderList,
  shimRadix,
} from './documentsHarness'

beforeAll(shimRadix)

const prospectDoc = (id, extra = {}) =>
  doc(id, {
    client_id: null,
    prospect_id: 'prospect-1',
    clients: null,
    prospects: { business_name: 'Initech' },
    ...extra,
  })

const DOCS = [
  prospectDoc('deck', { display_name: 'Pitch v1', category: 'Pitch Deck' }),
  prospectDoc('notes', { display_name: 'Discovery call', category: 'Discovery Notes' }),
  prospectDoc('old', { display_name: 'Superseded deck', category: 'Pitch Deck', status: 'ARCHIVED' }),
]

function answerProspect(docs = DOCS) {
  sb.answer('client_documents', 'select', { data: docs, error: null })
  answerSubscription(sb)
}

const renderTab = () => renderList(<DocumentsTab prospectId="prospect-1" />)

async function pick(name, option) {
  await userEvent.click(screen.getByRole('combobox', { name }))
  await userEvent.click(await screen.findByRole('option', { name: option }))
}

beforeEach(() => {
  sb.reset()
  asOwner()
})

describe('a Prospect’s Documents tab', () => {
  it('asks the database for this Prospect’s documents and shows them', async () => {
    answerProspect()
    renderTab()

    expect(await screen.findByText('Pitch v1')).toBeInTheDocument()
    expect(screen.getByText('Discovery call')).toBeInTheDocument()
    expect(sb.filters('client_documents')).toContainEqual(['prospect_id', 'prospect-1'])
    expect(sb.filters('client_documents')).not.toContainEqual(expect.arrayContaining(['client_id']))
  })

  it('shows only the All tab and no New Collection', async () => {
    answerProspect()
    renderTab()
    await screen.findByText('Pitch v1')

    expect(screen.getByRole('tab', { name: /^All\s*2$/ })).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: /Collections/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: /Ungrouped/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /New Collection/ })).not.toBeInTheDocument()
    expect(sb.calls.filter((c) => c.table === 'document_collections')).toHaveLength(0)
  })

  it('offers the Prospect categories', async () => {
    answerProspect()
    renderTab()
    await screen.findByText('Pitch v1')

    await userEvent.click(screen.getByRole('combobox', { name: 'Category' }))
    expect(await screen.findByRole('option', { name: 'Pitch Deck' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Brand Guidelines' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('option', { name: 'Discovery Notes' }))

    expect(screen.getByText('Discovery call')).toBeInTheDocument()
    expect(screen.queryByText('Pitch v1')).not.toBeInTheDocument()
  })

  it('lets archived documents be found under Archived', async () => {
    answerProspect()
    renderTab()
    await screen.findByText('Pitch v1')
    expect(screen.queryByText('Superseded deck')).not.toBeInTheDocument()

    await pick('Status', 'Archived')
    expect(screen.getByText('Superseded deck')).toBeInTheDocument()
    expect(screen.queryByText('Pitch v1')).not.toBeInTheDocument()
  })

  it('invites a Prospect upload when there are none', async () => {
    answerProspect([])
    renderTab()

    expect(
      await screen.findByText('Upload a brief, one-pager, or any file related to this prospect.'),
    ).toBeInTheDocument()
  })

  it('gives a Member with view-only access no Upload and no manage actions', async () => {
    asMember('view')
    answerProspect()
    renderTab()
    await screen.findByText('Pitch v1')

    expect(screen.queryByRole('button', { name: /Upload Document/ })).not.toBeInTheDocument()
    await userEvent.click(screen.getAllByRole('button', { name: 'Document actions' })[0])
    const menu = await screen.findByRole('menu')
    expect(within(menu).getAllByRole('menuitem').map((i) => i.textContent)).toEqual(['Download'])
  })

  it('saves an upload for the Prospect, with the Confidential flag chosen', async () => {
    answerProspect()
    sb.answer('client_documents', 'insert', { data: { id: 'new' }, error: null })
    const { container } = renderTab()
    await screen.findByText('Pitch v1')

    await userEvent.click(screen.getByRole('button', { name: /Upload Document/ }))
    const input = await waitFor(() => {
      const el = document.querySelector('input[type="file"]')
      expect(el).not.toBeNull()
      return el
    })
    const file = new File(['%PDF'], 'one-pager.pdf', { type: 'application/pdf' })
    await userEvent.upload(input, file)

    const dialog = await screen.findByRole('dialog')
    const confidential = within(dialog).getByRole('switch', { hidden: true })
    expect(confidential).not.toBeChecked()
    await userEvent.click(confidential)
    await userEvent.click(within(dialog).getByRole('button', { name: 'Upload', hidden: true }))

    await waitFor(() => expect(sb.writes('client_documents', 'insert')).toHaveLength(1))
    const row = sb.writes('client_documents', 'insert')[0].args[0]
    expect(row).toMatchObject({ prospect_id: 'prospect-1', is_confidential: true })
    expect(row).not.toHaveProperty('client_id')
    expect(sb.storageCalls[0].path).toContain('/prospects/prospect-1/')
    expect(container).toBeTruthy()
  })

  it('refuses a scope of both a Client and a Prospect', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() =>
      renderList(<DocumentsTab clientId="client-a" prospectId="prospect-1" />),
    ).toThrow(/either a clientId or a prospectId/)
    spy.mockRestore()
  })
})
