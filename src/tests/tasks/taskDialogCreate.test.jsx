import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// #214: creating a Task goes through the one Task dialog (spec #213). The real
// dialog runs on the real API hooks; only the Supabase client and the auth
// context are replaced.

vi.mock('@/lib/supabase', async () => {
  const { createSupabaseStub } = await import('@/tests/api/supabaseStub')
  const sb = createSupabaseStub()
  return { supabase: sb.client, __stub: sb }
})

vi.mock('@/context/AuthContext', async () => {
  const { auth } = await import('./taskDialogHarness')
  return { useAuth: () => auth }
})

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { __stub as sb } from '@/lib/supabase'
import TaskDialog from '@/components/tasks/TaskDialog'
import {
  asOwner,
  asMember,
  answerWorkspace,
  deliverable,
  renderDialog,
  shimRadix,
} from './taskDialogHarness'

beforeAll(shimRadix)

beforeEach(() => {
  sb.reset()
  asOwner()
})

function open(props = {}) {
  const onOpenChange = vi.fn()
  const onSuccess = vi.fn()
  const view = renderDialog(
    <TaskDialog open onOpenChange={onOpenChange} onSuccess={onSuccess} {...props} />,
  )
  return { ...view, onOpenChange, onSuccess }
}

const titleBox = () => screen.getByPlaceholderText('Enter task title...')
const save = () => userEvent.click(screen.getByRole('button', { name: 'Save Task' }))
const inserted = () => sb.writes('tasks', 'insert')[0]?.args[0]

async function pick(name, option) {
  await userEvent.click(screen.getByRole('combobox', { name }))
  await userEvent.click(await screen.findByRole('option', { name: option }))
}

