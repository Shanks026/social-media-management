import { useEffect, useMemo } from 'react'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format } from 'date-fns'
import { Plus, Trash2, CalendarIcon, FileText, Target } from 'lucide-react'
import { toast } from 'sonner'

import { useClients } from '@/api/clients'
import { useProspects } from '@/api/prospects'
import {
  useProposal,
  useCreateProposal,
  useUpdateProposal,
  ProposalLimitError,
} from '@/api/proposals'
import { useSubscription } from '@/api/useSubscription'
import { cn } from '@/lib/utils'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import ProposalPreview from './ProposalPreview'

// ─── Constants ────────────────────────────────────────────────────────────────

const PAYMENT_TERMS = ['Due on Receipt', 'Net 15', 'Net 30', 'Net 60']

const EMPTY_LINE_ITEM = { description: '', amount: '' }

// ─── Zod schema ───────────────────────────────────────────────────────────────

const schema = z
  .object({
    title: z.string().min(1, 'Title is required'),
    client_type: z.enum(['client', 'prospect']),
    client_id: z.string().nullable().optional(),
    prospect_id: z.string().nullable().optional(),
    prospect_name: z.string().nullable().optional(),
    prospect_email: z
      .string()
      .nullable()
      .optional()
      .refine(
        (v) => !v || v === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
        'Invalid email address',
      ),
    valid_until: z.date().nullable().optional(),
    introduction: z.string().nullable().optional(),
    scope_notes: z.string().nullable().optional(),
    payment_terms: z.string().nullable().optional(),
    contract_duration: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    line_items: z
      .array(
        z.object({
          description: z.string().min(1, 'Description required'),
          amount: z
            .union([z.string(), z.number()])
            .refine((v) => v !== '' && v !== null && !isNaN(parseFloat(v)), 'Amount required')
            .transform((v) => parseFloat(v)),
        }),
      )
      .min(1, 'At least one line item is required'),
  })
  .superRefine((data, ctx) => {
    if (data.client_type === 'client' && !data.client_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Please select a client',
        path: ['client_id'],
      })
    }
    if (data.client_type === 'prospect' && !data.prospect_id && !data.prospect_name?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Prospect name is required',
        path: ['prospect_name'],
      })
    }
  })

// ─── Component ────────────────────────────────────────────────────────────────

