import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchAllPostsByClient, deletePost, createRevision } from '@/api/posts'
import StatusBadge from '@/components/StatusBadge'
import {
  MoreVertical,
  Eye,
  Edit2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Play,
  FolderOpen,
  Megaphone,
  LayoutGrid,
  Plus,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from '@/components/ui/tooltip'
import DraftPostForm from './DraftPostForm'
import { AssignCampaignDialog } from '@/components/campaigns/AssignCampaignDialog'
import { useSubscription } from '@/api/useSubscription'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/lib/utils'
import { getUrgencyStatus } from '@/lib/client-helpers'
import { getPublishState, renderCaption } from '@/lib/helper'

const DELIVERABLE_TYPE_LABELS = {
  reel_short_video: 'Reel',
  long_form_video: 'Long-form Video',
  video_editing: 'Video Edit',
  ad_creative: 'Ad Creative',
  motion_graphic: 'Motion Graphic',
  static_graphic: 'Static',
  carousel: 'Carousel',
  story: 'Story',
  photography: 'Photography',
  ugc: 'UGC',
  brand_identity: 'Brand Identity',
  infographic: 'Infographic',
  presentation: 'Deck',
  website_design: 'Website / UI',
  blog_copy: 'Blog / Copy',
  email_campaign: 'Email Campaign',
  podcast: 'Podcast',
  other: 'Other',
}

const isVideoSource = (url) => {
  if (!url) return false
  const videoExtensions = ['.mp4', '.mov', '.webm', '.ogg', '.m4v']
  return (
    videoExtensions.some((ext) => url.toLowerCase().includes(ext)) ||
    url.includes('video') ||
    url.startsWith('blob:')
  )
}

const MediaItem = ({ url, className, isPreview = false }) => {
  const isVideo = isVideoSource(url)
  if (isVideo) {
    return (
      <div
        className={cn(
          'relative bg-black flex items-center justify-center',
          'h-full w-full',
          className,
        )}
      >
        <video
          src={url}
          className={cn(
            'h-full w-full',
            isPreview ? 'object-contain' : 'object-cover',
          )}
          muted={!isPreview}
          controls={isPreview}
          autoPlay={isPreview}
          loop={!isPreview}
          playsInline
        />
        {!isPreview && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none">
            <div className="bg-white/20 backdrop-blur-md p-1.5 rounded-full">
              <Play className="text-white h-4 w-4 fill-current" />
            </div>
          </div>
        )}
      </div>
    )
  }
  return (
    <img
      src={url}
      alt="Media"
      className={cn(
        'h-full w-full',
        isPreview ? 'object-contain' : 'object-cover',
        className,
      )}
    />
  )
}

const PlatformIcon = ({ name }) => {
  // Map the id to the filename, handling your specific google_business naming
  const fileName = name === 'google_business' ? 'google_busines' : name
  const imgSrc = `/platformIcons/${fileName}.png`

  return (
    <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-card bg-white dark:bg-zinc-900 shadow-sm transition-transform hover:scale-110 overflow-hidden relative z-10">
      <img
        src={imgSrc}
        alt={name}
        className="size-5 object-contain"
        // Fallback for missing images
        onError={(e) => (e.target.style.display = 'none')}
      />
    </div>
  )
}

