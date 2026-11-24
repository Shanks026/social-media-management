import { render } from '@testing-library/react'
import { vi } from 'vitest'
import { createWrapper } from '../test-utils'

// Shared by the Task dialog tests (spec #213): renders the real dialog on the
// real API hooks. Each test file mocks `@/lib/supabase` with the recording stub
// and `@/context/AuthContext` with `auth` below.

export const auth = {
  user: { id: 'owner-uid' },
  workspaceUserId: 'owner-uid',
  userRole: 'owner',
  userPermissions: null,
}

// Owner and Admin may assign Tasks; a plain Member may not (canAssignTasks).
export function asOwner() {
  Object.assign(auth, { user: { id: 'owner-uid' }, userRole: 'owner', userPermissions: null })
}

export function asMember() {
  Object.assign(auth, {
    user: { id: 'member-uid' },
    userRole: 'member',
    userPermissions: { documents: 'view' },
  })
}

export const TEAM = [
  { member_user_id: 'owner-uid', system_role: 'owner', full_name: 'Olive Owner', email: 'olive@x.io' },
  { member_user_id: 'member-uid', system_role: 'member', full_name: 'Max Member', email: 'max@x.io' },
]

export const CLIENTS = [
  { id: 'client-a', name: 'Acme', logo_url: null, is_internal: false, status: 'ACTIVE' },
  { id: 'client-b', name: 'Globex', logo_url: null, is_internal: false, status: 'ACTIVE' },
]

// The picker's "General" list: posts joined to their current version.
export const deliverable = (id, title, extra = {}) => ({
  id,
  client_id: 'client-a',
  campaign_id: null,
  campaigns: null,
  clients: { id: 'client-a', name: 'Acme', logo_url: null, is_internal: false, user_id: 'owner-uid' },
  post_versions: {
    id: `v-${id}`,
    title,
    media_urls: [],
    platform: ['instagram'],
    status: 'DRAFT',
    target_date: null,
    created_at: '2026-11-01T00:00:00Z',
    created_by: 'owner-uid',
  },
  ...extra,
})

/** What the app reads while the dialog is open, for whoever is signed in. */
export function answerWorkspace(sb, { posts = [] } = {}) {
  sb.answer('auth.getUser', { data: { user: { id: auth.user.id } }, error: null })
  sb.answer('agency_members', 'select', { data: { agency_user_id: 'owner-uid' }, error: null })
  sb.answer('clients', 'select', { data: CLIENTS, error: null })
  sb.answer('rpc.get_team_members', { data: TEAM, error: null })
  sb.answer('posts', 'select', { data: posts, error: null })
  sb.answer('tasks', 'insert', { data: { id: 'task-new' }, error: null })
}

export function renderDialog(ui) {
  const Wrapper = createWrapper()
  const view = render(<Wrapper>{ui}</Wrapper>)
  // Rerendering must keep the same query client, so re-wrap with the same one.
  return { ...view, rerender: (next) => view.rerender(<Wrapper>{next}</Wrapper>) }
}

// Radix Select and ScrollArea need these in jsdom.
export function shimRadix() {
  Element.prototype.hasPointerCapture ??= () => false
  Element.prototype.releasePointerCapture ??= () => {}
  Element.prototype.scrollIntoView ??= () => {}
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

export const noop = () => vi.fn()
