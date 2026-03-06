import { useState, useMemo, useEffect } from 'react'
import { format, addMonths, addQuarters, addYears } from 'date-fns'
import { Calendar as CalendarIcon, FileText, Pencil, Lock } from 'lucide-react'

// API
import {
  useCreateRecurringInvoice,
  useUpdateRecurringInvoice,
} from '@/api/invoices'
import { useClients } from '@/api/clients'
import { useSubscription } from '@/api/useSubscription'
import { cn } from '@/lib/utils'
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
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'

const PAYMENT_TERMS = ['Due on Receipt', 'Net 15', 'Net 30', 'Net 60']
const BILLING_CYCLES = ['MONTHLY', 'QUARTERLY', 'YEARLY']

export function RecurringInvoiceDialog({
  open,
  onOpenChange,
  preselectedClientId,
  recurringInvoice = null, // if passed, we are in Edit mode
}) {
  const { data: clientData } = useClients()
  const { data: subscription } = useSubscription()
  const clients = clientData?.realClients || []

  const isEditMode = !!recurringInvoice

  const { mutate: createRecurring, isPending: isCreating } =
    useCreateRecurringInvoice()
  const { mutate: updateRecurring, isPending: isUpdating } =
    useUpdateRecurringInvoice()

  const isPending = isCreating || isUpdating

  // --- Form State ---
  const [clientId, setClientId] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('Retainer')
  const [description, setDescription] = useState('')
  const [billingCycle, setBillingCycle] = useState('MONTHLY')
  const [nextInvoiceDate, setNextInvoiceDate] = useState(new Date())
  const [paymentTerms, setPaymentTerms] = useState('')
  const [notes, setNotes] = useState('')
  const [isActive, setIsActive] = useState(true)

  // --- Populate form from recurringInvoice data or reset ---
  useEffect(() => {
    if (open) {
      if (isEditMode && recurringInvoice) {
        setClientId(recurringInvoice.client_id || '')
        setAmount(recurringInvoice.amount || '')
        setCategory(recurringInvoice.category || 'Retainer')
        setDescription(recurringInvoice.description || '')
        setBillingCycle(recurringInvoice.billing_cycle || 'MONTHLY')
        setNextInvoiceDate(
          recurringInvoice.next_invoice_date
            ? new Date(recurringInvoice.next_invoice_date)
            : new Date(),
        )
        setPaymentTerms(recurringInvoice.payment_terms || '')
        setNotes(recurringInvoice.notes || '')
        setIsActive(recurringInvoice.is_active ?? true)
      } else {
        setClientId(preselectedClientId || '')
        setAmount('')
        setCategory('Retainer')
        setDescription('')
        setBillingCycle('MONTHLY')
        setNextInvoiceDate(new Date())
        setPaymentTerms('')
        setNotes('')
        setIsActive(true)
      }
    }
  }, [open, isEditMode, recurringInvoice, preselectedClientId])

  // --- Validation ---
  const isValid = useMemo(() => {
    if (!clientId) return false
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0)
      return false
    if (!nextInvoiceDate) return false
    if (!description.trim()) return false
    return true
  }, [clientId, amount, nextInvoiceDate, description])

  // --- Submit ---
  const handleSubmit = () => {
    if (!isValid) return

    const payload = {
      client_id: clientId,
      amount: parseFloat(amount),
      category,
      description: description.trim(),
      billing_cycle: billingCycle,
      next_invoice_date: format(nextInvoiceDate, 'yyyy-MM-dd'),
      payment_terms: paymentTerms || null,
      notes: notes || null,
      is_active: isActive,
    }

    if (isEditMode) {
      updateRecurring(
        { id: recurringInvoice.id, updates: payload },
        {
          onSuccess: () => {
            toast.success('Recurring invoice template updated')
            onOpenChange(false)
          },
          onError: (err) => {
            toast.error(`Failed to update template: ${err.message}`)
          },
        },
      )
    } else {
      createRecurring(payload, {
        onSuccess: () => {
          toast.success('Recurring invoice template created')
          onOpenChange(false)
        },
        onError: (err) => {
          toast.error(`Failed to create template: ${err.message}`)
        },
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden flex flex-col bg-background max-h-[95vh]">
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-border/50 shrink-0">
          <DialogTitle className="flex items-center gap-2 text-lg font-medium">
            {isEditMode ? (
              <Pencil className="size-5 text-primary" />
            ) : (
              <FileText className="size-5 text-primary" />
            )}
            {isEditMode
              ? 'Edit Recurring Template'
              : 'Create Recurring Template'}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col flex-1 min-h-[400px]">
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 custom-scrollbar">
            {/* Status Toggle */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/40">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Active Status</Label>
                <p className="text-xs text-muted-foreground">
                  When active, you can quickly generate invoices.
                </p>
              </div>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Client Select */}
              <div className="space-y-2 col-span-2">
                <Label className="text-xs font-medium text-muted-foreground">
                  Client <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={clientId}
                  onValueChange={setClientId}
                  disabled={!!preselectedClientId || isEditMode}
                >
                  <SelectTrigger
                    className={cn(
                      'w-full',
                      (preselectedClientId || isEditMode) && 'opacity-60',
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

              {/* Description */}
              <div className="space-y-2 col-span-2">
                <Label className="text-xs font-medium text-muted-foreground">
                  Line Item Description{' '}
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  placeholder="e.g. Monthly Social Media Management"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="text-sm"
                />
              </div>

              {/* Amount */}
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">
                  Amount (INR) <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="text-sm"
                />
              </div>

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

              {/* Billing Cycle */}
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">
                  Billing Cycle <span className="text-destructive">*</span>
                </Label>
                <Select value={billingCycle} onValueChange={setBillingCycle}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select cycle" />
                  </SelectTrigger>
                  <SelectContent>
                    {BILLING_CYCLES.map((cycle) => (
                      <SelectItem key={cycle} value={cycle}>
                        {cycle.charAt(0) + cycle.slice(1).toLowerCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Next Invoice Date */}
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">
                  Next Invoice Date <span className="text-destructive">*</span>
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal text-sm',
                        !nextInvoiceDate && 'text-muted-foreground',
                      )}
                    >
                      <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                      {nextInvoiceDate
                        ? format(nextInvoiceDate, 'MMM d, yyyy')
                        : 'Select date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={nextInvoiceDate}
                      onSelect={setNextInvoiceDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Payment Terms */}
              <div className="space-y-2 col-span-2">
                <Label className="text-xs font-medium text-muted-foreground">
                  Payment Terms
                </Label>
                <Select value={paymentTerms} onValueChange={setPaymentTerms}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select terms (optional)" />
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

              {/* Notes */}
              <div className="space-y-2 col-span-2">
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
          </div>
        </div>

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
            {isPending ? 'Saving...' : 'Save Template'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
