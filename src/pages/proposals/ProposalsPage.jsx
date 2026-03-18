import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus,
  Search,
  FileText,
  Pencil,
  Trash2,
  Archive,
  MoreHorizontal,
  Upload,
  ChevronDown,
  PenLine,
} from 'lucide-react'
import { toast } from 'sonner'

import { useHeader } from '@/components/misc/header-context'
import { useSubscription } from '@/api/useSubscription'
import { useProposals, useDeleteProposal } from '@/api/proposals'
import { useClients } from '@/api/clients'
import { ClientAvatar } from '@/components/NoteRow'
import { ProposalDialog } from '@/components/proposals/ProposalDialog'
import { UploadProposalDialog } from '@/components/proposals/UploadProposalDialog'
import { ProposalsUpgradePrompt } from '@/components/proposals/ProposalsUpgradePrompt'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { formatCurrency } from '@/utils/finance'
import { formatDate } from '@/lib/helper'
import { cn } from '@/lib/utils'

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  draft: {
    label: 'Draft',
    className: 'bg-muted text-muted-foreground border-transparent',
  },
  sent: {
    label: 'Sent',
    className:
      'bg-blue-100 text-blue-700 border-transparent dark:bg-blue-950 dark:text-blue-300',
  },
  viewed: {
    label: 'Viewed',
    className:
      'bg-violet-100 text-violet-700 border-transparent dark:bg-violet-950 dark:text-violet-300',
  },
  accepted: {
    label: 'Accepted',
    className:
      'bg-green-100 text-green-700 border-transparent dark:bg-green-950 dark:text-green-300',
  },
  declined: {
    label: 'Declined',
    className:
      'bg-red-100 text-red-700 border-transparent dark:bg-red-950 dark:text-red-300',
  },
  expired: {
    label: 'Expired',
    className:
      'bg-amber-100 text-amber-700 border-transparent dark:bg-amber-950 dark:text-amber-300',
  },
  archived: {
    label: 'Archived',
    className:
      'bg-slate-100 text-slate-500 border-transparent dark:bg-slate-800 dark:text-slate-400',
  },
}

const STATUS_TABS = ['all', 'draft', 'sent', 'viewed', 'accepted', 'declined', 'expired', 'archived']

