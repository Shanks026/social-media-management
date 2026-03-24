import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
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
import { ArrowUpRight, Clock, Bell } from 'lucide-react'
import { supabase } from '@/lib/supabase'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { SUPPORTED_PLATFORMS } from '@/lib/platforms'
import { useAuth } from '@/context/AuthContext'

function PlatformImg({ platformId }) {
  const label =
    SUPPORTED_PLATFORMS.find((p) => p.id === platformId)?.label || platformId
  return (
    <img
      src={`/platformIcons/${platformId}.png`}
      alt={label}
      title={label}
      className="size-5 rounded-sm object-contain"
    />
  )
}

export default function ClientWeekTimeline({ clientId }) {
  const navigate = useNavigate()
  const { workspaceUserId } = useAuth()

  const today = useMemo(() => startOfDay(new Date()), [])
  const weekEnd = useMemo(() => endOfDay(addDays(today, 6)), [today])
  const days = useMemo(
    () => eachDayOfInterval({ start: today, end: addDays(today, 6) }),
    [today],
  )

  // ── Client posts (SCHEDULED or APPROVED) for this week ──
  const { data: posts = [], isLoading: loadingPosts } = useQuery({
    queryKey: ['client-week-timeline-posts', clientId, today.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('posts')
        .select(`
          id,
          post_versions!fk_current_version (
            id,
            title,
            status,
            platform,
            target_date
          )
        `)
        .eq('client_id', clientId)
      if (error) throw error

      return (data || [])
        .map((p) => ({
          id: p.id,
          ...p.post_versions,
          platforms: p.post_versions?.platform || [],
        }))
        .filter(
          (p) =>
            (p.status === 'SCHEDULED' || p.status === 'APPROVED') &&
            p.target_date &&
            new Date(p.target_date) >= today &&
            new Date(p.target_date) <= weekEnd,
        )
    },
    enabled: !!clientId,
    staleTime: 0,
    refetchOnWindowFocus: true,
  })

  // ── Client meetings for this week ──
  const { data: meetings = [], isLoading: loadingMeetings } = useQuery({
    queryKey: ['client-week-timeline-meetings', clientId, today.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meetings')
        .select('*')
        .eq('client_id', clientId)
        .gte('datetime', today.toISOString())
        .lte('datetime', weekEnd.toISOString())
        .order('datetime', { ascending: true })
      if (error) throw error
      return data || []
    },
    enabled: !!clientId,
    staleTime: 0,
    refetchOnWindowFocus: true,
  })

  // ── Client notes with due_at this week ──
  const { data: dueNotes = [] } = useQuery({
    queryKey: ['client-week-timeline-notes', clientId, today.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_notes')
        .select('*')
        .eq('client_id', clientId)
        .eq('status', 'TODO')
        .gte('due_at', today.toISOString())
        .lte('due_at', weekEnd.toISOString())
        .order('due_at', { ascending: true })
      if (error) throw error
      return data || []
    },
    enabled: !!clientId,
    staleTime: 0,
    refetchOnWindowFocus: true,
  })

  // ── Group by day ──
  const postsByDay = useMemo(() => {
    const map = {}
    for (const post of posts) {
      const key = format(new Date(post.target_date), 'yyyy-MM-dd')
      if (!map[key]) map[key] = []
      map[key].push(post)
    }
    return map
  }, [posts])

  const meetingsByDay = useMemo(() => {
    const map = {}
    for (const m of meetings) {
      const key = format(new Date(m.datetime), 'yyyy-MM-dd')
      if (!map[key]) map[key] = []
      map[key].push(m)
    }
    return map
  }, [meetings])

  const notesByDay = useMemo(() => {
    const map = {}
    for (const n of dueNotes) {
      if (!n.due_at) continue
      const key = format(new Date(n.due_at), 'yyyy-MM-dd')
      if (!map[key]) map[key] = []
      map[key].push(n)
    }
    return map
  }, [dueNotes])

  const isLoading = loadingPosts || loadingMeetings
  const totalPosts = posts.length
  const totalMeetings = meetings.length
  const totalNotes = dueNotes.length

  return (
    <Card className="border-none shadow-sm ring-1 ring-border/50 bg-card/50 dark:bg-card/30 flex flex-col gap-2 h-full">
      <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-lg font-medium">Week Ahead</CardTitle>
          {!isLoading && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {totalPosts} deliverable{totalPosts !== 1 && 's'} · {totalMeetings}{' '}
              meeting{totalMeetings !== 1 && 's'} · {totalNotes} reminder{totalNotes !== 1 && 's'}
            </p>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 -mr-2"
          onClick={() => navigate(`/clients/${clientId}?tab=calendar`)}
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
            <div className="absolute left-[10px] top-2 bottom-2 w-px bg-border" />
            <div className="flex flex-col">
              {days.map((day, i) => {
                const key = format(day, 'yyyy-MM-dd')
                const dayPosts = postsByDay[key] || []
                const dayMeetings = meetingsByDay[key] || []
                const dayNotes = notesByDay[key] || []
                const hasContent =
                  dayPosts.length > 0 ||
                  dayMeetings.length > 0 ||
                  dayNotes.length > 0
                const isCurrentDay = isToday(day)
                const isTomorrowDay = isTomorrow(day)

                const platforms = [
                  ...new Set(dayPosts.flatMap((p) => p.platforms || [])),
                ]

                return (
                  <div
                    key={key}
                    className={`relative flex gap-3 ${i < days.length - 1 ? 'pb-7' : 'pb-0'} ${
                      !hasContent ? 'opacity-35' : ''
                    }`}
                  >
                    <div className="w-5 flex justify-center shrink-0 pt-0.5 relative z-10">
                      <div
                        className={`size-2 rounded-full ring-2 ring-card ${
                          isCurrentDay
                            ? 'bg-emerald-500 ring-emerald-500/30'
                            : 'bg-gray-300 dark:bg-gray-500'
                        }`}
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-1.5 mb-2">
                        <p
                          className={`text-sm leading-none text-foreground ${
                            isCurrentDay ? 'font-bold' : 'font-semibold'
                          }`}
                        >
                          {isCurrentDay
                            ? 'Today'
                            : isTomorrowDay
                              ? 'Tomorrow'
                              : format(day, 'EEEE')}
                        </p>
                        <span className="text-xs text-muted-foreground leading-none">
                          {format(day, 'd MMMM')}
                        </span>
                      </div>

                      {!hasContent ? (
                        <p className="text-xs text-muted-foreground/50 italic">
                          No activity
                        </p>
                      ) : (
                        <div className="flex flex-col gap-2">
                          {dayPosts.length > 0 && (
                            <div className="flex items-center justify-between gap-2">
                              <Badge
                                variant="secondary"
                                className="text-[10px] px-1.5 py-0 h-5 shrink-0"
                              >
                                {dayPosts.length} deliverable
                                {dayPosts.length !== 1 && 's'}
                              </Badge>
                              {platforms.length > 0 && (
                                <div className="flex items-center gap-0.5 shrink-0">
                                  {platforms.map((pid) => (
                                    <PlatformImg key={pid} platformId={pid} />
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {dayMeetings.slice(0, 2).map((m) => (
                            <div
                              key={m.id}
                              className="flex items-center gap-1.5 text-xs text-muted-foreground"
                            >
                              <Clock className="size-3.5 shrink-0 text-blue-400" />
                              <span className="truncate font-medium">
                                {m.title}
                              </span>
                              <span className="shrink-0 ml-auto">
                                {format(new Date(m.datetime), 'h:mma')}
                              </span>
                            </div>
                          ))}
                          {dayMeetings.length > 2 && (
                            <p className="text-xs text-muted-foreground pl-5">
                              +{dayMeetings.length - 2} more meeting
                              {dayMeetings.length - 2 !== 1 && 's'}
                            </p>
                          )}

                          {dayNotes.slice(0, 1).map((n) => (
                            <div
                              key={n.id}
                              className="flex items-center gap-1.5 text-xs text-muted-foreground"
                            >
                              <Bell className="size-3.5 shrink-0 text-amber-400" />
                              <span className="truncate">{n.title}</span>
                            </div>
                          ))}
                          {dayNotes.length > 1 && (
                            <p className="text-xs text-muted-foreground pl-5">
                              +{dayNotes.length - 1} more reminder
                              {dayNotes.length - 1 !== 1 && 's'}
                            </p>
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
