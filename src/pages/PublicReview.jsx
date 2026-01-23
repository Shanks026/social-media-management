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
import { Loader2, Info, Check, PencilLine, ArrowRight } from 'lucide-react'
import { format } from 'date-fns'

export default function PublicReview() {
  const { token } = useParams()
  const [post, setPost] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [statusUpdated, setStatusUpdated] = useState(null)

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

  const handleStatusUpdate = async (newStatus) => {
    setIsSubmitting(true)
    const { error } = await supabase.rpc('update_post_status_by_token', {
      p_token: token,
      p_status: newStatus,
      p_feedback: feedback,
    })

    if (!error) {
      setStatusUpdated(newStatus)
    } else {
      alert('Something went wrong. Please try again.')
    }
    setIsSubmitting(false)
  }

  // --- LOADING STATE ---
  if (loading)
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )

  // --- SUCCESS / EXPIRED STATE ---
  if (!post || statusUpdated) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-background p-6 text-center">
        <div className="mb-6 rounded-full bg-primary/10 p-4 text-primary transition-all animate-in zoom-in duration-300">
          <Check size={40} />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          {statusUpdated === 'APPROVED'
            ? 'Content Approved'
            : 'Review Submitted'}
        </h2>
        <p className="mt-2 max-w-md text-muted-foreground leading-relaxed">
          {statusUpdated === 'APPROVED'
            ? 'Success! Our team has been notified. We will proceed with scheduling this post for publication immediately.'
            : 'We’ve received your feedback. The team will review your suggestions and notify you via email once the revised version is ready.'}
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-screen w-full bg-background font-sans text-foreground transition-colors duration-300">
      <div className="mx-auto max-w-6xl p-6 lg:p-16">
        <div className="grid grid-cols-1 gap-16 lg:grid-cols-2">
          {/* LEFT SIDE: CONTENT & ACTIONS */}
          <div className="max-w-xl space-y-8">
            {/* Header / Meta */}
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                {post.platform.map((p) => (
                  <PlatformBadge key={p} platform={p} />
                ))}
                <span className="rounded bg-secondary px-2.5 py-1 text-[10px] font-bold tracking-wider text-secondary-foreground uppercase">
                  Version {post.version_number}.0
                </span>
              </div>

              <div className="space-y-3">
                <h1 className="text-3xl font-extrabold tracking-tight lg:text-4xl text-foreground">
                  {post.title}
                </h1>
                <p className="text-sm font-medium text-muted-foreground">
                  Created for {post.client_name} •{' '}
                  {format(new Date(post.created_at), 'MMMM dd, yyyy')}
                </p>
              </div>

              <p className="text-base leading-relaxed text-muted-foreground/90 whitespace-pre-wrap">
                {post.content}
              </p>
            </div>

            {/* Media Gallery */}
            <div className="flex flex-wrap gap-4">
              {post.media_urls.map((url, i) => (
                <div
                  key={i}
                  className="group relative h-40 w-40 overflow-hidden rounded-xl bg-muted border border-border"
                >
                  <img
                    src={url}
                    alt="Post visual content"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                </div>
              ))}
            </div>

            {/* Information Alert */}
            <div className="flex items-start gap-4 rounded-xl bg-secondary/30 p-5 text-sm border border-border/60">
              <Info size={18} className="mt-0.5 text-primary shrink-0" />
              <div className="space-y-1">
                <p className="font-bold text-foreground">Final Review Notice</p>
                <p className="text-muted-foreground leading-snug">
                  Approving this version will lock the content and media. You
                  will receive a confirmation once the post is scheduled for
                  publication.
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-4 pt-2">
              {/* --- APPROVE DIALOG --- */}
              <Dialog>
                <DialogTrigger asChild>
                  <Button>
                    <Check className="mr-2 h-4 w-4" /> Approve Content
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Ready to go live?</DialogTitle>
                    <DialogDescription className="pt-2 text-muted-foreground">
                      Confirming will finalize this content version.
                      <div className="mt-4 flex flex-col gap-2 rounded-xl bg-card/50 p-4 text-xs text-foreground">
                        <div className="flex items-center gap-3">
                          <ArrowRight size={12} className="text-primary" />
                          <span>
                            Status updates to{' '}
                            <span className="font-bold">Approved</span>
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <ArrowRight size={12} className="text-primary" />
                          <span>Admin is notified for scheduling</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <ArrowRight size={12} className="text-primary" />
                          <span>Content is locked from further edits</span>
                        </div>
                      </div>
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter className="mt-2">
                    <Button
                      onClick={() => handleStatusUpdate('APPROVED')}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? 'Finalizing...' : 'Yes, Approve Content'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* --- REVISION DIALOG --- */}
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <PencilLine className="mr-2 h-4 w-4" /> Send for Revision
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Request Revisions</DialogTitle>
                    <DialogDescription className="pt-2">
                      Please let us know exactly what needs to be changed.
                      <div className="mt-6 text-xs text-muted-foreground bg-secondary/40 p-3 rounded-lg border border-border/50 italic">
                        The current version will be archived. Our team will
                        prepare
                        <span className="font-bold text-foreground">
                          {' '}
                          Version {post.version_number + 1}.0{' '}
                        </span>
                        and send it back for your final approval.
                      </div>
                    </DialogDescription>
                  </DialogHeader>
                  <div className="py-4">
                    <Textarea
                      placeholder="e.g., Please change the call to action or use a different cover image..."
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      className="min-h-[140px] rounded-xl border-border bg-muted/30 focus:bg-background transition-all"
                    />
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
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
          </div>

          {/* RIGHT SIDE: PREVIEW PLACEHOLDER */}
          <div className="hidden lg:block border-l border-border/50 pl-16">
            <div className="h-full w-full rounded-[2rem] border-2 border-dashed border-border flex items-center justify-center text-muted-foreground/40 font-semibold tracking-tighter text-sm italic">
              Social Media Preview In Development
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
