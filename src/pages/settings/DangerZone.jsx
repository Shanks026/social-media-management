import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { AlertTriangle, Loader2, CalendarClock } from 'lucide-react'

import { useAuth } from '@/context/AuthContext'
import { useSubscription } from '@/api/useSubscription'
import { requestWorkspaceDeletion, cancelWorkspaceDeletion } from '@/api/team'
import { formatDate } from '@/lib/helper'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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

export default function DangerZone() {
  const { user, workspaceUserId } = useAuth()
  const { data: sub } = useSubscription()
  const queryClient = useQueryClient()

  const isOwner = !!user?.id && user.id === workspaceUserId
  const agencyName = sub?.agency_name || 'Tercero'
  const isPending = sub?.is_pending_deletion
  const scheduledAt = sub?.deletion_scheduled_at

  const [open, setOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['subscription'] })

  const schedule = useMutation({
    mutationFn: requestWorkspaceDeletion,
    onSuccess: () => {
      refresh()
      setOpen(false)
      toast.success('Workspace scheduled for deletion. You can cancel any time before then.')
    },
    onError: (err) => toast.error(err.message || 'Failed to schedule deletion'),
  })

  const cancel = useMutation({
    mutationFn: cancelWorkspaceDeletion,
    onSuccess: () => {
      refresh()
      toast.success('Deletion cancelled. Your workspace is safe.')
    },
    onError: (err) => toast.error(err.message || 'Failed to cancel deletion'),
  })

  if (!isOwner) {
    return (
      <div className="rounded-xl border border-border/60 bg-muted/20 p-6">
        <p className="text-sm text-muted-foreground">
          Only the workspace owner can delete the workspace.
        </p>
      </div>
    )
  }

  // ── Pending deletion: show the scheduled state + cancel ──
  if (isPending) {
    return (
      <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-6 space-y-4 max-w-2xl">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 text-destructive">
            <CalendarClock className="size-5" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-foreground">
              Scheduled for permanent deletion
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              This workspace and everything in it will be permanently erased on{' '}
              <strong className="text-foreground">{formatDate(scheduledAt)}</strong>.
              Until then you still have full access. Export anything you need to keep,
              or cancel below to call it off.
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={() => cancel.mutate()}
          disabled={cancel.isPending}
        >
          {cancel.isPending ? (
            <>
              <Loader2 className="size-4 mr-2 animate-spin" />
              Cancelling…
            </>
          ) : (
            'Cancel deletion'
          )}
        </Button>
      </div>
    )
  }

  // ── Default: offer to schedule deletion ──
  const canConfirm = confirmText.trim() === agencyName

  return (
    <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-6 space-y-4 max-w-2xl">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 text-destructive">
          <AlertTriangle className="size-5" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-foreground">
            Delete this workspace
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Schedules permanent deletion of <strong>everything</strong> — all clients,
            deliverables, campaigns, finance records, documents, proposals, and every
            uploaded file in storage. Team members lose access (and their accounts are
            removed if this is their only workspace), and your own account is closed.
            You get a <strong>14-day grace period</strong> to cancel; after that it
            cannot be undone and nothing is preserved.
          </p>
        </div>
      </div>

      <Button
        variant="destructive"
        onClick={() => {
          setConfirmText('')
          setOpen(true)
        }}
      >
        Schedule deletion
      </Button>

      <AlertDialog open={open} onOpenChange={(v) => !schedule.isPending && setOpen(v)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Schedule deletion of “{agencyName}”?</AlertDialogTitle>
            <AlertDialogDescription>
              The workspace will be permanently erased in 14 days unless you cancel.
              Type <strong className="text-foreground">{agencyName}</strong> to confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-2">
            <Label htmlFor="confirm-delete" className="sr-only">
              Workspace name
            </Label>
            <Input
              id="confirm-delete"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={agencyName}
              autoComplete="off"
              disabled={schedule.isPending}
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={schedule.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={!canConfirm || schedule.isPending}
              onClick={(e) => {
                e.preventDefault()
                schedule.mutate()
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {schedule.isPending ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  Scheduling…
                </>
              ) : (
                'Schedule deletion'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
