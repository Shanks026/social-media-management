import {
  format,
  startOfWeek,
  eachDayOfInterval,
  addDays,
  isToday,
  setHours,
  isSameDay,
} from 'date-fns'
import { cn } from '@/lib/utils'
import { Instagram, Linkedin, Youtube, Globe, Clock } from 'lucide-react'
import { useState, useEffect } from 'react'
import { DayDetailDialog } from './DayDetailDialog' // Import the dialog
import { getPublishState } from '@/lib/helper'

const PLATFORM_ICONS = {
  instagram: <Instagram className="size-3.5 text-muted-foreground" />,
  linkedin: <Linkedin className="size-3.5 text-muted-foreground" />,
  youtube: <Youtube className="size-3.5 text-muted-foreground" />,
  google_business: <Globe className="size-3.5 text-muted-foreground" />,
}

const STATUS_STYLES = {
  DRAFT: 'border-l-blue-600',
  PENDING_APPROVAL: 'border-l-orange-600',
  NEEDS_REVISION: 'border-l-pink-600 animate-pulse',
  SCHEDULED: 'border-l-purple-600',
  PUBLISHED: 'border-l-emerald-600',
  PARTIALLY_PUBLISHED: 'border-l-lime-600',
}

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const ROW_HEIGHT = 80
const DURATION_MS = 60 * 60 * 1000 // treat each event as 1 hour for overlap detection

function assignColumns(posts) {
  if (!posts.length) return []
  const sorted = [...posts].sort(
    (a, b) => new Date(a.target_date) - new Date(b.target_date),
  )
  const colEnds = [] // end time (ms) of last event in each column
  const assignments = sorted.map((post) => {
    const start = new Date(post.target_date).getTime()
    const end = start + DURATION_MS
    let col = colEnds.findIndex((endTime) => endTime <= start)
    if (col === -1) {
      col = colEnds.length
      colEnds.push(end)
    } else colEnds[col] = end
    return { post, col }
  })
  const total = colEnds.length
  return assignments.map(({ post, col }) => ({ post, col, total }))
}

export default function WeekView({ currentMonth, postsByDate, clientId }) {
  const [now, setNow] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(null) // State for the dialog

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])

  const startDate = startOfWeek(currentMonth)
  const days = eachDayOfInterval({
    start: startDate,
    end: addDays(startDate, 6),
  })

  const getTopOffset = (date) => {
    const d = new Date(date)
    return d.getHours() * ROW_HEIGHT + (d.getMinutes() * ROW_HEIGHT) / 60
  }

  const currentTimeTop = getTopOffset(now)

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] overflow-hidden bg-background">
      {/* Header */}
      <div className="flex border-b bg-muted/5 [scrollbar-gutter:stable] overflow-y-hidden">
        <div className="w-16 border-r shrink-0" />
        {days.map((day) => (
          <div
            key={day.toString()}
            className="flex-1 py-3 text-center border-r last:border-r-0"
          >
            <p className="text-xs font-medium text-muted-foreground">
              {format(day, 'EEE')}
            </p>
            <span
              className={cn(
                'text-md font-extrabold px-2 py-0.5 rounded-lg',
                isToday(day)
                  ? 'bg-primary text-primary-foreground'
                  : 'text-foreground',
              )}
            >
              {format(day, 'd')}
            </span>
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto relative custom-scrollbar [scrollbar-gutter:stable]">
        <div className="flex min-h-[1920px] relative">
          {/* Current Time Indicator Line */}
          {days.some((day) => isSameDay(day, now)) && (
            <div
              className="absolute left-16 right-0 border-t-2 border-blue-500 z-40 pointer-events-none"
              style={{ top: `${currentTimeTop}px` }}
            >
              <div className="absolute -left-1.5 -top-1.5 size-3 bg-blue-500 rounded-full shadow-sm" />
            </div>
          )}

          {/* Time Labels Sidebar */}
          <div className="w-16 border-r bg-muted/5 sticky left-0 z-20 shrink-0">
            {HOURS.map((hour) => (
              <div
                key={hour}
                style={{ height: `${ROW_HEIGHT}px` }}
                className="border-b border-muted/30 p-2 text-[10px] font-medium text-muted-foreground/80 text-right"
              >
                {format(setHours(new Date(), hour), 'ha')}
              </div>
            ))}
          </div>

          <div className="flex flex-1 relative">
            {days.map((day) => {
              const dateKey = format(day, 'yyyy-MM-dd')
              const posts = postsByDate[dateKey] || []
              const isCurrentDay = isSameDay(day, now)

              return (
                <div
                  key={day.toString()}
                  onClick={() => setSelectedDate(day)} // Trigger dialog on column click
                  className={cn(
                    'flex-1 border-r last:border-r-0 relative cursor-pointer transition-colors hover:bg-muted/5',
                    isCurrentDay && 'bg-primary/[0.03]',
                  )}
                >
                  {HOURS.map((h) => (
                    <div
                      key={h}
                      style={{ height: `${ROW_HEIGHT}px` }}
                      className="border-b border-muted/30 w-full"
                    />
                  ))}

                  {assignColumns(posts).map(({ post, col, total }) => {
                    const topPos = getTopOffset(post.target_date)
                    const leftPct = (col / total) * 100
                    const rightPct = ((total - col - 1) / total) * 100
                    return (
                      <button
                        key={post.version_id}
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedDate(day)
                        }}
                        style={{
                          top: `${topPos}px`,
                          height: '60px',
                          left: `calc(${leftPct}% + 2px)`,
                          right: `calc(${rightPct}% + 2px)`,
                        }}
                        className={cn(
                          'absolute overflow-hidden p-1.5 rounded-lg border border-l-4 transition-all z-10 hover:z-30 hover:scale-[1.02] text-left shadow-md flex flex-col justify-center',
                          STATUS_STYLES[getPublishState(post)] ||
                            'border-l-muted',
                          post.isMeeting
                            ? 'bg-purple-50 dark:bg-purple-950/50 border-purple-200 dark:border-purple-800'
                            : 'bg-card',
                        )}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <div className="shrink-0">
                            {post.isMeeting ? (
                              <Clock className="size-3 text-purple-600 dark:text-purple-400" />
                            ) : (
                              PLATFORM_ICONS[post.platforms?.[0]?.toLowerCase()]
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p
                              className={cn(
                                'text-[11px] leading-tight truncate',
                                post.isMeeting
                                  ? 'font-black text-purple-900 dark:text-purple-100'
                                  : 'font-black text-foreground',
                              )}
                            >
                              {post.title}
                            </p>
                            <div className="flex items-center gap-1 text-[10px] font-medium text-foreground/60 truncate">
                              <Clock size={9} className="shrink-0" />
                              {format(new Date(post.target_date), 'h:mm a')}
                            </div>
                          </div>
                        </div>

                        {!clientId && (
                          <p className="text-[9px] font-medium truncate text-muted-foreground mt-0.5 pl-4">
                            {post.client_name}
                          </p>
                        )}
                      </button>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Day Detail Dialog Integration */}
      <DayDetailDialog
        date={selectedDate}
        posts={
          selectedDate ? postsByDate[format(selectedDate, 'yyyy-MM-dd')] : []
        }
        open={!!selectedDate}
        onOpenChange={() => setSelectedDate(null)}
      />
    </div>
  )
}
