import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
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
  Info,
  Check,
  PencilLine,
  Clock,
  Calendar as CalendarIcon,
  Eye,
  ChevronLeft,
  ChevronRight,
  X,
  FileText,
  Smartphone,
  Play,
} from 'lucide-react'
import { format } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import { isDocumentUrl, getDocumentExtension, getDocumentPreviewUrl } from '@/lib/helper'
import { cn } from '@/lib/utils'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import InstagramPreview from '@/pages/posts/socialMediaPreview/InstagramPreview'
import TwitterPreview from '@/pages/posts/socialMediaPreview/TwitterPreview'
import LinkedInPreview from '@/pages/posts/socialMediaPreview/LinkedInPreview'
import FacebookPreview from '@/pages/posts/socialMediaPreview/FacebookPreview'
import YouTubePreview from '@/pages/posts/socialMediaPreview/YouTubePreview'

const PlatformIcon = ({ name }) => {
  const fileName = name === 'google_business' ? 'google_busines' : name
  return (
    <div className="flex h-6 w-6 items-center justify-center rounded-full overflow-hidden p-0.5">
      <img
        src={`/platformIcons/${fileName}.png`}
        alt={name}
        className="w-full h-full object-contain"
        onError={(e) => (e.target.style.display = 'none')}
      />
    </div>
  )
}

