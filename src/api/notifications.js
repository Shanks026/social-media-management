import { supabase } from '@/lib/supabase'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/context/AuthContext'
import { useEffect } from 'react'
import { resolveWorkspace } from '@/lib/workspace'

// ─── Query Keys ────────────────────────────────────────────────────────────────

export const notificationKeys = {
  count: (userId) => ['notifications', 'count', userId],
  list: (userId) => ['notifications', 'list', userId],
}

// ─── Shared helper ─────────────────────────────────────────────────────────────

/**
 * Insert notification rows for a set of recipients.
 *
 * Automatically:
 * - Strips the actor from the recipient list (never self-notify)
 * - De-dupes recipients
 * - No-ops if the resolved recipient list is empty
 *
 * Call this from mutation functions at the same points where `send-*`
 * edge functions are invoked.
 *
 * @param {object} opts
 * @param {string}   opts.workspaceId
 * @param {string}   opts.actorUserId   - the user performing the action (excluded from recipients)
 * @param {string[]} opts.recipients    - UIDs who should receive the notification
 * @param {string}   opts.type          - notification type key
 * @param {string}   opts.title
 * @param {string}   [opts.body]
 * @param {string}   [opts.entityType]  - 'post' | 'task' | 'campaign' | 'invoice' | 'team'
 * @param {string}   [opts.entityId]
 * @param {string}   [opts.link]        - explicit route (e.g. '/campaigns/xxx')
 */
export async function notify({
  workspaceId,
  actorUserId,
  recipients,
  type,
  title,
  body,
  entityType,
  entityId,
  link,
}) {
  const unique = [...new Set(recipients)].filter(
    (uid) => uid && uid !== actorUserId,
  )
  if (!unique.length) return

  const rows = unique.map((uid) => ({
    workspace_id: workspaceId,
    recipient_user_id: uid,
    actor_user_id: actorUserId ?? null,
    type,
    title,
    body: body ?? null,
    entity_type: entityType ?? null,
    entity_id: entityId ?? null,
    link: link ?? null,
  }))

  const { error } = await supabase.from('notifications').insert(rows)
  if (error) throw error
}

/**
 * Convenience wrapper for mutation functions that haven't already resolved the
 * workspace. Resolves workspace + caller UID, then calls notify().
 */
export async function notifyFromMutation(opts) {
  const { user, workspaceUserId } = await resolveWorkspace()
  await notify({
    workspaceId: workspaceUserId,
    actorUserId: user.id,
    ...opts,
  })
}

// ─── Read Hooks ────────────────────────────────────────────────────────────────

/**
 * Unread notification count for the badge.
 * Mirrors the shape of useMyOverdueTaskCount() in tasks.js.
 */
export function useUnreadNotificationCount() {
  const { user, workspaceUserId } = useAuth()
  const queryClient = useQueryClient()

  // Realtime invalidation — same pattern as team.js
  useEffect(() => {
    if (!user?.id) return

    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_user_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: notificationKeys.count(user.id) })
          queryClient.invalidateQueries({ queryKey: notificationKeys.list(user.id) })
        },
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [user?.id, queryClient])

  return useQuery({
    queryKey: notificationKeys.count(user?.id),
    queryFn: async () => {
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('recipient_user_id', user.id)
        .is('read_at', null)
      if (error) throw error
      return count ?? 0
    },
    enabled: !!user?.id && !!workspaceUserId,
  })
}

/**
 * Paginated notification list for the panel.
 * Returns newest-first, max 50 items.
 */
export function useNotifications() {
  const { user, workspaceUserId } = useAuth()

  return useQuery({
    queryKey: notificationKeys.list(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('recipient_user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw error
      return data ?? []
    },
    enabled: !!user?.id && !!workspaceUserId,
  })
}

// ─── Mutations ─────────────────────────────────────────────────────────────────

export async function markNotificationRead(id) {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
    .is('read_at', null)
  if (error) throw error
}

export async function markAllNotificationsRead(userId) {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('recipient_user_id', userId)
    .is('read_at', null)
  if (error) throw error
}
