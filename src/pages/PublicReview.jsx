import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import PlatformBadge from '@/components/PlatformBadge'
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
            'agency_name, logo_url, primary_color, basic_whitelabel_enabled, full_whitelabel_enabled',
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
  }, [isPreviewOpen, activeIndex, post?.media_urls])

  const handlePrev = () =>
    setActiveIndex((prev) => (prev === 0 ? post.media_urls.length - 1 : prev - 1))

  const handleNext = () =>
    setActiveIndex((prev) => (prev === post.media_urls.length - 1 ? 0 : prev + 1))

  const openPreview = (index) => {
    setActiveIndex(index)
    setIsPreviewOpen(true)
  }

  const handleStatusUpdate = async (newStatus) => {
    setIsSubmitting(true)
    const finalStatus = newStatus === 'APPROVED' ? 'SCHEDULED' : newStatus

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
  const showAgencyBranding =
    agencySub &&
    (agencySub.basic_whitelabel_enabled || agencySub.full_whitelabel_enabled)
    
  // CHANGED: Show "Powered by" footer for Ignite (no whitelabel) AND Velocity (basic whitelabel).
  // This effectively hides the footer ONLY for tiers with full_whitelabel_enabled.
  const showPoweredBy = !agencySub?.full_whitelabel_enabled

  if (loading)
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )

  // ── Confirmation Screen ──────────────────────────────────────
  if (statusUpdated) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-background p-6 text-center">
        <div className="mb-6 flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Check size={32} strokeWidth={2.5} />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          {statusUpdated === 'SCHEDULED' ? 'Content Approved' : 'Review Submitted'}
        </h2>
        <p className="mt-2 max-w-md text-muted-foreground leading-relaxed">
          {statusUpdated === 'SCHEDULED'
            ? `Successfully scheduled${post?.target_date ? ` for ${format(new Date(post.target_date), 'PPP')}` : ''}.`
            : "We've received your feedback and will prepare a new version shortly."}
        </p>
      </div>
    )
  }

  if (!post) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-muted-foreground">
        This link is invalid or has expired.
      </div>
    )
  }

  // ── Main Review Page ─────────────────────────────────────────
  return (
    <div className="min-h-screen w-full bg-background font-sans text-foreground flex flex-col">
      <div className="mx-auto max-w-7xl p-6 lg:p-16 w-full flex-1">
        
        {/* Header Branding */}
        <div className="mb-10 flex flex-col items-start gap-1">
          {showAgencyBranding ? (
            <div className="flex items-center gap-4">
              {agencySub.logo_url && (
                <img
                  src={agencySub.logo_url}
                  alt="Agency Logo"
                  className="h-8 w-auto object-contain rounded-lg"
                />
              )}
              <h2 className="text-2xl font-bold tracking-tight">
                {agencySub.agency_name || 'Agency'}
              </h2>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <img 
                src="/TerceroLogo.svg" 
                alt="Tercero Logo" 
                className="h-7 w-auto object-contain" 
              />
              <h2 className="text-2xl font-semibold tracking-tight text-primary">
                Tercero
              </h2>
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
                    <PlatformBadge key={p} platform={p} />
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
                  <span>Created {format(new Date(post.created_at), 'MMM dd, yyyy')}</span>
                </div>
                {post.target_date && (
                  <div className="flex items-center gap-2 font-semibold text-primary">
                    <Clock size={14} />
                    <span>
                      Schedule: {format(new Date(post.target_date), 'MMM dd @ p')}
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-muted-foreground/60">Caption</h3>
                <p className="text-lg leading-relaxed whitespace-pre-wrap text-foreground/90">
                  {post.content}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 rounded-2xl bg-secondary/20 p-6 text-sm border border-border/40">
              <Info size={20} className="mt-0.5 text-primary shrink-0" />
              <div className="space-y-1">
                <p className="font-bold">Final Review Notice</p>
                <p className="text-muted-foreground">
                  Approval will lock this version and notify the team to schedule for
                  publication.
                </p>
              </div>
            </div>

            {/* ACTION BUTTONS */}
            <div className="flex flex-col sm:flex-row items-center gap-4 pt-4">
              <Dialog>
                <DialogTrigger asChild>
                  <Button className="w-full sm:w-auto">
                    <Check className="mr-2 h-5 w-5" /> Approve &amp; Schedule
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-lg">
                  {/* Approve Dialog Header */}
                  <div className="flex items-center gap-4 mb-2">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Check size={24} strokeWidth={2.5} />
                    </div>
                    <div>
                      <DialogTitle className="text-lg">Approve &amp; Schedule</DialogTitle>
                      <DialogDescription className="text-sm">
                        You're confirming this content is ready for publication.
                      </DialogDescription>
                    </div>
                  </div>

                  {/* Post summary */}
                  <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm space-y-1.5 my-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">Approving</p>
                    <p className="font-semibold text-foreground">{post.title}</p>
                    <p className="text-muted-foreground">
                      {post.platform.join(', ')}{post.target_date ? ` · ${format(new Date(post.target_date), 'MMM d, yyyy')}` : ''}
                    </p>
                  </div>

                  {/* What happens next */}
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">What happens next</p>
                    <ul className="space-y-2">
                      {[
                        'This version is locked — no further edits can be made to it.',
                        'Your team will be notified immediately to begin scheduling.',
                        'The post will be published on the platform(s) listed above.',
                        'You will receive a confirmation email once it goes live.',
                      ].map((step, i) => (
                        <li key={i} className="flex items-start gap-3 text-sm text-muted-foreground">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-[11px] font-bold mt-0.5">{i + 1}</span>
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
                      <DialogTitle className="text-lg">Request Revisions</DialogTitle>
                      <DialogDescription className="text-sm">
                        Let the team know what needs to be changed before you can approve.
                      </DialogDescription>
                    </div>
                  </div>

                  {/* Feedback field */}
                  <div className="my-4 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">Your Feedback</p>
                    <Textarea
                      placeholder="Be as specific as possible — e.g., &quot;Change the opening line to something more casual,&quot; or &quot;Replace the second image with a product shot.&quot;"
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      className="min-h-[140px] bg-muted/30 text-sm leading-relaxed"
                    />
                    <p className="text-xs text-muted-foreground/60">Clear, detailed feedback helps the team respond faster.</p>
                  </div>

                  {/* What happens next */}
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">What happens next</p>
                    <ul className="space-y-2">
                      {[
                        'Your feedback is sent directly to the content team.',
                        'A revised version will be submitted for your review.',
                        'You will receive a new review link once the update is ready.',
                      ].map((step, i) => (
                        <li key={i} className="flex items-start gap-3 text-sm text-muted-foreground">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-foreground text-[11px] font-bold mt-0.5">{i + 1}</span>
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
                      {isSubmitting ? 'Sending Feedback...' : 'Submit Revision Request'}
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
                  <MediaThumbnail key={i} url={url} onClick={() => openPreview(i)} />
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
                  <MediaThumbnail key={i} url={url} onClick={() => openPreview(i)} />
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
        {showPoweredBy && (
          <p className="text-sm text-muted-foreground/60 font-medium tracking-wide">
            Powered by Tercero, Ark Labs 2026
          </p>
        )}
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
                onClick={(e) => { e.stopPropagation(); handlePrev() }}
              >
                <ChevronLeft size={28} />
              </button>
              <button
                className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition"
                onClick={(e) => { e.stopPropagation(); handleNext() }}
              >
                <ChevronRight size={28} />
              </button>

              {/* Dot Indicators */}
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
                {post.media_urls.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={(e) => { e.stopPropagation(); setActiveIndex(idx) }}
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