import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useHeader } from '../../../components/misc/header-context'
import { toast } from 'sonner'
import { createRevision, fetchPostDetails } from '@/api/posts'

// Sub-components
import PostContent from './PostContent'
import VersionSidebar from './VersionSidebar'
import PostActionDialogs from './PostActionDialogs'
import DraftPostForm from '../DraftPostForm'
import { useAuth } from '@/context/AuthContext'

export default function PostDetails() {
  const { clientId, postId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { setHeader } = useHeader()
  const queryClient = useQueryClient()

  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [isPublishConfirmOpen, setIsPublishConfirmOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isRevisionConfirmOpen, setIsRevisionConfirmOpen] = useState(false)
  const [adminNotes, setAdminNotes] = useState('')

  // Internal lifecycle: Approve & Schedule dialog state
  const [isApproveScheduleOpen, setIsApproveScheduleOpen] = useState(false)
  const [approveDate, setApproveDate] = useState(null)

  // --- Queries ---

  const {
    data: post,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['post-version', postId],
    queryFn: () => fetchPostDetails(postId),
    retry: false,
  })

  // Derive whether this post belongs to an internal client
  const isInternal = post?.clients?.is_internal === true

  // Fetches the sidebar history based on the post_id found in the query above
  const { data: versions } = useQuery({
    queryKey: ['post-versions-list', post?.actual_post_id],
    enabled: !!post?.actual_post_id,
    queryFn: async () => {
      const { data, error: vError } = await supabase
        .from('post_versions')
        .select('id, version_number, status, created_at')
        .eq('post_id', post.actual_post_id)
        .order('version_number', { ascending: false })
      if (vError) throw vError
      return data
    },
  })

  // --- Mutations ---

  const createRevisionMutation = useMutation({
    mutationFn: () => {
      if (!user?.id)
        throw new Error('You must be logged in to create a revision')
      return createRevision(post.id, user.id, adminNotes)
    },
    onSuccess: (newVersionId) => {
      toast.success('New version created')
      setIsRevisionConfirmOpen(false)
      setAdminNotes('')

      queryClient.invalidateQueries({
        queryKey: ['post-versions-list', post?.actual_post_id],
      })
      queryClient.invalidateQueries({
        queryKey: ['post-version', post.id],
      })
      queryClient.setQueryData(['post-version', post.id], (oldData) => {
        if (!oldData) return oldData
        return { ...oldData, status: 'ARCHIVED' }
      })

      navigate(`/clients/${clientId}/posts/${newVersionId}`)
    },
    onError: (err) => {
      console.error('Revision Mutation Failed:', err)
      toast.error(err.message)
    },
  })

  const sendForApprovalMutation = useMutation({
    mutationFn: async (versionId) => {
      const { data, error: rpcError } = await supabase.rpc(
        'send_post_for_approval',
        { p_post_version_id: versionId },
      )
      if (rpcError) throw rpcError
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['post-version', postId] })
      toast.success('Post sent for approval')
      setIsConfirmOpen(false)
    },
    onError: (err) => toast.error(err.message),
  })

  // Internal only: directly schedule without client approval
  const approveAndScheduleMutation = useMutation({
    mutationFn: async (versionId) => {
      if (!approveDate) throw new Error('Please select a publish date.')
      const { error: upError } = await supabase
        .from('post_versions')
        .update({
          status: 'SCHEDULED',
          target_date: approveDate.toISOString(),
        })
        .eq('id', versionId)
      if (upError) throw upError
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['post-version', postId] })
      toast.success('Post scheduled successfully')
      setIsApproveScheduleOpen(false)
      setApproveDate(null)
    },
    onError: (err) => toast.error(err.message),
  })

  const markAsPublishedMutation = useMutation({
    mutationFn: async (versionId) => {
      const { error: upError } = await supabase
        .from('post_versions')
        .update({
          status: 'PUBLISHED',
          published_at: new Date().toISOString(),
        })
        .eq('id', versionId)
      if (upError) throw upError
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['post-version', postId] })
      toast.success('Post marked as published')
      setIsPublishConfirmOpen(false)
    },
    onError: (err) => toast.error(err.message),
  })

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
        showHistory={showHistory}
        setShowHistory={setShowHistory}
        onSendForApproval={() => setIsConfirmOpen(true)}
        onApproveAndSchedule={() => {
          if (post.target_date) setApproveDate(new Date(post.target_date))
          setIsApproveScheduleOpen(true)
        }}
        onPublish={() => setIsPublishConfirmOpen(true)}
        onCreateRevision={() => setIsRevisionConfirmOpen(true)}
        onEdit={() => setIsEditOpen(true)}
        isRevisionPending={createRevisionMutation.isPending}
        isApprovalPending={sendForApprovalMutation.isPending}
        isPublishPending={markAsPublishedMutation.isPending}
        isApproveSchedulePending={approveAndScheduleMutation.isPending}
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

      <PostActionDialogs
        post={post}
        isInternal={isInternal}
        isConfirmOpen={isConfirmOpen}
        setIsConfirmOpen={setIsConfirmOpen}
        isPublishConfirmOpen={isPublishConfirmOpen}
        setIsPublishConfirmOpen={setIsPublishConfirmOpen}
        onConfirmApproval={() => sendForApprovalMutation.mutate(post.id)}
        onConfirmPublish={() => markAsPublishedMutation.mutate(post.id)}
        isApprovalPending={sendForApprovalMutation.isPending}
        isPublishPending={markAsPublishedMutation.isPending}
        isRevisionConfirmOpen={isRevisionConfirmOpen}
        setIsRevisionConfirmOpen={setIsRevisionConfirmOpen}
        onConfirmRevision={() => createRevisionMutation.mutate()}
        isRevisionPending={createRevisionMutation.isPending}
        adminNotes={adminNotes}
        setAdminNotes={setAdminNotes}
        isApproveScheduleOpen={isApproveScheduleOpen}
        setIsApproveScheduleOpen={setIsApproveScheduleOpen}
        approveDate={approveDate}
        setApproveDate={setApproveDate}
        onConfirmApproveSchedule={() => approveAndScheduleMutation.mutate(post.id)}
        isApproveSchedulePending={approveAndScheduleMutation.isPending}
      />
    </div>
  )
}
