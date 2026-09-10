import { useEffect, useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

// ─── Query Keys ────────────────────────────────────────────────────────────────

export const teamKeys = {
  members: (agencyUserId) => ['team', 'members', agencyUserId],
  invites: (agencyUserId) => ['team', 'invites', agencyUserId],
  removed: (agencyUserId) => ['team', 'removed', agencyUserId],
  myRecord: (agencyUserId, userId) => ['team', 'my-record', agencyUserId, userId],
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
 * Ticks on a timer so a list filtered by "is this still in the future" keeps
 * shedding rows as time passes.
 *
 * Expiry is the one state change in this table that produces no event: no row
 * is written when a timestamp quietly goes by, so the Realtime subscription
 * never fires for it, and with `refetchOnWindowFocus` off nothing else
 * re-evaluates the list either. Without this, an invite that expires while
 * someone is sitting on the Team page stays listed — stale date, working-
 * looking Copy button, dead URL.
 *
 * The timer only runs while there is actually something that can expire.
 */
function useNow(enabled, intervalMs = 15000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!enabled) return
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [enabled, intervalMs])
  return now
}

/**
 * Fetch pending (unused, non-expired) invites for the workspace.
 * Only shown to admins. Realtime subscription keeps list fresh when
 * an invite is accepted or revoked from another session.
 *
 * Any number of invites can be live at once, each with its own `expires_at` —
 * there is no cap, and they are independent: one expiring never affects
 * another. Revoking backdates `expires_at`, so "delete" and "expired" are the
 * same state and drop out through the same filter.
 *
 * Links are also multi-use: `use_count` is how many people have joined on one,
 * not a limit. A link keeps working until it expires or is revoked.
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

  const query = useQuery({
    queryKey: teamKeys.invites(workspaceUserId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agency_invites')
        .select('id, token, created_at, expires_at, system_role, label, permissions, use_count')
        .eq('agency_user_id', workspaceUserId)
        // Deliberately not filtered by accepted_at: links are multi-use, so
        // someone having joined on one says nothing about whether it is still
        // good. Expiry (and revocation, which is a backdated expiry) is the
        // only thing that retires a link.
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })

      if (error) throw error
      return data ?? []
    },
    enabled: !!workspaceUserId,
  })

  // The server filter above is only correct at the moment it runs. Re-applying
  // it on a tick is what actually makes a link vanish at its own expiry rather
  // than at the next refetch — and it stays a pure client-side narrowing of
  // rows already fetched, so it costs no extra requests.
  const rows = query.data
  const now = useNow((rows?.length ?? 0) > 0)
  const data = useMemo(
    () => (rows ?? []).filter((i) => new Date(i.expires_at).getTime() > now),
    [rows, now],
  )

  return { ...query, data }
}

// ─── Invite defaults ───────────────────────────────────────────────────────────

// Shared so InviteDialog and the onboarding invite step can't drift apart — they
// previously each declared their own copy of the expiry window.
export const DEFAULT_INVITE_EXPIRY_DAYS = 7
export const MAX_INVITE_EXPIRY_DAYS = 30
export const DEFAULT_INVITE_PERMISSIONS = { documents: 'view' }

/**
 * Invite expiry is a *date*, not an instant: a link labelled "Expires 23 Sep"
 * has to keep working all through the 23rd, so every date the invite flow
 * produces is pinned to the end of its day.
 *
 * This is not cosmetic. The dialog's calendar hands back local midnight, which
 * expired a link at the *start* of the day it was labelled with — a day early
 * — and made "today" a link that was already in the past the moment it was
 * generated: shown in the dialog with a Copy button, absent from the pending
 * list, and rejected by `join_team`.
 */
export function endOfDay(date) {
  const d = new Date(date)
  d.setHours(23, 59, 59, 999)
  return d
}

export function inviteExpiryInDays(days) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return endOfDay(d)
}

export function defaultInviteExpiry() {
  return inviteExpiryInDays(DEFAULT_INVITE_EXPIRY_DAYS)
}

// ─── Mutations ─────────────────────────────────────────────────────────────────

/**
 * Generate a new invite token and return the full join URL.
 * Accepts { system_role, permissions, expires_at, label } set by the owner
 * in InviteDialog — permissions is computed by the caller ({ documents: 'manage' }
 * for admin, the chosen level for member), mirroring EditAccessDialog's rule.
 *
 * Every argument defaults to the standard member invite, so a caller that just
 * wants "the normal link" (onboarding) stays in lockstep with the dialog.
 */
