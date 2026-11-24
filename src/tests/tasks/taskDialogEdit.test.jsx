import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient } from '@tanstack/react-query'

// #215: editing a Task goes through the same Task dialog (spec #213). The real
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
  TASK,
  asOwner,
  asMember,
  answerTask,
  renderDialog,
  shimRadix,
} from './taskDialogHarness'

beforeAll(shimRadix)

beforeEach(() => {
  sb.reset()
  asOwner()
})

function open(props = {}, options) {
  const onOpenChange = vi.fn()
  const onSuccess = vi.fn()
  const view = renderDialog(
    <TaskDialog task={TASK} open onOpenChange={onOpenChange} onSuccess={onSuccess} {...props} />,
    options,
  )
  return { ...view, onOpenChange, onSuccess }
}

const titleBox = () => screen.getByPlaceholderText('Enter task title...')
const save = () => userEvent.click(screen.getByRole('button', { name: 'Save Changes' }))
const updated = () => sb.writes('tasks', 'update')[0]?.args[0]

async function pick(name, option) {
  await userEvent.click(screen.getByRole('combobox', { name }))
  await userEvent.click(await screen.findByRole('option', { name: option }))
}

async function loaded() {
  await screen.findByText('1 deliverable linked')
}

describe('editing a Task: what the form starts with', () => {
  it('is titled Edit Task and offers Save Changes', async () => {
    answerTask(sb)
    open()

    expect(await screen.findByText('Edit Task')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save Task' })).not.toBeInTheDocument()
  })

  it('shows the Task’s own title, description, priority and due date and time', async () => {
    answerTask(sb)
    open()
    await loaded()

    expect(titleBox()).toHaveValue('Draft proposal')
    expect(screen.getByPlaceholderText('Add a description...')).toHaveValue('First pass')
    expect(screen.getByLabelText('Due date')).toHaveValue('2026-12-01T09:30')
  })

  it('shows the Task’s Client, Campaign and assignee', async () => {
    answerTask(sb)
    open()
    await loaded()

    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Client' })).toHaveTextContent('Acme'))
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'Campaign' })).toHaveTextContent('Spring launch'),
    )
    expect(screen.getByRole('combobox', { name: 'Assignee' })).toHaveTextContent('Max Member')
  })

  it('shows the Deliverables already linked, loaded from the Task', async () => {
    answerTask(sb, { linked: ['p1', 'p2'] })
    open()

    expect(await screen.findByText('2 deliverables linked')).toBeInTheDocument()
    expect(sb.filters('task_posts')).toContainEqual(['task_id', 'task-1'])
  })

  it('starts from the other Task when opened for a different one', async () => {
    answerTask(sb)
    const { rerender, onOpenChange } = open()
    await loaded()

    rerender(<TaskDialog task={TASK} open={false} onOpenChange={onOpenChange} />)
    rerender(
      <TaskDialog
        task={{ ...TASK, id: 'task-2', title: 'Other task', assigned_to: null }}
        open
        onOpenChange={onOpenChange}
      />,
    )

    await waitFor(() => expect(titleBox()).toHaveValue('Other task'))
  })
})

