import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus,
  Search,
  FileText,
  Pencil,
  Trash2,
  Archive,
  MoreHorizontal,
  ChevronRight,
  Upload,
  ChevronDown,
  PenLine,
} from 'lucide-react'
import { toast } from 'sonner'

import { useSubscription } from '@/api/useSubscription'
import { useProposals, useDeleteProposal } from '@/api/proposals'
import { ProposalDialog } from '@/components/proposals/ProposalDialog'
import { UploadProposalDialog } from '@/components/proposals/UploadProposalDialog'
import { ProposalsUpgradePrompt } from '@/components/proposals/ProposalsUpgradePrompt'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
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

const STATUS_TABS = [
  'all',
  'draft',
  'sent',
  'viewed',
  'accepted',
  'declined',
  'expired',
  'archived',
]

function StatusBadge({ status }) {
  const config = STATUS_CONFIG[status] ?? {
    label: status,
    className: 'bg-muted text-muted-foreground',
  }
  return (
    <Badge
      variant="outline"
      className={cn('text-[11px] font-medium capitalize', config.className)}
    >
      {config.label}
    </Badge>
  )
}

function ProposalRowSkeleton() {
  return (
    <div className="flex items-center gap-4 px-4 py-3.5 border-b border-border/50">
      <Skeleton className="h-4 w-48" />
      <Skeleton className="h-4 w-24 ml-auto" />
      <Skeleton className="h-5 w-16 rounded-full" />
      <Skeleton className="h-4 w-20" />
    </div>
  )
}

// ── Tab component ─────────────────────────────────────────────────────────────

