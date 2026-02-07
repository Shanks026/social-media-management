import { useState, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { format } from 'date-fns'
import { CalendarDays, Search, X, FilterX } from 'lucide-react'
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
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyMedia,
} from '@/components/ui/empty'

const STATUS_STATS_CONFIG = [
  { id: 'PUBLISHED', label: 'Published', color: 'bg-green-600' },
  { id: 'SCHEDULED', label: 'Scheduled', color: 'bg-purple-600' },
  { id: 'NEEDS_REVISION', label: 'Revisions', color: 'bg-pink-600' },
  { id: 'PENDING_APPROVAL', label: 'Pending', color: 'bg-amber-600' },
]

export function DayDetailDialog({ date, posts = [], open, onOpenChange }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [clientFilter, setClientFilter] = useState('all')

  const uniqueClients = useMemo(() => {
    const clients = posts.map((p) => p.client_name)
    return [...new Set(clients)].sort()
  }, [posts])

  const filteredPosts = useMemo(() => {
    return posts.filter((post) => {
      const matchesSearch = post.title
        ?.toLowerCase()
        .includes(searchQuery.toLowerCase())
      const matchesStatus =
        statusFilter === 'all' || post.status === statusFilter
      const matchesClient =
        clientFilter === 'all' || post.client_name === clientFilter
      return matchesSearch && matchesStatus && matchesClient
    })
  }, [posts, searchQuery, statusFilter, clientFilter])

  const stats = useMemo(() => {
    return posts.reduce((acc, post) => {
      acc[post.status] = (acc[post.status] || 0) + 1
      return acc
    }, {})
  }, [posts])

  const isFiltered =
    searchQuery !== '' || statusFilter !== 'all' || clientFilter !== 'all'

  const resetFilters = () => {
    setSearchQuery('')
    setStatusFilter('all')
    setClientFilter('all')
  }

  if (!date) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] sm:max-w-none h-[90vh] p-0 overflow-hidden flex flex-col border-none shadow-2xl bg-background">
        {/* Header Section: Open & Airy */}
        <div className="pt-8 px-8 space-y-6 shrink-0">
          <DialogHeader className="p-0">
            <div className="space-y-1">
              {/* <div className="flex items-center gap-2 text-muted-foreground/60">
                <CalendarDays size={14} />
                <span className="text-xs font-medium">Daily Agenda</span>
              </div> */}
              <DialogTitle className="text-3xl font-bold tracking-tight text-foreground">
                {format(date, 'EEEE, MMMM do')}
              </DialogTitle>
            </div>
          </DialogHeader>

          {/* Action Bar: Default Shadcn Styling */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 flex-1">
              <div className="relative w-full max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder="Search posts..."
                  className="pl-9 h-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <Select value={clientFilter} onValueChange={setClientFilter}>
                <SelectTrigger className="w-44 h-9">
                  <SelectValue placeholder="All Clients" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Clients</SelectItem>
                  {uniqueClients.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-44 h-9">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {STATUS_STATS_CONFIG.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {isFiltered && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetFilters}
                  className="h-9 px-3 gap-2"
                >
                  <X size={14} />
                  <span>Reset</span>
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto px-8 py-4 custom-scrollbar">
          {filteredPosts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-8">
              {filteredPosts.map((post) => (
                <CalendarPostCard key={post.version_id} post={post} />
              ))}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center">
              <Empty className="max-w-md border-none bg-transparent">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    {isFiltered ? (
                      <FilterX className="text-muted-foreground" />
                    ) : (
                      <Search className="text-muted-foreground" />
                    )}
                  </EmptyMedia>
                  <EmptyTitle>
                    {posts.length === 0
                      ? 'No scheduled activity'
                      : 'No results found'}
                  </EmptyTitle>
                  <EmptyDescription>
                    {posts.length === 0
                      ? 'You have no posts or assignments scheduled for this date.'
                      : "We couldn't find any posts matching your search or filters."}
                  </EmptyDescription>
                  {isFiltered && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={resetFilters}
                      className="mt-4"
                    >
                      Clear filters
                    </Button>
                  )}
                </EmptyHeader>
              </Empty>
            </div>
          )}
        </div>

        {/* Footer: Clean & Weighted */}
        <div className="px-10 py-6 border-t flex items-center justify-between shrink-0 bg-background">
          <div className="flex items-center gap-8">
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest border-r pr-8">
              {posts.length} {posts.length === 1 ? 'Entry' : 'Entries'}
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
                      <span className="text-muted-foreground font-medium">
                        {status.label}
                      </span>
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
