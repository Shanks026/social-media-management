import { format } from 'date-fns'
import { UserRoundCog, UserRoundPlus, CircleDot, Bot } from 'lucide-react'
import { STATUS_DOT, StatusChip } from '@/components/tasks/TaskCard'
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyMedia } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

// A person's name rendered with their avatar right beside it, wherever a
// name appears in a sentence — not just the leading actor. `member` is a
// memberMap entry (already resolves to the current user's own profile for
// "You", so self shows a real photo too, not a bare word). A null member
// (the system actor, e.g. Phase 4's auto-completion) falls back to a small
// bot glyph instead of initials.
function NameTag({ member, children }) {
  return (
    <span className="inline-flex items-center gap-1 align-middle">
      {member?.avatar_url ? (
        <img src={member.avatar_url} alt="" className="size-4 shrink-0 rounded-full object-cover" />
      ) : member ? (
        <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[8px] font-semibold text-primary">
          {(member.full_name || member.email || '?')[0].toUpperCase()}
        </span>
      ) : (
        <span className="flex size-4 shrink-0 items-center justify-center rounded-full border border-border bg-background text-muted-foreground">
          <Bot className="size-2.5" />
        </span>
      )}
      <b className="font-medium text-foreground">{children}</b>
    </span>
  )
}

/**
 * One task_activity row rendered as a sentence. Two event types only —
 * assignment and status change — matching the table's check constraint, so
 * there's no generic fallback branch to maintain.
 */
function ActivityRow({ row, memberMap, currentUserId, isLast }) {
  const name = (id, fallback) => {
    if (!id) return fallback
    const m = memberMap[id]
    const label = m?.full_name || m?.email || 'Team member'
    return id === currentUserId ? `${label} (You)` : label
  }

  // A null actor is the system, not a person — Phase 4's auto-completion
  // writes rows that way.
  const actorMember = row.actor_user_id ? memberMap[row.actor_user_id] : null
  const actor = row.actor_user_id ? name(row.actor_user_id) : 'Tercero'
  const fromMember = row.from_user_id ? memberMap[row.from_user_id] : null
  const toMember = row.to_user_id ? memberMap[row.to_user_id] : null
  const isAssignment = row.type === 'assigned'
  const isParticipant = row.type === 'participant_added'

  let sentence
  if (isParticipant) {
    // Access grants are logged so they are auditable — a task quietly becoming
    // visible to more people should be visible in the task's own history.
    sentence = (
      <>
        <NameTag member={actorMember}>{actor}</NameTag> added{' '}
        <NameTag member={toMember}>{name(row.to_user_id)}</NameTag> as a participant
      </>
    )
  } else if (isAssignment) {
    if (!row.to_user_id)
      sentence = (
        <>
          <NameTag member={actorMember}>{actor}</NameTag> unassigned this task
        </>
      )
    else if (row.from_user_id)
      sentence = (
        <>
          <NameTag member={actorMember}>{actor}</NameTag> reassigned this from{' '}
          <NameTag member={fromMember}>{name(row.from_user_id)}</NameTag> to{' '}
          <NameTag member={toMember}>{name(row.to_user_id)}</NameTag>
        </>
      )
    else
      sentence = (
        <>
          <NameTag member={actorMember}>{actor}</NameTag> assigned this to{' '}
          <NameTag member={toMember}>{name(row.to_user_id)}</NameTag>
        </>
      )
  } else {
    sentence = row.from_status ? (
      <>
        <NameTag member={actorMember}>{actor}</NameTag> moved this from{' '}
        <StatusChip status={row.from_status} /> to <StatusChip status={row.to_status} />
      </>
    ) : (
      <>
        <NameTag member={actorMember}>{actor}</NameTag> created this as{' '}
        <StatusChip status={row.to_status} />
      </>
    )
  }

  return (
    <li className="relative flex gap-3 pb-5 last:pb-0">
      {!isLast && <span className="absolute left-3 top-7 bottom-0 w-px bg-border" aria-hidden />}
      {/* The event-type icon — assignment vs status change — not the actor's
          identity. Who did it is now shown inline with their name in the
          sentence itself, via NameTag. */}
      <span className="relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full border border-border bg-background">
        {isParticipant ? (
          <UserRoundPlus className="size-3 text-muted-foreground" />
        ) : isAssignment ? (
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
