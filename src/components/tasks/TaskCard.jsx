import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import {
  Building2,
  Circle,
  CircleDashed,
  CheckCircle2,
  Archive,
  Pencil,
  Trash2,
  MoreVertical,
  Megaphone,
  Image as ImageIcon,
  Play,
  PencilRuler,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { updateTaskStatus, deleteTask, fetchTaskDeliverables } from '@/api/tasks'
import { usePermissions } from '@/api/usePermissions'
import { getUrgencyStatus } from '@/lib/client-helpers'
import StatusBadge from '@/components/StatusBadge'

// Matches the icon treatment used in the campaign's Deliverables table
// (CampaignDetailPage) — a distinct, PNG-based icon set from the shared
// SVG PlatformIcon in @/components/PlatformIcon, kept local for visual parity.
const PlatformIcon = ({ name }) => {
  const fileName = name === 'google_business' ? 'google_busines' : name
  const imgSrc = `/platformIcons/${fileName}.png`

  return (
    <div className="flex size-5 items-center justify-center rounded-full border border-white dark:border-[#1c1c1f] bg-white dark:bg-zinc-900 shadow-sm overflow-hidden shrink-0">
      <img
        src={imgSrc}
        alt={name}
        className="size-4 object-contain"
        onError={(e) => (e.target.style.display = 'none')}
      />
    </div>
  )
}
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { ClientAvatar } from '@/components/tasks/ClientAvatar'
import EditTaskDialog from '@/components/tasks/EditTaskDialog'

// ─── Shared constants ─────────────────────────────────────────────────────────

export const STATUS_CONFIG = {
  TODO: {
    label: 'To Do',
    className:
      'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-none',
  },
  IN_PROGRESS: {
    label: 'In Progress',
    className:
      'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-none',
  },
  COMPLETED: {
    label: 'Completed',
    className:
      'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-none',
  },
  ARCHIVED: {
    label: 'Archived',
    className: 'bg-muted text-muted-foreground border-none',
  },
}

export const PRIORITY_CONFIG = {
  URGENT: { label: 'Urgent', dot: 'bg-red-500' },
  HIGH:   { label: 'High',   dot: 'bg-amber-500' },
  NORMAL: { label: 'Normal', dot: 'bg-zinc-400' },
  LOW:    { label: 'Low',    dot: 'bg-emerald-400' },
}

export const STATUS_DOT = {
  TODO:        'bg-blue-500',
  IN_PROGRESS: 'bg-amber-500',
  COMPLETED:   'bg-emerald-500',
  ARCHIVED:    'bg-zinc-400',
}

/**
 * A status rendered inline inside a sentence — the activity feed's "moved this
 * from X to Y", and the notification bell's "Task status updated to X". Lives
 * here rather than at either call site because both need the same pill and it
 * reads straight off the two maps above.
 */
export function StatusChip({ status }) {
  const cfg = STATUS_CONFIG[status]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 align-middle text-xs font-medium',
        cfg?.className ?? 'bg-muted text-muted-foreground',
      )}
    >
      <span className={cn('size-1.5 shrink-0 rounded-full', STATUS_DOT[status] ?? 'bg-zinc-400')} />
      {cfg?.label ?? status ?? 'Unknown'}
    </span>
  )
}

// ─── Deliverable Preview Row ───────────────────────────────────────────────────

