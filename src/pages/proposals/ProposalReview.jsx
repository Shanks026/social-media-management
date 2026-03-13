import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { format } from 'date-fns'
import { CheckCircle2, XCircle, Loader2, AlertTriangle, Clock } from 'lucide-react'
import { toast } from 'sonner'

import {
  fetchProposalByToken,
  markProposalViewed,
  acceptProposal,
  declineProposal,
} from '@/api/proposals'
import ProposalPreview from '@/components/proposals/ProposalPreview'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

// ── Branding Header ───────────────────────────────────────────────────────────

function BrandingHeader({ data }) {
  const showAgencyBranding = data?.branding_agency_sidebar ?? false

  return (
    <div className="sticky top-0 z-10 flex items-center gap-4 px-6 py-4 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {showAgencyBranding ? (
        data?.logo_horizontal_url ? (
          <img
            src={data.logo_horizontal_url}
            alt={data.agency_name}
            style={{ height: '32px', width: 'auto', objectFit: 'contain' }}
            onError={(e) => (e.target.style.display = 'none')}
          />
        ) : data?.logo_url ? (
          <img
            src={data.logo_url}
            alt={data.agency_name}
            style={{ height: '28px', width: '28px', objectFit: 'contain' }}
            className="rounded"
            onError={(e) => (e.target.style.display = 'none')}
          />
        ) : data?.agency_name ? (
          <span className="text-sm font-semibold text-foreground">{data.agency_name}</span>
        ) : null
      ) : (
        <div
          className="h-6 w-20 bg-foreground"
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

      {data?.title && (
        <>
          <div className="h-5 w-px bg-border shrink-0" />
          <span className="text-sm text-muted-foreground truncate">{data.title}</span>
        </>
      )}
    </div>
  )
}

// ── Powered By Footer ─────────────────────────────────────────────────────────

function PoweredByFooter({ show }) {
  if (!show) return null
  return (
    <div className="text-center py-8 text-xs text-muted-foreground/50">
      Powered by{' '}
      <span className="font-medium">Tercero</span>
    </div>
  )
}

// ── Centred state layouts ─────────────────────────────────────────────────────

