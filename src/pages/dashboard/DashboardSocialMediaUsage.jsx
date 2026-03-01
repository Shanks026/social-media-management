import React from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Cell,
  LabelList,
} from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import { Skeleton } from '@/components/ui/skeleton'
import { useGlobalPosts } from '@/api/useGlobalPosts'
import { SUPPORTED_PLATFORMS } from '@/lib/platforms'

const platformChartConfig = {
  posts: { label: 'Posts' },
  ...SUPPORTED_PLATFORMS.reduce((acc, p) => {
    acc[p.id] = { label: p.label, color: p.color }
    return acc
  }, {}),
}

const CustomPlatformTick = ({ x, y, payload }) => {
  return (
    <g transform={`translate(${x - 30},${y - 12})`}>
      <image
        href={`/platformIcons/${payload.value}.png`}
        height="24"
        width="24"
      />
    </g>
  )
}

export default function DashboardSocialMediaUsage() {
  const { data: posts = [], isLoading: loadingPosts } = useGlobalPosts()

  const platformData = React.useMemo(() => {
    const counts = {}

    // Always initialize all supported platforms to 0
    SUPPORTED_PLATFORMS.forEach((p) => {
      counts[p.id] = 0
    })

    if (posts && posts.length > 0) {
      posts.forEach((post) => {
        const plats = Array.isArray(post.platforms)
          ? post.platforms
          : post.platforms
            ? [post.platforms]
            : []
        plats.forEach((p) => {
          const platformId = p?.toLowerCase()
          if (counts[platformId] !== undefined) {
            counts[platformId] += 1
          }
        })
      })
    }

    return SUPPORTED_PLATFORMS.map((sp) => ({
      platform: sp.id,
      label: sp.label,
      posts: counts[sp.id],
      fill: `var(--color-${sp.id})`,
    })).sort((a, b) => b.posts - a.posts)
  }, [posts])

  return (
    <Card className="border-none shadow-sm ring-1 ring-border/50 bg-card/50 h-full flex flex-col">
      <CardHeader>
        <CardTitle className="text-lg font-medium">
          Social Media Usage
        </CardTitle>
        <CardDescription>
          Post distribution across platforms
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1">
        {loadingPosts ? (
          <div className="h-[250px] w-full flex flex-col gap-6 py-4 px-2">
            <div className="flex items-center gap-4">
              <Skeleton className="h-6 w-24 shrink-0" />
              <Skeleton className="h-4 w-[80%]" />
            </div>
            <div className="flex items-center gap-4">
              <Skeleton className="h-6 w-24 shrink-0" />
              <Skeleton className="h-4 w-[60%]" />
            </div>
            <div className="flex items-center gap-4">
              <Skeleton className="h-6 w-24 shrink-0" />
              <Skeleton className="h-4 w-[70%]" />
            </div>
            <div className="flex items-center gap-4">
              <Skeleton className="h-6 w-24 shrink-0" />
              <Skeleton className="h-4 w-[40%]" />
            </div>
            <div className="flex items-center gap-4">
              <Skeleton className="h-6 w-24 shrink-0" />
              <Skeleton className="h-4 w-[90%]" />
            </div>
          </div>
        ) : (
          <ChartContainer
            config={platformChartConfig}
            className="h-[250px] w-full"
          >
            <BarChart
              data={platformData}
              layout="vertical"
              margin={{ top: 0, right: 30, bottom: 0, left: 10 }}
            >
              <YAxis
                dataKey="platform"
                type="category"
                tickLine={false}
                axisLine={false}
                width={40}
                tick={<CustomPlatformTick />}
              />
              <XAxis dataKey="posts" type="number" hide />
              <ChartTooltip
                cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                content={<ChartTooltipContent hideIndicator />}
              />
              <Bar dataKey="posts" radius={[0, 4, 4, 0]} barSize={32}>
                <LabelList
                  dataKey="posts"
                  position="right"
                  className="fill-foreground font-medium text-xs"
                />
                {platformData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
