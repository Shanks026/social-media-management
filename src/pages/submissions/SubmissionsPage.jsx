import { useState, useMemo, useEffect } from 'react'
import { NavLink, useNavigate, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table'
import { formatDistanceToNow } from 'date-fns'
import { Trash2, Search, Video as VideoIcon } from 'lucide-react'
import { toast } from 'sonner'

import { Input } from '@/components/ui/input'
import { useHeader } from '@/components/misc/header-context'
import { useMySubmissions, useMySubmissionsCount, deleteApprovalEvents } from '@/api/posts'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Empty, EmptyContent, EmptyHeader, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import { PlatformStack } from '@/components/PlatformIcon'

// ─── helpers ────────────────────────────────────────────────────────────────

function initials(name, email) {
  const src = name || email || '?'
  return src
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

function timeAgo(iso) {
  if (!iso) return '—'
  return formatDistanceToNow(new Date(iso), { addSuffix: true })
}

// ─── shared avatar components ────────────────────────────────────────────────

function UserAvatar({ name, email, avatarUrl }) {
  const [imgError, setImgError] = useState(false)
  if (avatarUrl && !imgError) {
    return (
      <img
        src={avatarUrl}
        alt={name || email}
        onError={() => setImgError(true)}
        className="size-7 rounded-full object-cover shrink-0 ring-1 ring-border"
      />
    )
  }
  return (
    <span className="size-7 text-[10px] rounded-full bg-muted flex items-center justify-center font-semibold text-muted-foreground shrink-0 ring-1 ring-border">
      {initials(name, email)}
    </span>
  )
}

function ClientAvatar({ name, logoUrl }) {
  const [imgError, setImgError] = useState(false)
  if (logoUrl && !imgError) {
    return (
      <img
        src={logoUrl}
        alt={name}
        onError={() => setImgError(true)}
        className="size-7 rounded-full object-cover shrink-0 ring-1 ring-border"
      />
    )
  }
  return (
    <span className="size-7 text-[10px] rounded-full bg-muted flex items-center justify-center font-semibold text-muted-foreground shrink-0 ring-1 ring-border">
      {initials(name, null)}
    </span>
  )
}

// ─── thumbnail ────────────────────────────────────────────────────────────────

function Thumbnail({ mediaUrls }) {
  const first = Array.isArray(mediaUrls) ? mediaUrls[0] : null
  if (!first) {
    return (
      <div className="size-10 rounded-md bg-muted shrink-0 flex items-center justify-center">
        <span className="text-[9px] text-muted-foreground font-medium">No media</span>
      </div>
    )
  }
  const isVideo = typeof first === 'string' && first.match(/\.(mp4|mov|webm|avi)(\?|$)/i)
  if (isVideo) {
    return (
      <div className="relative size-10 rounded-md bg-black shrink-0 overflow-hidden">
        <video src={first} muted playsInline preload="metadata" className="h-full w-full object-cover" />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-black/40 backdrop-blur-sm p-1 rounded-full">
            <VideoIcon className="size-3 text-white fill-white" />
          </div>
        </div>
      </div>
    )
  }
  return (
    <img
      src={first}
      alt=""
      className="size-10 rounded-md object-cover shrink-0 bg-muted"
      onError={(e) => { e.currentTarget.style.display = 'none' }}
    />
  )
}

function ColHeader({ label }) {
  return <span className="text-xs font-medium text-muted-foreground">{label}</span>
}

// ─── tab style ────────────────────────────────────────────────────────────────

const TAB_CLASS =
  'relative rounded-none bg-transparent px-0 pb-3 pt-0 text-sm font-medium transition-none shadow-none border-b-2 border-transparent text-muted-foreground flex-none w-fit gap-2 data-[state=active]:bg-transparent dark:data-[state=active]:bg-transparent data-[state=active]:text-black dark:data-[state=active]:text-white data-[state=active]:border-black dark:data-[state=active]:border-white data-[state=active]:shadow-none data-[state=active]:border-x-0 data-[state=active]:border-t-0 focus-visible:ring-0'

// ─── status → DB filter ───────────────────────────────────────────────────────

const TAB_STATUS = {
  pending: 'SUBMITTED',
  approved: 'READY',
  changes: 'CHANGES_REQUESTED',
}

// ─── submissions table ───────────────────────────────────────────────────────

const subCol = createColumnHelper()

function SubmissionsTab({ tab }) {
  const status = TAB_STATUS[tab]
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [deletingIds, setDeletingIds] = useState(new Set())
  const [globalFilter, setGlobalFilter] = useState('')

  const { data: rows = [], isLoading } = useMySubmissions({ status })

  const columns = useMemo(() => {
    const base = [
      subCol.accessor('post_title', {
        header: () => <ColHeader label="Deliverable" />,
        enableSorting: false,
        cell: ({ row }) => {
          const item = row.original
          const mediaArr = Array.isArray(item.post_media_urls) ? item.post_media_urls : []
          return (
            <NavLink
              to={`/clients/${item.client_id}/posts/${item.post_id}`}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-3 min-w-0 group/link"
            >
              <Thumbnail mediaUrls={mediaArr} />
              <div className="min-w-0">
                <p className="text-sm font-medium truncate max-w-55 group-hover/link:underline">
                  {item.post_title || 'Untitled'}
                </p>
                {item.post_content && (
                  <p className="text-xs text-muted-foreground truncate max-w-55 mt-0.5">
                    {item.post_content}
                  </p>
                )}
              </div>
            </NavLink>
          )
        },
      }),
      subCol.accessor('post_platform', {
        header: () => <ColHeader label="Platforms" />,
        enableSorting: false,
        cell: ({ getValue }) => {
          const p = getValue()
          return p?.length
            ? <PlatformStack platforms={p} size={20} max={4} />
            : <span className="text-sm text-muted-foreground">—</span>
        },
      }),
      subCol.accessor('client_name', {
        header: () => <ColHeader label="Client" />,
        enableSorting: false,
        cell: ({ row }) => {
          const item = row.original
          return (
            <div className="flex items-center gap-2 min-w-0">
              <ClientAvatar name={item.client_name} logoUrl={item.client_logo_url} />
              <span className="text-sm truncate max-w-30">{item.client_name}</span>
            </div>
          )
        },
      }),
      subCol.accessor('submitted_at', {
        header: () => <ColHeader label="Submitted" />,
        enableSorting: false,
        cell: ({ getValue }) => (
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            {timeAgo(getValue())}
          </span>
        ),
      }),
    ]

    if (tab !== 'pending') {
      base.push(
        subCol.accessor('actor_name', {
          header: () => <ColHeader label="By" />,
          enableSorting: false,
          cell: ({ row }) => {
            const item = row.original
            if (!item.actor_name && !item.actor_email) {
              return <span className="text-sm text-muted-foreground">—</span>
            }
            return (
              <div className="flex items-center gap-2 min-w-0">
                <UserAvatar
                  name={item.actor_name}
                  email={item.actor_email}
                  avatarUrl={item.actor_avatar_url}
                />
                <span className="text-sm truncate max-w-30">
                  {item.actor_name || item.actor_email}
                </span>
              </div>
            )
          },
        }),
      )
    }

    if (tab === 'changes') {
      base.push(
        subCol.accessor('decision_notes', {
          header: () => <ColHeader label="Notes" />,
          enableSorting: false,
          cell: ({ getValue }) => {
            const notes = getValue()
            if (!notes) return <span className="text-sm text-muted-foreground/40">—</span>
            return (
              <span className="text-sm text-muted-foreground truncate max-w-50 block" title={notes}>
                {notes}
              </span>
            )
          },
        }),
      )
    }

    if (tab !== 'pending') {
      base.push(
        subCol.accessor('decision_at', {
          header: () => <ColHeader label="When" />,
          enableSorting: false,
          cell: ({ getValue }) => (
            <span className="text-sm text-muted-foreground whitespace-nowrap">
              {timeAgo(getValue())}
            </span>
          ),
        }),
      )
    }

    if (tab === 'approved') {
      base.push(
        subCol.display({
          id: 'delete',
          header: '',
          cell: ({ row }) => {
            const item = row.original
            const isDeleting = deletingIds.has(item.submission_event_id)
            return (
              <button
                disabled={isDeleting}
                onClick={(e) => {
                  e.stopPropagation()
                  handleDelete(item.submission_event_id)
                }}
                className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-40"
                title="Remove from submissions"
              >
                <Trash2 className="size-3.5" />
              </button>
            )
          },
        }),
      )
    }

    return base
  }, [tab, deletingIds])

  async function handleDelete(id) {
    setDeletingIds((prev) => new Set(prev).add(id))
    try {
      await deleteApprovalEvents([id])
      queryClient.invalidateQueries({ queryKey: ['my-submissions'] })
      toast.success('Removed from submissions')
    } catch (err) {
      toast.error(err.message || 'Failed to remove')
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  const table = useReactTable({
    data: rows,
    columns,
    state: { globalFilter },
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  const emptyLabel = {
    pending: 'No pending submissions',
    approved: 'No approved submissions',
    changes: 'No changes requested',
  }[tab]

  const emptyDescription = {
    pending: 'Deliverables you submit for internal review will appear here.',
    approved: 'Deliverables that have been approved will appear here.',
    changes: "Deliverables where changes were requested will show up here. You're all clear.",
  }[tab]

  const searchBar = (
    <div className="relative w-72">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
      <Input
        placeholder="Search deliverables…"
        value={globalFilter}
        onChange={(e) => setGlobalFilter(e.target.value)}
        className="pl-8 h-9 text-sm"
      />
    </div>
  )

  if (!isLoading && rows.length === 0) {
    return (
      <div className="space-y-4">
        {searchBar}
        <Empty className="py-20">
          <EmptyContent>
            <EmptyHeader>
              <span className="text-4xl">📬</span>
              <EmptyTitle className="font-bold text-xl">{emptyLabel}</EmptyTitle>
              <EmptyDescription>{emptyDescription}</EmptyDescription>
            </EmptyHeader>
          </EmptyContent>
        </Empty>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {searchBar}
      <div className="rounded-xl border border-border overflow-hidden">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id} className="hover:bg-transparent border-b border-border">
              {hg.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className="text-xs font-medium text-muted-foreground h-10 px-4"
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {isLoading
            ? Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i} className="border-b border-border">
                  {columns.map((_, ci) => (
                    <TableCell key={ci} className="px-4 py-3">
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            : table.getRowModel().rows.map((row) => {
                const item = row.original
                return (
                  <TableRow
                    key={row.id}
                    className="border-b border-border last:border-0 cursor-pointer hover:bg-muted/40 transition-colors"
                    onClick={() =>
                      navigate(`/clients/${item.client_id}/posts/${item.post_id}`)
                    }
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="px-4 py-3">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                )
              })}
        </TableBody>
      </Table>
      </div>
    </div>
  )
}

// ─── page ─────────────────────────────────────────────────────────────────────

const VALID_TABS = ['pending', 'approved', 'changes']

export default function SubmissionsPage() {
  const { setHeader } = useHeader()
  useEffect(() => {
    setHeader({ title: 'Submissions', breadcrumbs: [{ label: 'Submissions' }] })
  }, [setHeader])

  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = VALID_TABS.includes(searchParams.get('tab'))
    ? searchParams.get('tab')
    : 'pending'

  function setTab(tab) {
    setSearchParams((prev) => { prev.set('tab', tab); return prev }, { replace: true })
  }

  const { data: pendingCount = 0 } = useMySubmissionsCount('SUBMITTED')
  const { data: approvedCount = 0 } = useMySubmissionsCount('READY')
  const { data: changesCount = 0 } = useMySubmissionsCount('CHANGES_REQUESTED')

  return (
    <div className="min-h-full bg-background selection:bg-primary/10">
      <div className="px-8 pt-8 pb-20 space-y-6 max-w-350 mx-auto animate-page-fade-in">
        {/* header */}
        <div className="space-y-1">
          <h1 className="text-3xl font-normal tracking-tight text-foreground bricolage flex items-center gap-3">
            Submissions
          </h1>
          <p className="text-sm text-muted-foreground">
            Track every deliverable you've submitted for internal review and see where each one stands.
          </p>
        </div>

        {/* tabs */}
        <Tabs value={activeTab} onValueChange={setTab} className="w-full">
          <div className="border-b border-border">
            <TabsList className="h-auto bg-transparent p-0 gap-6 rounded-none">
              <TabsTrigger value="pending" className={TAB_CLASS}>
                Pending
                {pendingCount > 0 && (
                  <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-muted px-1 text-[10px] font-bold text-muted-foreground">
                    {pendingCount}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="approved" className={TAB_CLASS}>
                Approved
                {approvedCount > 0 && (
                  <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-muted px-1 text-[10px] font-bold text-muted-foreground">
                    {approvedCount}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="changes" className={TAB_CLASS}>
                Changes Requested
                {changesCount > 0 && (
                  <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-pink-500/15 px-1 text-[10px] font-bold text-pink-600">
                    {changesCount}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="pending" className="mt-6">
            <SubmissionsTab tab="pending" />
          </TabsContent>
          <TabsContent value="approved" className="mt-6">
            <SubmissionsTab tab="approved" />
          </TabsContent>
          <TabsContent value="changes" className="mt-6">
            <SubmissionsTab tab="changes" />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
