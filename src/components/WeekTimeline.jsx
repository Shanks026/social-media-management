import { useMemo } from 'react'
import {
  format,
  isToday,
  isTomorrow,
  addDays,
  startOfDay,
  endOfDay,
  eachDayOfInterval,
} from 'date-fns'
import { useNavigate } from 'react-router-dom'
import { ArrowUpRight, Clock } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ClientAvatar } from '@/components/tasks/ClientAvatar'
import { useWeekPosts } from '@/api/posts'
import { useMeetingsBetween } from '@/api/meetings'
import { platformLabel, platformLogo } from '@/lib/domain/platforms'
import { cn } from '@/lib/utils'

const MAX_ITEMS_PER_DAY = 3

function PlatformImg({ platformId }) {
  const label = platformLabel(platformId)
  return (
    <img
      src={platformLogo(platformId)}
      alt={label}
      title={label}
      className="size-5 rounded-sm object-contain"
    />
  )
}

function AvatarStack({ clients }) {
  const visible = clients.slice(0, 3)
  const extra = clients.length - 3
  return (
    <div className="flex items-center -space-x-1.5">
      {visible.map((client) => (
        <div key={client.id} className="ring-2 ring-card rounded-full" title={client.name}>
          <ClientAvatar client={client} size="sm" />
        </div>
      ))}
      {extra > 0 && (
        <div className="size-5 rounded-full bg-muted ring-2 ring-card flex items-center justify-center">
          <span className="text-[9px] font-medium text-muted-foreground">+{extra}</span>
        </div>
      )}
    </div>
  )
}

function groupByDay(items, dateField) {
  const map = {}
  for (const item of items) {
    const key = format(new Date(item[dateField]), 'yyyy-MM-dd')
    ;(map[key] ??= []).push(item)
  }
  return map
}

function uniqueClients(posts) {
  const byId = {}
  for (const p of posts) {
    byId[p.client_id] ??= {
      id: p.client_id,
      name: p.client_name,
      logo_url: p.client_logo,
      is_internal: p.is_internal,
    }
  }
  return Object.values(byId)
}

/**
 * The next seven days of Scheduled or Approved Deliverables and meetings, for
 * one Client (`clientId`) or, without it, the whole workspace (the dashboard).
 * The workspace view also shows which Clients each day's work is for.
 */
