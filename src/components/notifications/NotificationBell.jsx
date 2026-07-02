import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { useQueryClient } from '@tanstack/react-query'
import {
  Bell,
  FileText,
  ClipboardList,
  Share2,
  CheckCircle2,
  UserPlus,
  AlertCircle,
  MessageCircle,
  CheckCheck,
} from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import {
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyHeader,
} from '@/components/ui/empty'
import { cn } from '@/lib/utils'
import {
  useUnreadNotificationCount,
  useNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  notificationKeys,
} from '@/api/notifications'
import { useAuth } from '@/context/AuthContext'

// ─── Type config ───────────────────────────────────────────────────────────────

const TYPE_CONFIG = {
  post_status_changed:    { icon: FileText,       color: 'text-blue-500',   bg: 'bg-blue-100 dark:bg-blue-950' },
  task_assigned:          { icon: ClipboardList,   color: 'text-violet-500', bg: 'bg-violet-100 dark:bg-violet-950' },
  task_updated:           { icon: ClipboardList,   color: 'text-violet-500', bg: 'bg-violet-100 dark:bg-violet-950' },
  campaign_review_shared: { icon: Share2,          color: 'text-amber-500',  bg: 'bg-amber-100 dark:bg-amber-950' },
  campaign_reviewed:      { icon: CheckCircle2,    color: 'text-green-500',  bg: 'bg-green-100 dark:bg-green-950' },
  team_member_joined:     { icon: UserPlus,        color: 'text-teal-500',   bg: 'bg-teal-100 dark:bg-teal-950' },
  invoice_overdue:        { icon: AlertCircle,     color: 'text-destructive', bg: 'bg-red-100 dark:bg-red-950' },
  comment_added:          { icon: MessageCircle,   color: 'text-sky-500',    bg: 'bg-sky-100 dark:bg-sky-950' },
}

function resolveRoute(notification) {
  if (notification.link) return notification.link
  const { entity_type, entity_id } = notification
  if (!entity_type || !entity_id) return null
  const map = {
    post:     `/posts`,
    task:     `/tasks`,
    campaign: `/campaigns/${entity_id}`,
    invoice:  `/finance/invoices`,
    team:     `/settings`,
  }
  return map[entity_type] ?? null
}

// ─── Single row ────────────────────────────────────────────────────────────────

function NotificationRow({ notification, onRead }) {
  const navigate = useNavigate()
  const config = TYPE_CONFIG[notification.type] ?? { icon: Bell, color: 'text-muted-foreground', bg: 'bg-muted' }
  const Icon = config.icon
  const isUnread = !notification.read_at
  const route = resolveRoute(notification)

  const handleClick = async () => {
    if (isUnread) {
      await markNotificationRead(notification.id)
      onRead()
    }
    if (route) navigate(route)
  }

  return (
    <button
      onClick={handleClick}
      aria-label={`${notification.title}${isUnread ? ' (unread)' : ''}`}
      className={cn(
        'w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
        isUnread && 'bg-muted/40',
      )}
    >
      {/* Type icon */}
      <span aria-hidden="true" className={cn('mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg', config.bg)}>
        <Icon className={cn('size-4', config.color)} />
      </span>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className={cn('text-sm leading-snug', isUnread ? 'font-medium' : 'text-muted-foreground')}>
            {notification.title}
          </p>
          {isUnread && (
            <span aria-hidden="true" className="mt-1.5 size-2 shrink-0 rounded-full bg-rose-500" />
          )}
        </div>
        {notification.body && (
          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
            {notification.body}
          </p>
        )}
        <p className="mt-1 text-[11px] text-muted-foreground/70">
          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
        </p>
      </div>
    </button>
  )
}

// ─── Panel content ─────────────────────────────────────────────────────────────

function NotificationPanel() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { data: notifications = [], isLoading } = useNotifications()
  const { data: unreadCount = 0 } = useUnreadNotificationCount()

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: notificationKeys.count(user?.id) })
    queryClient.invalidateQueries({ queryKey: notificationKeys.list(user?.id) })
  }

  const handleMarkAllRead = async () => {
    if (!user?.id || unreadCount === 0) return
    await markAllNotificationsRead(user.id)
    invalidate()
  }

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">Notifications</h3>
          {unreadCount > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[11px] font-semibold text-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            onClick={handleMarkAllRead}
          >
            <CheckCheck className="size-3.5" />
            Mark all read
          </Button>
        )}
      </div>

      {/* List */}
      <ScrollArea className="h-105" role="log" aria-live="polite" aria-label="Notifications">
        {isLoading ? (
          <div className="flex flex-col divide-y">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3 px-4 py-3">
                <Skeleton className="mt-0.5 size-8 rounded-lg shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-3/4" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
            <EmptyMedia className="mb-3 text-4xl">🔔</EmptyMedia>
            <EmptyHeader>
              <EmptyTitle className="font-bold text-base">All caught up</EmptyTitle>
              <EmptyDescription>
                Notifications about posts, tasks, and campaigns will appear here.
              </EmptyDescription>
            </EmptyHeader>
          </div>
        ) : (
          <div className="flex flex-col divide-y">
            {notifications.map((n) => (
              <NotificationRow
                key={n.id}
                notification={n}
                onRead={invalidate}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}

// ─── Bell button ───────────────────────────────────────────────────────────────

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const { data: unreadCount = 0 } = useUnreadNotificationCount()

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="relative flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Notifications"
        >
          <Bell className="size-4.5" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 flex size-2 items-center justify-center">
              <span className="animate-ping absolute inline-flex size-full rounded-full bg-rose-500 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-rose-500" />
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-95 p-0 shadow-lg"
      >
        <NotificationPanel onClose={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  )
}
