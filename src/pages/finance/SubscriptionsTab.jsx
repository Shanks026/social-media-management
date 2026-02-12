import { useState, useMemo } from 'react'
import { format, isBefore, startOfToday } from 'date-fns'
import {
  Plus,
  Trash2,
  TrendingUp,
  AlertCircle,
  Building2,
  Filter,
  Edit2,
} from 'lucide-react'

// API & Libs
import { useExpenses, useDeleteExpense } from '@/api/expenses'
import { supabase } from '@/lib/supabase'
import { useQuery } from '@tanstack/react-query'
import { cn } from '@/lib/utils'

// Components
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import StatusBadge from '@/components/StatusBadge'
import { CustomTable } from '@/components/CustomTable'
import { AddSubscriptionDialog } from './AddSubscriptionDialog'

export default function SubscriptionsTab() {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState(null)
  const [filterMode, setFilterMode] = useState('ALL')

  const { data: allExpenses = [], isLoading: isLoadingExpenses } = useExpenses()
  const { mutate: deleteExpense } = useDeleteExpense()

  const { data: clientData } = useQuery({
    queryKey: ['clients-list'],
    queryFn: async () => {
      const { data } = await supabase
        .from('clients')
        .select('id, name, is_internal')
      return {
        internalAccount: data?.find((c) => c.is_internal) || null,
        realClients: data?.filter((c) => !c.is_internal) || [],
      }
    },
  })

  const internalAccount = clientData?.internalAccount
  const clients = clientData?.realClients || []

  const filteredExpenses = useMemo(() => {
    if (filterMode === 'ALL') return allExpenses
    const internalId = internalAccount?.id
    if (filterMode === 'INTERNAL' || filterMode === internalId) {
      return allExpenses.filter(
        (e) =>
          e.assigned_client_id === internalId || e.assigned_client_id === null,
      )
    }
    return allExpenses.filter((e) => e.assigned_client_id === filterMode)
  }, [allExpenses, filterMode, internalAccount])

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

  const columns = [
    {
      header: 'Service Name',
      width: '25%', // Primary identifier gets more space
      headerClassName: 'pl-6',
      cellClassName: 'font-medium pl-6',
      render: (e) => (
        <div className="flex items-center gap-3">
          <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold shrink-0">
            {e.name.substring(0, 2).toUpperCase()}
          </div>
          <span className="truncate">{e.name}</span>
        </div>
      ),
    },
    {
      header: 'Cost',
      width: '12%',
      render: (e) =>
        new Intl.NumberFormat('en-IN', {
          style: 'currency',
          currency: 'INR',
        }).format(e.cost),
    },
    {
      header: 'Cycle',
      width: '10%',
      render: (e) => <StatusBadge status={e.billing_cycle} />,
    },
    {
      header: 'Next Renewal',
      width: '15%',
      render: (e) => format(new Date(e.next_billing_date), 'MMM d, yyyy'),
    },
    {
      header: 'Category',
      width: '15%',
      cellClassName: 'text-muted-foreground text-sm',
      key: 'category',
    },
    {
      header: 'Assigned To',
      width: '18%',
      render: (e) =>
        e.assigned_client && !e.assigned_client.is_internal ? (
          <div className="flex items-center gap-2">
            {e.assigned_client.logo_url && (
              <img
                src={e.assigned_client.logo_url}
                className="h-5 w-5 rounded-full object-cover"
              />
            )}
            <span className="text-sm truncate">{e.assigned_client.name}</span>
          </div>
        ) : (
          <Badge
            variant="secondary"
            className="bg-primary/5 text-primary border-primary/10"
          >
            <Building2 className="mr-1 h-3 w-3" /> My Agency
          </Badge>
        ),
    },
    {
      header: 'Actions',
      width: '100px', // Fixed width for actions is best
      headerClassName: 'text-right pr-6',
      cellClassName: 'text-right pr-6',
      render: (e) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setEditingExpense(e)
              setIsDialogOpen(true)
            }}
            className="h-8 w-8"
          >
            <Edit2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => deleteExpense(e.id)}
            className="h-8 w-8 text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold tracking-tight">Subscriptions</h2>
        <div className="flex items-center gap-3">
          <Select value={filterMode} onValueChange={setFilterMode}>
            <SelectTrigger className="w-[200px] border-dashed">
              <SelectValue placeholder="Filter View" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Expenses</SelectItem>
              <SelectItem value="INTERNAL">My Agency</SelectItem>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={() => {
              setEditingExpense(null)
              setIsDialogOpen(true)
            }}
          >
            <Plus className="mr-2 h-4 w-4" /> Add Expense
          </Button>
        </div>
      </div>

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
            <div className="text-3xl font-medium tracking-tight">
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
                <div className="text-3xl font-medium tracking-tight truncate">
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

      <CustomTable
        columns={columns}
        data={filteredExpenses}
        isLoading={isLoadingExpenses}
      />

      <AddSubscriptionDialog
        open={isDialogOpen}
        onOpenChange={(val) => {
          setIsDialogOpen(val)
          if (!val) setEditingExpense(null)
        }}
        editingData={editingExpense}
      />
    </div>
  )
}