function StatusBadge({ status }) {
  const config = STATUS_CONFIG[status] ?? { label: status, className: 'bg-muted text-muted-foreground' }
  return (
    <Badge variant="outline" className={cn('text-[11px] font-medium capitalize', config.className)}>
      {config.label}
    </Badge>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function ProposalRowSkeleton() {
  return (
    <div className="flex items-center gap-4 px-4 py-3.5 border-b border-border/50">
      <Skeleton className="h-4 w-48" />
      <Skeleton className="h-4 w-32 ml-auto" />
      <Skeleton className="h-5 w-16 rounded-full" />
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-4 w-24" />
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ProposalsPage() {
  const { setHeader } = useHeader()
  useEffect(() => {
    setHeader({ title: 'Proposals', breadcrumbs: [{ label: 'Proposals' }] })
  }, [setHeader])

  const navigate = useNavigate()
  const { data: sub } = useSubscription()
  const { data: proposals = [], isLoading } = useProposals()
  const { data: clientsData } = useClients()
  const deleteProposal = useDeleteProposal()

  const [activeTab, setActiveTab] = useState('all')
  const [search, setSearch] = useState('')
  const [clientFilter, setClientFilter] = useState('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [editingProposal, setEditingProposal] = useState(null)
  const [deletingProposal, setDeletingProposal] = useState(null)
  const [upgradeOpen, setUpgradeOpen] = useState(false)

  const realClients = clientsData?.realClients ?? []

  // Non-archived proposal count for limit check
  const activeCount = proposals.filter((p) => p.status !== 'archived').length
  const proposalsLimit = sub?.proposals_limit ?? null
  const atLimit = proposalsLimit !== null && activeCount >= proposalsLimit

  // Filtering
  const filtered = proposals.filter((p) => {
    // Tab filter
    if (activeTab === 'all' && p.status === 'archived') return false
    if (activeTab !== 'all' && p.status !== activeTab) return false

    // Client filter
    if (clientFilter !== 'all') {
      if (clientFilter === '__prospect__') {
        if (p.client_id) return false
      } else {
        if (p.client_id !== clientFilter) return false
      }
    }

    // Search
    if (search) {
      const q = search.toLowerCase()
      const titleMatch = p.title?.toLowerCase().includes(q)
      const clientMatch = p.client_name?.toLowerCase().includes(q)
      const prospectMatch = p.prospect_name?.toLowerCase().includes(q)
      if (!titleMatch && !clientMatch && !prospectMatch) return false
    }

    return true
  })

  function openNewDialog() {
    if (atLimit) {
      setUpgradeOpen(true)
    } else {
      setEditingProposal(null)
      setDialogOpen(true)
    }
  }

  function openEditDialog(proposal) {
    setEditingProposal(proposal)
    setDialogOpen(true)
  }

  async function handleDelete() {
    if (!deletingProposal) return
    try {
      await deleteProposal.mutateAsync({ id: deletingProposal.id, status: deletingProposal.status, file_url: deletingProposal.file_url })
      toast.success(
        deletingProposal.status === 'draft' ? 'Proposal deleted' : 'Proposal archived',
      )
    } catch (err) {
      toast.error(err.message || 'Something went wrong')
    } finally {
      setDeletingProposal(null)
    }
  }

  const isFiltered = search !== '' || clientFilter !== 'all'

  return (
    <div className="min-h-full bg-background">
      <div className="px-8 pt-8 pb-20 space-y-6 max-w-[1400px] mx-auto animate-in fade-in duration-700">

        {/* ── Header ── */}
        <div className="flex items-end justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-light tracking-tight text-foreground">
              Proposals{' '}
              {!isLoading && proposals.length > 0 && (
                <span className="text-muted-foreground/50 ml-2 font-extralight">
                  {proposals.length}
                </span>
              )}
            </h1>
            <p className="text-sm text-muted-foreground font-light">
              Create and send proposals to clients and prospects.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Usage counter — only shown when there's a limit */}
            {proposalsLimit !== null && (
              <span className="text-xs text-muted-foreground tabular-nums">
                {activeCount} of {proposalsLimit} used
              </span>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="gap-2 h-9">
                  <Plus size={16} />
                  New Proposal
                  <ChevronDown size={14} className="opacity-70" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem
                  onClick={() => {
                    if (atLimit) { setUpgradeOpen(true) } else { setEditingProposal(null); setDialogOpen(true) }
                  }}
                >
                  <PenLine className="size-4 mr-2" />
                  Build in Tercero
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    if (atLimit) { setUpgradeOpen(true) } else { setUploadDialogOpen(true) }
                  }}
                >
                  <Upload className="size-4 mr-2" />
                  Upload Existing File
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* ── Toolbar ── */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search proposals..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-muted/20 border-border/40"
            />
          </div>

          <Select value={clientFilter} onValueChange={setClientFilter}>
            <SelectTrigger className="w-[180px] bg-muted/20 border-border/40">
              <SelectValue placeholder="All clients" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Clients</SelectItem>
              <SelectItem value="__prospect__">Prospects</SelectItem>
              {realClients.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  <div className="flex items-center gap-2">
                    <ClientAvatar client={c} size="sm" />
                    <span className="truncate">{c.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {isFiltered && (
            <Button
              variant="ghost"
              onClick={() => { setSearch(''); setClientFilter('all') }}
              className="text-muted-foreground h-9 px-3"
            >
              Reset
            </Button>
          )}
        </div>

        {/* ── Status tabs ── */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="bg-transparent h-auto w-full justify-start rounded-none p-0 gap-8 border-b border-border/40">
            {STATUS_TABS.map((tab) => {
              const count = tab === 'all'
                ? proposals.filter((p) => p.status !== 'archived').length
                : proposals.filter((p) => p.status === tab).length
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
                  {tab === 'all' ? 'All' : STATUS_CONFIG[tab]?.label ?? tab}
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

        {/* ── Content ── */}
        {isLoading ? (
          <div className="rounded-xl border border-border/50 overflow-hidden bg-card">
            {Array.from({ length: 5 }).map((_, i) => (
              <ProposalRowSkeleton key={i} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Empty className="py-20 border border-dashed rounded-2xl bg-muted/5 animate-in fade-in duration-500">
            <EmptyContent>
              <EmptyMedia variant="icon">
                <FileText className="size-6 text-muted-foreground/60" />
              </EmptyMedia>
              <EmptyHeader>
                <EmptyTitle className="font-normal text-xl">No Proposals Found</EmptyTitle>
                <EmptyDescription className="font-light">
                  {isFiltered || activeTab !== 'all'
                    ? "No proposals match your current filters."
                    : "You haven't created any proposals yet. Start by creating your first one."}
                </EmptyDescription>
              </EmptyHeader>
              {!isFiltered && activeTab === 'all' && (
                <Button
                  onClick={openNewDialog}
                  variant="outline"
                  className="mt-2"
                >
                  <Plus className="size-4 mr-2" />
                  Create your first proposal
                </Button>
              )}
            </EmptyContent>
          </Empty>
        ) : (
          <div className="rounded-xl border border-border/50 overflow-hidden bg-card">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-4 px-4 py-2.5 border-b border-border/50 bg-muted/30">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Proposal
              </span>
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider w-24 text-right">
                Total
              </span>
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider w-24">
                Status
              </span>
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider w-28">
                Valid Until
              </span>
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider w-28">
                Created
              </span>
              <span className="w-8" />
            </div>

            {/* Rows */}
            {filtered.map((proposal) => {
              const displayName =
                proposal.client_name || proposal.prospect_name || '—'
              return (
                <div
                  key={proposal.id}
                  onClick={() => navigate(`/proposals/${proposal.id}`)}
                  className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-4 px-4 py-3.5 border-b border-border/40 last:border-b-0 hover:bg-muted/20 transition-colors group items-center cursor-pointer"
                >
                  {/* Title + client */}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                      {proposal.title}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {displayName}
                      {!proposal.client_id && proposal.prospect_name && (
                        <span className="ml-1.5 text-[10px] opacity-60">(prospect)</span>
                      )}
                    </p>
                  </div>

                  {/* Total */}
                  <span className="text-sm font-medium tabular-nums w-24 text-right">
                    {formatCurrency(proposal.total_value ?? 0)}
                  </span>

                  {/* Status */}
                  <div className="w-24">
                    <StatusBadge status={proposal.status} />
                  </div>

                  {/* Valid Until */}
                  <span className="text-xs text-muted-foreground w-28">
                    {proposal.valid_until ? formatDate(proposal.valid_until) : '—'}
                  </span>

                  {/* Created */}
                  <span className="text-xs text-muted-foreground w-28">
                    {formatDate(proposal.created_at)}
                  </span>

                  {/* Actions */}
                  <div className="w-8 flex justify-end" onClick={(e) => e.stopPropagation()}>
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
                        {proposal.status !== 'archived' && proposal.proposal_type !== 'uploaded' && (
                          <>
                            <DropdownMenuItem onClick={() => openEditDialog(proposal)}>
                              <Pencil className="size-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                          </>
                        )}
                        <DropdownMenuItem
                          onClick={() => setDeletingProposal(proposal)}
                          className="text-destructive focus:text-destructive"
                        >
                          {proposal.status === 'draft' ? (
                            <>
                              <Trash2 className="size-4 mr-2" />
                              Delete
                            </>
                          ) : (
                            <>
                              <Archive className="size-4 mr-2" />
                              Archive
                            </>
                          )}
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

      {/* ── Dialogs ── */}
      <ProposalDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        proposalId={editingProposal?.id}
        onSuccess={() => setEditingProposal(null)}
        onUpgradeNeeded={() => { setDialogOpen(false); setUpgradeOpen(true) }}
      />

      <UploadProposalDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        onUpgradeNeeded={() => { setUploadDialogOpen(false); setUpgradeOpen(true) }}
      />

      <ProposalsUpgradePrompt
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        limit={proposalsLimit ?? 5}
      />

      <AlertDialog
        open={!!deletingProposal}
        onOpenChange={(v) => !v && setDeletingProposal(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deletingProposal?.status === 'draft'
                ? 'Delete Proposal?'
                : 'Archive Proposal?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deletingProposal?.status === 'draft' ? (
                <>
                  This will permanently delete{' '}
                  <strong>{deletingProposal?.title}</strong>. This action cannot
                  be undone.
                </>
              ) : (
                <>
                  <strong>{deletingProposal?.title}</strong> will be archived
                  and hidden from your active proposals.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingProposal?.status === 'draft' ? 'Delete' : 'Archive'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
