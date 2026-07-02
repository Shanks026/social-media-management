import { useState, useMemo } from 'react'
import { format } from 'date-fns'
import {
  Bell,
  Circle,
  CircleDashed,
  CheckCircle2,
  Archive,
  RotateCcw,
  Pencil,
  Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ClientAvatar } from '@/components/tasks/ClientAvatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
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
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { updateTaskStatus, deleteTask } from '@/api/tasks'
import { toast } from 'sonner'
import EditTaskDialog from '@/components/tasks/EditTaskDialog'

// Re-export ClientAvatar from its canonical location so existing import sites still work
export { ClientAvatar }

// ─── Priority dot config (compact indicator for row/card modes) ───────────────

const PRIORITY_DOT = {
  URGENT: 'bg-red-500',
  HIGH: 'bg-amber-500',
  LOW: 'bg-zinc-400',
}

// ─── Status icon helper ───────────────────────────────────────────────────────

function StatusIcon({ status, className }) {
  if (status === 'COMPLETED') return <CheckCircle2 className={cn('size-5 text-emerald-500 stroke-[2]', className)} />
  if (status === 'IN_PROGRESS') return <CircleDashed className={cn('size-5 text-amber-500 stroke-[2]', className)} />
  return <Circle className={cn('size-5 stroke-[2]', className)} />
}

// ─── TaskRow ──────────────────────────────────────────────────────────────────

/**
 * Props:
 *  - task        — the task object
 *  - clientMap   — { [clientId]: client } — optional, omit on OverviewTab
 *  - showClient  — boolean, show the client chip (global page only)
 *  - variant       — 'row' (default), 'dashboard-card' (dashboard), 'client-card' (client/campaign card)
 */
