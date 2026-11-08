import { describe, it, expect, vi, beforeEach } from 'vitest'

// Regression test for audit bug B12: changing the assignee in the Edit dialog
// (updateTask) sent no assignment email; only createTask and reassignTask did.
// Whether the email actually goes out (opt-out, self-assignment) is decided by
// the send-task-assignment-email edge function, so the client only has to call
// it when the assignee changes.

let currentAssignee
const update = vi.fn()
const invoke = vi.fn()

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: { assigned_to: currentAssignee }, error: null }),
        }),
      }),
      update: (row) => ({
        eq: async () => {
          update(row)
          return { error: null }
        },
      }),
    }),
    functions: { invoke: (...a) => invoke(...a) },
  },
}))

vi.mock('@/lib/workspace', () => ({ resolveWorkspace: vi.fn() }))

import { updateTask } from '@/api/tasks'

describe('updateTask assignee email', () => {
  beforeEach(() => {
    currentAssignee = 'alice'
    update.mockReset()
    invoke.mockReset().mockResolvedValue({ data: null, error: null })
  })

  it('emails the new assignee when the assignee changes', async () => {
    await updateTask('task-1', { title: 'T', assigned_to: 'bob' })
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ assigned_to: 'bob' }))
    expect(invoke).toHaveBeenCalledWith('send-task-assignment-email', {
      body: { task_id: 'task-1' },
    })
  })

  it('sends nothing when the assignee is unchanged', async () => {
    await updateTask('task-1', { title: 'T', assigned_to: 'alice' })
    expect(invoke).not.toHaveBeenCalled()
  })

  it('sends nothing when the task is unassigned', async () => {
    await updateTask('task-1', { title: 'T', assigned_to: null })
    expect(invoke).not.toHaveBeenCalled()
  })

  it('sends nothing for updates that do not touch the assignee', async () => {
    await updateTask('task-1', { title: 'Renamed' })
    expect(invoke).not.toHaveBeenCalled()
  })
})
