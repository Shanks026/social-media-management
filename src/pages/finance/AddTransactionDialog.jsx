import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { format } from 'date-fns'
import {
  Calendar as CalendarIcon,
  ArrowUpCircle,
  ArrowDownCircle,
  Building2,
  User,
  FileText,
  AlertCircle,
} from 'lucide-react'

// API
import { useCreateTransaction, useUpdateTransaction } from '@/api/transactions'
import { useClients } from '@/api/clients'
import { cn } from '@/lib/utils'

// Constants
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES, AGENCY_INCOME_CATEGORIES } from '@/utils/constants'

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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

// Lazy-imported to avoid circular dep — CreateInvoiceDialog is a heavy component
// Note: CreateInvoiceDialog is NOT mounted here; parent handles it via onCreateInvoice callback

const transactionSchema = z.object({
  type: z.enum(['INCOME', 'EXPENSE']),
  amount: z
    .string()
    .refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0, {
      message: 'Positive number required',
    }),
  date: z.date(),
  client_id: z.string().optional().nullable(),
  category: z.string().min(1, 'Required'),
  description: z.string().min(2, 'Required'),
  status: z.enum(['PAID', 'PENDING', 'OVERDUE']),
})

export function AddTransactionDialog({
  open,
  onOpenChange,
  editingData = null,
  defaultClientId = null,
  // Called when user chooses "Create Invoice instead".
  // Receives prefill: { clientId, category, amount, description }
  onCreateInvoice = null,
}) {
  const { data: clientData, isLoading: isLoadingClients } = useClients()
  const clients = clientData?.realClients || []
  const internalAccount = clientData?.internalAccount

  const { mutate: createTransaction, isPending: isCreating } =
    useCreateTransaction()
  const { mutate: updateTransaction, isPending: isUpdating } =
    useUpdateTransaction()

  const form = useForm({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      type: 'EXPENSE',
      amount: '',
      date: new Date(),
      client_id: '',
      category: '',
      description: '',
      status: 'PAID',
    },
  })

  // Synchronize form with editingData or defaults
  useEffect(() => {
    if (editingData) {
      form.reset({
        type: editingData.type,
        amount: editingData.amount.toString(),
        date: new Date(editingData.date),
        client_id: editingData.client_id || '',
        category: editingData.category,
        description: editingData.description,
        status: editingData.status,
      })
    } else {
      form.reset({
        type: 'EXPENSE',
        amount: '',
        date: new Date(),
        client_id: defaultClientId || '',
        category: '',
        description: '',
        status: 'PAID',
      })
    }
  }, [editingData, form, open, defaultClientId])

  const type = form.watch('type')
  const clientId = form.watch('client_id')
  const selectedCategory = form.watch('category')

  // Determine if currently selected client is internal
  const isInternalClient = useMemo(
    () =>
      clientId === internalAccount?.id ||
      clients.find((c) => c.id === clientId)?.is_internal,
    [clientId, internalAccount, clients],
  )

  // Build available categories based on type + client
  const activeCategories = useMemo(() => {
    if (type === 'INCOME') {
      // No client selected OR My Agency selected → agency-level income categories
      // (both cases save to the internal account; categories should be consistent)
      if (!clientId || isInternalClient) {
        return AGENCY_INCOME_CATEGORIES
      }
      return INCOME_CATEGORIES
    } else {
      // For expenses: hide agency-overhead categories when recording against an external client
      if (!isInternalClient && clientId) {
        return EXPENSE_CATEGORIES.filter(
          (cat) => !['Office / Rent', 'Taxes / Legal'].includes(cat),
        )
      }
      return EXPENSE_CATEGORIES
    }
  }, [type, clientId, isInternalClient])

  // True when the chosen category requires an invoice instead of a direct ledger entry
  const isInvoiceRequired =
    !editingData && type === 'INCOME' && clientId && !isInternalClient

  // The prefill values for CreateInvoiceDialog when redirecting
  const invoicePrefill = useMemo(
    () => ({
      clientId: clientId || '',
      category: selectedCategory || '',
      amount: form.getValues('amount') || '',
      description: form.getValues('description') || '',
    }),
    [clientId, selectedCategory, form],
  )

  function onSubmit(data) {
    if (editingData) {
      updateTransaction(
        { id: editingData.id, updates: data },
        {
          onSuccess: () => {
            onOpenChange(false)
            form.reset()
          },
        },
      )
    } else {
      createTransaction(data, {
        onSuccess: () => {
          onOpenChange(false)
          form.reset()
        },
      })
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingData ? 'Edit Transaction' : 'Record Transaction'}
            </DialogTitle>
            <DialogDescription>
              {editingData
                ? 'Update the details of this ledger entry.'
                : 'Log a one-time income or expense for your agency or clients.'}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-4 pt-2"
            >
              {/* TYPE TOGGLE - Disabled during Edit */}
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem
                    className={cn('space-y-0', editingData && 'opacity-60')}
                  >
                    <Tabs
                      onValueChange={field.onChange}
                      value={field.value}
                      className="w-full"
                    >
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger
                          value="INCOME"
                          disabled={!!editingData}
                          className="data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700"
                        >
                          <ArrowDownCircle className="mr-2 h-4 w-4" /> Income
                        </TabsTrigger>
                        <TabsTrigger
                          value="EXPENSE"
                          disabled={!!editingData}
                          className="data-[state=active]:bg-rose-50 data-[state=active]:text-rose-700"
                        >
                          <ArrowUpCircle className="mr-2 h-4 w-4" /> Expense
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Amount (₹) <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="0.00" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel className="mb-1">
                        Date <span className="text-destructive">*</span>
                      </FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                'pl-3 text-left font-normal',
                                !field.value && 'text-muted-foreground',
                              )}
                            >
                              {field.value ? (
                                format(field.value, 'PPP')
                              ) : (
                                <span>Pick a date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) => date > new Date('2100-01-01')}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="client_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {type === 'INCOME' ? 'From Client' : 'For Client'}
                      </FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value || ''}
                        disabled={!!defaultClientId}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue
                              placeholder={
                                isLoadingClients
                                  ? 'Loading account...'
                                  : 'Select account...'
                              }
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {internalAccount && (
                            <>
                              <SelectItem value={internalAccount.id}>
                                <div className="flex items-center gap-2">
                                  <Building2 className="h-4 w-4" />
                                  <span>My Agency</span>
                                </div>
                              </SelectItem>
                              <div className="h-px bg-muted my-1" />
                            </>
                          )}
                          {clients.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              <div className="flex items-center gap-2">
                                {c.logo_url ? (
                                  <img
                                    src={c.logo_url}
                                    alt=""
                                    className="size-4 rounded-sm object-cover"
                                  />
                                ) : (
                                  <div className="size-4 rounded-sm bg-muted flex items-center justify-center text-[8px] font-bold text-muted-foreground uppercase">
                                    {c.name?.[0]}
                                  </div>
                                )}
                                <span>{c.name}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Category <span className="text-destructive">*</span>
                      </FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        key={type}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {activeCategories.map((cat) => (
                            <SelectItem key={cat} value={cat}>
                              {cat}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Description <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter details..."
                        className="resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="PAID">Paid / Received</SelectItem>
                        <SelectItem value="PENDING">Pending</SelectItem>
                        <SelectItem value="OVERDUE">Overdue</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* ── INVOICE GATE BANNER ───────────────────────────────────── */}
              {isInvoiceRequired && (
                <div className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                        Invoice required for client income
                      </p>
                      <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                        Income from clients should be recorded by creating an
                        invoice. Create an invoice instead — when marked as
                        paid, it auto-creates the ledger entry for you.
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    className="w-full gap-2 bg-amber-600 hover:bg-amber-700 text-white"
                    onClick={() => {
                      // Close this dialog first, then signal parent to open CreateInvoiceDialog
                      onOpenChange(false)
                      if (onCreateInvoice) {
                        // Small delay ensures the closing animation completes before
                        // the parent mounts the new dialog
                        setTimeout(() => onCreateInvoice(invoicePrefill), 150)
                      }
                    }}
                  >
                    <FileText className="h-3.5 w-3.5" />
                    Create Invoice instead
                  </Button>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                {!isInvoiceRequired && (
                  <Button type="submit" disabled={isCreating || isUpdating}>
                    {editingData ? 'Update Record' : 'Save Record'}
                  </Button>
                )}
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  )
}
