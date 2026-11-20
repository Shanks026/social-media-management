import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useHeader } from '../../../components/misc/header-context'
import { toast } from 'sonner'
import {
  usePostDetails,
  usePostVersions,
  useCreateRevision,
  useSendPostForClientApproval,
  useApproveDeliverable,
  useScheduleDeliverable,
  useMarkPlatformPublished,
  useMarkPublished,
  useMarkPostDelivered,
  useDeletePost,
  useResendApprovalLink,
  useSubmitForInternalApproval,
  useApproveInternally,
  useRequestInternalChanges,
  ApprovalEmailError,
} from '@/api/posts'
import { usePermissions } from '@/api/usePermissions'

// Sub-components
import PostContent from './PostContent'
import VersionSidebar from './VersionSidebar'
import { CommentThread } from '@/components/comments/CommentThread'
import PostActionDialogs from './PostActionDialogs'
import DraftPostForm from '../DraftPostForm'
import { useAuth } from '@/context/AuthContext'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, X } from 'lucide-react'

export default function PostDetails() {
  const { clientId, postId } = useParams()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { setHeader } = useHeader()

  const { canSendDeliverables } = usePermissions()

  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [isResendConfirmOpen, setIsResendConfirmOpen] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  // Auto-open when a notification deep-links to a specific comment (?comment=id)
  const [showComments, setShowComments] = useState(() => searchParams.has('comment'))
  const [isPublishConfirmOpen, setIsPublishConfirmOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isRevisionConfirmOpen, setIsRevisionConfirmOpen] = useState(false)
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
  const [adminNotes, setAdminNotes] = useState('')

  // Internal lifecycle: Approve & Schedule dialog state
  const [isApproveScheduleOpen, setIsApproveScheduleOpen] = useState(false)
  const [isMarkDeliveredOpen, setIsMarkDeliveredOpen] = useState(false)
  const [deliveryNote, setDeliveryNote] = useState('')
  const [approveDate, setApproveDate] = useState(null)
  const [publishingPlatformId, setPublishingPlatformId] = useState(null)

  // Phase 5: internal approval loop dialog state
  const [isRequestChangesOpen, setIsRequestChangesOpen] = useState(false)
  const [changeNotes, setChangeNotes] = useState('')

  // --- Queries ---

  const { data: post, isLoading, error, refetch } = usePostDetails(postId)

  // Derive whether this post belongs to an internal client
  const isInternal = post?.clients?.is_internal === true

  // The sidebar history, from the post_id found in the query above
  const { data: versions } = usePostVersions(post?.actual_post_id)

  // --- Mutations ---
  // Each hook refreshes the Deliverable everywhere it shows (lists, calendar,
  // campaigns, clients, linked tasks); these callbacks are UI only.

  const createRevisionMutation = useCreateRevision({
    onSuccess: (newVersionId) => {
      toast.success('New version created')
      setIsRevisionConfirmOpen(false)
      setAdminNotes('')
      navigate(`/clients/${clientId}/deliverables/${newVersionId}`)
    },
    onError: (err) => {
      console.error('Revision Mutation Failed:', err)
      toast.error(err.message)
    },
  })

  // Status change first, email second (B10) — see sendPostForClientApproval.
  const sendForApprovalMutation = useSendPostForClientApproval({
    onSuccess: () => {
      toast.success(`Sent for approval to ${post.clients.email}`)
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to send for approval')
    },
    onSettled: (_data, err) => {
      // Once the status has changed (full success, or only the email failed)
      // the dialog has nothing left to confirm, so close it (B6).
      if (!err || err instanceof ApprovalEmailError) setIsConfirmOpen(false)
    },
  })

  // Internal only: directly approve a non-social deliverable (no platform, no date picker)
  const approveDeliverableMutation = useApproveDeliverable({
    onSuccess: () => toast.success('Deliverable approved'),
    onError: (err) => toast.error(err.message),
  })

  // Internal only: directly schedule without client approval
  const approveAndScheduleMutation = useScheduleDeliverable({
    onSuccess: () => {
      toast.success('Post scheduled successfully')
      setIsApproveScheduleOpen(false)
      setApproveDate(null)
    },
    onError: (err) => toast.error(err.message),
  })
  const markPlatformAsPublishedMutation = useMarkPlatformPublished({
    onSuccess: ({ platform, allPublished }) => {
      setPublishingPlatformId(null)
      if (allPublished) {
        toast.success('All platforms published — post marked as Published')
      } else {
        const label = platform.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())
        toast.success(`${label} marked as published`)
      }
    },
    onError: (err) => {
      setPublishingPlatformId(null)
      toast.error(err.message)
    },
  })
  const markAsPublishedMutation = useMarkPublished({
    onSuccess: () => {
      toast.success('Post marked as published')
      setIsPublishConfirmOpen(false)
    },
    onError: (err) => toast.error(err.message),
  })

  const markAsDeliveredMutation = useMarkPostDelivered({
    onSuccess: () => {
      toast.success('Deliverable marked as delivered')
      setIsMarkDeliveredOpen(false)
      setDeliveryNote('')
    },
    onError: (err) => toast.error(err.message),
  })
  const deletePostMutation = useDeletePost({
    onSuccess: () => {
      toast.success('Post deleted permanently')
      setIsDeleteConfirmOpen(false)
      navigate(-1)
    },
    onError: (err) => {
      console.error('Delete Mutation Failed:', err)
      toast.error(err.message)
    },
  })

  const resendApprovalLinkMutation = useResendApprovalLink({
    onSuccess: () => {
      toast.success(`Approval link resent to ${post.clients.email}`)
      setIsResendConfirmOpen(false)
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to resend approval link')
    },
  })

  // Phase 5 mutations ─────────────────────────────────────────────────────────

  const submitForApprovalMutation = useSubmitForInternalApproval({
    onSuccess: () => toast.success('Submitted for internal review'),
    onError: (err) => toast.error(err.message),
  })

  const approveInternallyMutation = useApproveInternally({
    onSuccess: () => toast.success('Deliverable approved — now Ready'),
    onError: (err) => toast.error(err.message),
  })

  const requestChangesMutation = useRequestInternalChanges({
    onSuccess: () => {
      toast.success('Changes requested')
      setIsRequestChangesOpen(false)
      setChangeNotes('')
    },
    onError: (err) => toast.error(err.message),
  })

  const handleRefresh = () => {
    refetch()
    toast.success('Status refreshed')
  }

  useEffect(() => {
    if (post) {
      setHeader({
        breadcrumbs: [
          { label: 'Clients', href: '/clients' },
          {
            label: post.clients?.name || 'Client',
            href: `/clients/${clientId}`,
          },
          { label: `${post.title} (v${post.version_number})` },
        ],
      })
    }
  }, [post, clientId, setHeader])

  if (isLoading)
    return (
      <div className="p-8 text-muted-foreground text-center">Loading...</div>
    )
  if (error || !post)
    return (
      <div className="p-8 text-destructive text-center">
        Post version not found. It may have been deleted or archived.
      </div>
    )

  return (
    <div className="flex flex-col lg:flex-row h-full">
      <PostContent
        post={post}
        isInternal={isInternal}
        canSendDeliverables={canSendDeliverables}
        // Meta column yields whenever a page-level right panel takes the space
        showMeta={!showHistory && !showComments}
        showHistory={showHistory}
        setShowHistory={(v) => { setShowHistory(v); if (v) setShowComments(false) }}
        showComments={showComments}
        onToggleComments={() => { setShowComments((c) => !c); setShowHistory(false) }}
        onSendForApproval={() => setIsConfirmOpen(true)}
        onApproveAndSchedule={() => {
          const hasPlatforms = (post.platforms?.length ?? 0) > 0
          if (!hasPlatforms) {
            approveDeliverableMutation.mutate(post.id)
          } else {
            if (!post.platform_schedules && post.target_date) setApproveDate(new Date(post.target_date))
            setIsApproveScheduleOpen(true)
          }
        }}
        onPublish={() => setIsPublishConfirmOpen(true)}
        onPublishPlatform={(platform) => {
          setPublishingPlatformId(platform)
          markPlatformAsPublishedMutation.mutate({
            versionId: post.id,
            platform,
          })
        }}
        onCreateRevision={() => setIsRevisionConfirmOpen(true)}
        onEdit={() => setIsEditOpen(true)}
        onDelete={() => setIsDeleteConfirmOpen(true)}
        onResendLink={() => setIsResendConfirmOpen(true)}
        isResendingLink={resendApprovalLinkMutation.isPending}
        onRefresh={handleRefresh}
        isRevisionPending={createRevisionMutation.isPending}
        isApprovalPending={sendForApprovalMutation.isPending}
        isPublishPending={markAsPublishedMutation.isPending}
        publishingPlatformId={publishingPlatformId}
        isApproveSchedulePending={approveAndScheduleMutation.isPending || approveDeliverableMutation.isPending}
        onMarkDelivered={() => setIsMarkDeliveredOpen(true)}
        isMarkDeliveredPending={markAsDeliveredMutation.isPending}
        onSubmitForApproval={() => submitForApprovalMutation.mutate(post.id)}
        isSubmitPending={submitForApprovalMutation.isPending}
        onApproveInternally={() => approveInternallyMutation.mutate(post.id)}
        isApproveInternallyPending={approveInternallyMutation.isPending}
        onRequestChanges={() => setIsRequestChangesOpen(true)}
      />

      <DraftPostForm
        clientId={clientId}
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        initialData={{ ...post, version_id: post.id }}
      />

      {showHistory && (
        <VersionSidebar
          currentVersionId={post.id}
          versions={versions}
          clientId={clientId}
          onClose={() => setShowHistory(false)}
        />
      )}

      {showComments && (
        <aside className="w-full lg:w-105 border-t lg:border-t-0 lg:border-l dark:bg-card/30 py-6 ps-6 pe-3 shrink-0 flex flex-col min-h-0 max-h-[85vh] lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)] lg:max-h-none">
          <div className="flex items-center justify-between mb-4 shrink-0">
            <h2 className="text-lg font-bold text-foreground bricolage">Comments</h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowComments(false)}
              className="rounded-full hover:bg-muted"
            >
              <span className="sr-only">Close</span>
              <X className="h-5 w-5 text-muted-foreground" />
            </Button>
          </div>
          <div className="flex-1 min-h-0">
            <CommentThread entityType="post" entityId={post.actual_post_id} />
          </div>
        </aside>
      )}

      <PostActionDialogs
        post={post}
        isInternal={isInternal}
        isConfirmOpen={isConfirmOpen}
        setIsConfirmOpen={setIsConfirmOpen}
        isPublishConfirmOpen={isPublishConfirmOpen}
        setIsPublishConfirmOpen={setIsPublishConfirmOpen}
        onConfirmApproval={() => sendForApprovalMutation.mutate(post)}
        onConfirmPublish={() => markAsPublishedMutation.mutate(post.id)}
        isApprovalPending={sendForApprovalMutation.isPending}
        isPublishPending={markAsPublishedMutation.isPending}
        isRevisionConfirmOpen={isRevisionConfirmOpen}
        setIsRevisionConfirmOpen={setIsRevisionConfirmOpen}
        onConfirmRevision={() =>
          createRevisionMutation.mutate({ versionId: post.id, userId: user?.id, adminNotes })
        }
        isRevisionPending={createRevisionMutation.isPending}
        adminNotes={adminNotes}
        setAdminNotes={setAdminNotes}
        isApproveScheduleOpen={isApproveScheduleOpen}
        setIsApproveScheduleOpen={setIsApproveScheduleOpen}
        approveDate={approveDate}
        setApproveDate={setApproveDate}
        onConfirmApproveSchedule={() =>
          approveAndScheduleMutation.mutate({
            versionId: post.id,
            targetDate: post.platform_schedules ? null : approveDate,
          })
        }
        isApproveSchedulePending={approveAndScheduleMutation.isPending}
        isDeleteConfirmOpen={isDeleteConfirmOpen}
        setIsDeleteConfirmOpen={setIsDeleteConfirmOpen}
        onConfirmDelete={() => deletePostMutation.mutate(post.actual_post_id)}
        isDeletePending={deletePostMutation.isPending}
        isResendConfirmOpen={isResendConfirmOpen}
        setIsResendConfirmOpen={setIsResendConfirmOpen}
        onConfirmResend={() => resendApprovalLinkMutation.mutate(post)}
        isResendPending={resendApprovalLinkMutation.isPending}
      />

      {/* Request Changes Dialog (Phase 5) */}
      <Dialog open={isRequestChangesOpen} onOpenChange={setIsRequestChangesOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Request Changes</DialogTitle>
            <DialogDescription>
              Describe what needs to be revised. The member will see this feedback and can resubmit.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="e.g. Caption too long — cut to 150 chars. Swap the second image."
            value={changeNotes}
            onChange={(e) => setChangeNotes(e.target.value)}
            rows={4}
            className="resize-none"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsRequestChangesOpen(false); setChangeNotes('') }}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => requestChangesMutation.mutate({ versionId: post.id, notes: changeNotes })}
              disabled={requestChangesMutation.isPending}
            >
              {requestChangesMutation.isPending && <Loader2 size={13} className="animate-spin mr-1.5" />}
              Send Feedback
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mark as Delivered Dialog */}
      <Dialog open={isMarkDeliveredOpen} onOpenChange={setIsMarkDeliveredOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mark as Delivered</DialogTitle>
            <DialogDescription>
              Confirm that this deliverable has been sent to the client. Optionally add a delivery note.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="e.g. Sent via Google Drive, link in Documents tab"
            value={deliveryNote}
            onChange={(e) => setDeliveryNote(e.target.value)}
            rows={3}
            className="resize-none"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsMarkDeliveredOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => markAsDeliveredMutation.mutate({ versionId: post.id, deliveryNote })}
              disabled={markAsDeliveredMutation.isPending}
            >
              {markAsDeliveredMutation.isPending && <Loader2 size={13} className="animate-spin mr-1.5" />}
              Confirm Delivery
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
