import { startOfMonth, endOfMonth } from 'date-fns'
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Users,
  ArrowUpRight,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useClients } from '@/api/clients'
import { useInvoices } from '@/api/invoices'
import { useTransactions } from '@/api/transactions'
import { useExpenses } from '@/api/expenses'
import { calculatePeriodMetrics, formatCurrency } from '@/utils/finance'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useMemo } from 'react'

export default function AgencyHealthBar() {
  const navigate = useNavigate()
  const now = new Date()
  const monthStart = startOfMonth(now)
  const monthEnd = endOfMonth(now)

  const { data: clientsData, isLoading: loadingClients } = useClients()
  const { data: invoices = [], isLoading: loadingInvoices } = useInvoices()
  const { data: transactions = [], isLoading: loadingTx } = useTransactions()
  const { data: expenses = [], isLoading: loadingExp } = useExpenses()

  const activeClients = clientsData?.realClients?.length ?? 0

  const metrics = calculatePeriodMetrics({
    transactions,
    expenses,
    invoices,
    periodStart: monthStart,
    periodEnd: monthEnd,
    method: 'CASH', // default to cash for high level agency view
  })

  const { revenue, expense, profit, margin } = metrics

  const isLoading = loadingClients || loadingInvoices || loadingTx || loadingExp

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card
            key={i}
            className="rounded-2xl border-none bg-card/50 shadow-sm ring-1 ring-border/50"
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4 rounded-full" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-32 mt-1" />
              <Skeleton className="h-3 w-20 mt-2" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. NET PROFIT */}
      <Card className="rounded-2xl gap-4 border-none bg-card/50 shadow-sm ring-1 ring-border/50 dark:bg-card/20 group hover:ring-emerald-500/20 transition-all">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Net Profit (Mo)
          </CardTitle>
          <div className="h-8 w-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
            <Activity className="h-4 w-4 text-emerald-500" />
          </div>
        </CardHeader>
        <CardContent>
          <div
            className={`text-2xl font-bold tracking-tight ${profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}
          >
            {profit > 0 ? '+' : ''}
            {formatCurrency(profit)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {margin.toFixed(1)}% margin
          </p>
        </CardContent>
      </Card>

      {/* 2. REVENUE */}
      <Card className="rounded-2xl gap-4 border-none bg-card/50 shadow-sm ring-1 ring-border/50 dark:bg-card/20 group hover:ring-primary/20 transition-all">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Revenue (Mo)
          </CardTitle>
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
            <TrendingUp className="h-4 w-4 text-primary" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold tracking-tight text-foreground">
            {formatCurrency(revenue)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Cash received this month
          </p>
        </CardContent>
      </Card>

      {/* 3. EXPENSES */}
      <Card className="rounded-2xl gap-4 border-none bg-card/50 shadow-sm ring-1 ring-border/50 dark:bg-card/20 group hover:ring-rose-500/20 transition-all">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Expenses (Mo)
          </CardTitle>
          <div className="h-8 w-8 rounded-full bg-rose-500/10 flex items-center justify-center">
            <TrendingDown className="h-4 w-4 text-rose-500" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold tracking-tight text-foreground">
            {formatCurrency(expense)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Subscriptions + One-offs
          </p>
        </CardContent>
      </Card>

      {/* 4. ACTIVE CLIENTS */}
      <Card className="rounded-2xl gap-4 border-none bg-card/50 shadow-sm ring-1 ring-border/50 dark:bg-card/20 group hover:ring-blue-500/20 transition-all">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Active Clients
          </CardTitle>
          <div className="h-8 w-8 rounded-full bg-blue-500/10 flex items-center justify-center">
            <Users className="h-4 w-4 text-blue-500" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold tracking-tight text-foreground">
            {activeClients}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Excluding internal operations
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
