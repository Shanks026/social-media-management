import { Link } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { Lock, PencilRuler, Play } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useGlobalPosts } from '@/api/useGlobalPosts'
import { useTasks, useTaskExists } from '@/api/tasks'
import { useClients } from '@/api/clients'
import { useMemberMap } from '@/api/chat'
import { PlatformStack } from '@/components/PlatformIcon'
import StatusBadge from '@/components/StatusBadge'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ClientAvatar } from '@/components/tasks/ClientAvatar'
import { MemberAvatar } from '@/components/chat/MemberAvatar'
import { STATUS_CONFIG, PRIORITY_CONFIG, STATUS_DOT } from '@/components/tasks/TaskCard'

// Compact, read-only attachment cards — deliberately not the real
// DeliverableCard/TaskCard (those carry list-page chrome: edit/delete menus,
// media carousels) which don't belong in a passive chat attachment. Reuses
// existing list queries (already cached by the picker/elsewhere in the app)
// rather than adding new single-entity fetch hooks — chat threads are small,
// so filtering an already-loaded list client-side is simplest.

// reason='access' (task exists but tasks_select's creator/assigned_to/admin
// RLS scope hides it from this viewer) vs the default 'deleted' (genuinely
// gone) — see ChatTaskCard's useTaskExists check, which is what tells them
// apart without ever exposing the task's content to a viewer who can't see it.
function UnavailableCard({ label, reason = 'deleted' }) {
  return (
    <div className="mt-1.5 flex w-fit items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
      {reason === 'access' ? (
        <Lock className="size-3.5 shrink-0" />
      ) : (
        <PencilRuler className="size-3.5 shrink-0" />
      )}
      {reason === 'access' ? `You don't have access to this ${label}.` : `This ${label} is no longer available.`}
    </div>
  )
}

function CardSkeleton() {
  return <div className="mt-1.5 h-16 w-64 animate-pulse rounded-lg bg-muted/50" />
}

