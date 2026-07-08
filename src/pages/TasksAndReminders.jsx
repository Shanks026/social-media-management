import { useState, useMemo, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
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
  Megaphone,
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
import { useCampaigns } from '@/api/campaigns'
import { useTasks, updateTaskStatus } from '@/api/tasks'
import { useTeamMembers, useRemovedMembers } from '@/api/team'
import { usePermissions } from '@/api/usePermissions'
import CreateTaskDialog from '@/components/tasks/CreateTaskDialog'
import EditTaskDialog from '@/components/tasks/EditTaskDialog'
import { ClientAvatar } from '@/components/tasks/ClientAvatar'
import TaskCard, { TaskDetailSheet, STATUS_CONFIG, PRIORITY_CONFIG, STATUS_DOT } from '@/components/tasks/TaskCard'
import AssigneeFilterPopover from '@/components/tasks/AssigneeFilterPopover'
import { cn } from '@/lib/utils'
import {
  Empty,
  EmptyContent,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from '@/components/ui/empty'

// --- Constants ---

const STATUS_TABS = [
  { key: 'ALL', label: 'All' },
  { key: 'TODO', label: 'To Do' },
  { key: 'IN_PROGRESS', label: 'In Progress' },
  { key: 'COMPLETED', label: 'Completed' },
  { key: 'ARCHIVED', label: 'Archived' },
]

const PRIORITY_DOT = Object.fromEntries(Object.entries(PRIORITY_CONFIG).map(([k, v]) => [k, v.dot]))
const PRIORITY_LABELS = Object.fromEntries(Object.entries(PRIORITY_CONFIG).map(([k, v]) => [k, v.label]))

const TAB_TRIGGER_CLASS =
  'relative rounded-none bg-transparent px-0 pb-3 pt-0 text-sm font-medium transition-none shadow-none border-b-2 border-transparent text-muted-foreground flex-none w-fit gap-2 data-[state=active]:bg-transparent dark:data-[state=active]:bg-transparent data-[state=active]:text-black dark:data-[state=active]:text-white data-[state=active]:border-black dark:data-[state=active]:border-white data-[state=active]:shadow-none data-[state=active]:border-x-0 data-[state=active]:border-t-0 focus-visible:ring-0'

// The canonical key for the global tasks list — used for optimistic updates in kanban
const GLOBAL_TASKS_QK = ['tasks', 'list', { clientId: null, campaignId: null }]

// --- Helpers ---

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


function TasksGroup({ title, tasks, clientMap, campaignMap, memberMap, currentUserId }) {
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
            campaignMap={campaignMap}
            memberMap={memberMap}
            currentUserId={currentUserId}
          />
        ))}
      </div>
    </div>
  )
}

// --- Kanban: Draggable Card Wrapper ---

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

// --- Kanban: Column ---

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

// --- Kanban View ---

function KanbanTasksView({ tasks, clientMap, campaignMap, memberMap, currentUserId, queryClient }) {
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
              <TaskCard task={task} clientMap={clientMap} campaignMap={campaignMap} memberMap={memberMap} currentUserId={currentUserId} />
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
              <TaskCard task={task} clientMap={clientMap} campaignMap={campaignMap} memberMap={memberMap} currentUserId={currentUserId} />
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
              <TaskCard task={task} clientMap={clientMap} campaignMap={campaignMap} memberMap={memberMap} currentUserId={currentUserId} />
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
              <TaskCard task={task} clientMap={clientMap} campaignMap={campaignMap} memberMap={memberMap} currentUserId={currentUserId} />
            </DraggableCard>
          ))}
        </KanbanColumn>
      </div>
    </DndContext>
  )
}

// --- Tasks Table View ---â"€â"€

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