describe('creating a Task', () => {
  it('saves a To do Task for the workspace, created by the real caller', async () => {
    answerWorkspace(sb)
    const { onOpenChange, onSuccess } = open()

    await userEvent.type(titleBox(), '  Write the brief  ')
    await save()

    await waitFor(() => expect(sb.writes('tasks', 'insert')).toHaveLength(1))
    expect(inserted()).toMatchObject({
      workspace_id: 'owner-uid',
      created_by: 'owner-uid',
      title: 'Write the brief',
      status: 'TODO',
      priority: 'NORMAL',
      client_id: null,
      description: null,
      due_at: null,
      assigned_to: null,
    })
    await waitFor(() => expect(onSuccess).toHaveBeenCalled())
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('does not save a Task with a blank title, and says why', async () => {
    answerWorkspace(sb)
    open()

    await userEvent.type(titleBox(), '   ')
    await save()

    expect(await screen.findByText('A task needs a title')).toBeInTheDocument()
    expect(sb.writes('tasks', 'insert')).toHaveLength(0)
  })

  it('saves the description and the priority chosen', async () => {
    answerWorkspace(sb)
    open()

    await userEvent.type(titleBox(), 'Plan launch')
    await userEvent.type(screen.getByPlaceholderText('Add a description...'), '  Cover all channels ')
    await userEvent.click(screen.getByRole('button', { name: 'High' }))
    await save()

    await waitFor(() => expect(inserted()).toBeDefined())
    expect(inserted()).toMatchObject({ description: 'Cover all channels', priority: 'HIGH' })
  })

  it('saves the due date and time the user chose', async () => {
    answerWorkspace(sb)
    open()

    await userEvent.type(titleBox(), 'Send invoice')
    fireEvent.change(screen.getByLabelText('Due date'), { target: { value: '2026-12-01T09:30' } })
    await save()

    await waitFor(() => expect(inserted()).toBeDefined())
    const due = new Date(inserted().due_at)
    expect([due.getFullYear(), due.getMonth() + 1, due.getDate(), due.getHours(), due.getMinutes()])
      .toEqual([2026, 12, 1, 9, 30])
  })

  it('saves no assignee when Unassigned is chosen', async () => {
    answerWorkspace(sb)
    open()

    await userEvent.type(titleBox(), 'Triage inbox')
    await pick('Assignee', /Max Member/)
    await pick('Assignee', 'Unassigned')
    await save()

    await waitFor(() => expect(inserted()).toBeDefined())
    expect(inserted().assigned_to).toBeNull()
  })

  it('assigns the Task to the person chosen', async () => {
    answerWorkspace(sb)
    open()

    await userEvent.type(titleBox(), 'Design post')
    await pick('Assignee', /Max Member/)
    await save()

    await waitFor(() => expect(inserted()).toBeDefined())
    expect(inserted().assigned_to).toBe('member-uid')
  })

  it('offers no Assignee to someone who may not assign Tasks, and sends none', async () => {
    asMember()
    answerWorkspace(sb)
    open()

    await userEvent.type(titleBox(), 'Update the deck')
    expect(screen.queryByRole('combobox', { name: 'Assignee' })).not.toBeInTheDocument()
    await save()

    await waitFor(() => expect(inserted()).toBeDefined())
    expect(inserted()).toMatchObject({ created_by: 'member-uid', assigned_to: null })
  })

  it('saves a Task for the Client chosen', async () => {
    answerWorkspace(sb)
    open()

    await userEvent.type(titleBox(), 'Client call')
    await pick('Client', 'Globex')
    await save()

    await waitFor(() => expect(inserted()).toBeDefined())
    expect(inserted().client_id).toBe('client-b')
  })

  it('carries a locked Client into the row and does not let it be changed', async () => {
    answerWorkspace(sb)
    open({ clientId: 'client-a', lockClient: true })

    expect(await screen.findByText('Acme')).toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: 'Client' })).not.toBeInTheDocument()
    await userEvent.type(titleBox(), 'Monthly report')
    await save()

    await waitFor(() => expect(inserted()).toBeDefined())
    expect(inserted().client_id).toBe('client-a')
  })

  it('pre-selects a Client that is not locked, which can still be changed', async () => {
    answerWorkspace(sb)
    open({ clientId: 'client-a' })

    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Client' })).toHaveTextContent('Acme'))
    await userEvent.type(titleBox(), 'Audit')
    await pick('Client', 'Globex')
    await save()

    await waitFor(() => expect(inserted()).toBeDefined())
    expect(inserted().client_id).toBe('client-b')
  })

  it('carries a locked Campaign into the row and shows its name', async () => {
    answerWorkspace(sb)
    open({ clientId: 'client-a', lockClient: true, campaignId: 'camp-1', campaignName: 'Spring launch' })

    expect(await screen.findByText('Spring launch')).toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: 'Campaign' })).not.toBeInTheDocument()
    await userEvent.type(titleBox(), 'Shoot photos')
    await save()

    await waitFor(() => expect(inserted()).toBeDefined())
    expect(inserted().campaign_id).toBe('camp-1')
  })

  it('links the Deliverables picked in the picker', async () => {
    answerWorkspace(sb, {
      posts: [deliverable('p1', 'Launch teaser'), deliverable('p2', 'Reel')],
    })
    open()

    await userEvent.type(titleBox(), 'Review content')
    await userEvent.click(await screen.findByText('Click to link deliverables'))
    await userEvent.click(await screen.findByRole('button', { name: /Launch teaser/ }))
    await userEvent.click(screen.getByRole('button', { name: /Reel/ }))
    await save()

    await waitFor(() => expect(sb.writes('task_posts', 'insert')).toHaveLength(1))
    expect(sb.writes('task_posts', 'insert')[0].args[0]).toEqual([
      { task_id: 'task-new', post_id: 'p1', workspace_id: 'owner-uid' },
      { task_id: 'task-new', post_id: 'p2', workspace_id: 'owner-uid' },
    ])
  })

  it('starts empty each time it opens, so old values never leak into a new Task', async () => {
    answerWorkspace(sb)
    const { rerender, onOpenChange } = open()
    await userEvent.type(titleBox(), 'Left over')

    rerender(<TaskDialog open={false} onOpenChange={onOpenChange} />)
    rerender(<TaskDialog open onOpenChange={onOpenChange} />)

    await waitFor(() => expect(titleBox()).toHaveValue(''))
  })

  it('says it failed and stays open when the save fails', async () => {
    answerWorkspace(sb)
    sb.answer('tasks', 'insert', { data: null, error: { message: 'boom' } })
    const { onOpenChange } = open()

    await userEvent.type(titleBox(), 'Doomed')
    await save()

    const { toast } = await import('sonner')
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('boom')))
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
  })
})