export function ChatDeliverableCard({ reference }) {
  const { data: posts = [], isLoading } = useGlobalPosts()
  const { data: clientsData } = useClients()

  if (isLoading) return <CardSkeleton />

  const post = posts.find((p) => p.version_id === reference.id)
  if (!post) return <UnavailableCard label="deliverable" />

  const client = post.client_id
    ? [clientsData?.internalAccount, ...(clientsData?.realClients ?? [])].find((c) => c?.id === post.client_id)
    : null
  const isVideo = post.media_urls?.[0]?.match(/\.(mp4|mov|webm)$/i)

  return (
    <Link
      to={`/clients/${post.client_id}/posts/${post.version_id}`}
      className="mt-1.5 flex w-96 max-w-full items-center gap-3 rounded-lg border border-border/70 px-3 py-2.5 transition-colors hover:bg-muted/40"
    >
      {post.media_urls?.[0] ? (
        <div className="relative size-11 shrink-0 overflow-hidden rounded-lg border border-border/50 bg-muted">
          {isVideo ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black/90">
              <Play className="size-3.5 fill-current text-white" />
            </div>
          ) : (
            <img src={post.media_urls[0]} alt="" className="h-full w-full object-cover" />
          )}
        </div>
      ) : (
        <div className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-border/50 bg-muted">
          <PencilRuler className="size-4 text-muted-foreground/40" />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium leading-tight text-foreground">
          {post.title || 'Untitled Draft'}
        </p>
        {(client || post.target_date) && (
          <span className="mt-1 flex items-center gap-1.5">
            {client && <ClientAvatar client={client} size="sm" />}
            {client && <span className="truncate text-xs text-muted-foreground">{client.name}</span>}
            {client && post.target_date && <span className="text-xs text-muted-foreground">·</span>}
            {post.target_date && (
              <span className="shrink-0 text-xs text-muted-foreground">
                {format(parseISO(post.target_date), 'MMM d, yyyy')}
              </span>
            )}
          </span>
        )}
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <StatusBadge status={post.status} className="px-2 py-0.5 text-[10px]" />
        {post.platforms?.length > 0 && <PlatformStack platforms={post.platforms} size={14} max={3} />}
      </div>
    </Link>
  )
}

// Links to /tasks?task=<id> — TasksAndReminders.jsx auto-opens TaskDetailSheet
// for the matching task on load, independent of whichever view (grid/table/
// kanban) or filters happen to be active.
export function ChatTaskCard({ reference }) {
  const { data: tasks = [], isLoading } = useTasks()
  const { data: clientsData } = useClients()
  const memberMap = useMemberMap()

  const task = tasks.find((t) => t.id === reference.id)

  // Only queried once we know the task isn't in this viewer's own RLS-visible
  // list — distinguishes "genuinely deleted" from "exists, but tasks_select's
  // creator/assigned_to/admin scope hides it from you" (tasks are private,
  // unlike deliverables) without ever fetching the task's actual content.
  const { data: existsElsewhere, isLoading: isCheckingExists } = useTaskExists(reference.id, {
    enabled: !isLoading && !task,
  })

  if (isLoading || (!task && isCheckingExists)) return <CardSkeleton />
  if (!task) return <UnavailableCard label="task" reason={existsElsewhere ? 'access' : 'deleted'} />

  const statusCfg = STATUS_CONFIG[task.status] ?? STATUS_CONFIG.TODO
  const overdue =
    task.due_at &&
    new Date(task.due_at).getTime() < new Date().getTime() &&
    !['COMPLETED', 'ARCHIVED'].includes(task.status)
  const client = task.client_id
    ? [clientsData?.internalAccount, ...(clientsData?.realClients ?? [])].find((c) => c?.id === task.client_id)
    : null
  const assignee = task.assigned_to ? memberMap[task.assigned_to] : null

  return (
    <Link
      to={`/tasks?task=${task.id}`}
      className="mt-1.5 flex w-96 max-w-full flex-col gap-1.5 rounded-lg border border-border/70 px-3 py-2.5 transition-colors hover:bg-muted/40"
    >
      <div className="flex items-center gap-2">
        <Badge variant="outline" className={cn('gap-1.5 select-none', statusCfg.className)}>
          <span className={cn('size-2 rounded-full shrink-0', STATUS_DOT[task.status] ?? 'bg-zinc-400')} />
          {statusCfg.label}
        </Badge>
        {PRIORITY_CONFIG[task.priority] && (
          <Badge variant="outline" className="gap-1.5">
            <span className={cn('size-2 rounded-full shrink-0', PRIORITY_CONFIG[task.priority].dot)} />
            {PRIORITY_CONFIG[task.priority].label}
          </Badge>
        )}
      </div>
      <p
        className={cn(
          'text-sm font-medium leading-snug text-foreground',
          task.status === 'COMPLETED' && 'line-through text-muted-foreground',
        )}
      >
        {task.title}
      </p>
      {(client || assignee || task.due_at) && (
        <span className="flex items-center gap-1.5">
          {client && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <ClientAvatar client={client} size="sm" />
                </span>
              </TooltipTrigger>
              <TooltipContent>{client.is_internal ? 'Internal' : client.name}</TooltipContent>
            </Tooltip>
          )}
          {assignee && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <MemberAvatar member={assignee} className="size-5" />
                </span>
              </TooltipTrigger>
              <TooltipContent>{assignee.full_name || assignee.email}</TooltipContent>
            </Tooltip>
          )}
          {(client || assignee) && task.due_at && <span className="text-xs text-muted-foreground">·</span>}
          {task.due_at && (
            <span className={cn('text-xs', overdue ? 'font-medium text-destructive' : 'text-muted-foreground')}>
              {overdue ? 'Overdue ' : 'Due '}
              {format(parseISO(task.due_at), 'd MMM')}
            </span>
          )}
        </span>
      )}
    </Link>
  )
}

export function ChatEntityCard({ reference }) {
  if (reference.type === 'post') return <ChatDeliverableCard reference={reference} />
  if (reference.type === 'task') return <ChatTaskCard reference={reference} />
  return null
}
