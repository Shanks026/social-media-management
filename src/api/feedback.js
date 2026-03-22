import { supabase } from '@/lib/supabase'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/context/AuthContext'
import { resolveWorkspace } from '@/lib/workspace'

// ─── Read ──────────────────────────────────────────────────────────────────────

export function useMyFeedback() {
  const { workspaceUserId } = useAuth()
  return useQuery({
    queryKey: ['feedback', 'list', workspaceUserId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_feedback')
        .select('*')
        .eq('workspace_user_id', workspaceUserId)
        .eq('dismissed_by_user', false)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    enabled: !!workspaceUserId,
    staleTime: 30000,
    retry: 1,
  })
}

// ─── Mutations ─────────────────────────────────────────────────────────────────

export function useSubmitFeedback() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ type, planName, submitterEmail, agencyName, userName, ...fields }) => {
      const { user, workspaceUserId } = await resolveWorkspace()

      const defaultStatus = type === 'bug_report' ? 'open' : 'received'

      const { data, error } = await supabase
        .from('user_feedback')
        .insert({
          type,
          workspace_user_id: workspaceUserId,
          submitter_user_id: user.id,
          status: defaultStatus,
          plan_name: planName ?? null,
          ...fields,
        })
        .select()
        .single()

      if (error) throw error

      // Fire-and-forget notification — failure must not bubble up to the user
      supabase.functions
        .invoke('send-feedback-notification', {
          body: {
            type,
            title: fields.title,
            description: fields.description ?? null,
            severity: fields.severity ?? null,
            feature_area: fields.feature_area ?? null,
            steps_to_reproduce: fields.steps_to_reproduce ?? null,
            category: fields.category ?? null,
            expected_benefit: fields.expected_benefit ?? null,
            submitterEmail: submitterEmail ?? user.email,
            planName: planName ?? null,
            agencyName: agencyName ?? null,
            userName: userName ?? null,
          },
        })
        .catch(() => {
          // intentionally silent
        })

      return data
    },
    onSuccess: (_, { type }) => {
      // workspaceUserId not available here — invalidate broadly
      queryClient.invalidateQueries({ queryKey: ['feedback', 'list'] })
    },
  })
}

export function useDismissFeedback() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase
        .from('user_feedback')
        .update({ dismissed_by_user: true })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedback', 'list'] })
    },
  })
}
