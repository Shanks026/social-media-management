import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { PieChart, Pie, Cell } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import { AlertCircle, ArrowUpRight, CheckCircle2 } from 'lucide-react'
import { useGlobalPosts } from '@/api/useGlobalPosts'
import { Button } from '@/components/ui/button'
import { getPublishState } from '@/lib/helper'
import {
  POST_CHART_CONFIG as chartConfig,
  ALLOWED_CHART_STATUSES as ALLOWED_STATUSES,
  STATUS_DISPLAY_MAP,
} from '@/lib/post-statuses'

function normalizeStatus(raw) {
  if (!raw) return 'DRAFT'
  return STATUS_DISPLAY_MAP[raw] ?? null
}

// Stable reference for the empty-state placeholder arc (avoids re-animating it).
const EMPTY_PIE = [{ name: 'empty', value: 1 }]

export default function ContentPipelineBar() {
  const navigate = useNavigate()
  const { data: posts = [], isLoading: loadingPosts } = useGlobalPosts()

  // Derive the chart data once per posts change. Recomputing inline on every
  // render hands Recharts a new `data` array reference each time, which
  // restarts/interrupts the donut's entry animation (the "not smooth" jank).
  // React Query's structural sharing keeps `posts` stable when unchanged, so
  // this memo — and the chart — stays stable across incidental re-renders.
  const { chartData, pieChartData, totalPosts, needsRevisionCount, changesRequestedCount, pendingApprovalCount, submittedCount } = useMemo(() => {
    const counts = ALLOWED_STATUSES.reduce((acc, status) => {
      acc[status] = 0
      return acc
    }, {})

    posts.forEach((post) => {
      const status = normalizeStatus(getPublishState(post))
      if (status && ALLOWED_STATUSES.includes(status)) {
        counts[status] += 1
      }
    })

    const nextChartData = ALLOWED_STATUSES.map((name) => ({
      name,
      value: counts[name],
      fill: chartConfig[name].color,
    }))

    const nextTotalPosts = posts.filter((post) => {
      let status = getPublishState(post)?.replace(/_/g, ' ') || 'DRAFT'
      if (status === 'PENDING') status = 'PENDING APPROVAL'
      if (status === 'REVISIONS') status = 'NEEDS REVISION'
      return ALLOWED_STATUSES.includes(status)
    }).length

    return {
      chartData: nextChartData,
      pieChartData: nextChartData.filter((d) => d.value > 0),
      totalPosts: nextTotalPosts,
      needsRevisionCount: counts['NEEDS REVISION'] || 0,
      changesRequestedCount: counts['CHANGES REQUESTED'] || 0,
      pendingApprovalCount: counts['PENDING APPROVAL'] || 0,
      submittedCount: counts['SUBMITTED'] || 0,
    }
  }, [posts])

  return (
    <Card className="border-none shadow-sm ring-1 ring-border/50 bg-card/50 dark:bg-card/30 flex flex-col h-full">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg font-medium bricolage">
              Workflow Health
            </CardTitle>
            <CardDescription>
              Pipeline distribution across all clients
            </CardDescription>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 -mr-2"
            onClick={() => navigate('/posts')}
          >
            <ArrowUpRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        {loadingPosts ? (
          <div className="h-[280px] w-full mt-2 flex flex-col items-center justify-center">
            <Skeleton className="h-[220px] w-[220px] rounded-full" />
            <div className="w-full flex justify-between mt-6 px-4">
              <div className="flex items-center gap-2">
                <Skeleton className="h-3 w-3 rounded-full" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="h-3 w-8" />
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-col w-full h-full items-center justify-center">
              <div className="h-[200px] w-full relative">
                <ChartContainer config={chartConfig} className="h-full w-full">
                  <PieChart>
                    <Pie
                      data={totalPosts === 0 ? EMPTY_PIE : pieChartData}
                      cx="50%"
                      cy="80%"
                      startAngle={180}
                      endAngle={0}
                      innerRadius={110}
                      outerRadius={150}
                      paddingAngle={totalPosts === 0 ? 0 : 2}
                      cornerRadius={6}
                      dataKey="value"
                      nameKey="name"
                      stroke="none"
                    >
                      {totalPosts === 0 ? (
                        <Cell fill="var(--border)" />
                      ) : (
                        pieChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))
                      )}
                    </Pie>
                    {totalPosts > 0 && (
                      <ChartTooltip
                        cursor={false}
                        content={<ChartTooltipContent hideLabel />}
                      />
                    )}
                  </PieChart>
                </ChartContainer>
                <div
                  className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
                  style={{ top: '35%' }}
                >
                  {totalPosts === 0 ? (
                    <>
                      <span className="text-3xl font-bold text-muted-foreground/30">0</span>
                      <span className="text-[11px] mt-1 text-muted-foreground/40 font-medium uppercase tracking-wider">
                        Deliverables
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-3xl font-bold text-primary">{totalPosts}</span>
                      <span className="text-[11px] mt-1 text-muted-foreground font-medium uppercase tracking-wider">
                        Deliverables
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Legend */}
              <div className="flex flex-col gap-2.5 mt-4 w-full px-3">
                {chartData.map((data, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center justify-between text-xs ${totalPosts === 0 ? 'opacity-40' : ''}`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: data.fill }}
                      />
                      <span className="text-muted-foreground capitalize">
                        {data.name.toLowerCase()}
                      </span>
                    </div>
                    <span className="font-semibold tabular-nums">
                      {data.value}
                    </span>
                  </div>
                ))}
              </div>

              {/* Bottleneck Alert */}
              {totalPosts > 0 && (
                <div className="mt-4 pt-3 border-t border-border/40 w-full px-3">
                  {needsRevisionCount > 0 ? (
                    <div className="flex items-center gap-2 border-l-2 border-destructive pl-3">
                      <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                      <span className="text-xs text-destructive font-medium">
                        {needsRevisionCount} deliverable{needsRevisionCount !== 1 && 's'} require client revision
                      </span>
                    </div>
                  ) : changesRequestedCount > 0 ? (
                    <div className="flex items-center gap-2 border-l-2 border-amber-500 pl-3">
                      <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                      <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                        {changesRequestedCount} deliverable{changesRequestedCount !== 1 && 's'} need internal changes
                      </span>
                    </div>
                  ) : pendingApprovalCount > 0 ? (
                    <div className="flex items-center gap-2 border-l-2 border-orange-500 pl-3">
                      <AlertCircle className="h-3.5 w-3.5 text-orange-500 shrink-0" />
                      <span className="text-xs text-orange-600 dark:text-orange-400 font-medium">
                        {pendingApprovalCount} deliverable{pendingApprovalCount !== 1 && 's'} awaiting client approval
                      </span>
                    </div>
                  ) : submittedCount > 0 ? (
                    <div className="flex items-center gap-2 border-l-2 border-violet-500 pl-3">
                      <AlertCircle className="h-3.5 w-3.5 text-violet-500 shrink-0" />
                      <span className="text-xs text-violet-600 dark:text-violet-400 font-medium">
                        {submittedCount} deliverable{submittedCount !== 1 && 's'} pending internal review
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 border-l-2 border-emerald-500 pl-3">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                        Pipeline is looking good!
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
