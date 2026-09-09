import { format } from 'date-fns'
import { UserRoundCog, CircleDot } from 'lucide-react'
import { STATUS_CONFIG, STATUS_DOT } from '@/components/tasks/TaskCard'
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyMedia } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

const statusLabel = (key) => STATUS_CONFIG[key]?.label ?? key ?? 'Unknown'

/**
 * One task_activity row rendered as a sentence. Two event types only —
 * assignment and status change — matching the table's check constraint, so
 * there's no generic fallback branch to maintain.
 */
function ActivityRow({ row, memberMap, currentUserId, isLast }) {
  const name = (id, fallback) => {
    if (!id) return fallback
    if (id === currentUserId) return 'You'
    const m = memberMap[id]
    return m?.full_name || m?.email || 'Team member'
  }

  // A null actor is the system, not a person — Phase 4's auto-completion
  // writes rows that way.
  const actor = row.actor_user_id ? name(row.actor_user_id) : 'Tercero'
  const isAssignment = row.type === 'assigned'

  let sentence
  if (isAssignment) {
    if (!row.to_user_id) sentence = <><b className="font-medium text-foreground">{actor}</b> unassigned this task</>
    else if (row.from_user_id)
      sentence = (
        <>
          <b className="font-medium text-foreground">{actor}</b> reassigned this from{' '}
          <b className="font-medium text-foreground">{name(row.from_user_id)}</b> to{' '}
          <b className="font-medium text-foreground">{name(row.to_user_id)}</b>
        </>
      )
    else
      sentence = (
        <>
          <b className="font-medium text-foreground">{actor}</b> assigned this to{' '}
          <b className="font-medium text-foreground">{name(row.to_user_id)}</b>
        </>
      )
  } else {
    sentence = row.from_status ? (
      <>
        <b className="font-medium text-foreground">{actor}</b> moved this from{' '}
        {statusLabel(row.from_status)} to{' '}
        <b className="font-medium text-foreground">{statusLabel(row.to_status)}</b>
      </>
    ) : (
      <>
        <b className="font-medium text-foreground">{actor}</b> created this as{' '}
        <b className="font-medium text-foreground">{statusLabel(row.to_status)}</b>
      </>
    )
  }

  return (
    <li className="relative flex gap-3 pb-5 last:pb-0">
      {!isLast && <span className="absolute left-3 top-7 bottom-0 w-px bg-border" aria-hidden />}
      <span
        className={cn(
          'relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full border border-border bg-background',
        )}
      >
        {isAssignment ? (
          <UserRoundCog className="size-3 text-muted-foreground" />
        ) : (
          <CircleDot className={cn('size-3', STATUS_DOT[row.to_status] ? 'text-foreground' : 'text-muted-foreground')} />
        )}
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="text-sm leading-snug text-muted-foreground">{sentence}</p>
        <p className="mt-0.5 text-xs text-muted-foreground/70">
          {format(new Date(row.created_at), 'd MMM yyyy, h:mm a')}
        </p>
      </div>
    </li>
  )
}

/**
 * The task's full history, newest first. Every pre-existing task was
 * backfilled in Phase 1, so an empty feed here means the rows were genuinely
 * never written, not that the task predates the table.
 */
export default function TaskActivityFeed({ activity = [], isLoading, memberMap = {}, currentUserId }) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="size-6 shrink-0 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (activity.length === 0) {
    return (
      <Empty>
        <EmptyMedia>
          <span className="text-5xl">🕓</span>
        </EmptyMedia>
        <EmptyHeader>
          <EmptyTitle className="font-bold text-xl">No activity yet</EmptyTitle>
          <EmptyDescription>
            Assignments and status changes will show up here as this task moves.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <ul className="pt-1">
      {activity.map((row, i) => (
        <ActivityRow
          key={row.id}
          row={row}
          memberMap={memberMap}
          currentUserId={currentUserId}
          isLast={i === activity.length - 1}
        />
      ))}
    </ul>
  )
}
