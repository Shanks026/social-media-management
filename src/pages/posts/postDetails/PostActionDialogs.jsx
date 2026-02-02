import { Button } from '@/components/ui/button'
import {
  Lock,
  AlertCircle,
  Globe,
  Pencil,
  MessageSquareText,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'

export default function PostActionDialogs({
  post,
  isConfirmOpen,
  setIsConfirmOpen,
  isPublishConfirmOpen,
  setIsPublishConfirmOpen,
  onConfirmApproval,
  onConfirmPublish,
  isApprovalPending,
  isPublishPending,
  isRevisionConfirmOpen,
  setIsRevisionConfirmOpen,
  onConfirmRevision,
  isRevisionPending,
  adminNotes,
  setAdminNotes,
}) {
  return (
    <>
      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader className="space-y-4">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Lock className="h-6 w-6 text-orange-500" /> Confirm Approval
              Request
            </DialogTitle>
            <div className="space-y-4">
              <DialogDescription className="text-base text-foreground/90">
                You are about to submit{' '}
                <strong>{post.title || 'Untitled Post'}</strong> for client
                review. This will lock <strong>v{post.version_number}.0</strong>{' '}
                and transition it from a <em>Draft</em> to <em>Pending</em>{' '}
                status.
              </DialogDescription>
              <div className="bg-muted/50 p-4 rounded-lg border text-sm space-y-2">
                <p className="font-semibold text-foreground">
                  What happens next?
                </p>
                <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
                  <li>This version becomes read-only to prevent changes.</li>
                  <li>The client will be notified to review.</li>
                  <li>
                    If changes are required, you will create a new version after
                    the review.
                  </li>
                </ul>
              </div>
            </div>
          </DialogHeader>
          <DialogFooter className="mt-6 flex flex-row gap-3">
            <Button variant="outline" onClick={() => setIsConfirmOpen(false)}>
              Go Back
            </Button>
            <Button
              onClick={onConfirmApproval}
              disabled={isApprovalPending}
              className="bg-primary hover:bg-primary/90"
            >
              {isApprovalPending ? 'Submitting...' : 'Confirm & Send'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isPublishConfirmOpen}
        onOpenChange={setIsPublishConfirmOpen}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader className="space-y-4">
            <DialogTitle className="flex items-center gap-2 text-xl ">
              <Globe className="h-6 w-6 text-green-600" /> Finalize Publication
            </DialogTitle>
            <div className="space-y-4">
              <DialogDescription className="text-base text-foreground/90 leading-relaxed">
                By marking this post as <strong>Published</strong>, you are
                confirming that this content has been successfully delivered.
              </DialogDescription>
              <div className="bg-destructive/5 p-4 rounded-lg border border-destructive/20 text-sm space-y-3">
                <div className="flex items-center gap-2 text-destructive font-bold uppercase tracking-tight">
                  <AlertCircle size={16} /> Terminal Status Warning
                </div>
                <p className="text-muted-foreground leading-snug font-medium italic">
                  This action is irreversible. Marking this version as Published
                  will permanently close the lifecycle for this post version.
                </p>
              </div>
            </div>
          </DialogHeader>
          <DialogFooter className="mt-6 flex flex-row gap-3">
            <Button
              variant="outline"
              onClick={() => setIsPublishConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={onConfirmPublish} disabled={isPublishPending}>
              {isPublishPending ? 'Finalizing...' : 'Confirm Publication'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isRevisionConfirmOpen}
        onOpenChange={setIsRevisionConfirmOpen}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader className="space-y-4">
            <DialogTitle className="flex items-center gap-2 text-xl">
              Create New Version - v{post.version_number + 1}.0
            </DialogTitle>
            <div className="space-y-4">
              <DialogDescription className="text-foreground/90 leading-relaxed">
                You are about to create{' '}
                <strong>v{post.version_number + 1}.0</strong>. The current
                version will be moved to <strong>ARCHIVED</strong> and will be Read-Only.
              </DialogDescription>

              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <MessageSquareText
                    size={16}
                    className="text-muted-foreground"
                  />
                  Your Notes / Plan of Action
                </div>
                <Textarea
                  placeholder="Record what needs to be changed in this new version..."
                  className="min-h-[120px] resize-none"
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                />
                <p className="text-[11px] text-muted-foreground italic">
                  * These notes are for your internal use and help maintain
                  context across versions.
                </p>
              </div>
            </div>
          </DialogHeader>
          <DialogFooter className="mt-6 flex flex-row gap-3">
            <Button
              variant="outline"
              onClick={() => setIsRevisionConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={onConfirmRevision}
              disabled={isRevisionPending}
              
            >
              {isRevisionPending ? 'Creating...' : 'Create New Version'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