// A single linked-deliverable preview row, used on the task detail page's
// Deliverables tab. `client` is passed only for general (clientless) tasks,
// where linked deliverables can span clients and need labelling.
export function DeliverablePreviewRow({ post, client }) {
  const isCompleted = ['PUBLISHED', 'ARCHIVED'].includes(post.status)
  const health = !isCompleted ? getUrgencyStatus(post.target_date) : null
  return (
    <Link
      to={`/clients/${post.client_id}/deliverables/${post.id}`}
      className="group flex items-center gap-4 flex-1 min-w-0 rounded-lg border border-border/50 hover:bg-muted/40 transition-colors px-3 py-2.5"
    >
      {post.media_urls?.[0] ? (
        <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 border border-border/50 bg-muted relative">
          {post.media_urls[0].match(/\.(mp4|mov|webm)$/i) ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black/90">
              <Play className="size-4 text-white fill-current" />
            </div>
          ) : (
            <img src={post.media_urls[0]} alt="" className="w-full h-full object-cover" />
          )}
        </div>
      ) : (
        <div className="w-12 h-12 rounded-lg shrink-0 border border-border/50 bg-muted flex items-center justify-center">
          <PencilRuler className="size-5 text-muted-foreground/40" />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate text-foreground leading-tight">
          {post.title || 'Untitled'}
        </p>
        {client && (
          <span className="flex items-center gap-1.5 mt-1">
            <ClientAvatar client={client} size="sm" />
            <span className="text-xs text-muted-foreground truncate">{client.name}</span>
          </span>
        )}
        {post.target_date && (
          <div className="flex items-center gap-1.5 mt-1.5">
            {health?.color && (
              <div className="relative flex h-2 w-2 items-center justify-center shrink-0">
                {health.pulse && (
                  <span className={cn('absolute inline-flex h-full w-full animate-ping rounded-full opacity-75', health.color)} />
                )}
                <span className={cn('relative inline-flex h-2 w-2 rounded-full', health.color)} />
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              {post.status === 'PUBLISHED' ? 'Published' : 'Target'}
              {' · '}
              {format(parseISO(post.target_date), 'MMM d, yyyy')}
            </p>
          </div>
        )}
      </div>

      <div className="shrink-0 flex flex-col items-end gap-2">
        <StatusBadge status={post.status} />
        {post.platforms?.length > 0 && (
          <div className="flex items-center -space-x-1">
            {post.platforms.map((p) => (
              <PlatformIcon key={p} name={p} />
            ))}
          </div>
        )}
      </div>
    </Link>
  )
}

// ─── Task Card ────────────────────────────────────────────────────────────────

export default function TaskCard({ task, clientMap, campaignMap = {}, memberMap = {}, currentUserId = null }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const { isAdmin, canAssignTasks } = usePermissions()

  const isCreator  = task.created_by === currentUserId
  const isAssignee = task.assigned_to === currentUserId
  // isAdmin already means owner OR admin OR superadmin — matches the DB's
  // is_workspace_admin(), which update_task_status/reassign_task actually
  // check. This was isOwner alone, so an admin who reassigned a task away
  // from themselves lost canEdit/canToggle here even though the RPCs would
  // still have allowed them. Same fix in TaskDetailPage.jsx.
  const canEdit    = isAdmin || isCreator
  const canToggle  = isAdmin || isCreator || isAssignee

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['tasks', 'list'], exact: false })

  const { mutate: setStatus, isPending: isSettingStatus } = useMutation({
    mutationFn: (newStatus) => updateTaskStatus(task.id, newStatus),
    onSuccess: invalidate,
    onError: (err) => toast.error('Failed to update task: ' + err.message),
  })

  const { mutate: remove, isPending: isDeleting } = useMutation({
    mutationFn: () => deleteTask(task.id),
    onSuccess: () => {
      invalidate()
      toast.success('Task deleted')
    },
    onError: (err) => toast.error('Failed to delete task: ' + err.message),
  })

  const { data: linkedPosts = [] } = useQuery({
    queryKey: ['task-deliverables', task.id],
    queryFn: () => fetchTaskDeliverables(task.id),
    enabled: !!task.id,
  })

  const isBusy = isSettingStatus || isDeleting
  const overdue =
    task.due_at &&
    new Date(task.due_at).getTime() < new Date().getTime() &&
    (task.status === 'TODO' || task.status === 'IN_PROGRESS')
  const client = clientMap[String(task.client_id)]
  const campaign = task.campaign_id ? campaignMap[String(task.campaign_id)] : null
  const statusCfg = STATUS_CONFIG[task.status] ?? STATUS_CONFIG.TODO
  const assignee = task.assigned_to ? memberMap[task.assigned_to] : null
  const creatorMember = memberMap[task.created_by]
  const displayDate =
    task.status === 'COMPLETED' && task.completed_at ? task.completed_at : task.due_at

  const handleStatusClick = () => {
    if (task.status === 'TODO') setStatus('IN_PROGRESS')
    else if (task.status === 'IN_PROGRESS') setStatus('COMPLETED')
    else if (task.status === 'COMPLETED') setStatus('TODO')
  }

  return (
    <>
      <div
        onClick={() => navigate(`/tasks/${task.id}`)}
        className={cn(
          'flex flex-col bg-card rounded-xl shadow-sm ring-1 ring-border/50 overflow-hidden transition-all hover:shadow-md cursor-pointer',
          task.status === 'ARCHIVED' && 'opacity-60',
        )}
      >
        {/* ── Top row: status badge, priority badge, menu ── */}
        <div className="flex items-center gap-2 px-5 pt-5 pb-1">
          <Badge
            variant="outline"
            onClick={(e) => {
              e.stopPropagation()
              if (canToggle && task.status !== 'ARCHIVED' && !isBusy) handleStatusClick()
            }}
            className={cn(
              'gap-1.5 select-none',
              statusCfg.className,
              canToggle && task.status !== 'ARCHIVED' && !isBusy
                ? 'cursor-pointer hover:opacity-75 active:scale-95'
                : 'cursor-default',
            )}
          >
            <span className={cn('size-2 rounded-full shrink-0', STATUS_DOT[task.status] ?? 'bg-zinc-400')} />
            {statusCfg.label}
          </Badge>

          {PRIORITY_CONFIG[task.priority] && (
            <Badge variant="outline" className="gap-1.5">
              <span className={cn('size-2 rounded-full shrink-0', PRIORITY_CONFIG[task.priority].dot)} />
              {PRIORITY_CONFIG[task.priority].label}
            </Badge>
          )}

          {(campaign || linkedPosts.length > 0 || canToggle || canEdit) && (
            <div className="ml-auto flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              {campaign && (
                <Badge variant="secondary" className="size-6 p-0 shrink-0" title={campaign.name}>
                  <Megaphone className="size-3" />
                </Badge>
              )}

              {linkedPosts.length > 0 && (
                <Badge
                  variant="secondary"
                  className={cn('h-6 shrink-0 gap-1', linkedPosts.length > 1 ? 'px-1.5' : 'size-6 p-0')}
                  title={linkedPosts.map((p) => p.title || 'Untitled').join(', ')}
                >
                  <PencilRuler className="size-3" />
                  {linkedPosts.length > 1 && (
                    <span className="text-[11px] font-medium leading-none">{linkedPosts.length}</span>
                  )}
                </Badge>
              )}

              {(canToggle || canEdit) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-muted-foreground hover:text-foreground"
                    disabled={isBusy}
                  >
                    <MoreVertical className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  {canToggle && task.status !== 'IN_PROGRESS' && (
                    <DropdownMenuItem onClick={() => setStatus('IN_PROGRESS')}>
                      <CircleDashed className="size-3.5 mr-2 text-amber-500" /> In Progress
                    </DropdownMenuItem>
                  )}
                  {canToggle && task.status !== 'COMPLETED' && (
                    <DropdownMenuItem onClick={() => setStatus('COMPLETED')}>
                      <CheckCircle2 className="size-3.5 mr-2 text-emerald-500" /> Completed
                    </DropdownMenuItem>
                  )}
                  {canToggle && task.status !== 'TODO' && (
                    <DropdownMenuItem onClick={() => setStatus('TODO')}>
                      <Circle className="size-3.5 mr-2" /> To Do
                    </DropdownMenuItem>
                  )}
                  {canToggle && task.status !== 'ARCHIVED' && (
                    <DropdownMenuItem onClick={() => setStatus('ARCHIVED')}>
                      <Archive className="size-3.5 mr-2" /> Archived
                    </DropdownMenuItem>
                  )}
                  {canToggle && canEdit && <DropdownMenuSeparator />}
                  {canEdit && task.status !== 'ARCHIVED' && (
                    <DropdownMenuItem onClick={() => setEditOpen(true)}>
                      <Pencil className="size-3.5 mr-2" /> Edit
                    </DropdownMenuItem>
                  )}
                  {canEdit && (
                    <DropdownMenuItem
                      onClick={() => setDeleteOpen(true)}
                      className="text-destructive focus:text-destructive focus:bg-destructive/10"
                    >
                      <Trash2 className="size-3.5 mr-2" /> Delete
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              )}
            </div>
          )}
        </div>

        {/* ── Card body ── */}
        <div className="px-5 pt-3 pb-5 flex flex-col gap-2 flex-1">
          <p
            className={cn(
              'text-base font-semibold leading-snug',
              task.status === 'COMPLETED' && 'line-through text-muted-foreground',
            )}
          >
            {task.title}
          </p>

          {task.description && (
            <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
              {task.description}
            </p>
          )}

          {assignee && (
            canAssignTasks ? (
              <div className={cn('flex items-center gap-1.5 mt-auto pt-3', assignee._removed && 'opacity-60')}>
                <span className="text-xs text-muted-foreground shrink-0">Assigned to</span>
                {assignee.avatar_url ? (
                  <img
                    src={assignee.avatar_url}
                    alt=""
                    className={cn('size-4 rounded-full object-cover shrink-0', assignee._removed && 'grayscale')}
                  />
                ) : (
                  <div
                    className={cn(
                      'size-4 rounded-full flex items-center justify-center text-[8px] font-semibold shrink-0',
                      assignee._removed ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary',
                    )}
                  >
                    {(assignee.full_name || assignee.email || '?')[0].toUpperCase()}
                  </div>
                )}
                <span className="text-xs text-foreground truncate">
                  {assignee.full_name || assignee.email}
                  {assignee._removed && <span className="text-muted-foreground ml-1">(Removed)</span>}
                  {task.assigned_to === currentUserId && (
                    <span className="text-muted-foreground ml-1">(You)</span>
                  )}
                </span>
              </div>
            ) : (
              <div className={cn('flex items-center gap-1.5 mt-auto pt-3', creatorMember?._removed && 'opacity-60')}>
                <span className="text-xs text-muted-foreground shrink-0">Assigned by</span>
                {creatorMember?.avatar_url ? (
                  <img
                    src={creatorMember.avatar_url}
                    alt=""
                    className={cn('size-4 rounded-full object-cover shrink-0', creatorMember?._removed && 'grayscale')}
                  />
                ) : (
                  <div
                    className={cn(
                      'size-4 rounded-full flex items-center justify-center text-[8px] font-semibold shrink-0',
                      creatorMember?._removed ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary',
                    )}
                  >
                    {(creatorMember?.full_name || creatorMember?.email || '?')[0].toUpperCase()}
                  </div>
                )}
                <span className="text-xs text-foreground truncate">
                  {creatorMember?.full_name || creatorMember?.email || 'Team member'}
                  {creatorMember?._removed && <span className="text-muted-foreground ml-1">(Removed)</span>}
                </span>
              </div>
            )
          )}
        </div>

        {/* ── Divider ── */}
        <div className="mx-5 border-t border-dashed" />

        {/* ── Footer: client + due date ── */}
        <div className="flex items-center justify-between px-5 pb-5 pt-4 gap-2">
          {client ? (
            <div className="flex items-center gap-2 min-w-0">
              <ClientAvatar client={client} size="sm" />
              <span className="text-sm font-medium text-foreground truncate">{client.name}</span>
              {client.is_internal && (
                <Badge variant="secondary" className="text-[9px] px-1 py-0 shrink-0">INT</Badge>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
              <Building2 className="size-3.5" />
              <span>General (no client)</span>
            </div>
          )}

          {displayDate && (
            <span
              className={cn(
                'text-xs font-medium shrink-0',
                overdue ? 'text-destructive' : 'text-muted-foreground',
              )}
            >
              {task.status === 'COMPLETED'
                ? `Done ${format(new Date(displayDate), 'd MMM')}`
                : overdue
                  ? `Overdue ${format(new Date(displayDate), 'd MMM')}`
                  : `Due ${format(new Date(displayDate), 'd MMM')}`}
            </span>
          )}
        </div>
      </div>

      <EditTaskDialog task={task} open={editOpen} onOpenChange={setEditOpen} />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete task?</AlertDialogTitle>
            <AlertDialogDescription>
              "{task.title}" will be permanently deleted. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => remove()}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
