import { useState, useMemo, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import {
  Lock,
  Clock,
  CheckCircle2,
  RefreshCw,
  Circle,
  Play,
  Calendar,
  AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'

import { useCampaignReview, submitCampaignPostReview } from '@/api/campaigns'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

// ── Helpers ────────────────────────────────────────────────────────────────────

function isVideo(url = '') {
  return /\.(mp4|webm|mov|ogg|avi)(\?.*)?$/i.test(url)
}

function PlatformIcon({ name }) {
  const fileName = name === 'google_business' ? 'google_busines' : name
  return (
    <div className="flex h-6 w-6 items-center justify-center rounded-full border border-border bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
      <img
        src={`/platformIcons/${fileName}.png`}
        alt={name}
        className="size-4 object-contain"
        onError={(e) => (e.target.style.display = 'none')}
      />
    </div>
  )
}

// ── Branding header ────────────────────────────────────────────────────────────

function BrandingHeader({ data, progress }) {
  const showAgencyBranding = data?.branding_agency_sidebar ?? false
  const campaignName = data?.campaign_name?.trim() || 'Campaign Review'
  const goal = data?.goal?.trim() || null

  return (
    <div className="flex items-center gap-4 px-6 py-4 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
      {/* Logo */}
      <div className="shrink-0">
        {showAgencyBranding && data?.logo_url ? (
          <img
            src={data.logo_url}
            alt={data.agency_name}
            className="h-8 w-auto object-contain"
            onError={(e) => (e.target.style.display = 'none')}
          />
        ) : showAgencyBranding && data?.agency_name ? (
          <span className="text-sm font-semibold text-foreground">{data.agency_name}</span>
        ) : (
          <div
            className="h-7 w-20 bg-foreground"
            style={{
              WebkitMaskImage: 'url(/TerceroLand.svg)',
              WebkitMaskRepeat: 'no-repeat',
              WebkitMaskSize: 'contain',
              maskImage: 'url(/TerceroLand.svg)',
              maskRepeat: 'no-repeat',
              maskSize: 'contain',
            }}
          />
        )}
      </div>

      {/* Divider */}
      <div className="h-5 w-px bg-border shrink-0" />

      {/* Campaign info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{campaignName}</p>
        {goal && (
          <p className="text-xs text-muted-foreground truncate">{goal}</p>
        )}
      </div>

      {/* Progress */}
      <div className="shrink-0 text-xs text-muted-foreground font-medium">
        {progress.reviewed} of {progress.total} posts reviewed
      </div>
    </div>
  )
}

// ── Left panel post row ────────────────────────────────────────────────────────

function PostRow({ post, isSelected, isApproved, isRevised, onClick }) {
  const firstMedia = post.media_urls?.[0] ?? null
  const title = post.title?.trim() || 'Untitled'

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-l-2',
        isSelected
          ? 'bg-muted/60 border-l-primary'
          : 'border-l-transparent hover:bg-muted/30',
      )}
    >
      {/* Thumbnail */}
      <div className="shrink-0 h-10 w-10 rounded-md overflow-hidden bg-muted flex items-center justify-center">
        {firstMedia ? (
          isVideo(firstMedia) ? (
            <div className="h-full w-full bg-black/80 flex items-center justify-center">
              <Play className="size-4 text-white fill-white" />
            </div>
          ) : (
            <img
              src={firstMedia}
              alt=""
              className="h-full w-full object-cover"
              onError={(e) => {
                e.target.style.display = 'none'
                e.target.parentNode.classList.add('bg-muted')
              }}
            />
          )
        ) : null}
      </div>

      {/* Title + date */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{title}</p>
        {post.target_date && (
          <p className="text-xs text-muted-foreground">
            {format(parseISO(post.target_date), 'MMM d')}
          </p>
        )}
      </div>

      {/* Status dot */}
      <div className="shrink-0">
        {isApproved ? (
          <CheckCircle2 className="size-4 text-emerald-500 fill-emerald-500" />
        ) : isRevised ? (
          <RefreshCw className="size-4 text-amber-500" />
        ) : (
          <Circle className="size-4 text-muted-foreground" />
        )}
      </div>
    </button>
  )
}

// ── Media gallery ──────────────────────────────────────────────────────────────