describe('editing a Task: saving', () => {
  it('updates only that Task, with what is in the form', async () => {
    answerTask(sb)
    const { onOpenChange, onSuccess } = open()
    await loaded()

    await userEvent.clear(titleBox())
    await userEvent.type(titleBox(), '  Final proposal ')
    await userEvent.click(screen.getByRole('button', { name: 'Low' }))
    await save()

    await waitFor(() => expect(updated()).toBeDefined())
    expect(updated()).toMatchObject({
      title: 'Final proposal',
      description: 'First pass',
      priority: 'LOW',
      client_id: 'client-a',
      campaign_id: 'camp-1',
      assigned_to: 'member-uid',
    })
    expect(sb.filters('tasks').filter(([col]) => col === 'id')).toContainEqual(['id', 'task-1'])
    expect(sb.writes('tasks', 'insert')).toHaveLength(0)
    await waitFor(() => expect(onSuccess).toHaveBeenCalled())
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('does not save a blank title, and says why', async () => {
    answerTask(sb)
    open()
    await loaded()

    await userEvent.clear(titleBox())
    await save()

    expect(await screen.findByText('A task needs a title')).toBeInTheDocument()
    expect(sb.writes('tasks', 'update')).toHaveLength(0)
  })

  it('saves an untouched due time as the very same instant', async () => {
    answerTask(sb)
    open()
    await loaded()

    await save()

    await waitFor(() => expect(updated()).toBeDefined())
    expect(updated().due_at).toBe(TASK.due_at)
  })

  it('clears the due date when it is emptied', async () => {
    answerTask(sb)
    open()
    await loaded()

    fireEvent.change(screen.getByLabelText('Due date'), { target: { value: '' } })
    await save()

    await waitFor(() => expect(updated()).toBeDefined())
    expect(updated().due_at).toBeNull()
  })

  it('clears the assignee when Unassigned is chosen', async () => {
    answerTask(sb)
    open()
    await loaded()

    await pick('Assignee', 'Unassigned')
    await save()

    await waitFor(() => expect(updated()).toBeDefined())
    expect(updated().assigned_to).toBeNull()
  })

  it('drops the Campaign when the Client is changed', async () => {
    answerTask(sb)
    open()
    await loaded()

    await pick('Client', 'Globex')
    await save()

    await waitFor(() => expect(updated()).toBeDefined())
    expect(updated()).toMatchObject({ client_id: 'client-b', campaign_id: null })
  })

  it('replaces the links with the Deliverables chosen, adding and removing', async () => {
    answerTask(sb)
    open()
    await loaded()

    await userEvent.click(screen.getByText('1 deliverable linked'))
    await userEvent.click(await screen.findByRole('button', { name: /Launch teaser/, pressed: true }))
    await userEvent.click(screen.getByRole('button', { name: /Reel/, pressed: false }))
    await save()

    await waitFor(() => expect(sb.writes('task_posts', 'insert')).toHaveLength(1))
    expect(sb.writes('task_posts', 'delete')).toHaveLength(1)
    expect(sb.writes('task_posts', 'insert')[0].args[0]).toEqual([
      { task_id: 'task-1', post_id: 'p2', workspace_id: 'owner-uid' },
    ])
  })

  it('keeps the user’s edits when the linked Deliverables reload in the background', async () => {
    answerTask(sb)
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    open({}, { queryClient })
    await loaded()

    await userEvent.click(screen.getByRole('button', { name: 'Clear all deliverables' }))
    expect(await screen.findByText('Click to link deliverables')).toBeInTheDocument()

    await queryClient.invalidateQueries()
    await waitFor(() => expect(sb.filters('task_posts').length).toBeGreaterThan(1))

    expect(screen.getByText('Click to link deliverables')).toBeInTheDocument()
    await save()
    await waitFor(() => expect(sb.writes('task_posts', 'delete')).toHaveLength(1))
    expect(sb.writes('task_posts', 'insert')).toHaveLength(0)
  })

  it('says it failed and stays open when the save fails', async () => {
    answerTask(sb)
    sb.answer('tasks', 'update', { data: null, error: { message: 'boom' } })
    const { onOpenChange } = open()
    await loaded()

    await save()

    const { toast } = await import('sonner')
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('boom')))
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
  })
})

describe('editing a Task: who may change the assignee', () => {
  it('lets someone who may assign Tasks reassign it, and emails the new assignee', async () => {
    answerTask(sb)
    open()
    await loaded()

    await pick('Assignee', /Olive Owner/)
    await save()

    await waitFor(() => expect(updated()).toBeDefined())
    expect(updated().assigned_to).toBe('owner-uid')
    await waitFor(() => expect(sb.invocations('send-task-assignment-email')).toHaveLength(1))
  })

  it('shows the current assignee read-only to someone who may not assign Tasks', async () => {
    asMember()
    answerTask(sb)
    open()
    await loaded()

    expect(screen.queryByRole('combobox', { name: 'Assignee' })).not.toBeInTheDocument()
    expect(await screen.findByText('Max Member')).toBeInTheDocument()
  })

  it('sends no assignee at all when someone who may not assign Tasks saves', async () => {
    asMember()
    answerTask(sb)
    open()
    await loaded()

    await userEvent.clear(titleBox())
    await userEvent.type(titleBox(), 'Renamed')
    await save()

    await waitFor(() => expect(updated()).toBeDefined())
    expect(updated().title).toBe('Renamed')
    expect(updated()).not.toHaveProperty('assigned_to')
    expect(sb.invocations('send-task-assignment-email')).toHaveLength(0)
  })

  it('says Unassigned, read-only, for a Task nobody has', async () => {
    asMember()
    answerTask(sb)
    open({ task: { ...TASK, assigned_to: null } })

    expect(await screen.findByText('Unassigned')).toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: 'Assignee' })).not.toBeInTheDocument()
  })
})
