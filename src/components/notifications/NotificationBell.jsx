import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
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
  Trash2,
  Users,
  TriangleAlert,
  ArrowRightLeft,
  AtSign,
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
import { resolveNotificationRoute } from '@/components/notifications/routes'
import { formatCompactTimeAgo } from '@/lib/helper'
import {
  useUnreadNotificationCount,
  useNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  notificationKeys,
} from '@/api/notifications'
import { useTeamMembers } from '@/api/team'
import { STATUS_CONFIG, StatusChip } from '@/components/tasks/TaskCard'
import { useAuth } from '@/context/AuthContext'

// ─── Type config ───────────────────────────────────────────────────────────────

const TYPE_CONFIG = {
  post_status_changed:    { icon: FileText,       color: 'text-blue-500',   bg: 'bg-blue-100 dark:bg-blue-950' },
  task_assigned:          { icon: ClipboardList,   color: 'text-violet-500', bg: 'bg-violet-100 dark:bg-violet-950' },
  task_updated:           { icon: ClipboardList,   color: 'text-violet-500', bg: 'bg-violet-100 dark:bg-violet-950' },
  task_reassigned:        { icon: ArrowRightLeft,  color: 'text-fuchsia-500', bg: 'bg-fuchsia-100 dark:bg-fuchsia-950' },
  task_autocompleted:     { icon: CheckCircle2,    color: 'text-emerald-500', bg: 'bg-emerald-100 dark:bg-emerald-950' },
  campaign_review_shared: { icon: Share2,          color: 'text-amber-500',  bg: 'bg-amber-100 dark:bg-amber-950' },
  campaign_reviewed:      { icon: CheckCircle2,    color: 'text-green-500',  bg: 'bg-green-100 dark:bg-green-950' },
  team_member_joined:     { icon: UserPlus,        color: 'text-teal-500',   bg: 'bg-teal-100 dark:bg-teal-950' },
  invoice_overdue:        { icon: AlertCircle,     color: 'text-destructive', bg: 'bg-red-100 dark:bg-red-950' },
  comment_added:          { icon: MessageCircle,   color: 'text-sky-500',    bg: 'bg-sky-100 dark:bg-sky-950' },
  chat_important:         { icon: TriangleAlert,   color: 'text-red-500',    bg: 'bg-red-100 dark:bg-red-950' },
  chat_everyone:          { icon: Users,           color: 'text-indigo-500', bg: 'bg-indigo-100 dark:bg-indigo-950' },
  chat_mention:           { icon: AtSign,          color: 'text-indigo-500', bg: 'bg-indigo-100 dark:bg-indigo-950' },
  // No longer emitted — tg_notify_chat_message stopped notifying on every DM
  // message. Kept so the rows written before that change still render as chat
  // rather than falling through to the generic bell fallback.
  chat_dm:                { icon: MessageCircle,   color: 'text-sky-500',    bg: 'bg-sky-100 dark:bg-sky-950' },
}

// Label to show when a notification has no human actor (actor_user_id is null).
const SYSTEM_ACTOR_LABEL = {
  invoice_overdue:    'System',
  campaign_reviewed:  'A client',
  // Nobody moved the task — its deliverables shipping did.
  task_autocompleted: 'System',
}

// The task-status triggers build their title as
// `'Task status updated to ' || new.status`, so the raw enum (IN_PROGRESS)
// lands in the text with no structural field beside it to read instead.
// Rather than migrate every trigger and the emit_notifications signature to
// carry the status separately, the known prefix is matched here and the enum
// rendered as the same pill the task page uses. Anything that doesn't match a
// real STATUS_CONFIG key falls through to the title verbatim, so an unknown
// or reworded title degrades to what it does today rather than breaking.
const STATUS_TITLE_RE = /^(Task status updated to )([A-Z_]+)$/

function NotificationTitle({ title }) {
  const match = title?.match(STATUS_TITLE_RE)
  if (!match || !STATUS_CONFIG[match[2]]) return title
  return (
    <>
      {match[1]}
      <StatusChip status={match[2]} />
    </>
  )
}

