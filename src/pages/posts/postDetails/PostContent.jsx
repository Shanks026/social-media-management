import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { format, formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'
import {
  Loader2,
  Clock,
  Calendar as CalendarIcon,
  Plus,
  Pencil,
  AlertCircle,
  FileText,
  ChevronLeft,
  ChevronRight,
  Eye,
  CheckCircle2,
  Trash2,
  History,
  MessageSquare,
  Play,
  ChevronDownIcon,
  RefreshCw,
  Send,
  PackageCheck,
  SendHorizonal,
  ShieldCheck,
  MessageSquareWarning,
  RotateCcw,
} from 'lucide-react'

// UI Components
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

// Custom Components & API
import { deleteIndividualMedia } from '@/api/posts'
import { useTeamMembers } from '@/api/team'
import { useAuth } from '@/context/AuthContext'
import { getPublishState, renderCaption, isDocumentUrl, getDocumentExtension, getDocumentPreviewUrl } from '@/lib/helper'
import { DELETABLE_POST_STATUSES } from '@/lib/post-statuses'
import StatusBadge from '@/components/StatusBadge'
import ClientNotes from './ClientNotes'
import { cn } from '@/lib/utils'
import SocialMediaPreview from '../socialMediaPreview/SocialMediaPreview'
import PostLinkedTasks from '@/components/tasks/PostLinkedTasks'

/**
 * Utility: Media Type Check
 */
function AuthorChip({ member }) {
  if (!member) return null
  const initials = member.full_name
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) ?? '?'
  return (
    <span className="inline-flex items-center gap-1.5">
      <Avatar className="size-4">
        <AvatarImage src={member.avatar_url} />
        <AvatarFallback className="text-[9px]">{initials}</AvatarFallback>
      </Avatar>
      <span className="font-medium text-foreground">{member.full_name}</span>
    </span>
  )
}

/**
 * One stacked label/value row of the meta list under the deliverable title.
 */
function MetaItem({ label, children }) {
  return (
    <div className="grid grid-cols-[96px_1fr] items-start gap-x-3">
      <dt className="pt-px text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-sm text-foreground">{children}</dd>
    </div>
  )
}

/**
 * Minimal status/feedback note — a plain left-border quote (accent color
 * only, no background fill or colored body text). Used in place of the old
 * filled alert boxes; `accent` keeps each status's color on the border only.
 */
function StatusNote({ title, children, className, accent = 'border-border' }) {
  return (
    <div className={cn('max-w-2xl space-y-1 border-l-4 pl-4', accent, className)}>
      <p className="text-sm font-medium text-foreground">{title}</p>
      <div className="text-sm text-muted-foreground leading-relaxed">{children}</div>
    </div>
  )
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

const PLATFORM_LABELS = {
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  facebook: 'Facebook',
  google_business: 'Google Business',
  youtube: 'YouTube',
  twitter: 'Twitter/X',
}

// Same palette the create-deliverable dialog uses for a selected platform, so
// a platform reads identically wherever it appears.
const PLATFORM_BADGE_CLASS = {
  instagram:
    'border-pink-400 bg-pink-50 text-pink-700 dark:border-pink-500/50 dark:bg-pink-500/15 dark:text-pink-300',
  linkedin:
    'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-500/50 dark:bg-blue-600/15 dark:text-blue-300',
  facebook:
    'border-sky-500 bg-sky-50 text-sky-700 dark:border-sky-500/50 dark:bg-sky-500/15 dark:text-sky-300',
  google_business:
    'border-amber-400 bg-amber-50 text-amber-700 dark:border-amber-500/50 dark:bg-amber-500/15 dark:text-amber-300',
  youtube:
    'border-red-500 bg-red-50 text-red-700 dark:border-red-500/50 dark:bg-red-600/15 dark:text-red-300',
  twitter:
    'border-slate-700 bg-slate-100 text-slate-900 dark:border-slate-400/50 dark:bg-slate-500/15 dark:text-slate-200',
}

/**
 * Platform pill — icon + label, mirroring the create-deliverable dialog.
 */
function PlatformBadge({ name }) {
  const fileName = name === 'google_business' ? 'google_busines' : name
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs',
        PLATFORM_BADGE_CLASS[name] ?? 'text-muted-foreground',
      )}
    >
      <img
        src={`/platformIcons/${fileName}.png`}
        alt=""
        className="size-3.5 shrink-0 object-contain"
        onError={(e) => (e.target.style.display = 'none')}
      />
      {PLATFORM_LABELS[name] ?? name}
    </span>
  )
}

