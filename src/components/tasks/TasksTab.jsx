import { useState, useMemo } from 'react'
import { Plus, ClipboardList, Search, X, Megaphone } from 'lucide-react'
import { useTasks } from '@/api/tasks'
import { useTeamMembers } from '@/api/team'
import { useClients } from '@/api/clients'
import { useCampaigns } from '@/api/campaigns'
import { useAuth } from '@/context/AuthContext'
import { usePermissions } from '@/api/usePermissions'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import CreateTaskDialog from '@/components/tasks/CreateTaskDialog'
import TaskCard, { PRIORITY_CONFIG } from '@/components/tasks/TaskCard'
import AssigneeFilterPopover from '@/components/tasks/AssigneeFilterPopover'

const STATUS_FILTERS = [
  { value: 'active',    label: 'Active' },
  { value: 'all',       label: 'All' },
  { value: 'completed', label: 'Completed' },
  { value: 'archived',  label: 'Archived' },
]

export default function TasksTab({ clientId }) {
  const { user } = useAuth()
  const { canAssignTasks } = usePermissions()

  const [statusFilter, setStatusFilter] = useState('active')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [campaignFilter, setCampaignFilter] = useState('all')
  const [selectedAssignees, setSelectedAssignees] = useState([])
  const [search, setSearch] = useState('')

  const { data: allTasks = [], isLoading } = useTasks({ clientId })
  const { data: teamMembers = [] } = useTeamMembers()
  const { data: clientsData } = useClients()
  const { data: allCampaigns = [] } = useCampaigns()

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

  const clientMap = useMemo(() => {
    const all = [
      ...(clientsData?.internalAccount ? [clientsData.internalAccount] : []),
      ...(clientsData?.realClients ?? []),
    ]
    return Object.fromEntries(all.map((c) => [String(c.id), c]))
  }, [clientsData])

  const campaignMap = useMemo(
    () => Object.fromEntries(allCampaigns.map((c) => [String(c.id), c])),
    [allCampaigns],
  )

  // Only offer campaigns actually linked to a task in view — not every campaign in the workspace
  const campaignFilterOptions = useMemo(() => {
    const seen = new Map()
    for (const t of allTasks) {
      if (t.campaign_id && !seen.has(t.campaign_id)) {
        const c = campaignMap[String(t.campaign_id)]
        if (c) seen.set(t.campaign_id, c)
      }
    }
    return Array.from(seen.values())
  }, [allTasks, campaignMap])

  const memberList = useMemo(() =>
    Object.values(memberMap).map((m) => ({
      id: m.member_user_id,
      name: m.full_name || m.email || 'Unknown',
      avatar_url: m.avatar_url || null,
    })),
  [memberMap])

  const filteredTasks = useMemo(() => {
    return allTasks.filter((t) => {
      if (statusFilter === 'active')    return t.status === 'TODO' || t.status === 'IN_PROGRESS'
      if (statusFilter === 'completed') return t.status === 'COMPLETED'
      if (statusFilter === 'archived')  return t.status === 'ARCHIVED'
      return true
    }).filter((t) => {
      if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false
      if (campaignFilter !== 'all' && t.campaign_id !== campaignFilter) return false
      if (selectedAssignees.length > 0 && !selectedAssignees.includes(t.assigned_to)) return false
      if (search.trim()) {
        const q = search.toLowerCase()
        if (!t.title?.toLowerCase().includes(q) && !t.description?.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [allTasks, statusFilter, priorityFilter, campaignFilter, selectedAssignees, search])

  const totalVisible = allTasks.filter((t) => t.status !== 'ARCHIVED').length

  const statusCounts = useMemo(() => ({
    active:    allTasks.filter((t) => t.status === 'TODO' || t.status === 'IN_PROGRESS').length,
    all:       allTasks.length,
    completed: allTasks.filter((t) => t.status === 'COMPLETED').length,
    archived:  allTasks.filter((t) => t.status === 'ARCHIVED').length,
  }), [allTasks])

  if (isLoading) {
    return (
      <div className="space-y-4 pt-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-8 w-24" />
        </div>
        <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(min(100%,420px),1fr))]">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-52 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* ── Row 1: Search (left) + priority filter + New Task (right) ── */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative w-72 group">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <Input
            placeholder="Search tasks…"
            className="pl-9 h-9 bg-background border-border/60 shadow-none focus-visible:ring-1"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setSearch('')}
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {canAssignTasks && (
            <AssigneeFilterPopover
              members={memberList}
              selected={selectedAssignees}
              onChange={setSelectedAssignees}
            />
          )}

          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="h-9 w-36 border-border/60 shadow-none">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All priorities</SelectItem>
              {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => (
                <SelectItem key={key} value={key}>
                  <span className="flex items-center gap-2">
                    <span className={cn('size-2 rounded-full shrink-0', cfg.dot)} />
                    {cfg.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {campaignFilterOptions.length > 0 && (
            <Select value={campaignFilter} onValueChange={setCampaignFilter}>
              <SelectTrigger className="h-9 w-40 border-border/60 shadow-none">
                <SelectValue placeholder="Campaign" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All campaigns</SelectItem>
                {campaignFilterOptions.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    <span className="flex items-center gap-2">
                      <Megaphone className="size-3.5 text-muted-foreground shrink-0" />
                      <span className="truncate">{c.name}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <CreateTaskDialog clientId={clientId} lockClient={true}>
            <Button className="gap-1.5">
              <Plus className="size-4" />
              New Task
            </Button>
          </CreateTaskDialog>
        </div>
      </div>

      {/* ── Row 2: Status pills + task count ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          {STATUS_FILTERS.map((f) => {
            const count = statusCounts[f.value]
            const isActive = statusFilter === f.value
            return (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                  isActive
                    ? 'bg-foreground text-background border-foreground'
                    : 'bg-transparent text-muted-foreground border-border/60 hover:text-foreground hover:border-border'
                }`}
              >
                {f.label}
                {count > 0 && (
                  <span className={`text-[11px] font-semibold tabular-nums ${isActive ? 'text-background/70' : 'text-muted-foreground'}`}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">
          {totalVisible} task{totalVisible !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ── Grid ── */}
      {filteredTasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-14 gap-2">
          <div className="h-10 w-10 border border-dashed rounded-full flex items-center justify-center text-muted-foreground">
            <ClipboardList className="h-4 w-4 opacity-50" />
          </div>
          <p className="text-base font-normal text-foreground bricolage">
            {allTasks.length === 0 ? 'No tasks yet' : 'No tasks match these filters'}
          </p>
          <p className="text-xs text-muted-foreground/70">
            {allTasks.length === 0
              ? 'Create a task to track work for this client.'
              : 'Try adjusting your search or filters.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(min(100%,420px),1fr))]">
          {filteredTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              clientMap={clientMap}
              campaignMap={campaignMap}
              memberMap={memberMap}
              currentUserId={user?.id}
            />
          ))}
        </div>
      )}
    </div>
  )
}
