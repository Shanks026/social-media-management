import { useState, useMemo } from 'react'
import {
  TrendingUp,
  TrendingDown,
  Activity,
  AlertCircle,
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
import {
  calculatePeriodMetrics,
  calculateRecurringBurn,
  formatCurrency,
} from '@/utils/finance'
import { CURRENCY } from '@/utils/constants'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
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
import { useInvoices } from '@/api/invoices'
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

export default function OverviewPage({ clientId, client, subTabs }) {
  const [accountingMethod, setAccountingMethod] = useState('CASH') // CASH, ACCRUAL
  const [chartRange, setChartRange] = useState('3M') // 3M, 6M, 12M

  const { data: transactions = [], isLoading: loadingTx } = useTransactions({})
  const { data: expenses = [], isLoading: loadingExp } = useExpenses({})

  // Invoice data for pending KPI (agency-wide)
  const { data: invoices = [] } = useInvoices({})

  const outstandingInvoiceTotal = useMemo(() => {
    return invoices
      .filter((inv) => inv.status === 'SENT' || inv.status === 'OVERDUE')
      .reduce((sum, inv) => sum + (inv.total || 0), 0)
  }, [invoices])

  const dashboardData = useMemo(() => {
    if (loadingTx || loadingExp) return null

    const today = new Date()
    const currentMonthStart = startOfMonth(today)
    const currentMonthEnd = endOfMonth(today)

    // --- Calculate Current Month Metrics via Utility ---
    const metrics = calculatePeriodMetrics({
      transactions,
      expenses,
      invoices,
      periodStart: currentMonthStart,
      periodEnd: currentMonthEnd,
      method: accountingMethod,
    })

    const {
      revenue: displayedRevenue,
      expense: totalMonthExpense,
      profit: netProfit,
      margin,
      pending: pendingIncome,
      overdue: overdueIncome,
    } = metrics

    // --- 5. Prepare Historical Chart Data ---
    const chartData = []

    // Pre-collect linked invoice IDs (those with PAID transactions)
    const linkedInvoiceIds = new Set()
    transactions.forEach((t) => {
      if (t.invoice_id && t.status === 'PAID') {
        linkedInvoiceIds.add(t.invoice_id)
      }
    })

    const rangeMonths = parseInt(chartRange.replace('M', ''))
    for (let i = rangeMonths - 1; i >= 0; i--) {
      const date = subMonths(today, i)
      const monthStart = startOfMonth(date)
      const monthEnd = endOfMonth(date)
      const monthLabel = format(date, 'MMM')

      let incomeAccrual = 0
      let incomeCash = 0
      let oneOffExpense = 0

      transactions.forEach((t) => {
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

      // In ACCRUAL mode, also include SENT/OVERDUE invoice amounts
      if (accountingMethod === 'ACCRUAL') {
        invoices.forEach((inv) => {
          if (
            (inv.status === 'SENT' || inv.status === 'OVERDUE') &&
            !linkedInvoiceIds.has(inv.id)
          ) {
            const invDate = new Date(inv.issue_date)
            if (
              isWithinInterval(invDate, { start: monthStart, end: monthEnd })
            ) {
              incomeAccrual += parseFloat(inv.total) || 0
            }
          }
        })
      }

      const historicalRecurring = calculateRecurringBurn(expenses, monthEnd)

      chartData.push({
        month: monthLabel,
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
      filteredTransactions: transactions,
    }
  }, [
    expenses,
    invoices,
    loadingTx,
    loadingExp,
    accountingMethod,
    chartRange,
    transactions,
  ])

  if (!dashboardData) return <DashboardSkeleton />

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* --- HEADER ACTIONS --- */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {subTabs ? (
            subTabs
          ) : (
            <span className="text-2xl font-normal">Performance Metrics</span>
          )}
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
              {`${dashboardData.margin.toFixed(1)}% margin`}
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

        {/* 4. PENDING INVOICES */}
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
                    <p>Unpaid ledger entries + outstanding invoices</p>
                  </TooltipContent>
                </UITooltip>
              </TooltipProvider>
            </div>
            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-amber-700 dark:text-amber-500">
              {formatCurrency(
                dashboardData.pendingIncome +
                  dashboardData.overdueIncome +
                  outstandingInvoiceTotal,
              )}
            </div>
            <p className="text-xs text-amber-600/70 dark:text-amber-400/70 mt-1">
              {dashboardData.overdueIncome > 0 ? (
                <span className="text-rose-600 font-semibold">
                  Incl. {formatCurrency(dashboardData.overdueIncome)} overdue
                </span>
              ) : (
                'Unpaid invoices'
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* --- TREND & LIST GRID --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* CHART */}
        <Card className="lg:col-span-2 rounded-2xl border-border/50 shadow-sm flex flex-col h-[400px] bg-card/50 dark:bg-card/20">
          <CardHeader className="pb-2 shrink-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg font-medium tracking-normal text-foreground">
                  Profitability Trend
                </CardTitle>
                <p className="text-sm text-muted-foreground font-light">
                  {accountingMethod === 'CASH'
                    ? 'Cash Collected'
                    : 'Total Invoiced'}{' '}
                  vs Expenses (Last {chartRange.replace('M', ' ')} Months)
                </p>
              </div>
              <Tabs
                value={chartRange}
                onValueChange={setChartRange}
                className="w-full sm:w-auto"
              >
                <TabsList className="h-8 bg-muted/50 p-0.5 border">
                  <TabsTrigger value="3M" className="text-[10px] h-7 px-2">
                    3M
                  </TabsTrigger>
                  <TabsTrigger value="6M" className="text-[10px] h-7 px-2">
                    6M
                  </TabsTrigger>
                  <TabsTrigger value="12M" className="text-[10px] h-7 px-2">
                    12M
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
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
                  tickFormatter={(value) =>
                    `${CURRENCY.SYMBOL}${value / 1000}k`
                  }
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

        {/* SIDE PANEL — Pending Invoices */}
        <Card className="rounded-xl bg-card/50 dark:bg-card/20 border-border/50 shadow-sm gap-0 flex flex-col">
          <CardHeader className="px-6 shrink-0">
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
                        <div className="shrink-0">
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