function MediaGallery({ mediaUrls }) {
  if (!mediaUrls?.length) return null

  const shown = mediaUrls.slice(0, 4)
  const extra = mediaUrls.length - 4

  if (mediaUrls.length === 1) {
    const url = mediaUrls[0]
    return (
      <div className="rounded-lg overflow-hidden bg-muted">
        {isVideo(url) ? (
          <div className="aspect-video bg-black/90 flex items-center justify-center">
            <Play className="size-8 text-white fill-white opacity-80" />
          </div>
        ) : (
          <BrokenableImage src={url} className="w-full object-cover max-h-80" />
        )}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      {shown.map((url, i) => {
        const isLast = i === 3 && extra > 0
        return (
          <div key={i} className="relative aspect-square rounded-lg overflow-hidden bg-muted">
            {isVideo(url) ? (
              <div className="h-full w-full bg-black/90 flex items-center justify-center">
                <Play className="size-6 text-white fill-white opacity-80" />
              </div>
            ) : (
              <BrokenableImage src={url} className="h-full w-full object-cover" />
            )}
            {isLast && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <span className="text-white font-semibold text-sm">+{extra} more</span>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function BrokenableImage({ src, className }) {
  const [broken, setBroken] = useState(false)
  if (broken) return <div className={cn('bg-muted', className)} />
  return (
    <img
      src={src}
      alt=""
      className={className}
      onError={() => setBroken(true)}
    />
  )
}

// ── Main panel ─────────────────────────────────────────────────────────────────

function MainPanel({ post, onApprove, onRevise, isSubmitting, feedback, setFeedback }) {
  if (!post) return null

  const title = post.title?.trim() || 'Untitled'
  const platforms = post.platform ?? []
  const content = post.content?.trim() || null
  const hasMedia = post.media_urls?.length > 0
  const hasNoToken = !post.review_token

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-xl font-semibold text-foreground">{title}</h2>
      </div>

      {/* Platforms */}
      <div className="flex items-center gap-2 flex-wrap">
        {platforms.length > 0 ? (
          platforms.map((p) => <PlatformIcon key={p} name={p} />)
        ) : (
          <span className="text-xs text-muted-foreground">No platforms specified</span>
        )}
      </div>

      {/* Target date */}
      {post.target_date && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="size-4" />
          {format(parseISO(post.target_date), 'MMM d, yyyy')}
        </div>
      )}

      {/* Content */}
      {content && (
        <div className="rounded-lg border border-border bg-muted/30 p-4">
          <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{content}</p>
        </div>
      )}

      {/* Media */}
      {hasMedia && <MediaGallery mediaUrls={post.media_urls} />}

      {/* Action area */}
      <div className="space-y-3 pt-4 border-t border-border">
        {hasNoToken ? (
          <p className="text-sm text-muted-foreground italic">
            This post cannot be actioned — contact your agency.
          </p>
        ) : (
          <>
            <Textarea
              placeholder="Describe what needs to change…"
              rows={3}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              disabled={isSubmitting}
              className="resize-none"
            />
            <div className="flex items-center justify-between gap-3">
              <Button
                variant="outline"
                onClick={onRevise}
                disabled={isSubmitting || feedback.trim() === ''}
                className="gap-2"
              >
                <RefreshCw className="size-4" />
                Request Revisions
              </Button>
              <Button
                onClick={onApprove}
                disabled={isSubmitting}
                className="gap-2"
              >
                <CheckCircle2 className="size-4" />
                Approve This Post
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Page states ────────────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header skeleton */}
      <div className="flex items-center gap-4 px-6 py-4 border-b border-border">
        <Skeleton className="h-8 w-24" />
        <div className="h-5 w-px bg-border" />
        <Skeleton className="h-4 w-48" />
        <div className="flex-1" />
        <Skeleton className="h-4 w-28" />
      </div>
      {/* Two-column skeleton */}
      <div className="flex flex-1 overflow-hidden">
        <div className="w-72 border-r border-border p-4 space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-md shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            </div>
          ))}
        </div>
        <div className="flex-1 p-6 space-y-4">
          <Skeleton className="h-7 w-64" />
          <div className="flex gap-2">
            <Skeleton className="h-6 w-6 rounded-full" />
            <Skeleton className="h-6 w-6 rounded-full" />
          </div>
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-32 w-full rounded-lg" />
          <Skeleton className="h-48 w-full rounded-lg" />
        </div>
      </div>
    </div>
  )
}

function CentredState({ icon, title, subtitle, action }) {
  return (
    <div className="flex flex-col h-screen items-center justify-center bg-background p-6 text-center gap-4">
      <div className="p-4 rounded-full bg-muted">
        {icon}
      </div>
      <div>
        <p className="font-semibold text-foreground text-lg">{title}</p>
        {subtitle && (
          <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function CampaignReview() {
  const { token } = useParams()
  const { data, isLoading, isError } = useCampaignReview(token)

  const posts = data?.posts ?? []

  const [selectedPostId, setSelectedPostId] = useState(null)
  const [approvedIds, setApprovedIds] = useState(new Set())
  const [revisedIds, setRevisedIds] = useState(new Set())
  const [feedback, setFeedback] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const actionedIds = useMemo(
    () => new Set([...approvedIds, ...revisedIds]),
    [approvedIds, revisedIds],
  )

  // Auto-select first post on data load
  useEffect(() => {
    if (posts.length > 0 && !selectedPostId) {
      setSelectedPostId(posts[0].post_id)
    }
  }, [posts, selectedPostId])

  function advanceSelection(justActionedId) {
    const next = posts.find(
      (p) =>
        p.post_id !== justActionedId &&
        !approvedIds.has(p.post_id) &&
        !revisedIds.has(p.post_id),
    )
    setSelectedPostId(next?.post_id ?? null)
  }

  async function handleApprove() {
    if (isSubmitting || !selectedPost?.review_token) return
    setIsSubmitting(true)
    try {
      await submitCampaignPostReview(selectedPost.review_token, 'SCHEDULED', '')
      setApprovedIds((prev) => new Set([...prev, selectedPost.post_id]))
      setFeedback('')
      advanceSelection(selectedPost.post_id)
    } catch {
      toast.error('Failed to submit — please try again')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleRequestRevisions() {
    const trimmed = feedback.trim()
    if (isSubmitting || !trimmed || !selectedPost?.review_token) return
    setIsSubmitting(true)
    try {
      await submitCampaignPostReview(selectedPost.review_token, 'NEEDS_REVISION', trimmed)
      setRevisedIds((prev) => new Set([...prev, selectedPost.post_id]))
      setFeedback('')
      advanceSelection(selectedPost.post_id)
    } catch {
      toast.error('Failed to submit — please try again')
    } finally {
      setIsSubmitting(false)
    }
  }

  const selectedPost = posts.find((p) => p.post_id === selectedPostId) ?? null
  const showPoweredBy = data?.branding_powered_by ?? true

  // ── Loading ──
  if (isLoading) return <LoadingSkeleton />

  // ── Fetch error ──
  if (isError) {
    return (
      <CentredState
        icon={<AlertTriangle className="size-6 text-muted-foreground" />}
        title="Something went wrong"
        subtitle="Please try refreshing the page."
        action={
          <Button variant="outline" onClick={() => window.location.reload()}>
            Refresh
          </Button>
        }
      />
    )
  }

  // ── Invalid token ──
  if (!data) {
    return (
      <CentredState
        icon={<Lock className="size-8 text-amber-600 dark:text-amber-400" />}
        title="Link Expired"
        subtitle="This review link has expired or has already been used. Please contact your account manager for a new link."
      />
    )
  }

  // ── No reviewable posts ──
  if (posts.length === 0) {
    return (
      <CentredState
        icon={<Clock className="size-6 text-muted-foreground" />}
        title="Nothing to review right now."
        subtitle="Check back once your agency submits content for approval."
      />
    )
  }

  // ── All actioned → completion ──
  if (actionedIds.size === posts.length) {
    return (
      <div className="flex flex-col h-screen items-center justify-center bg-background p-6 text-center gap-4">
        <div className="animate-in zoom-in-50 fade-in duration-500 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-500/10">
          <CheckCircle2 className="size-8 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <p className="text-xl font-semibold text-foreground">All posts reviewed</p>
          <p className="text-sm text-muted-foreground mt-1">
            Your feedback has been sent to the agency.
          </p>
        </div>
      </div>
    )
  }

  // ── Review active ──
  const progress = { reviewed: actionedIds.size, total: posts.length }

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      <BrandingHeader data={data} progress={progress} />

      <div className="flex flex-1 overflow-hidden">
        {/* Left panel */}
        <div className="w-72 shrink-0 border-r border-border overflow-y-auto">
          {posts.map((post) => (
            <PostRow
              key={post.post_id}
              post={post}
              isSelected={post.post_id === selectedPostId}
              isApproved={approvedIds.has(post.post_id)}
              isRevised={revisedIds.has(post.post_id)}
              onClick={() => setSelectedPostId(post.post_id)}
            />
          ))}
        </div>

        {/* Main panel */}
        <MainPanel
          post={selectedPost}
          onApprove={handleApprove}
          onRevise={handleRequestRevisions}
          isSubmitting={isSubmitting}
          feedback={feedback}
          setFeedback={setFeedback}
        />
      </div>

      {/* Footer */}
      {showPoweredBy && (
        <div className="flex items-center justify-center py-3 border-t border-border bg-background">
          <p className="text-xs text-muted-foreground">Powered by Tercero</p>
        </div>
      )}
    </div>
  )
}