function getInitials(name) {
  if (!name) return '?'
  const [first = '', second = ''] = name.trim().split(/\s+/)
  return ((first[0] ?? '') + (second[0] ?? '')).toUpperCase() || '?'
}

// Route resolution is shared with NotificationToaster — see ./routes.js
const resolveRoute = resolveNotificationRoute

// ─── Single row ────────────────────────────────────────────────────────────────

function NotificationRow({ notification, memberMap, onRead, onDeleted }) {
  const navigate = useNavigate()
  const config = TYPE_CONFIG[notification.type] ?? { icon: Bell, color: 'text-muted-foreground', bg: 'bg-muted' }
  const Icon = config.icon
  const isUnread = !notification.read_at
  const route = resolveRoute(notification)

  // Resolve the acting account. Null actor = system/external event (no person).
  const actor = notification.actor_user_id ? memberMap[notification.actor_user_id] : null
  const actorName =
    actor?.full_name || actor?.email || SYSTEM_ACTOR_LABEL[notification.type] || null

  const handleClick = async () => {
    if (isUnread) {
      await markNotificationRead(notification.id)
      onRead()
    }
    if (route) navigate(route)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleClick()
    }
  }

  // Nested inside the row's own click target below, so this must stop
  // propagation — otherwise deleting would also fire the row's mark-read/navigate.
  async function handleDelete(e) {
    e.stopPropagation()
    try {
      await deleteNotification(notification.id)
      onDeleted()
    } catch (err) {
      toast.error(err.message || 'Failed to delete notification')
    }
  }

  return (
    // A real <button> can't contain the delete button below (nested
    // interactive elements are invalid HTML) — role="button" + onKeyDown
    // keeps this keyboard-accessible without that constraint.
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      aria-label={`${actorName ? `${actorName}: ` : ''}${notification.title}${isUnread ? ' (unread)' : ''}`}
      className={cn(
        'group relative w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
        isUnread && 'bg-muted/40',
      )}
    >
      {/* Actor avatar with type-icon corner badge; falls back to the type icon
          alone for system/external events that have no human actor. */}
      <span aria-hidden="true" className="relative mt-0.5 shrink-0">
        {actor ? (
          actor.avatar_url ? (
            <img src={actor.avatar_url} alt="" className="size-8 rounded-full object-cover" />
          ) : (
            <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
              {getInitials(actorName)}
            </span>
          )
        ) : (
          <span className={cn('flex size-8 items-center justify-center rounded-lg', config.bg)}>
            <Icon className={cn('size-4', config.color)} />
          </span>
        )}
        {actor && (
          <span className={cn('absolute -bottom-1 -right-1 flex size-4 items-center justify-center rounded-full ring-2 ring-background', config.bg)}>
            <Icon className={cn('size-2.5', config.color)} />
          </span>
        )}
      </span>

      {/* Content — the delete button is absolutely positioned at the bottom
          corner, so it floats over trailing content instead of needing
          reserved layout space (which pushed the unread dot inward). */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className={cn('text-sm leading-snug', isUnread ? 'font-medium' : 'text-muted-foreground')}>
            <NotificationTitle title={notification.title} />
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
          {actorName && <span className="font-medium text-muted-foreground">{actorName}</span>}
          {actorName && ' · '}
          {formatCompactTimeAgo(notification.created_at)}
        </p>
      </div>

      <button
        onClick={handleDelete}
        className="absolute bottom-2 right-2 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-background hover:text-destructive group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        title="Delete notification"
        aria-label="Delete notification"
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  )
}

// ─── Panel content ─────────────────────────────────────────────────────────────

function NotificationPanel() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { data: notifications = [], isLoading } = useNotifications()
  const { data: unreadCount = 0 } = useUnreadNotificationCount()
  const { data: teamMembers = [] } = useTeamMembers()

  // actor_user_id → member record (full_name, avatar_url, email) for avatar/name display.
  const memberMap = useMemo(
    () => Object.fromEntries(teamMembers.map((m) => [m.member_user_id, m])),
    [teamMembers],
  )

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
                memberMap={memberMap}
                onRead={invalidate}
                onDeleted={invalidate}
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
