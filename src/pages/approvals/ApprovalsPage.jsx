import { useState, useEffect, useMemo } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table'
import { format, formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'
import {
  ShieldCheck,
  MessageSquareWarning,
  Clock,
  Loader2,
  Video,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  CheckCircle2,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Trash2,
  RotateCcw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
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
import {
  Empty,
  EmptyContent,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from '@/components/ui/empty'
import { useHeader } from '@/components/misc/header-context'
import {
  usePendingApprovals,
  usePendingApprovalsCount,
  approveInternally,
  requestInternalChanges,
  useApprovalLog,
  useApprovalLogCount,
  deleteApprovalEvents,
} from '@/api/posts'
import { useTeamMembers } from '@/api/team'
import { PlatformStack } from '@/components/PlatformIcon'
import { cn } from '@/lib/utils'
import { NavLink, useSearchParams } from 'react-router-dom'

// ── Constants ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 25

const PLATFORM_LABELS = {
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  facebook: 'Facebook',
  google_business: 'Google Business',
  youtube: 'YouTube',
  twitter: 'Twitter/X',
}

const TAB_TRIGGER_CLASS =
  'relative rounded-none bg-transparent px-0 pb-3 pt-0 text-sm font-medium transition-none shadow-none border-b-2 border-transparent text-muted-foreground flex-none w-fit gap-2 data-[state=active]:bg-transparent dark:data-[state=active]:bg-transparent data-[state=active]:text-black dark:data-[state=active]:text-white data-[state=active]:border-black dark:data-[state=active]:border-white data-[state=active]:shadow-none data-[state=active]:border-x-0 data-[state=active]:border-t-0 focus-visible:ring-0'

// ── Small helpers ─────────────────────────────────────────────────────────────

function isVideoUrl(url) {
  return url ? ['.mp4', '.mov', '.webm', '.m4v'].some((e) => url.toLowerCase().includes(e)) : false
}

function initials(name, email) {
  if (name) return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
  return email?.[0]?.toUpperCase() ?? '?'
}

// ── Shared avatar components ──────────────────────────────────────────────────

function UserAvatar({ name, email, avatarUrl, size = 'sm' }) {
  const [imgError, setImgError] = useState(false)
  const sz = size === 'sm' ? 'size-7' : 'size-8'
  const txt = size === 'sm' ? 'text-[10px]' : 'text-xs'
  if (avatarUrl && !imgError) {
    return <img src={avatarUrl} alt={name || email} onError={() => setImgError(true)} className={cn(sz, 'rounded-full object-cover shrink-0 ring-1 ring-border')} />
  }
  return (
    <span className={cn(sz, txt, 'rounded-full bg-muted flex items-center justify-center font-semibold text-muted-foreground shrink-0 ring-1 ring-border')}>
      {initials(name, email)}
    </span>
  )
}

function ClientAvatar({ name, logoUrl, size = 'sm' }) {
  const [imgError, setImgError] = useState(false)
  const sz = size === 'sm' ? 'size-7' : 'size-8'
  const txt = size === 'sm' ? 'text-[10px]' : 'text-xs'
  if (logoUrl && !imgError) {
    return <img src={logoUrl} alt={name} onError={() => setImgError(true)} className={cn(sz, 'rounded-full object-cover shrink-0 ring-1 ring-border bg-muted')} />
  }
  return (
    <span className={cn(sz, txt, 'rounded-full bg-muted flex items-center justify-center font-semibold text-muted-foreground shrink-0 ring-1 ring-border')}>
      {name?.[0]?.toUpperCase() ?? '?'}
    </span>
  )
}

// ── Table helpers ─────────────────────────────────────────────────────────────

function ColHeader({ label }) {
  return <span className="text-xs font-medium text-muted-foreground">{label}</span>
}

function SortableHeader({ column, label }) {
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

function InlineThumb({ urls }) {
  const first = urls?.[0]
  if (!first) return <div className="size-11 rounded-md bg-muted shrink-0 ring-1 ring-border/40" />
  if (isVideoUrl(first)) {
    return (
      <div className="relative size-11 rounded-md bg-black shrink-0 ring-1 ring-border/40 overflow-hidden">
        <video src={first} muted playsInline className="h-full w-full object-cover" />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-black/40 backdrop-blur-sm p-1 rounded-full">
            <Video className="size-3 text-white fill-white" />
          </div>
        </div>
      </div>
    )
  }
  return <img src={first} alt="" className="size-11 rounded-md object-cover shrink-0 ring-1 ring-border/40 bg-muted" />
}

// ── Row skeletons ─────────────────────────────────────────────────────────────

function PendingRowSkeleton() {
  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-3">
          <Skeleton className="size-11 rounded-md shrink-0" />
          <div className="space-y-1.5"><Skeleton className="h-3.5 w-40" /><Skeleton className="h-3 w-28" /></div>
        </div>
      </TableCell>
      <TableCell><div className="flex items-center gap-2"><Skeleton className="size-7 rounded-full" /><Skeleton className="h-3.5 w-24" /></div></TableCell>
      <TableCell><div className="flex gap-1"><Skeleton className="size-5 rounded-full" /><Skeleton className="size-5 rounded-full" /></div></TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Skeleton className="size-7 rounded-full" />
          <div className="space-y-1"><Skeleton className="h-3.5 w-24" /><Skeleton className="h-2.5 w-16" /></div>
        </div>
      </TableCell>
      <TableCell><Skeleton className="h-3.5 w-20" /></TableCell>
    </TableRow>
  )
}

function LogRowSkeleton() {
  return (
    <TableRow>
      <TableCell><div className="flex items-center gap-2"><Skeleton className="size-7 rounded-full" /><Skeleton className="h-3.5 w-28" /></div></TableCell>
      <TableCell><div className="flex items-center gap-2"><Skeleton className="size-7 rounded-full" /><Skeleton className="h-3.5 w-20" /></div></TableCell>
      <TableCell><Skeleton className="h-3.5 w-44" /></TableCell>
      <TableCell><Skeleton className="h-3.5 w-20" /></TableCell>
    </TableRow>
  )
}

// ── Pending detail dialog ─────────────────────────────────────────────────────

function ApprovalDetailDialog({ item, open, onOpenChange }) {
  const queryClient = useQueryClient()
  const [isRequestOpen, setIsRequestOpen] = useState(false)
  const [changeNotes, setChangeNotes] = useState('')

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['pending-approvals'] })
    queryClient.invalidateQueries({ queryKey: ['pending-approvals-count'] })
    queryClient.invalidateQueries({ queryKey: ['approval-log'] })
    queryClient.invalidateQueries({ queryKey: ['post-version'] })
  }

  const approveMutation = useMutation({
    mutationFn: () => approveInternally(item.id),
    onSuccess: () => {
      invalidate()
      toast.success(`"${item.title}" approved`)
      onOpenChange(false)
    },
    onError: (err) => toast.error(err.message),
  })

  const requestChangesMutation = useMutation({
    mutationFn: () => requestInternalChanges(item.id, changeNotes),
    onSuccess: () => {
      invalidate()
      toast.success('Changes requested')
      setIsRequestOpen(false)
      setChangeNotes('')
      onOpenChange(false)
    },
    onError: (err) => toast.error(err.message),
  })

  if (!item) return null

  const isSocial = (item.platforms?.length ?? 0) > 0

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl w-full max-h-[88vh] flex flex-col gap-0 p-0 overflow-hidden">
          <div className="px-6 pt-6 pb-4 border-b border-border shrink-0">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2 min-w-0">
                <DialogTitle className="text-xl font-semibold bricolage leading-tight">{item.title}</DialogTitle>
                <div className="flex items-center gap-2">
                  <ClientAvatar name={item.client?.name} logoUrl={item.client?.logo_url} />
                  <span className="text-sm text-muted-foreground">{item.client?.name}</span>
                </div>
              </div>
              <NavLink
                to={`/clients/${item.client_id}/posts/${item.actual_post_id}`}
                onClick={() => onOpenChange(false)}
                className="shrink-0 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mt-1"
              >
                Open post <ExternalLink className="size-3" />
              </NavLink>
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-4 text-sm text-muted-foreground">
              {isSocial && (
                <div className="flex items-center gap-2">
                  <PlatformStack platforms={item.platforms} size={18} />
                  <span className="text-xs">{item.platforms.map((p) => PLATFORM_LABELS[p] ?? p).join(', ')}</span>
                </div>
              )}
              {item.target_date && (
                <div className="flex items-center gap-1.5">
                  <Clock className="size-3.5 shrink-0" />
                  <span>Target: {format(new Date(item.target_date), 'dd MMM yyyy')}</span>
                </div>
              )}
              {item.submitter && (
                <div className="flex items-center gap-1.5">
                  <UserAvatar name={item.submitter.full_name} email={item.submitter.email} avatarUrl={item.submitter.avatar_url} />
                  <span>{item.submitter.full_name || item.submitter.email}</span>
                  <span className="text-xs text-muted-foreground/60">
                    · {formatDistanceToNow(new Date(item.updated_at), { addSuffix: true })}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
            {(item.media_urls?.length ?? 0) > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Media</p>
                {item.media_urls.length === 1 ? (
                  isVideoUrl(item.media_urls[0]) ? (
                    <div className="w-full aspect-video bg-muted rounded-lg overflow-hidden">
                      <video src={item.media_urls[0]} className="w-full h-full object-contain" controls />
                    </div>
                  ) : (
                    <img src={item.media_urls[0]} alt="" className="w-full aspect-video object-cover rounded-lg bg-muted" />
                  )
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {item.media_urls.map((url, i) => (
                      <div key={i} className="aspect-square rounded-md overflow-hidden bg-muted">
                        {isVideoUrl(url) ? (
                          <>
                            <video src={url} muted playsInline className="w-full h-full object-cover" />
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                              <div className="bg-black/40 backdrop-blur-sm p-1.5 rounded-full">
                                <Video className="size-4 text-white fill-white" />
                              </div>
                            </div>
                          </>
                        ) : (
                          <img src={url} alt="" className="w-full h-full object-cover" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {item.content && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {isSocial ? 'Caption' : 'Content'}
                </p>
                <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">{item.content}</p>
              </div>
            )}
          </div>

          <div className="px-6 py-4 border-t border-border flex items-center justify-end gap-3 shrink-0 bg-muted/30">
            <Button variant="outline" className="gap-2" onClick={() => setIsRequestOpen(true)}>
              <MessageSquareWarning className="size-4" />
              Request Changes
            </Button>
            <Button
              className="gap-2 font-semibold"
              disabled={approveMutation.isPending}
              onClick={() => approveMutation.mutate()}
            >
              {approveMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
              Approve
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isRequestOpen} onOpenChange={setIsRequestOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Request Changes</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground -mt-2">
            Describe what needs to be revised. The member will see this and can resubmit.
          </p>
          <Textarea
            placeholder="e.g. Caption too long — cut to 150 chars. Swap the second image."
            value={changeNotes}
            onChange={(e) => setChangeNotes(e.target.value)}
            rows={4}
            className="resize-none"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsRequestOpen(false); setChangeNotes('') }}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => requestChangesMutation.mutate()}
              disabled={requestChangesMutation.isPending}
            >
              {requestChangesMutation.isPending && <Loader2 size={13} className="animate-spin mr-1.5" />}
              Send Feedback
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ── Pending tab ───────────────────────────────────────────────────────────────

const pendingCol = createColumnHelper()

function PendingTab() {
  const { data: rawQueue = [], isLoading } = usePendingApprovals()
  const { data: teamMembers = [] } = useTeamMembers()
  const [sorting, setSorting] = useState([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [selectedItem, setSelectedItem] = useState(null)

  const memberMap = useMemo(() => {
    const map = {}
    teamMembers.forEach((m) => { map[m.member_user_id] = m })
    return map
  }, [teamMembers])

  const queue = useMemo(
    () => rawQueue.map((item) => ({ ...item, submitter: memberMap[item.submitted_by] ?? null })),
    [rawQueue, memberMap],
  )

  const columns = useMemo(() => [
    pendingCol.accessor('title', {
      header: ({ column }) => <SortableHeader column={column} label="Deliverable" />,
      cell: ({ row }) => {
        const item = row.original
        return (
          <div className="flex items-center gap-3 min-w-0">
            <InlineThumb urls={item.media_urls} />
            <div className="min-w-0">
              <p className="text-sm font-medium leading-tight truncate max-w-50">{item.title}</p>
              {item.content && (
                <p className="text-xs text-muted-foreground truncate max-w-50 mt-0.5">{item.content}</p>
              )}
            </div>
          </div>
        )
      },
    }),
    pendingCol.accessor((row) => row.client?.name ?? '', {
      id: 'client',
      header: ({ column }) => <SortableHeader column={column} label="Client" />,
      cell: ({ row }) => {
        const c = row.original.client
        return (
          <div className="flex items-center gap-2 min-w-0">
            <ClientAvatar name={c?.name} logoUrl={c?.logo_url} />
            <span className="text-sm truncate max-w-32.5">{c?.name ?? '—'}</span>
          </div>
        )
      },
    }),
    pendingCol.accessor('platforms', {
      header: () => <ColHeader label="Platforms" />,
      enableSorting: false,
      cell: ({ getValue }) => {
        const p = getValue()
        return p?.length
          ? <PlatformStack platforms={p} size={20} max={4} />
          : <span className="text-xs text-muted-foreground">—</span>
      },
    }),
    pendingCol.accessor((row) => row.submitter?.full_name || row.submitter?.email || '', {
      id: 'submitter',
      header: ({ column }) => <SortableHeader column={column} label="Submitted by" />,
      cell: ({ row }) => {
        const s = row.original.submitter
        const timeAgo = formatDistanceToNow(new Date(row.original.updated_at), { addSuffix: true })
        if (!s) return <span className="text-xs text-muted-foreground">—</span>
        return (
          <div className="flex items-center gap-2 min-w-0">
            <UserAvatar name={s.full_name} email={s.email} avatarUrl={s.avatar_url} />
            <div className="min-w-0">
              <p className="text-sm truncate max-w-30 leading-tight">{s.full_name || s.email}</p>
              <p className="text-[11px] text-muted-foreground leading-tight">{timeAgo}</p>
            </div>
          </div>
        )
      },
    }),
    pendingCol.accessor('target_date', {
      header: ({ column }) => <SortableHeader column={column} label="Target" />,
      cell: ({ getValue }) => {
        const v = getValue()
        return v
          ? <span className="text-sm text-muted-foreground whitespace-nowrap">{format(new Date(v), 'dd MMM yyyy')}</span>
          : <span className="text-sm text-muted-foreground">—</span>
      },
    }),
  ], [])

  const table = useReactTable({
    data: queue,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  const rows = table.getRowModel().rows

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Search deliverables…"
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
        </div>
        {!isLoading && (
          <span className="text-xs text-muted-foreground">
            {queue.length} pending {queue.length === 1 ? 'item' : 'items'}
          </span>
        )}
      </div>

      {!isLoading && queue.length === 0 ? (
        <Empty className="py-20">
          <EmptyContent>
            <EmptyHeader>
              <CheckCircle2 className="size-9 text-muted-foreground/30 mx-auto mb-3" />
              <EmptyTitle className="font-bold text-xl">All caught up</EmptyTitle>
              <EmptyDescription>No deliverables waiting for review.</EmptyDescription>
            </EmptyHeader>
          </EmptyContent>
        </Empty>
      ) : !isLoading && rows.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">No results match your search.</p>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
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
                ? Array.from({ length: 4 }).map((_, i) => <PendingRowSkeleton key={i} />)
                : rows.map((row) => (
                    <TableRow
                      key={row.id}
                      className="cursor-pointer hover:bg-muted/40 transition-colors"
                      onClick={() => setSelectedItem(row.original)}
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
      )}

      <ApprovalDetailDialog
        item={selectedItem}
        open={!!selectedItem}
        onOpenChange={(open) => { if (!open) setSelectedItem(null) }}
      />
    </div>
  )
}

// ── Approved / Changes Requested log tabs (shared layout) ─────────────────────

const logCol = createColumnHelper()

function LogTab({ action, emptyLabel, emptyDescription }) {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(0)
  const [globalFilter, setGlobalFilter] = useState('')
  const [deletingIds, setDeletingIds] = useState(null)

  const { data, isLoading } = useApprovalLog({ action, page, pageSize: PAGE_SIZE })
  const events = data?.events ?? []
  const total = data?.total ?? 0
  const totalPages = Math.ceil(total / PAGE_SIZE)

  const deleteMutation = useMutation({
    mutationFn: (ids) => deleteApprovalEvents(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approval-log'] })
      toast.success('Log entry removed')
      setDeletingIds(null)
    },
    onError: (err) => toast.error(err.message),
  })

  const columns = useMemo(() => [
    logCol.accessor('post_title', {
      header: () => <ColHeader label="Deliverable" />,
      enableSorting: false,
      cell: ({ row }) => {
        const e = row.original
        return (
          <NavLink
            to={`/clients/${e.client_id}/posts/${e.post_id}`}
            onClick={(ev) => ev.stopPropagation()}
            className="flex items-center gap-3 min-w-0 group/link"
          >
            <InlineThumb urls={e.post_media_urls} />
            <div className="min-w-0">
              <p className="text-sm font-medium leading-tight truncate max-w-50 group-hover/link:underline">{e.post_title}</p>
              {e.post_content && (
                <p className="text-xs text-muted-foreground truncate max-w-50 mt-0.5">{e.post_content}</p>
              )}
            </div>
          </NavLink>
        )
      },
    }),
    logCol.accessor('client_name', {
      header: () => <ColHeader label="Client" />,
      enableSorting: false,
      cell: ({ row }) => {
        const e = row.original
        return (
          <div className="flex items-center gap-2 min-w-0">
            <ClientAvatar name={e.client_name} logoUrl={e.client_logo_url} />
            <span className="text-sm truncate max-w-27.5">{e.client_name}</span>
          </div>
        )
      },
    }),
    logCol.accessor('submitter_name', {
      header: () => <ColHeader label="Submitted by" />,
      enableSorting: false,
      cell: ({ row }) => {
        const e = row.original
        if (!e.submitter_name && !e.submitter_email) return <span className="text-sm text-muted-foreground">—</span>
        return (
          <div className="flex items-center gap-2 min-w-0">
            <UserAvatar name={e.submitter_name} email={e.submitter_email} avatarUrl={e.submitter_avatar_url} />
            <span className="text-sm truncate max-w-32.5">{e.submitter_name || e.submitter_email}</span>
          </div>
        )
      },
    }),
    logCol.accessor('actor_name', {
      header: () => <ColHeader label="By" />,
      enableSorting: false,
      cell: ({ row }) => {
        const e = row.original
        return (
          <div className="flex items-center gap-2 min-w-0">
            <UserAvatar name={e.actor_name} email={e.actor_email} avatarUrl={e.actor_avatar_url} />
            <span className="text-sm truncate max-w-32.5">{e.actor_name}</span>
          </div>
        )
      },
    }),
    ...(action === 'changes_requested' ? [logCol.accessor('notes', {
      header: () => <ColHeader label="Notes" />,
      enableSorting: false,
      cell: ({ getValue }) => {
        const n = getValue()
        return n
          ? <span className="text-sm text-muted-foreground truncate max-w-50 block">{n}</span>
          : <span className="text-sm text-muted-foreground/40">—</span>
      },
    })] : []),
    logCol.accessor('created_at', {
      header: () => <ColHeader label="When" />,
      enableSorting: false,
      cell: ({ getValue }) => (
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          {formatDistanceToNow(new Date(getValue()), { addSuffix: true })}
        </span>
      ),
    }),
    logCol.display({
      id: 'delete',
      cell: ({ row }) => (
        <button
          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive p-1 rounded"
          onClick={(e) => { e.stopPropagation(); setDeletingIds([row.original.id]) }}
          title="Remove log entry"
        >
          <Trash2 className="size-3.5" />
        </button>
      ),
    }),
  ], [action])

  const table = useReactTable({
    data: events,
    columns,
    state: { globalFilter },
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Search deliverables…"
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
        </div>
        {!isLoading && (
          <p className="text-xs text-muted-foreground">
            {total} {total === 1 ? 'entry' : 'entries'}
          </p>
        )}
      </div>

      {!isLoading && events.length === 0 ? (
        <Empty className="py-20">
          <EmptyContent>
            <EmptyHeader>
              <RotateCcw className="size-9 text-muted-foreground/30 mx-auto mb-3" />
              <EmptyTitle className="font-bold text-xl">{emptyLabel}</EmptyTitle>
              <EmptyDescription>{emptyDescription}</EmptyDescription>
            </EmptyHeader>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
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
                ? Array.from({ length: 5 }).map((_, i) => <LogRowSkeleton key={i} />)
                : table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id} className="group hover:bg-muted/40 transition-colors">
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
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Page {page + 1} of {totalPages}</span>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="size-8" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="size-4" />
            </Button>
            <Button variant="ghost" size="icon" className="size-8" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

      <AlertDialog open={!!deletingIds} onOpenChange={(open) => { if (!open) setDeletingIds(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove log entry?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the audit record only — the post and its content are unaffected. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteMutation.mutate(deletingIds)}
            >
              {deleteMutation.isPending && <Loader2 size={13} className="animate-spin mr-1.5" />}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ApprovalsPage() {
  const { setHeader } = useHeader()
  const [searchParams, setSearchParams] = useSearchParams()
  const VALID_TABS = ['pending', 'approved', 'changes']
  const activeTab = VALID_TABS.includes(searchParams.get('tab')) ? searchParams.get('tab') : 'pending'

  const { data: pendingCount = 0 } = usePendingApprovalsCount()
  const { data: approvedCount = 0 } = useApprovalLogCount('approved')
  const { data: changesCount = 0 } = useApprovalLogCount('changes_requested')

  useEffect(() => {
    setHeader({ title: 'Approvals', breadcrumbs: [{ label: 'Approvals' }] })
  }, [setHeader])

  function setTab(tab) {
    setSearchParams((prev) => { prev.set('tab', tab); return prev }, { replace: true })
  }

  return (
    <div className="px-8 pt-8 pb-20 space-y-6 max-w-350 mx-auto animate-page-fade-in">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold bricolage tracking-tight">Approvals</h1>
        <p className="text-sm text-muted-foreground">
          Review member-submitted deliverables and track your team's approval history.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setTab}>
        <TabsList className="bg-transparent h-auto w-full justify-start rounded-none p-0 gap-8 border-b border-border/40">
          <TabsTrigger value="pending" className={TAB_TRIGGER_CLASS}>
            Pending
            {pendingCount > 0 && (
              <span className="tabular-nums text-xs text-muted-foreground">{pendingCount}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="approved" className={TAB_TRIGGER_CLASS}>
            Approved
            {approvedCount > 0 && (
              <span className="tabular-nums text-xs text-muted-foreground">{approvedCount}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="changes" className={TAB_TRIGGER_CLASS}>
            Changes Requested
            {changesCount > 0 && (
              <span className="tabular-nums text-xs text-muted-foreground">{changesCount}</span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-6">
          <PendingTab />
        </TabsContent>

        <TabsContent value="approved" className="mt-6">
          <LogTab
            action="approved"
            emptyLabel="No approvals yet"
            emptyDescription="Approved deliverables will appear here."
          />
        </TabsContent>

        <TabsContent value="changes" className="mt-6">
          <LogTab
            action="changes_requested"
            emptyLabel="No changes requested yet"
            emptyDescription="Deliverables sent back for revision will appear here."
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
