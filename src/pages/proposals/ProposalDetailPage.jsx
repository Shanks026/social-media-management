import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import {
  Link2,
  FileDown,
  Archive,
  Trash2,
  CalendarIcon,
  Plus,
  Lock,
  Check,
  Eye,
  ChevronLeft,
  Loader2,
  AlertCircle,
  Clock,
  ThumbsUp,
  ThumbsDown,
  Upload,
  FileText,
  Download,
  Send,
  Mail,
} from 'lucide-react'
import { toast } from 'sonner'
import { useForm, useFieldArray, Controller } from 'react-hook-form'

import { useHeader } from '@/components/misc/header-context'
import { useSubscription } from '@/api/useSubscription'
import { useClients } from '@/api/clients'
import {
  useProposal,
  useUpdateProposal,
  useDeleteProposal,
  useGenerateProposalToken,
  useMarkProposalSent,
  uploadProposalFile,
  deleteProposalFile,
} from '@/api/proposals'
import { resolveWorkspace } from '@/lib/workspace'
import ProposalPreview from '@/components/proposals/ProposalPreview'
import { SendProposalEmailDialog } from '@/components/proposals/SendProposalEmailDialog'
import { downloadProposalPDF } from '@/utils/downloadProposalPDF.jsx'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { formatCurrency } from '@/utils/finance'
import { formatDate } from '@/lib/helper'
import { cn } from '@/lib/utils'

// ── Constants ─────────────────────────────────────────────────────────────────

const PAYMENT_TERMS = ['Due on Receipt', 'Net 15', 'Net 30', 'Net 60']
const EMPTY_LINE_ITEM = { description: '', amount: '' }

const STATUS_CONFIG = {
  draft: { label: 'Draft', className: 'bg-muted text-muted-foreground border-transparent' },
  sent: {
    label: 'Sent',
    className: 'bg-blue-100 text-blue-700 border-transparent dark:bg-blue-950 dark:text-blue-300',
  },
  viewed: {
    label: 'Viewed',
    className:
      'bg-violet-100 text-violet-700 border-transparent dark:bg-violet-950 dark:text-violet-300',
  },
  accepted: {
    label: 'Accepted',
    className:
      'bg-green-100 text-green-700 border-transparent dark:bg-green-950 dark:text-green-300',
  },
  declined: {
    label: 'Declined',
    className: 'bg-red-100 text-red-700 border-transparent dark:bg-red-950 dark:text-red-300',
  },
  expired: {
    label: 'Expired',
    className:
      'bg-amber-100 text-amber-700 border-transparent dark:bg-amber-950 dark:text-amber-300',
  },
  archived: {
    label: 'Archived',
    className:
      'bg-slate-100 text-slate-500 border-transparent dark:bg-slate-800 dark:text-slate-400',
  },
}

// ── Status Timeline ────────────────────────────────────────────────────────────

