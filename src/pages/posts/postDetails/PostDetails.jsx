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

  // --- Queries ---

  // Unified Query: Fetches either by Post ID (Parent) or Version ID (Specific)
  const {
    data: post,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['post-version', postId],
    queryFn: () => fetchPostDetails(postId),
    retry: false,
  })

  // Fetches the sidebar history based on the post_id found in the query above
  const { data: versions } = useQuery({
    queryKey: ['post-versions-list', post?.actual_post_id],
    enabled: !!post?.actual_post_id,
    queryFn: async () => {
      const { data, error: vError } = await supabase
        .from('post_versions')
        .select('id, version_number, status, created_at')
        .eq('post_id', post.actual_post_id) // Use the parent post reference
        .order('version_number', { ascending: false })
      if (vError) throw vError
      return data
    },
  })

  // --- Mutations ---

  const createRevisionMutation = useMutation({
    mutationFn: () => {
      // Check if user exists before calling the RPC
      if (!user?.id)
        throw new Error('You must be logged in to create a revision')

      return createRevision(
        post.id,
        user.id, // Now 'user' is defined and we pass the ID
        adminNotes,
      )
    },
    onSuccess: (newVersionId) => {
      toast.success('New version created')
      setIsRevisionConfirmOpen(false)
      setAdminNotes('')

      // 1. Invalidate history so the sidebar updates
      queryClient.invalidateQueries({
        queryKey: ['post-versions-list', post?.actual_post_id],
      })

      // 2. CRITICAL FIX: Invalidate the query for the CURRENT (Old) version.
      // This forces a re-fetch when you navigate back to this ID, updating status to 'ARCHIVED'.
      queryClient.invalidateQueries({
        queryKey: ['post-version', post.id],
      })

      // Optional: You can also manually set the cache for the old version to be instant
      queryClient.setQueryData(['post-version', post.id], (oldData) => {
        if (!oldData) return oldData
        return { ...oldData, status: 'ARCHIVED' }
      })

      // Navigate to the new version's detail page
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
        {
          p_post_version_id: versionId,
        },
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

  const markAsPublishedMutation = useMutation({
    mutationFn: async (versionId) => {
      const { error: upError } = await supabase
        .from('post_versions')
        .update({
          status: 'PUBLISHED',
          published_at: new Date().toISOString(), // <--- Capture timestamp
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
        showHistory={showHistory}
        setShowHistory={setShowHistory}
        onSendForApproval={() => setIsConfirmOpen(true)}
        onPublish={() => setIsPublishConfirmOpen(true)}
        onCreateRevision={() => setIsRevisionConfirmOpen(true)}
        onEdit={() => setIsEditOpen(true)}
        isRevisionPending={createRevisionMutation.isPending}
        isApprovalPending={sendForApprovalMutation.isPending}
        isPublishPending={markAsPublishedMutation.isPending}
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

      {/* Dialogs mapping stays largely the same */}
      <PostActionDialogs
        post={post}
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
      />
    </div>
  )
}
