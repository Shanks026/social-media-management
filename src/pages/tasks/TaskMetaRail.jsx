import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import { Megaphone } from 'lucide-react'
import { STATUS_CONFIG, STATUS_DOT } from '@/components/tasks/TaskCard'
import { ClientAvatar } from '@/components/tasks/ClientAvatar'
import TaskWatchers from '@/components/tasks/TaskWatchers'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

// Mirrors TaskCard.jsx's sheet picker exactly, so the same task offers the
// same moves whether it's opened as a sheet or as a page.
const STATUS_OPTIONS = ['TODO', 'IN_PROGRESS', 'COMPLETED', 'ARCHIVED']

// Sentinel for "no assignee" in the reassign picker, matching TaskCard.jsx.
const UNASSIGNED = '__unassigned__'

/**
 * One stacked label/value row. Deliberately the same grid and type scale as
 * `MetaItem` in PostContent.jsx so the two detail pages read as one family.
 */
function MetaItem({ label, children }) {
  return (
    <div className="grid grid-cols-[96px_1fr] items-start gap-x-3">
      <dt className="pt-px text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-sm text-foreground">{children}</dd>
    </div>
  )
}

function MemberChip({ member, isSelf }) {
  if (!member) return <span className="text-muted-foreground">Unassigned</span>
  return (
    <span className={cn('inline-flex items-center gap-1.5', member._removed && 'opacity-60')}>
      {!isSelf &&
        (member.avatar_url ? (
          <img
            src={member.avatar_url}
            alt=""
            className={cn('size-4 shrink-0 rounded-full object-cover', member._removed && 'grayscale')}
          />
        ) : (
          <span
            className={cn(
              'flex size-4 shrink-0 items-center justify-center rounded-full text-[8px] font-semibold',
              member._removed ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary',
            )}
          >
            {(member.full_name || member.email || '?')[0].toUpperCase()}
          </span>
        ))}
      <span className="truncate font-medium">
        {isSelf ? 'You' : member.full_name || member.email}
        {member._removed && <span className="font-normal text-muted-foreground"> (Removed)</span>}
      </span>
    </span>
  )
}

/**
 * The task's key facts as label/value rows, mirroring the deliverable page's
 * right rail. Two rows are editable in place — Status and Assigned To —
 * because those are the two things a person opens a task to change; the rest
 * is read-only and lives behind Edit.
 */
export default function TaskMetaRail({
  task,
  client,
  campaign,
  memberMap,
  currentUserId,
  watcherIds,
  canToggle,
  canReassign,
  onStatusChange,
  onReassign,
  isBusy,
}) {
  const assignee = task.assigned_to ? memberMap[task.assigned_to] : null
  const creator = memberMap[task.created_by]

  // Who actually assigned the current holder — the latest 'assigned' activity
  // row's actor, not the creator. Resolved by the page and passed down.
  const assigner = task.assigner_id ? memberMap[task.assigner_id] : null

  const assigneeOptions = Object.values(memberMap).filter(
    (m) => !m._removed && m.system_role !== 'owner' && m.system_role !== 'superadmin',
  )

  const overdue =
    task.due_at &&
    new Date(task.due_at).getTime() < new Date().getTime() &&
    !['COMPLETED', 'ARCHIVED'].includes(task.status)

  return (
    <aside className="w-full min-w-0 lg:sticky lg:top-20 lg:w-1/3">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-xs font-medium text-muted-foreground">Task Details</h2>
        <TaskWatchers watcherIds={watcherIds} memberMap={memberMap} />
      </div>

      <dl className="space-y-3.5">
        <MetaItem label="Status">
          <Select
            value={task.status}
            onValueChange={(next) => next !== task.status && onStatusChange(next)}
            disabled={!canToggle || isBusy}
          >
            <SelectTrigger size="sm" className="w-[170px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((key) => (
                <SelectItem key={key} value={key}>
                  <span className="flex items-center gap-2">
                    <span className={cn('size-2 shrink-0 rounded-full', STATUS_DOT[key])} />
                    {STATUS_CONFIG[key].label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </MetaItem>

        <MetaItem label="Assigned to">
          {canReassign ? (
            <Select
              value={task.assigned_to ?? UNASSIGNED}
              onValueChange={(next) => onReassign(next === UNASSIGNED ? null : next)}
              disabled={isBusy}
            >
              <SelectTrigger className="h-7 w-auto max-w-full border-0 bg-transparent px-2 text-sm shadow-none hover:bg-muted/60 focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNASSIGNED}>
                  <span className="text-muted-foreground">Unassigned</span>
                </SelectItem>
                {assigneeOptions.map((m) => (
                  <SelectItem key={m.member_user_id} value={m.member_user_id}>
                    <span className="flex items-center gap-2">
                      {m.avatar_url ? (
                        <img src={m.avatar_url} alt="" className="size-5 shrink-0 rounded-full object-cover" />
                      ) : (
                        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[9px] font-semibold text-primary">
                          {(m.full_name || m.email || '?')[0].toUpperCase()}
                        </span>
                      )}
                      <span className="truncate">
                        {m.full_name || m.email}
                        {m.member_user_id === currentUserId && <span className="ml-1 text-muted-foreground">(You)</span>}
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <MemberChip member={assignee} isSelf={task.assigned_to === currentUserId} />
          )}
        </MetaItem>

        {assignee && assigner && (
          <MetaItem label="Assigned by">
            <MemberChip member={assigner} isSelf={task.assigner_id === currentUserId} />
          </MetaItem>
        )}

        <MetaItem label="Created by">
          <MemberChip member={creator} isSelf={task.created_by === currentUserId} />
        </MetaItem>

        <MetaItem label="Client">
          {client ? (
            <span className="inline-flex items-center gap-1.5">
              <ClientAvatar client={client} size="sm" />
              <span className="truncate font-medium">{client.name}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">General (no client)</span>
          )}
        </MetaItem>

        {campaign && (
          <MetaItem label="Campaign">
            <Link to={`/campaigns/${campaign.id}`} className="inline-flex items-center gap-1.5 font-medium hover:underline">
              <Megaphone className="size-3.5 shrink-0 text-muted-foreground" />
              {campaign.name}
            </Link>
          </MetaItem>
        )}

        {task.due_at && (
          <MetaItem label="Due">
            <span className={cn(overdue && 'font-medium text-destructive')}>
              {format(new Date(task.due_at), 'd MMM yyyy')}
              {overdue && ' · Overdue'}
            </span>
          </MetaItem>
        )}

        <MetaItem label="Created on">{format(new Date(task.created_at), 'd MMM yyyy')}</MetaItem>

        {task.completed_at && (
          <MetaItem label="Completed">{format(new Date(task.completed_at), 'd MMM yyyy')}</MetaItem>
        )}
      </dl>
    </aside>
  )
}
