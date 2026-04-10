import { useState, useEffect } from 'react'
import { Plus, Search, Megaphone } from 'lucide-react'
import { toast } from 'sonner'

import {
  useCampaigns,
  useDeleteCampaign,
  useUpdateCampaign,
} from '@/api/campaigns'
import { useSubscription } from '@/api/useSubscription'
import { CampaignCard } from './CampaignCard'
import { CampaignDialog } from './CampaignDialog'
import { CampaignUpgradePrompt } from './CampaignUpgradePrompt'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { Skeleton } from '@/components/ui/skeleton'
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
  EmptyMedia,
} from '@/components/ui/empty'

function CampaignSkeleton() {
  return (
    <div className="rounded-2xl border overflow-hidden bg-card/50">
      <Skeleton className="aspect-video w-full" />
      <div className="p-8 space-y-4">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  )
}

export function CampaignTab({
  clientId,
  isCreateOpen: externalIsCreateOpen,
  setIsCreateOpen: externalSetIsCreateOpen,
}) {
  const { data: sub, isLoading: subLoading } = useSubscription()
  const [localIsCreateOpen, setLocalIsCreateOpen] = useState(false)

  const isCreateOpen =
    externalIsCreateOpen !== undefined
      ? externalIsCreateOpen
      : localIsCreateOpen
  const setIsCreateOpen =
    externalSetIsCreateOpen !== undefined
      ? externalSetIsCreateOpen
      : setLocalIsCreateOpen

  const canCampaigns = sub?.campaigns ?? false

  if (subLoading) return null
  if (!canCampaigns) return <CampaignUpgradePrompt />

  return (
    <CampaignTabContent
      clientId={clientId}
      isCreateOpen={isCreateOpen}
      setIsCreateOpen={setIsCreateOpen}
    />
  )
}

function CampaignTabContent({ clientId, isCreateOpen, setIsCreateOpen }) {
  const { data: campaigns = [], isLoading } = useCampaigns({ clientId })
  const deleteCampaign = useDeleteCampaign()
  const updateCampaign = useUpdateCampaign()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [editingCampaign, setEditingCampaign] = useState(null)
  const [deletingCampaign, setDeletingCampaign] = useState(null)

  // Sync isCreateOpen state
  useEffect(() => {
    if (isCreateOpen) {
      setEditingCampaign(null)
    }
  }, [isCreateOpen])

  const filtered = campaigns.filter((c) => {
    const matchesSearch =
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.goal && c.goal.toLowerCase().includes(search.toLowerCase()))
    const matchesStatus = statusFilter === 'All' || c.status === statusFilter
    return matchesSearch && matchesStatus
  })

  function handleEdit(campaign) {
    setEditingCampaign(campaign)
    if (setIsCreateOpen) {
      setIsCreateOpen(true)
    }
  }

  async function handleStatusChange(campaign, newStatus) {
    try {
      await updateCampaign.mutateAsync({ id: campaign.id, status: newStatus })
      toast.success(`Campaign marked as ${newStatus}`)
    } catch (err) {
      toast.error(err.message || 'Something went wrong')
    }
  }

  async function handleDelete() {
    if (!deletingCampaign) return
    try {
      await deleteCampaign.mutateAsync(deletingCampaign.id)
      toast.success('Campaign deleted')
    } catch (err) {
      toast.error(err.message || 'Something went wrong')
    } finally {
      setDeletingCampaign(null)
    }
  }

  const isFilterActive = search !== '' || statusFilter !== 'All'

  return (
    <div className="space-y-4">
      {/* --- TOOLBAR --- */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[300px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search campaigns..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px] h-9 text-sm">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Statuses</SelectItem>
              <SelectItem value="Draft">Draft</SelectItem>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="Completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="lg:ml-auto flex items-center gap-4">
          {isFilterActive && (
            <Button
              variant="ghost"
              onClick={() => {
                setSearch('')
                setStatusFilter('All')
              }}
              className="text-muted-foreground font-normal hover:text-foreground h-9 px-3"
            >
              Reset Filters
            </Button>
          )}

          {clientId && (
            <Button
              onClick={() => setIsCreateOpen(true)}
              size="default"
              className="gap-2 h-9"
            >
              <Plus className="size-4" />
              <span>New Campaign</span>
            </Button>
          )}
        </div>
      </div>

      {/* --- CONTENT grid matching Clients.jsx --- */}
      {isLoading ? (
        <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[repeat(auto-fill,minmax(420px,1fr))]">
          {Array.from({ length: 6 }).map((_, i) => (
            <CampaignSkeleton key={i} />
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
          {filtered.map((campaign) => (
            <CampaignCard
              key={campaign.id}
              campaign={campaign}
              onEdit={() => handleEdit(campaign)}
              onDelete={() => setDeletingCampaign(campaign)}
              onStatusChange={(status) => handleStatusChange(campaign, status)}
              showClient={!clientId}
            />
          ))}
        </div>
      ) : (
        <Empty className="py-20 border border-dashed rounded-2xl bg-muted/5">
          <EmptyContent>
            <div className="text-4xl leading-none select-none mb-2">📣</div>
            <EmptyHeader>
              <EmptyTitle className="font-normal text-xl">
                No Campaigns Found
              </EmptyTitle>
              <EmptyDescription className="font-normal">
                {isFilterActive
                  ? "We couldn't find any campaigns matching your current filters."
                  : "You haven't created any content campaigns yet. Start your first initiative!"}
              </EmptyDescription>
            </EmptyHeader>
            {!isFilterActive && (
              <Button
                onClick={() => setIsCreateOpen && setIsCreateOpen(true)}
                variant="outline"
                className="mt-2"
              >
                <Plus className="size-4" />
                Create your first campaign
              </Button>
            )}
            {isFilterActive && (
              <Button
                variant="link"
                onClick={() => {
                  setSearch('')
                  setStatusFilter('All')
                }}
                className="text-primary font-medium"
              >
                Clear all filters
              </Button>
            )}
          </EmptyContent>
        </Empty>
      )}

      {/* --- DIALOGS --- */}
      <CampaignDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        clientId={clientId}
        campaign={editingCampaign}
        onSuccess={() => setEditingCampaign(null)}
      />

      <AlertDialog
        open={!!deletingCampaign}
        onOpenChange={(v) => !v && setDeletingCampaign(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Campaign?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete <strong>{deletingCampaign?.name}</strong>. Posts
              in this campaign will not be deleted — they will simply become
              uncategorised.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
