import { useState, useMemo, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  format,
  startOfWeek,
  endOfWeek,
  isSameMonth,
  subMonths,
  subWeeks,
  addMonths,
  addWeeks,
} from 'date-fns'
import {
  ChevronLeft,
  ChevronRight,
  Search,
  X,
  Instagram,
  Linkedin,
  Youtube,
  Twitter,
  Facebook,
} from 'lucide-react'

// UI & Context
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { fetchGlobalCalendar } from '@/api/posts'
import { useAuth } from '@/context/AuthContext'
import { useHeader } from '@/components/misc/header-context'
import { cn } from '@/lib/utils'

// Calendar Views
import MonthView from './MonthView'
import WeekView from './WeekView'

const STATUS_LEGEND = [
  { id: 'PUBLISHED', label: 'Published', color: 'bg-green-600' },
  { id: 'SCHEDULED', label: 'Scheduled', color: 'bg-purple-600' },
  { id: 'NEEDS_REVISION', label: 'Needs Revision', color: 'bg-pink-600' },
  { id: 'PENDING_APPROVAL', label: 'Pending Approval', color: 'bg-amber-600' },
]

const PLATFORMS = [
  { id: 'instagram', label: 'Instagram', icon: Instagram },
  { id: 'linkedin', label: 'LinkedIn', icon: Linkedin },
  { id: 'facebook', label: 'Facebook', icon: Facebook },
  { id: 'twitter', label: 'Twitter', icon: Twitter },
  { id: 'youtube', label: 'YouTube', icon: Youtube },
]

