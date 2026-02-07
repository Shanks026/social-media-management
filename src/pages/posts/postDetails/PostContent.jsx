import { useState, useEffect, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { toast } from 'sonner'
import {
  Loader2,
  Clock,
  Calendar as CalendarIcon,
  Plus,
  Pencil,
  AlertCircle,
  MessageSquareText,
  ChevronLeft,
  ChevronRight,
  Eye,
  CheckCircle2,
  Trash2,
  History,
  Play,
  ChevronDownIcon,
} from 'lucide-react'

// UI Components
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ButtonGroup } from '@/components/ui/button-group'
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

// Custom Components & API
import { deleteIndividualMedia } from '@/api/posts'
import { useAuth } from '@/context/AuthContext'
import StatusBadge from '@/components/StatusBadge'
import PlatformBadge from '@/components/PlatformBadge'
import ClientNotes from './ClientNotes'
import { cn } from '@/lib/utils'
import SocialMediaPreview from '../socialMediaPreview/SocialMediaPreview'

/**
 * Utility: Media Type Check
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
 * Shared Media Component
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
            <div className="bg-white/20 backdrop-blur-md p-2 rounded-full shadow-sm">
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
      alt="Media Asset"
      className={cn('h-full w-full object-cover', className)}
    />
  )
}

export default function PostContent({
  post,
  showHistory,
  setShowHistory,
  onSendForApproval,
  onPublish,
  onCreateRevision,
  isRevisionPending,
  isApprovalPending,
  isPublishPending,
  onEdit,
}) {
  const notesRef = useRef(null)
  const queryClient = useQueryClient()
  const { user } = useAuth()

  // States
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [isSocialPreviewOpen, setIsSocialPreviewOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [mediaToDelete, setMediaToDelete] = useState(null)

  const canEdit = post.status === 'DRAFT' || post.status === 'PENDING_APPROVAL'
  const canSendForApproval =
    post.status === 'DRAFT' && post.content && post.media_urls?.length > 0

  // Keyboard Navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isPreviewOpen || (post.media_urls?.length ?? 0) <= 1) return
      if (e.key === 'ArrowLeft') handlePrev()
      if (e.key === 'ArrowRight') handleNext()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isPreviewOpen, post.media_urls])

  const handlePrev = () =>
    setActiveIndex((p) => (p === 0 ? post.media_urls.length - 1 : p - 1))
  const handleNext = () =>
    setActiveIndex((p) => (p === post.media_urls.length - 1 ? 0 : p + 1))

  const deleteMediaMutation = useMutation({
    mutationFn: (url) => deleteIndividualMedia(post.id, url, post.media_urls),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['post-version', post.id] })
      toast.success('Media removed')
      setMediaToDelete(null)
    },
  })

  const formatDate = (date) => (date ? format(new Date(date), 'dd MMM, p') : '')

  return (
    <div className="flex-1 p-8 space-y-6 min-w-0">
      {/* Revision Banner */}
      {post.status === 'NEEDS_REVISION' && (
        <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-200 bg-amber-50/50 dark:bg-amber-500/5 dark:border-amber-500/20 max-w-2xl">
          <AlertCircle className="h-5 w-5 text-amber-600 dark:mt-0.5 shrink-0" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
              Revision Required
            </p>
            <p className="text-sm text-amber-800/90 dark:text-amber-400/90 leading-relaxed">
              Check the{' '}
              <button
                onClick={() =>
                  notesRef.current?.scrollIntoView({ behavior: 'smooth' })
                }
                className="font-semibold underline"
              >
                client feedback
              </button>{' '}
              below, implement changes, and create a new version.
            </p>
          </div>
        </div>
      )}

      {/* Main Header */}
      <div className="flex flex-col md:flex-row justify-between items-start gap-6">
        <div className="space-y-6 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge status={post.status} />
            <div className="flex flex-wrap gap-2">
              {[].concat(post.platform || []).map((p) => (
                <PlatformBadge key={p} platform={p} />
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex flex-row items-center gap-3">
              <h1 className="text-4xl font-semibold tracking-tight">
                {post.title}
              </h1>
              <Badge
                variant="outline"
                className="h-6 text-xs font-medium text-muted-foreground"
              >
                v{post.version_number}.0
              </Badge>
            </div>

            <div className="flex flex-wrap items-center gap-y-2 gap-x-6 py-1">
              <span className="text-sm text-muted-foreground/70">
                Created {format(new Date(post.created_at), 'dd MMM, yyyy')}
              </span>

              {post.status === 'PUBLISHED' ? (
                <div className="flex items-center gap-2 text-sm">
                  <div className="h-4 w-[1px] bg-border hidden sm:block" />
                  <CheckCircle2 size={14} className="text-lime-600" />
                  <span className="font-medium">Published:</span>
                  <Badge variant="secondary">
                    {formatDate(post.published_at || post.updated_at)}
                  </Badge>
                </div>
              ) : (
                post.target_date && (
                  <div className="flex items-center gap-2 text-sm">
                    <div className="h-4 w-[1px] bg-border hidden sm:block" />
                    {post.status === 'SCHEDULED' ? (
                      <Clock size={14} className="text-violet-600" />
                    ) : (
                      <CalendarIcon size={14} />
                    )}
                    <span className="text-muted-foreground">
                      {post.status === 'SCHEDULED'
                        ? 'Scheduled for:'
                        : 'Target Date:'}
                    </span>
                    <Badge
                      variant={
                        post.status === 'SCHEDULED' ? 'secondary' : 'outline'
                      }
                    >
                      {formatDate(post.target_date)}
                    </Badge>
                  </div>
                )
              )}
            </div>
          </div>
        </div>

        {/* 🛠️ Consolidated Button Group */}
        <div className="shrink-0">
          <ButtonGroup>
            {/* Static Preview Button */}
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => setIsSocialPreviewOpen(true)}
            >
              <Eye size={16} />
              <span className="hidden sm:inline">Social Media Preview</span>
              <span className="sm:hidden">Preview</span>
            </Button>

            {/* Actions Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2 px-3">
                  Actions
                  <ChevronDownIcon size={14} className="opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {canEdit && (
                  <DropdownMenuItem onClick={onEdit}>
                    <Pencil size={14} className="mr-2" /> Edit Details
                  </DropdownMenuItem>
                )}

                {!showHistory && (
                  <DropdownMenuItem onClick={() => setShowHistory(true)}>
                    <History size={14} className="mr-2" /> View Version History
                  </DropdownMenuItem>
                )}

                {post.status === 'DRAFT' && (
                  <DropdownMenuItem
                    disabled={!canSendForApproval || isApprovalPending}
                    onClick={onSendForApproval}
                    className="font-semibold text-primary focus:text-primary"
                  >
                    {isApprovalPending ? (
                      <Loader2 size={14} className="mr-2 animate-spin" />
                    ) : (
                      <CheckCircle2 size={14} className="mr-2" />
                    )}
                    Send for Approval
                  </DropdownMenuItem>
                )}

                {post.status === 'SCHEDULED' && (
                  <DropdownMenuItem
                    disabled={isPublishPending}
                    onClick={onPublish}
                    className="font-semibold"
                  >
                    {isPublishPending ? (
                      <Loader2 size={14} className="mr-2 animate-spin" />
                    ) : (
                      <Play size={14} className="mr-2" />
                    )}
                    Publish Now
                  </DropdownMenuItem>
                )}

                {post.status === 'NEEDS_REVISION' && (
                  <DropdownMenuItem
                    onClick={onCreateRevision}
                    disabled={isRevisionPending}
                    className="font-semibold"
                  >
                    {isRevisionPending ? (
                      <Loader2 size={14} className="mr-2 animate-spin" />
                    ) : (
                      <Plus size={14} className="mr-2" />
                    )}
                    Create New Version
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </ButtonGroup>
        </div>
      </div>

      {/* Media Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4 py-4">
        {post.media_urls?.map((url, i) => (
          <div
            key={url}
            className="group relative aspect-square rounded-2xl overflow-hidden bg-muted cursor-pointer transition-all hover:scale-[1.02]"
            onClick={() => {
              setActiveIndex(i)
              setIsPreviewOpen(true)
            }}
          >
            <MediaItem
              url={url}
              className="transition group-hover:brightness-50"
            />
            {canEdit && (
              <button
                disabled={deleteMediaMutation.isPending}
                onClick={(e) => {
                  e.stopPropagation()
                  setMediaToDelete(url)
                }}
                className="absolute top-3 right-3 p-2 bg-destructive/90 text-white rounded-xl opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive shadow-lg z-10"
              >
                <Trash2 size={16} />
              </button>
            )}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 pointer-events-none">
              <Eye size={20} className="text-white" />
            </div>
          </div>
        ))}
      </div>

      <p className="text-base text-muted-foreground leading-relaxed max-w-4xl whitespace-pre-wrap">
        {post.content}
      </p>

      {/* Media Dialogs (Preview & Delete) stay the same ... */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-[90vw] lg:max-w-[1100px] h-[85vh] p-0 bg-transparent border-none flex items-center justify-center shadow-none">
          <div className="relative w-full h-full flex items-center justify-center rounded-3xl bg-black/95 border border-white/10 overflow-hidden shadow-2xl">
            {post.media_urls?.[activeIndex] && (
              <MediaItem
                url={post.media_urls[activeIndex]}
                className="object-contain"
                isPreview={true}
              />
            )}
            {post.media_urls?.length > 1 && (
              <>
                <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 flex justify-between pointer-events-none z-50">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handlePrev()
                    }}
                    className="pointer-events-auto p-4 rounded-2xl bg-black/40 text-white hover:bg-black/60 backdrop-blur-md transition-all"
                  >
                    <ChevronLeft className="h-8 w-8" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleNext()
                    }}
                    className="pointer-events-auto p-4 rounded-2xl bg-black/40 text-white hover:bg-black/60 backdrop-blur-md transition-all"
                  >
                    <ChevronRight className="h-8 w-8" />
                  </button>
                </div>
                <div className="absolute top-6 left-1/2 -translate-x-1/2">
                  <Badge className="bg-white/10 text-white border-none px-4 py-1.5 font-mono">
                    {activeIndex + 1} / {post.media_urls.length}
                  </Badge>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!mediaToDelete}
        onOpenChange={(o) => !o && setMediaToDelete(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle size={20} /> Delete Media Asset
            </DialogTitle>
            <DialogDescription>Permanently remove this file?</DialogDescription>
          </DialogHeader>
          <div className="aspect-video relative rounded-lg overflow-hidden border bg-muted my-2">
            {mediaToDelete && <MediaItem url={mediaToDelete} />}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setMediaToDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteMediaMutation.mutate(mediaToDelete)}
              disabled={deleteMediaMutation.isPending}
            >
              {deleteMediaMutation.isPending && (
                <Loader2 className="animate-spin mr-2 h-4 w-4" />
              )}{' '}
              Delete Asset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {(post.status === 'ARCHIVED' || post.status === 'NEEDS_REVISION') && (
        <div ref={notesRef} className="pt-4 scroll-mt-8">
          <ClientNotes
            notes={post.client_notes}
            clientName={post.posts?.clients?.name}
          />
        </div>
      )}

      <SocialMediaPreview
        isOpen={isSocialPreviewOpen}
        onOpenChange={setIsSocialPreviewOpen}
        post={post}
      />
    </div>
  )
}
