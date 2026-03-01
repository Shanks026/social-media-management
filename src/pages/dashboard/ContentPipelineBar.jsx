import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
} from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import { AlertCircle, CheckCircle2, FileText } from 'lucide-react'
import { useGlobalPosts } from '@/api/useGlobalPosts'

const chartConfig = {
  DRAFT: { label: 'Draft', color: '#3b82f6' },
  'PENDING APPROVAL': { label: 'Pending Approval', color: '#f97316' },
  'NEEDS REVISION': { label: 'Needs Revision', color: '#ec4899' },
  SCHEDULED: { label: 'Scheduled', color: '#a855f7' },
  PUBLISHED: { label: 'Published', color: '#10b981' },
}



const ALLOWED_STATUSES = [
  'DRAFT',
  'PENDING APPROVAL',
  'NEEDS REVISION',
  'SCHEDULED',
  'PUBLISHED',
]

export default function ContentPipelineBar() {
  const navigate = useNavigate()
  const { data: posts = [], isLoading: loadingPosts } = useGlobalPosts()



  // 1. Workflow Health
  const postCounts = ALLOWED_STATUSES.reduce((acc, status) => {
    acc[status] = 0
    return acc
  }, {})

  posts.forEach((post) => {
    let status = post.status?.replace('_', ' ') || 'DRAFT'
    if (status === 'PENDING') status = 'PENDING APPROVAL'
    if (status === 'REVISIONS') status = 'NEEDS REVISION'
    
    if (ALLOWED_STATUSES.includes(status)) {
      postCounts[status] += 1
    }
  })

  const chartData = ALLOWED_STATUSES.map((name) => ({
    name,
    value: postCounts[name],
    fill: chartConfig[name].color,
  }))

  const pieChartData = chartData.filter(d => d.value > 0)

  const totalPosts = posts.filter((post) => {
    let status = post.status?.replace('_', ' ') || 'DRAFT'
    if (status === 'PENDING') status = 'PENDING APPROVAL'
    if (status === 'REVISIONS') status = 'NEEDS REVISION'
    return ALLOWED_STATUSES.includes(status)
  }).length

  const needsRevisionCount = postCounts['NEEDS REVISION'] || 0
  const pendingApprovalCount = postCounts['PENDING APPROVAL'] || 0

  return (
    <Card className="border-none shadow-sm ring-1 ring-border/50 bg-card/50 flex flex-col h-full">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg font-medium">Workflow Health</CardTitle>
            <CardDescription>
              Pipeline distribution across all clients
            </CardDescription>
          </div>
          <button
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => navigate('/posts')}
          >
            View all →
          </button>
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
        ) : totalPosts === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-sm text-muted-foreground gap-2 py-10">
            <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center">
              <FileText className="h-5 w-5 text-muted-foreground/50" />
            </div>
            <p>No active posts</p>
          </div>
        ) : (
          <>
            <div className="flex flex-col w-full h-full items-center justify-center">
                <div className="h-[280px] w-full relative">
                  <ChartContainer config={chartConfig} className="h-full w-full">
                    <PieChart>
                      <Pie
                        data={pieChartData}
                        cx="50%"
                        cy="80%"
                        startAngle={180}
                        endAngle={0}
                        innerRadius={110}
                        outerRadius={150}
                        paddingAngle={2}
                        cornerRadius={6}
                        dataKey="value"
                        nameKey="name"
                        stroke="none"
                      >
                        {pieChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <ChartTooltip
                        cursor={false}
                        content={<ChartTooltipContent hideLabel />}
                      />
                    </PieChart>
                  </ChartContainer>
                  <div
                    className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
                    style={{ top: '35%' }}
                  >
                    <span className="text-3xl font-bold">{totalPosts}</span>
                    <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                      Posts
                    </span>
                  </div>
                </div>

                {/* Legend */}
                <div className="flex flex-col gap-2.5 mt-4 w-full px-3">
                  {chartData.map((data, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-xs"
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
                <div className="mt-4 pt-3 border-t border-border/40 w-full px-3">
                  {needsRevisionCount > 0 ? (
                    <div className="flex items-center gap-2 border-l-2 border-destructive pl-3">
                      <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                      <span className="text-xs text-destructive font-medium">
                        {needsRevisionCount} post{needsRevisionCount !== 1 && 's'} require immediate revision
                      </span>
                    </div>
                  ) : pendingApprovalCount > 0 ? (
                    <div className="flex items-center gap-2 border-l-2 border-amber-500 pl-3">
                      <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                      <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                        {pendingApprovalCount} post{pendingApprovalCount !== 1 && 's'} awaiting approval
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 border-l-2 border-emerald-500 pl-3">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Pipeline is looking good!</span>
                    </div>
                  )}
                </div>
              </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
