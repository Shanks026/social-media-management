// Outreach API (ADR 0007): the key factory, a plain async function per
// mutation (the unit-test surface, callable outside React), and a hook that
// wraps each one and owns the cache invalidation.
import { supabase } from '@/lib/supabase'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/context/AuthContext'
import { resolveWorkspace } from '@/lib/workspace'
import { statusLabel as prospectStatusLabel } from '@/lib/domain/prospectStatus'
import { prospectActivityKeys } from '@/api/queryKeys'

export { prospectActivityKeys }

// ─── Constants ─────────────────────────────────────────────────────────────────

export const ACTIVITY_TYPES = [
  { value: 'whatsapp',  label: 'WhatsApp',  icon: 'MessageCircle' },
  { value: 'instagram', label: 'Instagram', icon: 'Instagram' },
  { value: 'email',     label: 'Email',     icon: 'Mail' },
  { value: 'call',      label: 'Call',      icon: 'Phone' },
  { value: 'inperson',  label: 'In Person', icon: 'Handshake' },
  { value: 'others',    label: 'Others',    icon: 'Ellipsis' },
]

// status_change is system-generated — not in the manual log list

// ─── Read ──────────────────────────────────────────────────────────────────────

export function useProspectActivities(prospectId) {
  const { workspaceUserId } = useAuth()

  return useQuery({
    queryKey: prospectActivityKeys.list(prospectId),
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

export async function logActivity({ prospect_id, type, body, occurred_at, metadata }) {
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
}

export function useLogActivity() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: logActivity,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: prospectActivityKeys.list(data.prospect_id) })
    },
  })
}

export async function deleteActivity({ id, prospect_id }) {
  const { error } = await supabase
    .from('prospect_activities')
    .delete()
    .eq('id', id)
  if (error) throw error
  return { prospect_id }
}

export function useDeleteActivity() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteActivity,
    onSuccess: ({ prospect_id }) => {
      queryClient.invalidateQueries({ queryKey: prospectActivityKeys.list(prospect_id) })
    },
  })
}

// ─── Helper used by updateProspect and markProposalSent ───────────────────────

/**
 * Insert a status_change activity entry. Called from inside other mutations
 * (their hooks invalidate prospectActivityKeys), so it has no hook of its own.
 */
export async function logStatusChange({ prospect_id, from_status, to_status, workspaceUserId }) {
  const fromLabel = prospectStatusLabel(from_status)
  const toLabel   = prospectStatusLabel(to_status)

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