function StatusTimeline({ proposal }) {
  const steps = [
    { key: 'created', label: 'Created', date: proposal.created_at, icon: Clock, done: true },
    {
      key: 'sent',
      label: 'Sent',
      date: proposal.sent_at,
      icon: Link2,
      done: !!proposal.sent_at,
    },
    {
      key: 'viewed',
      label: 'Viewed',
      date: proposal.first_viewed_at,
      icon: Eye,
      done: !!proposal.first_viewed_at,
    },
    ...(proposal.status === 'accepted'
      ? [
          {
            key: 'accepted',
            label: 'Accepted',
            date: proposal.accepted_at,
            icon: ThumbsUp,
            done: !!proposal.accepted_at,
            variant: 'success',
          },
        ]
      : []),
    ...(proposal.status === 'declined'
      ? [
          {
            key: 'declined',
            label: 'Declined',
            date: proposal.declined_at,
            icon: ThumbsDown,
            done: !!proposal.declined_at,
            variant: 'danger',
          },
        ]
      : []),
  ]

  const visibleSteps = steps.filter((s) => s.done)
  if (visibleSteps.length <= 1) return null

  return (
    <div className="flex items-center flex-wrap gap-1 mt-3">
      {visibleSteps.map((step, i) => (
        <div key={step.key} className="flex items-center">
          <div
            className={cn(
              'flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full',
              step.variant === 'success'
                ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300'
                : step.variant === 'danger'
                  ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
                  : 'bg-muted/60 text-muted-foreground',
            )}
          >
            <step.icon className="size-3 shrink-0" />
            <span className="font-medium">{step.label}</span>
            {step.date && <span className="opacity-70">{formatDate(step.date)}</span>}
          </div>
          {i < visibleSteps.length - 1 && <div className="w-5 h-px bg-border/60 mx-1" />}
        </div>
      ))}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ProposalDetailPage() {
  const { proposalId } = useParams()
  const navigate = useNavigate()
  const { setHeader } = useHeader()

  const { data: sub } = useSubscription()
  const { data: clientsData } = useClients()
  const { data: proposal, isLoading, error } = useProposal(proposalId)

  const updateProposal = useUpdateProposal()
  const deleteProposal = useDeleteProposal()
  const generateToken = useGenerateProposalToken()
  const markSent = useMarkProposalSent()

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false)
  const [emailDialogOpen, setEmailDialogOpen] = useState(false)
  const [isPdfExporting, setIsPdfExporting] = useState(false)
  const [saveState, setSaveState] = useState('idle') // 'idle' | 'saving' | 'saved' | 'error'
  const [isReplacing, setIsReplacing] = useState(false)
  const saveTimerRef = useRef(null)
  const autoSaveTimerRef = useRef(null)
  const replaceFileRef = useRef(null)

  const clients = useMemo(() => clientsData?.realClients ?? [], [clientsData])

  // Proposals accepted/declined are read-only; archived can still be edited if needed
  const isReadOnly = proposal && ['accepted', 'declined'].includes(proposal.status)
  const isEditable = proposal && !['accepted', 'declined'].includes(proposal.status)

  // ── Set page header ──
  useEffect(() => {
    setHeader({
      title: proposal?.title || 'Proposal',
      breadcrumbs: [{ label: 'Proposals' }, { label: proposal?.title || 'Proposal' }],
    })
  }, [setHeader, proposal?.title])

  // ── Form ──
  const form = useForm({
    defaultValues: {
      title: '',
      client_type: 'client',
      client_id: '',
      prospect_name: '',
      prospect_email: '',
      valid_until: null,
      total_value: '',
      introduction: '',
      scope_notes: '',
      payment_terms: '',
      contract_duration: '',
      notes: '',
      line_items: [{ ...EMPTY_LINE_ITEM }],
    },
  })

  const { watch, setValue, reset, control, register, getValues } = form
  const { fields, append, remove } = useFieldArray({ control, name: 'line_items' })

  const watchAll = watch()
  const clientType = watch('client_type')
  const watchedClientId = watch('client_id')
  const watchedLineItems = watch('line_items')

  // ── Pre-fill when proposal loads (only when ID changes, not on every re-render) ──
  useEffect(() => {
    if (proposal) {
      reset({
        title: proposal.title || '',
        client_type: proposal.client_id ? 'client' : 'prospect',
        client_id: proposal.client_id || '',
        prospect_name: proposal.prospect_name || '',
        prospect_email: proposal.prospect_email || '',
        valid_until: proposal.valid_until ? new Date(proposal.valid_until) : null,
        introduction: proposal.introduction || '',
        scope_notes: proposal.scope_notes || '',
        payment_terms: proposal.payment_terms || '',
        contract_duration: proposal.contract_duration || '',
        notes: proposal.notes || '',
        total_value: proposal.total_value ?? '',
        line_items:
          proposal.line_items?.length > 0
            ? proposal.line_items.map((li) => ({
                description: li.description,
                amount: li.amount,
              }))
            : [{ ...EMPTY_LINE_ITEM }],
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proposal?.id])

  // ── Agency branding for preview ──
  const agencyData = useMemo(
    () => ({
      agency_name: sub?.agency_name || '',
      logo_url: sub?.logo_url || null,
      logo_horizontal_url: sub?.logo_horizontal_url || null,
      branding_agency_sidebar: sub?.branding_agency_sidebar ?? false,
    }),
    [sub],
  )

  // ── Live preview data ──
  const selectedClient = useMemo(
    () => clients.find((c) => c.id === watchedClientId) || null,
    [clients, watchedClientId],
  )

  const previewData = useMemo(
    () => ({
      title: watchAll.title,
      client_name: clientType === 'client' ? selectedClient?.name || null : null,
      prospect_name: clientType === 'prospect' ? watchAll.prospect_name || null : null,
      valid_until: watchAll.valid_until ? format(watchAll.valid_until, 'yyyy-MM-dd') : null,
      introduction: watchAll.introduction,
      scope_notes: watchAll.scope_notes,
      payment_terms: watchAll.payment_terms,
      contract_duration: watchAll.contract_duration,
      notes: watchAll.notes,
      line_items: (watchedLineItems || [])
        .filter((li) => li.description || li.amount)
        .map((li) => ({ description: li.description, amount: parseFloat(li.amount) || 0 })),
    }),
    [watchAll, clientType, selectedClient, watchedLineItems],
  )

  const grandTotal = useMemo(
    () => (watchedLineItems || []).reduce((sum, li) => sum + (parseFloat(li.amount) || 0), 0),
    [watchedLineItems],
  )

  // ── Auto-save on blur (debounced — 300 ms) ──
  // Rapid field blurs (e.g. tabbing) are collapsed into a single save.
  const autoSave = useCallback(() => {
    if (!proposal || !isEditable) return
    clearTimeout(autoSaveTimerRef.current)
    autoSaveTimerRef.current = setTimeout(async () => {
      const values = getValues()
      setSaveState('saving')
      clearTimeout(saveTimerRef.current)
      try {
        await updateProposal.mutateAsync({
          id: proposalId,
          title: values.title || proposal.title,
          client_id: values.client_type === 'client' ? values.client_id || null : null,
          prospect_name:
            values.client_type === 'prospect' ? values.prospect_name || null : null,
          prospect_email:
            values.client_type === 'prospect' ? values.prospect_email || null : null,
          valid_until: values.valid_until
            ? format(values.valid_until, 'yyyy-MM-dd')
            : null,
          introduction: values.introduction || null,
          scope_notes: values.scope_notes || null,
          payment_terms: values.payment_terms || null,
          contract_duration: values.contract_duration || null,
          notes: values.notes || null,
          ...(proposal.proposal_type === 'uploaded'
            ? { total_value: values.total_value !== '' ? parseFloat(values.total_value) || null : null }
            : { line_items: (values.line_items || []).filter((li) => li.description?.trim()) }),
        })
        setSaveState('saved')
        saveTimerRef.current = setTimeout(() => setSaveState('idle'), 2000)
      } catch (err) {
        setSaveState('error')
        toast.error('Auto-save failed: ' + (err.message || 'Unknown error'))
      }
    }, 300)
  }, [proposal, isEditable, proposalId, getValues, updateProposal])

  // ── Copy Link ──
  async function handleCopyLink() {
    try {
      const result = await generateToken.mutateAsync(proposalId)
      await navigator.clipboard.writeText(result.url)
      toast.success('Link copied to clipboard')
    } catch (err) {
      toast.error(err.message || 'Failed to copy link')
    }
  }

  // ── Export PDF ──
  async function handleExportPDF() {
    if (!proposal) return
    setIsPdfExporting(true)
    try {
      const pdfProposal = {
        ...proposal,
        line_items: proposal.line_items || [],
      }
      await downloadProposalPDF(pdfProposal, agencyData)
    } catch (err) {
      toast.error(err.message || 'Failed to export PDF')
    } finally {
      setIsPdfExporting(false)
    }
  }

  // ── Replace file (uploaded proposals) ──
  async function handleReplaceFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.type !== 'application/pdf') { toast.error('Only PDF files are accepted'); return }
    if (file.size > 20 * 1024 * 1024) { toast.error('File must be 20 MB or smaller'); return }

    const oldFileUrl = proposal.file_url // capture before upload
    setIsReplacing(true)
    try {
      const { workspaceUserId } = await resolveWorkspace()
      const publicUrl = await uploadProposalFile(proposalId, workspaceUserId, file)
      await updateProposal.mutateAsync({ id: proposalId, file_url: publicUrl })
      // Delete old file from storage after the DB record is updated
      if (oldFileUrl) {
        await deleteProposalFile(oldFileUrl)
      }
      toast.success('File replaced')
    } catch (err) {
      toast.error(err.message || 'Failed to replace file')
    } finally {
      setIsReplacing(false)
      if (replaceFileRef.current) replaceFileRef.current.value = ''
    }
  }

  // ── Archive ──
  async function handleArchive() {
    try {
      await deleteProposal.mutateAsync({ id: proposalId, status: proposal.status })
      toast.success('Proposal archived')
      navigate('/proposals')
    } catch (err) {
      toast.error(err.message || 'Something went wrong')
    } finally {
      setArchiveDialogOpen(false)
    }
  }

  // ── Delete ──
  async function handleDelete() {
    try {
      await deleteProposal.mutateAsync({ id: proposalId, status: 'draft', file_url: proposal.file_url })
      toast.success('Proposal deleted')
      navigate('/proposals')
    } catch (err) {
      toast.error(err.message || 'Something went wrong')
    } finally {
      setDeleteDialogOpen(false)
    }
  }

  // ── Loading / error states ──
  if (isLoading) {
    return (
      <div className="px-8 pt-8 pb-20 max-w-[1400px] mx-auto space-y-4 animate-in fade-in duration-500">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-9 w-80" />
        <Skeleton className="h-px w-full" />
        <div className="flex gap-6">
          <Skeleton className="h-[560px] flex-1" />
          <Skeleton className="h-[560px] flex-1" />
        </div>
      </div>
    )
  }

  if (error || !proposal) {
    return (
      <div className="px-8 pt-8 max-w-[1400px] mx-auto">
        <p className="text-destructive text-sm">Proposal not found.</p>
        <Button
          variant="link"
          onClick={() => navigate('/proposals')}
          className="mt-2 px-0 text-sm"
        >
          ← Back to Proposals
        </Button>
      </div>
    )
  }

  const status = proposal.status
  const statusConfig = STATUS_CONFIG[status] ?? { label: status, className: '' }
  const displayName =
    clients.find((c) => c.id === proposal.client_id)?.name ||
    proposal.prospect_name ||
    null
  const isCopyingLink = generateToken.isPending || markSent.isPending

  // Default email for the send dialog — prospect email takes priority, then client email
  const defaultEmailRecipient = proposal?.prospect_email ||
    clients.find((c) => c.id === proposal?.client_id)?.email ||
    ''
  const defaultNameRecipient = proposal?.prospect_name ||
    clients.find((c) => c.id === proposal?.client_id)?.name ||
    ''

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden max-w-[1400px] mx-auto w-full">
      {/* ── Page header ── */}
      <div className="px-6 pt-5 pb-4 border-b border-border/50 shrink-0">
        {/* Back button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/proposals')}
          className="gap-1.5 text-muted-foreground h-7 px-2 -ml-2 mb-3"
        >
          <ChevronLeft className="size-4" />
          Proposals
        </Button>

        {/* Title row + action bar */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl font-medium tracking-tight text-foreground truncate">
                {proposal.title}
              </h1>
              <Badge
                variant="outline"
                className={cn('text-[11px] font-medium capitalize shrink-0', statusConfig.className)}
              >
                {statusConfig.label}
              </Badge>
              {displayName && (
                <span className="text-sm text-muted-foreground shrink-0">· {displayName}</span>
              )}
              {isReadOnly && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Lock className="size-3" />
                  Read-only
                </span>
              )}
            </div>
          </div>

          {/* Action bar */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Save state indicator */}
            {saveState === 'saving' && (
              <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Loader2 className="size-3 animate-spin" />
                Saving…
              </span>
            )}
            {saveState === 'saved' && (
              <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Check className="size-3 text-green-600" />
                Saved
              </span>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyLink}
              disabled={isCopyingLink}
              className="gap-2 h-8"
            >
              {isCopyingLink ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Link2 className="size-4" />
              )}
              {isCopyingLink ? 'Generating…' : 'Copy Link'}
            </Button>

            {status !== 'archived' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEmailDialogOpen(true)}
                className="gap-2 h-8"
              >
                <Mail className="size-4" />
                Send via Email
              </Button>
            )}

            {status === 'draft' && (
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    await markSent.mutateAsync(proposalId)
                    toast.success('Proposal marked as Sent')
                  } catch (err) {
                    toast.error(err.message || 'Something went wrong')
                  }
                }}
                disabled={markSent.isPending}
                className="gap-2 h-8"
              >
                {markSent.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
                Mark as Sent
              </Button>
            )}

            {proposal.proposal_type !== 'uploaded' && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportPDF}
                disabled={isPdfExporting}
                className="gap-2 h-8"
              >
                {isPdfExporting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <FileDown className="size-4" />
                )}
                {isPdfExporting ? 'Exporting…' : 'Export PDF'}
              </Button>
            )}

            {status !== 'archived' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setArchiveDialogOpen(true)}
                className="gap-2 h-8"
              >
                <Archive className="size-4" />
                Archive
              </Button>
            )}

            {status === 'draft' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDeleteDialogOpen(true)}
                className="gap-2 h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="size-4" />
                Delete
              </Button>
            )}
          </div>
        </div>

        {/* Status timeline */}
        <StatusTimeline proposal={proposal} />

        {/* Decline reason */}
        {status === 'declined' && proposal.decline_reason && (
          <div className="mt-3 flex items-start gap-2 text-sm bg-destructive/5 border border-destructive/20 rounded-lg px-4 py-3">
            <AlertCircle className="size-4 text-destructive shrink-0 mt-0.5" />
            <div>
              <span className="font-medium text-foreground">Decline reason: </span>
              <span className="text-muted-foreground">{proposal.decline_reason}</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Content — uploaded layout ── */}
      {proposal.proposal_type === 'uploaded' && (
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 custom-scrollbar">
          {/* Metadata row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Title</Label>
              <Input
                {...register('title')}
                disabled={isReadOnly}
                placeholder="Proposal title"
                className="bg-muted/20 border-border/40"
                onBlur={autoSave}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Client / Prospect</Label>
              {proposal?.prospect_id ? (
                <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/30 border border-border/40 text-sm">
                  <span className="text-foreground font-medium truncate">{proposal.prospect_name}</span>
                  <span className="text-xs text-muted-foreground ml-auto shrink-0">Prospect</span>
                </div>
              ) : (
                <>
                  <Select
                    value={watch('client_type') === 'prospect' ? '__prospect__' : watch('client_id') || ''}
                    disabled={isReadOnly}
                    onValueChange={(v) => {
                      if (v === '__prospect__') {
                        setValue('client_type', 'prospect')
                        setValue('client_id', null)
                      } else {
                        setValue('client_type', 'client')
                        setValue('client_id', v)
                      }
                      autoSave()
                    }}
                  >
                    <SelectTrigger className="bg-muted/20 border-border/40" disabled={isReadOnly}>
                      <SelectValue placeholder="Select…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__prospect__">— New Prospect —</SelectItem>
                      {clients.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {watch('client_type') === 'prospect' && (
                    <Input
                      {...register('prospect_name')}
                      disabled={isReadOnly}
                      placeholder="Prospect name"
                      className="bg-muted/20 border-border/40 mt-2"
                      onBlur={autoSave}
                    />
                  )}
                </>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Valid Until</Label>
              <Controller
                control={control}
                name="valid_until"
                render={({ field }) => (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        disabled={isReadOnly}
                        className={cn(
                          'w-full justify-start text-left font-normal bg-muted/20 border-border/40',
                          !field.value && 'text-muted-foreground',
                        )}
                      >
                        <CalendarIcon className="mr-2 size-4" />
                        {field.value ? format(field.value, 'MMM d, yyyy') : 'Pick a date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={(d) => { field.onChange(d); autoSave() }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                )}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">
                Deal Value <span className="opacity-50 font-normal">(optional)</span>
              </Label>
              <Input
                {...register('total_value')}
                disabled={isReadOnly}
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                className="bg-muted/20 border-border/40"
                onBlur={autoSave}
              />
            </div>
          </div>

          <Separator className="opacity-50" />

          {/* File section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="size-4 text-muted-foreground" />
                <span className="text-sm font-medium">Proposal File</span>
              </div>
              <div className="flex items-center gap-2">
                {proposal.file_url && (
                  <Button variant="outline" size="sm" className="gap-2 h-8" asChild>
                    <a href={proposal.file_url} download target="_blank" rel="noreferrer">
                      <Download className="size-4" />
                      Download
                    </a>
                  </Button>
                )}
                {isEditable && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 h-8"
                    disabled={isReplacing}
                    onClick={() => replaceFileRef.current?.click()}
                  >
                    {isReplacing ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Upload className="size-4" />
                    )}
                    {isReplacing ? 'Uploading…' : 'Replace File'}
                  </Button>
                )}
                <input
                  ref={replaceFileRef}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={handleReplaceFile}
                />
              </div>
            </div>

            {proposal.file_url ? (
              <iframe
                src={proposal.file_url}
                className="w-full rounded-lg border border-border/50"
                style={{ minHeight: '70vh' }}
                title="Proposal PDF"
              />
            ) : (
              <div
                className="flex flex-col items-center gap-3 py-16 rounded-lg border-2 border-dashed border-border/40 cursor-pointer hover:border-primary/40 hover:bg-muted/10 transition-colors"
                onClick={() => isEditable && replaceFileRef.current?.click()}
              >
                <Upload className="size-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No file uploaded yet. Click to upload a PDF.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Two-panel content — built layout ── */}
      {proposal.proposal_type !== 'uploaded' && (
      <div className="flex flex-col lg:flex-row flex-1 min-h-0">
        {/* ── Left — Form ── */}
        <div className="lg:w-[45%] shrink-0 flex flex-col min-h-0 border-r border-border/50">
          <div className="px-4 py-2.5 border-b border-border/50 bg-background/50 shrink-0">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Proposal Details
            </p>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 custom-scrollbar">
            {/* Title */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">
                Title <span className="text-destructive">*</span>
              </Label>
              <Input
                {...register('title')}
                disabled={isReadOnly}
                placeholder="e.g. Social Media Retainer — Q2 2026"
                className="bg-muted/20 border-border/40"
                onBlur={autoSave}
              />
            </div>

            {/* Client / Prospect selector */}
            <div className="space-y-3">
              <Label className="text-xs font-medium text-muted-foreground">
                {proposal?.prospect_id ? 'Prospect' : 'Client'}
              </Label>
              {proposal?.prospect_id ? (
                <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/30 border border-border/40 text-sm">
                  <span className="text-foreground font-medium truncate">{proposal.prospect_name}</span>
                  <span className="text-xs text-muted-foreground ml-auto shrink-0">Prospect</span>
                </div>
              ) : (
                <>
                  <Select
                    value={clientType === 'prospect' ? '__prospect__' : watchedClientId || ''}
                    disabled={isReadOnly}
                    onValueChange={(v) => {
                      if (v === '__prospect__') {
                        setValue('client_type', 'prospect')
                        setValue('client_id', null)
                      } else {
                        setValue('client_type', 'client')
                        setValue('client_id', v)
                      }
                      autoSave()
                    }}
                  >
                    <SelectTrigger className="bg-muted/20 border-border/40" disabled={isReadOnly}>
                      <SelectValue placeholder="Select a client or new prospect…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__prospect__">— New Prospect —</SelectItem>
                      {clients.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {clientType === 'prospect' && (
                    <div className="space-y-2 pl-1 border-l-2 border-border/40 ml-1">
                      <div className="space-y-1.5 pl-3">
                        <Label className="text-xs text-muted-foreground">Prospect Name</Label>
                        <Input
                          {...register('prospect_name')}
                          disabled={isReadOnly}
                          placeholder="e.g. Zara India"
                          className="bg-muted/20 border-border/40"
                          onBlur={autoSave}
                        />
                      </div>
                      <div className="space-y-1.5 pl-3">
                        <Label className="text-xs text-muted-foreground">Email (optional)</Label>
                        <Input
                          {...register('prospect_email')}
                          disabled={isReadOnly}
                          type="email"
                          placeholder="prospect@company.com"
                          className="bg-muted/20 border-border/40"
                          onBlur={autoSave}
                        />
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Valid until */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Valid Until</Label>
              <Controller
                control={control}
                name="valid_until"
                render={({ field }) => (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        disabled={isReadOnly}
                        className={cn(
                          'w-full justify-start text-left font-normal bg-muted/20 border-border/40',
                          !field.value && 'text-muted-foreground',
                        )}
                      >
                        <CalendarIcon className="mr-2 size-4" />
                        {field.value ? format(field.value, 'MMM d, yyyy') : 'Pick a date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={(d) => {
                          field.onChange(d)
                          autoSave()
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                )}
              />
            </div>

            <Separator className="opacity-50" />

            {/* Introduction */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Introduction</Label>
              <Textarea
                {...register('introduction')}
                disabled={isReadOnly}
                placeholder="Brief introduction to the agency, the relationship, and the context for this proposal…"
                rows={3}
                className="resize-none bg-muted/20 border-border/40"
                onBlur={autoSave}
              />
            </div>

            {/* Scope of work */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Scope of Work</Label>
              <Textarea
                {...register('scope_notes')}
                disabled={isReadOnly}
                placeholder="Describe the deliverables, platforms, posting frequency, and what's included…"
                rows={4}
                className="resize-none bg-muted/20 border-border/40"
                onBlur={autoSave}
              />
            </div>

            <Separator className="opacity-50" />

            {/* Line items */}
            <div className="space-y-3">
              <Label className="text-xs font-medium text-muted-foreground">
                Pricing <span className="text-destructive">*</span>
              </Label>

              <div className="space-y-2">
                {fields.map((field, index) => (
                  <div key={field.id} className="flex gap-2 items-start">
                    <div className="flex-1">
                      <Input
                        {...register(`line_items.${index}.description`)}
                        disabled={isReadOnly}
                        placeholder="Description"
                        className="bg-muted/20 border-border/40"
                        onBlur={autoSave}
                      />
                    </div>
                    <div className="w-32">
                      <Input
                        {...register(`line_items.${index}.amount`)}
                        disabled={isReadOnly}
                        placeholder="Amount"
                        type="number"
                        min="0"
                        step="1"
                        className="bg-muted/20 border-border/40"
                        onBlur={autoSave}
                      />
                    </div>
                    {!isReadOnly && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => fields.length > 1 && remove(index)}
                        disabled={fields.length <= 1}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              {!isReadOnly && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ ...EMPTY_LINE_ITEM })}
                  className="gap-1.5 text-xs h-8"
                >
                  <Plus className="size-3.5" />
                  Add line item
                </Button>
              )}

              <div className="flex justify-between items-center pt-2 border-t border-border/40">
                <span className="text-sm font-medium text-muted-foreground">Total</span>
                <span className="text-base font-bold text-foreground">
                  {formatCurrency(grandTotal)}
                </span>
              </div>
            </div>

            <Separator className="opacity-50" />

            {/* Payment terms */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Payment Terms</Label>
              <Controller
                control={control}
                name="payment_terms"
                render={({ field }) => (
                  <Select
                    value={field.value || ''}
                    disabled={isReadOnly}
                    onValueChange={(v) => {
                      field.onChange(v)
                      autoSave()
                    }}
                  >
                    <SelectTrigger className="bg-muted/20 border-border/40" disabled={isReadOnly}>
                      <SelectValue placeholder="Select payment terms…" />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_TERMS.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            {/* Contract duration */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">
                Contract Duration
              </Label>
              <Input
                {...register('contract_duration')}
                disabled={isReadOnly}
                placeholder="e.g. 3 months, Ongoing"
                className="bg-muted/20 border-border/40"
                onBlur={autoSave}
              />
            </div>

            {/* Additional notes */}
            <div className="space-y-1.5 pb-6">
              <Label className="text-xs font-medium text-muted-foreground">
                Additional Notes
              </Label>
              <Textarea
                {...register('notes')}
                disabled={isReadOnly}
                placeholder="Any additional terms, conditions, or information for the client…"
                rows={3}
                className="resize-none bg-muted/20 border-border/40"
                onBlur={autoSave}
              />
            </div>
          </div>
        </div>

        {/* ── Right — Live Preview ── */}
        <div className="lg:w-[55%] min-h-[400px] lg:min-h-0 bg-muted/40 flex flex-col min-w-0">
          <div className="px-4 py-2.5 border-b border-border/50 bg-background/50 shrink-0">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Live Preview
            </p>
          </div>
          <div className="flex-1 overflow-y-auto p-4 md:p-8 flex justify-center custom-scrollbar">
            <div className="w-full max-w-[640px] shrink-0">
              <ProposalPreview proposal={previewData} agency={agencyData} />
            </div>
          </div>
        </div>
      </div>
      )}

      {/* ── Dialogs ── */}
      <AlertDialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Proposal?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{proposal.title}</strong> will be archived and hidden from your active
              proposals.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchive}>Archive</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Proposal?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{proposal.title}</strong>. This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SendProposalEmailDialog
        open={emailDialogOpen}
        onOpenChange={setEmailDialogOpen}
        proposal={proposal}
        defaultEmail={defaultEmailRecipient}
        defaultName={defaultNameRecipient}
      />
    </div>
  )
}