// Detect if a URL is a video — matches extensions, path segments, and blob URLs
function isVideo(url = '') {
  const videoExtensions = ['.mp4', '.mov', '.webm', '.ogg', '.m4v', '.avi']
  return (
    videoExtensions.some((ext) => url.toLowerCase().includes(ext)) ||
    url.includes('video') ||
    url.startsWith('blob:')
  )
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

  // Right panel view: 'media' | 'preview'
  const [rightView, setRightView] = useState('media')
  const [previewPlatform, setPreviewPlatform] = useState(() => null)

  // Mobile preview sheet
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false)
  const [mobileSheetPlatform, setMobileSheetPlatform] = useState(null)

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
  const showPoweredBy = agencySub?.branding_powered_by ?? true

  // Adapt post + client shape for preview components
  const previewPost = post ? { ...post, platforms: post.platform } : null
  const previewClient = post
    ? {
        name: post.client_name,
        logo_url: post.client_logo_url,
        industry: post.client_industry,
        social_links: post.client_social_links ?? {},
      }
    : null

  const activePlatform = previewPlatform ?? post?.platform?.[0] ?? null

  const renderPlatformPreview = (platform) => {
    if (!platform || !previewPost) return null
    const props = { post: previewPost, client: previewClient }
    if (platform === 'instagram') return <InstagramPreview {...props} />
    if (platform === 'twitter') return <TwitterPreview {...props} />
    if (platform === 'linkedin') return <LinkedInPreview {...props} />
    if (platform === 'facebook') return <FacebookPreview {...props} />
    if (platform === 'youtube') return <YouTubePreview {...props} />
    return null
  }

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
        <div className="animate-in zoom-in-50 fade-in duration-500 mb-6 flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-green-100 dark:bg-green-500/10 text-green-600 dark:text-green-400">
          <Check size={32} strokeWidth={2.5} />
        </div>
        <h2 className="animate-in fade-in slide-in-from-bottom-3 duration-500 delay-150 fill-mode-both text-2xl font-bold tracking-tight text-foreground bricolage">
          {statusUpdated === 'SCHEDULED'
            ? 'Content Approved'
            : 'Review Submitted'}
        </h2>
        <p className="animate-in fade-in slide-in-from-bottom-3 duration-500 delay-300 fill-mode-both mt-2 max-w-md text-muted-foreground leading-relaxed">
          {statusUpdated === 'SCHEDULED'
            ? "Your approval has been recorded. You'll receive an email when your posts go live."
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
        <h2 className="text-2xl font-bold tracking-tight text-foreground bricolage">
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
    <div className="h-screen w-full bg-background font-sans text-foreground overflow-hidden flex justify-center">
      <div className="w-full max-w-7xl flex flex-col lg:flex-row overflow-hidden">

        {/* LEFT: Content — scrollable */}
        <div className="lg:w-[55%] overflow-y-auto px-8 lg:px-14 py-10 flex flex-col gap-6">

          {/* Branding */}
          <div className="mb-2">
            {!showAgencyBranding ? (
              <div
                className="h-6 w-24 bg-foreground"
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
            ) : agencySub?.logo_horizontal_url || agencySub?.logo_url ? (
              <img
                src={agencySub.logo_horizontal_url || agencySub.logo_url}
                alt={agencySub.agency_name}
                className="h-10 w-auto object-contain rounded-md"
                onError={(e) => (e.target.style.display = 'none')}
              />
            ) : (
              <span className="text-lg font-bold tracking-tight">{agencySub?.agency_name || 'Agency'}</span>
            )}
          </div>

          {/* Platform badges + version */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5">
              {post.platform.map((p) => (
                <div
                  key={p}
                  className="flex items-center gap-1 px-1.5 py-1 rounded-full border text-xs font-medium text-muted-foreground"
                >
                  <PlatformIcon name={p} />
                  <span className="capitalize">{p.replace('_', ' ')}</span>
                </div>
              ))}
            </div>
            <Badge variant="outline" className="font-mono text-xs text-muted-foreground shrink-0">
              v{post.version_number}.0
            </Badge>
          </div>

          {/* Title */}
          <h1 className="text-3xl font-extrabold tracking-tight bricolage leading-tight">
            {post.title}
          </h1>

          {/* Meta */}
          <div className="flex flex-col gap-2 text-sm text-muted-foreground border-y border-border/40 py-3">
            <div className="flex items-center gap-1.5">
              <CalendarIcon size={13} />
              <span>Created {format(new Date(post.created_at), 'MMM dd, yyyy')}</span>
            </div>
            {post.platform_schedules ? (
              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                {Object.entries(post.platform_schedules).map(([platform, { scheduled_at }]) => (
                  <div key={platform} className="flex items-center gap-1.5 font-medium text-foreground">
                    <PlatformIcon name={platform} />
                    <span>{format(new Date(scheduled_at), 'MMM dd @ p')}</span>
                  </div>
                ))}
              </div>
            ) : post.target_date ? (
              <div className="flex items-center gap-1.5 font-medium text-primary">
                <Clock size={13} />
                <span>Scheduled {format(new Date(post.target_date), 'MMM dd @ p')}</span>
              </div>
            ) : null}
          </div>

          {/* Caption */}
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
              Caption
            </p>
            <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/80">
              {post.content}
            </p>
          </div>

          {/* Mobile: media thumbnails + preview trigger */}
          <div className="lg:hidden space-y-3">
            {post.media_urls?.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {post.media_urls.map((url, i) => (
                  <MediaThumbnail key={i} url={url} onClick={() => openPreview(i)} />
                ))}
              </div>
            )}
            {post.platform?.length > 0 && (
              <Button
                variant="outline"
                onClick={() => {
                  setMobileSheetPlatform(post.platform[0])
                  setMobileSheetOpen(true)
                }}
              >
                <Smartphone className="mr-2 h-4 w-4" />
                Preview on platform
              </Button>
            )}
          </div>

          {/* ACTION BUTTONS */}
          <div className="flex items-center gap-3 pt-2">
            <Dialog>
              <DialogTrigger asChild>
                <Button>
                  <Check className="mr-2 h-4 w-4" />
                  {post.platform?.length > 0 ? 'Approve & Schedule' : 'Approve'}
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle className="text-lg bricolage">
                    {post.platform?.length > 0 ? 'Approve & Schedule' : 'Approve Deliverable'}
                  </DialogTitle>
                  <DialogDescription className="text-sm">
                    {post.platform?.length > 0
                      ? "You're confirming this content is ready for publication."
                      : "You're confirming this deliverable is accepted and ready for delivery."}
                  </DialogDescription>
                </DialogHeader>

                <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm space-y-1.5 my-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">Approving</p>
                  <p className="font-semibold text-foreground">{post.title}</p>
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
                      {post.target_date ? ` · ${format(new Date(post.target_date), 'MMM d, yyyy')}` : ''}
                    </p>
                  ) : post.target_date ? (
                    <p className="text-muted-foreground">Target date: {format(new Date(post.target_date), 'MMM d, yyyy')}</p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">What happens next</p>
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
                      <li key={i} className="flex items-start gap-3 text-sm text-muted-foreground">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 text-[11px] font-bold mt-0.5">
                          {i + 1}
                        </span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <DialogFooter className="mt-6">
                  <Button onClick={() => handleStatusUpdate('APPROVED')} disabled={isSubmitting}>
                    {isSubmitting ? 'Processing...' : 'Confirm Approval'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <PencilLine className="mr-2 h-4 w-4" /> Request Revisions
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle className="text-lg bricolage">Request Revisions</DialogTitle>
                  <DialogDescription className="text-sm">
                    Let the team know what needs to be changed before you can approve.
                  </DialogDescription>
                </DialogHeader>

                <div className="my-4 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">Your Feedback</p>
                  <Textarea
                    placeholder='Be as specific as possible — e.g., "Change the opening line to something more casual," or "Replace the second image with a product shot."'
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    className="min-h-35 bg-muted/30 text-sm leading-relaxed"
                  />
                  <p className="text-xs text-muted-foreground/60">Clear, detailed feedback helps the team respond faster.</p>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">What happens next</p>
                  <ul className="space-y-2">
                    {[
                      'Your feedback is sent directly to the content team.',
                      'A revised version will be submitted for your review.',
                      'You will receive a new review link once the update is ready.',
                    ].map((step, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm text-muted-foreground">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 text-[11px] font-bold mt-0.5">
                          {i + 1}
                        </span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <DialogFooter className="mt-6">
                  <Button
                    disabled={!feedback || isSubmitting}
                    onClick={() => handleStatusUpdate('NEEDS_REVISION')}
                  >
                    {isSubmitting ? 'Sending Feedback...' : 'Submit Revision Request'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* Notice */}
          <p className="text-xs text-muted-foreground/50 leading-relaxed">
            {post.platform?.length > 0
              ? 'Approval locks this version and schedules it for publication.'
              : 'Approval locks this version and notifies the team to proceed.'}
          </p>

          {/* Powered by */}
          {showPoweredBy && (
            <div className="mt-auto pt-6 flex">
              {!showAgencyBranding ? (
                <p className="text-xs text-muted-foreground/40 font-medium">Tercero 2026</p>
              ) : (
                <div
                  className="h-4 w-14 bg-muted-foreground/30"
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
              )}
            </div>
          )}

          {/* Mobile preview sheet */}
          <Sheet open={mobileSheetOpen} onOpenChange={setMobileSheetOpen}>
            <SheetContent side="bottom" className="h-[90vh] flex flex-col p-0">
              <SheetHeader className="shrink-0 px-5 pt-5 pb-3 border-b border-border/40">
                <SheetTitle className="text-sm font-medium">Platform Preview</SheetTitle>
                <div className="pt-1">
                  <Select
                    value={mobileSheetPlatform ?? ''}
                    onValueChange={setMobileSheetPlatform}
                  >
                    <SelectTrigger className="h-8 text-xs w-full">
                      <SelectValue placeholder="Select platform" />
                    </SelectTrigger>
                    <SelectContent>
                      {post.platform?.map((p) => (
                        <SelectItem key={p} value={p} className="text-xs">
                          <div className="flex items-center gap-2">
                            <PlatformIcon name={p} />
                            <span className="capitalize">{p.replace('_', ' ')}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </SheetHeader>
              <div className="flex-1 overflow-y-auto px-5 py-5">
                {renderPlatformPreview(mobileSheetPlatform ?? post.platform?.[0])}
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Divider */}
        <div className="hidden lg:block w-px bg-border/30 shrink-0" />

        {/* RIGHT: desktop only */}
        <div className="hidden lg:flex lg:w-[45%] flex-col overflow-hidden px-8 lg:px-10 pt-10 pb-6 gap-6">

          {/* Container 1: Toggle + Select — never scrolls */}
          <div className="shrink-0 flex items-center gap-2 justify-between">
            <div className="flex items-center gap-0.5 p-1 bg-muted rounded-lg shrink-0">
              <button
                onClick={() => setRightView('media')}
                className={cn(
                  'px-3 py-1 text-xs font-medium rounded-md transition-colors',
                  rightView === 'media'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Media
              </button>
              {post.platform?.length > 0 && (
                <button
                  onClick={() => {
                    setRightView('preview')
                    setPreviewPlatform(post.platform[0])
                  }}
                  className={cn(
                    'px-3 py-1 text-xs font-medium rounded-md transition-colors',
                    rightView === 'preview'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  Preview
                </button>
              )}
            </div>

            <Select
              value={rightView === 'preview' ? (activePlatform ?? '') : ''}
              onValueChange={(val) => { setPreviewPlatform(val); setRightView('preview') }}
              disabled={rightView === 'media' || !post.platform?.length}
            >
              <SelectTrigger className="h-8 text-xs w-fit">
                <SelectValue placeholder="Preview platform" />
              </SelectTrigger>
              <SelectContent>
                {post.platform?.map((p) => (
                  <SelectItem key={p} value={p} className="text-xs">
                    <div className="flex items-center gap-2">
                      <PlatformIcon name={p} />
                      <span className="capitalize">{p.replace('_', ' ')}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Container 2: Media / Preview content — only this scrolls */}
          <div className="flex-1 overflow-y-auto pb-4">
            {rightView === 'media' ? (
              post.media_urls.length > 0 ? (
                <div className="grid grid-cols-2 gap-3">
                  {post.media_urls.map((url, i) => (
                    <MediaThumbnail key={i} url={url} onClick={() => openPreview(i)} />
                  ))}
                </div>
              ) : (
                <div className="h-40 rounded-xl border-2 border-dashed border-border flex items-center justify-center text-muted-foreground text-sm">
                  No media attached
                </div>
              )
            ) : (
              renderPlatformPreview(activePlatform)
            )}
          </div>
        </div>

        </div>

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
            ) : isDocumentUrl(post.media_urls[activeIndex]) ? (
              (() => {
                const previewUrl = getDocumentPreviewUrl(post.media_urls[activeIndex])
                return previewUrl ? (
                  <iframe src={previewUrl} title="Document preview" className="w-[85vw] h-[85vh] rounded-xl border-0" />
                ) : (
                  <div className="flex flex-col items-center justify-center gap-4 text-white/70 p-12">
                    <FileText className="size-16 opacity-40" />
                    <p className="text-sm opacity-60">Preview not available</p>
                    <a href={post.media_urls[activeIndex]} target="_blank" rel="noopener noreferrer" className="text-sm underline">Open file</a>
                  </div>
                )
              })()
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
  const isDoc = isDocumentUrl(url)
  return (
    <div
      onClick={onClick}
      className="group relative rounded-xl overflow-hidden bg-muted cursor-pointer border border-border/50 hover:border-border transition-all"
      style={{ aspectRatio: '1 / 1' }}
    >
      {video ? (
        <>
          <video src={url} muted playsInline className="w-full h-full object-cover" />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="p-1.5 bg-black/50 backdrop-blur-sm rounded-full border border-white/20 text-white">
              <Play className="h-4 w-4 fill-white" />
            </div>
          </div>
        </>
      ) : isDoc ? (
        <div className="flex flex-col items-center justify-center h-full gap-1.5 bg-muted/60 p-2">
          <FileText className="h-7 w-7 text-muted-foreground shrink-0" />
          <p className="text-[10px] font-medium text-muted-foreground uppercase">{getDocumentExtension(url)}</p>
        </div>
      ) : (
        <img src={url} alt="" className="w-full h-full object-cover transition duration-300 group-hover:brightness-75" />
      )}
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <div className="p-2.5 bg-black/30 backdrop-blur-sm rounded-full border border-white/20 text-white">
          <Eye size={18} />
        </div>
      </div>
    </div>
  )
}
