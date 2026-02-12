import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { format } from 'date-fns'
import { Calendar as CalendarIcon, Building2 } from 'lucide-react'

// API & Libs
import { useCreateExpense, useUpdateExpense } from '@/api/expenses'
import { supabase } from '@/lib/supabase'
import { useQuery } from '@tanstack/react-query'
import { cn } from '@/lib/utils'

// UI Components
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  assigned_client_id: z.string().optional().nullable(),
})

export function AddSubscriptionDialog({
  open,
  onOpenChange,
  editingData = null,
}) {
  const { mutate: createExpense, isPending: isCreating } = useCreateExpense()
  const { mutate: updateExpense, isPending: isUpdating } = useUpdateExpense()

  const { data: clientData } = useQuery({
    queryKey: ['clients-list'],
    queryFn: async () => {
      const { data } = await supabase
        .from('clients')
        .select('id, name, logo_url, is_internal')
      return {
        internalAccount: data?.find((c) => c.is_internal) || null,
        realClients: data?.filter((c) => !c.is_internal) || [],
      }
    },
  })

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
        assigned_client_id: editingData.assigned_client_id || '',
      })
    } else if (!editingData && open) {
      form.reset({
        name: '',
        cost: '',
        category: '',
        billing_cycle: 'MONTHLY',
        next_billing_date: new Date(),
        assigned_client_id: clientData?.internalAccount?.id || '',
      })
    }
  }, [editingData, open, form, clientData])

  function onSubmit(data) {
    if (editingData) {
      updateExpense(
        { id: editingData.id, updates: data },
        { onSuccess: () => onOpenChange(false) },
      )
    } else {
      createExpense(data, { onSuccess: () => onOpenChange(false) })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
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
            className="space-y-4 pt-2"
          >
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Service Name</FormLabel>
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
                    <FormLabel>Cost (₹)</FormLabel>
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
                    <FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select" />
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
                    <FormLabel>Billing Cycle</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={!!editingData}
                    >
                      <FormControl>
                        <SelectTrigger>
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
                    <FormLabel className="mb-1">Next Renewal</FormLabel>
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
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Account" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {clientData?.internalAccount && (
                          <SelectItem value={clientData.internalAccount.id}>
                            My Agency
                          </SelectItem>
                        )}
                        {clientData?.realClients.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isCreating || isUpdating}>
                {editingData ? 'Update Subscription' : 'Add Subscription'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