export default function TaskRow({
  task,
  clientMap = {},
  showClient = false,
  variant = 'row',
  alwaysShowActions = false,
}) {
  const queryClient = useQueryClient()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['tasks', 'list'], exact: false })
  }

  const STATUS_TOASTS = {
    IN_PROGRESS: 'Task started',
    COMPLETED: 'Task completed',
    TODO: 'Task reopened',
    ARCHIVED: 'Task archived',
  }

  const { mutate: setStatus, isPending: isSettingStatus } = useMutation({
    mutationFn: (newStatus) => updateTaskStatus(task.id, newStatus),
    onSuccess: (_, newStatus) => {
      invalidate()
      toast.success(STATUS_TOASTS[newStatus] ?? 'Task updated')
    },
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

  const isBusy = isSettingStatus || isDeleting

  const overdue = useMemo(() => {
    if (!task.due_at) return false
    if (task.status !== 'TODO' && task.status !== 'IN_PROGRESS') return false
    return new Date(task.due_at).getTime() < Date.now()
  }, [task.due_at, task.status])

  const client = clientMap[task.client_id]

  const handleCircleClick = () => {
    if (task.status === 'COMPLETED') setStatus('TODO')
    else if (task.status !== 'ARCHIVED') setStatus('COMPLETED')
  }

  const isActive = task.status === 'TODO' || task.status === 'IN_PROGRESS'
  const isCard = variant === 'dashboard-card' || variant === 'client-card'

  // ─── Card Modes ───────────────────────────────────────────────────────────
  if (isCard) {
    return (
      <>
        <div className="@container group bg-white dark:bg-card/50 rounded-xl shadow-sm ring-1 ring-border/50 overflow-hidden flex flex-col h-full">
          {/* Main content */}
          <div className="px-5 pt-5 pb-4 flex flex-col flex-1">
            {/* Title row */}
            <div className="flex items-start gap-3 mb-1">
              {task.status !== 'ARCHIVED' ? (
                <button
                  onClick={handleCircleClick}
                  disabled={isBusy}
                  className="mt-0.5 shrink-0 text-foreground hover:text-primary transition-colors disabled:opacity-50"
                >
                  <StatusIcon status={task.status} />
                </button>
              ) : (
                <div className="size-5 mt-0.5 shrink-0" />
              )}
              <p
                className={`font-medium text-sm leading-snug ${
                  !isActive && task.status !== 'ARCHIVED'
                    ? 'line-through text-muted-foreground'
                    : task.status === 'ARCHIVED'
                      ? 'text-muted-foreground'
                      : 'text-foreground'
                }`}
              >
                {task.title}
              </p>
            </div>

            {/* Description */}
            {task.description && (
              <p className="text-xs text-muted-foreground line-clamp-2 pl-8">
                {task.description}
              </p>
            )}

            {/* Spacer pushes footer to bottom */}
            <div className="flex-1" />

            {/* Divider */}
            <div className="border-t border-dashed border-border/60 mt-4 mb-3" />

            {/* Footer: client(dashboard) or actions(client-card) + due date */}
            <div className="flex items-center justify-between pl-1">
              {variant === 'dashboard-card' && client ? (
                <div className="flex items-center gap-2">
                  <ClientAvatar client={client} size="sm" />
                  {!overdue && (
                    <>
                      <span className="text-xs font-semibold text-foreground truncate max-w-[140px] hidden @[300px]:block">
                        {client.name || 'Internal'}
                      </span>
                      {client.is_internal && (
                        <Badge
                          variant="secondary"
                          className="text-[9px] px-1 py-0 hidden @[300px]:inline-flex"
                        >
                          INT
                        </Badge>
                      )}
                    </>
                  )}
                </div>
              ) : variant === 'client-card' ? (
                <div className="flex items-center gap-1 -ml-3">
                  {task.status === 'ARCHIVED' ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-muted-foreground hover:text-primary transition-colors hover:bg-muted/50"
                      onClick={() => setStatus('TODO')}
                      disabled={isBusy}
                      title="Restore"
                    >
                      <RotateCcw className="size-3.5" />
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-muted-foreground hover:text-amber-500 transition-colors hover:bg-muted/50"
                      onClick={() => setStatus('ARCHIVED')}
                      disabled={isBusy}
                      title="Archive"
                    >
                      <Archive className="size-3.5" />
                    </Button>
                  )}
                  {task.status !== 'ARCHIVED' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-muted-foreground hover:text-primary transition-colors hover:bg-muted/50"
                      onClick={() => setEditOpen(true)}
                      disabled={isBusy}
                      title="Edit"
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-muted-foreground hover:text-destructive transition-colors hover:bg-destructive/10"
                    onClick={() => setDeleteOpen(true)}
                    disabled={isBusy}
                    title="Delete"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ) : (
                <div />
              )}

              <div
                className={`flex items-center gap-1.5 text-xs font-medium ${
                  overdue ? 'text-destructive' : 'text-muted-foreground'
                }`}
              >
                <Bell className="size-3.5 shrink-0" />
                {task.due_at ? (
                  <>
                    <span>{format(new Date(task.due_at), 'dd MMMM yyyy')}</span>
                    <span className="w-1 h-1 rounded-full bg-current opacity-50" />
                    <span>{format(new Date(task.due_at), 'h:mma')}</span>
                    {overdue && (
                      <Badge
                        variant="destructive"
                        className="text-[9px] px-1 py-0 ml-1"
                      >
                        Overdue
                      </Badge>
                    )}
                  </>
                ) : (
                  <span>-</span>
                )}
              </div>
            </div>
          </div>

          {/* Action bar — only for dashboard-card */}
          {variant === 'dashboard-card' && (
            <div
              className={cn(
                'grid transition-all duration-200 ease-in-out',
                alwaysShowActions
                  ? 'grid-rows-[1fr]'
                  : 'grid-rows-[0fr] group-hover:grid-rows-[1fr]',
              )}
            >
              <div className="overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2 border-t border-border/40 bg-muted/30">
                  <div className="flex items-center gap-1">
                    {task.status === 'ARCHIVED' ? (
                      <Tooltip delayDuration={400}>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-muted-foreground hover:text-primary"
                            onClick={() => setStatus('TODO')}
                            disabled={isBusy}
                          >
                            <RotateCcw className="size-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">
                          Restore
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <Tooltip delayDuration={400}>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-muted-foreground hover:text-amber-500"
                            onClick={() => setStatus('ARCHIVED')}
                            disabled={isBusy}
                          >
                            <Archive className="size-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">
                          Archive
                        </TooltipContent>
                      </Tooltip>
                    )}
                    {task.status !== 'ARCHIVED' && (
                      <Tooltip delayDuration={400}>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-muted-foreground hover:text-primary"
                            onClick={() => setEditOpen(true)}
                            disabled={isBusy}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">
                          Edit
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                  <Tooltip delayDuration={400}>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-muted-foreground hover:text-destructive"
                        onClick={() => setDeleteOpen(true)}
                        disabled={isBusy}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      Delete
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </div>
          )}
        </div>

        <EditTaskDialog
          task={task}
          open={editOpen}
          onOpenChange={setEditOpen}
        />

        <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete task?</AlertDialogTitle>
              <AlertDialogDescription>
                "{task.title}" will be permanently deleted. This cannot be
                undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>
                Cancel
              </AlertDialogCancel>
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

  // ─── Row Mode ─────────────────────────────────────────────────────────────
  return (
    <>
      <div className="flex items-start gap-3 px-4 py-3 hover:bg-muted/40 transition-colors rounded-lg group">
        {task.status !== 'ARCHIVED' ? (
          <button
            onClick={handleCircleClick}
            disabled={isBusy}
            className="mt-0.5 shrink-0 text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
          >
            <StatusIcon status={task.status} />
          </button>
        ) : (
          <div className="size-5 mt-0.5 shrink-0" />
        )}

        <div
          className={`min-w-0 flex-1 ${!isActive && task.status !== 'ARCHIVED' ? 'opacity-50' : ''}`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <p
              className={`font-medium text-sm truncate ${
                task.status === 'COMPLETED' ? 'line-through text-muted-foreground' : ''
              }`}
            >
              {task.title}
            </p>
            {task.priority && PRIORITY_DOT[task.priority] && (
              <span
                className={cn('size-1.5 rounded-full shrink-0', PRIORITY_DOT[task.priority])}
                title={task.priority.charAt(0) + task.priority.slice(1).toLowerCase()}
              />
            )}
          </div>
          {task.description && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
              {task.description}
            </p>
          )}
          {task.due_at && (
            <div
              className={`flex items-center gap-1 mt-1.5 text-[10px] font-medium ${
                overdue ? 'text-destructive' : 'text-muted-foreground'
              }`}
            >
              <Bell className="size-3" />
              {format(new Date(task.due_at), 'MMM d, h:mm a')}
              {overdue && (
                <Badge
                  variant="destructive"
                  className="text-[9px] px-1 py-0 ml-1"
                >
                  Overdue
                </Badge>
              )}
            </div>
          )}
        </div>

        {showClient && client && (
          <div className="flex items-center gap-1.5 shrink-0 ml-2 bg-muted/60 rounded-full px-2 py-1">
            <ClientAvatar client={client} size="sm" />
            <span className="text-[11px] text-muted-foreground font-medium truncate max-w-[100px]">
              {client.name}
            </span>
            {client.is_internal && (
              <Badge variant="secondary" className="text-[9px] px-1 py-0">
                INT
              </Badge>
            )}
          </div>
        )}

        <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          {task.status === 'ARCHIVED' ? (
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground hover:text-primary"
              onClick={() => setStatus('TODO')}
              disabled={isBusy}
              title="Restore to To Do"
            >
              <RotateCcw className="size-3.5" />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground hover:text-amber-500"
              onClick={() => setStatus('ARCHIVED')}
              disabled={isBusy}
              title="Archive"
            >
              <Archive className="size-3.5" />
            </Button>
          )}

          {task.status !== 'ARCHIVED' && (
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground hover:text-primary"
              onClick={() => setEditOpen(true)}
              disabled={isBusy}
              title="Edit"
            >
              <Pencil className="size-3.5" />
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground hover:text-destructive"
            onClick={() => setDeleteOpen(true)}
            disabled={isBusy}
            title="Delete"
          >
            <Trash2 className="size-3.5" />
          </Button>
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
