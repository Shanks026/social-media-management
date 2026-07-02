import { supabase } from '@/lib/supabase'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/context/AuthContext'
import { resolveWorkspace } from '@/lib/workspace'

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
        .order('due_at', { ascending: true, nullsFirst: false })
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

export async function createTask(data) {
  const { user, workspaceUserId } = await resolveWorkspace()
  const { error } = await supabase.from('tasks').insert({
    workspace_id: workspaceUserId,
    created_by: user.id,
    ...data,
  })
  if (error) throw error
}

export async function updateTask(id, updates) {
  const { error } = await supabase
    .from('tasks')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function updateTaskStatus(id, newStatus) {
  const { error } = await supabase.rpc('update_task_status', {
    p_task_id: id,
    p_new_status: newStatus,
  })
  if (error) throw error
}

export async function deleteTask(id) {
  const { error } = await supabase.from('tasks').delete().eq('id', id)
  if (error) throw error
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
        .order('due_at', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    enabled: !!workspaceUserId && !!user?.id,
  })
}

export function useMyOverdueTaskCount() {
  const { workspaceUserId, user } = useAuth()
  return useQuery({
    queryKey: ['tasks', 'list', 'overdue-count', user?.id],
    queryFn: async () => {
      if (!user?.id) return 0
      const { count, error } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', workspaceUserId)
        .lt('due_at', new Date().toISOString())
        .not('status', 'in', '("COMPLETED","ARCHIVED")')
        .or(`assigned_to.eq.${user.id},created_by.eq.${user.id}`)
      if (error) throw error
      return count ?? 0
    },
    enabled: !!workspaceUserId && !!user?.id,
  })
}