export function ProposalDialog({
  open,
  onOpenChange,
  proposalId = null,
  clientId = null,
  prospectId = null,
  prospectName = null,
  prospectEmail = null,
  onSuccess,
  onUpgradeNeeded,
}) {
  const isEditing = !!proposalId
  const isProspectMode = !!prospectId

  const { data: clientData } = useClients()
  const { data: prospectsData } = useProspects()
  const { data: sub } = useSubscription()
  const { data: existing, isLoading: existingLoading } = useProposal(proposalId)

  const createProposal = useCreateProposal()
  const updateProposal = useUpdateProposal()

  const clients = useMemo(() => clientData?.realClients || [], [clientData])
  const prospects = useMemo(() => prospectsData || [], [prospectsData])

  // ── Form ──
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      title: '',
      client_type: isProspectMode ? 'prospect' : 'client',
      client_id: clientId || '',
      prospect_id: prospectId || '',
      prospect_name: prospectName || '',
      prospect_email: prospectEmail || '',
      valid_until: null,
      introduction: '',
      scope_notes: '',
      payment_terms: '',
      contract_duration: '',
      notes: '',
      line_items: [{ ...EMPTY_LINE_ITEM }],
    },
  })

  const { watch, setValue, reset, control, register, formState: { errors, isSubmitting } } = form

  const { fields, append, remove } = useFieldArray({ control, name: 'line_items' })

  const watchAll = watch()
  const clientType = watch('client_type')
  const watchedClientId = watch('client_id')
  const watchedProspectId = watch('prospect_id')
  const watchedLineItems = watch('line_items')

  // ── Pre-fill when editing ──
  useEffect(() => {
    if (isEditing && existing && open) {
      reset({
        title: existing.title || '',
        client_type: existing.client_id ? 'client' : 'prospect',
        client_id: existing.client_id || '',
        prospect_id: existing.prospect_id || '',
        prospect_name: existing.prospect_name || '',
        prospect_email: existing.prospect_email || '',
        valid_until: existing.valid_until ? new Date(existing.valid_until) : null,
        introduction: existing.introduction || '',
        scope_notes: existing.scope_notes || '',
        payment_terms: existing.payment_terms || '',
        contract_duration: existing.contract_duration || '',
        notes: existing.notes || '',
        line_items:
          existing.line_items?.length > 0
            ? existing.line_items.map((li) => ({
                description: li.description,
                amount: li.amount,
              }))
            : [{ ...EMPTY_LINE_ITEM }],
      })
    }
  }, [isEditing, existing, open, reset])

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      reset({
        title: '',
        client_type: isProspectMode ? 'prospect' : 'client',
        client_id: clientId || '',
        prospect_id: prospectId || '',
        prospect_name: prospectName || '',
        prospect_email: prospectEmail || '',
        valid_until: null,
        introduction: '',
        scope_notes: '',
        payment_terms: '',
        contract_duration: '',
        notes: '',
        line_items: [{ ...EMPTY_LINE_ITEM }],
      })
    }
  }, [open, reset, clientId, isProspectMode, prospectName, prospectEmail])

  // ── Live preview data ──
  const selectedClient = useMemo(
    () => clients.find((c) => c.id === watchedClientId) || null,
    [clients, watchedClientId],
  )

  const agencyData = useMemo(
    () => ({
      agency_name: sub?.agency_name || '',
      logo_url: sub?.logo_url || null,
      logo_horizontal_url: sub?.logo_horizontal_url || null,
      branding_agency_sidebar: sub?.branding_agency_sidebar ?? false,
    }),
    [sub],
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
        .map((li) => ({
          description: li.description,
          amount: parseFloat(li.amount) || 0,
        })),
    }),
    [watchAll, clientType, selectedClient, watchedLineItems],
  )

  const grandTotal = useMemo(
    () =>
      (watchedLineItems || []).reduce(
        (sum, li) => sum + (parseFloat(li.amount) || 0),
        0,
      ),
    [watchedLineItems],
  )

  // ── Submit ──
  async function onSubmit(values) {
    try {
      const payload = {
        title: values.title,
        client_id: values.client_type === 'client' ? values.client_id || null : null,
        prospect_id: values.client_type === 'prospect' ? (values.prospect_id || null) : null,
        prospect_name: values.client_type === 'prospect' ? values.prospect_name || null : null,
        prospect_email: values.client_type === 'prospect' ? values.prospect_email || null : null,
        valid_until: values.valid_until ? format(values.valid_until, 'yyyy-MM-dd') : null,
        introduction: values.introduction || null,
        scope_notes: values.scope_notes || null,
        payment_terms: values.payment_terms || null,
        contract_duration: values.contract_duration || null,
        notes: values.notes || null,
        line_items: values.line_items,
      }

      if (isEditing) {
        await updateProposal.mutateAsync({ id: proposalId, ...payload })
        toast.success('Proposal saved')
      } else {
        await createProposal.mutateAsync(payload)
        toast.success('Proposal created')
      }

      onOpenChange(false)
      onSuccess?.()
    } catch (err) {
      if (err instanceof ProposalLimitError || err.code === 'PROPOSAL_LIMIT_REACHED') {
        onOpenChange(false)
        onUpgradeNeeded?.()
      } else {
        toast.error(err.message || 'Something went wrong')
      }
    }
  }

  const isPending = createProposal.isPending || updateProposal.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[95vw] w-350 max-h-[95vh] p-0 overflow-hidden flex flex-col bg-background"
        style={{ maxWidth: 'min(95vw, 1400px)' }}
      >
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-border/50 shrink-0">
          <DialogTitle className="flex items-center gap-2 text-lg font-medium">
            <FileText className="size-5 text-primary" />
            {isEditing ? 'Edit Proposal' : 'New Proposal'}
          </DialogTitle>
        </DialogHeader>

        {isEditing && existingLoading ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground text-sm">
            Loading proposal…
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row flex-1 min-h-0">

            {/* ── Left — Form ── */}
            <div className="lg:w-[45%] shrink-0 flex flex-col min-h-0">
              <div className="px-4 py-2.5 border-b border-border/50 bg-background/50 shrink-0">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Proposal Details
                </p>
              </div>

              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="flex-1 overflow-y-auto px-6 py-5 space-y-5 custom-scrollbar"
              >
                {/* Title */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Title <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    {...register('title')}
                    placeholder="e.g. Social Media Retainer — Q2 2026"
                    className="bg-muted/20 border-border/40"
                  />
                  {errors.title && (
                    <p className="text-xs text-destructive">{errors.title.message}</p>
                  )}
                </div>

                {/* Client / Prospect selector */}
                <div className="space-y-3">
                  <Label className="text-xs font-medium text-muted-foreground">
                    {isProspectMode ? 'Prospect' : 'Client'} <span className="text-destructive">*</span>
                  </Label>

                  {isProspectMode ? (
                    /* Locked — came from prospect detail page */
                    <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/30 border border-border/40 text-sm">
                      <span className="text-foreground font-medium">{prospectName}</span>
                      <span className="text-xs text-muted-foreground ml-auto">Prospect</span>
                    </div>
                  ) : (
                    <Select
                      value={
                        clientType === 'client'
                          ? (watchedClientId ? `client:${watchedClientId}` : '')
                          : (watchedProspectId ? `prospect:${watchedProspectId}` : '__new_prospect__')
                      }
                      onValueChange={(v) => {
                        if (v.startsWith('client:')) {
                          setValue('client_type', 'client')
                          setValue('client_id', v.slice(7))
                          setValue('prospect_id', null)
                          setValue('prospect_name', '')
                          setValue('prospect_email', '')
                        } else if (v.startsWith('prospect:')) {
                          const pid = v.slice(9)
                          const p = prospects.find((x) => x.id === pid)
                          setValue('client_type', 'prospect')
                          setValue('client_id', null)
                          setValue('prospect_id', pid)
                          setValue('prospect_name', p?.business_name || '')
                          setValue('prospect_email', p?.email || '')
                        } else {
                          setValue('client_type', 'prospect')
                          setValue('client_id', null)
                          setValue('prospect_id', null)
                          setValue('prospect_name', '')
                          setValue('prospect_email', '')
                        }
                      }}
                    >
                      <SelectTrigger className="bg-muted/20 border-border/40">
                        <SelectValue placeholder="Select client or prospect…" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__new_prospect__">— New Prospect —</SelectItem>
                        {clients.length > 0 && (
                          <SelectGroup>
                            <SelectLabel>Clients</SelectLabel>
                            {clients.map((c) => (
                              <SelectItem key={c.id} value={`client:${c.id}`}>
                                <div className="flex items-center gap-2">
                                  {c.logo_url ? (
                                    <img src={c.logo_url} alt="" className="size-5 rounded-full object-cover shrink-0" />
                                  ) : (
                                    <div className="size-5 rounded-full bg-muted flex items-center justify-center shrink-0">
                                      <span className="text-[10px] font-medium text-muted-foreground leading-none">{c.name[0]}</span>
                                    </div>
                                  )}
                                  {c.name}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        )}
                        {prospects.length > 0 && (
                          <SelectGroup>
                            <SelectLabel>CRM Prospects</SelectLabel>
                            {prospects.map((p) => (
                              <SelectItem key={p.id} value={`prospect:${p.id}`}>
                                <div className="flex items-center gap-2">
                                  <div className="size-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                    <Target className="size-3 text-primary" />
                                  </div>
                                  {p.business_name}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        )}
                      </SelectContent>
                    </Select>
                  )}

                  {errors.client_id && (
                    <p className="text-xs text-destructive">{errors.client_id.message}</p>
                  )}

                  {/* Prospect fields — only shown for freeform new prospect */}
                  {clientType === 'prospect' && !isProspectMode && !watchedProspectId && (
                    <div className="space-y-2 pl-1 border-l-2 border-border/40 ml-1">
                      <div className="space-y-1.5 pl-3">
                        <Label className="text-xs text-muted-foreground">
                          Prospect Name <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          {...register('prospect_name')}
                          placeholder="e.g. Zara India"
                          className="bg-muted/20 border-border/40"
                        />
                        {errors.prospect_name && (
                          <p className="text-xs text-destructive">{errors.prospect_name.message}</p>
                        )}
                      </div>
                      <div className="space-y-1.5 pl-3">
                        <Label className="text-xs text-muted-foreground">Email (optional)</Label>
                        <Input
                          {...register('prospect_email')}
                          type="email"
                          placeholder="prospect@company.com"
                          className="bg-muted/20 border-border/40"
                        />
                        {errors.prospect_email && (
                          <p className="text-xs text-destructive">{errors.prospect_email.message}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Valid until */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Valid until</Label>
                  <Controller
                    control={control}
                    name="valid_until"
                    render={({ field }) => (
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
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
                            onSelect={field.onChange}
                            disabled={{ before: new Date() }}
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
                    placeholder="Brief introduction to the agency, the relationship, and the context for this proposal…"
                    rows={3}
                    className="resize-none bg-muted/20 border-border/40"
                  />
                </div>

                {/* Scope of work */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Scope of Work</Label>
                  <Textarea
                    {...register('scope_notes')}
                    placeholder="Describe the deliverables, platforms, posting frequency, and what's included…"
                    rows={4}
                    className="resize-none bg-muted/20 border-border/40"
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
                        <div className="flex-1 space-y-1">
                          <Input
                            {...register(`line_items.${index}.description`)}
                            placeholder="Description"
                            className="bg-muted/20 border-border/40"
                          />
                          {errors.line_items?.[index]?.description && (
                            <p className="text-xs text-destructive">
                              {errors.line_items[index].description.message}
                            </p>
                          )}
                        </div>
                        <div className="w-32 space-y-1">
                          <Input
                            {...register(`line_items.${index}.amount`)}
                            placeholder="Amount"
                            type="number"
                            min="0"
                            step="1"
                            className="bg-muted/20 border-border/40"
                          />
                          {errors.line_items?.[index]?.amount && (
                            <p className="text-xs text-destructive">
                              {errors.line_items[index].amount.message}
                            </p>
                          )}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="shrink-0 mt-0 text-muted-foreground hover:text-destructive"
                          onClick={() => fields.length > 1 && remove(index)}
                          disabled={fields.length <= 1}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  {errors.line_items?.root?.message && (
                    <p className="text-xs text-destructive">{errors.line_items.root.message}</p>
                  )}

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

                  {/* Grand total */}
                  <div className="flex justify-between items-center pt-2 border-t border-border/40">
                    <span className="text-sm font-medium text-muted-foreground">Total</span>
                    <span className="text-base font-bold text-foreground">
                      {new Intl.NumberFormat('en-IN', {
                        style: 'currency',
                        currency: 'INR',
                        maximumFractionDigits: 0,
                      }).format(grandTotal)}
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
                      <Select value={field.value || ''} onValueChange={field.onChange}>
                        <SelectTrigger className="bg-muted/20 border-border/40">
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
                    placeholder="e.g. 3 months, Ongoing"
                    className="bg-muted/20 border-border/40"
                  />
                </div>

                {/* Additional notes */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Additional Notes
                  </Label>
                  <Textarea
                    {...register('notes')}
                    placeholder="Any additional terms, conditions, or information for the client…"
                    rows={3}
                    className="resize-none bg-muted/20 border-border/40"
                  />
                </div>

                {/* Submit */}
                <div className="pt-3 pb-4 flex gap-2 justify-end sticky bottom-0 bg-background/95 backdrop-blur border-t border-border/40 -mx-6 px-6">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => onOpenChange(false)}
                    disabled={isPending}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isPending} className="gap-2">
                    {isPending ? 'Saving…' : isEditing ? 'Save Changes' : 'Save as Draft'}
                  </Button>
                </div>
              </form>
            </div>

            {/* ── Right — Live Preview ── */}
            <div className="lg:w-[55%] min-h-100 lg:min-h-0 bg-muted/40 border-t lg:border-t-0 lg:border-l border-border/50 flex flex-col min-w-0">
              <div className="px-4 py-2.5 border-b border-border/50 bg-background/50 shrink-0">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Live Preview
                </p>
              </div>
              <div className="flex-1 overflow-y-auto p-4 md:p-8 flex justify-center custom-scrollbar">
                <div className="w-full max-w-160 shrink-0">
                  <ProposalPreview proposal={previewData} agency={agencyData} />
                </div>
              </div>
            </div>

          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
