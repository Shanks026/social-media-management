import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import {
  Search,
  Plus,
  LayoutGrid,
  TableProperties,
  Instagram,
  Linkedin,
  Twitter,
  Facebook,
  Youtube,
  Globe,
  X,
  Calendar as CalendarIcon,
  Building2,
  Users,
  Filter,
} from 'lucide-react'

// UI Components
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

// App Components
import { CustomTable } from '@/components/CustomTable'
import { CalendarPostCard } from '@/pages/calendar/CalendarPostCard'
import StatusBadge from '@/components/StatusBadge'
import { useHeader } from '@/components/misc/header-context'
import { useGlobalPosts, usePostCounts } from '@/api/useGlobalPosts'
import { useClients } from '@/api/clients'

// ─── Constants ──────────────────────────────────────────
const PLATFORMS = [
  { id: 'instagram', label: 'Instagram', icon: Instagram, color: '#E4405F' },
  { id: 'linkedin', label: 'LinkedIn', icon: Linkedin, color: '#0077B5' },
  { id: 'twitter', label: 'Twitter', icon: Twitter, color: '#000000' },
  { id: 'facebook', label: 'Facebook', icon: Facebook, color: '#1877F2' },
  { id: 'youtube', label: 'YouTube', icon: Youtube, color: '#FF0000' },
]

const STATUS_TABS = [
  { key: 'ALL', label: 'All' },
  { key: 'DRAFT', label: 'Drafts' },
  { key: 'PENDING_APPROVAL', label: 'Pending Approval' },
  // { key: 'APPROVED', label: 'Approved' },
  { key: 'SCHEDULED', label: 'Scheduled' },
  { key: 'NEEDS_REVISION', label: 'Needs Revision' },
  { key: 'PUBLISHED', label: 'Published' },
  { key: 'ARCHIVED', label: 'Archived' },
]

const PlatformIcon = ({ name, size = 14 }) => {
  const icons = {
    instagram: { icon: Instagram, bg: 'bg-[#E4405F]' },
    linkedin: { icon: Linkedin, bg: 'bg-[#0077B5]' },
    twitter: { icon: Twitter, bg: 'bg-black dark:bg-white' },
    facebook: { icon: Facebook, bg: 'bg-[#1877F2]' },
    youtube: { icon: Youtube, bg: 'bg-[#FF0000]' },
    google_business: { icon: Globe, bg: 'bg-[#4285F4]' },
  }
  const p = icons[name?.toLowerCase()]
  if (!p) return null
  const Icon = p.icon
  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-full shrink-0',
        p.bg,
        name?.toLowerCase() === 'twitter'
          ? 'text-white dark:text-black'
          : 'text-white',
      )}
      style={{ width: size + 10, height: size + 10 }}
    >
      <Icon style={{ width: size, height: size }} />
    </div>
  )
}

