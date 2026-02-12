import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { format } from 'date-fns'
import {
  Calendar as CalendarIcon,
  ArrowUpCircle,
  ArrowDownCircle,
  Building2,
} from 'lucide-react'

// API
import { useCreateTransaction, useUpdateTransaction } from '@/api/transactions'
import { supabase } from '@/lib/supabase'
import { useQuery } from '@tanstack/react-query'
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

// --- CONSTANTS ---
const INCOME_CATEGORIES = [
  'Retainer',
  'Project Fee',
  'Consulting',
  'Ad Budget (Client)',
  'Other',
]
const EXPENSE_CATEGORIES = [
  'Freelancer',
  'Asset Purchase',
  'Software (One-off)',
  'Ad Spend',
  'Office',
  'Travel',
  'Other',
]

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

// --- HOOKS ---
function useClientsList() {
  return useQuery({
    queryKey: ['clients-list'],
    queryFn: async () => {
      const { data } = await supabase
        .from('clients')
        .select('id, name, logo_url, is_internal')

      const internalAccount = data?.find((c) => c.is_internal) || null
      const realClients = data?.filter((c) => !c.is_internal) || []

      return { internalAccount, realClients }
    },
  })
}

export function AddTransactionDialog({
  open,
  onOpenChange,
  editingData = null,
}) {
  const { data: clientData } = useClientsList()
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
        client_id: internalAccount?.id || '',
        category: '',
        description: '',
        status: 'PAID',
      })
    }
  }, [editingData, internalAccount, form, open])

  const type = form.watch('type')
  const activeCategories =
    type === 'INCOME' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES

  function onSubmit(data) {
    if (editingData) {
      // Update Mode
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
      // Create Mode
      createTransaction(data, {
        onSuccess: () => {
          onOpenChange(false)
          form.reset()
        },
      })
    }
  }

  return (
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
                    <FormLabel>Amount (₹)</FormLabel>
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
                    <FormLabel className="mb-1">Date</FormLabel>
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
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select account" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {internalAccount && (
                          <SelectItem value={internalAccount.id}>
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4" />
                              <span>My Agency</span>
                            </div>
                          </SelectItem>
                        )}
                        <div className="h-px bg-muted my-1" />
                        {clients.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
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
                    <FormLabel>Category</FormLabel>
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
                  <FormLabel>Description</FormLabel>
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

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isCreating || isUpdating}>
                {editingData ? 'Update Record' : 'Save Record'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
