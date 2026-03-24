import { useState, useMemo } from 'react'
import {
  format,
  startOfMonth,
  endOfMonth,
  subMonths,
  isWithinInterval,
} from 'date-fns'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from '@/components/ui/chart'
import { ArrowUpRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useNavigate } from 'react-router-dom'
import { CURRENCY } from '@/utils/constants'
import { useTransactions } from '@/api/transactions'
import { useExpenses } from '@/api/expenses'
import { calculateRecurringBurn } from '@/utils/finance'

const chartConfig = {
  income: {
    label: 'Revenue',
    color: '#10b981', // emerald-500
  },
  expenses: {
    label: 'Expenses',
    color: '#f43f5e', // rose-500
  },
}

export default function FinancialSnapshot() {
  const navigate = useNavigate()
  const [chartRange, setChartRange] = useState('3M')
  const { data: transactions = [], isLoading: loadingTx } = useTransactions()
  const { data: expenses = [], isLoading: loadingExp } = useExpenses()

  const chartData = useMemo(() => {
    if (loadingTx || loadingExp) return []
    const today = new Date()
    const data = []

    // We'll use CASH method for the dashboard high-level overview
    const rangeMonths = parseInt(chartRange.replace('M', ''))
    for (let i = rangeMonths - 1; i >= 0; i--) {
      const date = subMonths(today, i)
      const monthStart = startOfMonth(date)
      const monthEnd = endOfMonth(date)
      const monthLabel = format(date, 'MMM')

      let incomeCash = 0
      let oneOffExpense = 0

      transactions.forEach((t) => {
        const tDate = new Date(t.date)
        if (isWithinInterval(tDate, { start: monthStart, end: monthEnd })) {
          const amt = parseFloat(t.amount) || 0
          if (t.type === 'INCOME' && t.status === 'PAID') {
            incomeCash += amt
          }
          if (t.type === 'EXPENSE') {
            oneOffExpense += amt
          }
        }
      })

      const historicalRecurring = calculateRecurringBurn(expenses, monthEnd)

      data.push({
        month: monthLabel,
        income: incomeCash,
        expenses: oneOffExpense + historicalRecurring,
      })
    }
    return data
  }, [transactions, expenses, chartRange, loadingTx, loadingExp])

  const isLoading = loadingTx || loadingExp

  return (
    <Card className="rounded-2xl border-none shadow-sm flex flex-col h-full min-h-80 bg-card/50 dark:bg-card/20 ring-1 ring-border/50">
      <CardHeader className="pb-2 shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-lg font-medium tracking-normal text-foreground">
              Profitability Trend
            </CardTitle>
            <p className="text-sm text-muted-foreground font-normal">
              Cash Collected vs Expenses (Last {chartRange.replace('M', ' ')}{' '}
              Months)
            </p>
          </div>
          <div className="flex items-center gap-2">
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
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 -mr-2"
              onClick={() => navigate('/finance/overview')}
            >
              <ArrowUpRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 pt-2">
        {isLoading ? (
          <div className="w-full h-full flex items-center justify-center">
            <Skeleton className="w-full h-[300px]" />
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="w-full h-full">
            <BarChart
              accessibilityLayer
              data={chartData}
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
                allowDecimals={false}
                domain={[0, (dataMax) => Math.max(dataMax, 1000)]}
                className="text-muted-foreground"
                tickFormatter={(value) => {
                  if (value === 0) return `${CURRENCY.SYMBOL}0`
                  if (value >= 1000)
                    return `${CURRENCY.SYMBOL}${Math.round(value / 1000)}k`
                  return `${CURRENCY.SYMBOL}${Math.round(value)}`
                }}
              />
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent indicator="dashed" />}
              />
              <ChartLegend
                content={<ChartLegendContent />}
                className="text-foreground text-[10px]"
              />
              <Bar
                dataKey="income"
                fill={chartConfig.income.color}
                radius={4}
                barSize={20}
              />
              <Bar
                dataKey="expenses"
                fill={chartConfig.expenses.color}
                radius={4}
                barSize={20}
              />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
