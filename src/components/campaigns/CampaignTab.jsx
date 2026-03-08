import { useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { toast } from 'sonner'

import { useCampaigns, useDeleteCampaign, useUpdateCampaign } from '@/api/campaigns'
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

function CampaignSkeleton() {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-4 space-y-3">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-3 w-64" />
      <Skeleton className="h-3 w-32" />
      <Skeleton className="h-2 w-full" />
    </div>
  )
}

export function CampaignTab({ clientId }) {
  const { data: sub } = useSubscription()
  const canCampaigns = sub?.campaigns ?? false

  if (!canCampaigns) return <CampaignUpgradePrompt />

  return <CampaignTabContent clientId={clientId} />
}

function CampaignTabContent({ clientId }) {
  const { data: campaigns = [], isLoading } = useCampaigns({ clientId })
  const deleteCampaign = useDeleteCampaign()
  const updateCampaign = useUpdateCampaign()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingCampaign, setEditingCampaign] = useState(null)
  const [deletingCampaign, setDeletingCampaign] = useState(null)

  const filtered = campaigns.filter((c) => {
    const matchesSearch =
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.goal && c.goal.toLowerCase().includes(search.toLowerCase()))
    const matchesStatus = statusFilter === 'All' || c.status === statusFilter
    return matchesSearch && matchesStatus
  })

  function handleNew() {
    setEditingCampaign(null)
    setDialogOpen(true)
  }

  function handleEdit(campaign) {
    setEditingCampaign(campaign)
    setDialogOpen(true)
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

  return (
    <div className="space-y-4 pt-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search campaigns..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All Statuses</SelectItem>
            <SelectItem value="Active">Active</SelectItem>
            <SelectItem value="Completed">Completed</SelectItem>
            <SelectItem value="Archived">Archived</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" onClick={handleNew}>
          <Plus className="size-4 mr-1" />
          New Campaign
        </Button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <CampaignSkeleton />
          <CampaignSkeleton />
          <CampaignSkeleton />
        </div>
      ) : campaigns.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <p className="text-muted-foreground text-sm">No campaigns yet</p>
          <Button size="sm" onClick={handleNew}>
            <Plus className="size-4 mr-1" />
            New Campaign
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          No campaigns match your filters.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((campaign) => (
            <CampaignCard
              key={campaign.id}
              campaign={campaign}
              onEdit={handleEdit}
              onDelete={setDeletingCampaign}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <CampaignDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        clientId={clientId}
        initialData={editingCampaign}
      />

      {/* Delete Confirm */}
      <AlertDialog
        open={!!deletingCampaign}
        onOpenChange={(v) => !v && setDeletingCampaign(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Campaign?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete{' '}
              <strong>{deletingCampaign?.name}</strong>. Posts in this campaign
              will not be deleted — they will simply become uncategorised.
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
