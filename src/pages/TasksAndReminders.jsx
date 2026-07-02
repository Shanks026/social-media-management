import { useState, useMemo, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
} from '@dnd-kit/core'
import {
  Plus,
  Filter,
  Building2,
  Circle,
  CircleDashed,
  CheckCircle2,
  Archive,
  RotateCcw,
  Pencil,
  Trash2,
  Search,
  LayoutGrid,
  Columns3,
  List,
  ChevronDown,
  ChevronRight,
  User,
  MoreVertical,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
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

import { useSearchParams } from 'react-router-dom'
import { useHeader } from '@/components/misc/header-context'
import { useAuth } from '@/context/AuthContext'
import { useClients } from '@/api/clients'
import { useTasks, updateTaskStatus, deleteTask } from '@/api/tasks'
import { useTeamMembers } from '@/api/team'
import { usePermissions } from '@/api/usePermissions'
import CreateTaskDialog from '@/components/tasks/CreateTaskDialog'
import EditTaskDialog from '@/components/tasks/EditTaskDialog'
import { ClientAvatar } from '@/components/tasks/ClientAvatar'
import { cn } from '@/lib/utils'
import {
  Empty,
  EmptyContent,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from '@/components/ui/empty'

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_TABS = [
  { key: 'ALL', label: 'All' },
  { key: 'TODO', label: 'To Do' },
  { key: 'IN_PROGRESS', label: 'In Progress' },
  { key: 'COMPLETED', label: 'Completed' },
  { key: 'ARCHIVED', label: 'Archived' },
]

const STATUS_CONFIG = {
  TODO: {
    label: 'To Do',
    className:
      'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 border-none',
  },
  IN_PROGRESS: {
    label: 'In Progress',
    className:
      'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 border-none',
  },
  COMPLETED: {
    label: 'Completed',
    className:
      'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 border-none',
  },
  ARCHIVED: {
    label: 'Archived',
    className: 'bg-muted text-muted-foreground border-none',
  },
}

const PRIORITY_CONFIG = {
  URGENT: { label: 'Urgent', dot: 'bg-red-500' },
  HIGH:   { label: 'High',   dot: 'bg-amber-500' },
  NORMAL: { label: 'Normal', dot: 'bg-zinc-400' },
  LOW:    { label: 'Low',    dot: 'bg-emerald-400' },
}
const PRIORITY_DOT = Object.fromEntries(Object.entries(PRIORITY_CONFIG).map(([k, v]) => [k, v.dot]))
const PRIORITY_LABELS = Object.fromEntries(Object.entries(PRIORITY_CONFIG).map(([k, v]) => [k, v.label]))

const STATUS_DOT = {
  TODO:        'bg-blue-500',
  IN_PROGRESS: 'bg-amber-500',
  COMPLETED:   'bg-emerald-500',
  ARCHIVED:    'bg-zinc-400',
}

const PRIORITY_ORDER = { URGENT: 0, HIGH: 1, NORMAL: 2, LOW: 3 }

const TAB_TRIGGER_CLASS =
  'relative rounded-none bg-transparent px-0 pb-3 pt-0 text-sm font-medium transition-none shadow-none border-b-2 border-transparent text-muted-foreground flex-none w-fit gap-2 data-[state=active]:bg-transparent dark:data-[state=active]:bg-transparent data-[state=active]:text-black dark:data-[state=active]:text-white data-[state=active]:border-black dark:data-[state=active]:border-white data-[state=active]:shadow-none data-[state=active]:border-x-0 data-[state=active]:border-t-0 focus-visible:ring-0'

// The canonical key for the global tasks list — used for optimistic updates in kanban
const GLOBAL_TASKS_QK = ['tasks', 'list', { clientId: null, campaignId: null }]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sortByPriority(tasks) {
  return [...tasks].sort(
    (a, b) => (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2),
  )
}

function ColHeader({ label }) {
  return <span className="text-xs font-medium text-muted-foreground">{label}</span>
}

function SortableColHeader({ column, label }) {
  const dir = column.getIsSorted()
  return (
    <button
      className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
      onClick={() => column.toggleSorting(dir === 'asc')}
    >
      {label}
      {dir === 'asc' ? <ArrowUp className="size-3" />
        : dir === 'desc' ? <ArrowDown className="size-3" />
        : <ArrowUpDown className="size-3 opacity-40" />}
    </button>
  )
}

// ─── Task Card ────────────────────────────────────────────────────────────────

function TaskCard({ task, clientMap, memberMap = {}, currentUserId = null }) {
  const queryClient = useQueryClient()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const { isOwner } = usePermissions()

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

  const isBusy = isSettingStatus || isDeleting
  const overdue =
    task.due_at &&
    new Date(task.due_at).getTime() < new Date().getTime() &&
    (task.status === 'TODO' || task.status === 'IN_PROGRESS')
  const client = clientMap[String(task.client_id)]
  const statusCfg = STATUS_CONFIG[task.status] ?? STATUS_CONFIG.TODO

  const assignee = task.assigned_to ? memberMap[task.assigned_to] : null

  // Date to display: completed_at for completed tasks, due_at otherwise
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
            onClick={(e) => { e.stopPropagation(); if (canToggle && task.status !== 'ARCHIVED' && !isBusy) handleStatusClick() }}
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

          {(canToggle || canEdit) && (
            <div className="ml-auto" onClick={(e) => e.stopPropagation()}>
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
          )}

        </div>

        {/* ── Divider ── */}
        <div className="mx-5 border-t border-dashed border-border/60" />

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
            <div className="flex items-center gap-1.5 text-muted-foreground/40 italic text-xs">
              <Building2 className="size-3" />
              <span>No client</span>
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

// ─── Task Detail Sheet ────────────────────────────────────────────────────────

function TaskDetailSheet({ task, open, onOpenChange, clientMap, memberMap, currentUserId, canEdit, canToggle }) {
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

  if (!task) return null

  const isBusy = isSettingStatus || isDeleting
  const client = clientMap[String(task.client_id)]
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
                    { key: 'ARCHIVED',    label: 'Archived',    dot: STATUS_DOT.ARCHIVED,     cls: STATUS_CONFIG.ARCHIVED.className },
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

              {client && (
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-24 shrink-0">Client</span>
                  <div className="flex items-center gap-2">
                    <ClientAvatar client={client} size="sm" />
                    <span className="text-sm">{client.name}</span>
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
          </div>

          {/* Footer actions */}
          {canEdit && (
            <div className="px-6 py-4 border-t border-border/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditOpen(true)}
                  disabled={isBusy}
                >
                  <Pencil className="size-3.5 mr-1.5" /> Edit
                </Button>
                {task.status !== 'ARCHIVED' ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setStatus('ARCHIVED')}
                    disabled={isBusy}
                  >
                    <Archive className="size-3.5 mr-1.5" /> Archive
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setStatus('TODO')}
                    disabled={isBusy}
                  >
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

// ─── Tasks Grid Group ─────────────────────────────────────────────────────────

function TasksGroup({ title, tasks, clientMap, memberMap, currentUserId }) {
  if (tasks.length === 0) return null
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        {title}
      </p>
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,360px),1fr))]">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            clientMap={clientMap}
            memberMap={memberMap}
            currentUserId={currentUserId}
          />
        ))}
      </div>
    </div>
  )
}

