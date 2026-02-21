import { useState, useMemo, useEffect } from 'react'
import { format, isBefore, startOfDay } from 'date-fns'
import {
  Calendar as CalendarIcon,
  Plus,
  Trash2,
  FileText,
  Pencil,
  Lock,
} from 'lucide-react'

// API
import { useInvoice, useUpdateInvoice } from '@/api/invoices'
import { useClients } from '@/api/clients'
import { cn } from '@/lib/utils'

// UI Components
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

const PAYMENT_TERMS = ['Due on Receipt', 'Net 15', 'Net 30', 'Net 60']

const EMPTY_ITEM = { description: '', quantity: 1, unit_price: 0 }

export function EditInvoiceDialog({ open, onOpenChange, invoiceId }) {
  const { data: invoice, isLoading } = useInvoice(invoiceId)
  const { data: clientData } = useClients()
  const { mutate: updateInvoice, isPending } = useUpdateInvoice()

  const clients = clientData?.realClients || []

  // --- Derived permissions ---
  const status = invoice?.status || 'DRAFT'
  const isDraft = status === 'DRAFT'
  const isSentOrOverdue = status === 'SENT' || status === 'OVERDUE'
  const isPaid = status === 'PAID'
  const isReadOnly = isPaid

  // --- Form State ---
  const [clientId, setClientId] = useState('')
  const [issueDate, setIssueDate] = useState(new Date())
  const [dueDate, setDueDate] = useState(null)
  const [paymentTerms, setPaymentTerms] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState([{ ...EMPTY_ITEM }])

  // --- Populate form from invoice data ---
  useEffect(() => {
    if (invoice && open) {
      setClientId(invoice.client_id || '')
      setIssueDate(
        invoice.issue_date ? new Date(invoice.issue_date) : new Date(),
      )
      setDueDate(invoice.due_date ? new Date(invoice.due_date) : null)
      setPaymentTerms(invoice.payment_terms || '')
      setNotes(invoice.notes || '')
      setItems(
        invoice.items?.length > 0
          ? invoice.items.map((item) => ({
              description: item.description || '',
              quantity: item.quantity || 1,
              unit_price: item.unit_price || 0,
            }))
          : [{ ...EMPTY_ITEM }],
      )
    }
  }, [invoice, open])

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
    if (isReadOnly) return false
    if (!clientId) return false
    if (!dueDate) return false
    if (items.length === 0) return false
    return items.every(
      (item) =>
        item.description.trim() !== '' &&
        parseFloat(item.quantity) > 0 &&
        parseFloat(item.unit_price) > 0,
    )
  }, [clientId, dueDate, items, isReadOnly])

  // --- Detect changes ---
  const hasChanges = useMemo(() => {
    if (!invoice) return false

    const origClient = invoice.client_id || ''
    const origIssue = invoice.issue_date || ''
    const origDue = invoice.due_date || ''
    const origTerms = invoice.payment_terms || ''
    const origNotes = invoice.notes || ''

    const curIssue = issueDate ? format(issueDate, 'yyyy-MM-dd') : ''
    const curDue = dueDate ? format(dueDate, 'yyyy-MM-dd') : ''

    if (clientId !== origClient) return true
    if (curIssue !== origIssue) return true
    if (curDue !== origDue) return true
    if (paymentTerms !== origTerms) return true
    if (notes !== origNotes) return true

    // Check items changes (only for draft)
    if (isDraft) {
      const origItems = invoice.items || []
      if (items.length !== origItems.length) return true
      for (let i = 0; i < items.length; i++) {
        if (items[i].description !== (origItems[i]?.description || ''))
          return true
        if (
          parseFloat(items[i].quantity) !==
          parseFloat(origItems[i]?.quantity || 0)
        )
          return true
        if (
          parseFloat(items[i].unit_price) !==
          parseFloat(origItems[i]?.unit_price || 0)
        )
          return true
      }
    }

    return false
  }, [
    invoice,
    clientId,
    issueDate,
    dueDate,
    paymentTerms,
    notes,
    items,
    isDraft,
  ])

  // --- Submit ---
  const handleSubmit = () => {
    if (!isValid || !hasChanges) return

    const updates = {}

    // Always updatable fields (DRAFT + SENT/OVERDUE)
    if (dueDate) updates.due_date = format(dueDate, 'yyyy-MM-dd')
    updates.notes = notes || null
    updates.payment_terms = paymentTerms || null

    // Only DRAFT can update these
    if (isDraft) {
      updates.client_id = clientId
      updates.issue_date = format(issueDate, 'yyyy-MM-dd')
      updates.items = items.map((item) => ({
        description: item.description.trim(),
        quantity: parseFloat(item.quantity),
        unit_price: parseFloat(item.unit_price),
      }))
    }

    updateInvoice(
      { id: invoiceId, updates },
      {
        onSuccess: () => {
          toast.success('Invoice updated')
          onOpenChange(false)
        },
        onError: (err) => {
          toast.error(`Failed to update invoice: ${err.message}`)
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

  const statusLabel = {
    DRAFT: { label: 'Draft', variant: 'secondary' },
    SENT: { label: 'Sent', variant: 'outline' },
    OVERDUE: { label: 'Overdue', variant: 'destructive' },
    PAID: { label: 'Paid', variant: 'default' },
  }

  const currentStatus = statusLabel[status] || statusLabel.DRAFT

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[680px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-medium">
            {isReadOnly ? (
              <Lock className="size-5 text-muted-foreground" />
            ) : (
              <Pencil className="size-5 text-primary" />
            )}
            {isReadOnly ? 'View Invoice' : 'Edit Invoice'}
          </DialogTitle>
          <DialogDescription>
            {isReadOnly
              ? 'This invoice is paid and cannot be edited.'
              : isSentOrOverdue
                ? 'Only notes, due date, and payment terms can be modified.'
                : 'Modify invoice details and line items.'}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
            Loading invoice…
          </div>
        ) : (
          <div className="space-y-6 pt-2">
            {/* --- Invoice Number & Status --- */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/40">
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground font-medium">
                  Invoice #
                </span>
                <span className="text-sm font-mono font-semibold text-foreground">
                  {invoice?.invoice_number || '—'}
                </span>
              </div>
              <Badge variant={currentStatus.variant}>
                {currentStatus.label}
              </Badge>
            </div>

            {/* --- Edit Permission Notice (SENT/OVERDUE) --- */}
            {isSentOrOverdue && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 text-amber-700 dark:text-amber-400 text-xs">
                <Lock className="size-3.5 shrink-0" />
                Client and line items are locked after sending. You can still
                update the due date, payment terms, and notes.
              </div>
            )}

            {/* --- Client Select --- */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">
                Client <span className="text-destructive">*</span>
              </Label>
              <Select
                value={clientId}
                onValueChange={setClientId}
                disabled={!isDraft}
              >
                <SelectTrigger
                  className={cn('w-full', !isDraft && 'opacity-60')}
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

            {/* --- Dates Row --- */}
            <div className="grid grid-cols-2 gap-4">
              {/* Issue Date */}
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">
                  Issue Date
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      disabled={!isDraft}
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !issueDate && 'text-muted-foreground',
                        !isDraft && 'opacity-60',
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {issueDate ? format(issueDate, 'PPP') : 'Select date'}
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
                      disabled={isReadOnly}
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !dueDate && 'text-muted-foreground',
                        isReadOnly && 'opacity-60',
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dueDate ? format(dueDate, 'PPP') : 'Select due date'}
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

            {/* --- Payment Terms --- */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">
                Payment Terms
              </Label>
              <Select
                value={paymentTerms}
                onValueChange={setPaymentTerms}
                disabled={isReadOnly}
              >
                <SelectTrigger
                  className={cn('w-full', isReadOnly && 'opacity-60')}
                >
                  <SelectValue placeholder="Select payment terms (optional)" />
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

            <Separator />

            {/* --- LINE ITEMS --- */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium text-muted-foreground">
                  Line Items <span className="text-destructive">*</span>
                </Label>
                {isDraft && (
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
                )}
              </div>

              {/* Column Headers */}
              <div className="grid grid-cols-[1fr_80px_110px_90px_32px] gap-2 px-1">
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  Description
                </span>
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  Qty
                </span>
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  Unit Price
                </span>
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider text-right">
                  Total
                </span>
                <span />
              </div>

              {/* Item Rows */}
              {items.map((item, index) => {
                const lineTotal =
                  (parseFloat(item.quantity) || 0) *
                  (parseFloat(item.unit_price) || 0)
                return (
                  <div
                    key={index}
                    className="grid grid-cols-[1fr_80px_110px_90px_32px] gap-2 items-center"
                  >
                    <Input
                      placeholder="Service description"
                      value={item.description}
                      onChange={(e) =>
                        updateItem(index, 'description', e.target.value)
                      }
                      disabled={!isDraft}
                      className={cn('h-9 text-sm', !isDraft && 'opacity-60')}
                    />
                    <Input
                      type="number"
                      min="1"
                      step="1"
                      value={item.quantity}
                      onChange={(e) =>
                        updateItem(index, 'quantity', e.target.value)
                      }
                      disabled={!isDraft}
                      className={cn(
                        'h-9 text-sm text-center',
                        !isDraft && 'opacity-60',
                      )}
                    />
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={item.unit_price || ''}
                      onChange={(e) =>
                        updateItem(index, 'unit_price', e.target.value)
                      }
                      disabled={!isDraft}
                      className={cn('h-9 text-sm', !isDraft && 'opacity-60')}
                    />
                    <span className="text-sm font-medium text-right tabular-nums">
                      {formatCurrencyValue(lineTotal)}
                    </span>
                    {isDraft ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeItem(index)}
                        disabled={items.length <= 1}
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    ) : (
                      <span />
                    )}
                  </div>
                )
              })}
            </div>

            <Separator />

            {/* --- TOTALS --- */}
            <div className="flex justify-end">
              <div className="w-64 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium tabular-nums">
                    {formatCurrencyValue(subtotal)}
                  </span>
                </div>
                <Separator />
                <div className="flex items-center justify-between text-base font-semibold">
                  <span>Total</span>
                  <span className="tabular-nums">
                    {formatCurrencyValue(subtotal)}
                  </span>
                </div>
              </div>
            </div>

            {/* --- Notes --- */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">
                Notes
              </Label>
              <Textarea
                placeholder="Additional notes for the client (optional)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={isReadOnly}
                className={cn(
                  'min-h-[72px] text-sm resize-none',
                  isReadOnly && 'opacity-60',
                )}
              />
            </div>

            {/* --- Actions --- */}
            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
              >
                {isReadOnly ? 'Close' : 'Cancel'}
              </Button>
              {!isReadOnly && (
                <Button
                  onClick={handleSubmit}
                  disabled={!isValid || !hasChanges || isPending}
                  className="min-w-[140px]"
                >
                  {isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
