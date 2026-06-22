import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { AlertTriangle, Loader2 } from 'lucide-react'

import { useAuth } from '@/context/AuthContext'
import { useSubscription } from '@/api/useSubscription'
import { cancelWorkspaceDeletion } from '@/api/team'
import { formatDate } from '@/lib/helper'
import { Button } from '@/components/ui/button'

/**
 * Full-width warning shown on every page while the workspace is scheduled for
 * permanent deletion. Everyone in the workspace sees it; only the owner can
 * cancel (others are told to contact the owner).
 */
export function DeletionBanner() {
  const { data: sub } = useSubscription()
  const { user, workspaceUserId } = useAuth()
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const isOwner = !!user?.id && user.id === workspaceUserId

  const cancel = useMutation({
    mutationFn: cancelWorkspaceDeletion,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription'] })
      toast.success('Deletion cancelled. Your workspace is safe.')
    },
    onError: (err) => toast.error(err.message || 'Failed to cancel deletion'),
  })

  if (!sub?.is_pending_deletion) return null

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-destructive/30 bg-destructive/10 px-4 md:px-8 py-2.5 text-sm">
      <AlertTriangle className="size-4 shrink-0 text-destructive" />
      <p className="text-foreground">
        This workspace is scheduled for{' '}
        <strong>permanent deletion on {formatDate(sub.deletion_scheduled_at)}</strong>.
        {isOwner
          ? ' Cancel to keep it, or export anything you need before then.'
          : ' Contact the workspace owner to cancel.'}
      </p>
      {isOwner && (
        <div className="ml-auto flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-7"
            onClick={() => cancel.mutate()}
            disabled={cancel.isPending}
          >
            {cancel.isPending ? (
              <>
                <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                Cancelling…
              </>
            ) : (
              'Cancel deletion'
            )}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-muted-foreground"
            onClick={() => navigate('/settings?tab=danger')}
          >
            Details
          </Button>
        </div>
      )}
    </div>
  )
}
