import { useState, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { format, isBefore, startOfToday } from 'date-fns'
import {
  Plus,
  Calendar as CalendarIcon,
  Trash2,
  TrendingUp,
  AlertCircle,
  Building2,
  Filter,
} from 'lucide-react'

// API Hooks
import { useExpenses, useCreateExpense, useDeleteExpense } from '@/api/expenses'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

// UI Components
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import StatusBadge from '@/components/StatusBadge'

// --- CONSTANTS & HELPERS ---
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
  next_billing_date: z.date({ required_error: 'A billing date is required' }),
  assigned_client_id: z.string().optional(),
})

// Fetch Clients List
function useClientsList() {
  return useQuery({
    queryKey: ['clients-list'],
    queryFn: async () => {
      const { data } = await supabase
        .from('clients')
        .select('id, name, logo_url')
      return data || []
    },
  })
}

// --- MAIN COMPONENT ---
export default function ExpensesPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [filterMode, setFilterMode] = useState('ALL') // 'ALL', 'INTERNAL', or specific client UUID

  // Data Fetching
  const { data: allExpenses = [], isLoading: isLoadingExpenses } = useExpenses()
  const { data: clients = [] } = useClientsList()
  const { mutate: createExpense, isPending: isCreating } = useCreateExpense()
  const { mutate: deleteExpense } = useDeleteExpense()

  const form = useForm({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      name: '',
      cost: '',
      category: '',
      billing_cycle: 'MONTHLY',
      assigned_client_id: 'myself',
    },
  })

  function onSubmit(data) {
    createExpense(
      {
        ...data,
        assigned_client_id: data.assigned_client_id,
      },
      {
        onSuccess: () => {
          setIsDialogOpen(false)
          form.reset()
        },
      },
    )
  }

  // --- DYNAMIC FILTERING LOGIC ---
  const filteredExpenses = useMemo(() => {
    if (filterMode === 'ALL') return allExpenses
    if (filterMode === 'INTERNAL')
      return allExpenses.filter((e) => e.assigned_client_id === null)
    return allExpenses.filter((e) => e.assigned_client_id === filterMode)
  }, [allExpenses, filterMode])

  // --- DYNAMIC MATH (Burn Rate & Next Bill) ---
  const metrics = useMemo(() => {
    let monthlyBurn = 0

    filteredExpenses.forEach((e) => {
      const cost = parseFloat(e.cost)
      if (e.billing_cycle === 'MONTHLY') monthlyBurn += cost
      else if (e.billing_cycle === 'QUARTERLY') monthlyBurn += cost / 3
      else if (e.billing_cycle === 'YEARLY') monthlyBurn += cost / 12
    })

    const nextBill = filteredExpenses
      .filter((e) => !isBefore(new Date(e.next_billing_date), startOfToday()))
      .sort(
        (a, b) => new Date(a.next_billing_date) - new Date(b.next_billing_date),
      )[0]

    return { monthlyBurn, nextBill }
  }, [filteredExpenses])

  return (
    <div className="h-full bg-background overflow-y-auto p-8 space-y-8 max-w-[1400px] mx-auto animate-in fade-in duration-700">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-normal tracking-tight">
            Operational Expenses
          </h1>
          <p className="text-muted-foreground text-sm font-light">
            Manage recurring costs. Filter by client to see project-specific
            profitability.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* FILTER DROPDOWN (The "Lens") */}
          <Select value={filterMode} onValueChange={setFilterMode}>
            <SelectTrigger className="w-[220px] rounded-full h-11 border-dashed shadow-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Filter className="h-4 w-4" />
                <SelectValue placeholder="Filter View" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Expenses</SelectItem>
              <SelectItem value="INTERNAL">Internal Only (Agency)</SelectItem>
              {clients.length > 0 && (
                <div className="h-px bg-border my-2 mx-1" />
              )}
              {clients.map((client) => (
                <SelectItem key={client.id} value={client.id}>
                  {client.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* ADD BUTTON */}
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-full h-11 px-6 shadow-lg shadow-primary/10">
                <Plus className="mr-2 h-4 w-4" /> Add Expense
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] rounded-2xl">
              <DialogHeader>
                <DialogTitle>Add New Subscription</DialogTitle>
                <DialogDescription>
                  Track a recurring expense.
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-6 pt-4"
                >
                  {/* Name & Cost Row */}
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Service Name</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g. Midjourney"
                              {...field}
                              className="rounded-xl"
                            />
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
                            <Input
                              type="number"
                              placeholder="499"
                              {...field}
                              className="rounded-xl"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Category & Cycle Row */}
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="category"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Category</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger className="rounded-xl">
                                <SelectValue placeholder="Select type" />
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
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="billing_cycle"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Billing Cycle</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger className="rounded-xl">
                                <SelectValue placeholder="Select cycle" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="MONTHLY">Monthly</SelectItem>
                              <SelectItem value="QUARTERLY">
                                Quarterly
                              </SelectItem>
                              <SelectItem value="YEARLY">Yearly</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Date & Client Row */}
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="next_billing_date"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Next Renewal</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant={'outline'}
                                  className={cn(
                                    'pl-3 text-left font-normal rounded-xl',
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
                            <PopoverContent
                              className="w-auto p-0"
                              align="start"
                            >
                              <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                disabled={(date) =>
                                  date < new Date('1900-01-01')
                                }
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
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
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger className="rounded-xl">
                                <SelectValue placeholder="Select Account" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="myself">
                                <div className="flex items-center gap-2">
                                  <Building2 className="size-4 text-primary" />
                                  <span className="font-medium">My Agency</span>
                                </div>
                              </SelectItem>
                              {clients.map((client) => (
                                <SelectItem key={client.id} value={client.id}>
                                  <div className="flex items-center gap-2">
                                    {client.logo_url && (
                                      <img
                                        src={client.logo_url}
                                        className="w-4 h-4 rounded-full object-cover"
                                      />
                                    )}
                                    <span>{client.name}</span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex justify-end gap-3 pt-4">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setIsDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={isCreating}
                      className="rounded-full px-8"
                    >
                      {isCreating ? 'Adding...' : 'Add Expense'}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* DYNAMIC KPI CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="rounded-2xl border-none bg-card/50 shadow-sm ring-1 ring-border/50 transition-all duration-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              {filterMode === 'ALL'
                ? 'Total Monthly Burn'
                : filterMode === 'INTERNAL'
                  ? 'Internal Agency Burn'
                  : 'Client Monthly Cost'}
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-normal tracking-tight">
              {new Intl.NumberFormat('en-IN', {
                style: 'currency',
                currency: 'INR',
              }).format(metrics.monthlyBurn)}
              <span className="text-sm font-normal text-muted-foreground ml-1">
                / mo
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              {filterMode === 'ALL'
                ? 'combined cost across all accounts'
                : 'projected based on this view'}
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-none bg-card/50 shadow-sm ring-1 ring-border/50 transition-all duration-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Next Bill Due
            </CardTitle>
            <AlertCircle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            {metrics.nextBill ? (
              <>
                <div className="text-3xl font-normal tracking-tight truncate">
                  {metrics.nextBill.name}
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <Badge variant="secondary" className="font-normal">
                    {format(
                      new Date(metrics.nextBill.next_billing_date),
                      'MMM do',
                    )}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    (
                    {new Intl.NumberFormat('en-IN', {
                      style: 'currency',
                      currency: 'INR',
                    }).format(metrics.nextBill.cost)}
                    )
                  </span>
                </div>
              </>
            ) : (
              <div className="text-2xl font-light text-muted-foreground">
                No upcoming bills
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* FILTERED TABLE */}
      <div className="rounded-2xl border border-border/50 bg-card overflow-hidden shadow-sm">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead className="w-[250px] pl-6">Service Name</TableHead>
              <TableHead>Cost</TableHead>
              <TableHead>Cycle</TableHead>
              <TableHead>Next Renewal</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Assigned To</TableHead>
              <TableHead className="text-right pr-6">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoadingExpenses ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  Loading...
                </TableCell>
              </TableRow>
            ) : filteredExpenses.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="h-24 text-center text-muted-foreground"
                >
                  No expenses found for this view.
                </TableCell>
              </TableRow>
            ) : (
              filteredExpenses.map((expense) => (
                <TableRow
                  key={expense.id}
                  className="group hover:bg-muted/30 transition-colors"
                >
                  <TableCell className="font-medium pl-6">
                    <div className="flex items-center gap-3">
                      <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                        {expense.name.substring(0, 2).toUpperCase()}
                      </div>
                      {expense.name}
                    </div>
                  </TableCell>
                  <TableCell>
                    {new Intl.NumberFormat('en-IN', {
                      style: 'currency',
                      currency: 'INR',
                    }).format(expense.cost)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={expense.billing_cycle} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(expense.next_billing_date), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {expense.category}
                  </TableCell>
                  <TableCell>
                    {expense.assigned_client ? (
                      <div className="flex items-center gap-2">
                        {expense.assigned_client.logo_url && (
                          <img
                            src={expense.assigned_client.logo_url}
                            className="h-5 w-5 rounded-full object-cover"
                          />
                        )}
                        <span className="text-sm text-foreground/80">
                          {expense.assigned_client.name}
                        </span>
                      </div>
                    ) : (
                      <Badge
                        variant="secondary"
                        className="text-xs font-normal"
                      >
                        Internal
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right pr-6">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteExpense(expense.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
