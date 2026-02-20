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
      <div
        className={cn(
          'relative bg-black flex items-center justify-center',
          'h-full w-full', // Always full height/width to contain the media properly
          className,
        )}
      >
        <video
          src={url}
          className={cn(
            'h-full w-full',
            isPreview ? 'object-contain' : 'object-cover', // scales huge while keeping aspect ratio
          )}
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
      className={cn(
        'h-full w-full',
        isPreview ? 'object-contain' : 'object-cover', // scales huge while keeping aspect ratio
        className,
      )}
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
    <div className="max-w-[1440px] mx-auto flex-1 p-8 space-y-6 min-w-0">
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
        <div className="flex items-center gap-3 shrink-0">
          {/* 1. PRIMARY ACTION (Stand-alone for maximum focus) */}
          <div className="hidden sm:block">
            {post.status === 'DRAFT' && (
              <Button
                disabled={!canSendForApproval || isApprovalPending}
                onClick={onSendForApproval}
                className="gap-2 px-6 font-semibold shadow-sm transition-all hover:translate-y-[-1px]"
              >
                {isApprovalPending ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={16} />
                )}
                Send for Approval
              </Button>
            )}

            {post.status === 'SCHEDULED' && (
              <Button
                disabled={isPublishPending}
                onClick={onPublish}
                className="gap-2 px-6 font-semibold shadow-sm transition-all hover:translate-y-[-1px]"
              >
                {isPublishPending ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Play size={16} />
                )}
                Publish Now
              </Button>
            )}

            {post.status === 'NEEDS_REVISION' && (
              <Button
                onClick={onCreateRevision}
                disabled={isRevisionPending}
                className="gap-2 px-6 font-semibold shadow-sm transition-all hover:translate-y-[-1px]"
              >
                {isRevisionPending ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Plus size={16} />
                )}
                Create New Version
              </Button>
            )}
          </div>

          {/* 2. SECONDARY ACTIONS (Grouped Dropdown) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="gap-2 px-4 border-zinc-200 dark:border-zinc-800"
              >
                <span className="hidden sm:inline">More Actions</span>
                <span className="sm:hidden">Actions</span>
                <ChevronDownIcon size={14} className="opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="sm:hidden">
                {post.status === 'DRAFT' && (
                  <DropdownMenuItem
                    onClick={onSendForApproval}
                    disabled={!canSendForApproval}
                  >
                    <CheckCircle2 size={14} className="mr-2" /> Send for
                    Approval
                  </DropdownMenuItem>
                )}
                {post.status === 'SCHEDULED' && (
                  <DropdownMenuItem onClick={onPublish}>
                    <Play size={14} className="mr-2" /> Publish Now
                  </DropdownMenuItem>
                )}
              </div>

              <DropdownMenuItem onClick={() => setIsSocialPreviewOpen(true)}>
                <Eye size={14} className="mr-2" /> Social Media Preview
              </DropdownMenuItem>

              {!showHistory && (
                <DropdownMenuItem onClick={() => setShowHistory(true)}>
                  <History size={14} className="mr-2" /> View Version History
                </DropdownMenuItem>
              )}

              {canEdit && (
                <DropdownMenuItem onClick={onEdit}>
                  <Pencil size={14} className="mr-2" /> Edit Details
                </DropdownMenuItem>
              )}

              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => {
                  /* Trigger Delete Dialog */
                }}
              >
                <Trash2 size={14} className="mr-2" /> Delete Post
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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

      {/* Media Dialogs (Preview & Delete) */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        {/* Added sm:max-w-[85vw] to override default shadcn max-width constraints */}
        <DialogContent className="max-w-[85] sm:max-w-[85vw] md:max-w-[85vw] w-[85vw] h-[85vh] p-0 bg-transparent border-none shadow-none focus:outline-none flex items-center justify-center">
          <div className="relative flex items-center justify-center rounded-2xl bg-black/95 overflow-hidden shadow-2xl border border-white/10 w-full h-full">
            {post.media_urls?.[activeIndex] && (
              <MediaItem
                key={post.media_urls[activeIndex]}
                url={post.media_urls[activeIndex]}
                isPreview={true}
              />
            )}

            {/* Navigation Overlay */}
            {post.media_urls?.length > 1 && (
              <>
                <div className="absolute inset-0 flex items-center justify-between pointer-events-none px-4 lg:px-12">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handlePrev()
                    }}
                    className="pointer-events-auto p-3 rounded-full bg-black/50 text-white hover:bg-black/70 backdrop-blur-sm transition-all hover:scale-110"
                  >
                    <ChevronLeft className="h-8 w-8" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleNext()
                    }}
                    className="pointer-events-auto p-3 rounded-full bg-black/50 text-white hover:bg-black/70 backdrop-blur-sm transition-all hover:scale-110"
                  >
                    <ChevronRight className="h-8 w-8" />
                  </button>
                </div>

                {/* Counter */}
                <div className="absolute top-8 right-8 pointer-events-none">
                  <Badge className="bg-black/50 text-white border-white/10 backdrop-blur-md px-4 py-2 text-sm font-mono">
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
        client={post.clients}
      />
    </div>
  )
}
