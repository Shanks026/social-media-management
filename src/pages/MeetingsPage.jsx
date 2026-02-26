import { useState, useMemo, useEffect } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import {
  Calendar,
  Plus,
  Filter,
  Users,
  Clock,
  Pencil,
  Trash2,
  Search,
} from 'lucide-react'
import { format, isPast } from 'date-fns'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
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

import { useHeader } from '@/components/misc/header-context'
import { useClients } from '@/api/clients'
import { fetchMeetings, deleteMeeting } from '@/api/meetings'
import CreateMeetingDialog from '@/components/CreateMeetingDialog'
import { ClientAvatar } from '@/components/NoteRow'
import { cn } from '@/lib/utils'

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_TABS = [
  { key: 'ALL', label: 'All' },
  { key: 'UPCOMING', label: 'Upcoming' },
  { key: 'PAST', label: 'Past' },
]

// ─── Meeting Card ──────────────────────────────────────────────────────────────

function MeetingCard({ meeting, clientMap }) {
  const queryClient = useQueryClient()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['global-meetings'] })
    queryClient.invalidateQueries({
      queryKey: ['meetings'],
    })
  }

  const { mutate: remove, isPending: isDeleting } = useMutation({
    mutationFn: () => deleteMeeting(meeting.id),
    onSuccess: () => {
      invalidate()
      toast.success('Meeting deleted')
    },
    onError: (err) => toast.error('Failed to delete meeting: ' + err.message),
  })

  const isBusy = isDeleting
  const isMeetingPast = isPast(new Date(meeting.datetime))
  const client = clientMap[meeting.client_id]

  return (
    <>
      <div
        className={cn(
          'flex flex-col rounded-xl border bg-card shadow-sm ring-1 ring-border/50 overflow-hidden',
          isMeetingPast && 'opacity-60',
        )}
      >
        {/* ── Row 1: Client + Status badge ── */}
        <div className="flex items-center justify-between gap-2 px-4 pt-4">
          {client ? (
            <div className="flex items-center gap-1.5 min-w-0">
              <ClientAvatar client={client} size="sm" />
              <span className="text-[11px] text-muted-foreground font-medium truncate max-w-[120px]">
                {client.name}
              </span>
              {client.is_internal && (
                <Badge
                  variant="secondary"
                  className="text-[9px] px-1 py-0 shrink-0"
                >
                  INT
                </Badge>
              )}
            </div>
          ) : (
            <div />
          )}
          <Badge
            variant="outline"
            className={cn(
              'text-[10px] px-2 py-0.5 shrink-0 font-semibold border-transparent',
              isMeetingPast 
                ? 'bg-muted text-muted-foreground'
                : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
            )}
          >
            {isMeetingPast ? 'Past' : 'Upcoming'}
          </Badge>
        </div>

        {/* ── Row 2: Title ── */}
        <div className="flex items-start gap-2.5 px-4 pt-3">
          <p
            className={cn(
              'text-sm font-semibold leading-snug line-clamp-2',
              isMeetingPast && 'text-muted-foreground',
            )}
          >
            {meeting.title}
          </p>
        </div>

        {/* ── Row 3: Subtitle/Notes ── */}
        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed px-4 pt-2 min-h-10">
          {meeting.notes || '—'}
        </p>

        {/* ── Row 4: Date/Time ── */}
        <div
          className={cn(
            'flex items-center gap-1.5 text-[11px] font-medium px-4 pt-2 pb-3 text-muted-foreground',
          )}
        >
          <Clock className="size-3 shrink-0" />
          {format(new Date(meeting.datetime), 'MMM d, yyyy h:mm a')}
        </div>

        {/* ── Row 5: Actions ── */}
        <div className="flex items-center gap-1 px-3 py-2 border-t border-border/40 bg-muted/20">
          <div className="flex-1" />

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

      <CreateMeetingDialog
        editMeeting={meeting}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSuccess={invalidate}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete meeting?</AlertDialogTitle>
            <AlertDialogDescription>
              "{meeting.title}" will be permanently deleted. This cannot be undone.
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

// ─── Meetings Grid Group ───────────────────────────────────────────────────────

function MeetingsGroup({ title, meetings, clientMap }) {
  if (meetings.length === 0) return null
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        {title}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {meetings.map((meeting) => (
          <MeetingCard key={meeting.id} meeting={meeting} clientMap={clientMap} />
        ))}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MeetingsPage() {
  const { setHeader } = useHeader()
  const queryClient = useQueryClient()

  const [statusTab, setStatusTab] = useState('ALL')
  const [selectedClient, setSelectedClient] = useState('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    setHeader({
      title: 'Meetings',
      breadcrumbs: [
        { label: 'Operations', href: '/operations' },
        { label: 'Meetings', href: '/operations/meetings' },
      ],
    })
  }, [setHeader])

  // ── Data ──────────────────────────────────────────────────────────────────

  const { data: clientsData, isLoading: isLoadingClients } = useClients()

 const allClients = useMemo(() => {
    if (!clientsData) return []
    return clientsData.realClients || []
  }, [clientsData])

  const clientMap = useMemo(
    () => Object.fromEntries(allClients.map((c) => [c.id, c])),
    [allClients],
  )

  const defaultClientId = clientsData?.internalAccount?.id ?? null

 const { data: allMeetings = [], isLoading: isLoadingMeetings } = useQuery({
    queryKey: ['global-meetings', selectedClient],
    queryFn: async () => {
      return await fetchMeetings(selectedClient !== 'all' ? { clientId: selectedClient } : {})
    },
  })
  // ── Filtering & Grouping ──────────────────────────────────────────────────

  const filteredMeetings = useMemo(() => {
    return allMeetings.filter((meeting) => {
      const isMeetingPast = isPast(new Date(meeting.datetime))
      if (statusTab === 'UPCOMING' && isMeetingPast) return false
      if (statusTab === 'PAST' && !isMeetingPast) return false

      if (search.trim()) {
        const query = search.toLowerCase()
        const matchesTitle = meeting.title?.toLowerCase().includes(query)
        const matchesNotes = meeting.notes?.toLowerCase().includes(query)
        if (!matchesTitle && !matchesNotes) return false
      }

      return true
    })
  }, [allMeetings, statusTab, search])

  const { upcomingMeetings, pastMeetings } = useMemo(() => {
    const upcoming = []
    const past = []

    filteredMeetings.forEach((meeting) => {
      if (isPast(new Date(meeting.datetime))) {
        past.push(meeting)
      } else {
        upcoming.push(meeting)
      }
    })

    // Sort upcoming ascending (closest first)
    upcoming.sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime())
    // Sort past descending (most recent first)
    past.sort((a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime())

    return { upcomingMeetings: upcoming, pastMeetings: past }
  }, [filteredMeetings])

  const counts = useMemo(() => {
    let upcoming = 0
    let past = 0
    allMeetings.forEach((meeting) => {
      if (isPast(new Date(meeting.datetime))) past++
      else upcoming++
    })
    return {
      ALL: allMeetings.length,
      UPCOMING: upcoming,
      PAST: past,
    }
  }, [allMeetings])

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-8 max-w-[1440px] mx-auto space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-normal tracking-tight text-foreground">
          Meetings
        </h1>
        <p className="text-sm text-muted-foreground">
          All meetings across your organization
        </p>
      </div>

      {/* ── Controls Row ── */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        {/* Search */}
        <div className="relative w-full lg:max-w-sm group shrink-0">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <Input
            placeholder="Search meetings..."
            className="pl-9 h-9 bg-background border-border/60 shadow-none focus-visible:ring-1 w-full"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Filters and Actions */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto lg:justify-end">
          {/* Status Tabs */}
          <div className="flex items-center gap-1 rounded-md border p-0.5 bg-background shadow-sm w-full sm:w-auto overflow-x-auto">
            {STATUS_TABS.map((tab) => {
              const isActive = statusTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setStatusTab(tab.key)}
                  className={cn(
                    'h-8 px-3 py-1 inline-flex items-center justify-center gap-2 rounded-sm text-xs font-medium transition-all flex-1 sm:flex-none whitespace-nowrap',
                    isActive
                      ? 'bg-muted shadow-inner text-foreground'
                      : 'text-muted-foreground hover:bg-muted/40'
                  )}
                >
                  <span>{tab.label}</span>
                  {counts[tab.key] > 0 && (
                    <span className={cn(
                      'text-[10px] px-1.5 py-0.5 rounded-full font-bold min-w-5 text-center',
                      isActive ? 'bg-background text-foreground' : 'bg-muted text-muted-foreground'
                    )}>
                      {counts[tab.key]}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Client Select: Now Responsive */}
       <Select value={selectedClient} onValueChange={setSelectedClient}>
  <SelectTrigger className="w-full sm:w-[200px] h-9 text-xs font-semibold shadow-none bg-background overflow-hidden">
    <div className="flex items-center gap-2 min-w-0 w-full">
      <Filter size={14} className="shrink-0 opacity-50" />
      <span className="truncate flex-1 text-left">
        <SelectValue placeholder="Filter by Client" />
      </span>
    </div>
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="all">All Clients</SelectItem>
    {allClients.map((c) => (
      <SelectItem key={c.id} value={c.id}>
        <div className="flex items-center gap-2">
          <ClientAvatar client={c} size="sm" />
          <span className="truncate">{c.name}</span>
        </div>
      </SelectItem>
    ))}
  </SelectContent>
</Select>

          {/* Create Button */}
          <CreateMeetingDialog
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['global-meetings'] })
              queryClient.invalidateQueries({ queryKey: ['meetings'] })
            }}
          >
            <Button className="w-full sm:w-auto gap-2 h-9 text-xs">
              <Plus size={16} />
              Schedule Meeting
            </Button>
          </CreateMeetingDialog>
        </div>
      </div>

      {/* Meetings grid */}
      {isLoadingMeetings || isLoadingClients ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="rounded-xl border bg-card shadow-sm overflow-hidden"
            >
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-24 rounded-full" />
                  <Skeleton className="h-5 w-14 rounded-full" />
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-3/4" />
                </div>
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
              <div className="flex items-center justify-between px-3 py-2 border-t border-border/40 bg-muted/20">
                <div className="flex-1" />
                <div className="flex gap-1">
                  <Skeleton className="size-7 rounded-md" />
                  <Skeleton className="size-7 rounded-md" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filteredMeetings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
          <div className="size-14 rounded-2xl border border-dashed flex items-center justify-center text-muted-foreground">
            <Calendar className="size-6 opacity-40" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">
            No meetings found
          </p>
          <p className="text-xs text-muted-foreground/70 max-w-xs">
            Schedule a new meeting or adjust your filters.
          </p>
        </div>
      ) : (
        <div className="space-y-8 pt-1">
          {(statusTab === 'ALL' || statusTab === 'UPCOMING') &&
            upcomingMeetings.length > 0 && (
              <MeetingsGroup
                title={`Upcoming · ${upcomingMeetings.length}`}
                meetings={upcomingMeetings}
                clientMap={clientMap}
              />
            )}
          {(statusTab === 'ALL' || statusTab === 'PAST') &&
            pastMeetings.length > 0 && (
              <MeetingsGroup
                title={`Past · ${pastMeetings.length}`}
                meetings={pastMeetings}
                clientMap={clientMap}
              />
            )}
        </div>
      )}
    </div>
  )
}
