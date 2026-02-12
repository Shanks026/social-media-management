import { useState, useMemo } from 'react'
import {
  TrendingUp,
  TrendingDown,
  Activity,
  AlertCircle,
  Filter,
  Info,
  Building2,
  Banknote,
  FileText,
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import {
  startOfMonth,
  endOfMonth,
  subMonths,
  format,
  isWithinInterval,
} from 'date-fns'

// UI Components
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from '@/components/ui/chart'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

// API Hooks
import { useTransactions } from '@/api/transactions'
import { useExpenses } from '@/api/expenses'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

// --- CHART CONFIGURATION ---
const chartConfig = {
  income: {
    label: 'Revenue',
    color: 'hsl(var(--chart-2))', // Emerald
  },
  expenses: {
    label: 'Expenses',
    color: 'hsl(var(--chart-5))', // Rose
  },
}

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)
}

export default function OverviewPage() {
  const [viewMode, setViewMode] = useState('ALL') // ALL, INTERNAL, CLIENTS
  const [accountingMethod, setAccountingMethod] = useState('CASH') // CASH, ACCRUAL

  const { data: transactions = [], isLoading: loadingTx } = useTransactions()
  const { data: expenses = [], isLoading: loadingExp } = useExpenses()

  const { data: clientData } = useQuery({
    queryKey: ['clients-list'],
    queryFn: async () => {
      const { data } = await supabase.from('clients').select('id, is_internal')
      return { internalAccount: data?.find((c) => c.is_internal) }
    },
  })
  const internalAccount = clientData?.internalAccount

  const dashboardData = useMemo(() => {
    if (loadingTx || loadingExp) return null

    const today = new Date()
    const currentMonthStart = startOfMonth(today)
    const currentMonthEnd = endOfMonth(today)

    // --- 1. Filter Transactions/Expenses based on View Mode ---
    const filteredExpenses = expenses.filter((e) => {
      if (viewMode === 'ALL') return true
      if (viewMode === 'INTERNAL')
        return (
          e.assigned_client_id === null ||
          e.assigned_client_id === internalAccount?.id
        )
      if (viewMode === 'CLIENTS')
        return (
          e.assigned_client_id !== null &&
          e.assigned_client_id !== internalAccount?.id
        )
      return true
    })

    const filteredTransactions = transactions.filter((t) => {
      if (viewMode === 'ALL') return true
      if (viewMode === 'INTERNAL')
        return t.client_id === null || t.client_id === internalAccount?.id
      if (viewMode === 'CLIENTS')
        return t.client_id !== null && t.client_id !== internalAccount?.id
      return true
    })

    // --- 2. Calculate Monthly Burn (Recurring) ---
    const calculateRecurringBurn = (dateLimit) => {
      let total = 0
      filteredExpenses.forEach((e) => {
        const createdAt = new Date(e.created_at)
        if (createdAt <= dateLimit) {
          const cost = parseFloat(e.cost)
          if (e.billing_cycle === 'MONTHLY') total += cost
          else if (e.billing_cycle === 'QUARTERLY') total += cost / 3
          else if (e.billing_cycle === 'YEARLY') total += cost / 12
        }
      })
      return total
    }

    const currentMonthlyBurn = calculateRecurringBurn(currentMonthEnd)

    // --- 3. Calculate Current Month Metrics ---
    let monthInvoiced = 0 // Accrual (All Income)
    let monthCollected = 0 // Cash (Only Paid)
    let monthOneOffExpense = 0
    let pendingIncome = 0 // Global Pending
    let overdueIncome = 0 // Global Overdue

    filteredTransactions.forEach((t) => {
      const tDate = new Date(t.date)
      const amount = parseFloat(t.amount)

      // A. Global Counters (Status checks regardless of date)
      if (t.type === 'INCOME') {
        if (t.status === 'PENDING') pendingIncome += amount
        if (t.status === 'OVERDUE') overdueIncome += amount
      }

      // B. Monthly Interval Counters
      if (
        isWithinInterval(tDate, {
          start: currentMonthStart,
          end: currentMonthEnd,
        })
      ) {
        if (t.type === 'INCOME') {
          monthInvoiced += amount // Count everything for Accrual
          if (t.status === 'PAID') {
            monthCollected += amount // Count only PAID for Cash
          }
        }
        if (t.type === 'EXPENSE') {
          monthOneOffExpense += amount
        }
      }
    })

    const totalMonthExpense = monthOneOffExpense + currentMonthlyBurn

    // --- 4. Determine Display Values based on Toggle ---
    const displayedRevenue =
      accountingMethod === 'CASH' ? monthCollected : monthInvoiced

    // Profit = Revenue - Expenses
    const netProfit = displayedRevenue - totalMonthExpense

    // Margin = Profit / Revenue
    const margin =
      displayedRevenue > 0 ? (netProfit / displayedRevenue) * 100 : 0

    // --- 5. Prepare Historical Chart Data ---
    const chartData = []
    for (let i = 5; i >= 0; i--) {
      const date = subMonths(today, i)
      const monthStart = startOfMonth(date)
      const monthEnd = endOfMonth(date)
      const monthLabel = format(date, 'MMM')

      let incomeAccrual = 0
      let incomeCash = 0
      let oneOffExpense = 0

      filteredTransactions.forEach((t) => {
        const tDate = new Date(t.date)
        if (isWithinInterval(tDate, { start: monthStart, end: monthEnd })) {
          const amt = parseFloat(t.amount)
          if (t.type === 'INCOME') {
            incomeAccrual += amt
            if (t.status === 'PAID') incomeCash += amt
          }
          if (t.type === 'EXPENSE') oneOffExpense += amt
        }
      })

      const historicalRecurring = calculateRecurringBurn(monthEnd)

      chartData.push({
        month: monthLabel,
        // Chart also respects the toggle!
        income: accountingMethod === 'CASH' ? incomeCash : incomeAccrual,
        expenses: oneOffExpense + historicalRecurring,
      })
    }

    return {
      displayedRevenue,
      totalMonthExpense,
      netProfit,
      margin,
      pendingIncome,
      overdueIncome,
      chartData,
      filteredTransactions,
    }
  }, [
    transactions,
    expenses,
    loadingTx,
    loadingExp,
    viewMode,
    internalAccount,
    accountingMethod,
  ])

  if (!dashboardData) return <DashboardSkeleton />

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      {/* --- HEADER ACTIONS --- */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-normal">Performance Metrics</span>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          {/* CASH vs ACCRUAL TOGGLE */}
          <Tabs
            value={accountingMethod}
            onValueChange={setAccountingMethod}
            className="w-full sm:w-auto"
          >
            <TabsList className="grid w-full grid-cols-2 h-9">
              <TabsTrigger value="CASH" className="text-xs">
                <Banknote className="w-3.5 h-3.5 mr-2" />
                Cash
              </TabsTrigger>
              <TabsTrigger value="ACCRUAL" className="text-xs">
                <FileText className="w-3.5 h-3.5 mr-2" />
                Accrual
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* VIEW FILTER */}
          <Select value={viewMode} onValueChange={setViewMode}>
            <SelectTrigger className="w-[180px] h-9 rounded-md border-dashed shadow-sm bg-background/50">
              <div className="flex items-center gap-2 text-xs">
                <Filter className="h-3.5 w-3.5" />
                <SelectValue placeholder="Select View" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Combined View</SelectItem>
              <SelectItem value="INTERNAL">Agency Only</SelectItem>
              <SelectItem value="CLIENTS">Client Projects</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* --- KPI CARDS --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. NET PROFIT */}
        <Card className="rounded-2xl border-none bg-card/50 shadow-sm ring-1 ring-border/50 dark:bg-card/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {accountingMethod === 'CASH'
                ? 'Net Profit (Cash)'
                : 'Net Profit (Accrual)'}
            </CardTitle>
            <Activity className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold tracking-tight ${dashboardData.netProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}
            >
              {dashboardData.netProfit > 0 ? '+' : ''}
              {formatCurrency(dashboardData.netProfit)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {viewMode === 'INTERNAL'
                ? 'Operational savings'
                : `${dashboardData.margin.toFixed(1)}% margin`}
            </p>
          </CardContent>
        </Card>

        {/* 2. REVENUE */}
        <Card className="rounded-2xl border-none bg-card/50 shadow-sm ring-1 ring-border/50 dark:bg-card/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {accountingMethod === 'CASH'
                ? 'Cash Inflow (Mo)'
                : 'Invoiced (Mo)'}
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-foreground">
              {formatCurrency(dashboardData.displayedRevenue)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {accountingMethod === 'CASH'
                ? 'Received this month'
                : 'Billed this month'}
            </p>
          </CardContent>
        </Card>

        {/* 3. EXPENSES */}
        <Card className="rounded-2xl border-none bg-card/50 shadow-sm ring-1 ring-border/50 dark:bg-card/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Expenses (Mo)
            </CardTitle>
            <TrendingDown className="h-4 w-4 text-rose-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-foreground">
              {formatCurrency(dashboardData.totalMonthExpense)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Subscriptions + One-offs
            </p>
          </CardContent>
        </Card>

        {/* 4. PENDING INVOICES (Always visible context) */}
        <Card className="rounded-2xl border-none bg-amber-50/50 dark:bg-amber-950/20 shadow-sm ring-1 ring-amber-200/50 dark:ring-amber-800/30">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-xs font-medium text-amber-700 dark:text-amber-500 uppercase tracking-wider">
                Pending Invoices
              </CardTitle>
              <TooltipProvider>
                <UITooltip>
                  <TooltipTrigger>
                    <Info className="h-3 w-3 text-amber-600/70" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Total unpaid income from Ledger</p>
                  </TooltipContent>
                </UITooltip>
              </TooltipProvider>
            </div>
            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-amber-700 dark:text-amber-500">
              {formatCurrency(
                dashboardData.pendingIncome + dashboardData.overdueIncome,
              )}
            </div>
            <p className="text-xs text-amber-600/70 dark:text-amber-400/70 mt-1">
              {dashboardData.overdueIncome > 0 ? (
                <span className="text-rose-600 font-semibold">
                  Incl. {formatCurrency(dashboardData.overdueIncome)} overdue
                </span>
              ) : (
                `Unpaid ${viewMode === 'INTERNAL' ? 'transfers' : 'invoices'}`
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* --- TREND & LIST GRID --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* CHART */}
        <Card className="lg:col-span-2 rounded-2xl border-border/50 shadow-sm flex flex-col h-[400px] bg-card/50 dark:bg-card/20">
          <CardHeader className="pb-2 flex-shrink-0">
            <CardTitle className="text-lg font-medium tracking-normal text-foreground">
              Profitability Trend
            </CardTitle>
            <p className="text-sm text-muted-foreground font-light">
              {accountingMethod === 'CASH'
                ? 'Cash Collected'
                : 'Total Invoiced'}{' '}
              vs Expenses (Last 6 Months)
            </p>
          </CardHeader>
          <CardContent className="flex-1 min-h-0">
            <ChartContainer config={chartConfig} className="w-full h-full">
              <BarChart
                accessibilityLayer
                data={dashboardData.chartData}
                margin={{ top: 10, left: -20, right: 10 }}
              >
                <CartesianGrid
                  vertical={false}
                  className="stroke-border"
                  strokeDasharray="3 3"
                />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  tickMargin={10}
                  axisLine={false}
                  className="text-muted-foreground text-[10px]"
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={10}
                  fontSize={10}
                  className="text-muted-foreground"
                  tickFormatter={(value) => `₹${value / 1000}k`}
                />
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent indicator="dashed" />}
                />
                <ChartLegend
                  content={<ChartLegendContent />}
                  className="text-foreground text-[10px]"
                />
                <Bar dataKey="income" fill="#10b981" radius={4} barSize={20} />
                <Bar
                  dataKey="expenses"
                  fill="#f43f5e"
                  radius={4}
                  barSize={20}
                />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* PENDING LIST */}
        <Card className="rounded-xl bg-card/50 dark:bg-card/20 border-border/50 shadow-sm gap-0 flex flex-col">
          <CardHeader className="px-6 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div>
                <CardTitle className="text-lg font-medium tracking-tight text-slate-900 dark:text-slate-100">
                  Pending Invoices
                </CardTitle>
                <p className="text-sm text-muted-foreground font-light">
                  Currently awaiting collection
                </p>
              </div>
            </div>
          </CardHeader>

          <CardContent className="flex-1 overflow-auto px-6 custom-scrollbar">
            <div className="space-y-0 pb-4">
              {dashboardData.filteredTransactions.filter(
                (t) => t.status === 'PENDING' && t.type === 'INCOME',
              ).length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center py-20 text-center">
                  <div className="h-16 w-16 rounded-full bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center mb-4">
                    <TrendingUp className="h-8 w-8 text-slate-300" />
                  </div>
                  <p className="text-base font-medium text-slate-900 dark:text-slate-100">
                    All clear
                  </p>
                  <p className="text-sm text-slate-500">
                    No pending payments found.
                  </p>
                </div>
              ) : (
                dashboardData.filteredTransactions
                  .filter((t) => t.status === 'PENDING' && t.type === 'INCOME')
                  .sort((a, b) => new Date(b.date) - new Date(a.date))
                  .slice(0, 6)
                  .map((t) => (
                    <div
                      key={t.id}
                      className="group flex items-center justify-between py-4 px-2 border-b transition-all duration-200"
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        {/* Avatar */}
                        <div className="flex-shrink-0">
                          {t.client?.is_internal || !t.client_id ? (
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center border border-primary/5">
                              <Building2 className="h-5 w-5 text-primary" />
                            </div>
                          ) : t.client?.logo_url ? (
                            <img
                              src={t.client.logo_url}
                              className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                              alt=""
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-sm font-semibold text-slate-600 dark:text-slate-300">
                              {t.client?.name?.charAt(0) || 'C'}
                            </div>
                          )}
                        </div>
                        {/* Data */}
                        <div className="min-w-0">
                          <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate mb-0.5">
                            {t.client?.is_internal || !t.client_id
                              ? 'My Agency'
                              : t.client?.name}
                          </h4>
                          <p className="text-sm text-muted-foreground truncate leading-tight mt-1">
                            {t.description}
                          </p>
                        </div>
                      </div>
                      <div className="text-right pl-4">
                        <span className="text-xs font-medium text-muted-foreground">
                          Due {format(new Date(t.date), 'MMM d')}
                        </span>
                        <span className="text-lg font-bold block tracking-tight">
                          {formatCurrency(t.amount)}
                        </span>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-9 w-[180px] rounded-full" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-32 rounded-2xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Skeleton className="lg:col-span-2 h-[400px] rounded-2xl" />
        <Skeleton className="h-[400px] rounded-2xl" />
      </div>
    </div>
  )
}
