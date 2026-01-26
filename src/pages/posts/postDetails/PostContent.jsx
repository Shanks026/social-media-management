import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { format } from 'date-fns'
import StatusBadge from '@/components/StatusBadge'
import PlatformBadge from '@/components/PlatformBadge'
import { Badge } from '@/components/ui/badge'
import {
  History,
  Check,
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
  Globe,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import ClientNotes from './ClientNotes'

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

  // Preview States
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)

  // Keyboard Navigation for Dialog
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isPreviewOpen || post.media_urls?.length <= 1) return
      if (e.key === 'ArrowLeft') handlePrev()
      if (e.key === 'ArrowRight') handleNext()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isPreviewOpen, activeIndex, post.media_urls])

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

  const openPreview = (index) => {
    setActiveIndex(index)
    setIsPreviewOpen(true)
  }

  const scrollToNotes = () => {
    notesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const getScheduleLabel = (status) => {
    if (status === 'PUBLISHED') return 'Published on'
    if (status === 'SCHEDULED') return 'Confirmed Scheduled Date'
    return 'Expected scheduled date'
  }

  const canSendForApproval =
    post.status === 'DRAFT' && post.content && post.media_urls?.length > 0
  const showNotes =
    post.status === 'ARCHIVED' || post.status === 'NEEDS_REVISION'
  const canEdit = post.status === 'DRAFT' || post.status === 'PENDING_APPROVAL'
  const canPublish = post.status === 'SCHEDULED'

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
                className="font-semibold underline decoration-amber-500/50 hover:decoration-amber-600"
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

          <div className="space-y-3">
            <div className="flex flex-row items-center gap-2">
              <h1 className="text-4xl font-semibold tracking-tight text-foreground">
                {post.title}
              </h1>
              <Badge variant="secondary" className="rounded-md text-sm">
                v{post.version_number}.0
              </Badge>
            </div>

            <div className="flex flex-wrap items-center gap-y-2 gap-x-4 py-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CalendarIcon size={14} />
                <span>
                  Created On {format(new Date(post.created_at), 'dd MMM, yyyy')}
                </span>
              </div>
              {post.target_date && (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-[1px] bg-border hidden sm:block" />
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-primary">
                    {post.status === 'PUBLISHED' ? (
                      <Check size={14} className="text-green-500" />
                    ) : (
                      <Clock size={14} />
                    )}
                    <span className="text-sm font-medium text-primary/80">
                      {getScheduleLabel(post.status)}:
                    </span>
                  </div>
                  <Badge variant="secondary" className="font-medium rounded-sm">
                    {format(new Date(post.target_date), 'dd MMM, yyyy @ p')}
                  </Badge>
                </div>
              )}
            </div>
          </div>

          {/* Minimal Admin Notes */}
          {post.admin_notes && (
            <div className="flex gap-3 py-3 max-w-2xl">
              <div className="w-0.5 bg-blue-200 dark:bg-blue-900/50 rounded-full shrink-0" />
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <MessageSquareText size={13} strokeWidth={2.5} />
                  <span className="text-sm font-semibold text-muted-foreground">
                    Internal Plan
                  </span>
                </div>
                <p className="text-sm text-foreground/70 leading-relaxed italic">
                  "{post.admin_notes}"
                </p>
              </div>
            </div>
          )}

          <p className="text-sm text-muted-foreground leading-relaxed max-w-3xl">
            {post.content}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto shrink-0">
          {canEdit && (
            <Button
              variant="outline"
              onClick={onEdit}
              className="w-full sm:w-auto border-dashed"
            >
              <Pencil className="mr-2 h-4 w-4" /> Edit Details
            </Button>
          )}
          {!showHistory && (
            <Button
              variant="outline"
              onClick={() => setShowHistory(true)}
              className="w-full sm:w-auto"
            >
              <History className="mr-2 h-4 w-4" /> Version History
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

          {canPublish && (
            <Button
              className="w-full sm:w-auto"
              disabled={isPublishPending}
              onClick={onPublish}
            >
              {isPublishPending ? (
                <Loader2 className="animate-spin mr-2 h-4 w-4" />
              ) : (
                <Globe className="h-4 w-4" />
              )}
              Mark as Published
            </Button>
          )}

          {/* ACTION BUTTONS SECTION */}
          {post.status === 'NEEDS_REVISION' && (
            <Button
              className="w-full sm:w-auto shadow-lg shadow-primary/10"
              onClick={onCreateRevision}
              disabled={isRevisionPending}
            >
              {isRevisionPending ? (
                <Loader2 className="animate-spin mr-2" />
              ) : (
                <Plus className="mr-2" />
              )}
              {/* Ensure this pulls from the version number of the post currently on screen */}
              Create New Version (v{Number(post.version_number) + 1}.0)
            </Button>
          )}
        </div>
      </div>

      {/* Media Grid with Preview Trigger */}
      <div className="grid grid-cols-1 sm:grid-cols-3 xl:grid-cols-5 gap-4 pt-4">
        {post.media_urls?.map((url, i) => (
          <div
            key={i}
            onClick={() => openPreview(i)}
            className="group relative aspect-square rounded-2xl overflow-hidden bg-muted cursor-pointer transition-transform hover:scale-[1.02]"
          >
            <img
              src={url}
              alt=""
              className="w-full h-full object-cover transition duration-300 group-hover:brightness-50"
            />
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <div className="p-3 bg-white/20 backdrop-blur-md rounded-full border border-white/30 text-white">
                <Eye size={20} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Media Preview Dialog (Listing Page Approach) */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-[90vw] lg:max-w-[1100px] h-[85vh] p-0 bg-transparent border-none shadow-none flex flex-col items-center justify-center overflow-visible">
          <div className="relative w-full h-full flex items-center justify-center">
            <div className="relative w-full h-full overflow-hidden rounded-3xl bg-black/95 shadow-2xl flex items-center justify-center border border-white/10">
              <img
                src={post.media_urls?.[activeIndex]}
                alt="Preview"
                className="w-full h-full object-contain"
              />

              {post.media_urls?.length > 1 && (
                <>
                  <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 flex justify-between items-center pointer-events-none">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handlePrev()
                      }}
                      className="pointer-events-auto p-4 rounded-2xl bg-black/40 text-white hover:bg-black/60 backdrop-blur-xl transition-all"
                    >
                      <ChevronLeft className="h-8 w-8" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleNext()
                      }}
                      className="pointer-events-auto p-4 rounded-2xl bg-black/40 text-white hover:bg-black/60 backdrop-blur-xl transition-all"
                    >
                      <ChevronRight className="h-8 w-8" />
                    </button>
                  </div>

                  {/* Image Counter */}
                  <div className="absolute top-6 left-1/2 -translate-x-1/2">
                    <Badge className="bg-white/10 text-white border-none backdrop-blur-md px-4 py-1.5 font-medium">
                      {activeIndex + 1} / {post.media_urls.length}
                    </Badge>
                  </div>

                  {/* Dot Indicators */}
                  <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2 p-2 bg-black/20 backdrop-blur-md rounded-full">
                    {post.media_urls.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setActiveIndex(idx)}
                        className={`h-2 rounded-full transition-all duration-300 ${idx === activeIndex ? 'bg-white w-8' : 'bg-white/30 w-2'}`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Client Feedback Section */}
      {showNotes && (
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