export default function WeekTimeline({ clientId = null }) {
  const navigate = useNavigate()
  const isWorkspace = !clientId

  const today = useMemo(() => startOfDay(new Date()), [])
  const weekEnd = useMemo(() => endOfDay(addDays(today, 6)), [today])
  const days = useMemo(() => eachDayOfInterval({ start: today, end: addDays(today, 6) }), [today])

  const fresh = { staleTime: 0, refetchOnWindowFocus: true }
  const { data: posts = [], isLoading: loadingPosts } = useWeekPosts(
    { clientId, from: today, to: weekEnd },
    fresh,
  )
  const { data: meetings = [], isLoading: loadingMeetings } = useMeetingsBetween(
    { from: today, to: weekEnd, clientId },
    fresh,
  )

  const postsByDay = useMemo(() => groupByDay(posts, 'target_date'), [posts])
  const meetingsByDay = useMemo(() => groupByDay(meetings, 'datetime'), [meetings])

  const isLoading = loadingPosts || loadingMeetings
  const calendarPath = isWorkspace ? '/calendar' : `/clients/${clientId}?tab=calendar`

  return (
    <Card className="border-none shadow-sm ring-1 ring-border/50 bg-card/50 dark:bg-card/30 flex flex-col gap-2 group h-full">
      <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-lg font-medium bricolage">Week Ahead</CardTitle>
          {!isLoading && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {posts.length} deliverable{posts.length !== 1 && 's'} · {meetings.length}{' '}
              meeting{meetings.length !== 1 && 's'}
            </p>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Open calendar"
          className="h-8 w-8 -mr-2"
          onClick={() => navigate(calendarPath)}
        >
          <ArrowUpRight className="h-4 w-4" />
        </Button>
      </CardHeader>

      <CardContent className="pb-4 pt-2 pr-3 flex-1 flex flex-col min-h-0">
        {isLoading ? (
          <div className="flex flex-col gap-7 py-1 pl-1">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex gap-3">
                <div className="flex flex-col items-center gap-2 pt-1 w-5 shrink-0">
                  <Skeleton className="size-3 rounded-full shrink-0" />
                  {i < 3 && <Skeleton className="w-px h-10" />}
                </div>
                <div className="flex-1 space-y-2.5 pb-1">
                  <Skeleton className="h-3.5 w-20" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="relative overflow-y-auto flex-1 min-h-0 pr-1 timeline-scrollbar">
            {/* The vertical line, behind the day dots */}
            <div className="absolute left-[10px] top-2 bottom-2 w-px bg-border" />

            <div className="flex flex-col">
              {days.map((day, i) => {
                const key = format(day, 'yyyy-MM-dd')
                const dayPosts = postsByDay[key] || []
                const dayMeetings = meetingsByDay[key] || []
                const hasContent = dayPosts.length > 0 || dayMeetings.length > 0
                const isCurrentDay = isToday(day)
                const platforms = [...new Set(dayPosts.flatMap((p) => p.platforms || []))]

                const items = []
                if (dayPosts.length > 0) items.push({ type: 'posts' })
                dayMeetings.forEach((m) => items.push({ type: 'meeting', data: m }))
                const overflowCount = Math.max(0, items.length - MAX_ITEMS_PER_DAY)

                return (
                  <div
                    key={key}
                    className={cn(
                      'relative flex gap-3',
                      i < days.length - 1 ? 'pb-7' : 'pb-0',
                      !hasContent && 'opacity-35',
                    )}
                  >
                    <div className="w-5 flex justify-center shrink-0 pt-0.5 relative z-10">
                      <div
                        className={cn(
                          'size-2 rounded-full ring-2 ring-card',
                          isCurrentDay
                            ? 'bg-emerald-500 dark:bg-emerald-400 ring-emerald-500/30 dark:ring-emerald-400/30'
                            : 'bg-gray-300 dark:bg-gray-500',
                        )}
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-1.5 mb-2">
                        <div className="flex items-baseline gap-1.5">
                          <p
                            className={cn(
                              'text-sm leading-none',
                              isCurrentDay
                                ? 'font-bold text-emerald-600 dark:text-emerald-400'
                                : 'font-semibold text-foreground',
                            )}
                          >
                            {isCurrentDay ? 'Today' : isTomorrow(day) ? 'Tomorrow' : format(day, 'EEEE')}
                          </p>
                          <span className="text-xs text-muted-foreground leading-none">
                            {format(day, 'd MMMM')}
                          </span>
                        </div>
                        {overflowCount > 0 && (
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            +{overflowCount} event{overflowCount !== 1 && 's'}
                          </span>
                        )}
                      </div>

                      {!hasContent ? (
                        <p className="text-xs text-muted-foreground/50 italic">No activity</p>
                      ) : (
                        <div className="flex flex-col gap-2">
                          {items.slice(0, MAX_ITEMS_PER_DAY).map((item) =>
                            item.type === 'posts' ? (
                              <div key="posts" className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  {isWorkspace && <AvatarStack clients={uniqueClients(dayPosts)} />}
                                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 shrink-0">
                                    {dayPosts.length} deliverable{dayPosts.length !== 1 && 's'}
                                  </Badge>
                                </div>
                                {platforms.length > 0 && (
                                  <div className="flex items-center gap-0.5 shrink-0">
                                    {platforms.map((pid) => (
                                      <PlatformImg key={pid} platformId={pid} />
                                    ))}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div key={item.data.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Clock className="size-3.5 shrink-0 text-blue-400" />
                                <span className="truncate font-medium">{item.data.title}</span>
                                <span className="shrink-0 ml-auto">
                                  {format(new Date(item.data.datetime), 'h:mma')}
                                </span>
                              </div>
                            ),
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