function TasksTableView({ tasks, isLoading, clientMap, campaignMap, memberMap, currentUserId }) {
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
          <div className={cn('flex items-center gap-2 min-w-0', assignee._removed && 'opacity-60')}>
            {assignee.avatar_url ? (
              <img
                src={assignee.avatar_url}
                alt=""
                className={cn('size-6 rounded-full object-cover shrink-0 ring-1 ring-border', assignee._removed && 'grayscale')}
              />
            ) : (
              <div
                className={cn(
                  'size-6 rounded-full flex items-center justify-center text-[9px] font-semibold shrink-0 ring-1 ring-border',
                  assignee._removed ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary',
                )}
              >
                {(assignee.full_name || assignee.email || '?')[0].toUpperCase()}
              </div>
            )}
            <span className="text-sm truncate max-w-32">
              {assignee.full_name || assignee.email}
              {assignee._removed && <span className="text-muted-foreground ml-1">(Removed)</span>}
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
        if (!client)
          return <span className="text-sm text-muted-foreground">General (no client)</span>
        return (
          <div className="flex items-center gap-2 min-w-0">
            <ClientAvatar client={client} size="sm" />
            <span className="text-sm truncate max-w-32">{client.name}</span>
          </div>
        )
      },
    }),
    taskCol.accessor('campaign_id', {
      id: 'campaign',
      header: () => <ColHeader label="Campaign" />,
      enableSorting: false,
      cell: ({ getValue }) => {
        const campaign = getValue() ? campaignMap[String(getValue())] : null
        if (!campaign) return <span className="text-xs text-muted-foreground">—</span>
        return (
          <div className="flex items-center gap-1.5 min-w-0">
            <Megaphone className="size-3.5 text-muted-foreground shrink-0" />
            <span className="text-sm truncate max-w-32">{campaign.name}</span>
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
  ], [clientMap, campaignMap, memberMap, currentUserId])

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
        campaignMap={campaignMap}
        memberMap={memberMap}
        currentUserId={currentUserId}
        canEdit={selCanEdit}
        canToggle={selCanToggle}
      />
    </>
  )
}

// --- Main Page ---

