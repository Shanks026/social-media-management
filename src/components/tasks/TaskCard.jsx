import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import {
  Building2,
  Circle,
  CircleDashed,
  CheckCircle2,
  Archive,
  RotateCcw,
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
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
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

// ─── Task Detail Sheet ────────────────────────────────────────────────────────

// A single linked-deliverable preview row (used in the detail sheet).
// `client` is passed only for general (clientless) tasks, where linked
// deliverables can span clients and need labelling.
function DeliverablePreviewRow({ post, client }) {
  const isCompleted = ['PUBLISHED', 'ARCHIVED'].includes(post.status)
  const health = !isCompleted ? getUrgencyStatus(post.target_date) : null
  return (
    <Link
      to={`/clients/${post.client_id}/posts/${post.id}`}
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
          <div className="flex items-center -space-x-2">
            {post.platforms.map((p) => (
              <PlatformIcon key={p} name={p} />
            ))}
          </div>
        )}
      </div>
    </Link>
  )
}

export function TaskDetailSheet({
  task,
  open,
  onOpenChange,
  clientMap,
  campaignMap = {},
  memberMap,
  currentUserId,
  canEdit,
  canToggle,
}) {
  const queryClient = useQueryClient()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['tasks', 'list'], exact: false })

  const { mutate: setStatus, isPending: isSettingStatus } = useMutation({
    mutationFn: (newStatus) => updateTaskStatus(task.id, newStatus),
    onSuccess: invalidate,
    onError: (err) => toast.error('Failed to update: ' + err.message),
  })

  const { mutate: remove, isPending: isDeleting } = useMutation({
    mutationFn: () => deleteTask(task.id),
    onSuccess: () => {
      invalidate()
      onOpenChange(false)
      toast.success('Task deleted')
    },
    onError: (err) => toast.error('Failed to delete: ' + err.message),
  })

  const { data: linkedPosts = [] } = useQuery({
    queryKey: ['task-deliverables', task?.id],
    queryFn: () => fetchTaskDeliverables(task.id),
    enabled: !!task?.id,
  })

  if (!task) return null

  const isBusy = isSettingStatus || isDeleting
  const client = clientMap[String(task.client_id)]
  const campaign = task.campaign_id ? campaignMap[String(task.campaign_id)] : null
  const assignee = task.assigned_to ? memberMap[task.assigned_to] : null
  const creatorMember = memberMap[task.created_by]
  const creatorName =
    task.created_by === currentUserId
      ? 'You'
      : creatorMember?.full_name || creatorMember?.email || 'Team member'
  const statusCfg = STATUS_CONFIG[task.status] ?? STATUS_CONFIG.TODO
  const overdue =
    task.due_at &&
    new Date(task.due_at).getTime() < new Date().getTime() &&
    task.status !== 'COMPLETED' &&
    task.status !== 'ARCHIVED'

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="sm:max-w-[480px] flex flex-col p-0 gap-0">
          {/* Header */}
          <div className="px-6 pt-10 pb-5 border-b border-border/50">
            <div className="flex items-center gap-2 mb-3">
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
            <SheetTitle
              className={cn(
                'text-xl font-bold leading-snug',
                task.status === 'COMPLETED' && 'line-through text-muted-foreground',
              )}
            >
              {task.title}
            </SheetTitle>
            {task.created_at && (
              <SheetDescription className="mt-1">
                Created {format(new Date(task.created_at), 'd MMM yyyy')}
              </SheetDescription>
            )}
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {task.description && (
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                {task.description}
              </p>
            )}

            <div className="space-y-3">
              {/* Status picker */}
              <div className="flex items-start gap-3">
                <span className="text-xs text-muted-foreground w-24 shrink-0 pt-1">Status</span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { key: 'TODO',        label: 'To Do',       dot: STATUS_DOT.TODO,        cls: STATUS_CONFIG.TODO.className },
                    { key: 'IN_PROGRESS', label: 'In Progress', dot: STATUS_DOT.IN_PROGRESS, cls: STATUS_CONFIG.IN_PROGRESS.className },
                    { key: 'COMPLETED',   label: 'Completed',   dot: STATUS_DOT.COMPLETED,   cls: STATUS_CONFIG.COMPLETED.className },
                    { key: 'ARCHIVED',    label: 'Archived',    dot: STATUS_DOT.ARCHIVED,    cls: STATUS_CONFIG.ARCHIVED.className },
                  ].map((s) => (
                    <button
                      key={s.key}
                      onClick={() => task.status !== s.key && setStatus(s.key)}
                      disabled={!canToggle || isBusy || task.status === s.key}
                      className={cn(
                        'flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full transition-all select-none',
                        task.status === s.key
                          ? s.cls
                          : canToggle
                            ? 'bg-muted/50 text-muted-foreground hover:bg-muted cursor-pointer'
                            : 'bg-muted/30 text-muted-foreground/50 cursor-default',
                      )}
                    >
                      <span className={cn('size-2 rounded-full shrink-0', s.dot)} />
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {assignee && (
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-24 shrink-0">Assigned To</span>
                  <div className="flex items-center gap-2">
                    {assignee.avatar_url ? (
                      <img src={assignee.avatar_url} alt="" className="size-5 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="size-5 rounded-full bg-primary/10 flex items-center justify-center text-[9px] font-semibold text-primary shrink-0">
                        {(assignee.full_name || assignee.email || '?')[0].toUpperCase()}
                      </div>
                    )}
                    <span className="text-sm">{assignee.full_name || assignee.email}</span>
                  </div>
                </div>
              )}

              {assignee && (
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-24 shrink-0">Assigned By</span>
                  <div className="flex items-center gap-2">
                    {task.created_by !== currentUserId && (
                      creatorMember?.avatar_url ? (
                        <img src={creatorMember.avatar_url} alt="" className="size-5 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="size-5 rounded-full bg-primary/10 flex items-center justify-center text-[9px] font-semibold text-primary shrink-0">
                          {(creatorMember?.full_name || creatorMember?.email || '?')[0].toUpperCase()}
                        </div>
                      )
                    )}
                    <span className="text-sm">{creatorName}</span>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-24 shrink-0">Created By</span>
                <div className="flex items-center gap-2">
                  {task.created_by !== currentUserId && (
                    creatorMember?.avatar_url ? (
                      <img src={creatorMember.avatar_url} alt="" className="size-5 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="size-5 rounded-full bg-primary/10 flex items-center justify-center text-[9px] font-semibold text-primary shrink-0">
                        {(creatorMember?.full_name || creatorMember?.email || '?')[0].toUpperCase()}
                      </div>
                    )
                  )}
                  <span className="text-sm">{creatorName}</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-24 shrink-0">Client</span>
                <div className="flex items-center gap-2">
                  {client ? (
                    <>
                      <ClientAvatar client={client} size="sm" />
                      <span className="text-sm">{client.name}</span>
                    </>
                  ) : (
                    <span className="text-sm text-muted-foreground">General (no client)</span>
                  )}
                </div>
              </div>

              {campaign && (
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-24 shrink-0">Campaign</span>
                  <div className="flex items-center gap-2">
                    <Megaphone className="size-3.5 text-muted-foreground shrink-0" />
                    <Link
                      to={`/campaigns/${campaign.id}`}
                      className="text-sm text-blue-600 dark:text-blue-400 underline underline-offset-2 hover:text-blue-700 dark:hover:text-blue-300"
                    >
                      {campaign.name}
                    </Link>
                  </div>
                </div>
              )}

              {task.due_at && (
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-24 shrink-0">Due</span>
                  <span className={cn('text-sm', overdue && 'text-destructive font-medium')}>
                    {format(new Date(task.due_at), 'd MMM yyyy')}
                    {overdue && ' · Overdue'}
                  </span>
                </div>
              )}

              {task.completed_at && (
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-24 shrink-0">Completed</span>
                  <span className="text-sm">{format(new Date(task.completed_at), 'd MMM yyyy')}</span>
                </div>
              )}
            </div>

            {linkedPosts.length > 0 && (
              <div className="space-y-2.5 border-t border-border/50 pt-5">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold">Deliverables</h4>
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-[11px] font-medium text-muted-foreground">
                    {linkedPosts.length}
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  {linkedPosts.map((post) => (
                    <DeliverablePreviewRow
                      key={post.id}
                      post={post}
                      client={!task.client_id ? clientMap?.[String(post.client_id)] : undefined}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer actions */}
          {canEdit && (
            <div className="px-6 py-4 border-t border-border/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditOpen(true)} disabled={isBusy}>
                  <Pencil className="size-3.5 mr-1.5" /> Edit
                </Button>
                {task.status !== 'ARCHIVED' ? (
                  <Button variant="outline" size="sm" onClick={() => setStatus('ARCHIVED')} disabled={isBusy}>
                    <Archive className="size-3.5 mr-1.5" /> Archive
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => setStatus('TODO')} disabled={isBusy}>
                    <RotateCcw className="size-3.5 mr-1.5" /> Restore
                  </Button>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => setDeleteOpen(true)}
                disabled={isBusy}
              >
                <Trash2 className="size-3.5 mr-1.5" /> Delete
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

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

// ─── Task Card ────────────────────────────────────────────────────────────────

export default function TaskCard({ task, clientMap, campaignMap = {}, memberMap = {}, currentUserId = null }) {
  const queryClient = useQueryClient()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const { isOwner, canAssignTasks } = usePermissions()

  const isCreator  = task.created_by === currentUserId
  const isAssignee = task.assigned_to === currentUserId
  const canEdit    = isOwner || isCreator
  const canToggle  = isOwner || isCreator || isAssignee

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
        onClick={() => setSheetOpen(true)}
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
              <div className="flex items-center gap-1.5 mt-auto pt-3">
                <span className="text-xs text-muted-foreground shrink-0">Assigned to</span>
                {assignee.avatar_url ? (
                  <img src={assignee.avatar_url} alt="" className="size-4 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="size-4 rounded-full bg-primary/10 flex items-center justify-center text-[8px] font-semibold text-primary shrink-0">
                    {(assignee.full_name || assignee.email || '?')[0].toUpperCase()}
                  </div>
                )}
                <span className="text-xs text-foreground truncate">
                  {assignee.full_name || assignee.email}
                  {task.assigned_to === currentUserId && (
                    <span className="text-muted-foreground ml-1">(You)</span>
                  )}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 mt-auto pt-3">
                <span className="text-xs text-muted-foreground shrink-0">Assigned by</span>
                {creatorMember?.avatar_url ? (
                  <img src={creatorMember.avatar_url} alt="" className="size-4 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="size-4 rounded-full bg-primary/10 flex items-center justify-center text-[8px] font-semibold text-primary shrink-0">
                    {(creatorMember?.full_name || creatorMember?.email || '?')[0].toUpperCase()}
                  </div>
                )}
                <span className="text-xs text-foreground truncate">
                  {creatorMember?.full_name || creatorMember?.email || 'Team member'}
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

      <TaskDetailSheet
        task={task}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        clientMap={clientMap}
        campaignMap={campaignMap}
        memberMap={memberMap}
        currentUserId={currentUserId}
        canEdit={canEdit}
        canToggle={canToggle}
      />

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
