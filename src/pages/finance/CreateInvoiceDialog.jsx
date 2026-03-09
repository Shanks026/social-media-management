import { useState, useMemo, useEffect } from 'react'
import { format, isBefore, startOfDay } from 'date-fns'
import { Calendar as CalendarIcon, Plus, Trash2, FileText } from 'lucide-react'

// API
import { useQueryClient } from '@tanstack/react-query'
import {
  useCreateInvoice,
  useNextInvoiceNumber,
  invoiceKeys,
} from '@/api/invoices'
import { useClients } from '@/api/clients'
import { useSubscription } from '@/api/useSubscription'
import { fetchActiveCampaignsByClient } from '@/api/campaigns'
import { cn } from '@/lib/utils'

// Constants
import { INVOICE_CATEGORIES } from '@/utils/constants'

// UI Components
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'

import HTMLInvoicePreview from '@/components/HTMLInvoicePreview'

const PAYMENT_TERMS = ['Due on Receipt', 'Net 15', 'Net 30', 'Net 60']
// INVOICE_CATEGORIES imported from @/utils/constants
const EMPTY_ITEM = { description: '', quantity: 1, unit_price: 0 }

/**
 * prefill: { category?: string, amount?: string, description?: string }
 * Used when redirected from AddTransactionDialog for invoice-required categories.
 */