export function useGenerateInvite() {
  const queryClient = useQueryClient()
  const { workspaceUserId } = useAuth()

  return useMutation({
    mutationFn: async ({
      system_role = 'member',
      permissions = DEFAULT_INVITE_PERMISSIONS,
      expires_at = defaultInviteExpiry().toISOString(),
      label = null,
    } = {}) => {
      const { data: sub, error: subError } = await supabase
        .from('agency_subscriptions')
        .select('max_team_members')
        .eq('user_id', workspaceUserId)
        .single()
      if (subError) throw subError

      if (sub.max_team_members !== null) {
        const { count, error: countError } = await supabase
          .from('agency_members')
          .select('*', { count: 'exact', head: true })
          .eq('agency_user_id', workspaceUserId)
          .eq('is_active', true)
        if (countError) throw countError
        if (count >= sub.max_team_members) {
          throw new Error('TEAM_SEAT_LIMIT_REACHED')
        }
      }

      const { data, error } = await supabase
        .from('agency_invites')
        .insert({
          agency_user_id: workspaceUserId,
          system_role,
          permissions,
          expires_at,
          label: label?.trim() || null,
        })
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
 * Remove an active team member: sets is_active = false AND force-signs them
 * out of every device by deleting their live sessions (via the
 * remove_team_member RPC, not a direct table write — that's what lets it
 * also touch auth.sessions instead of just agency_members).
 */
export function useRemoveMember() {
  const queryClient = useQueryClient()
  const { workspaceUserId } = useAuth()

  return useMutation({
    mutationFn: async (memberId) => {
      const { error } = await supabase.rpc('remove_team_member', { p_member_id: memberId })
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
 * Permanently delete a member: reassigns their authorship (posts, tasks,
 * chat messages, etc.) to the workspace owner, unassigns their tasks, drops
 * their agency_members row, and — only if this is their only workspace —
 * deletes their auth.users account entirely. Uses the delete-team-member
 * edge function (requires service role for the auth deletion step).
 * Resolves to { authDeleted, authDeleteWarning } so the caller can tell
 * whether the login itself was removed or just their access here.
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
      return { authDeleted: !!data?.authDeleted, authDeleteWarning: data?.authDeleteWarning ?? null }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teamKeys.removed(workspaceUserId) })
    },
  })
}

/**
 * Schedule the ENTIRE workspace for permanent deletion after a 14-day grace
 * period. Owner-only (enforced in the RPC). During the window the owner keeps
 * full access and can cancel; once elapsed, a scheduled job purges all clients,
 * data, storage media, team-member accounts (if it was their last workspace),
 * and the owner's own account. Returns the scheduled timestamp.
 */
export async function requestWorkspaceDeletion() {
  const { data, error } = await supabase.rpc('request_workspace_deletion')
  if (error) throw error
  return data // timestamptz when the purge will run
}

/** Cancel a pending workspace deletion (owner-only). */
export async function cancelWorkspaceDeletion() {
  const { error } = await supabase.rpc('cancel_workspace_deletion')
  if (error) throw error
}

// ─── Current user's own member record ─────────────────────────────────────────

/**
 * Fetch the current user's own row in agency_members.
 * Returns null if the user has no member record (shouldn't happen in normal flow).
 */
export function useMyMemberRecord() {
  const { user, workspaceUserId } = useAuth()

  return useQuery({
    queryKey: teamKeys.myRecord(workspaceUserId, user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agency_members')
        .select('id, system_role, permissions, email_task_assignments')
        .eq('agency_user_id', workspaceUserId)
        .eq('member_user_id', user.id)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!user?.id && !!workspaceUserId,
  })
}

/**
 * The caller's own opt-out for task-assignment emails.
 *
 * Goes through an RPC rather than a direct .update() because the only UPDATE
 * policy on agency_members is owner-only (auth.uid() = agency_user_id) — a
 * member cannot write their own row, and they are exactly who sets this. The
 * function is SECURITY DEFINER and scoped to the caller's own row.
 */
export async function setMyEmailTaskAssignments(enabled) {
  const { error } = await supabase.rpc('set_my_email_task_assignments', {
    p_enabled: enabled,
  })
  if (error) throw error
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
 * No job title is passed any more — a member no longer self-declares one on the
 * join form, and one person can hold several. The owner assigns job roles from
 * the Team page after they join (see `setMemberJobRoles` in `@/api/jobRoles`).
 * Completes the join flow after Supabase auth signup; permissions and system
 * role come from the invite.
 */
export async function joinTeam({ token, firstName, lastName, mobileNumber }) {
  const { data, error } = await supabase.rpc('join_team', {
    p_token: token,
    p_first_name: firstName,
    p_last_name: lastName,
    // Optional. Blank is sent as null so a retry can't wipe a number the
    // person already gave.
    p_mobile_number: mobileNumber?.trim() || null,
  })
  if (error) throw error
  return data
}

/**
 * Promote, demote, or update a team member's access. Owner-only.
 * system_role: 'admin' | 'member'
 * permissions: { documents: 'none' | 'view' | 'manage' }
 */
export async function updateMemberAccess(memberId, { system_role, permissions, roles_and_responsibilities }) {
  const { error } = await supabase.rpc('update_member_access', {
    p_member_id: memberId,
    p_system_role: system_role,
    p_permissions: permissions,
    p_roles_and_responsibilities: roles_and_responsibilities ?? null,
  })
  if (error) throw error
}