// ─── Kanban: Draggable Card Wrapper ───────────────────────────────────────────

function DraggableCard({ id, children }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id })

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: 50,
      }
    : undefined

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        'cursor-grab active:cursor-grabbing touch-none',
        isDragging && 'opacity-40',
      )}
    >
      {children}
    </div>
  )
}

// ─── Kanban: Column ───────────────────────────────────────────────────────────

function KanbanColumn({
  id,
  title,
  count,
  accentClass,
  children,
  collapsible,
}) {
  const [isCollapsed, setIsCollapsed] = useState(collapsible ?? false)
  const { setNodeRef, isOver } = useDroppable({ id })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex flex-col rounded-xl border bg-muted/20 transition-colors min-h-75',
        isOver && 'ring-2 ring-primary/40 bg-primary/5 border-primary/30',
      )}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <span className={cn('size-2 rounded-full shrink-0', accentClass)} />
          <span className="text-sm font-semibold text-foreground">{title}</span>
          <span className="text-[11px] bg-muted text-muted-foreground rounded-full px-2 py-0.5 font-medium min-w-5 text-center">
            {count}
          </span>
        </div>
        {collapsible && (
          <button
            onClick={() => setIsCollapsed((v) => !v)}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            {isCollapsed ? (
              <ChevronRight size={16} />
            ) : (
              <ChevronDown size={16} />
            )}
          </button>
        )}
      </div>

      {!isCollapsed && (
        <div className="flex-1 p-3 space-y-3">
          {children}
          {count === 0 && (
            <div className="flex items-center justify-center h-24 text-xs text-muted-foreground/50 italic">
              Drop tasks here
            </div>
          )}
        </div>
      )}

      {isCollapsed && (
        <div className="px-4 py-2 text-xs text-muted-foreground/40 italic">
          {count} task{count !== 1 ? 's' : ''} · drop here to archive
        </div>
      )}
    </div>
  )
}

