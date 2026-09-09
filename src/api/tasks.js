import { supabase } from '@/lib/supabase'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/context/AuthContext'
import { resolveWorkspace } from '@/lib/workspace'
import { fetchPostSummary } from '@/api/posts'

/**
 * Whether a task id exists at all in the caller's workspace, without
 * exposing any of its content — for callers that only have the id (e.g. a
 * chat reference) and need to tell "genuinely deleted" apart from "exists,
 * but tasks_select's creator/assigned_to/admin RLS scope means you can't see
 * it" (tasks are private to creator/assignee/admin, unlike deliverables).
 */
export function useTaskExists(taskId, { enabled = true } = {}) {
  return useQuery({
    queryKey: ['tasks', 'exists', taskId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('task_reference_exists', { p_task_id: taskId })
      if (error) throw error
      return !!data
    },
    enabled: !!taskId && enabled,
  })
}

export function useTasks({ clientId, campaignId, assignedToMe } = {}) {
  const { workspaceUserId, user } = useAuth()
  return useQuery({
    queryKey: [
      'tasks', 'list',
      {
        clientId: clientId ?? null,
        campaignId: campaignId ?? null,
        ...(assignedToMe ? { assignedToMe: true } : {}),
      },
    ],
    queryFn: async () => {
      let q = supabase
        .from('tasks')
        .select('*')
        .eq('workspace_id', workspaceUserId)
        .order('created_at', { ascending: false })

      if (clientId) q = q.eq('client_id', clientId)
      if (campaignId) q = q.eq('campaign_id', campaignId)
      if (assignedToMe && user?.id) q = q.eq('assigned_to', user.id)

      const { data, error } = await q
      if (error) throw error
      return data ?? []
    },
    enabled: !!workspaceUserId,
  })
}

export async function createTask({ post_ids, ...data }) {
  const { user, workspaceUserId } = await resolveWorkspace()
  const { data: row, error } = await supabase
    .from('tasks')
    .insert({
      workspace_id: workspaceUserId,
      created_by: user.id,
      ...data,
    })
    .select('id')
    .single()
  if (error) throw error

  if (post_ids?.length) {
    await replaceTaskDeliverables(row.id, post_ids, workspaceUserId)
  }
  // Creating a task already assigned to someone is a handoff too, so it
  // emails on the same terms as a reassignment.
  if (data.assigned_to) notifyAssignee(row.id)
  return row.id
}

export async function updateTask(id, { post_ids, ...updates }) {
  const { error } = await supabase
    .from('tasks')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error

  // Only touch links when the caller actually manages them (the edit dialog),
  // so unrelated updates (inline field edits) never wipe deliverables.
  if (post_ids !== undefined) {
    await replaceTaskDeliverables(id, post_ids)
  }
}

// ─── Deliverable (post) links ───────────────────────────────────────────────

/** Post ids currently linked to a task — for seeding the edit dialog. */
export async function fetchTaskPostIds(taskId) {
  const { data, error } = await supabase
    .from('task_posts')
    .select('post_id')
    .eq('task_id', taskId)
  if (error) throw error
  return (data ?? []).map((r) => r.post_id)
}

/** Resolved post summaries for a task's linked deliverables (for display). */
export async function fetchTaskDeliverables(taskId) {
  const ids = await fetchTaskPostIds(taskId)
  if (!ids.length) return []
  const summaries = await Promise.all(ids.map(fetchPostSummary))
  return summaries.filter(Boolean)
}

/**
 * Replace the full set of deliverable links for a task (clear + insert).
 * workspaceId is resolved on demand when not supplied by the caller.
 */
export async function replaceTaskDeliverables(taskId, postIds, workspaceId) {
  const wsId = workspaceId ?? (await resolveWorkspace()).workspaceUserId

  const { error: delError } = await supabase
    .from('task_posts')
    .delete()
    .eq('task_id', taskId)
  if (delError) throw delError

  if (postIds.length) {
    const { error: insError } = await supabase.from('task_posts').insert(
      postIds.map((pid) => ({
        task_id: taskId,
        post_id: pid,
        workspace_id: wsId,
      })),
    )
    if (insError) throw insError
  }
}

export async function updateTaskStatus(id, newStatus) {
  const { error } = await supabase.rpc('update_task_status', {
    p_task_id: id,
    p_new_status: newStatus,
  })
  if (error) throw error
}

/**
 * Hand a task off to another workspace member. tasks_update RLS blocks a
 * direct .update() for anyone but the creator or an admin, so this RPC is the
 * only path — mirroring updateTaskStatus's call to update_task_status. The
 * reassign_task RPC itself checks the caller is a participant (creator,
 * current assignee, past assignee, or admin) and the enforce_task_assignment
 * trigger checks the target (active member, not owner/superadmin).
 */
export async function reassignTask(taskId, assignedTo) {
  const { error } = await supabase.rpc('reassign_task', {
    p_task_id: taskId,
    p_assigned_to: assignedTo,
  })
  if (error) throw error
  notifyAssignee(taskId)
}

