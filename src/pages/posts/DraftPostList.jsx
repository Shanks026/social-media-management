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
  Clock,
  Layers,
  Instagram,
  Linkedin,
  Twitter,
  Facebook,
  Youtube,
  Globe,
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
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/lib/utils'

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

const PlatformIcon = ({ name }) => {
  const icons = {
    instagram: {
      icon: <Instagram className="size-3.5 text-white" />,
      bg: 'bg-[#E4405F]',
    },
    linkedin: {
      icon: <Linkedin className="size-3.5 text-white" />,
      bg: 'bg-[#0077B5]',
    },
    twitter: {
      icon: <Twitter className="size-3.5 text-white dark:text-black" />,
      bg: 'bg-black dark:bg-white',
    },
    facebook: {
      icon: <Facebook className="size-3.5 text-white" />,
      bg: 'bg-[#1877F2]',
    },
    youtube: {
      icon: <Youtube className="size-3.5 text-white" />,
      bg: 'bg-[#FF0000]',
    },
    google_business: {
      icon: <Globe className="size-3.5 text-white" />,
      bg: 'bg-[#4285F4]',
    },
  }
  const platform = icons[name.toLowerCase()]
  if (!platform) return null
  return (
    <div
      className={cn(
        'flex h-7 w-7 items-center justify-center rounded-full border-2 border-background shadow-sm shrink-0',
        platform.bg,
      )}
    >
      {platform.icon}
    </div>
  )
}

export default function DraftPostList({ clientId }) {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [previewPost, setPreviewPost] = useState(null)
  const [postToDelete, setPostToDelete] = useState(null)
  const [postToEdit, setPostToEdit] = useState(null)
  const [activeImageIndex, setActiveImageIndex] = useState(0)

  const { data = [], isLoading } = useQuery({
    queryKey: ['draft-posts', clientId],
    queryFn: () => fetchAllPostsByClient(clientId),
  })

  const deleteMutation = useMutation({
    mutationFn: (postId) => deletePost(postId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['draft-posts', clientId] })
      toast.success('Post deleted successfully')
      setPostToDelete(null)
    },
  })

  useEffect(() => {
    if (!previewPost) setActiveImageIndex(0)
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
      <Empty className="mt-12">
        <EmptyHeader>
          <EmptyTitle>No drafts yet</EmptyTitle>
          <EmptyDescription>
            Create your first post to see it appearing here.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )

  return (
    <TooltipProvider>
      <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(400px,1fr))]">
        {data.map((post) => {
          const platforms = Array.isArray(post.platform)
            ? post.platform
            : [post.platform]

          return (
            <div
              key={post.id}
              onClick={() =>
                navigate(`/clients/${clientId}/posts/${post.version_id}`)
              }
              className="flex flex-col bg-card border rounded-xl overflow-hidden hover:bg-muted/30 transition-colors duration-200 cursor-pointer group"
            >
              {/* Media Preview Section */}
              <div
                className="relative aspect-video bg-muted overflow-hidden shrink-0 group/media"
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

              <div className="p-6 flex flex-col flex-1">
                {/* 🛠️ Updated Header: Status | Version | Actions */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <StatusBadge status={post.status || 'DRAFT'} />
                    <Badge
                      variant="secondary"
                      className="text-xs"
                    >
                      v{post.version_number || '1'}
                    </Badge>
                  </div>

                  <div onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 hover:bg-muted transition-colors"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem
                          onClick={() => setPostToEdit(post)}
                          className="text-xs gap-2 cursor-pointer"
                        >
                          <Edit2 className="h-3 w-3" /> Edit Post
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setPostToDelete(post)}
                          className="text-xs gap-2 text-destructive cursor-pointer"
                        >
                          <Trash2 className="h-3 w-3" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                <div className="mb-6 space-y-2">
                  <h4 className="text-lg font-bold tracking-tight leading-tight text-foreground line-clamp-1">
                    {post.title || 'Untitled Draft'}
                  </h4>
                  <p className="text-sm font-medium text-muted-foreground leading-[1.6] line-clamp-2">
                    {post.content || 'No description provided.'}
                  </p>
                </div>

                <div className="flex items-center justify-between mt-auto pt-5 border-t border-border/50">
                  <div className="flex items-center -space-x-2">
                    {platforms.map((p, idx) => (
                      <PlatformIcon key={`${p}-${idx}`} name={p} />
                    ))}
                  </div>

                  {/* 🛠️ Updated Date: Target Date + Time */}
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Clock size={14} className="text-foreground/70" />
                    <span className="text-xs font-semibold capitalize text-foreground">
                      {post.target_date
                        ? format(new Date(post.target_date), 'd MMM, p')
                        : 'No Date Set'}
                    </span>
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
          className="max-w-[90vw] lg:max-w-[1100px] h-[85vh] p-0 bg-transparent border-none shadow-none overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="relative w-full h-full rounded-3xl bg-black/95 flex items-center justify-center border border-white/10">
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
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  )
}
