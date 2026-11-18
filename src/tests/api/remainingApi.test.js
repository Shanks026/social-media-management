import { describe, it, expect, vi, beforeEach } from 'vitest'

// #157: the remaining modules (auth, agency, documents, notes, team) follow
// ADR 0007.

vi.mock('@/lib/supabase', async () => {
  const { createSupabaseStub } = await import('@/tests/api/supabaseStub')
  const sb = createSupabaseStub()
  return { supabase: sb.client, __stub: sb }
})
vi.mock('@/lib/workspace', () => ({
  resolveWorkspace: () => Promise.resolve({ workspaceUserId: 'owner-1', user: { id: 'member-1' } }),
}))
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ workspaceUserId: 'owner-1', user: { id: 'member-1' } }),
}))

import { __stub as sb } from '@/lib/supabase'
import { renderMutation } from '@/tests/api/mutationHarness'
import { signInWithPassword, updatePassword } from '@/api/auth'
import { saveAgencyLogo, saveInvoiceSignatory } from '@/api/agency'
import { documentKeys, useUploadDocument, useMoveDocument } from '@/api/documents'
import { noteKeys } from '@/api/agencyNotes'
import { noteTagKeys, useSetNoteTag } from '@/api/noteTags'
import { subscriptionKeys } from '@/api/useSubscription'

beforeEach(() => sb.reset())

describe('auth', () => {
  it('signInWithPassword says whether the email or the password was wrong', async () => {
    const wrong = { data: null, error: Object.assign(new Error('bad'), { code: 'invalid_credentials' }) }
    sb.client.auth.signInWithPassword = () => Promise.resolve(wrong)

    sb.answer('rpc.check_email_exists', { data: true, error: null })
    await expect(signInWithPassword({ email: 'a@x.com', password: 'p' })).rejects.toThrow(/Incorrect password/)

    sb.answer('rpc.check_email_exists', { data: false, error: null })
    await expect(signInWithPassword({ email: 'a@x.com', password: 'p' })).rejects.toThrow(/No account found/)
  })

  it('updatePassword re-checks the old password before a change', async () => {
    sb.client.auth.signInWithPassword = () => Promise.resolve({ data: null, error: new Error('nope') })
    const updateUser = vi.fn()
    sb.client.auth.updateUser = updateUser
    await expect(
      updatePassword({ newPassword: 'n', reason: 'change', email: 'a@x.com', oldPassword: 'o' }),
    ).rejects.toThrow('Incorrect old password.')
    expect(updateUser).not.toHaveBeenCalled()
  })
})

describe('agency branding', () => {
  it('saveAgencyLogo updates the internal client and the owner\'s subscription row', async () => {
    await saveAgencyLogo({ internalClientId: 'c-int', logoUrl: 'https://x/post-media/branding/new.png' })
    expect(sb.writes('clients', 'update')[0].args[0]).toEqual({ logo_url: 'https://x/post-media/branding/new.png' })
    expect(sb.filters('agency_subscriptions')).toContainEqual(['user_id', 'owner-1'])
  })

  it('saveAgencyLogo removes the replaced file', async () => {
    await saveAgencyLogo({
      internalClientId: 'c-int',
      logoUrl: '',
      previousUrl: 'https://x/storage/v1/object/public/post-media/branding/old.png',
    })
    expect(sb.writes('clients', 'update')[0].args[0]).toEqual({ logo_url: null })
    expect(sb.storageCalls).toContainEqual({ bucket: 'post-media', method: 'remove', paths: ['branding/old.png'] })
  })

  it('saveInvoiceSignatory writes blanks as nulls on the owner\'s row', async () => {
    await saveInvoiceSignatory({ name: 'Ada', designation: '', signatureUrl: null })
    expect(sb.writes('agency_subscriptions', 'update')[0].args[0]).toMatchObject({
      signatory_name: 'Ada', signatory_designation: null, signature_url: null,
    })
    expect(sb.filters('agency_subscriptions')).toContainEqual(['user_id', 'owner-1'])
  })
})

describe('refresh scope', () => {
  it('an upload refreshes documents and the plan\'s storage; a move only documents', async () => {
    sb.answer('client_documents', 'insert', { data: { id: 'd1' }, error: null })
    const upload = renderMutation(useUploadDocument)
    await upload.result.current.mutateAsync({
      clientId: 'c1', file: { name: 'a.pdf', size: 1, type: 'application/pdf' }, displayName: 'A',
    })
    expect(upload.invalidated()).toEqual(expect.arrayContaining([documentKeys.all, subscriptionKeys.all]))

    const move = renderMutation(useMoveDocument)
    await move.result.current.mutateAsync({ documentId: 'd1', collectionId: null })
    expect(move.invalidated()).toEqual([documentKeys.all])
  })

  it('tagging a note refreshes tags and notes (notes carry their tags)', async () => {
    const { result, invalidated } = renderMutation(useSetNoteTag)
    await result.current.mutateAsync({ noteId: 'n1', tagId: 't1', tagged: true })
    expect(invalidated()).toEqual([noteTagKeys.all, noteKeys.all])
    expect(sb.writes('note_tag_links', 'upsert')).toHaveLength(1)
  })
})
