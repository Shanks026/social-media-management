import { PieChart, Pie, Cell } from 'recharts'
import { AlertCircle, ArrowUpRight, CheckCircle2 } from 'lucide-react'

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import { getPublishState } from '@/lib/helper'

const chartConfig = {
  'DRAFT':                { label: 'Draft',               color: '#3b82f6' },
  'PENDING APPROVAL':     { label: 'Pending Approval',    color: '#f97316' },
  'APPROVED':             { label: 'Approved',            color: '#22c55e' },
  'NEEDS REVISION':       { label: 'Needs Revision',      color: '#ec4899' },
  'SCHEDULED':            { label: 'Scheduled',           color: '#a855f7' },
  'DELIVERED':            { label: 'Delivered',           color: '#14b8a6' },
  'PARTIALLY PUBLISHED':  { label: 'Partially Published', color: '#84cc16' },
  'PUBLISHED':            { label: 'Published',           color: '#10b981' },
}

const ALLOWED_STATUSES = [
  'DRAFT',
  'PENDING APPROVAL',
  'APPROVED',
  'NEEDS REVISION',
  'SCHEDULED',
  'DELIVERED',
  'PARTIALLY PUBLISHED',
  'PUBLISHED',
]

const STATUS_DISPLAY_MAP = {
  DRAFT:                'DRAFT',
  PENDING_APPROVAL:     'PENDING APPROVAL',
  APPROVED:             'APPROVED',
  NEEDS_REVISION:       'NEEDS REVISION',
  SCHEDULED:            'SCHEDULED',
  DELIVERED:            'DELIVERED',
  PARTIALLY_PUBLISHED:  'PARTIALLY PUBLISHED',
  PUBLISHED:            'PUBLISHED',
}

function normalizeStatus(raw) {
  if (!raw) return 'DRAFT'
  return STATUS_DISPLAY_MAP[raw] ?? null
}

/**
 * WorkflowHealth — status-distribution donut + bottleneck alert over a set of
 * deliverables. Prop-driven so it can be scoped to all clients, one client, or
 * one campaign by passing the relevant `posts` array.
 *
 * @param posts        array of post-version rows (shape from useGlobalPosts)
 * @param isLoading    loading flag
 * @param title        card title
 * @param description  card subtitle
 * @param onViewAll    optional — shows a top-right arrow button when provided
 * @param excludeStatuses optional — status display names to hide (e.g. internal accounts)
 */
export default function WorkflowHealth({
  posts = [],
  isLoading = false,
  title = 'Workflow Health',
  description = 'Pipeline distribution',
  onViewAll,
  excludeStatuses = [],
  className,
}) {
  const visibleStatuses = ALLOWED_STATUSES.filter(
    (s) => !excludeStatuses.includes(s),
  )

  const postCounts = visibleStatuses.reduce((acc, status) => {
    acc[status] = 0
    return acc
  }, {})

  posts.forEach((post) => {
    const status = normalizeStatus(getPublishState(post))
    if (status && visibleStatuses.includes(status)) {
      postCounts[status] += 1
    }
  })

  const chartData = visibleStatuses.map((name) => ({
    name,
    value: postCounts[name],
    fill: chartConfig[name].color,
  }))

  const pieChartData = chartData.filter((d) => d.value > 0)
  const totalPosts = pieChartData.reduce((sum, d) => sum + d.value, 0)

  const needsRevisionCount = postCounts['NEEDS REVISION'] || 0
  const pendingApprovalCount = postCounts['PENDING APPROVAL'] || 0

  return (
    <Card className={className ?? 'border-none shadow-sm ring-1 ring-border/50 bg-card/50 flex flex-col h-full'}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg font-medium bricolage">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          {onViewAll && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 -mr-2"
              onClick={onViewAll}
            >
              <ArrowUpRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        {isLoading ? (
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
          <div className="flex flex-col w-full h-full items-center justify-center">
            <div className="h-[200px] w-full relative">
              <ChartContainer config={chartConfig} className="h-full w-full">
                <PieChart>
                  <Pie
                    data={totalPosts === 0 ? [{ name: 'empty', value: 1 }] : pieChartData}
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
                <span className={totalPosts === 0 ? 'text-3xl font-bold text-muted-foreground/30' : 'text-3xl font-bold text-primary'}>
                  {totalPosts}
                </span>
                <span className={totalPosts === 0
                  ? 'text-[11px] mt-1 text-muted-foreground/40 font-medium uppercase tracking-wider'
                  : 'text-[11px] mt-1 text-muted-foreground font-medium uppercase tracking-wider'}>
                  Deliverables
                </span>
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
                  <span className="font-semibold tabular-nums">{data.value}</span>
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
                      {needsRevisionCount} deliverable{needsRevisionCount !== 1 && 's'} require immediate revision
                    </span>
                  </div>
                ) : pendingApprovalCount > 0 ? (
                  <div className="flex items-center gap-2 border-l-2 border-amber-500 pl-3">
                    <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                    <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                      {pendingApprovalCount} deliverable{pendingApprovalCount !== 1 && 's'} awaiting approval
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
        )}
      </CardContent>
    </Card>
  )
}
