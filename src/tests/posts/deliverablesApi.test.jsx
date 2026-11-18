import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// #156: Deliverables, Tasks, Clients, Meetings and the calendar follow
// ADR 0007. Plain functions against a recording supabase stub; hooks for what
// they refresh.

vi.mock('@/lib/supabase', async () => {
  const { createSupabaseStub } = await import('@/tests/api/supabaseStub')
  const sb = createSupabaseStub()
  return { supabase: sb.client, __stub: sb }
})
// The signed-in Member differs from the workspace owner, so a key built from
// the wrong id shows up in the assertions.
vi.mock('@/lib/workspace', () => ({
  resolveWorkspace: () => Promise.resolve({ workspaceUserId: 'owner-1', user: { id: 'member-1' } }),
}))
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ workspaceUserId: 'owner-1', user: { id: 'member-1' } }),
}))
vi.mock('@/api/storage', () => ({
  uploadPostImage: vi.fn(async ({ file }) => `https://stub/public/post-media/${file.name}`),
}))

import { __stub as sb } from '@/lib/supabase'
import { renderMutation } from '@/tests/api/mutationHarness'
import * as queryKeys from '@/api/queryKeys'
import {
  postKeys,
  saveDeliverable,
  scheduleDeliverable,
  markPlatformPublished,
  useApproveDeliverable,
  useSaveDeliverable,
} from '@/api/posts'
import { taskKeys, useUpdateTaskStatus } from '@/api/tasks'
import { clientKeys, saveClient } from '@/api/clients'
import { campaignKeys } from '@/api/campaigns'
import { subscriptionKeys } from '@/api/useSubscription'

beforeEach(() => sb.reset())

describe('query keys', () => {
  it('every factory keeps all its keys under one root', () => {
    for (const [name, factory] of Object.entries(queryKeys)) {
      const root = factory.all
      expect(root, name).toBeDefined()
      for (const [k, make] of Object.entries(factory)) {
        if (k === 'all' || typeof make !== 'function') continue
        // signedUrl / mediaUrl deliberately sit outside their root
        if (k === 'signedUrl' || k === 'mediaUrl') continue
        expect(make('x', 'y', 'z')[0], `${name}.${k}`).toBe(root[0])
      }
    }
  })

  it('workspace keys differ per workspace, so owner and members share them', () => {
    expect(postKeys.global('owner-1')).not.toEqual(postKeys.global('owner-2'))
    expect(clientKeys.list('owner-1', { status: 'ACTIVE' })[2]).toBe('owner-1')
    expect(taskKeys.list('owner-1')[2]).toBe('owner-1')
  })
})

describe('deliverable plain functions', () => {
  it('saveDeliverable creates a draft with kept and newly uploaded media', async () => {
    await saveDeliverable({
      clientId: 'c1',
      keptMediaUrls: ['https://stub/public/post-media/old.png'],
      newFiles: [{ name: 'new.png' }],
      fields: { title: 'Launch', userId: 'member-1' },
    })
    const [rpc] = sb.rpcs('create_post_draft_v3')
    expect(rpc.args).toMatchObject({
      p_client_id: 'c1',
      p_title: 'Launch',
      p_media_urls: ['https://stub/public/post-media/old.png', 'https://stub/public/post-media/new.png'],
    })
  })

  it('saveDeliverable edits an editable version and moves the campaign', async () => {
    sb.answer('post_versions', 'update', { data: [{ id: 'v1' }], error: null })
    await saveDeliverable({
      versionId: 'v1',
      postId: 'p1',
      clientId: 'c1',
      fields: { title: 'Edited', campaignId: 'camp-1' },
    })
    expect(sb.writes('post_versions', 'update')[0].args[0].title).toBe('Edited')
    expect(sb.writes('posts', 'update')[0].args[0]).toEqual({ campaign_id: 'camp-1' })
  })

  it('scheduleDeliverable needs a date unless the deliverable is per-platform', async () => {
    await expect(scheduleDeliverable({ versionId: 'v1', perPlatform: false })).rejects.toThrow(
      'Please select a publish date.',
    )
    expect(sb.writes('post_versions', 'update')).toEqual([])

    await scheduleDeliverable({ versionId: 'v1', perPlatform: true })
    expect(sb.writes('post_versions', 'update')[0].args[0]).toEqual({ status: 'SCHEDULED' })
  })

  it('markPlatformPublished publishes the whole deliverable on its last platform and reports the email', async () => {
    sb.answer('fn.send-platform-published-email', { data: null, error: new Error('smtp down') })
    const result = await markPlatformPublished({
      versionId: 'v1',
      platform: 'instagram',
      platformSchedules: {
        instagram: { scheduled_at: '2026-12-01' },
        linkedin: { scheduled_at: '2026-12-01', published_at: '2026-12-01' },
      },
    })
    expect(result).toMatchObject({ allPublished: true, emailSent: false })
    expect(sb.writes('post_versions', 'update')[0].args[0].status).toBe('PUBLISHED')
    expect(sb.invocations('send-platform-published-email')[0].args.body).toMatchObject({
      post_version_id: 'v1', platform: 'instagram', all_published: true,
    })
  })
})