export default function ContentCalendar({
  clientId = null,
  hideHeader = false,
}) {
  const { user } = useAuth()
  const { setHeader } = useHeader()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState('month')

  // Filter States
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [clientFilter, setClientFilter] = useState(clientId || 'all')
  const [platformFilter, setPlatformFilter] = useState('all')

  const { data: posts = [], isLoading } = useQuery({
    queryKey: [
      'calendar',
      user?.id,
      clientId,
      view,
      format(currentDate, 'yyyy-MM-dd'),
    ],
    queryFn: () =>
      fetchGlobalCalendar({
        userId: user?.id,
        currentMonth: currentDate,
        clientId: clientId,
      }),
    enabled: !!user?.id,
  })

  const calendarTitle = useMemo(() => {
    if (view === 'month') return format(currentDate, 'MMMM yyyy')
    const start = startOfWeek(currentDate)
    const end = endOfWeek(currentDate)
    return isSameMonth(start, end)
      ? `${format(start, 'MMM d')} – ${format(end, 'd')}, ${format(end, 'yyyy')}`
      : `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`
  }, [currentDate, view])

  useEffect(() => {
    if (!hideHeader) {
      setHeader({
        title: calendarTitle,
        breadcrumbs: [
          { label: 'Calendar', href: '/calendar' },
          { label: view === 'month' ? 'Month View' : 'Week View' },
        ],
      })
    }
  }, [calendarTitle, view, setHeader, hideHeader])

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

      // 🔥 FIX: Check for ID match if clientId prop is present
      const matchesClient = clientId
        ? String(post.client_id) === String(clientId)
        : clientFilter === 'all' || post.client_name === clientFilter

      const matchesPlatform =
        platformFilter === 'all' || post.platforms?.includes(platformFilter)

      return matchesSearch && matchesStatus && matchesClient && matchesPlatform
    })
  }, [posts, searchQuery, statusFilter, clientFilter, platformFilter, clientId])

  const postsByDate = useMemo(() => {
    return filteredPosts.reduce((acc, post) => {
      const dateKey = format(new Date(post.target_date), 'yyyy-MM-dd')
      if (!acc[dateKey]) acc[dateKey] = []
      acc[dateKey].push(post)
      return acc
    }, {})
  }, [filteredPosts])

  const handlePrev = () =>
    setCurrentDate(
      view === 'month' ? subMonths(currentDate, 1) : subWeeks(currentDate, 1),
    )

  const handleNext = () =>
    setCurrentDate(
      view === 'month' ? addMonths(currentDate, 1) : addWeeks(currentDate, 1),
    )

  const resetFilters = () => {
    setSearchQuery('')
    setStatusFilter('all')
    setClientFilter(clientId || 'all')
    setPlatformFilter('all')
  }

  return (
    <div
      className={cn(
        'mx-auto space-y-6',
        !hideHeader ? 'p-8 max-w-[1600px]' : 'w-full',
      )}
    >
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-3xl font-bold tracking-tight text-foreground">
            {calendarTitle}
          </h2>
          {/* <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">
            {view === 'month' ? 'Monthly Overview' : 'Weekly Schedule'}
          </p> */}
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center border rounded-lg overflow-hidden bg-background shadow-sm">
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePrev}
              className="h-9 w-9 rounded-none border-r"
            >
              <ChevronLeft size={16} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentDate(new Date())}
              className="px-4 h-9 rounded-none text-[11px] font-bold uppercase tracking-widest border-r"
            >
              Today
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleNext}
              className="h-9 w-9 rounded-none"
            >
              <ChevronRight size={16} />
            </Button>
          </div>

          <Tabs value={view} onValueChange={setView} className="w-[180px]">
            <TabsList className="grid w-full grid-cols-2 h-9">
              <TabsTrigger
                value="month"
                className="text-[10px] font-bold uppercase tracking-wider"
              >
                Month
              </TabsTrigger>
              <TabsTrigger
                value="week"
                className="text-[10px] font-bold uppercase tracking-wider"
              >
                Week
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative w-full max-w-sm group">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <Input
              placeholder="Search posts..."
              className="pl-9 h-9 bg-background border-border/60 shadow-none focus-visible:ring-1"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!clientId && (
            <Select value={clientFilter} onValueChange={setClientFilter}>
              <SelectTrigger className="w-36 h-9 text-xs font-semibold uppercase tracking-tight shadow-none">
                <SelectValue placeholder="Client" />
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
          )}

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36 h-9 text-xs font-semibold uppercase tracking-tight shadow-none">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Statuses</SelectItem>
              {STATUS_LEGEND.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={platformFilter} onValueChange={setPlatformFilter}>
            <SelectTrigger className="w-36 h-9 text-xs font-semibold uppercase tracking-tight shadow-none">
              <SelectValue placeholder="Platform" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Platforms</SelectItem>
              {PLATFORMS.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  <div className="flex items-center gap-2">
                    <p.icon size={12} />
                    {p.label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {(searchQuery ||
            statusFilter !== 'all' ||
            (!clientId && clientFilter !== 'all') ||
            platformFilter !== 'all') && (
            <Button
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              className="h-9 px-3 text-xs font-bold text-destructive hover:bg-destructive/5"
            >
              <X size={14} className="mr-2" /> Reset
            </Button>
          )}
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border/50 overflow-hidden shadow-sm">
        {view === 'month' ? (
          <MonthView
            currentMonth={currentDate}
            postsByDate={postsByDate}
            isLoading={isLoading}
            clientId={clientId}
          />
        ) : (
          <WeekView
            currentMonth={currentDate}
            postsByDate={postsByDate}
            isLoading={isLoading}
            clientId={clientId}
          />
        )}
      </div>

      <div className="flex items-center gap-6 px-1 pt-2">
        {STATUS_LEGEND.map((item) => (
          <button
            key={item.id}
            onClick={() =>
              setStatusFilter(statusFilter === item.id ? 'all' : item.id)
            }
            className={cn(
              'flex items-center gap-2 group transition-all',
              statusFilter !== 'all' &&
                statusFilter !== item.id &&
                'opacity-20 grayscale',
            )}
          >
            <span className={`size-1.5 rounded-full ${item.color} shadow-sm`} />
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
              {item.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
