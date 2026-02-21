import { useState, useMemo, useEffect } from 'react'
import { format, isBefore, startOfDay } from 'date-fns'
import { Calendar as CalendarIcon, Plus, Trash2, FileText } from 'lucide-react'

// API
import { useCreateInvoice, useNextInvoiceNumber } from '@/api/invoices'
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
import { toast } from 'sonner'

const PAYMENT_TERMS = ['Due on Receipt', 'Net 15', 'Net 30', 'Net 60']

const EMPTY_ITEM = { description: '', quantity: 1, unit_price: 0 }

export function CreateInvoiceDialog({
  open,
  onOpenChange,
  preselectedClientId,
}) {
  const { data: clientData } = useClients()
  const { data: nextNumber } = useNextInvoiceNumber()
  const { mutate: createInvoice, isPending } = useCreateInvoice()

  const clients = clientData?.realClients || []

  // --- Form State ---
  const [clientId, setClientId] = useState(preselectedClientId || '')
  const [issueDate, setIssueDate] = useState(new Date())
  const [dueDate, setDueDate] = useState(null)
  const [paymentTerms, setPaymentTerms] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState([{ ...EMPTY_ITEM }])

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

  // --- Reset form when dialog opens ---
  const handleOpenChange = (isOpen) => {
    if (isOpen) {
      setClientId(preselectedClientId || '')
      setIssueDate(new Date())
      setDueDate(null)
      setPaymentTerms('')
      setNotes('')
      setItems([{ ...EMPTY_ITEM }])
    }
    onOpenChange(isOpen)
  }

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

  // --- Submit ---
  const handleSubmit = () => {
    if (!isValid) return

    const invoicePayload = {
      client_id: clientId,
      issue_date: format(issueDate, 'yyyy-MM-dd'),
      due_date: format(dueDate, 'yyyy-MM-dd'),
      payment_terms: paymentTerms || null,
      notes: notes || null,
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
          handleOpenChange(false)
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
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[680px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-medium">
            <FileText className="size-5 text-primary" />
            Create Invoice
          </DialogTitle>
          <DialogDescription>
            Create a new invoice for a client. It will be saved as a draft.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {/* --- Invoice Number (Read-only) --- */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/40">
            <span className="text-xs text-muted-foreground font-medium">
              Invoice #
            </span>
            <span className="text-sm font-mono font-semibold text-foreground">
              {nextNumber?.formatted || 'INV-2026-001'}
            </span>
          </div>

          {/* --- Client Select --- */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">
              Client <span className="text-destructive">*</span>
            </Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger className="w-full">
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
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !issueDate && 'text-muted-foreground',
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
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !dueDate && 'text-muted-foreground',
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
            <Select value={paymentTerms} onValueChange={setPaymentTerms}>
              <SelectTrigger className="w-full">
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
                    className="h-9 text-sm"
                  />
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    value={item.quantity}
                    onChange={(e) =>
                      updateItem(index, 'quantity', e.target.value)
                    }
                    className="h-9 text-sm text-center"
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
                    className="h-9 text-sm"
                  />
                  <span className="text-sm font-medium text-right tabular-nums">
                    {formatCurrencyValue(lineTotal)}
                  </span>
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
              className="min-h-[72px] text-sm resize-none"
            />
          </div>

          {/* --- Actions --- */}
          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!isValid || isPending}
              className="min-w-[140px]"
            >
              {isPending ? 'Creating...' : 'Save as Draft'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
