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

const PLATFORM_ICONS = {
  instagram: <Instagram className="size-3.5 text-muted-foreground" />,
  linkedin: <Linkedin className="size-3.5 text-muted-foreground" />,
  youtube: <Youtube className="size-3.5 text-muted-foreground" />,
  google_business: <Globe className="size-3.5 text-muted-foreground" />,
}

const STATUS_STYLES = {
  PUBLISHED: 'border-l-green-600',
  SCHEDULED: 'border-l-purple-600',
  NEEDS_REVISION: 'border-l-pink-600 animate-pulse',
  PENDING_APPROVAL: 'border-l-amber-600',
}

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const ROW_HEIGHT = 80 // Standardized height for calculations

export default function WeekView({ currentMonth, postsByDate }) {
  // Update current time every minute to keep the red line moving
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])

  const startDate = startOfWeek(currentMonth)
  const days = eachDayOfInterval({
    start: startDate,
    end: addDays(startDate, 6),
  })

  // Helper to calculate pixel offset from the top
  const getTopOffset = (date) => {
    const d = new Date(date)
    return d.getHours() * ROW_HEIGHT + (d.getMinutes() * ROW_HEIGHT) / 60
  }

  const currentTimeTop = getTopOffset(now)

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] overflow-hidden bg-background">
      {/* Header with improved text contrast */}
      <div className="flex border-b bg-muted/5 [scrollbar-gutter:stable] overflow-y-hidden">
        <div className="w-16 border-r shrink-0" />
        {days.map((day) => (
          <div
            key={day.toString()}
            className="flex-1 py-3 text-center border-r last:border-r-0"
          >
            <p className="text-[10px] font-bold text-muted-foreground">
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
          {/* 🔥 Current Time Indicator Line */}
          {/* Only render if today falls within the visible week */}
          {days.some((day) => isSameDay(day, now)) && (
            <div
              className="absolute left-16 right-0 border-t-2 border-blue-500 z-40 pointer-events-none"
              style={{ top: `${currentTimeTop}px` }}
            >
              {/* Little red dot at the start of the line */}
              <div className="absolute -left-1.5 -top-1.5 size-3 bg-blue-500 rounded-full shadow-sm" />
            </div>
          )}

          {/* Time Labels Sidebar - Darker text for readability */}
          <div className="w-16 border-r bg-muted/5 sticky left-0 z-20 shrink-0">
            {HOURS.map((hour) => (
              <div
                key={hour}
                style={{ height: `${ROW_HEIGHT}px` }}
                className="border-b border-muted/30 p-2 text-[10px] font-bold text-muted-foreground/80 text-right"
              >
                {format(setHours(new Date(), hour), 'ha')}
              </div>
            ))}
          </div>

          <div className="flex flex-1 relative">
            {days.map((day) => {
              const posts = postsByDate[format(day, 'yyyy-MM-dd')] || []
              const isCurrentDay = isSameDay(day, now)

              return (
                <div
                  key={day.toString()}
                  className={cn(
                    'flex-1 border-r last:border-r-0 relative',
                    isCurrentDay && 'bg-primary/[0.03]', // Subtle highlight for the current day
                  )}
                >
                  {HOURS.map((h) => (
                    <div
                      key={h}
                      style={{ height: `${ROW_HEIGHT}px` }}
                      className="border-b border-muted/30 w-full"
                    />
                  ))}

                  {posts.map((post) => (
                    <button
                      key={post.version_id}
                      style={{ top: `${getTopOffset(post.target_date)}px` }}
                      className={cn(
                        'absolute left-1 right-1 p-2 rounded-lg border border-l-4 bg-card transition-all z-10 hover:z-30 hover:bg-accent/30 text-left shadow-md',
                        STATUS_STYLES[post.status] || 'border-l-muted',
                      )}
                    >
                      <div className="flex items-start gap-2 mb-1">
                        <div className="mt-0.5 shrink-0">
                          {PLATFORM_ICONS[post.platforms[0]?.toLowerCase()]}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-black leading-tight truncate text-foreground">
                            {post.title}
                          </p>
                          <div className="flex items-center gap-1 mt-0.5 text-[10px] font-bold text-foreground/80">
                            <Clock size={10} />{' '}
                            {format(new Date(post.target_date), 'h:mm a')}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mt-1.5 pt-1.5 border-t border-muted">
                        {post.client_logo ? (
                          <img
                            src={post.client_logo}
                            alt={post.client_name}
                            className="size-3.5 rounded-full object-cover shrink-0 bg-muted"
                          />
                        ) : (
                          <div className="size-3.5 rounded-full bg-muted shrink-0 flex items-center justify-center">
                            <span className="text-[6px] uppercase font-black">
                              {post.client_name?.charAt(0)}
                            </span>
                          </div>
                        )}
                        <span className="text-[10px] font-bold truncate text-foreground/90">
                          {post.client_name}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
