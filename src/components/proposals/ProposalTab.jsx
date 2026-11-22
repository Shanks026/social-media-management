import { formatDate, formatCurrency } from '@/lib/format'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Archive,
  MoreHorizontal,
  Upload,
} from 'lucide-react'
import { toast } from 'sonner'

import { useProposals, useProposalLimit, useDeleteProposal } from '@/api/proposals'
import { ProposalDialog } from '@/components/proposals/ProposalDialog'
import { UploadProposalDialog } from '@/components/proposals/UploadProposalDialog'
import { ProposalsUpgradePrompt } from '@/components/proposals/ProposalsUpgradePrompt'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
import StatusBadge from '@/components/StatusBadge'
import {
  DISPLAY_STATUSES,
  statusLabel as proposalStatusLabel,
} from '@/lib/domain/proposalStatus'

const STATUS_TABS = ['all', ...DISPLAY_STATUSES]

function ProposalRowSkeleton() {
  return (
    <TableRow>
      <TableCell className="px-4 py-3"><Skeleton className="h-4 w-48" /></TableCell>
      <TableCell className="w-[12%] px-4 py-3"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
      <TableCell className="w-[14%] px-4 py-3"><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
      <TableCell className="w-[14%] px-4 py-3"><Skeleton className="h-4 w-20" /></TableCell>
      <TableCell className="w-[14%] px-4 py-3"><Skeleton className="h-4 w-20" /></TableCell>
      <TableCell className="w-[6%] px-4 py-3" />
    </TableRow>
  )
}

// ── Tab component ─────────────────────────────────────────────────────────────

/**
 * The one Proposals list. Its scope is a Client (`clientId`), a Prospect (the
 * `prospect` record), or neither; giving both is a programming error.
 */