// ─── Kanban View ──────────────────────────────────────────────────────────────

function KanbanTasksView({ tasks, clientMap, memberMap, currentUserId, queryClient }) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  )

  const todoTasks      = tasks.filter((t) => t.status === 'TODO')
  const inProgressTasks = tasks.filter((t) => t.status === 'IN_PROGRESS')
  const completedTasks = tasks.filter((t) => t.status === 'COMPLETED')
  const archivedTasks  = tasks.filter((t) => t.status === 'ARCHIVED')

  function handleDragEnd(event) {
    const { active, over } = event
    if (!over) return
    const newStatus = over.id
    const task = tasks.find((t) => t.id === active.id)
    if (!task || task.status === newStatus) return

    const previous = queryClient.getQueryData(GLOBAL_TASKS_QK)
    queryClient.setQueryData(GLOBAL_TASKS_QK, (old = []) =>
      old.map((t) => (t.id === active.id ? { ...t, status: newStatus } : t)),
    )

    updateTaskStatus(active.id, newStatus)
      .then(() =>
        toast.success(
          `Moved to ${STATUS_CONFIG[newStatus]?.label ?? newStatus}`,
        ),
      )
      .catch((err) => {
        queryClient.setQueryData(GLOBAL_TASKS_QK, previous)
        toast.error('Failed to update: ' + err.message)
      })
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-stretch">
        <KanbanColumn
          id="TODO"
          title="To Do"
          count={todoTasks.length}
          accentClass="bg-blue-500"
        >
          {todoTasks.map((task) => (
            <DraggableCard key={task.id} id={task.id}>
              <TaskCard task={task} clientMap={clientMap} memberMap={memberMap} currentUserId={currentUserId} />
            </DraggableCard>
          ))}
        </KanbanColumn>

        <KanbanColumn
          id="IN_PROGRESS"
          title="In Progress"
          count={inProgressTasks.length}
          accentClass="bg-amber-500"
        >
          {inProgressTasks.map((task) => (
            <DraggableCard key={task.id} id={task.id}>
              <TaskCard task={task} clientMap={clientMap} memberMap={memberMap} currentUserId={currentUserId} />
            </DraggableCard>
          ))}
        </KanbanColumn>

        <KanbanColumn
          id="COMPLETED"
          title="Completed"
          count={completedTasks.length}
          accentClass="bg-emerald-500"
        >
          {completedTasks.map((task) => (
            <DraggableCard key={task.id} id={task.id}>
              <TaskCard task={task} clientMap={clientMap} memberMap={memberMap} currentUserId={currentUserId} />
            </DraggableCard>
          ))}
        </KanbanColumn>

        <KanbanColumn
          id="ARCHIVED"
          title="Archived"
          count={archivedTasks.length}
          accentClass="bg-zinc-400"
          collapsible
        >
          {archivedTasks.map((task) => (
            <DraggableCard key={task.id} id={task.id}>
              <TaskCard task={task} clientMap={clientMap} memberMap={memberMap} currentUserId={currentUserId} />
            </DraggableCard>
          ))}
        </KanbanColumn>
      </div>
    </DndContext>
  )
}

