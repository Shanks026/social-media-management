import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchAllPostsByClient, deletePost } from '@/api/posts'
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
  Film,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import { Card, CardContent } from '@/components/ui/card'
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
import { TooltipProvider } from '@/components/ui/tooltip'
import DraftPostForm from './DraftPostForm'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'
import PlatformBadge from '@/components/PlatformBadge'
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/lib/utils'

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
      <div className={cn('relative h-full w-full bg-black', className)}>
        <video
          src={url}
          className="h-full w-full object-cover"
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
      className={cn('h-full w-full object-cover', className)}
    />
  )
}

export default function DraftPostList({ clientId }) {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const navigate = useNavigate()

  // UI States
  const [previewPost, setPreviewPost] = useState(null)
  const [postToDelete, setPostToDelete] = useState(null)
  const [postToEdit, setPostToEdit] = useState(null)
  const [activeImageIndex, setActiveImageIndex] = useState(0)

  // Query posts
  const { data = [], isLoading } = useQuery({
    queryKey: ['draft-posts', clientId],
    queryFn: () => fetchAllPostsByClient(clientId),
  })

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: (postId) => deletePost(postId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['draft-posts', clientId] })
      queryClient.invalidateQueries({ queryKey: ['subscription', user?.id] })
      toast.success('Post and media deleted successfully')
      setPostToDelete(null)
    },
    onError: (err) => {
      console.error('Mutation Error:', err)
      toast.error('Failed to delete post')
    },
  })

  // Reset index when preview changes
  useEffect(() => {
    if (!previewPost) setActiveImageIndex(0)
  }, [previewPost])

  // Keyboard Navigation for Preview
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!previewPost || (previewPost.media_urls?.length || 0) <= 1) return
      if (e.key === 'ArrowLeft') handlePrev(e)
      if (e.key === 'ArrowRight') handleNext(e)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [previewPost, activeImageIndex])

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
    if (count === 0) return <div className="w-full h-full bg-muted/50" />

    if (count === 1) return <MediaItem url={media[0]} />

    if (count === 2)
      return (
        <div className="grid grid-cols-2 gap-1 w-full h-full">
          {media.map((url, i) => (
            <MediaItem key={i} url={url} />
          ))}
        </div>
      )

    return (
      <div className="grid grid-cols-2 gap-1 w-full h-full">
        <MediaItem url={media[0]} />
        <div className="grid grid-rows-2 gap-1 h-full overflow-hidden">
          <MediaItem url={media[1]} />
          <div className="relative h-full w-full">
            <MediaItem url={media[2]} />
            {count > 3 && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center pointer-events-none">
                <span className="text-white font-bold text-lg">
                  +{count - 3}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[350px] w-full rounded-2xl" />
        ))}
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <Empty className="mt-12">
        <EmptyHeader>
          <EmptyTitle>No drafts yet</EmptyTitle>
          <EmptyDescription>
            Create your first post to see it appearing here.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <TooltipProvider>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.map((post) => (
          <Card
            key={post.id}
            onClick={() =>
              navigate(`/clients/${clientId}/posts/${post.version_id}`)
            }
            className="group flex flex-col border-none shadow-none bg-[#FCFCFC] cursor-pointer dark:bg-card/70 p-6 gap-4 rounded-2xl transition-colors duration-200 hover:bg-[#F5F5F5] dark:hover:bg-card"
          >
            {/* Header: Status and Platforms */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <StatusBadge status={post.status || 'DRAFT'} />
                <div className="flex items-center gap-1.5">
                  {Array.isArray(post.platform) && post.platform.length > 0 ? (
                    <>
                      <PlatformBadge platform={post.platform[0]} />
                      {post.platform.length > 1 && (
                        <Badge
                          variant="secondary"
                          className="rounded-md px-2 py-1 text-xs font-bold"
                        >
                          +{post.platform.length - 1}
                        </Badge>
                      )}
                    </>
                  ) : (
                    <PlatformBadge platform={post.platform} />
                  )}
                </div>
              </div>

              <div onClick={(e) => e.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {post.status === 'DRAFT' ? (
                      <DropdownMenuItem
                        className="text-xs gap-2 cursor-pointer"
                        onClick={() => setPostToEdit(post)}
                      >
                        <Edit2 className="h-3 w-3" /> Edit Post
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem
                        disabled
                        className="text-xs gap-2 opacity-50"
                      >
                        <Edit2 className="h-3 w-3" /> Edit Locked
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      className="text-xs gap-2 text-destructive cursor-pointer"
                      onClick={() => setPostToDelete(post)}
                    >
                      <Trash2 className="h-3 w-3" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <h3 className="text-lg font-semibold text-foreground mt-2 line-clamp-1">
              {post.title || 'Untitled Draft'}
            </h3>

            {/* Media Preview Section */}
            <div
              className="relative aspect-video rounded-xl overflow-hidden bg-muted cursor-pointer group/media"
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

            <CardContent className="p-0 flex-grow">
              <p className="text-[13px] text-muted-foreground line-clamp-2 leading-snug">
                {post.content || 'No description provided.'}
              </p>
            </CardContent>

            <div className="pt-3 border-t border-border mt-2">
              <span className="text-muted-foreground text-xs font-medium">
                Created{' '}
                {format(
                  new Date(post.display_date || Date.now()),
                  'd MMM, yyyy',
                )}
              </span>
            </div>
          </Card>
        ))}
      </div>

      {/* Edit Form Modal */}
      <DraftPostForm
        clientId={clientId}
        open={!!postToEdit}
        onOpenChange={(isOpen) => !isOpen && setPostToEdit(null)}
        initialData={postToEdit}
      />

      {/* Fullscreen Media Slider */}
      <Dialog open={!!previewPost} onOpenChange={() => setPreviewPost(null)}>
        <DialogContent className="max-w-[90vw] lg:max-w-[1100px] h-[85vh] p-0 bg-transparent border-none shadow-none flex items-center justify-center overflow-hidden">
          <div className="relative w-full h-full flex items-center justify-center">
            <div className="relative w-full h-full overflow-hidden rounded-3xl bg-black/95 flex items-center justify-center border border-white/10">
              {/* Conditional Video/Image Rendering in Slider */}
              <div className="w-full h-full flex items-center justify-center">
                {previewPost && (
                  <MediaItem
                    url={previewPost.media_urls[activeImageIndex]}
                    className="object-contain"
                    isPreview={true}
                  />
                )}
              </div>

              {previewPost?.media_urls?.length > 1 && (
                <>
                  <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 flex justify-between pointer-events-none z-50">
                    <button
                      onClick={handlePrev}
                      className="pointer-events-auto p-4 rounded-2xl bg-black/40 text-white hover:bg-black/60 backdrop-blur-xl transition-all"
                    >
                      <ChevronLeft className="h-8 w-8" />
                    </button>
                    <button
                      onClick={handleNext}
                      className="pointer-events-auto p-4 rounded-2xl bg-black/40 text-white hover:bg-black/60 backdrop-blur-xl transition-all"
                    >
                      <ChevronRight className="h-8 w-8" />
                    </button>
                  </div>
                  <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50">
                    <Badge className="bg-white/10 text-white border-none backdrop-blur-md px-4 py-1.5 font-mono">
                      {activeImageIndex + 1} / {previewPost.media_urls.length}
                    </Badge>
                  </div>
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!postToDelete} onOpenChange={() => setPostToDelete(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive font-bold">
              <AlertTriangle className="h-5 w-5" /> Delete Post
            </DialogTitle>
            <DialogDescription className="py-3 text-foreground/80">
              This will permanently delete{' '}
              <span className="font-bold">"{postToDelete?.title}"</span> and all
              its versions. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="ghost"
              onClick={() => setPostToDelete(null)}
              disabled={deleteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteMutation.mutate(postToDelete.actual_post_id)}
              disabled={deleteMutation.isPending}
              className="font-bold"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete Permanently'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  )
}
