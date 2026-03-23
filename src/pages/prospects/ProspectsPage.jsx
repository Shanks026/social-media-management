import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus,
  Search,
  Upload,
  MoreHorizontal,
  Pencil,
  Trash2,
  Target,
  CalendarClock,
} from 'lucide-react'
import { toast } from 'sonner'

import { useHeader } from '@/components/misc/header-context'
import { useProspects, useDeleteProspect, PROSPECT_STATUSES } from '@/api/prospects'
import { ProspectStatusBadge } from '@/components/prospects/ProspectStatusBadge'
import { ProspectSourceBadge } from '@/components/prospects/ProspectSourceBadge'
import { AddProspectDialog } from '@/components/prospects/AddProspectDialog'
import { ImportProspectsDialog } from '@/components/prospects/ImportProspectsDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
  EmptyMedia,
} from '@/components/ui/empty'
import { formatDate } from '@/lib/helper'
import { cn } from '@/lib/utils'

// ── Skeleton ──────────────────────────────────────────────────────────────────

function ProspectRowSkeleton() {
  return (
    <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-4 px-4 py-3.5 border-b border-border/40 items-center">
      <div className="space-y-1.5">
        <Skeleton className="h-3.5 w-40" />
        <Skeleton className="h-3 w-28" />
      </div>
      <Skeleton className="h-3.5 w-24" />
      <Skeleton className="h-5 w-20 rounded-full" />
      <Skeleton className="h-5 w-16 rounded-full" />
      <Skeleton className="h-3.5 w-20" />
      <Skeleton className="size-7 rounded" />
    </div>
  )
}

// ── Status tabs ───────────────────────────────────────────────────────────────

const STATUS_TABS = ['all', ...PROSPECT_STATUSES.map((s) => s.value)]

// ── Overdue helper ────────────────────────────────────────────────────────────

