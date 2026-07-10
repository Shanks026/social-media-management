import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus, Search, X, CalendarDays } from 'lucide-react'
import { isPast } from 'date-fns'
import { fetchMeetings, fetchCampaignMeetings } from '@/api/meetings'
import { useClients } from '@/api/clients'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import CreateMeetingDialog from '@/components/CreateMeetingDialog'
import MeetingCard from '@/components/meetings/MeetingCard'

const STATUS_FILTERS = [
  { value: 'all',       label: 'All' },
  { value: 'upcoming',  label: 'Upcoming' },
  { value: 'past',      label: 'Missed' },
  { value: 'completed', label: 'Completed' },
]

function statusOf(meeting) {
  if (meeting.completed_at) return 'completed'
  if (isPast(new Date(meeting.datetime))) return 'past'
  return 'upcoming'
}

/**
 * Reusable meetings list with search + status filters and a grouped card grid.
 * Pass `campaignId` to scope to a campaign, or `clientId` for a single client;
 * with neither it shows nothing meaningful, so always pass one.
 */
export default function MeetingsTab({ clientId, campaignId, campaignName }) {
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')

  const queryKey = campaignId
    ? ['campaign-meetings', campaignId]
    : ['meetings', clientId]

  const { data: allMeetings = [], isLoading } = useQuery({
    queryKey,
    queryFn: () =>
      campaignId
        ? fetchCampaignMeetings(campaignId)
        : fetchMeetings({ clientId }),
    enabled: !!campaignId || !!clientId,
  })

  const { data: clientsData } = useClients()
  const clientMap = useMemo(() => {
    const all = [
      ...(clientsData?.internalAccount ? [clientsData.internalAccount] : []),
      ...(clientsData?.realClients ?? []),
    ]
    return Object.fromEntries(all.map((c) => [c.id, c]))
  }, [clientsData])

  const filteredMeetings = useMemo(() => {
    return allMeetings.filter((m) => {
      if (statusFilter !== 'all' && statusOf(m) !== statusFilter) return false
      if (search.trim()) {
        const q = search.toLowerCase()
        if (!m.title?.toLowerCase().includes(q) && !m.notes?.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [allMeetings, statusFilter, search])

  const groups = useMemo(() => {
    const upcoming = []
    const past = []
    const completed = []
    filteredMeetings.forEach((m) => {
      const s = statusOf(m)
      if (s === 'completed') completed.push(m)
      else if (s === 'past') past.push(m)
      else upcoming.push(m)
    })
    upcoming.sort((a, b) => new Date(a.datetime) - new Date(b.datetime))
    past.sort((a, b) => new Date(b.datetime) - new Date(a.datetime))
    completed.sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at))
    return { upcoming, past, completed }
  }, [filteredMeetings])

  const statusCounts = useMemo(() => {
    const c = { all: allMeetings.length, upcoming: 0, past: 0, completed: 0 }
    allMeetings.forEach((m) => { c[statusOf(m)] += 1 })
    return c
  }, [allMeetings])

  if (isLoading) {
    return (
      <div className="space-y-4 pt-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-9 w-72" />
          <Skeleton className="h-9 w-36" />
        </div>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-52 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  const sections = [
    { key: 'upcoming',  label: 'Upcoming',  items: groups.upcoming },
    { key: 'past',      label: 'Missed',    items: groups.past },
    { key: 'completed', label: 'Completed', items: groups.completed },
  ].filter((s) => (statusFilter === 'all' || statusFilter === s.key) && s.items.length > 0)

  return (
    <div className="space-y-5">
      {/* ── Row 1: Search (left) + Schedule Meeting (right) ── */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="relative w-full lg:w-72 group shrink-0">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <Input
            placeholder="Search meetings…"
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

        <CreateMeetingDialog
          defaultClientId={clientId}
          lockClient={true}
          campaignId={campaignId}
          campaignName={campaignName}
        >
          <Button className="gap-1.5">
            <Plus className="size-4" />
            Schedule Meeting
          </Button>
        </CreateMeetingDialog>
      </div>

      {/* ── Row 2: Status pills + count ── */}
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
          {filteredMeetings.length} meeting{filteredMeetings.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ── Grouped grid ── */}
      {filteredMeetings.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-14 gap-2">
          <div className="h-10 w-10 border border-dashed rounded-full flex items-center justify-center text-muted-foreground">
            <CalendarDays className="h-4 w-4 opacity-50" />
          </div>
          <p className="text-base font-normal text-foreground bricolage">
            {allMeetings.length === 0 ? 'No meetings yet' : 'No meetings match these filters'}
          </p>
          <p className="text-xs text-muted-foreground/70">
            {allMeetings.length === 0
              ? `Schedule a meeting to track calls for this ${campaignId ? 'campaign' : 'client'}.`
              : 'Try adjusting your search or filters.'}
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {sections.map((section) => (
            <div key={section.key} className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {section.label} · {section.items.length}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {section.items.map((meeting) => (
                  <MeetingCard key={meeting.id} meeting={meeting} clientMap={clientMap} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
