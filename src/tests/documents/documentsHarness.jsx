import { render } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { TooltipProvider } from '@/components/ui/tooltip'
import { createWrapper } from '../test-utils'

// Shared by the Documents list tests (spec #208): renders the real list on the
// real API hooks. Each test file mocks `@/lib/supabase` with the recording stub
// and `@/context/AuthContext` with `auth` below.

export const auth = {
  user: { id: 'owner-uid' },
  workspaceUserId: 'owner-uid',
  userRole: 'owner',
  userPermissions: null,
}

export function asOwner() {
  Object.assign(auth, { userRole: 'owner', userPermissions: null })
}

export function asMember(documents) {
  Object.assign(auth, { userRole: 'member', userPermissions: { documents } })
}

export const doc = (id, extra = {}) => ({
  id,
  display_name: `Doc ${id}`,
  original_filename: `${id}.pdf`,
  storage_path: `owner-uid/client-a/${id}/${id}.pdf`,
  file_size_bytes: 1000,
  mime_type: 'application/pdf',
  category: 'Other',
  status: 'ACTIVE',
  is_confidential: false,
  notes: null,
  collection_id: null,
  client_id: 'client-a',
  prospect_id: null,
  created_at: '2026-11-01T00:00:00Z',
  clients: { name: 'Acme', is_internal: false, logo_url: null },
  prospects: null,
  ...extra,
})

export const collection = (id, extra = {}) => ({
  id,
  name: `Collection ${id}`,
  description: null,
  client_id: 'client-a',
  created_at: '2026-11-01T00:00:00Z',
  clients: { id: 'client-a', name: 'Acme', logo_url: null },
  ...extra,
})

export function answerSubscription(sb, { collections = true } = {}) {
  sb.answer('agency_subscriptions', 'select', {
    data: {
      plan_name: collections ? 'velocity' : 'ignite',
      documents_collections: collections,
      current_storage_used: 0,
      max_storage_bytes: 1024 ** 3,
    },
    error: null,
  })
}

function Search() {
  return <p data-testid="search">{useLocation().search}</p>
}

export function renderList(ui, { route = '/' } = {}) {
  const Wrapper = createWrapper()
  return render(
    <Wrapper>
      <TooltipProvider>
        <MemoryRouter initialEntries={[route]}>
          {ui}
          <Search />
        </MemoryRouter>
      </TooltipProvider>
    </Wrapper>,
  )
}

// Radix Select needs these in jsdom.
export function shimRadix() {
  Element.prototype.hasPointerCapture ??= () => false
  Element.prototype.releasePointerCapture ??= () => {}
  Element.prototype.scrollIntoView ??= () => {}
}