// ─── Main Page ──────────────────────────────────────────
export default function Posts() {
  const navigate = useNavigate()
  const { setHeader } = useHeader()

  // View mode
  const [viewMode, setViewMode] = useState('card') // 'card' | 'table'

  // Filter states
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusTab, setStatusTab] = useState('ALL')
  const [scope, setScope] = useState('all') // 'all' | 'INTERNAL' | 'CLIENTS'
  const [selectedClient, setSelectedClient] = useState('all')
  const [platform, setPlatform] = useState('all')
  const [dateRange, setDateRange] = useState({ from: undefined, to: undefined })

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  // Determine effective clientId for the API
  const effectiveClientId = useMemo(() => {
    if (selectedClient !== 'all') return selectedClient
    if (scope === 'INTERNAL') return 'INTERNAL'
    if (scope === 'CLIENTS') return 'CLIENTS'
    return 'all'
  }, [scope, selectedClient])

  // Queries
  const filters = {
    search: debouncedSearch,
    status: statusTab,
    clientId: effectiveClientId,
    platform: platform !== 'all' ? platform : undefined,
    dateRange: dateRange.from ? dateRange : undefined,
  }

  const { data: posts = [], isLoading } = useGlobalPosts(filters)
  const { data: counts = {} } = usePostCounts()
  const { data: clientsData } = useClients()

  // Client options for dropdown
  const clientOptions = useMemo(() => {
    if (!clientsData) return []
    const clients = [
      ...(clientsData.internalAccount ? [clientsData.internalAccount] : []),
      ...clientsData.realClients,
    ]
    // Filter based on scope
    if (scope === 'INTERNAL') return clients.filter((c) => c.is_internal)
    if (scope === 'CLIENTS') return clients.filter((c) => !c.is_internal)
    return clients
  }, [clientsData, scope])

  // Set header
  useEffect(() => {
    setHeader({
      title: 'Content Hub',
      breadcrumbs: [{ label: 'Content Hub', href: '/posts' }],
    })
  }, [setHeader])

  const hasActiveFilters =
    search ||
    scope !== 'all' ||
    selectedClient !== 'all' ||
    platform !== 'all' ||
    dateRange.from

  const resetFilters = () => {
    setSearch('')
    setDebouncedSearch('')
    setScope('all')
    setSelectedClient('all')
    setPlatform('all')
    setDateRange({ from: undefined, to: undefined })
  }

  // ─── Table columns ───────────────────────────
  const tableColumns = [
    {
      header: 'Client',
      width: '200px',
      render: (item) => (
        <div className="flex items-center gap-3">
          {item.client_logo ? (
            <img
              src={item.client_logo}
              alt=""
              className="size-8 rounded-lg object-cover ring-1 ring-border shrink-0"
            />
          ) : (
            <div className="size-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
              <Building2 className="size-4 text-muted-foreground" />
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{item.client_name}</p>
            {item.is_internal && (
              <Badge
                variant="secondary"
                className="text-[10px] px-1.5 py-0 mt-0.5"
              >
                Internal
              </Badge>
            )}
          </div>
        </div>
      ),
    },
    {
      header: 'Title',
      width: '250px',
      render: (item) => (
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">
            {item.title || 'Untitled'}
          </p>
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {item.content?.substring(0, 60)}
            {item.content?.length > 60 ? '...' : ''}
          </p>
        </div>
      ),
    },
    {
      header: 'Platform',
      width: '120px',
      render: (item) => (
        <div className="flex items-center -space-x-1.5">
          {(item.platforms || []).map((p) => (
            <PlatformIcon key={p} name={p} size={12} />
          ))}
          {(!item.platforms || item.platforms.length === 0) && (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </div>
      ),
    },
    {
      header: 'Status',
      width: '160px',
      render: (item) => <StatusBadge status={item.status} />,
    },
    {
      header: 'Target Date',
      width: '150px',
      render: (item) => (
        <span className="text-sm text-muted-foreground">
          {item.target_date
            ? format(new Date(item.target_date), 'MMM d, h:mm a')
            : '—'}
        </span>
      ),
    },
    {
      header: '',
      width: '50px',
      render: (item) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8">
              <span className="text-lg leading-none">⋯</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation()
                navigate(`/clients/${item.client_id}/posts/${item.version_id}`)
              }}
            >
              Edit
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  const handleRowClick = (item) => {
    navigate(`/clients/${item.client_id}/posts/${item.version_id}`)
  }

  // ─── Render ──────────────────────────────────
  return (
    <div className="p-8 max-w-[1440px] mx-auto space-y-8">
      {/* ── Header ─────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-normal tracking-tight text-foreground">
            Content Hub
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage all posts across your organization
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* View Mode Toggle */}
          <div className="flex items-center border rounded-lg overflow-hidden bg-background">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setViewMode('card')}
              className={cn(
                'h-9 w-9 rounded-none',
                viewMode === 'card' && 'bg-muted',
              )}
            >
              <LayoutGrid size={16} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setViewMode('table')}
              className={cn(
                'h-9 w-9 rounded-none',
                viewMode === 'table' && 'bg-muted',
              )}
            >
              <TableProperties size={16} />
            </Button>
          </div>

          <Button onClick={() => navigate('/clients')} className="gap-2">
            <Plus size={16} />
            New Post
          </Button>
        </div>
      </div>

      {/* ── Filter Bar ─────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm group">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <Input
            placeholder="Search content..."
            className="pl-9 h-9 bg-background border-border/60 shadow-none focus-visible:ring-1"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Scope */}
        <Select
          value={scope}
          onValueChange={(v) => {
            setScope(v)
            setSelectedClient('all')
          }}
        >
          <SelectTrigger className="w-[170px] h-9 text-xs font-semibold shadow-none">
            <Filter size={14} className="mr-1.5 shrink-0 opacity-50" />
            <SelectValue placeholder="Scope" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Posts</SelectItem>
            <SelectItem value="INTERNAL">
              <div className="flex items-center gap-2">
                <Building2 size={12} />
                My Agency Only
              </div>
            </SelectItem>
            <SelectItem value="CLIENTS">
              <div className="flex items-center gap-2">
                <Users size={12} />
                Client Work Only
              </div>
            </SelectItem>
          </SelectContent>
        </Select>

        {/* Client Select */}
        <Select value={selectedClient} onValueChange={setSelectedClient}>
          <SelectTrigger className="w-[170px] h-9 text-xs font-semibold shadow-none">
            <SelectValue placeholder="Client" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Clients</SelectItem>
            {clientOptions.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                <div className="flex items-center gap-2">
                  {c.logo_url ? (
                    <img
                      src={c.logo_url}
                      alt=""
                      className="size-4 rounded object-cover"
                    />
                  ) : (
                    <div className="size-4 rounded bg-muted" />
                  )}
                  <span className="truncate">{c.name}</span>
                  {c.is_internal && (
                    <Badge
                      variant="secondary"
                      className="text-[9px] px-1 py-0 ml-1"
                    >
                      INT
                    </Badge>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Platform */}
        <Select value={platform} onValueChange={setPlatform}>
          <SelectTrigger className="w-[145px] h-9 text-xs font-semibold shadow-none">
            <SelectValue placeholder="Platform" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Platforms</SelectItem>
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

        {/* Date Range Picker */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                'h-9 gap-2 text-xs font-semibold shadow-none',
                dateRange.from && 'text-primary border-primary/30',
              )}
            >
              <CalendarIcon size={14} />
              {dateRange.from
                ? dateRange.to
                  ? `${format(dateRange.from, 'MMM d')} - ${format(dateRange.to, 'MMM d')}`
                  : format(dateRange.from, 'MMM d')
                : 'Date Range'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={dateRange}
              onSelect={(range) =>
                setDateRange(range || { from: undefined, to: undefined })
              }
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>

        {/* Reset */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={resetFilters}
            className="h-9 px-3 text-xs font-bold text-destructive hover:bg-destructive/5"
          >
            <X size={14} className="mr-1.5" />
            Reset
          </Button>
        )}
      </div>

      {/* ── Tabs ──────────────────────── */}
      <Tabs value={statusTab} onValueChange={setStatusTab} className="w-full">
        <TabsList className="bg-transparent h-auto w-full justify-start rounded-none p-0 gap-8 border-b border-border/40">
          {STATUS_TABS.map((tab) => {
            const count = tab.key === 'ALL' ? counts.all : counts[tab.key]
            return (
              <TabsTrigger
                key={tab.key}
                value={tab.key}
                className="
                  relative rounded-none bg-transparent px-0 pb-3 pt-0 text-sm font-medium transition-none 
                  shadow-none border-b-2 border-transparent text-muted-foreground
                  flex-none w-fit gap-2
                  data-[state=active]:bg-transparent 
                  dark:data-[state=active]:bg-transparent
                  data-[state=active]:text-black 
                  dark:data-[state=active]:text-white 
                  data-[state=active]:border-black
                  dark:data-[state=active]:border-white
                  data-[state=active]:shadow-none
                  data-[state=active]:border-x-0 
                  data-[state=active]:border-t-0
                  focus-visible:ring-0
                "
              >
                {tab.label}
                {count !== undefined && count > 0 && (
                  <Badge
                    variant="secondary"
                    className="text-[10px] px-1.5 py-0 min-w-[20px] text-center"
                  >
                    {count}
                  </Badge>
                )}
              </TabsTrigger>
            )
          })}
        </TabsList>
      </Tabs>

      {/* ── Content Area ─────────────── */}
      {viewMode === 'table' ? (
        <CustomTable
          columns={tableColumns}
          data={posts}
          isLoading={isLoading}
          onRowClick={handleRowClick}
        />
      ) : (
        <>
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-xl border overflow-hidden">
                  <Skeleton className="aspect-video w-full" />
                  <div className="p-6 space-y-3">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : posts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="size-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                <LayoutGrid className="size-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-1">
                No posts found
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                No posts match your current filters. Try adjusting your search
                or filter criteria.
              </p>
              {hasActiveFilters && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetFilters}
                  className="mt-4"
                >
                  Clear Filters
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-5">
              {posts.map((post) => (
                <CalendarPostCard key={post.id} post={post} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
