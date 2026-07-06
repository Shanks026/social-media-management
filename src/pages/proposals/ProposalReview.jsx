import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { format } from 'date-fns'
import { CheckCircle2, XCircle, RefreshCw, Loader2, Clock, ExternalLink, Download } from 'lucide-react'
import { toast } from 'sonner'

import {
  fetchProposalByToken,
  markProposalViewed,
  acceptProposal,
  declineProposal,
  requestProposalChanges,
} from '@/api/proposals'
import PublicNotFound from '@/pages/PublicNotFound'
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
  const [pageState, setPageState] = useState('loading') // loading | invalid | expired | accepted | declined | changes_requested | active
  const [actionState, setActionState] = useState(null) // null | 'accepted' | 'declined' | 'changes_requested'

  const [acceptDialogOpen, setAcceptDialogOpen] = useState(false)
  const [declineDialogOpen, setDeclineDialogOpen] = useState(false)
  const [declineReason, setDeclineReason] = useState('')
  const [changesDialogOpen, setChangesDialogOpen] = useState(false)
  const [changesNotes, setChangesNotes] = useState('')
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
        } else if (status === 'changes_requested') {
          setPageState('changes_requested')
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

  // ── Request Changes ──
  async function handleRequestChanges() {
    setIsSubmitting(true)
    try {
      await requestProposalChanges(token, changesNotes.trim() || null)
      setActionState('changes_requested')
      setChangesDialogOpen(false)
      setChangesNotes('')
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
        <div className="max-w-5xl mx-auto px-6 lg:px-16 py-12 space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-[600px] w-full rounded-xl" />
        </div>
      </div>
    )
  }

  // ── Invalid token ──
  if (pageState === 'invalid') {
    return <PublicNotFound />
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

  // ── Changes requested ──
  if (pageState === 'changes_requested') {
    const agencyName = proposal?.agency_name || 'the agency'
    return (
      <div className="min-h-screen w-full">
        <BrandingHeader data={proposal} />
        <CentredState
          icon={<RefreshCw className="size-12 text-orange-500" />}
          title="Changes Requested"
          description={`You've requested changes to this proposal. ${agencyName} will follow up with an updated version soon.`}
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

  const fileUrl = proposal.proposal_type === 'uploaded' ? proposal.file_url : null
  const showAgencyBranding = proposal.branding_agency_sidebar ?? false

  return (
    <div className="min-h-screen w-full">
      <div className="max-w-5xl mx-auto px-6 lg:px-16 py-10 space-y-8">

        {/* ── Logo ── */}
        <div className="flex items-center justify-between gap-4">
          {/* Left: agency logo (Velocity/Quantum) or Tercero (Ignite) */}
          {showAgencyBranding ? (
            proposal.logo_horizontal_url ? (
              <img
                src={proposal.logo_horizontal_url}
                alt={proposal.agency_name}
                className="h-10 w-auto object-contain"
                onError={(e) => (e.target.style.display = 'none')}
              />
            ) : proposal.logo_url ? (
              <img
                src={proposal.logo_url}
                alt={proposal.agency_name}
                className="h-10 w-10 object-contain rounded-md"
                onError={(e) => (e.target.style.display = 'none')}
              />
            ) : (
              <span className="text-lg font-semibold text-foreground">{proposal.agency_name}</span>
            )
          ) : (
            <div
              className="h-6 w-24 bg-foreground"
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

          {/* Right: Tercero logo for Velocity (agency + Tercero co-brand) */}
          {showAgencyBranding && showPoweredBy && (
            <div
              className="h-5 w-28 bg-foreground"
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

        {/* ── Title ── */}
        <h1 className="text-3xl font-bold tracking-tight bricolage leading-tight">
          {proposal.title}
        </h1>

        {/* ── Action bar ── */}
        {actionState === 'accepted' ? (
          <div className="flex items-start gap-4 rounded-2xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 px-6 py-5 animate-in fade-in zoom-in-95 duration-300">
            <CheckCircle2 className="size-6 text-green-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-green-800 dark:text-green-200">Proposal Accepted</p>
              <p className="text-sm text-green-700 dark:text-green-300 mt-0.5">
                {recipientName ? `Thank you, ${recipientName}. ` : 'Thank you. '}
                {agencyName} will be in touch shortly.
              </p>
            </div>
          </div>
        ) : actionState === 'declined' ? (
          <div className="flex items-start gap-4 rounded-2xl bg-muted/40 border border-border px-6 py-5 animate-in fade-in zoom-in-95 duration-300">
            <XCircle className="size-6 text-muted-foreground/50 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-foreground">Proposal Declined</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                If you'd like to discuss further, please reach out to {agencyName} directly.
              </p>
            </div>
          </div>
        ) : actionState === 'changes_requested' ? (
          <div className="flex items-start gap-4 rounded-2xl bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900 px-6 py-5 animate-in fade-in zoom-in-95 duration-300">
            <RefreshCw className="size-6 text-orange-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-orange-800 dark:text-orange-200">Changes Requested</p>
              <p className="text-sm text-orange-700 dark:text-orange-300 mt-0.5">
                {agencyName} has been notified and will follow up with an updated version soon.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              By accepting, you confirm your agreement to the terms and scope outlined in this proposal.
            </p>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setAcceptDialogOpen(true)}>
                  <CheckCircle2 className="size-3.5 text-emerald-500" />
                  Accept Proposal
                </Button>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setChangesDialogOpen(true)}>
                  <RefreshCw className="size-3.5 text-orange-500" />
                  Request Changes
                </Button>
              </div>
              <div className="flex items-center gap-2">
                {fileUrl && (
                  <>
                    <a href={fileUrl} target="_blank" rel="noreferrer">
                      <Button variant="outline" size="sm" className="gap-1.5">
                        <ExternalLink className="size-3.5" />
                        Open
                      </Button>
                    </a>
                    <a href={fileUrl} download>
                      <Button variant="outline" size="sm" className="gap-1.5">
                        <Download className="size-3.5" />
                        Download
                      </Button>
                    </a>
                  </>
                )}
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setDeclineDialogOpen(true)}>
                  Decline
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ── Proposal document ── */}
        {fileUrl ? (
          <iframe
            src={fileUrl}
            className="w-full rounded-xl border border-border/50"
            style={{ minHeight: '80vh' }}
            title="Proposal PDF"
          />
        ) : (
          <ProposalPreview proposal={previewProposal} agency={agencyForPreview} />
        )}
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

      {/* ── Request Changes dialog ── */}
      <Dialog open={changesDialogOpen} onOpenChange={setChangesDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Request changes to this proposal?</DialogTitle>
            <DialogDescription>
              Let {agencyName} know what you'd like adjusted. They'll update the proposal and
              send you a revised version.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Textarea
              placeholder="What would you like changed? (optional)…"
              value={changesNotes}
              onChange={(e) => setChangesNotes(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setChangesDialogOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRequestChanges}
              disabled={isSubmitting}
              className="gap-2 bg-orange-600 hover:bg-orange-700 text-white"
            >
              {isSubmitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              {isSubmitting ? 'Sending…' : 'Request Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
