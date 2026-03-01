import { useState } from 'react'
import { format } from 'date-fns'
import {
  Clock,
  Layers,
  Instagram,
  Linkedin,
  Twitter,
  Facebook,
  Youtube,
  Globe,
  Eye,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Edit2,
  Trash2,
  AlertTriangle,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { getUrgencyStatus } from '@/lib/client-helpers'
import StatusBadge from '@/components/StatusBadge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { deleteMeeting } from '@/api/meetings'
import { deletePost } from '@/api/posts'
import CreateMeetingDialog from '@/components/CreateMeetingDialog'

/**
 * Helper to check if a URL is a video
 */
const isVideoSource = (url) => {
  if (!url) return false
  const videoExtensions = ['.mp4', '.mov', '.webm', '.ogg', '.m4v']
  return (
    videoExtensions.some((ext) => url.toLowerCase().includes(ext)) ||
    url.includes('video') ||
    url.startsWith('blob:')
  )
}

/**
 * Reusable Media Item to handle Video vs Image rendering
 */
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

export function CalendarPostCard({ post }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [activeImageIndex, setActiveImageIndex] = useState(0)
  const [postToDelete, setPostToDelete] = useState(null)

  const { mutate: handleDeleteMeeting, isPending: isDeletingMeeting } =
    useMutation({
      mutationFn: () => deleteMeeting(post.id),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['meetings'] })
        queryClient.invalidateQueries({ queryKey: ['todayMeetings'] })
        queryClient.invalidateQueries({ queryKey: ['upcomingMeetings'] })
        queryClient.invalidateQueries({ queryKey: ['calendar'] })
        toast.success('Meeting marked as done')
      },
      onError: (error) => {
        toast.error('Failed to update meeting: ' + error.message)
      },
    })

  const { mutate: handleDeletePost, isPending: isDeletingPost } = useMutation({
    mutationFn: (postId) => deletePost(postId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['draft-posts', post?.client_id] })
      queryClient.invalidateQueries({ queryKey: ['posts', post?.client_id] })
      queryClient.invalidateQueries({ queryKey: ['global-posts'] })
      queryClient.invalidateQueries({ queryKey: ['calendar'] })
      queryClient.invalidateQueries({ queryKey: ['global-calendar'] })
      queryClient.invalidateQueries({ queryKey: ['global-post-counts'] })
      queryClient.invalidateQueries({ queryKey: ['postCounts', post?.client_id] })
      toast.success('Post deleted successfully')
      setPostToDelete(null)
    },
    onError: (error) => {
      toast.error('Failed to delete post: ' + error.message)
      setPostToDelete(null)
    }
  })

  const handleCardClick = () => {
    navigate(`/clients/${post.client_id}/posts/${post.version_id}`)
  }

  if (!post) return null

  if (post.isMeeting) {
    return (
      <div
        className="flex flex-col bg-card/50 shadow-sm rounded-2xl px-6 py-8 transition-all duration-200 border border-blue-200/50 dark:border-blue-900/50"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 rounded-full px-2.5 py-0.5 border-none font-medium">
              Meeting
            </Badge>
          </div>
          <div className="flex items-center gap-2 min-w-0" onClick={(e) => e.stopPropagation()}>
             <div className="size-5 rounded-md bg-blue-100 dark:bg-blue-900 flex items-center justify-center shrink-0 ring-1 ring-border">
                <span className="text-[10px] font-bold text-blue-600 dark:text-blue-300">
                   {post.client_name?.charAt(0) || 'M'}
                </span>
             </div>
            <span className="text-xs font-semibold text-foreground truncate max-w-[100px]">
              {post.client_name}
            </span>
          </div>
        </div>

        {/* Title */}
        <h3 className="text-lg font-medium tracking-tight text-foreground mb-6 line-clamp-1">
          {post.title}
        </h3>

        {/* Description */}
        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2 mb-6 min-h-10">
          {post.notes || 'No agenda provided'}
        </p>

        {/* Dotted Divider & Footer */}
        <div className="mt-auto">
          <hr className="border-t border-dashed border-border mb-4" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreateMeetingDialog editMeeting={post} defaultClientId={post.client_id}>
                <Button variant="outline" size="sm" className="h-7 text-xs px-2" onClick={(e) => e.stopPropagation()}>
                  Reschedule
                </Button>
              </CreateMeetingDialog>
              <Button
                variant="secondary"
                size="sm"
                className="h-7 text-xs px-2"
                onClick={(e) => {
                  e.stopPropagation()
                  handleDeleteMeeting()
                }}
                disabled={isDeletingMeeting}
              >
                Mark as done
              </Button>
            </div>
            {/* Date Badge */}
            <div className="bg-muted/50 rounded-full px-3 py-1.5 flex items-center justify-center">
              <span className="text-[13px] font-medium text-muted-foreground tracking-tight flex items-center gap-1.5">
                <Clock size={14} className="text-blue-500" />
                {post.target_date
                  ? format(new Date(post.target_date), "d MMMM yyyy '•' h:mm a")
                  : 'No Date Set'}
              </span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const handlePrev = (e) => {
    e?.stopPropagation()
    setActiveImageIndex((prev) =>
      prev === 0 ? post.media_urls.length - 1 : prev - 1,
    )
  }

  const handleNext = (e) => {
    e?.stopPropagation()
    setActiveImageIndex((prev) =>
      prev === post.media_urls.length - 1 ? 0 : prev + 1,
    )
  }

  const renderMediaGrid = () => {
    const media = post.media_urls || []
    const count = media.length
    if (count === 0) {
      return (
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/10 font-black text-3xl uppercase tracking-tighter select-none">
          No Media
        </div>
      )
    }

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

  const platformsArr = Array.isArray(post.platforms) ? post.platforms : []
  const displayedPlatforms = platformsArr.slice(0, 3)
  const remainingPlatforms = platformsArr.length - 3

  // Status mapping
  const postStatus = post.status || 'DRAFT'
  // Determine action visibility
  // Edit is allowed for: DRAFT, PENDING_APPROVAL, NEEDS_REVISION, SCHEDULED
  const canEdit = ['DRAFT', 'PENDING_APPROVAL', 'NEEDS_REVISION', 'SCHEDULED'].includes(postStatus)
  // Delete is allowed for EVERYTHING EXCEPT PUBLISHED
  const canDelete = postStatus !== 'PUBLISHED'

  // Calculate health
  const isCompleted = ['PUBLISHED', 'ARCHIVED'].includes(postStatus)
  const health = !isCompleted ? getUrgencyStatus(post.target_date) : null

  return (
    <>
      {/* 1. The Main Clickable Card */}
      <div
        onClick={handleCardClick}
        className="flex flex-col bg-card/50 border dark:border-none rounded-2xl px-6 py-8 transition-all duration-200 cursor-pointer group"
      >
        {/* Header: Status, Version & ClientInfo */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <StatusBadge status={post.status || 'DRAFT'} />
            <Badge variant="secondary" className="rounded-full text-muted-foreground hover:bg-muted/80 text-xs px-2.5 py-0.5 border-none font-medium font-mono">
              v{post.version_number || '1'}
            </Badge>
          </div>
          <div className="flex items-center gap-3 min-w-0" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 min-w-0">
              {post.client_logo && (
                <img
                  src={post.client_logo}
                  alt=""
                  className="size-5 rounded-lg object-cover ring-1 ring-border shrink-0"
                  onError={(e) => (e.target.style.display = 'none')}
                />
              )}
              <span className="text-xs font-semibold text-foreground truncate max-w-[100px]">
                {post.client_name}
              </span>
            </div>

            {/* Dropdown Menu for Actions */}
            {(canEdit || canDelete) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:bg-muted"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40 rounded-xl">
                  {canEdit && (
                    <DropdownMenuItem
                      className="cursor-pointer font-medium text-foreground py-2"
                      onClick={(e) => {
                        e.stopPropagation()
                        navigate(
                          `/clients/${post.client_id}/posts/${post.version_id}`
                        )
                      }}
                    >
                      <Edit2 className="h-4 w-4 mr-2" /> Edit Post
                    </DropdownMenuItem>
                  )}
                  {canDelete && (
                    <DropdownMenuItem
                      className="cursor-pointer font-medium text-destructive focus:bg-destructive/10 focus:text-destructive py-2"
                      onClick={(e) => {
                        e.stopPropagation()
                        setPostToDelete(post)
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-2" /> Delete Post
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {/* Title */}
        <h3 className="text-lg font-medium tracking-tight text-foreground mb-6 line-clamp-1">
          {post.title || 'Untitled Draft'}
        </h3>

        {/* Media Preview Section */}
        <div
          className="relative aspect-video bg-muted/40 rounded-xl overflow-hidden mb-6 shrink-0 group/media border border-border/40 cursor-pointer"
          onClick={(e) => {
            e.stopPropagation() // Prevents CardClick when clicking to open preview
            setIsPreviewOpen(true)
          }}
        >
          {renderMediaGrid()}
          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/media:opacity-100 transition-opacity flex items-center justify-center">
            <div className="bg-white/20 backdrop-blur-md p-2 rounded-full shadow-sm">
              <Eye className="text-white h-5 w-5" />
            </div>
          </div>
        </div>

        {/* Description */}
        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2 mb-6">
          {post.content || 'No description provided.'}
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
            <div
              className={cn(
                "rounded-full px-3 py-1.5 flex items-center justify-center gap-2 border shadow-sm",
                health?.label === 'Overdue'
                  ? "bg-destructive/10 border-destructive/20 text-destructive"
                  : "bg-muted/50 border-border/50 text-muted-foreground"
              )}
            >
              {health && health.color && (
                <div className="flex items-center gap-1.5">
                  <div className="relative flex h-2 w-2 items-center justify-center">
                    {health.pulse && (
                      <span
                        className={cn(
                          'absolute inline-flex h-full w-full animate-ping rounded-full opacity-75',
                          health.color
                        )}
                      />
                    )}
                    <span
                      className={cn(
                        'relative inline-flex h-2 w-2 rounded-full',
                        health.color
                      )}
                    />
                  </div>
                  {['Overdue', 'Urgent'].includes(health.label) && (
                    <span className="text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">
                      {health.label}
                    </span>
                  )}
                </div>
              )}
              <span className="text-[13px] font-medium tracking-tight whitespace-nowrap">
                {post.target_date
                  ? format(new Date(post.target_date), "d MMMM yyyy '•' h:mm a")
                  : 'No Date Set'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. The Dialog: Sibling to the Card, NOT a child */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent
          className="max-w-[85vw] sm:max-w-[85vw] md:max-w-[85vw] w-[85vw] h-[85vh] p-0 bg-transparent border-none shadow-none focus:outline-none flex items-center justify-center"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="relative flex items-center justify-center rounded-2xl bg-black/95 overflow-hidden shadow-2xl border border-white/10 w-full h-full">
            {post.media_urls?.[activeImageIndex] && (
              <MediaItem
                key={post.media_urls[activeImageIndex]}
                url={post.media_urls[activeImageIndex]}
                isPreview={true}
              />
            )}

            {post.media_urls?.length > 1 && (
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
                    {activeImageIndex + 1} / {post.media_urls.length}
                  </Badge>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 3. Delete Confirmation Dialog */}
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
          <DialogFooter className="gap-2 mt-6">
            <Button
              variant="outline"
              onClick={() => setPostToDelete(null)}
              disabled={isDeletingPost}
  
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleDeletePost(postToDelete?.actual_post_id || postToDelete?.id)}
              disabled={isDeletingPost}
              
            >
              {isDeletingPost ? 'Deleting...' : 'Delete Post'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
