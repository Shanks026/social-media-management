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
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel'
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
} from 'lucide-react'
import { format } from 'date-fns'
import { Badge } from '@/components/ui/badge'

export default function PublicReview() {
  const { token } = useParams()
  const [post, setPost] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [statusUpdated, setStatusUpdated] = useState(null)

  // Full-screen Preview States
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    async function fetchPost() {
      const { data, error } = await supabase.rpc('get_post_by_token', {
        p_token: token,
      })
      if (data && data.length > 0) setPost(data[0])
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
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isPreviewOpen, activeIndex, post?.media_urls])

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

  if (loading)
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )

  if (!post || statusUpdated) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-background p-6 text-center">
        <div className="mb-6 rounded-full bg-primary/10 p-4 text-primary transition-all animate-in zoom-in duration-300">
          <Check size={40} />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          {statusUpdated === 'SCHEDULED'
            ? 'Content Approved'
            : 'Review Submitted'}
        </h2>
        <p className="mt-2 max-w-md text-muted-foreground leading-relaxed">
          {statusUpdated === 'SCHEDULED'
            ? `Successfully scheduled for ${post.target_date ? format(new Date(post.target_date), 'PPP') : 'publication'}.`
            : 'We’ve received your feedback and will prepare a new version shortly.'}
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-screen w-full bg-background font-sans text-foreground">
      <div className="mx-auto max-w-7xl p-6 lg:p-16">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">
          {/* LEFT SECTION: CONTENT & ACTIONS */}
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
                  <span>
                    Created {format(new Date(post.created_at), 'MMM dd, yyyy')}
                  </span>
                </div>
                {post.target_date && (
                  <div className="flex items-center gap-2 font-semibold text-primary">
                    <Clock size={14} />
                    <span>
                      Schedule:{' '}
                      {format(new Date(post.target_date), 'MMM dd @ p')}
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-muted-foreground/60">
                  Caption
                </h3>
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
                  Approval will lock this version and notify the team to
                  schedule for publication.
                </p>
              </div>
            </div>

            {/* ACTION BUTTONS */}
            <div className="flex flex-col sm:flex-row items-center gap-4 pt-4">
              <Dialog>
                <DialogTrigger asChild>
                  <Button
                 
                    className="w-full sm:w-auto"
                  >
                    <Check className="mr-2 h-6 w-6" /> Approve Content
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Confirm Approval</DialogTitle>
                    <DialogDescription className="pt-2">
                      This will finalize the content for the listed platforms.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter className="mt-4">
                    <Button
                      className="w-full sm:w-auto"
                      onClick={() => handleStatusUpdate('APPROVED')}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? 'Processing...' : 'Yes, Ready to Post'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Dialog>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                 
                    className="w-full sm:w-auto"
                  >
                    <PencilLine className="mr-2 h-5 w-5" /> Request Revisions
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Revision Details</DialogTitle>
                    <DialogDescription>
                      What would you like to change?
                    </DialogDescription>
                  </DialogHeader>
                  <div className="py-4">
                    <Textarea
                      placeholder="e.g., Use a different image, fix the typo in line 2..."
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      className="min-h-[150px] bg-muted/30"
                    />
                  </div>
                  <DialogFooter>
                    <Button
                      variant="destructive"
                      className="w-full sm:w-auto"
                      disabled={!feedback || isSubmitting}
                      onClick={() => handleStatusUpdate('NEEDS_REVISION')}
                    >
                      {isSubmitting ? 'Sending...' : 'Submit Request'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {/* MOBILE ONLY: ACTUAL DIMENSION CAROUSEL */}
            <div className="block lg:hidden pt-12 space-y-6">
              <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground/60 text-center">
                Media Assets ({post.media_urls.length})
              </h3>
              <Carousel className="w-full">
                <CarouselContent>
                  {post.media_urls.map((url, i) => (
                    <CarouselItem key={i}>
                      <div className="flex justify-center bg-muted/20 rounded-2xl overflow-hidden border border-border/40">
                        <img
                          src={url}
                          alt=""
                          className="max-w-full h-auto object-contain shadow-sm cursor-pointer"
                          onClick={() => openPreview(i)}
                        />
                      </div>
                    </CarouselItem>
                  ))}
                </CarouselContent>
                <div className="flex justify-center gap-6 mt-8">
                  <CarouselPrevious className="static translate-y-0 h-12 w-12" />
                  <CarouselNext className="static translate-y-0 h-12 w-12" />
                </div>
              </Carousel>
            </div>
          </div>

          {/* DESKTOP ONLY: 2-COLUMN MEDIA GRID */}
          <div className="hidden lg:block lg:col-span-5 border-l border-border/50 pl-12 order-2">
            <div className="sticky top-12 space-y-8">
              <h3 className="text-sm font-semibold text-muted-foreground/60">
                Media Assets
              </h3>
              <div className="grid grid-cols-2 gap-4 max-h-[85vh] overflow-y-auto pr-4 scrollbar-hide">
                {post.media_urls.map((url, i) => (
                  <div
                    key={i}
                    onClick={() => openPreview(i)}
                    className="group relative aspect-square rounded-2xl overflow-hidden bg-muted cursor-pointer transition-transform hover:scale-[1.02] border border-border/50"
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

                {post.media_urls.length === 0 && (
                  <div className="col-span-2 h-64 rounded-2xl border-2 border-dashed border-border flex items-center justify-center text-muted-foreground italic">
                    No media attached
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* FULL-SCREEN PREVIEW DIALOG (Shared with PostContent approach) */}
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
    </div>
  )
}
