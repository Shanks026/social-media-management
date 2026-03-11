import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

// ─── Query Keys ────────────────────────────────────────────────────────────────

export const teamKeys = {
  members: (agencyUserId) => ['team', 'members', agencyUserId],
  invites: (agencyUserId) => ['team', 'invites', agencyUserId],
  removed: (agencyUserId) => ['team', 'removed', agencyUserId],
}

// ─── Read Hooks ────────────────────────────────────────────────────────────────

/**
 * Fetch active team members for the workspace.
 * Subscribes to Realtime changes on agency_members so cross-session joins
 * (new member accepting an invite) are reflected without a manual refresh.
 */
export function useTeamMembers() {
  const { workspaceUserId } = useAuth()
  const queryClient = useQueryClient()

  // Realtime: invalidate when any row in agency_members changes for this workspace
  useEffect(() => {
    if (!workspaceUserId) return

    const channel = supabase
      .channel(`agency_members:${workspaceUserId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'agency_members',
          filter: `agency_user_id=eq.${workspaceUserId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: teamKeys.members(workspaceUserId) })
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [workspaceUserId, queryClient])

  return useQuery({
    queryKey: teamKeys.members(workspaceUserId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_team_members', {
        p_agency_user_id: workspaceUserId,
      })

      if (error) throw error
      return data ?? []
    },
    enabled: !!workspaceUserId,
  })
}

/**
 * Fetch pending (unused, non-expired) invites for the workspace.
 * Only shown to admins. Realtime subscription keeps list fresh when
 * an invite is accepted or revoked from another session.
 */
export function usePendingInvites() {
  const { workspaceUserId } = useAuth()
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!workspaceUserId) return

    const channel = supabase
      .channel(`agency_invites:${workspaceUserId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'agency_invites',
          filter: `agency_user_id=eq.${workspaceUserId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: teamKeys.invites(workspaceUserId) })
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [workspaceUserId, queryClient])

  return useQuery({
    queryKey: teamKeys.invites(workspaceUserId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agency_invites')
        .select('id, token, created_at, expires_at')
        .eq('agency_user_id', workspaceUserId)
        .is('accepted_at', null)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })

      if (error) throw error
      return data ?? []
    },
    enabled: !!workspaceUserId,
  })
}

// ─── Mutations ─────────────────────────────────────────────────────────────────

/**
 * Generate a new invite token and return the full join URL.
 */
export function useGenerateInvite() {
  const queryClient = useQueryClient()
  const { workspaceUserId } = useAuth()

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from('agency_invites')
        .insert({ agency_user_id: workspaceUserId })
        .select('token')
        .single()

      if (error) throw error

      const baseUrl = import.meta.env.VITE_APP_URL || window.location.origin
      return `${baseUrl}/join/${data.token}`
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teamKeys.invites(workspaceUserId) })
    },
  })
}

/**
 * Revoke a pending invite (set expires_at to now).
 */
export function useRevokeInvite() {
  const queryClient = useQueryClient()
  const { workspaceUserId } = useAuth()

  return useMutation({
    mutationFn: async (inviteId) => {
      const { error } = await supabase
        .from('agency_invites')
        .update({ expires_at: new Date().toISOString() })
        .eq('id', inviteId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teamKeys.invites(workspaceUserId) })
    },
  })
}

/**
 * Remove an active team member (set is_active = false).
 */
export function useRemoveMember() {
  const queryClient = useQueryClient()
  const { workspaceUserId } = useAuth()

  return useMutation({
    mutationFn: async (memberId) => {
      const { error } = await supabase
        .from('agency_members')
        .update({ is_active: false })
        .eq('id', memberId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teamKeys.members(workspaceUserId) })
      queryClient.invalidateQueries({ queryKey: teamKeys.removed(workspaceUserId) })
    },
  })
}

/**
 * Fetch removed (is_active = false) team members.
 */
export function useRemovedMembers() {
  const { workspaceUserId } = useAuth()

  return useQuery({
    queryKey: teamKeys.removed(workspaceUserId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_removed_members', {
        p_agency_user_id: workspaceUserId,
      })

      if (error) throw error
      return data ?? []
    },
    enabled: !!workspaceUserId,
  })
}

/**
 * Restore a removed member (set is_active = true).
 */
export function useRestoreMember() {
  const queryClient = useQueryClient()
  const { workspaceUserId } = useAuth()

  return useMutation({
    mutationFn: async (memberId) => {
      const { error } = await supabase
        .from('agency_members')
        .update({ is_active: true })
        .eq('id', memberId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teamKeys.members(workspaceUserId) })
      queryClient.invalidateQueries({ queryKey: teamKeys.removed(workspaceUserId) })
    },
  })
}

/**
 * Permanently delete a member from agency_members AND auth.users.
 * Uses the delete-team-member edge function (requires service role).
 */
export function useDeleteMemberPermanently() {
  const queryClient = useQueryClient()
  const { workspaceUserId } = useAuth()

  return useMutation({
    mutationFn: async (memberId) => {
      const { data, error } = await supabase.functions.invoke('delete-team-member', {
        body: { memberId },
      })

      if (error) throw error
      if (data?.error) throw new Error(data.error)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teamKeys.removed(workspaceUserId) })
    },
  })
}

// ─── Public (unauthenticated) ──────────────────────────────────────────────────

/**
 * Look up an invite by token (public — used on /join/:token before signup).
 * Uses the get_invite_by_token SECURITY DEFINER RPC.
 */
export async function fetchInviteByToken(token) {
  const { data, error } = await supabase.rpc('get_invite_by_token', { p_token: token })
  if (error) throw error
  return data
}

/**
 * Complete the team join flow after Supabase auth signup.
 * Validates the token, wires up agency_members, marks invite accepted.
 */
export async function joinTeam({ token, firstName, lastName, functionalRole }) {
  const { data, error } = await supabase.rpc('join_team', {
    p_token: token,
    p_first_name: firstName,
    p_last_name: lastName,
    p_functional_role: functionalRole || null,
  })
  if (error) throw error
  return data
}
