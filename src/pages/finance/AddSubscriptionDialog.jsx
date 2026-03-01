import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { format, addMonths, addQuarters, addYears } from 'date-fns'
import { Calendar as CalendarIcon, Building2, User } from 'lucide-react'

// API & Libs
import { useCreateExpense, useUpdateExpense } from '@/api/expenses'
import { useClients } from '@/api/clients'
import { supabase } from '@/lib/supabase'
import { useQuery } from '@tanstack/react-query'
import { cn } from '@/lib/utils'

// UI Components
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
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

const EXPENSE_CATEGORIES = [
  'Software Subscription',
  'Content Creation',
  'Advertising',
  'Freelancer / Contractor',
  'Hosting & Server',
  'Office & Supplies',
  'Travel',
  'Other',
]

const expenseSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  cost: z
    .string()
    .refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0, {
      message: 'Cost must be a positive number',
    }),
  category: z.string().min(1, 'Category is required'),
  billing_cycle: z.enum(['MONTHLY', 'QUARTERLY', 'YEARLY']),
  next_billing_date: z.date({ required_error: 'Required' }),
  is_active: z.boolean().default(true),
  assigned_client_id: z.string().optional().nullable(),
})

export function AddSubscriptionDialog({
  open,
  onOpenChange,
  editingData = null,
  defaultClientId = null,
}) {
  const { mutate: createExpense, isPending: isCreating } = useCreateExpense()
  const { mutate: updateExpense, isPending: isUpdating } = useUpdateExpense()

  const { data: clientData, isLoading: isLoadingClients } = useClients()

  const clients = clientData?.realClients || []
  const internalAccount = clientData?.internalAccount

  const form = useForm({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      name: '',
      cost: '',
      category: '',
      billing_cycle: 'MONTHLY',
      assigned_client_id: '',
    },
  })

  useEffect(() => {
    if (editingData && open) {
      form.reset({
        ...editingData,
        cost: editingData.cost.toString(),
        next_billing_date: new Date(editingData.next_billing_date),
        is_active: editingData.is_active ?? true,
        assigned_client_id: editingData.assigned_client_id || '',
      })
    } else if (!editingData && open) {
      form.reset({
        name: '',
        cost: '',
        category: '',
        billing_cycle: 'MONTHLY',
        next_billing_date: addMonths(new Date(), 1), // Default to 1 month from now
        is_active: true,
        assigned_client_id: defaultClientId || '',
      })
    }
  }, [editingData, open, form, defaultClientId])

  const billingCycle = form.watch('billing_cycle')

  // Dynamically update the next billing date when the billing cycle changes
  // Only for new creations
  useEffect(() => {
    if (!editingData && open && billingCycle) {
      const today = new Date()
      let nextDate = today
      if (billingCycle === 'MONTHLY') nextDate = addMonths(today, 1)
      else if (billingCycle === 'QUARTERLY') nextDate = addQuarters(today, 1)
      else if (billingCycle === 'YEARLY') nextDate = addYears(today, 1)
      
      form.setValue('next_billing_date', nextDate, {
        shouldValidate: true,
        shouldDirty: true,
      })
    }
  }, [billingCycle, editingData, open, form])

  function onSubmit(data) {
    // If no client is explicitly selected, default to the internal account.
    // This ensures agency-wide tools (Slack, Figma, etc.) are always attributed
    // to the internal account instead of being orphaned as null.
    const sanitizedData = {
      ...data,
      assigned_client_id:
        data.assigned_client_id && data.assigned_client_id !== ''
          ? data.assigned_client_id
          : internalAccount?.id || null,
    }

    if (editingData) {
      updateExpense(
        { id: editingData.id, updates: sanitizedData },
        { onSuccess: () => onOpenChange(false) },
      )
    } else {
      createExpense(sanitizedData, { onSuccess: () => onOpenChange(false) })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>
            {editingData ? 'Edit Subscription' : 'Add New Subscription'}
          </DialogTitle>
          <DialogDescription>
            Track and manage your recurring overhead.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="grid gap-5 py-4"
          >
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Service Name <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Figma" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="cost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Cost (₹) <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Category <span className="text-destructive">*</span>
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {EXPENSE_CATEGORIES.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="billing_cycle"
                render={({ field }) => (
                  <FormItem className={cn(editingData && 'opacity-60')}>
                    <FormLabel>
                      Billing Cycle <span className="text-destructive">*</span>
                    </FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={!!editingData}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="MONTHLY">Monthly</SelectItem>
                        <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                        <SelectItem value="YEARLY">Yearly</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="next_billing_date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel className="mb-0">
                      Next Renewal <span className="text-destructive">*</span>
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
                              <span>Pick date</span>
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
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="assigned_client_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assigned To</FormLabel>
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
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm bg-card/50">
                  <div className="space-y-0.5">
                    <FormLabel className="text-sm font-medium text-foreground">
                      Active Subscription
                    </FormLabel>
                    <div className="text-xs text-muted-foreground">
                      Enable this to track it in your monthly burn rate calculations.
                    </div>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isCreating || isUpdating} className="min-w-[120px]">
                {editingData ? 'Update Record' : 'Save Record'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
