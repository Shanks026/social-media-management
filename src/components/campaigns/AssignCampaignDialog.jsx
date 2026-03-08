import { useState, useEffect } from 'react'
import { FolderOpen, Check, Megaphone, X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { fetchActiveCampaignsByClient } from '@/api/campaigns'
import { useAssignPostCampaign } from '@/api/campaigns'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export function AssignCampaignDialog({ open, onOpenChange, post }) {
  const [campaigns, setCampaigns] = useState([])
  const [selectedCampaignId, setSelectedCampaignId] = useState(null)
  const [loading, setLoading] = useState(false)

  const assignMutation = useAssignPostCampaign()

  // Fetch campaigns for this post's client
  useEffect(() => {
    if (!open || !post?.client_id) return
    setLoading(true)
    fetchActiveCampaignsByClient(post.client_id)
      .then((data) => {
        setCampaigns(data)
        // Pre-select current campaign if the post already has one
        setSelectedCampaignId(post.campaign_id || null)
      })
      .catch(() => setCampaigns([]))
      .finally(() => setLoading(false))
  }, [open, post?.client_id, post?.campaign_id])

  const handleAssign = (campaignId = selectedCampaignId) => {
    if (!post) return
    const postId = post.actual_post_id || post.id
    assignMutation.mutate(
      { postId, campaignId },
      {
        onSuccess: () => {
          toast.success(
            campaignId
              ? 'Post assigned to campaign'
              : 'Post removed from campaign',
          )
          onOpenChange(false)
        },
        onError: (err) => {
          toast.error('Failed to assign: ' + err.message)
        },
      },
    )
  }

  const isAssigned = !!post?.campaign_id
  const hasChanged = selectedCampaignId !== (post?.campaign_id || null)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] rounded-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <DialogHeader className="">
          <div className="flex items-center gap-3">
            {/* <div className="p-3 bg-primary/10 rounded-full">
              <FolderOpen className="h-5 w-5 text-primary" />
            </div> */}
            <DialogTitle className="text-lg">Assign to Campaign</DialogTitle>
          </div>
          <DialogDescription className="">
            Link{' '}
            <span className="font-semibold text-foreground">
              "{post?.title || 'Untitled'}"
            </span>{' '}
            to an active initiative.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-muted animate-pulse rounded-xl" />
              ))}
            </div>
          ) : campaigns.length === 0 ? (
            <div className="py-8 text-center bg-muted/30 rounded-2xl">
              <Megaphone className="size-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                No active campaigns found for this client.
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[280px] -mx-1 px-1">
              <div className="">
                {campaigns.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCampaignId(c.id)}
                    className={cn(
                      'w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all border border-transparent',
                      selectedCampaignId === c.id
                        ? 'bg-primary/10 border-primary/20 ring-1 ring-primary/20 text-foreground'
                        : 'hover:bg-muted/50 text-foreground/80 hover:text-foreground',
                    )}
                  >
                    <div className={cn(
                      "size-8 rounded-full flex items-center justify-center shrink-0",
                      selectedCampaignId === c.id ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                    )}>
                      <Megaphone className="size-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        "text-sm font-medium truncate",
                        selectedCampaignId === c.id ? "text-foreground" : "text-foreground/90"
                      )}>
                        {c.name}
                      </p>
                    </div>
                    {selectedCampaignId === c.id && (
                      <Check className="size-4 text-primary shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2 flex-row items-center">
          {isAssigned && (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive hover:bg-destructive/10 mr-auto h-9 px-3 gap-2"
              onClick={() => handleAssign(null)}
              disabled={assignMutation.isPending}
            >
              <X className="size-3.5" />
              <span>Clear</span>
            </Button>
          )}
          <div className="flex items-center gap-2 ml-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={assignMutation.isPending}
              className="h-9 px-4"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => handleAssign()}
              disabled={assignMutation.isPending || loading || campaigns.length === 0 || !hasChanged || !selectedCampaignId}
              className="gap-2 h-9 px-4"
            >
              {assignMutation.isPending ? (
                'Assigning…'
              ) : (
                <>
                  <Check className="size-4" />
                  <span>Assign</span>
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