function CentredState({ icon, title, description, children }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 py-20 text-center">
      {icon && <div className="mb-4">{icon}</div>}
      <h2 className="text-xl font-semibold text-foreground mb-2">{title}</h2>
      {description && (
        <p className="text-sm text-muted-foreground max-w-md leading-relaxed">{description}</p>
      )}
      {children}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ProposalReview() {
  const { token } = useParams()

  const [proposal, setProposal] = useState(null)
  const [loading, setLoading] = useState(true)
  const [pageState, setPageState] = useState('loading') // loading | invalid | expired | accepted | declined | active
  const [actionState, setActionState] = useState(null) // null | 'accepted' | 'declined'

  const [acceptDialogOpen, setAcceptDialogOpen] = useState(false)
  const [declineDialogOpen, setDeclineDialogOpen] = useState(false)
  const [declineReason, setDeclineReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const viewedRef = useRef(false)

  // ── Fetch on mount ──
  useEffect(() => {
    async function load() {
      try {
        const data = await fetchProposalByToken(token)

        if (!data) {
          setPageState('invalid')
          return
        }

        setProposal(data)

        const status = data.status
        if (status === 'expired') {
          setPageState('expired')
        } else if (status === 'accepted') {
          setPageState('accepted')
        } else if (status === 'declined') {
          setPageState('declined')
        } else {
          setPageState('active')
        }
      } catch {
        setPageState('invalid')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [token])

  // ── Mark viewed once when status is 'sent' ──
  useEffect(() => {
    if (pageState === 'active' && proposal?.status === 'sent' && !viewedRef.current) {
      viewedRef.current = true
      markProposalViewed(token).catch(() => {
        // Non-fatal — don't show error to user
      })
    }
  }, [pageState, proposal?.status, token])

  // ── Accept ──
  async function handleAccept() {
    setIsSubmitting(true)
    try {
      await acceptProposal(token)
      setActionState('accepted')
      setAcceptDialogOpen(false)
    } catch (err) {
      toast.error(err.message || 'Something went wrong. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Decline ──
  async function handleDecline() {
    setIsSubmitting(true)
    try {
      await declineProposal(token, declineReason.trim() || null)
      setActionState('declined')
      setDeclineDialogOpen(false)
      setDeclineReason('')
    } catch (err) {
      toast.error(err.message || 'Something went wrong. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const showPoweredBy = proposal?.branding_powered_by ?? true

  // ── Loading skeleton ──
  if (loading || pageState === 'loading') {
    return (
      <div className="min-h-screen w-full">
        <div className="sticky top-0 z-10 px-6 py-4 border-b border-border bg-background/95">
          <Skeleton className="h-6 w-28" />
        </div>
        <div className="max-w-3xl mx-auto px-4 py-12 space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-[600px] w-full rounded-xl" />
        </div>
      </div>
    )
  }

  // ── Invalid token ──
  if (pageState === 'invalid') {
    return (
      <div className="min-h-screen w-full">
        <BrandingHeader data={null} />
        <CentredState
          icon={<AlertTriangle className="size-12 text-muted-foreground/40" />}
          title="Invalid Link"
          description="This proposal link is invalid or has expired. Please contact the agency for a new link."
        />
        <PoweredByFooter show />
      </div>
    )
  }

  // ── Expired ──
  if (pageState === 'expired') {
    const agencyName = proposal?.agency_name || 'the agency'
    const validUntil = proposal?.valid_until
      ? format(new Date(proposal.valid_until), 'MMM d, yyyy')
      : null

    return (
      <div className="min-h-screen w-full">
        <BrandingHeader data={proposal} />
        <CentredState
          icon={<Clock className="size-12 text-amber-400" />}
          title="Proposal Expired"
          description={
            validUntil
              ? `This proposal expired on ${validUntil}. Please contact ${agencyName} for an updated proposal.`
              : `This proposal is no longer valid. Please contact ${agencyName} for an updated proposal.`
          }
        />
        <PoweredByFooter show={showPoweredBy} />
      </div>
    )
  }

  // ── Already accepted ──
  if (pageState === 'accepted') {
    const agencyName = proposal?.agency_name || 'the agency'
    return (
      <div className="min-h-screen w-full">
        <BrandingHeader data={proposal} />
        <CentredState
          icon={<CheckCircle2 className="size-12 text-green-500" />}
          title="Proposal Accepted"
          description={`You've already accepted this proposal. ${agencyName} will be in touch shortly.`}
        />
        <PoweredByFooter show={showPoweredBy} />
      </div>
    )
  }

  // ── Already declined ──
  if (pageState === 'declined') {
    return (
      <div className="min-h-screen w-full">
        <BrandingHeader data={proposal} />
        <CentredState
          icon={<XCircle className="size-12 text-muted-foreground/40" />}
          title="Proposal Declined"
          description="You've declined this proposal. If you'd like to revisit it, please reach out to the agency directly."
        />
        <PoweredByFooter show={showPoweredBy} />
      </div>
    )
  }

  // ── Active proposal ──
  // Build data shapes expected by ProposalPreview
  const previewProposal = {
    title: proposal.title,
    client_name: proposal.client_name || null,
    prospect_name: proposal.prospect_name || null,
    valid_until: proposal.valid_until || null,
    introduction: proposal.introduction || null,
    scope_notes: proposal.scope_notes || null,
    payment_terms: proposal.payment_terms || null,
    contract_duration: proposal.contract_duration || null,
    notes: proposal.notes || null,
    line_items: Array.isArray(proposal.line_items) ? proposal.line_items : [],
  }

  const agencyForPreview = {
    agency_name: proposal.agency_name || '',
    logo_url: proposal.logo_url || null,
    logo_horizontal_url: proposal.logo_horizontal_url || null,
    branding_agency_sidebar: proposal.branding_agency_sidebar ?? false,
  }

  const recipientName =
    proposal.client_name || proposal.prospect_name || null
  const agencyName = proposal.agency_name || 'the agency'

  return (
    <div className="min-h-screen w-full">
      <BrandingHeader data={proposal} />

      <div className="max-w-3xl mx-auto px-4 py-10">
        {/* ── Proposal document ── */}
        {proposal.proposal_type === 'uploaded' && proposal.file_url ? (
          <div className="space-y-2">
            <iframe
              src={proposal.file_url}
              className="w-full rounded-xl border border-border/50"
              style={{ minHeight: '75vh' }}
              title="Proposal PDF"
            />
            <p className="text-center text-xs text-muted-foreground">
              Can&apos;t see the PDF?{' '}
              <a
                href={proposal.file_url}
                download
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2 hover:text-foreground"
              >
                Download it
              </a>
            </p>
          </div>
        ) : (
          <ProposalPreview proposal={previewProposal} agency={agencyForPreview} />
        )}

        {/* ── Action area ── */}
        <div className="mt-8 mb-4">
          {actionState === 'accepted' ? (
            /* Post-accept success */
            <div className="flex flex-col items-center gap-3 py-8 px-6 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 rounded-2xl text-center animate-in fade-in zoom-in-95 duration-300">
              <CheckCircle2 className="size-10 text-green-500" />
              <h3 className="text-lg font-semibold text-green-800 dark:text-green-200">
                Proposal Accepted!
              </h3>
              <p className="text-sm text-green-700 dark:text-green-300 max-w-sm">
                {recipientName
                  ? `Thank you, ${recipientName}. `
                  : 'Thank you. '}
                {agencyName} will be in touch shortly.
              </p>
            </div>
          ) : actionState === 'declined' ? (
            /* Post-decline confirmation */
            <div className="flex flex-col items-center gap-3 py-8 px-6 bg-muted/40 border border-border rounded-2xl text-center animate-in fade-in zoom-in-95 duration-300">
              <XCircle className="size-10 text-muted-foreground/50" />
              <h3 className="text-lg font-semibold text-foreground">Proposal Declined</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                You've declined this proposal. If you'd like to discuss further, please reach
                out to {agencyName} directly.
              </p>
            </div>
          ) : (
            /* Action buttons */
            <div className="flex flex-col items-center gap-4 py-8">
              <p className="text-xs text-muted-foreground text-center max-w-sm">
                By accepting, you confirm your agreement to the terms and scope outlined in
                this proposal.
              </p>
              <div className="flex items-center gap-3">
                <Button
                  size="lg"
                  className="gap-2 bg-green-600 hover:bg-green-700 text-white px-8"
                  onClick={() => setAcceptDialogOpen(true)}
                >
                  <CheckCircle2 className="size-4" />
                  Accept Proposal
                </Button>
                <Button
                  size="lg"
                  variant="ghost"
                  className="gap-2 text-muted-foreground"
                  onClick={() => setDeclineDialogOpen(true)}
                >
                  Decline
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <PoweredByFooter show={showPoweredBy} />

      {/* ── Accept confirmation dialog ── */}
      <Dialog open={acceptDialogOpen} onOpenChange={setAcceptDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Accept this proposal?</DialogTitle>
            <DialogDescription>
              By accepting, you agree to the terms, scope, and pricing outlined in this
              proposal. {agencyName} will be notified immediately.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAcceptDialogOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAccept}
              disabled={isSubmitting}
              className="gap-2 bg-green-600 hover:bg-green-700 text-white"
            >
              {isSubmitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <CheckCircle2 className="size-4" />
              )}
              {isSubmitting ? 'Confirming…' : 'Yes, Accept Proposal'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Decline dialog ── */}
      <Dialog open={declineDialogOpen} onOpenChange={setDeclineDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Decline this proposal?</DialogTitle>
            <DialogDescription>
              Optionally let {agencyName} know why you're declining. This helps them improve
              future proposals.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Textarea
              placeholder="Reason for declining (optional)…"
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeclineDialogOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDecline}
              disabled={isSubmitting}
              className="gap-2"
            >
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              {isSubmitting ? 'Declining…' : 'Decline Proposal'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