export default function TasksAndReminders() {
  const { setHeader } = useHeader()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const currentUserId = user?.id ?? null
  const { canAssignTasks, isOwner } = usePermissions()

  const [searchParams, setSearchParams] = useSearchParams()
  const statusTab        = searchParams.get('tab')       ?? 'ALL'
  const selectedClient   = searchParams.get('client')    ?? 'all'
  const selectedPriority = searchParams.get('priority')  ?? 'all'
  const assignedToMe     = searchParams.get('mine')      === '1'
  const createdByMe      = searchParams.get('creator')   === '1'
  const search           = searchParams.get('q')         ?? ''
  const selectedAssignees = useMemo(() => {
    const raw = searchParams.get('assignees') ?? ''
    return raw ? raw.split(',').filter(Boolean) : []
  }, [searchParams])

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
      breadcrumbs: [{ label: 'Tasks & Todos' }],
    })
  }, [setHeader])

  // -- Data --

  const { data: clientsData, isLoading: isLoadingClients } = useClients()

  const allClients = useMemo(() => {
    if (!clientsData) return []
    return [
      ...(clientsData.internalAccount ? [clientsData.internalAccount] : []),
      ...clientsData.realClients,
    ]
  }, [clientsData])

  // Keyed by real client id only. A null client_id ("General / no client") must
  // NOT resolve to the internal account — TaskCard renders "General (no client)"
  // when the lookup misses.
  const clientMap = useMemo(
    () => Object.fromEntries(allClients.map((c) => [String(c.id), c])),
    [allClients],
  )

  const { data: allCampaigns = [] } = useCampaigns()
  const campaignMap = useMemo(
    () => Object.fromEntries(allCampaigns.map((c) => [String(c.id), c])),
    [allCampaigns],
  )

  // New tasks default to "General (no client)" rather than the internal
  // account — CreateTaskDialog treats a null/empty clientId as General.
  const defaultClientId = null

  const { data: teamMembers = [] } = useTeamMembers()
  const { data: removedMembers = [] } = useRemovedMembers()
  // Removed members are merged in (flagged _removed) purely so an existing
  // assignment/creation still resolves to a name instead of vanishing once
  // someone leaves the workspace — never offered as assignable options.
  const memberMap = useMemo(() => {
    const map = Object.fromEntries(teamMembers.map((m) => [m.member_user_id, m]))
    removedMembers.forEach((m) => {
      if (!map[m.member_user_id]) map[m.member_user_id] = { ...m, _removed: true }
    })
    if (user && !map[user.id]) {
      map[user.id] = {
        member_user_id: user.id,
        full_name: user.user_metadata?.full_name || user.user_metadata?.name || null,
        email: user.email,
        avatar_url: user.user_metadata?.avatar_url || null,
      }
    }
    return map
  }, [teamMembers, removedMembers, user])

  const memberList = useMemo(() =>
    Object.values(memberMap).map((m) => ({
      id: m.member_user_id,
      name: m.full_name || m.email || 'Unknown',
      avatar_url: m.avatar_url || null,
    })),
  [memberMap])

  const { data: fetchedTasks = [], isLoading: isLoadingTasks } = useTasks()

  // Deep-link from a chat/notification reference (?task=<id>) — opens the
  // sheet regardless of which view (grid/table/kanban) or filters are active,
  // and independent of each view's own local selection state. Looks up
  // against the unfiltered list so a deep link still works even if the
  // task's status/client is hidden by the current filter selection.
  const deepLinkedTaskId = searchParams.get('task')
  const deepLinkedTask = useMemo(
    () => (deepLinkedTaskId ? fetchedTasks.find((t) => t.id === deepLinkedTaskId) ?? null : null),
    [fetchedTasks, deepLinkedTaskId],
  )
  const deepLinkCanEdit = deepLinkedTask ? (isOwner || deepLinkedTask.created_by === currentUserId) : false
  const deepLinkCanToggle = deepLinkedTask
    ? (isOwner || deepLinkedTask.created_by === currentUserId || deepLinkedTask.assigned_to === currentUserId)
    : false

  const allTasks = useMemo(() => {
    if (selectedClient === 'all') return fetchedTasks
    // General = no client at all; Internal = the internal-account client (real id).
    // These are distinct buckets — a null client_id is not "internal work".
    if (selectedClient === 'general') {
      return fetchedTasks.filter((t) => !t.client_id)
    }
    if (selectedClient === 'internal') {
      return fetchedTasks.filter(
        (t) => t.client_id && clientMap[t.client_id]?.is_internal === true,
      )
    }
    return fetchedTasks.filter((t) => t.client_id === selectedClient)
  }, [fetchedTasks, selectedClient, clientMap])

  // -- Filtering & Grouping --

  const filteredTasks = useMemo(() => {
    return allTasks.filter((task) => {
      if (statusTab !== 'ALL' && task.status !== statusTab) return false
      if (selectedPriority !== 'all' && task.priority !== selectedPriority) return false
      if (selectedAssignees.length > 0 && !selectedAssignees.includes(task.assigned_to)) return false
      if (assignedToMe && task.assigned_to !== currentUserId) return false
      if (createdByMe && task.created_by !== currentUserId) return false
      if (search.trim()) {
        const query = search.toLowerCase()
        if (!task.title?.toLowerCase().includes(query) && !task.description?.toLowerCase().includes(query)) return false
      }
      return true
    })
  }, [allTasks, statusTab, selectedPriority, selectedAssignees, assignedToMe, createdByMe, currentUserId, search])

  const displayTasks = filteredTasks

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

  // -- Render --

  return (
    <div className="p-8 max-w-350 mx-auto space-y-6 animate-in fade-in duration-500">
      {/* Header */}
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
        {/* â"€â"€ Status Tabs â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ */}
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

        {/* Controls Row */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 pt-5">
          <div className="relative w-full lg:max-w-sm group shrink-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <Input
              placeholder="Search tasks..."
              className="pl-9 h-9 bg-background border-border/60 shadow-none focus-visible:ring-1 w-full"
              value={search}
              onChange={(e) => setParam('q', e.target.value, '')}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            {!isOwner && (
              <Button
                variant={assignedToMe ? 'default' : 'outline'}
                onClick={() => setParam('mine', assignedToMe ? null : '1', null)}
                className="gap-2 shadow-none font-normal h-9 shrink-0"
              >
                <User className="size-3.5" />
                Assigned to me
              </Button>
            )}

            <Button
              variant={createdByMe ? 'default' : 'outline'}
              onClick={() => setParam('creator', createdByMe ? null : '1', null)}
              className="gap-2 shadow-none font-normal h-9 shrink-0"
            >
              <User className="size-3.5" />
              Created by me
            </Button>

            {canAssignTasks && (
              <AssigneeFilterPopover
                members={memberList}
                selected={selectedAssignees}
                onChange={(ids) => setParam('assignees', ids.join(','), '')}
              />
            )}

            <Select
              value={selectedClient}
              onValueChange={(val) => setParams({ client: val === 'all' ? '' : val, mine: '' })}
            >
              <SelectTrigger className="w-40 h-9 shadow-none bg-background font-normal shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <Filter size={14} className="shrink-0 opacity-50" />
                  <span className="truncate"><SelectValue placeholder="Client" /></span>
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Clients</SelectItem>
                <SelectItem value="general">General (no client)</SelectItem>
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
              <SelectTrigger className="w-36 h-9 shadow-none bg-background font-normal shrink-0">
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

            {/* View toggle — pushed to end */}
            <div className="flex items-center rounded-md border bg-background shadow-sm overflow-hidden shrink-0">
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
                {search.trim() || statusTab !== 'ALL' || selectedClient !== 'all' || selectedPriority !== 'all' || selectedAssignees.length > 0 || assignedToMe || createdByMe ? '🔍' : '✅'}
              </div>
              <EmptyHeader>
                <EmptyTitle className="font-bold text-xl">
                  {search.trim() || statusTab !== 'ALL' || selectedClient !== 'all' || selectedPriority !== 'all' || selectedAssignees.length > 0 || assignedToMe || createdByMe
                    ? 'No tasks found'
                    : 'No tasks yet'}
                </EmptyTitle>
                <EmptyDescription className="font-normal">
                  {search.trim() || statusTab !== 'ALL' || selectedClient !== 'all' || selectedPriority !== 'all' || selectedAssignees.length > 0 || assignedToMe || createdByMe
                    ? 'No tasks match your current filters. Try adjusting your search.'
                    : 'Capture action items, reminders, and team to-dos here.'}
                </EmptyDescription>
              </EmptyHeader>
              {search.trim() || statusTab !== 'ALL' || selectedClient !== 'all' || selectedPriority !== 'all' || selectedAssignees.length > 0 || assignedToMe || createdByMe ? (
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
            campaignMap={campaignMap}
            memberMap={memberMap}
            currentUserId={currentUserId}
            queryClient={queryClient}
          />
        ) : view === 'table' ? (
          <TasksTableView
            tasks={displayTasks}
            isLoading={false}
            clientMap={clientMap}
            campaignMap={campaignMap}
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
                campaignMap={campaignMap}
                memberMap={memberMap}
                currentUserId={currentUserId}
              />
            ))}
          </div>
        )}
      </Tabs>

      <TaskDetailSheet
        task={deepLinkedTask}
        open={!!deepLinkedTask}
        onOpenChange={(open) => { if (!open) setParam('task', null) }}
        clientMap={clientMap}
        campaignMap={campaignMap}
        memberMap={memberMap}
        currentUserId={currentUserId}
        canEdit={deepLinkCanEdit}
        canToggle={deepLinkCanToggle}
      />
    </div>
  )
}