const PlatformIcon = ({ name, size = 'md' }) => {
  const fileName = name === 'google_business' ? 'google_busines' : name
  const sizeClass = size === 'sm' ? 'size-5' : 'size-6'
  const containerClass = size === 'sm'
    ? 'flex h-6 w-6 items-center justify-center rounded-full border border-border bg-white dark:bg-zinc-900 shadow-sm overflow-hidden shrink-0'
    : 'flex h-8 w-8 items-center justify-center rounded-full border border-border bg-white dark:bg-zinc-900 shadow-sm overflow-hidden shrink-0'
  return (
    <div className={containerClass}>
      <img
        src={`/platformIcons/${fileName}.png`}
        alt={name}
        className={cn(sizeClass, 'object-contain')}
        onError={(e) => (e.target.style.display = 'none')}
      />
    </div>
  )
}

/**
 * Shared Media Component
 */
const MediaItem = ({ url, className, isPreview = false }) => {
  const isVideo = isVideoSource(url)
  const isDoc = isDocumentUrl(url)

  if (isDoc) {
    if (isPreview) {
      const previewUrl = getDocumentPreviewUrl(url)
      if (previewUrl) {
        return <iframe src={previewUrl} title="Document preview" className="w-full h-full border-0" />
      }
      return (
        <div className="flex flex-col items-center justify-center h-full gap-3 text-white/70">
          <FileText className="size-12 opacity-40" />
          <p className="text-sm opacity-60">Preview not available</p>
          <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs underline opacity-70 hover:opacity-100">
            Open file
          </a>
        </div>
      )
    }
    const ext = getDocumentExtension(url)
    return (
      <div className={cn('h-full w-full flex flex-col items-center justify-center gap-1.5 bg-muted/60 p-2', className)}>
        <FileText className="h-7 w-7 text-muted-foreground shrink-0" />
        <p className="text-[10px] font-medium text-muted-foreground uppercase">{ext}</p>
      </div>
    )
  }

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
        isPreview ? 'object-contain' : 'object-cover',
        className,
      )}
    />
  )
}

