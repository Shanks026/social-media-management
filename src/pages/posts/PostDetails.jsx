import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { format } from 'date-fns'
import StatusBadge from '@/components/StatusBadge'
import PlatformBadge from '@/components/PlatformBadge'
import { Badge } from '@/components/ui/badge'
import { useHeader } from '../../components/misc/header-context'
import { toast } from 'sonner'
import { Lock, AlertCircle, History, X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const getStatusDotColor = (status) => {
  const config = {
    DRAFT: 'bg-[#0091FF]',
    PENDING_APPROVAL: 'bg-[#FF9500]',
    SCHEDULED: 'bg-[#AF52DE]',
    NEEDS_CHANGES: 'bg-[#FF2D55]',
    ACTIVE: 'bg-[#34C759]',
    POSTED: 'bg-[#4CD964]',
    ARCHIVED: 'bg-[#8E8E93]',
  }
  return config[status] ?? 'bg-slate-400'
}

export default function PostDetails() {
  const { clientId, postId } = useParams()
  const navigate = useNavigate()
  const { setHeader } = useHeader()
  const queryClient = useQueryClient()

  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  const { data: post, isLoading } = useQuery({
    queryKey: ['post-version', postId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('post_versions')
        .select(
          `
          *,
          posts!post_versions_post_id_fkey!inner (
            id,
            clients!inner ( name )
          )
        `,
        )
        .eq('id', postId)
        .single()
      if (error) throw error
      return data
    },
  })

  const { data: versions } = useQuery({
    queryKey: ['post-versions-list', post?.post_id],
    enabled: !!post?.post_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('post_versions')
        .select('id, version_number, status, created_at')
        .eq('post_id', post.post_id)
        .order('version_number', { ascending: false })
      if (error) throw error
      return data
    },
  })

  const sendForApprovalMutation = useMutation({
    mutationFn: async (versionId) => {
      const { data, error } = await supabase.rpc('send_post_for_approval', {
        p_post_version_id: versionId,
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['post-version', postId])
      toast.success('Post sent for approval')
      setIsConfirmOpen(false)
    },
    onError: (err) => toast.error(err.message),
  })

  useEffect(() => {
    if (post) {
      setHeader({
        breadcrumbs: [
          { label: 'Clients', href: '/clients' },
          {
            label: post.posts?.clients?.name || 'Client',
            href: `/clients/${clientId}`,
          },
          // Updated: Added version number to the post title breadcrumb
          { label: `${post.title} v${post.version_number}.0` },
        ],
      })
    }
  }, [post, clientId, setHeader])

  if (isLoading)
    return <div className="p-8 text-muted-foreground">Loading...</div>
  if (!post) return <div className="p-8 text-destructive">Post not found.</div>

  const canSendForApproval =
    post.status === 'DRAFT' && post.content && post.media_urls?.length > 0

  return (
    // The wrapper no longer has "w-full" or "min-h-screen" to avoid overflow issues with AppShell
    <div className="flex flex-col lg:flex-row h-full">
      {/* LEFT SIDE: Content Area */}
      <div className="flex-1 p-8 space-y-6 min-w-0">
        <div className="flex flex-col md:flex-row justify-between items-start gap-6">
          <div className="space-y-6 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge status={post.status} />
              <div className="flex flex-wrap gap-2">
                {Array.isArray(post.platform) ? (
                  post.platform.map((p) => (
                    <PlatformBadge key={p} platform={p} />
                  ))
                ) : (
                  // Fallback for old single-string records
                  <PlatformBadge platform={post.platform} />
                )}
              </div>
              {/* <Badge variant="secondary" className="rounded-md">
                v{post.version_number}.0
              </Badge> */}
            </div>

            <div className="space-y-3">
              <div className="flex flex-row items-center gap-2">
                {' '}
                <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                  {post.title}
                </h1>
                <Badge variant="secondary" className="rounded-md text-sm">
                  v{post.version_number}.0
                </Badge>
              </div>

              <p className="text-sm text-muted-foreground font-medium">
                Created On {format(new Date(post.created_at), 'dd MMM, yyyy')}
              </p>
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed max-w-3xl">
              {post.content}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto shrink-0">
            <Button
              variant="outline"
              onClick={() => setShowHistory(!showHistory)}
              className="w-full sm:w-auto"
            >
              {showHistory ? (
                <X className="mr-2 h-4 w-4" />
              ) : (
                <History className="mr-2 h-4 w-4" />
              )}
              {showHistory ? 'Close History' : 'Version History'}
            </Button>

            {/* Only show the Send for Approval button if it's NOT already pending */}
            {post.status !== 'PENDING_APPROVAL' && (
              <Button
                className="w-full sm:w-auto disabled:cursor-not-allowed"
                disabled={
                  !canSendForApproval || sendForApprovalMutation.isPending
                }
                onClick={() => setIsConfirmOpen(true)}
              >
                {sendForApprovalMutation.isPending
                  ? 'Sending...'
                  : 'Send for Approval'}
              </Button>
            )}
          </div>
        </div>

        {/* Media Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 xl:grid-cols-5 gap-4 pt-4">
          {post.media_urls?.map((url, i) => (
            <div
              key={i}
              className="aspect-square rounded-2xl overflow-hidden bg-[#F2F2F7] shadow-sm transition-transform hover:scale-[1.02]"
            >
              <img src={url} alt="" className="w-full h-full object-cover" />
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT SIDE: Version History (Integrated) */}
      {showHistory && (
        <aside className="w-full lg:w-96 border-t lg:border-t-0 lg:border-l bg-muted/20 dark:bg-card/30 p-6 shrink-0 overflow-y-auto">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-lg font-bold text-foreground">
              Version History
            </h2>
          </div>

          <div className="flex flex-col gap-2">
            {versions?.map((v) => {
              const isSelected = v.id === postId
              return (
                <button
                  key={v.id}
                  onClick={() => navigate(`/clients/${clientId}/posts/${v.id}`)}
                  className={`group flex items-center justify-between px-4 py-2 cursor-pointer rounded-md transition-all ${
                    isSelected
                      ? 'bg-muted/50 hover:bg-muted/80'
                      : 'border-transparent hover:bg-muted'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`size-2.5 rounded-full ${getStatusDotColor(v.status)}`}
                    />
                    <span
                      className={`text-sm font-bold ${isSelected ? 'text-foreground' : 'text-muted-foreground'}`}
                    >
                      v{v.version_number}.0
                    </span>
                  </div>
                  <span className="text-sm text-muted-foreground font-semibold">
                    {format(new Date(v.created_at), 'MMM d, h:mm a')}
                  </span>
                </button>
              )
            })}
          </div>
        </aside>
      )}

      {/* Confirmation Dialog remains the same */}
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
                and transition it from a<em> Draft</em> to <em>Pending</em>{' '}
                status.
              </DialogDescription>

              <div className="bg-muted/50 p-4 rounded-lg border text-sm space-y-2">
                <p className="font-semibold text-foreground">
                  What happens next?
                </p>
                <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
                  <li>
                    This version becomes read-only to prevent changes during the
                    review process.
                  </li>
                  <li>
                    The client will be notified to review and provide feedback
                    or approval.
                  </li>
                  <li>
                    If changes are required, you will need to create a new
                    version after the review.
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
              onClick={() => sendForApprovalMutation.mutate(post.id)}
              disabled={sendForApprovalMutation.isPending}
              className="bg-primary hover:bg-primary/90"
            >
              {sendForApprovalMutation.isPending
                ? 'Submitting...'
                : 'Confirm & Send'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
