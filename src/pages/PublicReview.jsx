import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
const PlatformIcon = ({ name }) => {
  const fileName = name === 'google_business' ? 'google_busines' : name
  return (
    <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-card bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
      <img
        src={`/platformIcons/${fileName}.png`}
        alt={name}
        className="size-5 object-contain"
        onError={(e) => (e.target.style.display = 'none')}
      />
    </div>
  )
}
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Loader2,
  Info,
  Check,
  PencilLine,
  Clock,
  Calendar as CalendarIcon,
  Eye,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react'
import { format } from 'date-fns'
import { Badge } from '@/components/ui/badge'

// Detect if a URL is a video
function isVideo(url = '') {
  return /\.(mp4|webm|mov|ogg|avi)(\?.*)?$/i.test(url)
}

export default function PublicReview() {
  const { token } = useParams()
  const [post, setPost] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [statusUpdated, setStatusUpdated] = useState(null)
  const [agencySub, setAgencySub] = useState(null)

  // Full-screen Preview States
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    async function fetchPost() {
      const { data, error } = await supabase.rpc('get_post_by_token', {
        p_token: token,
      })
      if (error || !data || data.length === 0) {
        setLoading(false)
        return
      }

      const postData = data[0]
      setPost(postData)

      // Use user_id returned directly from the RPC (now included in the response)
      const userId = postData.user_id

      if (userId) {
        const { data: sub } = await supabase
          .from('agency_subscriptions')
          .select(
            'agency_name, logo_url, logo_horizontal_url, primary_color, branding_agency_sidebar, branding_powered_by',
          )
          .eq('user_id', userId)
          .maybeSingle()

        if (sub) setAgencySub(sub)
      }

      setLoading(false)
    }
    fetchPost()
  }, [token])

  // Keyboard Navigation for Media Dialog
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isPreviewOpen || post?.media_urls?.length <= 1) return
      if (e.key === 'ArrowLeft') handlePrev()
      if (e.key === 'ArrowRight') handleNext()
      if (e.key === 'Escape') setIsPreviewOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPreviewOpen, activeIndex, post?.media_urls])

  const handlePrev = () =>
    setActiveIndex((prev) =>
      prev === 0 ? post.media_urls.length - 1 : prev - 1,
    )

  const handleNext = () =>
    setActiveIndex((prev) =>
      prev === post.media_urls.length - 1 ? 0 : prev + 1,
    )

  const openPreview = (index) => {
    setActiveIndex(index)
    setIsPreviewOpen(true)
  }

  const handleStatusUpdate = async (newStatus) => {
    setIsSubmitting(true)
    const hasPlatforms = (post?.platform?.length ?? 0) > 0
    const finalStatus = newStatus === 'APPROVED'
      ? (hasPlatforms ? 'SCHEDULED' : 'APPROVED')
      : newStatus

    const { error } = await supabase.rpc('update_post_status_by_token', {
      p_token: token,
      p_status: finalStatus,
      p_feedback: feedback,
    })

    if (!error) {
      setStatusUpdated(finalStatus)
    } else {
      alert('Something went wrong. Please try again.')
    }
    setIsSubmitting(false)
  }

  // Determine branding
  const showAgencyBranding = agencySub?.branding_agency_sidebar ?? false

  // Show "Powered by Tercero" footer on Ignite and Velocity; hidden on Quantum (branding_powered_by = false)
  const showPoweredBy = agencySub?.branding_powered_by ?? true

  if (loading)
    return (
      <div className="flex mx-auto h-screen items-center justify-center bg-background">
        <span className="text-spotlight-dark text-sm font-medium tracking-wide">
          Setting things up...
        </span>
      </div>
    )

  // ── Confirmation Screen ──────────────────────────────────────
  if (statusUpdated) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-background p-6 text-center">
        <div className="animate-in zoom-in-50 fade-in duration-500 mb-6 flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
          <Check size={32} strokeWidth={2.5} />
        </div>
        <h2 className="animate-in fade-in slide-in-from-bottom-3 duration-500 delay-150 fill-mode-both text-2xl font-bold tracking-tight text-foreground">
          {statusUpdated === 'SCHEDULED'
            ? 'Content Approved'
            : 'Review Submitted'}
        </h2>
        <p className="animate-in fade-in slide-in-from-bottom-3 duration-500 delay-300 fill-mode-both mt-2 max-w-md text-muted-foreground leading-relaxed">
          {statusUpdated === 'SCHEDULED'
            ? post?.platform_schedules
              ? `Successfully scheduled across ${Object.keys(post.platform_schedules).length} platform${Object.keys(post.platform_schedules).length > 1 ? 's' : ''}.`
              : `Successfully scheduled${post?.target_date ? ` for ${format(new Date(post.target_date), 'PPP')}` : ''}.`
            : "We've received your feedback and will prepare a new version shortly."}
        </p>
      </div>
    )
  }

  if (!post) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-background p-6 text-center">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400">
          <Info size={32} />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Link Expired
        </h2>
        <p className="mt-2 max-w-md text-muted-foreground leading-relaxed">
          This review link has expired or has already been used. Please contact your account manager for a new link.
        </p>
      </div>
    )
  }

  // ── Main Review Page ─────────────────────────────────────────
  return (
    <div className="min-h-screen w-full bg-background font-sans text-foreground flex flex-col">
      <div className="mx-auto max-w-7xl p-6 lg:p-16 w-full flex-1">
        {/* Header Branding */}
        <div className="mb-10 flex flex-col items-start gap-1">
          {!showAgencyBranding ? (
            <div
              className="h-7 w-28 bg-foreground"
              style={{
                maskImage: 'url(/TerceroLand.svg)',
                maskRepeat: 'no-repeat',
                maskPosition: 'center left',
                maskSize: 'contain',
                WebkitMaskImage: 'url(/TerceroLand.svg)',
                WebkitMaskRepeat: 'no-repeat',
                WebkitMaskPosition: 'center left',
                WebkitMaskSize: 'contain',
              }}
            />
          ) : (
            <div className="flex items-center gap-4">
              {agencySub.logo_horizontal_url || agencySub.logo_url ? (
                <img
                  src={agencySub.logo_horizontal_url || agencySub.logo_url}
                  alt={agencySub.agency_name}
                  className="h-12 w-auto object-contain rounded-lg"
                  onError={(e) => (e.target.style.display = 'none')}
                />
              ) : (
                <h2 className="text-2xl font-bold tracking-tight">
                  {agencySub.agency_name || 'Agency'}
                </h2>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">
          {/* LEFT SECTION */}
          <div className="lg:col-span-7 space-y-8 order-1">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {post.platform.map((p) => (
                    <PlatformIcon key={p} name={p} />
                  ))}
                </div>
                <Badge variant="secondary" className="font-mono">
                  v{post.version_number}.0
                </Badge>
              </div>

              <h1 className="text-3xl font-extrabold tracking-tight lg:text-4xl">
                {post.title}
              </h1>

              <div className="flex flex-wrap items-center gap-y-2 gap-x-4 border-y border-border/50 py-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <CalendarIcon size={14} />
                  <span>
                    Created {format(new Date(post.created_at), 'MMM dd, yyyy')}
                  </span>
                </div>
                {post.platform_schedules ? (
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider">
                      Planned Schedule
                    </p>
                    {Object.entries(post.platform_schedules).map(([platform, { scheduled_at }]) => (
                      <div key={platform} className="flex items-center gap-2 text-sm font-semibold text-primary">
                        <Clock size={13} />
                        <span className="capitalize">{platform.replace('_', ' ')}:</span>
                        <span>{format(new Date(scheduled_at), 'MMM dd @ p')}</span>
                      </div>
                    ))}
                  </div>
                ) : post.target_date ? (
                  <div className="flex items-center gap-2 font-semibold text-primary">
                    <Clock size={14} />
                    <span>
                      Schedule:{' '}
                      {format(new Date(post.target_date), 'MMM dd @ p')}
                    </span>
                  </div>
                ) : null}
              </div>

              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-muted-foreground/60">
                  Caption
                </h3>
                <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
                  {post.content}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 rounded-2xl bg-secondary/20 p-6 text-sm border border-border/40">
              <Info size={20} className="mt-0.5 text-primary shrink-0" />
              <div className="space-y-1">
                <p className="font-bold">Final Review Notice</p>
                <p className="text-muted-foreground">
                  {post.platform?.length > 0
                    ? 'Approval will lock this version and notify the team to schedule for publication.'
                    : 'Approval will lock this version and notify the team to proceed with delivery.'}
                </p>
              </div>
            </div>

            {/* ACTION BUTTONS */}
            <div className="flex flex-col sm:flex-row items-center gap-4 pt-4">
              <Dialog>
                <DialogTrigger asChild>
                  <Button className="w-full sm:w-auto">
                    <Check className="mr-2 h-5 w-5" />
                    {post.platform?.length > 0 ? 'Approve & Schedule' : 'Approve'}
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-lg">
                  {/* Approve Dialog Header */}
                  <div className="flex items-center gap-4 mb-2">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Check size={24} strokeWidth={2.5} />
                    </div>
                    <div>
                      <DialogTitle className="text-lg">
                        {post.platform?.length > 0 ? 'Approve & Schedule' : 'Approve Deliverable'}
                      </DialogTitle>
                      <DialogDescription className="text-sm">
                        {post.platform?.length > 0
                          ? "You're confirming this content is ready for publication."
                          : "You're confirming this deliverable is accepted and ready for delivery."}
                      </DialogDescription>
                    </div>
                  </div>

                  {/* Post summary */}
                  <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm space-y-1.5 my-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                      Approving
                    </p>
                    <p className="font-semibold text-foreground">
                      {post.title}
                    </p>
                    {post.platform_schedules ? (
                      <div className="space-y-0.5">
                        {Object.entries(post.platform_schedules).map(([platform, { scheduled_at }]) => (
                          <p key={platform} className="text-muted-foreground text-xs">
                            <span className="capitalize font-medium">{platform.replace('_', ' ')}</span>
                            {' · '}{format(new Date(scheduled_at), 'MMM d, yyyy @ p')}
                          </p>
                        ))}
                      </div>
                    ) : post.platform?.length > 0 ? (
                      <p className="text-muted-foreground">
                        {post.platform.join(', ')}
                        {post.target_date
                          ? ` · ${format(new Date(post.target_date), 'MMM d, yyyy')}`
                          : ''}
                      </p>
                    ) : post.target_date ? (
                      <p className="text-muted-foreground">
                        Target date: {format(new Date(post.target_date), 'MMM d, yyyy')}
                      </p>
                    ) : null}
                  </div>

                  {/* What happens next */}
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                      What happens next
                    </p>
                    <ul className="space-y-2">
                      {(post.platform?.length > 0
                        ? [
                            'This version is locked — no further edits can be made to it.',
                            'Your team will be notified immediately to begin scheduling.',
                            'The post will be published on the platform(s) listed above.',
                            'You will receive a confirmation email once it goes live.',
                          ]
                        : [
                            'This version is locked — no further edits can be made to it.',
                            'Your team will be notified to proceed with delivery.',
                            'You will receive a confirmation once the deliverable has been sent.',
                          ]
                      ).map((step, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-3 text-sm text-muted-foreground"
                        >
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-[11px] font-bold mt-0.5">
                            {i + 1}
                          </span>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <DialogFooter className="mt-6">
                    <Button
                      className="w-full"
                      onClick={() => handleStatusUpdate('APPROVED')}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? 'Processing...' : 'Confirm Approval'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full sm:w-auto">
                    <PencilLine className="mr-2 h-5 w-5" /> Request Revisions
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  {/* Revision Dialog Header */}
                  <div className="flex items-center gap-4 mb-2">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                      <PencilLine size={22} strokeWidth={2} />
                    </div>
                    <div>
                      <DialogTitle className="text-lg">
                        Request Revisions
                      </DialogTitle>
                      <DialogDescription className="text-sm">
                        Let the team know what needs to be changed before you
                        can approve.
                      </DialogDescription>
                    </div>
                  </div>

                  {/* Feedback field */}
                  <div className="my-4 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                      Your Feedback
                    </p>
                    <Textarea
                      placeholder='Be as specific as possible — e.g., "Change the opening line to something more casual," or "Replace the second image with a product shot."'
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      className="min-h-[140px] bg-muted/30 text-sm leading-relaxed"
                    />
                    <p className="text-xs text-muted-foreground/60">
                      Clear, detailed feedback helps the team respond faster.
                    </p>
                  </div>

                  {/* What happens next */}
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                      What happens next
                    </p>
                    <ul className="space-y-2">
                      {[
                        'Your feedback is sent directly to the content team.',
                        'A revised version will be submitted for your review.',
                        'You will receive a new review link once the update is ready.',
                      ].map((step, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-3 text-sm text-muted-foreground"
                        >
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-foreground text-[11px] font-bold mt-0.5">
                            {i + 1}
                          </span>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <DialogFooter className="mt-6">
                    <Button
                      variant="outline"
                      className="w-full"
                      disabled={!feedback || isSubmitting}
                      onClick={() => handleStatusUpdate('NEEDS_REVISION')}
                    >
                      {isSubmitting
                        ? 'Sending Feedback...'
                        : 'Submit Revision Request'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {/* MOBILE: Media Grid */}
            <div className="block lg:hidden pt-8 space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground/60 text-center">
                Media Assets ({post.media_urls.length})
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {post.media_urls.map((url, i) => (
                  <MediaThumbnail
                    key={i}
                    url={url}
                    onClick={() => openPreview(i)}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT SECTION: DESKTOP MEDIA GRID */}
          <div className="hidden lg:block lg:col-span-5 border-l border-border/50 pl-12 order-2">
            <div className="sticky top-12 space-y-6">
              <h3 className="text-sm font-semibold text-muted-foreground/60">
                Media Assets
              </h3>
              <div className="grid grid-cols-2 gap-4 max-h-[80vh] overflow-y-auto pr-1 scrollbar-hide">
                {post.media_urls.map((url, i) => (
                  <MediaThumbnail
                    key={i}
                    url={url}
                    onClick={() => openPreview(i)}
                  />
                ))}
                {post.media_urls.length === 0 && (
                  <div className="col-span-2 h-48 rounded-2xl border-2 border-dashed border-border flex items-center justify-center text-muted-foreground italic text-sm">
                    No media attached
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <footer className="w-full py-6 mt-auto border-t border-border/40 flex items-center justify-center">
        {!showAgencyBranding ? (
          <p className="text-sm text-muted-foreground/60 font-medium tracking-wide">
            Tercero 2026
          </p>
        ) : showPoweredBy ? (
          <div
            className="h-5 w-20 bg-muted-foreground/50"
            style={{
              maskImage: 'url(/TerceroLand.svg)',
              maskRepeat: 'no-repeat',
              maskPosition: 'center',
              maskSize: 'contain',
              WebkitMaskImage: 'url(/TerceroLand.svg)',
              WebkitMaskRepeat: 'no-repeat',
              WebkitMaskPosition: 'center',
              WebkitMaskSize: 'contain',
            }}
          />
        ) : null}
      </footer>

      {/* FULL-SCREEN LIGHTBOX */}
      {isPreviewOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
          onClick={() => setIsPreviewOpen(false)}
        >
          {/* Close */}
          <button
            className="absolute top-5 right-5 text-white/70 hover:text-white z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 transition"
            onClick={() => setIsPreviewOpen(false)}
          >
            <X size={22} />
          </button>

          {/* Image counter */}
          {post.media_urls.length > 1 && (
            <div className="absolute top-5 left-1/2 -translate-x-1/2 z-10">
              <Badge className="bg-white/10 text-white border-none backdrop-blur-md px-4 py-1.5 font-medium">
                {activeIndex + 1} / {post.media_urls.length}
              </Badge>
            </div>
          )}

          {/* Media */}
          <div
            className="relative flex items-center justify-center max-w-[90vw] max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {isVideo(post.media_urls[activeIndex]) ? (
              <video
                key={post.media_urls[activeIndex]}
                src={post.media_urls[activeIndex]}
                controls
                autoPlay
                className="max-w-[90vw] max-h-[85vh] rounded-xl object-contain"
              />
            ) : (
              <img
                src={post.media_urls[activeIndex]}
                alt="Preview"
                className="max-w-[90vw] max-h-[85vh] rounded-xl object-contain"
              />
            )}
          </div>

          {/* Prev / Next */}
          {post.media_urls.length > 1 && (
            <>
              <button
                className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition"
                onClick={(e) => {
                  e.stopPropagation()
                  handlePrev()
                }}
              >
                <ChevronLeft size={28} />
              </button>
              <button
                className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition"
                onClick={(e) => {
                  e.stopPropagation()
                  handleNext()
                }}
              >
                <ChevronRight size={28} />
              </button>

              {/* Dot Indicators */}
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
                {post.media_urls.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={(e) => {
                      e.stopPropagation()
                      setActiveIndex(idx)
                    }}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      idx === activeIndex ? 'bg-white w-6' : 'bg-white/30 w-1.5'
                    }`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Media Thumbnail Component ─────────────────────────────────
function MediaThumbnail({ url, onClick }) {
  const video = isVideo(url)
  return (
    <div
      onClick={onClick}
      className="group relative rounded-xl overflow-hidden bg-muted cursor-pointer border border-border/50 hover:border-border transition-all"
      style={{ aspectRatio: '1 / 1' }}
    >
      {video ? (
        <video
          src={url}
          muted
          playsInline
          className="w-full h-full object-cover"
        />
      ) : (
        <img
          src={url}
          alt=""
          className="w-full h-full object-cover transition duration-300 group-hover:brightness-75"
        />
      )}
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <div className="p-2.5 bg-black/30 backdrop-blur-sm rounded-full border border-white/20 text-white">
          <Eye size={18} />
        </div>
      </div>
    </div>
  )
}