function isOverdue(dateStr) {
  if (!dateStr) return false
  return new Date(dateStr) < new Date()
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ProspectsPage() {
  const { setHeader } = useHeader()
  useEffect(() => {
    setHeader({ title: 'Prospects', breadcrumbs: [{ label: 'Prospects' }] })
  }, [setHeader])

  const navigate = useNavigate()
  const [activeTab, setActiveTab]               = useState('all')
  const [search, setSearch]                     = useState('')
  const [addOpen, setAddOpen]                   = useState(false)
  const [importOpen, setImportOpen]             = useState(false)
  const [deletingProspect, setDeletingProspect] = useState(null)

  const { data: prospects = [], isLoading } = useProspects({ search })
  const deleteProspect = useDeleteProspect()

  // Client-side status filter (search is server-side)
  const filtered = prospects.filter((p) => {
    if (activeTab !== 'all' && p.status !== activeTab) return false
    return true
  })

  const isFiltered = search !== '' || activeTab !== 'all'

  async function handleDelete() {
    if (!deletingProspect) return
    try {
      await deleteProspect.mutateAsync(deletingProspect.id)
      toast.success('Prospect deleted')
    } catch (err) {
      toast.error(err.message || 'Something went wrong')
    } finally {
      setDeletingProspect(null)
    }
  }

  return (
    <div className="min-h-full bg-background">
      <div className="px-8 pt-8 pb-20 space-y-6 max-w-[1400px] mx-auto animate-in fade-in duration-700">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-end justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-normal tracking-tight text-foreground">
              Prospects{' '}
              {!isLoading && prospects.length > 0 && (
                <span className="text-muted-foreground/50 ml-2 font-extralight">
                  {prospects.length}
                </span>
              )}
            </h1>
            <p className="text-sm text-muted-foreground font-normal">
              Track leads and manage your sales pipeline.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              className="gap-2 h-9"
              onClick={() => setImportOpen(true)}
            >
              <Upload size={15} />
              Import CSV
            </Button>
            <Button
              className="gap-2 h-9"
              onClick={() => setAddOpen(true)}
            >
              <Plus size={16} />
              Add Prospect
            </Button>
          </div>
        </div>

        {/* ── Toolbar ────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search prospects..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-muted/20 border-border/40"
            />
          </div>
          {isFiltered && (
            <Button
              variant="ghost"
              onClick={() => { setSearch(''); setActiveTab('all') }}
              className="text-muted-foreground h-9 px-3"
            >
              Reset
            </Button>
          )}
        </div>

        {/* ── Status Tabs ────────────────────────────────────────────────── */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="bg-transparent h-auto w-full justify-start rounded-none p-0 gap-8 border-b border-border/40 overflow-x-auto">
            {STATUS_TABS.map((tab) => {
              const count =
                tab === 'all'
                  ? prospects.length
                  : prospects.filter((p) => p.status === tab).length
              const label =
                tab === 'all'
                  ? 'All'
                  : PROSPECT_STATUSES.find((s) => s.value === tab)?.label ?? tab

              return (
                <TabsTrigger
                  key={tab}
                  value={tab}
                  className="
                    relative rounded-none bg-transparent px-0 pb-3 pt-0 text-[13px] font-medium transition-none
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
                  {label}
                  {count > 0 && (
                    <Badge
                      variant="secondary"
                      className="text-xs px-1.5 py-0 min-w-5 text-center"
                    >
                      {count}
                    </Badge>
                  )}
                </TabsTrigger>
              )
            })}
          </TabsList>
        </Tabs>

        {/* ── Content ────────────────────────────────────────────────────── */}
        {isLoading ? (
          <div className="rounded-xl border border-border/50 overflow-hidden bg-card">
            {Array.from({ length: 6 }).map((_, i) => (
              <ProspectRowSkeleton key={i} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Empty className="py-20 border border-dashed rounded-2xl bg-muted/5 animate-in fade-in duration-500">
            <EmptyContent>
              <EmptyMedia variant="icon">
                <Target className="size-6 text-muted-foreground/60" />
              </EmptyMedia>
              <EmptyHeader>
                <EmptyTitle className="font-normal text-xl">
                  {isFiltered ? 'No Prospects Found' : 'No Prospects Yet'}
                </EmptyTitle>
                <EmptyDescription className="font-normal">
                  {isFiltered
                    ? 'No prospects match your current filters.'
                    : 'Import a CSV from Apollo, Apify, or Google Maps — or add your first prospect manually.'}
                </EmptyDescription>
              </EmptyHeader>
              {!isFiltered && (
                <div className="flex items-center gap-3 mt-2">
                  <Button
                    variant="outline"
                    onClick={() => setImportOpen(true)}
                  >
                    <Upload className="size-4 mr-2" />
                    Import CSV
                  </Button>
                  <Button onClick={() => setAddOpen(true)}>
                    <Plus className="size-4 mr-2" />
                    Add Manually
                  </Button>
                </div>
              )}
            </EmptyContent>
          </Empty>
        ) : (
          <div className="rounded-xl border border-border/50 overflow-hidden bg-card">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-4 px-4 py-2.5 border-b border-border/50 bg-muted/30">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Prospect
              </span>
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider w-28">
                Location
              </span>
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider w-28">
                Status
              </span>
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider w-20">
                Source
              </span>
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider w-28">
                Follow-up
              </span>
              <span className="w-8" />
            </div>

            {/* Rows */}
            {filtered.map((prospect) => {
              const overdue = isOverdue(prospect.next_followup_at)
              return (
                <div
                  key={prospect.id}
                  onClick={() => navigate(`/prospects/${prospect.id}`)}
                  className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-4 px-4 py-3.5 border-b border-border/40 last:border-b-0 hover:bg-muted/20 transition-colors group items-center cursor-pointer"
                >
                  {/* Business + contact */}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                      {prospect.business_name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {[prospect.contact_name, prospect.email]
                        .filter(Boolean)
                        .join(' · ') || '—'}
                    </p>
                  </div>

                  {/* Location */}
                  <span className="text-xs text-muted-foreground w-28 truncate">
                    {prospect.location || '—'}
                  </span>

                  {/* Status */}
                  <div className="w-28">
                    <ProspectStatusBadge status={prospect.status} />
                  </div>

                  {/* Source */}
                  <div className="w-20">
                    <ProspectSourceBadge source={prospect.source} />
                  </div>

                  {/* Follow-up date */}
                  <div className="w-28">
                    {prospect.next_followup_at ? (
                      <span
                        className={cn(
                          'text-xs flex items-center gap-1',
                          overdue
                            ? 'text-amber-600 dark:text-amber-400 font-medium'
                            : 'text-muted-foreground'
                        )}
                      >
                        {overdue && <CalendarClock className="size-3 shrink-0" />}
                        {formatDate(prospect.next_followup_at)}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </div>

                  {/* Row actions */}
                  <div
                    className="w-8 flex justify-end"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => navigate(`/prospects/${prospect.id}`)}>
                          <Pencil className="size-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => setDeletingProspect(prospect)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="size-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Dialogs & Sheet ────────────────────────────────────────────────── */}
      <AddProspectDialog open={addOpen} onOpenChange={setAddOpen} />

      <ImportProspectsDialog open={importOpen} onOpenChange={setImportOpen} />

      <AlertDialog
        open={!!deletingProspect}
        onOpenChange={(v) => !v && setDeletingProspect(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Prospect?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete{' '}
              <strong>{deletingProspect?.business_name}</strong>. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