describe('deliverable hooks refresh every view that shows a deliverable', () => {
  it('a status change refreshes posts, campaigns, clients and tasks', async () => {
    const { result, invalidated } = renderMutation(useApproveDeliverable)
    await result.current.mutateAsync('v1')
    expect(invalidated()).toEqual(
      expect.arrayContaining([postKeys.all, campaignKeys.all, clientKeys.all, taskKeys.all]),
    )
  })

  it('saving one also refreshes storage on the subscription row', async () => {
    const { result, invalidated } = renderMutation(useSaveDeliverable)
    await result.current.mutateAsync({ clientId: 'c1', fields: { title: 'x' } })
    expect(invalidated()).toContainEqual(subscriptionKeys.all)
  })
})

describe('useUpdateTaskStatus', () => {
  function setup() {
    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
    const listKey = taskKeys.list('owner-1', { clientId: null, campaignId: null })
    queryClient.setQueryData(listKey, [{ id: 't1', status: 'TODO' }])
    const wrapper = ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
    const { result } = renderHook(() => useUpdateTaskStatus(), { wrapper })
    return { result, statusOf: () => queryClient.getQueryData(listKey)[0].status }
  }

  it('moves the task in cached lists before the server answers', async () => {
    let finish
    sb.answer('rpc.update_task_status', () => new Promise((r) => { finish = r }))
    const { result, statusOf } = setup()
    act(() => result.current.mutate({ id: 't1', status: 'COMPLETED' }))
    await waitFor(() => expect(statusOf()).toBe('COMPLETED'))
    finish({ data: null, error: null })
  })

  it('rolls the move back when the update fails', async () => {
    sb.answer('rpc.update_task_status', { data: null, error: new Error('denied') })
    const { result, statusOf } = setup()
    await act(() => result.current.mutateAsync({ id: 't1', status: 'COMPLETED' }).catch(() => {}))
    expect(statusOf()).toBe('TODO')
  })
})

describe('saveClient', () => {
  it('syncs the agency branding onto the workspace owner\'s row, not the member\'s', async () => {
    sb.answer('clients', 'update', {
      data: { id: 'c-int', is_internal: true, name: 'Our Agency', logo_url: 'logo.png' },
      error: null,
    })
    await saveClient({ clientId: 'c-int', values: { name: 'Our Agency' } })
    const [sync] = sb.writes('agency_subscriptions', 'update')
    expect(sync.args[0]).toMatchObject({ agency_name: 'Our Agency', logo_url: 'logo.png' })
    expect(sb.filters('agency_subscriptions')).toContainEqual(['user_id', 'owner-1'])
  })

  it('leaves the branding alone for a real client', async () => {
    sb.answer('clients', 'update', { data: { id: 'c1', is_internal: false }, error: null })
    await saveClient({ clientId: 'c1', values: { name: 'Acme' } })
    expect(sb.writes('agency_subscriptions', 'update')).toEqual([])
  })
})
