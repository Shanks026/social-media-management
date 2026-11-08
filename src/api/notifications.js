import { supabase } from '@/lib/supabase'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/context/AuthContext'
import { useEffect, useRef } from 'react'

// ─── Query Keys ────────────────────────────────────────────────────────────────

export const notificationKeys = {
  count: (userId) => ['notifications', 'count', userId],
  list: (userId) => ['notifications', 'list', userId],
}

// ─── Read Hooks ────────────────────────────────────────────────────────────────

/**
 * Unread notification count for the badge.
 * Mirrors the shape of useMyOpenTaskCount() in tasks.js.
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
 * Fires `onInsert(row)` for each notification that arrives for the current
 * user while the app is open. Purely a delivery stream — no toasting or
 * routing here, so the data layer stays free of UI concerns.
 *
 * Mount this ONCE (currently NotificationBell). It deliberately uses its own
 * channel topic rather than piggybacking on useUnreadNotificationCount's,
 * because that hook renders in two places at once when the bell popover is
 * open and would deliver every arrival twice.
 */
export function useNotificationStream(onInsert) {
  const { user } = useAuth()
  // Ref-held so a caller passing an inline arrow doesn't resubscribe each render.
  const handlerRef = useRef(onInsert)
  useEffect(() => {
    handlerRef.current = onInsert
  }, [onInsert])

  useEffect(() => {
    if (!user?.id) return

    const channel = supabase
      .channel(`notification-stream:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_user_id=eq.${user.id}`,
        },
        (payload) => handlerRef.current?.(payload.new),
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [user?.id])
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

/**
 * Manually delete a single notification. Additive to the 30-day auto-expiry
 * cron job, not a replacement for it — RLS scopes this to the caller's own
 * notifications (recipient_user_id = auth.uid()).
 */
export async function deleteNotification(id) {
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('id', id)
  if (error) throw error
}