export default function PostContent({
  post,
  isInternal,
  canSendDeliverables,
  showMeta,
  showHistory,
  setShowHistory,
  showComments,
  onToggleComments,
  onSendForApproval,
  onApproveAndSchedule,
  onPublish,
  onPublishPlatform,
  onCreateRevision,
  isRevisionPending,
  isApprovalPending,
  isPublishPending,
  publishingPlatformId,
  isApproveSchedulePending,
  onEdit,
  onDelete,
  onResendLink,
  isResendingLink,
  onRefresh,
  onMarkDelivered,
  isMarkDeliveredPending,
  // Phase 5: internal approval loop
  onSubmitForApproval,
  isSubmitPending,
  onApproveInternally,
  isApproveInternallyPending,
  onRequestChanges,
}) {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const { data: members = [] } = useTeamMembers()
  const creator = members.find(m => m.member_user_id === post.created_by)
  const submitter = post.submitted_by ? members.find(m => m.member_user_id === post.submitted_by) : null
  const updater = post.updated_by ? members.find(m => m.member_user_id === post.updated_by) : null
  // States
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [isSocialPreviewOpen, setIsSocialPreviewOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [mediaToDelete, setMediaToDelete] = useState(null)

  const isSocialPost = (post.platforms?.length ?? 0) > 0
  // Owner/admin can edit more states; members can also edit CHANGES_REQUESTED (same version)
  const canEdit = canSendDeliverables
    ? ['DRAFT', 'PENDING_APPROVAL', 'SUBMITTED', 'CHANGES_REQUESTED', 'READY'].includes(post.status)
    : ['DRAFT', 'CHANGES_REQUESTED'].includes(post.status)
  // Delete authorization mirrors the posts RLS DELETE policy so the button never
  // offers an action RLS would reject: owner/admin (canSendDeliverables) can
  // delete in any status; a member can delete only their own deliverable and
  // only before a commitment (DRAFT/SUBMITTED/ARCHIVED).
  const isDeliverableCreator =
    !!post.deliverable_creator_id && post.deliverable_creator_id === user?.id
  const canDelete =
    canSendDeliverables ||
    (isDeliverableCreator && DELETABLE_POST_STATUSES.includes(post.status))
  // Owner/admin send to client from DRAFT (bypass) or READY (post-internal-approval)
  const canSendForApproval = ['DRAFT', 'READY'].includes(post.status) && !!post.content && canSendDeliverables
  // Owner/admin approve & schedule from DRAFT (bypass) or READY (post-internal-approval)
  const canApproveAndSchedule = ['DRAFT', 'READY'].includes(post.status) && !!post.content && canSendDeliverables

  const handlePrev = useCallback(() => {
    setActiveIndex((p) => (p === 0 ? post.media_urls.length - 1 : p - 1))
  }, [post.media_urls])
  const handleNext = useCallback(() => {
    setActiveIndex((p) => (p === post.media_urls.length - 1 ? 0 : p + 1))
  }, [post.media_urls])

  // Keyboard Navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isPreviewOpen || (post.media_urls?.length ?? 0) <= 1) return
      if (e.key === 'ArrowLeft') handlePrev()
      if (e.key === 'ArrowRight') handleNext()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isPreviewOpen, post.media_urls, handlePrev, handleNext])

  const deleteMediaMutation = useMutation({
    mutationFn: (url) => deleteIndividualMedia(post.id, url, post.media_urls),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['post-version', post.id] })
      toast.success('Media removed')
      setMediaToDelete(null)
    },
  })

  const formatDate = (date) => (date ? format(new Date(date), 'dd MMM, p') : '')

  // The single date worth surfacing in the meta grid. Skipped entirely when
  // per-platform schedules exist — the Publish Plan grid lists them all.
  const dateCell = (() => {
    if (post.status === 'PUBLISHED')
      return {
        label: 'Published',
        icon: <CheckCircle2 size={13} className="shrink-0 text-emerald-600" />,
        value: post.published_at || post.updated_at,
      }
    if (post.platform_schedules || !post.target_date) return null
    if (post.status === 'SCHEDULED')
      return {
        label: 'Scheduled for',
        icon: <Clock size={13} className="shrink-0 text-violet-600" />,
        value: post.target_date,
      }
    if (post.status === 'APPROVED')
      return {
        label: 'Deadline',
        icon: <CalendarIcon size={13} className="shrink-0 text-teal-600" />,
        value: post.target_date,
      }
    return {
      label: 'Target date',
      icon: <CalendarIcon size={13} className="shrink-0 text-muted-foreground" />,
      value: post.target_date,
    }
  })()

  return (
    <div className="max-w-[1400px] mx-auto flex-1 p-8 space-y-6 min-w-0">
      {/* Main Header */}
      <div className="flex flex-col md:flex-row justify-between items-start gap-6">
        <div className="min-w-0 flex-1 space-y-4">
          <StatusBadge status={getPublishState(post)} />

          <div className="flex flex-row items-center gap-3">
            <h1 className="text-4xl font-semibold tracking-tight bricolage">
              {post.title}
            </h1>
            <Badge variant="secondary" className="h-6 text-xs font-medium">
              v{post.version_number}.0
            </Badge>
          </div>
        </div>

        {/* 🛠️ Consolidated Button Group */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Resend Link + Refresh — PENDING_APPROVAL only */}
          {post.status === 'PENDING_APPROVAL' && (
            <>
              <Button
                size="sm"
                onClick={onResendLink}
                disabled={isResendingLink}
                className="gap-1.5"
                title="Resend approval link to client"
              >
                <Send size={13} className={isResendingLink ? 'animate-pulse' : ''} />
                {isResendingLink ? 'Resending...' : 'Resend Link'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onRefresh}
                className="gap-1.5 text-muted-foreground hover:text-foreground"
                title="Refresh Status"
              >
                <RefreshCw size={13} />
              </Button>
            </>
          )}

          {/* Phase 5: MEMBER + DRAFT → Submit for Internal Approval (own posts only) */}
          {post.status === 'DRAFT' && !canSendDeliverables && post.created_by === user?.id && (
            <Button
              size="sm"
              disabled={!post.content || isSubmitPending}
              onClick={onSubmitForApproval}
              className="hidden sm:inline-flex gap-1.5 font-semibold"
            >
              {isSubmitPending ? <Loader2 size={13} className="animate-spin" /> : <SendHorizonal size={13} />}
              Submit for Approval
            </Button>
          )}

          {/* Phase 5: MEMBER + CHANGES_REQUESTED → Resubmit (own posts only) */}
          {post.status === 'CHANGES_REQUESTED' && !canSendDeliverables && post.created_by === user?.id && (
            <Button
              size="sm"
              disabled={!post.content || isSubmitPending}
              onClick={onSubmitForApproval}
              className="hidden sm:inline-flex gap-1.5 font-semibold"
            >
              {isSubmitPending ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
              Resubmit
            </Button>
          )}

          {/* Phase 5: OWNER/ADMIN + SUBMITTED → Approve or Request Changes */}
          {post.status === 'SUBMITTED' && canSendDeliverables && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={onRequestChanges}
                className="hidden sm:inline-flex gap-1.5"
              >
                <MessageSquareWarning size={13} />
                Request Changes
              </Button>
              <Button
                size="sm"
                disabled={isApproveInternallyPending}
                onClick={onApproveInternally}
                className="hidden sm:inline-flex gap-1.5 font-semibold"
              >
                {isApproveInternallyPending ? <Loader2 size={13} className="animate-spin" /> : <ShieldCheck size={13} />}
                Approve
              </Button>
            </>
          )}

          {/* OWNER/ADMIN: DRAFT (bypass) or READY (post-internal) → Approve & Schedule / Send for Approval */}
          {(post.status === 'DRAFT' || post.status === 'READY') && canSendDeliverables &&
            (isInternal ? (
              <Button
                size="sm"
                disabled={!canApproveAndSchedule || isApproveSchedulePending}
                onClick={onApproveAndSchedule}
                className="hidden sm:inline-flex gap-1.5 font-semibold"
              >
                {isApproveSchedulePending ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={13} />
                )}
                {isSocialPost ? 'Approve & Schedule' : 'Approve'}
              </Button>
            ) : (
              <Button
                size="sm"
                disabled={!canSendForApproval || isApprovalPending}
                onClick={onSendForApproval}
                className="hidden sm:inline-flex gap-1.5 font-semibold"
              >
                {isApprovalPending ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={13} />
                )}
                Send for Approval
              </Button>
            ))}

          {/* SCHEDULED — Publish Now */}
          {post.status === 'SCHEDULED' && !post.platform_schedules && isSocialPost && (
            <Button
              size="sm"
              disabled={isPublishPending}
              onClick={onPublish}
              className="hidden sm:inline-flex gap-1.5 font-semibold"
            >
              {isPublishPending ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Play size={13} />
              )}
              Publish Now
            </Button>
          )}

          {/* NEEDS_REVISION — external only */}
          {post.status === 'NEEDS_REVISION' && (
            <Button
              size="sm"
              onClick={onCreateRevision}
              disabled={isRevisionPending}
              className="hidden sm:inline-flex gap-1.5 font-semibold"
            >
              {isRevisionPending ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Plus size={13} />
              )}
              Create New Version
            </Button>
          )}

          {/* APPROVED — Mark as Delivered */}
          {post.status === 'APPROVED' && (
            <Button
              size="sm"
              onClick={onMarkDelivered}
              disabled={isMarkDeliveredPending}
              className="hidden sm:inline-flex gap-1.5 font-semibold"
            >
              {isMarkDeliveredPending ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <PackageCheck size={13} />
              )}
              Mark as Delivered
            </Button>
          )}

          {/* Comments */}
          <Button
            variant="outline"
            size="sm"
            className={cn('gap-1.5', showComments && 'bg-accent')}
            onClick={onToggleComments}
            aria-label="Comments"
            title="Comments"
          >
            <MessageSquare size={14} />
            <span className="hidden sm:inline">Comments</span>
          </Button>

          {/* More Actions dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
              >
                <span className="hidden sm:inline">More Actions</span>
                <span className="sm:hidden">Actions</span>
                <ChevronDownIcon size={13} className="opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="sm:hidden">
                {/* Member: DRAFT → Submit (own posts only) */}
                {post.status === 'DRAFT' && !canSendDeliverables && post.created_by === user?.id && (
                  <DropdownMenuItem onClick={onSubmitForApproval} disabled={!post.content || isSubmitPending}>
                    <SendHorizonal size={14} className="mr-2" /> Submit for Approval
                  </DropdownMenuItem>
                )}
                {/* Member: CHANGES_REQUESTED → Resubmit (own posts only) */}
                {post.status === 'CHANGES_REQUESTED' && !canSendDeliverables && post.created_by === user?.id && (
                  <DropdownMenuItem onClick={onSubmitForApproval} disabled={!post.content || isSubmitPending}>
                    <RotateCcw size={14} className="mr-2" /> Resubmit
                  </DropdownMenuItem>
                )}
                {/* Owner/Admin: SUBMITTED → Approve or Request Changes */}
                {post.status === 'SUBMITTED' && canSendDeliverables && (
                  <>
                    <DropdownMenuItem onClick={onApproveInternally} disabled={isApproveInternallyPending}>
                      <ShieldCheck size={14} className="mr-2" /> Approve
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={onRequestChanges}>
                      <MessageSquareWarning size={14} className="mr-2" /> Request Changes
                    </DropdownMenuItem>
                  </>
                )}
                {/* Owner/Admin: DRAFT or READY */}
                {(post.status === 'DRAFT' || post.status === 'READY') && canSendDeliverables &&
                  (isInternal ? (
                    <DropdownMenuItem onClick={onApproveAndSchedule} disabled={!canApproveAndSchedule}>
                      <CheckCircle2 size={14} className="mr-2" />
                      {isSocialPost ? 'Approve & Schedule' : 'Approve'}
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem onClick={onSendForApproval} disabled={!canSendForApproval}>
                      <CheckCircle2 size={14} className="mr-2" /> Send for Approval
                    </DropdownMenuItem>
                  ))}
                {post.status === 'SCHEDULED' && !post.platform_schedules && isSocialPost && (
                  <DropdownMenuItem onClick={onPublish}>
                    <Play size={14} className="mr-2" /> Publish Now
                  </DropdownMenuItem>
                )}
                {post.status === 'APPROVED' && (
                  <DropdownMenuItem onClick={onMarkDelivered} disabled={isMarkDeliveredPending}>
                    <PackageCheck size={14} className="mr-2" /> Mark as Delivered
                  </DropdownMenuItem>
                )}
              </div>

              {isSocialPost && (
                <DropdownMenuItem onClick={() => setIsSocialPreviewOpen(true)}>
                  <Eye size={14} className="mr-2" /> Social Media Preview
                </DropdownMenuItem>
              )}

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
                disabled={!canDelete}
                className="text-destructive focus:text-destructive"
                onClick={onDelete}
              >
                <Trash2 size={14} className="mr-2" /> Delete Post
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Body split: media + caption on the left, key/value meta on the right */}
      <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
        <div className={cn('min-w-0 space-y-6', showMeta ? 'lg:w-2/3' : 'lg:w-full')}>
          {/* Per-platform schedule grid — stays in the main column because it
              carries the per-platform Publish buttons. */}
          {post.platform_schedules && post.status !== 'PUBLISHED' && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Publish Plan
              </p>
              {Object.entries(post.platform_schedules).map(
                ([platformId, { scheduled_at, published_at }]) => (
                  <div key={platformId} className="flex items-center gap-3 py-1">
                    <PlatformIcon name={platformId} size="sm" />
                    <span className="text-sm font-medium w-[110px] shrink-0">
                      {PLATFORM_LABELS[platformId] ?? platformId}
                    </span>
                    <span className="text-sm text-muted-foreground flex-1">
                      {format(new Date(scheduled_at), 'dd MMM yyyy, p')}
                    </span>
                    {published_at ? (
                      <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                    ) : post.status === 'SCHEDULED' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-3 text-xs gap-1 shrink-0"
                        disabled={!!publishingPlatformId}
                        onClick={() => onPublishPlatform?.(platformId)}
                      >
                        {publishingPlatformId === platformId ? (
                          <Loader2 size={11} className="animate-spin" />
                        ) : (
                          <Play size={11} />
                        )}
                        Publish
                      </Button>
                    ) : null}
                  </div>
                ),
              )}
            </div>
          )}

          {/* Phase 5: SUBMITTED — member perspective */}
          {post.status === 'SUBMITTED' && !canSendDeliverables && (
            <StatusNote title="Awaiting Internal Review" accent="border-amber-500">
              This deliverable has been submitted and is waiting for an owner or admin to review it.
            </StatusNote>
          )}

          {/* Phase 5: CHANGES_REQUESTED — member sees internal feedback */}
          {post.status === 'CHANGES_REQUESTED' && (
            <StatusNote title="Changes Requested" accent="border-rose-500">
              {post.admin_notes || 'Edit this deliverable and resubmit when ready.'}
            </StatusNote>
          )}

          {/* Phase 5: READY — owner/admin can now send to client */}
          {post.status === 'READY' && canSendDeliverables && (
            <StatusNote title="Internally Approved" accent="border-violet-500">
              This deliverable has passed internal review. You can now send it to the client or schedule it.
            </StatusNote>
          )}

          {/* Client feedback — shown inline instead of a separate alert */}
          {post.status === 'NEEDS_REVISION' && (
            <StatusNote
              title={`Feedback from ${post.posts?.clients?.name || 'the client'}`}
              accent="border-pink-500"
            >
              <span className="italic">
                {post.client_notes ? `“${post.client_notes}”` : 'No feedback notes were provided for this revision request.'}
              </span>
              {post.updated_at && (
                <span className="block mt-1 text-xs text-muted-foreground/70 not-italic">
                  {formatDistanceToNow(new Date(post.updated_at), { addSuffix: true })}
                </span>
              )}
            </StatusNote>
          )}

          {post.status === 'DELIVERED' && (
            <StatusNote title="Delivered" accent="border-teal-500">
              This deliverable has been marked as delivered and is now complete.
              {post.admin_notes && (
                <span> Note: <em>{post.admin_notes}</em></span>
              )}
            </StatusNote>
          )}

          {/* Media Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
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

          <p className="text-base text-foreground leading-relaxed whitespace-pre-wrap">
            {renderCaption(post.content)}
          </p>

          <PostLinkedTasks postId={post.actual_post_id} />
        </div>

        {/* Meta column — the deliverable's key facts as label/value rows. The
            date row is omitted when per-platform schedules exist; those are
            listed in full by the Publish Plan grid on the left. Yields the
            space whenever a page-level right panel (version history or
            comments) is open. */}
        {showMeta && (
          <aside className="w-full min-w-0 lg:sticky lg:top-20 lg:w-1/3">
          <h2 className="mb-4 text-xs font-medium text-muted-foreground">
            Meta Details
          </h2>

          <dl className="space-y-3.5">
            <MetaItem label="Created on">
              {format(new Date(post.created_at), 'dd MMM, yyyy')}
            </MetaItem>

            {creator && (
              <MetaItem label="Created by">
                <AuthorChip member={creator} />
              </MetaItem>
            )}

            {post.clients?.name && (
              <MetaItem label="Created for">
                <span className="inline-flex items-center gap-1.5">
                  <Avatar className="size-4 rounded-sm">
                    <AvatarImage src={post.clients.logo_url} />
                    <AvatarFallback className="rounded-sm text-[9px]">
                      {post.clients.name[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="truncate font-medium">{post.clients.name}</span>
                </span>
              </MetaItem>
            )}

            {dateCell && (
              <MetaItem label={dateCell.label}>
                <span className="inline-flex items-center gap-1.5">
                  {dateCell.icon}
                  {formatDate(dateCell.value)}
                </span>
              </MetaItem>
            )}

            {post.campaign?.name && (
              <MetaItem label="Campaign">
                <Link
                  to={`/campaigns/${post.campaign.id}`}
                  className="font-medium hover:underline"
                >
                  {post.campaign.name}
                </Link>
              </MetaItem>
            )}

            {post.platforms?.length > 0 && (
              <MetaItem label="Platforms">
                <div className="flex flex-wrap items-center gap-1.5">
                  {[].concat(post.platforms).map((p) => (
                    <PlatformBadge key={p} name={p} />
                  ))}
                </div>
              </MetaItem>
            )}

            {updater && post.updated_at !== post.created_at && (
              <MetaItem label="Updated">
                <span title={format(new Date(post.updated_at), 'dd MMM yyyy, HH:mm')}>
                  {formatDistanceToNow(new Date(post.updated_at), { addSuffix: true })}
                </span>
                <div className="mt-1">
                  <AuthorChip member={updater} />
                </div>
              </MetaItem>
            )}

            {submitter && (
              <MetaItem label="Submitted by">
                <AuthorChip member={submitter} />
              </MetaItem>
            )}
          </dl>
          </aside>
        )}
      </div>

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

      {post.status === 'ARCHIVED' && (
        <div className="pt-4">
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