export function ProposalTab({ clientId, prospectId, prospectName, prospectEmail }) {
  const navigate = useNavigate()
  const { data: sub } = useSubscription()
  const { data: proposals = [], isLoading } = useProposals({ clientId, prospectId })
  const { data: allProposals = [] } = useProposals() // workspace-wide count for limit check
  const deleteProposal = useDeleteProposal()

  const [activeTab, setActiveTab] = useState('all')
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [editingProposal, setEditingProposal] = useState(null)
  const [deletingProposal, setDeletingProposal] = useState(null)
  const [upgradeOpen, setUpgradeOpen] = useState(false)

  // Limit check is workspace-wide, not scoped to this client
  const activeCount = allProposals.filter((p) => p.status !== 'archived').length
  const proposalsLimit = sub?.proposals_limit ?? null
  const atLimit = proposalsLimit !== null && activeCount >= proposalsLimit

  function openNewDialog() {
    if (atLimit) {
      setUpgradeOpen(true)
    } else {
      setEditingProposal(null)
      setDialogOpen(true)
    }
  }

  function openUploadDialog() {
    if (atLimit) {
      setUpgradeOpen(true)
    } else {
      setUploadDialogOpen(true)
    }
  }

  // Filter
  const filtered = proposals.filter((p) => {
    if (activeTab === 'all' && p.status === 'archived') return false
    if (activeTab !== 'all' && p.status !== activeTab) return false
    if (search) {
      const q = search.toLowerCase()
      if (
        !p.title?.toLowerCase().includes(q) &&
        !p.prospect_name?.toLowerCase().includes(q)
      )
        return false
    }
    return true
  })

  async function handleDelete() {
    if (!deletingProposal) return
    try {
      await deleteProposal.mutateAsync({
        id: deletingProposal.id,
        status: deletingProposal.status,
        file_url: deletingProposal.file_url,
      })
      toast.success(
        deletingProposal.status === 'draft'
          ? 'Proposal deleted'
          : 'Proposal archived',
      )
    } catch (err) {
      toast.error(err.message || 'Something went wrong')
    } finally {
      setDeletingProposal(null)
    }
  }

  return (
    <div className="space-y-4 py-4">
      {/* ── Toolbar ── */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search proposals..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-muted/20 border-border/40"
          />
        </div>
        <div className="ml-auto flex items-center gap-2">
          {proposalsLimit !== null && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {activeCount} of {proposalsLimit} used
            </span>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="gap-2 h-9">
                <Plus className="size-4" />
                New Proposal
                <ChevronDown className="size-3.5 opacity-70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem
                onClick={() => {
                  if (atLimit) {
                    setUpgradeOpen(true)
                  } else {
                    setEditingProposal(null)
                    setDialogOpen(true)
                  }
                }}
              >
                <PenLine className="size-4 mr-2" />
                Build in Tercero
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  if (atLimit) {
                    setUpgradeOpen(true)
                  } else {
                    setUploadDialogOpen(true)
                  }
                }}
              >
                <Upload className="size-4 mr-2" />
                Upload Existing File
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ── Status tabs ── */}
      <div className="flex gap-1 flex-wrap border-b border-border/50">
        {STATUS_TABS.map((tab) => {
          const count =
            tab === 'all'
              ? proposals.filter((p) => p.status !== 'archived').length
              : proposals.filter((p) => p.status === tab).length
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'px-3 py-2 text-[13px] font-medium capitalize border-b-2 -mb-px transition-colors',
                activeTab === tab
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {tab === 'all' ? 'All' : (STATUS_CONFIG[tab]?.label ?? tab)}
              {count > 0 && (
                <span className="ml-1.5 text-[10px] opacity-60 tabular-nums">
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ── Content ── */}
      {isLoading ? (
        <div className="rounded-xl border border-border/50 overflow-hidden bg-card">
          {Array.from({ length: 3 }).map((_, i) => (
            <ProposalRowSkeleton key={i} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Empty className="py-16 border border-dashed rounded-2xl bg-muted/5">
          <EmptyContent>
            <div className="text-4xl leading-none select-none mb-2">📋</div>
            <EmptyHeader>
              <EmptyTitle className="font-normal text-lg">
                No Proposals
              </EmptyTitle>
              <EmptyDescription className="font-normal">
                {search || activeTab !== 'all'
                  ? 'No proposals match your current filters.'
                  : prospectId
                  ? 'No proposals for this prospect yet. Create the first one.'
                  : 'No proposals for this client yet. Create the first one.'}
              </EmptyDescription>
            </EmptyHeader>
            {!search && activeTab === 'all' && (
              <Button
                onClick={openNewDialog}
                variant="outline"
                className="mt-2"
              >
                <Plus className="size-4 mr-2" />
                New Proposal
              </Button>
            )}
          </EmptyContent>
        </Empty>
      ) : (
        <div className="rounded-xl border border-border/50 overflow-hidden bg-card">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-4 py-2.5 border-b border-border/50 bg-muted/30">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Proposal
            </span>
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider w-24 text-right">
              Total
            </span>
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider w-24 text-center">
              Status
            </span>
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider w-28 text-right">
              Valid Until
            </span>
            <span className="w-8" />
          </div>

          {/* Rows */}
          {filtered.map((proposal) => (
            <div
              key={proposal.id}
              className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-4 py-3.5 border-b border-border/40 last:border-b-0 hover:bg-muted/20 transition-colors group items-center"
            >
              {/* Title */}
              <button
                onClick={() => navigate(`/proposals/${proposal.id}`)}
                className="text-left min-w-0"
              >
                <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                  {proposal.title}
                </p>
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {formatDate(proposal.created_at)}
                </p>
              </button>

              {/* Total */}
              <span className="text-sm font-medium tabular-nums w-24 text-right">
                {formatCurrency(proposal.total_value ?? 0)}
              </span>

              {/* Status */}
              <div className="w-24 flex justify-center">
                <StatusBadge status={proposal.status} />
              </div>

              {/* Valid Until */}
              <span className="text-xs text-muted-foreground w-28 text-right tabular-nums">
                {proposal.valid_until ? formatDate(proposal.valid_until) : '—'}
              </span>

              {/* Actions */}
              <div className="w-8 flex justify-end">
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
                    <DropdownMenuItem
                      onClick={() => navigate(`/proposals/${proposal.id}`)}
                    >
                      <ChevronRight className="size-4 mr-2" />
                      View Details
                    </DropdownMenuItem>
                    {proposal.status !== 'archived' &&
                      proposal.proposal_type !== 'uploaded' && (
                        <DropdownMenuItem
                          onClick={() => {
                            setEditingProposal(proposal)
                            setDialogOpen(true)
                          }}
                        >
                          <Pencil className="size-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                      )}
                    <DropdownMenuSeparator />
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
          ))}
        </div>
      )}

      {/* ── Dialogs ── */}
      <ProposalDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        proposalId={editingProposal?.id}
        clientId={clientId}
        prospectId={prospectId}
        prospectName={prospectName}
        prospectEmail={prospectEmail}
        onSuccess={() => setEditingProposal(null)}
        onUpgradeNeeded={() => {
          setDialogOpen(false)
          setUpgradeOpen(true)
        }}
      />

      <UploadProposalDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        clientId={clientId}
        prospectId={prospectId}
        prospectName={prospectName}
        prospectEmail={prospectEmail}
        onUpgradeNeeded={() => {
          setUploadDialogOpen(false)
          setUpgradeOpen(true)
        }}
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
                  and hidden from active proposals.
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