export default function DraftPostList({ clientId, onCreatePost }) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [previewPost, setPreviewPost] = useState(null)
  const [postToDelete, setPostToDelete] = useState(null)
  const [postToEdit, setPostToEdit] = useState(null)
  const [activeImageIndex, setActiveImageIndex] = useState(0)
  const [assignCampaignOpen, setAssignCampaignOpen] = useState(false)
  const [postToAssign, setPostToAssign] = useState(null)

  // Only DRAFT and PENDING_APPROVAL are directly editable
  const canEdit = (postStatus) =>
    ['DRAFT', 'PENDING_APPROVAL'].includes(postStatus)
  // NEEDS_REVISION creates a new version
  const canCreateNewVersion = (postStatus) => postStatus === 'NEEDS_REVISION'
  // Delete is allowed for everything except PUBLISHED
  const canDelete = (postStatus) => postStatus !== 'PUBLISHED'

  const createRevisionMutation = useMutation({
    mutationFn: (post) => createRevision(post.version_id, user?.id),
    onSuccess: (newVersionId) => {
      queryClient.invalidateQueries({ queryKey: ['draft-posts', clientId] })
      queryClient.invalidateQueries({ queryKey: ['global-posts'] })
      toast.success('New version created')
      navigate(`/clients/${clientId}/posts/${newVersionId}`)
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to create new version')
    },
  })

  const { data: sub } = useSubscription()

  const { data = [], isLoading } = useQuery({
    queryKey: ['draft-posts', clientId],
    queryFn: () => fetchAllPostsByClient(clientId),
  })

  const deleteMutation = useMutation({
    mutationFn: (postId) => deletePost(postId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['draft-posts', clientId] })
      queryClient.invalidateQueries({ queryKey: ['posts', clientId] })
      queryClient.invalidateQueries({ queryKey: ['global-posts'] })
      queryClient.invalidateQueries({ queryKey: ['calendar'] })
      queryClient.invalidateQueries({ queryKey: ['global-calendar'] })
      queryClient.invalidateQueries({ queryKey: ['global-post-counts'] })
      queryClient.invalidateQueries({ queryKey: ['postCounts', clientId] })
      toast.success('Post deleted successfully')
      setPostToDelete(null)
    },
    onError: (error) => {
      toast.error('Failed to delete post: ' + error.message)
      setPostToDelete(null)
    },
  })

  useEffect(() => {
    if (!previewPost) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveImageIndex(0)
    }
  }, [previewPost])

  const handlePrev = (e) => {
    e?.stopPropagation()
    setActiveImageIndex((prev) =>
      prev === 0 ? previewPost.media_urls.length - 1 : prev - 1,
    )
  }

  const handleNext = (e) => {
    e?.stopPropagation()
    setActiveImageIndex((prev) =>
      prev === previewPost.media_urls.length - 1 ? 0 : prev + 1,
    )
  }

  const renderMediaGrid = (post) => {
    const media = post.media_urls || []
    const count = media.length
    if (count === 0)
      return (
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/10 font-black text-2xl uppercase select-none">
          No Media
        </div>
      )
    if (count === 1) return <MediaItem url={media[0]} />
    if (count === 2)
      return (
        <div className="grid grid-cols-2 gap-0.5 w-full h-full">
          {media.map((url, i) => (
            <MediaItem key={i} url={url} />
          ))}
        </div>
      )
    return (
      <div className="grid grid-cols-2 gap-0.5 w-full h-full">
        <MediaItem url={media[0]} />
        <div className="grid grid-rows-2 gap-0.5 h-full overflow-hidden">
          <MediaItem url={media[1]} />
          <div className="relative h-full w-full">
            <MediaItem url={media[2]} />
            {count > 3 && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center pointer-events-none">
                <span className="text-white font-bold text-sm">
                  +{count - 3}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (isLoading)
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[400px] w-full rounded-2xl" />
        ))}
      </div>
    )

  if (data.length === 0)
    return (
      <Empty className="py-20 border border-dashed rounded-2xl bg-muted/5">
        <EmptyContent>
          <EmptyMedia variant="icon">
            <LayoutGrid className="size-6 text-muted-foreground/60" />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle className="font-normal text-xl">
              No posts yet
            </EmptyTitle>
            <EmptyDescription className="font-normal">
              Create your first draft to start building content for this client.
            </EmptyDescription>
          </EmptyHeader>
          {onCreatePost && (
            <Button onClick={onCreatePost} variant="outline" className="mt-2">
              <Plus className="size-4 mr-2" />
              Create Post
            </Button>
          )}
        </EmptyContent>
      </Empty>
    )

  return (
    <TooltipProvider>
      <div className="grid gap-6 grid-cols-[repeat(auto-fill,minmax(350px,1fr))]">
        {data.map((post) => {
          const platformsArr = Array.isArray(post.platform)
            ? post.platform
            : [post.platform]
          const displayedPlatforms = platformsArr.slice(0, 3)
          const remainingPlatforms = platformsArr.length - 3

          // Calculate health
          const isCompleted = ['PUBLISHED', 'ARCHIVED'].includes(post.status)
          const health = !isCompleted
            ? getUrgencyStatus(post.target_date)
            : null

          return (
            <div
              key={post.id}
              onClick={() =>
                navigate(`/clients/${clientId}/posts/${post.version_id}`)
              }
              className="flex flex-col bg-card/50 border dark:border-none rounded-2xl px-6 py-8 transition-all duration-200 cursor-pointer group"
            >
              {/* Header: Status, Version & Actions */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <StatusBadge status={getPublishState(post) || 'DRAFT'} />
                  <Badge
                    variant="secondary"
                    className="rounded-full text-muted-foreground hover:bg-muted/80 text-xs px-2.5 py-0.5 border-none font-medium font-mono"
                  >
                    v{post.version_number || '1'}
                  </Badge>
                  {post.campaign_id && post.campaign_name && (
                    <Tooltip delayDuration={300}>
                      <TooltipTrigger asChild>
                        <Badge
                          variant="secondary"
                          className="rounded-full flex items-center justify-center p-0 size-6 border-none hover:bg-muted/80"
                        >
                          <Megaphone className="h-3 w-3 text-muted-foreground" />
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{post.campaign_name}</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                  {post.deliverable_type &&
                    DELIVERABLE_TYPE_LABELS[post.deliverable_type] && (
                      <Badge
                        variant="outline"
                        className="rounded-full text-[10px] px-2 py-0.5 font-medium text-muted-foreground border-border/60"
                      >
                        {DELIVERABLE_TYPE_LABELS[post.deliverable_type]}
                      </Badge>
                    )}
                </div>

                <div onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-full transition-colors"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="w-48 rounded-xl"
                    >
                      <DropdownMenuItem
                        disabled={!canEdit(post.status || 'DRAFT')}
                        className="cursor-pointer font-medium text-foreground py-2"
                        onClick={(e) => {
                          e.stopPropagation()
                          setPostToEdit(post)
                        }}
                      >
                        <Edit2 className="h-4 w-4 mr-2" /> Edit Post
                      </DropdownMenuItem>
                      {canCreateNewVersion(post.status) && (
                        <DropdownMenuItem
                          disabled={createRevisionMutation.isPending}
                          className="cursor-pointer font-medium text-foreground py-2"
                          onClick={(e) => {
                            e.stopPropagation()
                            createRevisionMutation.mutate(post)
                          }}
                        >
                          <Plus className="h-4 w-4 mr-2" /> Create New Version
                        </DropdownMenuItem>
                      )}

                      {/* Assign to Campaign logic */}
                      {sub?.campaigns && (
                        <DropdownMenuItem
                          className="cursor-pointer font-medium text-foreground py-2"
                          onClick={(e) => {
                            e.stopPropagation()
                            setPostToAssign(post)
                            setAssignCampaignOpen(true)
                          }}
                        >
                          <FolderOpen className="h-4 w-4 mr-2 text-muted-foreground" />{' '}
                          Assign to Campaign
                        </DropdownMenuItem>
                      )}

                      <DropdownMenuItem
                        disabled={!canDelete(post.status || 'DRAFT')}
                        className="cursor-pointer font-medium text-destructive focus:bg-destructive/10 focus:text-destructive py-2"
                        onClick={(e) => {
                          e.stopPropagation()
                          setPostToDelete(post)
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-2" /> Delete Post
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Title */}
              <h3 className="text-lg font-medium tracking-tight text-foreground mb-6 line-clamp-1">
                {post.title || 'Untitled Draft'}
              </h3>

              {/* Media Preview Section */}
              <div
                className="relative aspect-video bg-muted/40 rounded-xl overflow-hidden mb-6 shrink-0 group/media border border-border/40"
                onClick={(e) => {
                  e.stopPropagation()
                  setPreviewPost(post)
                }}
              >
                {renderMediaGrid(post)}
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/media:opacity-100 transition-opacity flex items-center justify-center">
                  <div className="bg-white/20 backdrop-blur-md p-2 rounded-full shadow-sm">
                    <Eye className="text-white h-5 w-5" />
                  </div>
                </div>
              </div>

              {/* Description */}
              <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2 mb-6">
                {renderCaption(post.content)}
              </p>

              {/* Dotted Divider & Footer */}
              <div className="mt-auto">
                <hr className="border-t border-dashed border-border mb-4" />

                <div className="flex items-center justify-between">
                  {/* Platforms */}
                  <div className="flex items-center">
                    <div className="flex -space-x-2">
                      {displayedPlatforms.map((p, idx) => (
                        <PlatformIcon key={`${p}-${idx}`} name={p} />
                      ))}
                    </div>
                    {remainingPlatforms > 0 && (
                      <span className="text-xs font-medium text-muted-foreground ml-2">
                        +{remainingPlatforms}
                      </span>
                    )}
                  </div>

                  {/* Date Badge and Urgency Info */}
                  <div className="flex items-center gap-2 shrink-0">
                    {health && (
                      <div className="relative flex size-2 items-center justify-center shrink-0">
                        {health.pulse && (
                          <span className={cn('absolute inline-flex h-full w-full animate-ping rounded-full opacity-75', health.color)} />
                        )}
                        <span className={cn('relative inline-flex size-2 rounded-full', health.color)} />
                      </div>
                    )}
                    <span className="text-xs font-medium text-foreground whitespace-nowrap">
                      {post.status === 'PUBLISHED'
                        ? format(new Date(post.published_at || post.updated_at), 'd MMM, yyyy')
                        : post.target_date
                          ? format(new Date(post.target_date), "d MMM yyyy '·' h:mm a")
                          : 'No Date Set'}
                    </span>
                    {health?.label && ['Overdue', 'Urgent'].includes(health.label) && (
                      <span className={cn('text-xs font-semibold', health.color.replace('bg-', 'text-'))}>
                        {health.label}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Modals Stays Same */}
      <DraftPostForm
        clientId={clientId}
        open={!!postToEdit}
        onOpenChange={(isOpen) => !isOpen && setPostToEdit(null)}
        initialData={postToEdit}
      />

      <Dialog open={!!previewPost} onOpenChange={() => setPreviewPost(null)}>
        <DialogContent
          className="max-w-[85vw] sm:max-w-[85vw] md:max-w-[85vw] w-[85vw] h-[85vh] p-0 bg-transparent border-none shadow-none focus:outline-none flex items-center justify-center"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="relative flex items-center justify-center rounded-2xl bg-black/95 overflow-hidden shadow-2xl border border-white/10 w-full h-full">
            {previewPost && (
              <MediaItem
                key={previewPost.media_urls[activeImageIndex]}
                url={previewPost.media_urls[activeImageIndex]}
                isPreview={true}
              />
            )}

            {previewPost?.media_urls?.length > 1 && (
              <>
                <div className="absolute inset-0 flex items-center justify-between pointer-events-none px-4 lg:px-12">
                  <button
                    onClick={handlePrev}
                    className="pointer-events-auto p-3 rounded-full bg-black/50 text-white hover:bg-black/70 backdrop-blur-sm transition-all hover:scale-110"
                  >
                    <ChevronLeft className="h-8 w-8" />
                  </button>
                  <button
                    onClick={handleNext}
                    className="pointer-events-auto p-3 rounded-full bg-black/50 text-white hover:bg-black/70 backdrop-blur-sm transition-all hover:scale-110"
                  >
                    <ChevronRight className="h-8 w-8" />
                  </button>
                </div>

                <div className="absolute top-8 right-8 pointer-events-none">
                  <Badge className="bg-black/50 text-white border-white/10 backdrop-blur-md px-4 py-2 text-sm font-mono">
                    {activeImageIndex + 1} / {previewPost.media_urls.length}
                  </Badge>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!postToDelete}
        onOpenChange={(open) => !open && setPostToDelete(null)}
      >
        <DialogContent
          className="sm:max-w-[425px] rounded-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-full">
                <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <DialogTitle className="text-xl">Delete Post</DialogTitle>
            </div>
            <DialogDescription className="pt-4 text-base">
              Are you sure you want to delete{' '}
              <span className="font-semibold text-foreground">
                "{postToDelete?.title || 'Untitled Draft'}"
              </span>
              ? This action cannot be undone and all media will be permanently
              deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 mt-6">
            <Button
              variant="outline"
              onClick={() => setPostToDelete(null)}
              disabled={deleteMutation.isPending}
              className="rounded-xl w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                deleteMutation.mutate(
                  postToDelete?.actual_post_id || postToDelete?.id,
                )
              }
              disabled={deleteMutation.isPending}
              className="rounded-xl w-full sm:w-auto font-medium"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete Post'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AssignCampaignDialog
        open={assignCampaignOpen}
        onOpenChange={(val) => {
          setAssignCampaignOpen(val)
          if (!val) setPostToAssign(null)
        }}
        post={postToAssign}
      />
    </TooltipProvider>
  )
}