/**
 * Emails whoever the task now belongs to. Deliberately not awaited and never
 * rethrows: the assignment is already committed by the time this runs, so a
 * mail failure must not surface as a failed reassignment.
 *
 * Only the task id goes over the wire. The recipient, the sender's name and
 * the per-member opt-out are all resolved inside the edge function, which
 * also drops self-assignments — so there is nothing to decide here, and no
 * way for a caller to aim the mail at an address of their choosing.
 */
function notifyAssignee(taskId) {
  supabase.functions
    .invoke('send-task-assignment-email', { body: { task_id: taskId } })
    .catch(() => {})
}

/**
 * A single task by id, for the detail page (`/tasks/:taskId`). Returns null
 * rather than throwing when the row isn't visible — `tasks_select` hides a
 * task the caller has no hand in, and PostgREST reports that identically to a
 * genuinely deleted row. The page pairs this with `useTaskExists` to tell the
 * two apart, the same way ChatEntityCard already does.
 *
 * Client/campaign/member ids stay raw here; every task surface resolves them
 * through `useTaskLookups()`, so duplicating that join server-side would give
 * the page a second, divergent source for the same names.
 */
export function useTaskById(taskId) {
  const { workspaceUserId } = useAuth()
  return useQuery({
    queryKey: ['tasks', 'detail', taskId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', taskId)
        .maybeSingle()
      if (error) throw error
      return data ?? null
    },
    enabled: !!taskId && !!workspaceUserId,
  })
}

/**
 * Assignment + status history for one task, newest first. Backs the Activity
 * tab (Phase 2) and the "Assigned By" field, which previously — incorrectly —
 * showed the task's creator regardless of who actually assigned it.
 */
export function useTaskActivity(taskId) {
  const { workspaceUserId } = useAuth()
  return useQuery({
    queryKey: ['tasks', 'activity', taskId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('task_activity')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    enabled: !!taskId && !!workspaceUserId,
  })
}

/**
 * Watcher ids for a task: its creator plus everyone who has ever been
 * assigned it, minus the current assignee (who's already shown separately as
 * "Assigned To"). Derived from the same activity feed the Activity tab reads,
 * so no extra round trip.
 */
export function useTaskWatchers(task) {
  const { data: activity = [] } = useTaskActivity(task?.id)
  if (!task) return []
  const ids = new Set([task.created_by])
  activity.forEach((row) => {
    if (row.type === 'assigned' && row.to_user_id) ids.add(row.to_user_id)
  })
  ids.delete(task.assigned_to)
  return [...ids]
}

export async function deleteTask(id) {
  const { error } = await supabase.from('tasks').delete().eq('id', id)
  if (error) throw error
}

/**
 * Reverse lookup: tasks linked to a given deliverable (post), newest-first.
 * postId is the real posts.id (task_posts.post_id), i.e. post.actual_post_id.
 */
export function useTasksForPost(postId) {
  const { workspaceUserId } = useAuth()
  return useQuery({
    queryKey: ['tasks', 'for-post', postId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('task_posts')
        .select('tasks(*)')
        .eq('post_id', postId)
      if (error) throw error
      return (data ?? [])
        .map((r) => r.tasks)
        .filter(Boolean)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    },
    enabled: !!postId && !!workspaceUserId,
  })
}

export function useMyTasks() {
  const { workspaceUserId, user } = useAuth()
  return useQuery({
    queryKey: ['tasks', 'list', 'my-tasks', user?.id],
    queryFn: async () => {
      if (!user?.id) return []
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('workspace_id', workspaceUserId)
        .not('status', 'in', '("COMPLETED","ARCHIVED")')
        .or(`assigned_to.eq.${user.id},created_by.eq.${user.id}`)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    enabled: !!workspaceUserId && !!user?.id,
  })
}

/**
 * Open work assigned to the caller — everything that isn't COMPLETED or
 * ARCHIVED — for the sidebar's Tasks & Todos count.
 *
 * Two things this deliberately does NOT do, both of which it used to:
 *
 * Filter on `due_at < now()`. That made the number an overdue counter, so a
 * task assigned to you with a future due date — or no due date at all, since
 * NULL fails the comparison rather than passing it — was invisible, and the
 * sidebar read zero while you had work waiting.
 *
 * Match `created_by` as well as `assigned_to`. That counted tasks you raised
 * for other people, so the number mixed your own work with work you were
 * waiting on someone else to finish.
 */
export function useMyOpenTaskCount() {
  const { workspaceUserId, user } = useAuth()
  return useQuery({
    queryKey: ['tasks', 'list', 'my-open-count', user?.id],
    queryFn: async () => {
      if (!user?.id) return 0
      const { count, error } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', workspaceUserId)
        .not('status', 'in', '("COMPLETED","ARCHIVED")')
        .eq('assigned_to', user.id)
      if (error) throw error
      return count ?? 0
    },
    enabled: !!workspaceUserId && !!user?.id,
  })
}
