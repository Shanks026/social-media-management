import { useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useNotificationStream, notificationKeys } from '@/api/notifications'
import { useAuth } from '@/context/AuthContext'
import { resolveNotificationRoute } from '@/components/notifications/routes'

/**
 * Surfaces notifications that arrive *while the user is working* as a toast.
 *
 * Deliberately arrival-only: it never reports a backlog on load. The bell
 * badge already states the unread count permanently, so a "you have N unread"
 * summary would repeat visible state; a notification landing mid-session is an
 * event the user would otherwise miss when the bell is out of view.
 *
 * Renders nothing — mount once, in AppHeader alongside the bell.
 */
export function NotificationToaster() {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const { user } = useAuth()

  const handleArrival = useCallback(
    (row) => {
      // A chat mention while the channel is already on screen is noise — the
      // message itself is right there.
      if (row.type?.startsWith('chat_') && location.pathname.startsWith('/chat')) return

      const route = resolveNotificationRoute(row)

      // Keyed by row id so a duplicate delivery (e.g. StrictMode's double
      // mount in dev) collapses into the same toast instead of stacking.
      toast(row.title, {
        id: `notification-${row.id}`,
        description: row.body || undefined,
        action: route
          ? {
              label: 'View',
              onClick: () => {
                navigate(route)
                queryClient.invalidateQueries({ queryKey: notificationKeys.count(user?.id) })
              },
            }
          : undefined,
      })
    },
    [location.pathname, navigate, queryClient, user?.id],
  )

  useNotificationStream(handleArrival)

  return null
}
