import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchAllPostsByClient, deletePost } from '@/api/posts'
import StatusBadge from '@/components/StatusBadge'
import {
  MoreVertical,
  Folder,
  Eye,
  Edit2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  X,
  AlertTriangle,
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
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { toast } from 'sonner'
import { Navigate, useNavigate } from 'react-router-dom'
import PlatformBadge from '@/components/PlatformBadge'

export default function DraftPostList({ clientId }) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [previewPost, setPreviewPost] = useState(null)
  const [postToDelete, setPostToDelete] = useState(null)
  const [postToEdit, setPostToEdit] = useState(null)
  const [activeImageIndex, setActiveImageIndex] = useState(0)

  const { data = [], isLoading } = useQuery({
    queryKey: ['draft-posts', clientId],
    queryFn: () => fetchAllPostsByClient(clientId),
  })

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: (postId) => deletePost(postId),
    onSuccess: () => {
      // FIX: Use the object format for invalidateQueries
      queryClient.invalidateQueries({ queryKey: ['draft-posts', clientId] })
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
      if (!previewPost || previewPost.media_urls.length <= 1) return
      if (e.key === 'ArrowLeft') handlePrev(e)
      if (e.key === 'ArrowRight') handleNext(e)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [previewPost, activeImageIndex])

  const renderMediaGrid = (post) => {
    const media = post.media_urls || []
    const count = media.length
    if (count === 0) return <div className="w-full h-full bg-muted/50" />
    if (count === 1)
      return (
        <img src={media[0]} alt="" className="w-full h-full object-cover" />
      )
    if (count === 2)
      return (
        <div className="grid grid-cols-2 gap-1 w-full h-full">
          {media.map((url, i) => (
            <img
              key={i}
              src={url}
              alt=""
              className="w-full h-full object-cover"
            />
          ))}
        </div>
      )
    return (
      <div className="grid grid-cols-2 gap-1 w-full h-full">
        <img src={media[0]} alt="" className="w-full h-full object-cover" />
        <div className="grid grid-rows-2 gap-1 h-full overflow-hidden">
          <img src={media[1]} alt="" className="w-full h-full object-cover" />
          <div className="relative h-full w-full">
            <img src={media[2]} alt="" className="w-full h-full object-cover" />
            {count > 3 && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
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

  const handlePrev = (e) => {
    e.stopPropagation()
    setActiveImageIndex((prev) =>
      prev === 0 ? previewPost.media_urls.length - 1 : prev - 1,
    )
  }

  const handleNext = (e) => {
    e.stopPropagation()
    setActiveImageIndex((prev) =>
      prev === previewPost.media_urls.length - 1 ? 0 : prev + 1,
    )
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[300px] w-full rounded-2xl" />
        ))}
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.map((post) => (
          <Card
            key={post.id}
            // The Main Navigation
            onClick={() => navigate(`/clients/${clientId}/posts/${post.id}`)}
            className="group flex flex-col border-none shadow-none bg-[#FCFCFC] cursor-pointer dark:bg-card/70 p-6 gap-4 rounded-2xl transition-colors duration-200 hover:bg-[#F5F5F5] dark:hover:bg-card"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <StatusBadge status={post.status || 'DRAFT'} />
                <div className="flex items-center gap-1.5">
                  {Array.isArray(post.platform) && post.platform.length > 0 ? (
                    <>
                      {/* Always show only the first platform badge */}
                      <PlatformBadge platform={post.platform[0]} />

                      {/* Show the count for everything else (if 2 or more total) */}
                      {post.platform.length > 1 && (
                        <Badge
                          variant="secondary"
                          className="rounded-md px-2 py-1 border-none shadow-none text-xs font-bold text-muted-foreground"
                        >
                          +{post.platform.length - 1}
                        </Badge>
                      )}
                    </>
                  ) : (
                    /* Fallback for single strings (legacy data) */
                    <PlatformBadge platform={post.platform} />
                  )}
                </div>
              </div>

              {/* FIX 1: Stop propagation on the Dropdown Trigger */}
              <div onClick={(e) => e.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:bg-transparent"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {post.status === 'DRAFT' ? (
                      <DropdownMenuItem
                        className="text-xs gap-2 cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation() // FIX 2: Prevent navigation when clicking edit
                          setPostToEdit(post)
                        }}
                      >
                        <Edit2 className="h-3 w-3" /> Edit Post
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem
                        className="text-xs gap-2 opacity-50 cursor-not-allowed"
                        disabled
                      >
                        <Edit2 className="h-3 w-3" /> Edit Locked
                      </DropdownMenuItem>
                    )}
                    {post.status === 'DRAFT' && (
                      <DropdownMenuItem
                        className="text-xs gap-2 text-destructive"
                        onClick={(e) => {
                          e.stopPropagation() // FIX 3: Prevent navigation when clicking delete
                          setPostToDelete(post)
                        }}
                      >
                        <Trash2 className="h-3 w-3" /> Delete
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <h3 className="text-lg font-semibold text-foreground mt-2">
              {post.title || 'Draft Post'}
            </h3>

            {/* FIX 4: Stop propagation on the Media Grid click */}
            <div
              className="relative aspect-video rounded-xl overflow-hidden bg-muted cursor-pointer group/media"
              onClick={(e) => {
                e.stopPropagation() // Prevents navigating to details page when previewing
                setPreviewPost(post)
              }}
            >
              {renderMediaGrid(post)}
              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/media:opacity-100 transition-opacity flex items-center justify-center">
                <div className="bg-white/20 backdrop-blur-md p-2 rounded-full">
                  <Eye className="text-white h-5 w-5" />
                </div>
              </div>
            </div>

            <CardContent className="p-0 flex-grow">
              <p className="text-[13px] text-muted-foreground line-clamp-2 leading-snug">
                {post.content || 'No content provided.'}
              </p>
            </CardContent>

            <div className="pt-3 border-t border-border mt-2">
              <span className="text-muted-foreground text-xs font-medium">
                Created On{' '}
                {format(new Date(post.created_at || Date.now()), 'd MMM, yyyy')}
              </span>
            </div>
          </Card>
        ))}
      </div>

      <DraftPostForm
        clientId={clientId}
        open={!!postToEdit}
        onOpenChange={(isOpen) => !isOpen && setPostToEdit(null)}
        initialData={postToEdit}
      />

      {/* Media Slider Preview Dialog */}
      <Dialog open={!!previewPost} onOpenChange={() => setPreviewPost(null)}>
        <DialogContent className="max-w-[90vw] lg:max-w-[1100px] h-[85vh] p-0 bg-transparent border-none shadow-none flex flex-col items-center justify-center overflow-visible">
          <div className="relative w-full h-full group flex items-center justify-center">
            <div className="relative w-full h-full overflow-hidden rounded-3xl bg-black/95 shadow-2xl flex items-center justify-center border border-white/10">
              <img
                src={previewPost?.media_urls[activeImageIndex]}
                alt="Preview"
                className="w-full h-full object-contain"
              />

              {previewPost?.media_urls?.length > 1 && (
                <>
                  <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 flex justify-between items-center pointer-events-none">
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
                  <div className="absolute top-6 left-1/2 -translate-x-1/2">
                    <Badge className="bg-white/10 text-white border-none backdrop-blur-md px-4 py-1.5 font-medium">
                      {activeImageIndex + 1} / {previewPost.media_urls.length}
                    </Badge>
                  </div>
                  <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2 p-2 bg-black/20 backdrop-blur-md rounded-full">
                    {previewPost.media_urls.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setActiveImageIndex(idx)}
                        className={`h-2 rounded-full transition-all duration-300 ${idx === activeImageIndex ? 'bg-white w-8' : 'bg-white/30 w-2'}`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!postToDelete} onOpenChange={() => setPostToDelete(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> Delete Post
            </DialogTitle>
            <DialogDescription className="py-3">
              Are you sure you want to delete{' '}
              <span className="font-semibold text-foreground">
                "{postToDelete?.title}"
              </span>
              ? This will permanently remove the post and its{' '}
              <span className="font-bold">
                {postToDelete?.media_urls?.length || 0} attached media files
              </span>
              .
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
            {/* Inside the Delete Confirmation Dialog */}
            <Button
              variant="destructive"
              onClick={() => {
                // Use post_id to delete the parent post,
                // or just .id if you only want to delete that specific version
                deleteMutation.mutate(postToDelete.post_id)
              }}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete Permanently'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  )
}
