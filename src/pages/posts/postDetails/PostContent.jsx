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
  Play, // Added for video indicator
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { deleteIndividualMedia } from '@/api/posts'
import { useAuth } from '@/context/AuthContext'
import StatusBadge from '@/components/StatusBadge'
import PlatformBadge from '@/components/PlatformBadge'
import ClientNotes from './ClientNotes'
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
            <div className="bg-white/20 backdrop-blur-md p-2 rounded-full">
              <Play className="text-white h-5 w-5 fill-current" />
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
  const [activeIndex, setActiveIndex] = useState(0)
  const [mediaToDelete, setMediaToDelete] = useState(null)

  // Keyboard Navigation for Preview
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isPreviewOpen || (post.media_urls?.length ?? 0) <= 1) return
      if (e.key === 'ArrowLeft') handlePrev()
      if (e.key === 'ArrowRight') handleNext()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isPreviewOpen, post.media_urls])

  const handlePrev = () => {
    setActiveIndex((prev) =>
      prev === 0 ? post.media_urls.length - 1 : prev - 1,
    )
  }

  const handleNext = () => {
    setActiveIndex((prev) =>
      prev === post.media_urls.length - 1 ? 0 : prev + 1,
    )
  }

  const scrollToNotes = () => {
    notesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // --- Mutations ---
  const deleteMediaMutation = useMutation({
    mutationFn: (url) => deleteIndividualMedia(post.id, url, post.media_urls),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['post-version', post.id] })
      queryClient.invalidateQueries({ queryKey: ['subscription', user?.id] })
      toast.success('Media removed and storage updated')
      setMediaToDelete(null)
    },
    onError: (err) => toast.error('Failed to delete media: ' + err.message),
  })

  // --- Sub-Component: DATE STATUS ---
  const DateStatus = () => {
    const formatDate = (date) => format(new Date(date), 'dd MMM, p')

    if (post.status === 'PUBLISHED') {
      return (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {post.target_date && (
            <div className="flex items-center gap-2 opacity-80">
              <div className="h-3 w-[1px] bg-border hidden sm:block" />
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Clock size={13} />
                <span>Scheduled:</span>
              </div>
              <Badge
                variant="outline"
                className="text-muted-foreground border-dashed"
              >
                {formatDate(post.target_date)}
              </Badge>
            </div>
          )}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-sm font-medium">
              <CheckCircle2
                className="text-lime-800 dark:text-lime-400"
                size={14}
              />
              <span>Published on:</span>
            </div>
            <Badge variant="secondary">
              {formatDate(post.published_at || post.updated_at)}
            </Badge>
          </div>
        </div>
      )
    }

    const isScheduled = post.status === 'SCHEDULED'
    if (isScheduled || post.target_date) {
      return (
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-sm font-medium">
            {isScheduled ? (
              <Clock
                className="text-violet-800 dark:text-violet-400"
                size={14}
              />
            ) : (
              <CalendarIcon size={14} />
            )}
            <span className={!isScheduled ? 'text-muted-foreground' : ''}>
              {isScheduled ? 'Scheduled for:' : 'Target Date:'}
            </span>
          </div>
          <Badge
            variant={isScheduled ? 'secondary' : 'outline'}
            className={!isScheduled ? 'text-muted-foreground' : ''}
          >
            {formatDate(post.target_date)}
          </Badge>
        </div>
      )
    }
    return null
  }

  const canEdit = post.status === 'DRAFT' || post.status === 'PENDING_APPROVAL'
  const canSendForApproval =
    post.status === 'DRAFT' && post.content && post.media_urls?.length > 0

  return (
    <div className="flex-1 p-8 space-y-6 min-w-0">
      {/* Revision Alert */}
      {post.status === 'NEEDS_REVISION' && (
        <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-200 bg-amber-50/50 dark:bg-amber-500/5 dark:border-amber-500/20 max-w-2xl">
          <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
              Revision Required
            </p>
            <p className="text-sm text-amber-800/90 dark:text-amber-400/90 leading-relaxed">
              Please review the{' '}
              <button
                onClick={scrollToNotes}
                className="font-semibold underline"
              >
                client feedback below
              </button>
              , implement changes, and create a new version.
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start gap-6">
        <div className="space-y-6 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge status={post.status} />
            <div className="flex flex-wrap gap-2">
              {Array.isArray(post.platform) ? (
                post.platform.map((p) => <PlatformBadge key={p} platform={p} />)
              ) : (
                <PlatformBadge platform={post.platform} />
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex flex-row items-center gap-3">
              <h1 className="text-4xl font-semibold tracking-tight text-foreground">
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
              {(post.target_date || post.status === 'PUBLISHED') && (
                <div className="h-4 w-[1px] bg-border hidden sm:block" />
              )}
              <DateStatus />
            </div>
          </div>

          {post.admin_notes && (
            <div className="flex gap-3 py-3 max-w-2xl border-l-2 border-blue-200 dark:border-blue-900/50 pl-3">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <MessageSquareText size={13} strokeWidth={2.5} />
                  <span className="text-sm font-semibold">Internal Plan</span>
                </div>
                <p className="text-sm text-foreground/70 leading-relaxed italic">
                  "{post.admin_notes}"
                </p>
              </div>
            </div>
          )}
          <p className="text-sm text-muted-foreground leading-relaxed max-w-3xl whitespace-pre-wrap">
            {post.content}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto shrink-0">
          {canEdit && (
            <Button
              variant="outline"
              onClick={onEdit}
              className="w-full sm:w-auto border-dashed"
            >
              <Pencil className="mr-2 h-4 w-4" /> Edit
            </Button>
          )}
          {!showHistory && (
            <Button
              variant="outline"
              onClick={() => setShowHistory(true)}
              className="w-full sm:w-auto"
            >
              <History className="mr-2 h-4 w-4" /> History
            </Button>
          )}
          {post.status === 'DRAFT' && (
            <Button
              className="w-full sm:w-auto"
              disabled={!canSendForApproval || isApprovalPending}
              onClick={onSendForApproval}
            >
              {isApprovalPending ? 'Sending...' : 'Send for Approval'}
            </Button>
          )}
          {post.status === 'SCHEDULED' && (
            <Button
              className="w-full sm:w-auto"
              disabled={isPublishPending}
              onClick={onPublish}
            >
              {isPublishPending && (
                <Loader2 className="animate-spin mr-2 h-4 w-4" />
              )}{' '}
              Publish
            </Button>
          )}
          {post.status === 'NEEDS_REVISION' && (
            <Button
              className="w-full sm:w-auto"
              onClick={onCreateRevision}
              disabled={isRevisionPending}
            >
              {isRevisionPending ? (
                <Loader2 className="animate-spin mr-2" />
              ) : (
                <Plus className="mr-2" />
              )}{' '}
              New Version
            </Button>
          )}
        </div>
      </div>

      {/* Media Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 xl:grid-cols-5 gap-4 pt-4">
        {post.media_urls?.map((url, i) => (
          <div
            key={i}
            className="group relative aspect-square rounded-2xl overflow-hidden bg-muted cursor-pointer transition-transform hover:scale-[1.02]"
            onClick={() => {
              setActiveIndex(i)
              setIsPreviewOpen(true)
            }}
          >
            {/* Updated to use MediaItem */}
            <MediaItem
              url={url}
              className="transition duration-300 group-hover:brightness-50"
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

      {/* Media Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-[90vw] lg:max-w-[1100px] h-[85vh] p-0 bg-transparent border-none flex items-center justify-center overflow-visible shadow-none">
          <div className="relative w-full h-full flex items-center justify-center rounded-3xl bg-black/95 border border-white/10 overflow-hidden shadow-2xl">
            {/* Updated Preview logic */}
            {post.media_urls && (
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
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2 p-2 bg-black/20 rounded-full z-50">
                  {post.media_urls.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActiveIndex(idx)}
                      className={`h-2 rounded-full transition-all ${idx === activeIndex ? 'bg-white w-8' : 'bg-white/30 w-2'}`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!mediaToDelete}
        onOpenChange={(open) => !open && setMediaToDelete(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle size={20} /> Delete Media Asset
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to remove this asset? This action will
              permanently delete the file from storage and cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="aspect-video relative rounded-lg overflow-hidden border bg-muted my-2">
            {/* Updated Delete Preview */}
            <MediaItem url={mediaToDelete} />
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
              {deleteMediaMutation.isPending ? (
                <Loader2 className="animate-spin mr-2 h-4 w-4" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
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
    </div>
  )
}