export function CreateInvoiceDialog({
  open,
  onOpenChange,
  preselectedClientId,
  preselectedCampaignId = null,
  prefill = null,
  // Called after successful invoice creation. Use to e.g. navigate to /finance/invoices.
  onSuccess: onSuccessCallback = null,
}) {
  const queryClient = useQueryClient()
  const { data: clientData } = useClients()
  const { data: nextNumber } = useNextInvoiceNumber()
  const { mutate: createInvoice, isPending } = useCreateInvoice()
  const { data: subscription } = useSubscription()

  const clients = clientData?.realClients || []

  // --- Form State ---
  const [clientId, setClientId] = useState(preselectedClientId || '')
  const [issueDate, setIssueDate] = useState(new Date())
  const [dueDate, setDueDate] = useState(null)
  const [category, setCategory] = useState('')
  const [paymentTerms, setPaymentTerms] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState([{ ...EMPTY_ITEM }])
  const [campaignId, setCampaignId] = useState('')
  const [availableCampaigns, setAvailableCampaigns] = useState([])

  // --- Fetch campaigns when client changes (Velocity+ only) ---
  useEffect(() => {
    if (!clientId || !subscription?.campaigns) {
      setAvailableCampaigns([])
      setCampaignId('')
      return
    }
    fetchActiveCampaignsByClient(clientId)
      .then(setAvailableCampaigns)
      .catch(() => setAvailableCampaigns([]))
  }, [clientId, subscription?.campaigns])

  // --- Auto-clear dueDate if issueDate moves after it ---
  useEffect(() => {
    if (
      dueDate &&
      issueDate &&
      isBefore(startOfDay(dueDate), startOfDay(issueDate))
    ) {
      setDueDate(null)
    }
  }, [issueDate])

  // --- Reset form when dialog opens (apply prefill if provided) ---
  useEffect(() => {
    if (open) {
      setClientId(preselectedClientId || '')
      setIssueDate(new Date())
      setDueDate(null)
      setCategory(prefill?.category || '')
      setPaymentTerms('')
      setNotes('')
      setCampaignId(preselectedCampaignId || '')
      // Pre-fill first line item if amount/description provided
      const prefillAmount = parseFloat(prefill?.amount) || 0
      const prefillDesc = prefill?.description || prefill?.category || ''
      setItems([
        prefillAmount > 0 || prefillDesc
          ? { description: prefillDesc, quantity: 1, unit_price: prefillAmount }
          : { ...EMPTY_ITEM },
      ])
    }
  }, [open, preselectedClientId, preselectedCampaignId, prefill])

  // --- Line item handlers ---
  const updateItem = (index, field, value) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    )
  }

  const addItem = () => {
    setItems((prev) => [...prev, { ...EMPTY_ITEM }])
  }

  const removeItem = (index) => {
    if (items.length <= 1) return
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  // --- Computed totals ---
  const subtotal = useMemo(
    () =>
      items.reduce(
        (sum, item) =>
          sum +
          (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0),
        0,
      ),
    [items],
  )

  // --- Validation ---
  const isValid = useMemo(() => {
    if (!clientId) return false
    if (!dueDate) return false
    if (items.length === 0) return false
    return items.every(
      (item) =>
        item.description.trim() !== '' &&
        parseFloat(item.quantity) > 0 &&
        parseFloat(item.unit_price) > 0,
    )
  }, [clientId, dueDate, items])

  // --- Preview invoice object (live) ---
  const selectedClient = useMemo(
    () => clients.find((c) => c.id === clientId) || null,
    [clients, clientId],
  )

  const previewInvoice = useMemo(
    () => ({
      invoice_number: nextNumber?.formatted || 'INV-2026-001',
      status: 'DRAFT',
      issue_date: issueDate ? format(issueDate, 'yyyy-MM-dd') : null,
      due_date: dueDate ? format(dueDate, 'yyyy-MM-dd') : null,
      category: category || null,
      payment_terms: paymentTerms || null,
      notes: notes || null,
      total: subtotal,
      client: selectedClient
        ? { name: selectedClient.name, email: selectedClient.email }
        : null,
      items: items.map((item) => ({
        description: item.description || '',
        quantity: parseFloat(item.quantity) || 1,
        unit_price: parseFloat(item.unit_price) || 0,
      })),
    }),
    [
      nextNumber,
      issueDate,
      dueDate,
      category,
      paymentTerms,
      notes,
      subtotal,
      selectedClient,
      items,
    ],
  )

  const agencyData = useMemo(
    () => ({
      agency_name: subscription?.agency_name || '',
      logo_url: subscription?.logo_url || null,
      email: subscription?.email || '',
      mobile_number: subscription?.mobile_number || '',
      basic_whitelabel_enabled: subscription?.basic_whitelabel_enabled ?? false,
      full_whitelabel_enabled: subscription?.full_whitelabel_enabled ?? false,
    }),
    [subscription],
  )

  // --- Submit ---
  const handleSubmit = () => {
    if (!isValid) return

    const invoicePayload = {
      client_id: clientId,
      issue_date: format(issueDate, 'yyyy-MM-dd'),
      due_date: format(dueDate, 'yyyy-MM-dd'),
      category: category || null,
      payment_terms: paymentTerms || null,
      notes: notes || null,
      campaign_id: campaignId || null,
    }

    const itemsPayload = items.map((item) => ({
      description: item.description.trim(),
      quantity: parseFloat(item.quantity),
      unit_price: parseFloat(item.unit_price),
    }))

    createInvoice(
      { invoice: invoicePayload, items: itemsPayload },
      {
        onSuccess: () => {
          toast.success('Invoice created as draft')
          // Prefetch the client's invoices to avoid flicker on navigation
          queryClient.prefetchQuery({
            queryKey: invoiceKeys.list({ clientId, status: undefined }),
          })
          onOpenChange(false)
          // Small delay for the dialog to start closing before the page transition
          if (onSuccessCallback) {
            setTimeout(onSuccessCallback, 50)
          }
        },
        onError: (err) => {
          toast.error(`Failed to create invoice: ${err.message}`)
        },
      },
    )
  }

  const formatCurrencyValue = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(val)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[95vw] w-[1440px] max-h-[95vh] p-0 overflow-hidden flex flex-col bg-background"
        style={{ maxWidth: 'min(95vw, 1440px)' }}
      >
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-border/50 shrink-0">
          <DialogTitle className="flex items-center gap-2 text-lg font-medium">
            <FileText className="size-5 text-primary" />
            Create Invoice
          </DialogTitle>
        </DialogHeader>

        {/* Two-column layout */}
        <div className="flex flex-col lg:flex-row flex-1 min-h-0">
          {/* Left — Live HTML Preview Container */}
          <div className="lg:w-[55%] min-h-[400px] lg:min-h-0 bg-[#f3f4f6] dark:bg-zinc-950/50 border-b lg:border-b-0 lg:border-r border-border/50 flex flex-col min-w-0">
            <div className="px-4 py-2.5 border-b border-border/50 bg-background/50 shrink-0">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Live Preview
              </p>
            </div>
            {/* Scrollable area for the paper preview */}
            <div className="flex-1 overflow-y-auto p-4 md:p-8 flex justify-center custom-scrollbar">
              <div className="w-full max-w-[700px] shrink-0">
                {/* Standard React Component Preview */}
                <HTMLInvoicePreview
                  invoice={previewInvoice}
                  agency={agencyData}
                />
              </div>
            </div>
          </div>

          {/* Right — Form */}
          <div className="lg:w-[45%] shrink-0 flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6 custom-scrollbar">
              {/* Invoice Number (Read-only) */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/40">
                <span className="text-xs text-muted-foreground font-medium">
                  Invoice #
                </span>
                <span className="text-sm font-mono font-semibold text-foreground">
                  {nextNumber?.formatted || 'INV-2026-001'}
                </span>
              </div>

              {/* Client Select */}
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">
                  Client <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={clientId}
                  onValueChange={setClientId}
                  disabled={!!preselectedClientId}
                >
                  <SelectTrigger
                    className={cn(
                      'w-full',
                      preselectedClientId && 'opacity-60',
                    )}
                  >
                    <SelectValue placeholder="Select a client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        <div className="flex items-center gap-2">
                          {client.logo_url ? (
                            <img
                              src={client.logo_url}
                              alt=""
                              className="size-4 rounded-sm object-cover"
                            />
                          ) : (
                            <div className="size-4 rounded-sm bg-muted flex items-center justify-center text-[8px] font-bold text-muted-foreground">
                              {client.name?.[0]}
                            </div>
                          )}
                          {client.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Dates Row */}
              <div className="grid grid-cols-2 gap-3">
                {/* Issue Date */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Issue Date
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          'w-full justify-start text-left font-normal text-sm',
                          !issueDate && 'text-muted-foreground',
                        )}
                      >
                        <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                        {issueDate
                          ? format(issueDate, 'MMM d, yyyy')
                          : 'Select'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={issueDate}
                        onSelect={setIssueDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Due Date */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Due Date <span className="text-destructive">*</span>
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          'w-full justify-start text-left font-normal text-sm',
                          !dueDate && 'text-muted-foreground',
                        )}
                      >
                        <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                        {dueDate ? format(dueDate, 'MMM d, yyyy') : 'Select'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dueDate}
                        onSelect={setDueDate}
                        disabled={(date) =>
                          isBefore(startOfDay(date), startOfDay(issueDate))
                        }
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Category */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Category <span className="text-destructive">*</span>
                  </Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {INVOICE_CATEGORIES.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Payment Terms */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Payment Terms
                  </Label>
                  <Select value={paymentTerms} onValueChange={setPaymentTerms}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select terms (opt)" />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_TERMS.map((term) => (
                        <SelectItem key={term} value={term}>
                          {term}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Campaign selector — Velocity+ only, shown when campaigns exist for client */}
              {subscription?.campaigns && availableCampaigns.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Campaign
                  </Label>
                  <Select
                    value={campaignId}
                    onValueChange={(val) => setCampaignId(val === '__none__' ? '' : val)}
                    disabled={!!preselectedCampaignId}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="No campaign (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">No campaign</SelectItem>
                      {availableCampaigns.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <Separator />

              {/* LINE ITEMS */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Line Items <span className="text-destructive">*</span>
                  </Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={addItem}
                    className="h-7 text-xs gap-1 text-primary"
                  >
                    <Plus className="size-3" />
                    Add Item
                  </Button>
                </div>

                {/* Column Headers */}
                <div className="grid grid-cols-[1fr_60px_90px_28px] gap-2 px-1">
                  <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                    Description
                  </span>
                  <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                    Qty
                  </span>
                  <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                    Unit Price
                  </span>
                  <span />
                </div>

                {/* Item Rows */}
                {items.map((item, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-[1fr_60px_90px_28px] gap-2 items-center"
                  >
                    <Input
                      placeholder="Description"
                      value={item.description}
                      onChange={(e) =>
                        updateItem(index, 'description', e.target.value)
                      }
                      className="h-8 text-xs"
                    />
                    <Input
                      type="number"
                      min="1"
                      step="1"
                      value={item.quantity}
                      onChange={(e) =>
                        updateItem(index, 'quantity', e.target.value)
                      }
                      className="h-8 text-xs text-center"
                    />
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0"
                      value={item.unit_price || ''}
                      onChange={(e) =>
                        updateItem(index, 'unit_price', e.target.value)
                      }
                      className="h-8 text-xs"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeItem(index)}
                      disabled={items.length <= 1}
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                ))}
              </div>

              <Separator />

              {/* TOTAL */}
              <div className="flex justify-end">
                <div className="flex items-center justify-between w-52 text-sm font-semibold">
                  <span>Total</span>
                  <span className="tabular-nums">
                    {formatCurrencyValue(subtotal)}
                  </span>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">
                  Notes
                </Label>
                <Textarea
                  placeholder="Additional notes for the client (optional)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="min-h-[60px] text-sm resize-none"
                />
              </div>
            </div>

            {/* Actions — sticky at bottom */}
            <div className="shrink-0 flex justify-end gap-3 px-8 py-5 border-t border-border/50 bg-background">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!isValid || isPending}
                className="min-w-[130px]"
              >
                {isPending ? 'Creating...' : 'Save as Draft'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