// ─── Tasks Table View ─────────────────────────────────────────────────────────

const taskCol = createColumnHelper()

function TaskTableRowSkeleton() {
  return (
    <TableRow>
      <TableCell><div className="space-y-1.5"><Skeleton className="h-3.5 w-48" /><Skeleton className="h-3 w-32" /></div></TableCell>
      <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
      <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
      <TableCell><div className="flex items-center gap-2"><Skeleton className="size-6 rounded-full" /><Skeleton className="h-3.5 w-24" /></div></TableCell>
      <TableCell><div className="flex items-center gap-2"><Skeleton className="size-6 rounded-full" /><Skeleton className="h-3.5 w-24" /></div></TableCell>
      <TableCell><Skeleton className="h-3.5 w-16" /></TableCell>
    </TableRow>
  )
}

function TasksTableView({ tasks, isLoading, clientMap, memberMap, currentUserId }) {
  const { isOwner } = usePermissions()
  const [sorting, setSorting] = useState([])
  const [selectedTask, setSelectedTask] = useState(null)

  const columns = useMemo(() => [
    taskCol.accessor('title', {
      header: ({ column }) => <SortableColHeader column={column} label="Title" />,
      cell: ({ row }) => {
        const task = row.original
        return (
          <div className="min-w-0">
            <p className={cn(
              'text-sm font-medium leading-tight truncate max-w-72',
              task.status === 'COMPLETED' && 'line-through text-muted-foreground',
            )}>
              {task.title}
            </p>
            {task.description && (
              <p className="text-xs text-muted-foreground truncate max-w-72 mt-0.5">{task.description}</p>
            )}
          </div>
        )
      },
    }),
    taskCol.accessor('status', {
      header: ({ column }) => <SortableColHeader column={column} label="Status" />,
      cell: ({ getValue }) => {
        const status = getValue()
        const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.TODO
        return (
          <Badge variant="outline" className={cn('gap-1.5', cfg.className)}>
            <span className={cn('size-2 rounded-full shrink-0', STATUS_DOT[status] ?? 'bg-zinc-400')} />
            {cfg.label}
          </Badge>
        )
      },
    }),
    taskCol.accessor('priority', {
      header: ({ column }) => <SortableColHeader column={column} label="Priority" />,
      cell: ({ getValue }) => {
        const priority = getValue()
        const cfg = PRIORITY_CONFIG[priority]
        if (!cfg) return null
        return (
          <Badge variant="outline" className="gap-1.5">
            <span className={cn('size-2 rounded-full shrink-0', cfg.dot)} />
            {cfg.label}
          </Badge>
        )
      },
    }),
    taskCol.accessor('assigned_to', {
      id: 'assignee',
      header: () => <ColHeader label="Assigned To" />,
      enableSorting: false,
      cell: ({ getValue }) => {
        const assignee = getValue() ? memberMap[getValue()] : null
        if (!assignee) return <span className="text-xs text-muted-foreground">—</span>
        return (
          <div className="flex items-center gap-2 min-w-0">
            {assignee.avatar_url ? (
              <img src={assignee.avatar_url} alt="" className="size-6 rounded-full object-cover shrink-0 ring-1 ring-border" />
            ) : (
              <div className="size-6 rounded-full bg-primary/10 flex items-center justify-center text-[9px] font-semibold text-primary shrink-0 ring-1 ring-border">
                {(assignee.full_name || assignee.email || '?')[0].toUpperCase()}
              </div>
            )}
            <span className="text-sm truncate max-w-32">
              {assignee.full_name || assignee.email}
              {getValue() === currentUserId && (
                <span className="text-muted-foreground ml-1">(You)</span>
              )}
            </span>
          </div>
        )
      },
    }),
    taskCol.accessor('client_id', {
      id: 'client',
      header: ({ column }) => <SortableColHeader column={column} label="Client" />,
      sortingFn: (a, b) => {
        const nameA = clientMap[String(a.original.client_id)]?.name ?? ''
        const nameB = clientMap[String(b.original.client_id)]?.name ?? ''
        return nameA.localeCompare(nameB)
      },
      cell: ({ getValue }) => {
        const client = clientMap[String(getValue())]
        if (!client) return <span className="text-xs text-muted-foreground">—</span>
        return (
          <div className="flex items-center gap-2 min-w-0">
            <ClientAvatar client={client} size="sm" />
            <span className="text-sm truncate max-w-32">{client.name}</span>
          </div>
        )
      },
    }),
    taskCol.accessor('due_at', {
      header: ({ column }) => <SortableColHeader column={column} label="Due" />,
      cell: ({ row }) => {
        const task = row.original
        const displayDate = task.status === 'COMPLETED' && task.completed_at ? task.completed_at : task.due_at
        if (!displayDate) return <span className="text-xs text-muted-foreground">—</span>
        const overdue =
          task.due_at &&
          new Date(task.due_at).getTime() < new Date().getTime() &&
          (task.status === 'TODO' || task.status === 'IN_PROGRESS')
        return (
          <span className={cn('text-sm whitespace-nowrap', overdue ? 'text-destructive font-medium' : 'text-muted-foreground')}>
            {task.status === 'COMPLETED'
              ? `Done ${format(new Date(displayDate), 'd MMM')}`
              : overdue
                ? `Overdue ${format(new Date(displayDate), 'd MMM')}`
                : format(new Date(displayDate), 'd MMM yyyy')}
          </span>
        )
      },
    }),
  ], [clientMap, memberMap, currentUserId])

  const table = useReactTable({
    data: tasks,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  const selCanEdit = selectedTask ? (isOwner || selectedTask.created_by === currentUserId) : false
  const selCanToggle = selectedTask
    ? (isOwner || selectedTask.created_by === currentUserId || selectedTask.assigned_to === currentUserId)
    : false

  return (
    <>
      <div className="rounded-xl border border-border bg-card overflow-hidden mt-4">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id} className="hover:bg-transparent">
                {hg.headers.map((h) => (
                  <TableHead key={h.id} className="py-3 px-4">
                    {flexRender(h.column.columnDef.header, h.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading
              ? Array.from({ length: 6 }).map((_, i) => <TaskTableRowSkeleton key={i} />)
              : table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className="cursor-pointer hover:bg-muted/40 transition-colors"
                    onClick={() => setSelectedTask(row.original)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="py-3 px-4">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
            }
          </TableBody>
        </Table>
      </div>

      <TaskDetailSheet
        task={selectedTask}
        open={!!selectedTask}
        onOpenChange={(open) => { if (!open) setSelectedTask(null) }}
        clientMap={clientMap}
        memberMap={memberMap}
        currentUserId={currentUserId}
        canEdit={selCanEdit}
        canToggle={selCanToggle}
      />
    </>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TasksAndReminders() {
  const { setHeader } = useHeader()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const currentUserId = user?.id ?? null
  const { isOwner, canAssignTasks } = usePermissions()

  const [searchParams, setSearchParams] = useSearchParams()
  const statusTab      = searchParams.get('tab')      ?? 'ALL'
  const selectedClient = searchParams.get('client')   ?? 'all'
  const selectedPriority = searchParams.get('priority') ?? 'all'
  const assignedToMe   = searchParams.get('mine')     === '1'
  const createdByMe    = searchParams.get('creator')  === '1'
  const search         = searchParams.get('q')        ?? ''

  const [view, setView] = useState(
    () => localStorage.getItem('tasksView') || 'grid',
  )

  function setParam(key, value, defaultVal) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (value === defaultVal || value === null || value === '') next.delete(key)
      else next.set(key, String(value))
      return next
    }, { replace: true })
  }

  function setParams(updates) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === undefined || value === '') next.delete(key)
        else next.set(key, String(value))
      })
      return next
    }, { replace: true })
  }

  useEffect(() => {
    localStorage.setItem('tasksView', view)
  }, [view])

  useEffect(() => {
    setHeader({
      title: 'Tasks & Todos',
      breadcrumbs: [
        { label: 'Operations', href: '/operations' },
        { label: 'Tasks & Todos', href: '/operations/tasks' },
      ],
    })
  }, [setHeader])

  // ── Data ──────────────────────────────────────────────────────────────────

  const { data: clientsData, isLoading: isLoadingClients } = useClients()

  const allClients = useMemo(() => {
    if (!clientsData) return []
    return [
      ...(clientsData.internalAccount ? [clientsData.internalAccount] : []),
      ...clientsData.realClients,
    ]
  }, [clientsData])

  const clientMap = useMemo(() => {
    const map = Object.fromEntries(allClients.map((c) => [c.id, c]))
    map['null'] = clientsData?.internalAccount
      ? {
          ...clientsData.internalAccount,
          name: clientsData.internalAccount.name || 'Internal',
        }
      : { id: null, name: 'Internal', is_internal: true }
    return map
  }, [allClients, clientsData])

  const defaultClientId = clientsData?.internalAccount?.id ?? null

  const { data: teamMembers = [] } = useTeamMembers()
  const memberMap = useMemo(() => {
    const map = Object.fromEntries(teamMembers.map((m) => [m.member_user_id, m]))
    if (user && !map[user.id]) {
      map[user.id] = {
        member_user_id: user.id,
        full_name: user.user_metadata?.full_name || user.user_metadata?.name || null,
        email: user.email,
        avatar_url: user.user_metadata?.avatar_url || null,
      }
    }
    return map
  }, [teamMembers, user])

  const { data: fetchedTasks = [], isLoading: isLoadingTasks } = useTasks(
    assignedToMe ? { assignedToMe: true } : undefined,
  )

  const allTasks = useMemo(() => {
    if (selectedClient === 'all') return fetchedTasks
    if (selectedClient === 'internal') {
      return fetchedTasks.filter(
        (t) => !t.client_id || clientMap[t.client_id]?.is_internal === true,
      )
    }
    return fetchedTasks.filter((t) => t.client_id === selectedClient)
  }, [fetchedTasks, selectedClient, clientMap])

  // ── Filtering & Grouping ──────────────────────────────────────────────────

  const filteredTasks = useMemo(() => {
    return allTasks.filter((task) => {
      if (statusTab !== 'ALL' && task.status !== statusTab) return false
      if (selectedPriority !== 'all' && task.priority !== selectedPriority) return false
      if (createdByMe && task.created_by !== currentUserId) return false
      if (search.trim()) {
        const query = search.toLowerCase()
        if (!task.title?.toLowerCase().includes(query) && !task.description?.toLowerCase().includes(query)) return false
      }
      return true
    })
  }, [allTasks, statusTab, selectedPriority, createdByMe, currentUserId, search])

  const displayTasks = useMemo(() => sortByPriority(filteredTasks), [filteredTasks])

  const counts = useMemo(
    () =>
      STATUS_TABS.reduce((acc, tab) => {
        acc[tab.key] =
          tab.key === 'ALL'
            ? allTasks.length
            : allTasks.filter((t) => t.status === tab.key).length
        return acc
      }, {}),
    [allTasks],
  )

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-8 max-w-350 mx-auto space-y-6 animate-in fade-in duration-500">
      {/* ── Header ─────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-normal tracking-tight text-foreground bricolage">
            Tasks & Todos{' '}
            {filteredTasks.length > 0 && (
              <span className="text-muted-foreground/50 ml-2 font-extralight">
                {filteredTasks.length}
              </span>
            )}
          </h1>
          <p className="text-sm text-muted-foreground">
            All tasks and to-dos across your organization
          </p>
        </div>

        <CreateTaskDialog
          clientId={defaultClientId}
          onSuccess={() =>
            queryClient.invalidateQueries({ queryKey: ['tasks', 'list'], exact: false })
          }
        >
          <Button className="gap-2 h-9">
            <Plus size={16} />
            New Task
          </Button>
        </CreateTaskDialog>
      </div>

      <Tabs value={statusTab} onValueChange={(v) => setParam('tab', v, 'ALL')}>
        {/* ── Status Tabs ─────────────────── */}
        <TabsList className="bg-transparent h-auto w-full justify-start rounded-none p-0 gap-8 border-b border-border/40">
          {STATUS_TABS.map((tab) => (
            <TabsTrigger key={tab.key} value={tab.key} className={TAB_TRIGGER_CLASS}>
              {tab.label}
              {counts[tab.key] > 0 && (
                <span className="tabular-nums text-xs text-muted-foreground">{counts[tab.key]}</span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ── Controls Row ─────────────────── */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pt-5">
          <div className="relative w-full sm:max-w-sm group shrink-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <Input
              placeholder="Search tasks..."
              className="pl-9 h-9 bg-background border-border/60 shadow-none focus-visible:ring-1 w-full"
              value={search}
              onChange={(e) => setParam('q', e.target.value, '')}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto sm:justify-end">
            {!isOwner && (
              <button
                onClick={() => setParam('mine', assignedToMe ? null : '1', null)}
                className={cn(
                  'h-9 px-3 inline-flex items-center gap-2 rounded-md border text-xs font-medium transition-all shrink-0',
                  assignedToMe
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background text-muted-foreground hover:bg-muted/40 border-border shadow-sm',
                )}
              >
                <User className="size-3.5" />
                Assigned to me
              </button>
            )}

            {canAssignTasks && (
              <button
                onClick={() => setParam('creator', createdByMe ? null : '1', null)}
                className={cn(
                  'h-9 px-3 inline-flex items-center gap-2 rounded-md border text-xs font-medium transition-all shrink-0',
                  createdByMe
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background text-muted-foreground hover:bg-muted/40 border-border shadow-sm',
                )}
              >
                <User className="size-3.5" />
                Created by me
              </button>
            )}

            <Select
              value={selectedClient}
              onValueChange={(val) => {
                setParams({ client: val === 'all' ? '' : val, mine: '' })
              }}
            >
              <SelectTrigger className="w-44 h-9 text-xs font-semibold shadow-none bg-background">
                <div className="flex items-center gap-2 min-w-0">
                  <Filter size={14} className="shrink-0 opacity-50" />
                  <span className="truncate"><SelectValue placeholder="Client" /></span>
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Clients</SelectItem>
                <SelectItem value="internal">Internal</SelectItem>
                {clientsData?.realClients?.length > 0 && (
                  <>
                    <SelectSeparator />
                    <SelectGroup>
                      <SelectLabel className="text-[11px]">Clients</SelectLabel>
                      {clientsData.realClients.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          <div className="flex items-center gap-2">
                            <ClientAvatar client={c} size="sm" />
                            <span className="truncate">{c.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </>
                )}
              </SelectContent>
            </Select>

            <Select
              value={selectedPriority}
              onValueChange={(val) => setParam('priority', val, 'all')}
            >
              <SelectTrigger className="w-36 h-9 text-xs font-semibold shadow-none bg-background">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectSeparator />
                {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => (
                  <SelectItem key={key} value={key}>
                    <div className="flex items-center gap-2">
                      <span className={cn('size-2 rounded-full shrink-0', cfg.dot)} />
                      {cfg.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center rounded-md border bg-background shadow-sm overflow-hidden">
              <button
                onClick={() => setView('grid')}
                className={cn(
                  'h-9 w-9 flex items-center justify-center transition-colors',
                  view === 'grid' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/40',
                )}
                title="Grid view"
              >
                <LayoutGrid size={15} />
              </button>
              <button
                onClick={() => setView('kanban')}
                className={cn(
                  'h-9 w-9 flex items-center justify-center transition-colors',
                  view === 'kanban' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/40',
                )}
                title="Kanban view"
              >
                <Columns3 size={15} />
              </button>
              <button
                onClick={() => setView('table')}
                className={cn(
                  'h-9 w-9 flex items-center justify-center transition-colors',
                  view === 'table' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/40',
                )}
                title="Table view"
              >
                <List size={15} />
              </button>
            </div>
          </div>
        </div>

        {/* Tasks content */}
        {isLoadingTasks || isLoadingClients ? (
          view === 'table' ? (
            <TasksTableView tasks={[]} isLoading clientMap={{}} memberMap={{}} currentUserId={currentUserId} />
          ) : (
            <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,400px),1fr))] pt-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="rounded-xl border bg-card shadow-sm overflow-hidden">
                  <div className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-4 w-24 rounded-full" />
                      <Skeleton className="h-5 w-14 rounded-full" />
                    </div>
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                  <div className="flex items-center justify-between px-3 py-2 border-t border-border/40 bg-muted/20">
                    <Skeleton className="h-6 w-20" />
                    <Skeleton className="h-4 w-14" />
                  </div>
                </div>
              ))}
            </div>
          )
        ) : filteredTasks.length === 0 ? (
          <Empty className="py-20 border border-dashed rounded-2xl bg-muted/5 mt-6">
            <EmptyContent>
              <div className="text-4xl leading-none select-none mb-2">
                {search.trim() || statusTab !== 'ALL' || selectedClient !== 'all' || selectedPriority !== 'all' || assignedToMe ? '🔍' : '✅'}
              </div>
              <EmptyHeader>
                <EmptyTitle className="font-bold text-xl">
                  {search.trim() || statusTab !== 'ALL' || selectedClient !== 'all' || selectedPriority !== 'all' || assignedToMe
                    ? 'No tasks found'
                    : 'No tasks yet'}
                </EmptyTitle>
                <EmptyDescription className="font-normal">
                  {search.trim() || statusTab !== 'ALL' || selectedClient !== 'all' || selectedPriority !== 'all' || assignedToMe
                    ? 'No tasks match your current filters. Try adjusting your search.'
                    : 'Capture action items, reminders, and team to-dos here.'}
                </EmptyDescription>
              </EmptyHeader>
              {search.trim() || statusTab !== 'ALL' || selectedClient !== 'all' || selectedPriority !== 'all' || assignedToMe ? (
                <Button
                  variant="link"
                  onClick={() => setSearchParams({}, { replace: true })}
                  className="text-primary font-medium"
                >
                  Clear all filters
                </Button>
              ) : (
                <CreateTaskDialog
                  clientId={defaultClientId}
                  onSuccess={() =>
                    queryClient.invalidateQueries({ queryKey: ['tasks', 'list'], exact: false })
                  }
                >
                  <Button variant="outline" size="sm">
                    <Plus className="size-4 mr-2" />
                    New Task
                  </Button>
                </CreateTaskDialog>
              )}
            </EmptyContent>
          </Empty>
        ) : view === 'kanban' ? (
          <KanbanTasksView
            tasks={filteredTasks}
            clientMap={clientMap}
            memberMap={memberMap}
            currentUserId={currentUserId}
            queryClient={queryClient}
          />
        ) : view === 'table' ? (
          <TasksTableView
            tasks={displayTasks}
            isLoading={false}
            clientMap={clientMap}
            memberMap={memberMap}
            currentUserId={currentUserId}
          />
        ) : (
          <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,400px),1fr))] pt-4">
            {displayTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                clientMap={clientMap}
                memberMap={memberMap}
                currentUserId={currentUserId}
              />
            ))}
          </div>
        )}
      </Tabs>
    </div>
  )
}
