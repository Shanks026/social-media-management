import { supabase } from '@/lib/supabase'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/context/AuthContext'
import { resolveWorkspace } from '@/lib/workspace'
import { PROSPECT_STATUSES } from '@/api/prospects'

// ─── Constants ─────────────────────────────────────────────────────────────────

export const ACTIVITY_TYPES = [
  { value: 'call',    label: 'Call',    icon: 'Phone' },
  { value: 'email',   label: 'Email',   icon: 'Mail' },
  { value: 'dm',      label: 'DM',      icon: 'MessageCircle' },
  { value: 'meeting', label: 'Meeting', icon: 'Video' },
  { value: 'note',    label: 'Note',    icon: 'StickyNote' },
]

// status_change is system-generated — not in the manual log list

// ─── Read ──────────────────────────────────────────────────────────────────────

export function useProspectActivities(prospectId) {
  const { workspaceUserId } = useAuth()

  return useQuery({
    queryKey: ['prospect-activities', prospectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('prospect_activities')
        .select('*')
        .eq('prospect_id', prospectId)
        .order('occurred_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    enabled: !!prospectId && !!workspaceUserId,
    staleTime: 30000,
    retry: 1,
  })
}

// ─── Mutations ─────────────────────────────────────────────────────────────────

export function useLogActivity() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ prospect_id, type, body, occurred_at, metadata }) => {
      const { workspaceUserId } = await resolveWorkspace()
      const { data, error } = await supabase
        .from('prospect_activities')
        .insert({
          prospect_id,
          user_id:     workspaceUserId,
          type:        type || 'note',
          body:        body || null,
          occurred_at: occurred_at || new Date().toISOString(),
          metadata:    metadata || null,
        })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ['prospect-activities', data.prospect_id],
      })
    },
  })
}

export function useDeleteActivity() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, prospect_id }) => {
      const { error } = await supabase
        .from('prospect_activities')
        .delete()
        .eq('id', id)
      if (error) throw error
      return { prospect_id }
    },
    onSuccess: ({ prospect_id }) => {
      queryClient.invalidateQueries({
        queryKey: ['prospect-activities', prospect_id],
      })
    },
  })
}

// ─── Helper used by useUpdateProspect ─────────────────────────────────────────

/**
 * Insert a status_change activity entry.
 * Called directly from the useUpdateProspect mutation — not via a hook.
 */
export async function logStatusChange({ prospect_id, from_status, to_status, workspaceUserId }) {
  const fromLabel = PROSPECT_STATUSES.find((s) => s.value === from_status)?.label ?? from_status
  const toLabel   = PROSPECT_STATUSES.find((s) => s.value === to_status)?.label ?? to_status

  const { error } = await supabase.from('prospect_activities').insert({
    prospect_id,
    user_id:    workspaceUserId,
    type:       'status_change',
    body:       `Status changed from ${fromLabel} to ${toLabel}`,
    occurred_at: new Date().toISOString(),
    metadata:   { from_status, to_status },
  })

  // Non-fatal — log but don't throw
  if (error) console.warn('Failed to log status change activity:', error)
}
