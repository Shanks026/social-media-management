import { useState, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { format } from 'date-fns'
import { Search, X, FilterX, CalendarIcon } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { CalendarPostCard } from './CalendarPostCard'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyMedia,
} from '@/components/ui/empty'
import MeetingRow from '@/components/MeetingRow'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { deleteMeeting } from '@/api/meetings'
import { toast } from 'sonner'
import { getPublishState } from '@/lib/helper'

const STATUS_STATS_CONFIG = [
  { id: 'DRAFT', label: 'Draft', color: 'bg-blue-600' },
  { id: 'PENDING_APPROVAL', label: 'Pending', color: 'bg-orange-600' },
  { id: 'NEEDS_REVISION', label: 'Revisions', color: 'bg-pink-600' },
  { id: 'SCHEDULED', label: 'Scheduled', color: 'bg-purple-600' },
  { id: 'PUBLISHED', label: 'Published', color: 'bg-emerald-600' },
  { id: 'PARTIALLY_PUBLISHED', label: 'Partially Published', color: 'bg-lime-600' },
]

export function DayDetailDialog({ date, posts = [], open, onOpenChange }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [clientFilter, setClientFilter] = useState('all')
  const [activeTab, setActiveTab] = useState('posts')
  const queryClient = useQueryClient()

  const regularPosts = useMemo(() => posts.filter((p) => !p.isMeeting), [posts])
  const meetings = useMemo(() => posts.filter((p) => p.isMeeting), [posts])

  // Build a lightweight clientsMap from meeting data already present
  const clientsMap = useMemo(() =>
    meetings.reduce((acc, m) => {
      if (m.client_id && !acc[m.client_id]) {
        acc[m.client_id] = {
          id: m.client_id,
          name: m.client_name || 'Unknown',
          logo_url: null,
          is_internal: false,
        }
      }
      return acc
    }, {}),
    [meetings],
  )

  const { mutate: markMeetingDone, isPending: isCompletingMeeting } = useMutation({
    mutationFn: (meetingId) => deleteMeeting(meetingId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meetings'] })
      toast.success('Meeting marked as done')
    },
    onError: (err) => toast.error('Failed to update meeting: ' + err.message),
  })

  const uniqueClients = useMemo(() => {
    const clients = regularPosts.map((p) => p.client_name)
    return [...new Set(clients)].sort()
  }, [regularPosts])

  const filteredPosts = useMemo(() => {
    return regularPosts.filter((post) => {
      const pStatus = getPublishState(post) || 'DRAFT'
      const matchesSearch = post.title?.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesStatus = statusFilter === 'all' || pStatus === statusFilter
      const matchesClient = clientFilter === 'all' || post.client_name === clientFilter
      return matchesSearch && matchesStatus && matchesClient
    })
  }, [regularPosts, searchQuery, statusFilter, clientFilter])

  const stats = useMemo(() => {
    return regularPosts.reduce((acc, post) => {
      const pStatus = getPublishState(post) || 'DRAFT'
      acc[pStatus] = (acc[pStatus] || 0) + 1
      return acc
    }, {})
  }, [regularPosts])

  const isFiltered = searchQuery !== '' || statusFilter !== 'all' || clientFilter !== 'all'

  const resetFilters = () => {
    setSearchQuery('')
    setStatusFilter('all')
    setClientFilter('all')
  }

  if (!date) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] sm:max-w-none h-[90vh] p-0 overflow-hidden flex flex-col border-none shadow-2xl bg-background">

        {/* Title */}
        <div className="pt-8 px-8 pb-0 shrink-0">
          <DialogHeader className="p-0">
            <DialogTitle className="text-3xl font-bold tracking-tight text-foreground">
              {format(date, 'EEEE, MMMM do')}
            </DialogTitle>
          </DialogHeader>
        </div>

        {/* Tabs fill remaining height */}
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex flex-col flex-1 overflow-hidden min-h-0"
        >
          {/* Tab bar + filter controls */}
          <div className="px-8 pt-4 pb-0 shrink-0">
            <div className="flex items-center justify-between gap-4 pb-4">
              <TabsList className="h-9">
                <TabsTrigger value="posts" className="gap-2 text-xs">
                  Posts
                  {regularPosts.length > 0 && (
                    <Badge variant="secondary" className="h-4 min-w-4 px-1.5 text-[10px] font-bold">
                      {regularPosts.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="meetings" className="gap-2 text-xs">
                  Meetings
                  {meetings.length > 0 && (
                    <Badge variant="secondary" className="h-4 min-w-4 px-1.5 text-[10px] font-bold">
                      {meetings.length}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              {activeTab === 'posts' && (
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                      placeholder="Search posts..."
                      className="pl-9 h-9 w-52"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <Select value={clientFilter} onValueChange={setClientFilter}>
                    <SelectTrigger className="w-36 h-9">
                      <SelectValue placeholder="All Clients" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Clients</SelectItem>
                      {uniqueClients.map((name) => (
                        <SelectItem key={name} value={name}>{name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-36 h-9">
                      <SelectValue placeholder="All Statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      {STATUS_STATS_CONFIG.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {isFiltered && (
                    <Button variant="ghost" size="sm" onClick={resetFilters} className="h-9 px-3 gap-2">
                      <X size={14} /> Reset
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Posts tab content */}
          <TabsContent
            value="posts"
            className="flex-1 overflow-y-auto px-8 mt-0 custom-scrollbar"
          >
            {filteredPosts.length > 0 ? (
              <div className="grid gap-6 grid-cols-[repeat(auto-fill,minmax(350px,1fr))]">
                {filteredPosts.map((post) => (
                  <CalendarPostCard key={post.version_id} post={post} />
                ))}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center">
                <Empty className="max-w-md border-none bg-transparent">
                  <EmptyHeader>
                    <div className="text-4xl leading-none select-none mb-2">
                      {isFiltered ? '🔍' : '📅'}
                    </div>
                    <EmptyTitle>
                      {regularPosts.length === 0 ? 'No posts scheduled' : 'No results found'}
                    </EmptyTitle>
                    <EmptyDescription>
                      {regularPosts.length === 0
                        ? 'No posts are scheduled for this date.'
                        : "No posts match your current filters."}
                    </EmptyDescription>
                    {isFiltered && (
                      <Button variant="outline" size="sm" onClick={resetFilters} className="mt-4">
                        Clear filters
                      </Button>
                    )}
                  </EmptyHeader>
                </Empty>
              </div>
            )}
          </TabsContent>

          {/* Meetings tab content */}
          <TabsContent
            value="meetings"
            className="flex-1 overflow-y-auto px-8 mt-0 custom-scrollbar"
          >
            {meetings.length > 0 ? (
              <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(340px,1fr))]">
                {meetings.map((meeting) => (
                  <MeetingRow
                    key={meeting.id}
                    meeting={meeting}
                    clientsMap={clientsMap}
                    markMeetingDone={markMeetingDone}
                    isCompletingMeeting={isCompletingMeeting}
                    variant="dashboard-card"
                    alwaysShowActions
                  />
                ))}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center">
                <Empty className="max-w-md border-none bg-transparent">
                  <EmptyHeader>
                    <div className="text-4xl leading-none select-none mb-2">🎥</div>
                    <EmptyTitle>No meetings scheduled</EmptyTitle>
                    <EmptyDescription>No meetings are scheduled for this date.</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <div className="px-10 py-4 border-t flex items-center justify-between shrink-0 bg-background">
          {activeTab === 'posts' ? (
            <div className="flex items-center gap-8">
              <p className="text-xs text-muted-foreground border-r pr-8">
                {regularPosts.length} {regularPosts.length === 1 ? 'Post' : 'Posts'}
              </p>
              <div className="flex items-center gap-6">
                {STATUS_STATS_CONFIG.map((status) => {
                  const count = stats[status.id] || 0
                  if (count === 0) return null
                  return (
                    <div key={status.id} className="flex items-center gap-2">
                      <div className={`size-1.5 rounded-full ${status.color}`} />
                      <span className="text-xs font-semibold">
                        {count}{' '}
                        <span className="text-muted-foreground font-medium">{status.label}</span>
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              {meetings.length} {meetings.length === 1 ? 'Meeting' : 'Meetings'}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