export function ProposalTab({ clientId, prospect }) {
  if (clientId && prospect) {
    throw new Error('ProposalTab is scoped to a Client or a Prospect, not both')
  }
  const prospectId = prospect?.id
  const prospectName = prospect?.business_name ?? null
  const prospectEmail = prospect?.email ?? null
  const navigate = useNavigate()
  const { used: activeCount, limit: proposalsLimit, atLimit } = useProposalLimit()
  const { data: proposals = [], isLoading } = useProposals({ clientId, prospectId })
  const deleteProposal = useDeleteProposal()

  const [activeTab, setActiveTab] = useState('all')
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [editingProposal, setEditingProposal] = useState(null)
  const [deletingProposal, setDeletingProposal] = useState(null)
  const [upgradeOpen, setUpgradeOpen] = useState(false)


  function openUploadDialog() {
    if (atLimit) {
      setUpgradeOpen(true)
    } else {
      setUploadDialogOpen(true)
    }
  }

  const isFiltered = search !== ''
  // A status tab narrows the list too: its empty state is "nothing matches".
  const narrowed = isFiltered || activeTab !== 'all'

  const filtered = proposals.filter((p) => {
    if (activeTab === 'all' && p.status === 'ARCHIVED') return false
    if (activeTab !== 'all' && p.status !== activeTab) return false
    if (search) {
      const q = search.toLowerCase()
      if (
        !p.title?.toLowerCase().includes(q) &&
        !p.client_name?.toLowerCase().includes(q) &&
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
        deletingProposal.status === 'DRAFT'
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
        {isFiltered && (
          <Button
            variant="ghost"
            onClick={() => setSearch('')}
            className="text-muted-foreground h-9 px-3"
          >
            Reset
          </Button>
        )}
        <div className="ml-auto flex items-center gap-2">
          {proposalsLimit !== null && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {activeCount} of {proposalsLimit} used
            </span>
          )}
          <Button size="sm" className="gap-2 h-9" onClick={openUploadDialog}>
            <Plus className="size-4" />
            New Proposal
          </Button>
        </div>
      </div>

      {/* ── Status tabs ── */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList variant="underline">
          {STATUS_TABS.map((tab) => {
            const count =
              tab === 'all'
                ? proposals.filter((p) => p.status !== 'ARCHIVED').length
                : proposals.filter((p) => p.status === tab).length
            return (
              <TabsTrigger key={tab} value={tab}>
                {tab === 'all' ? 'All' : proposalStatusLabel(tab)}
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
          <Table className="table-fixed">
            <TableBody>
              {Array.from({ length: 3 }).map((_, i) => (
                <ProposalRowSkeleton key={i} />
              ))}
            </TableBody>
          </Table>
        </div>
      ) : filtered.length === 0 ? (
        <Empty className="py-16 border border-dashed rounded-2xl bg-muted/5">
          <EmptyContent>
            <div className="text-4xl leading-none select-none mb-2">📋</div>
            <EmptyHeader>
              <EmptyTitle className="font-bold text-xl">
                No Proposals
              </EmptyTitle>
              <EmptyDescription className="font-normal">
                {narrowed
                  ? 'No proposals match your filters.'
                  : prospectId
                    ? 'No proposals for this prospect yet.'
                    : 'No proposals for this client yet.'}
              </EmptyDescription>
            </EmptyHeader>
            {!narrowed && (
              <Button onClick={openUploadDialog} variant="outline" className="mt-2">
                <Upload className="size-4 mr-2" />
                Upload a proposal
              </Button>
            )}
          </EmptyContent>
        </Empty>
      ) : (
        <div className="rounded-xl border border-border/50 overflow-hidden bg-card">
          {/* Percentage widths + table-fixed: the Proposal column declares
              none, so it absorbs the remainder and truncates to fit. */}
          <Table className="table-fixed">
            <TableHeader>
              <TableRow className="hover:bg-transparent bg-muted/30">
                <TableHead className="px-4 py-2.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Proposal
                </TableHead>
                <TableHead className="w-[12%] px-4 py-2.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider text-right">
                  Total
                </TableHead>
                <TableHead className="w-[14%] px-4 py-2.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Status
                </TableHead>
                <TableHead className="w-[14%] px-4 py-2.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Valid Until
                </TableHead>
                <TableHead className="w-[14%] px-4 py-2.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Created
                </TableHead>
                <TableHead className="w-[6%] px-4 py-2.5" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((proposal) => (
                <TableRow
                  key={proposal.id}
                  onClick={() => navigate(`/proposals/${proposal.id}`)}
                  className="group cursor-pointer hover:bg-muted/40 transition-colors"
                >
                  {/* Title: a real link, so the keyboard and new tabs work */}
                  <TableCell className="px-4 py-3">
                    <Link
                      to={`/proposals/${proposal.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="block text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors focus-visible:outline-none focus-visible:underline"
                    >
                      {proposal.title}
                    </Link>
                  </TableCell>

                  {/* Total */}
                  <TableCell className="px-4 py-3 text-sm font-medium tabular-nums text-right">
                    {formatCurrency(proposal.total_value ?? 0)}
                  </TableCell>

                  {/* Status */}
                  <TableCell className="px-4 py-3">
                    <StatusBadge entity="proposal" status={proposal.status} />
                  </TableCell>

                  {/* Valid Until */}
                  <TableCell className="px-4 py-3 text-xs text-muted-foreground">
                    {proposal.valid_until ? formatDate(proposal.valid_until) : '—'}
                  </TableCell>

                  {/* Created */}
                  <TableCell className="px-4 py-3 text-xs text-muted-foreground">
                    {formatDate(proposal.created_at)}
                  </TableCell>

                  {/* Actions */}
                  <TableCell className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Actions"
                          className="size-7 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100 transition-opacity"
                        >
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {proposal.status !== 'ARCHIVED' &&
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
                          {proposal.status === 'DRAFT' ? (
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
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
              {deletingProposal?.status === 'DRAFT'
                ? 'Delete Proposal?'
                : 'Archive Proposal?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deletingProposal?.status === 'DRAFT' ? (
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
              {deletingProposal?.status === 'DRAFT' ? 'Delete' : 'Archive'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
