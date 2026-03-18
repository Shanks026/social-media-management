import { useMemo } from 'react'
import { TrendingUp, TrendingDown, ArrowUpRight } from 'lucide-react'
import { Label, Pie, PieChart } from 'recharts'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import { Skeleton } from '@/components/ui/skeleton'
import { useFinanceOverview } from '@/api/transactions'
import { useBurnRate } from '@/api/expenses'
import { formatCurrency } from '@/utils/finance'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'

const COLORS = {
  profit: '#10b981', // emerald-500
  expenses: '#f43f5e', // rose-500
  empty: '#e2e8f0', // slate-200 (neutral muted)
}

const chartConfig = {
  value: { label: 'Amount' },
  profit: { label: 'Profit', color: COLORS.profit },
  expenses: { label: 'Expenses', color: COLORS.expenses },
  empty: { label: 'No data', color: COLORS.empty },
}

function formatCompact(amount) {
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(1)}Cr`
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(0)}K`
  return `₹${amount.toFixed(0)}`
}

export default function LifetimeRevenue() {
  const navigate = useNavigate()
  const { data: overview, isLoading: isLoadingOverview } = useFinanceOverview()
  const { data: burnRate = 0, isLoading: isLoadingBurn } = useBurnRate()
  const isLoading = isLoadingOverview || isLoadingBurn

  const { chartData, totalRevenue, totalExpenses, profit, margin, isEmpty, isSingleSegment } =
    useMemo(() => {
      const totalRevenue = parseFloat(overview?.total_income) || 0
      const oneOff = parseFloat(overview?.total_one_off_expenses) || 0
      const totalExpenses = oneOff + Number(burnRate)
      const rawProfit = totalRevenue - totalExpenses
      const profit = Math.max(0, rawProfit)
      const margin = totalRevenue > 0 ? (rawProfit / totalRevenue) * 100 : 0
      const isEmpty = totalRevenue === 0 && totalExpenses === 0

      const chartData = isEmpty
        ? [{ name: 'empty', value: 1, fill: COLORS.empty }]
        : totalRevenue > 0
          ? [
              { name: 'profit', value: profit, fill: COLORS.profit },
              {
                name: 'expenses',
                value: Math.min(totalExpenses, totalRevenue),
                fill: COLORS.expenses,
              },
            ].filter((d) => d.value > 0)
          : [
              {
                name: 'expenses',
                value: totalExpenses || 1,
                fill: COLORS.expenses,
              },
            ]

      const isSingleSegment = chartData.length === 1

      return { chartData, totalRevenue, totalExpenses, profit, margin, isEmpty, isSingleSegment }
    }, [overview, burnRate])

  return (
    <Card className="border-none shadow-sm ring-1 ring-border/50 bg-card/50 dark:bg-card/30 h-full flex flex-col">
      <CardHeader className="items-center pb-0">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg font-medium">
              Lifetime Revenue
            </CardTitle>
            <CardDescription>Total revenue vs expenses</CardDescription>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 -mr-2"
            onClick={() => navigate('/finance/overview')}
          >
            <ArrowUpRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex-1 min-h-0 pb-0 flex flex-col items-center justify-center">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Skeleton className="h-[220px] w-[220px] rounded-full" />
          </div>
        ) : (
          <ChartContainer
            config={chartConfig}
            className="mx-auto aspect-square w-full max-h-55"
          >
            <PieChart>
              {!isEmpty && (
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent hideLabel />}
                />
              )}
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                cornerRadius={isEmpty || isSingleSegment ? 0 : 6}
                paddingAngle={isEmpty || isSingleSegment ? 0 : 2}
                innerRadius={72}
                outerRadius={110}
                strokeWidth={isEmpty || isSingleSegment ? 0 : 4}
                stroke="hsl(var(--background))"
              >
                <Label
                  content={({ viewBox }) => {
                    if (viewBox && 'cx' in viewBox && 'cy' in viewBox) {
                      return (
                        <text
                          x={viewBox.cx}
                          y={viewBox.cy}
                          textAnchor="middle"
                          dominantBaseline="middle"
                        >
                          <tspan
                            x={viewBox.cx}
                            y={(viewBox.cy || 0) - 8}
                            className="fill-foreground text-2xl font-bold"
                          >
                            {formatCompact(totalRevenue)}
                          </tspan>
                          <tspan
                            x={viewBox.cx}
                            y={(viewBox.cy || 0) + 16}
                            className="fill-muted-foreground text-xs"
                          >
                            Total Revenue
                          </tspan>
                        </text>
                      )
                    }
                  }}
                />
              </Pie>
            </PieChart>
          </ChartContainer>
        )}
      </CardContent>

      <CardFooter className="flex-col gap-1.5 text-sm pt-4">
        {isLoading ? (
          <>
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-28" />
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 leading-none font-medium text-foreground">
              {margin >= 0 ? (
                <>
                  <span>{margin.toFixed(1)}% profit margin</span>
                  <TrendingUp
                    className="h-4 w-4"
                    style={{ color: COLORS.profit }}
                  />
                </>
              ) : (
                <>
                  <span>{Math.abs(margin).toFixed(1)}% loss margin</span>
                  <TrendingDown
                    className="h-4 w-4"
                    style={{ color: COLORS.expenses }}
                  />
                </>
              )}
            </div>
            <div className="flex gap-4 text-xs text-muted-foreground leading-none">
              <span className="flex items-center gap-1">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: COLORS.profit }}
                />
                {formatCurrency(profit)} profit
              </span>
              <span className="flex items-center gap-1">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: COLORS.expenses }}
                />
                {formatCurrency(totalExpenses)} expenses
              </span>
            </div>
          </>
        )}
      </CardFooter>
    </Card>
  )
}
