import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isToday,
} from 'date-fns'
import { cn } from '@/lib/utils'
import { Instagram, Linkedin, Youtube, Globe, Plus } from 'lucide-react'
import { useState } from 'react'
import { DayDetailDialog } from './DayDetailDialog'

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

export default function MonthView({
  currentMonth,
  postsByDate,
  isLoading,
  clientId,
}) {
  const [selectedDate, setSelectedDate] = useState(null)
  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(monthStart)
  const startDate = startOfWeek(monthStart)
  const endDate = endOfWeek(monthEnd)

  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate })
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  const MAX_VISIBLE_POSTS = 2 // Limit to 2 as requested

  return (
    <div className="flex flex-col h-full bg-background text-foreground overflow-hidden">
      {/* Weekday Header */}
      <div className="grid grid-cols-7 border-b bg-muted/10">
        {weekDays.map((day) => (
          <div
            key={day}
            className="py-3 text-center text-[11px] font-bold text-muted-foreground uppercase tracking-wider"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 flex-1 overflow-y-auto custom-scrollbar">
        {calendarDays.map((day, idx) => {
          const dateKey = format(day, 'yyyy-MM-dd')
          const posts = postsByDate[dateKey] || []
          const isCurrentMonth = isSameMonth(day, monthStart)
          const remainingCount = posts.length - MAX_VISIBLE_POSTS

          return (
            <div
              key={dateKey}
              onClick={() => setSelectedDate(day)}
              className={cn(
                'min-h-[140px] border-b border-r p-2 transition-colors relative flex flex-col',
                !isCurrentMonth && 'bg-muted/5 opacity-30 grayscale',
                idx % 7 === 6 && 'border-r-0',
              )}
            >
              {/* Date Header */}
              <div className="mb-2 flex justify-between items-center">
                <span
                  className={cn(
                    'text-sm font-black px-1.5 py-0.5 rounded-md inline-block',
                    isToday(day)
                      ? 'bg-primary text-primary-foreground'
                      : 'text-foreground/80',
                  )}
                >
                  {format(day, 'd')}
                </span>
              </div>

              {/* Content Area */}
              <div className="space-y-1.5 flex-1">
                {posts.slice(0, MAX_VISIBLE_POSTS).map((post) => (
                  <button
                    key={post.version_id}
                    className={cn(
                      'w-full flex flex-col justify-center p-2 rounded-md border border-l-4 bg-card shadow-sm transition-all hover:bg-accent/50 text-left',
                      STATUS_STYLES[post.status] || 'border-l-muted',
                    )}
                  >
                    <span className="truncate text-[11px] font-medium leading-tight text-foreground">
                      {post.title}
                    </span>

                    {/* 🔥 Conditionally hide Client Name */}
                    {!clientId && (
                      <span className="text-[9px] font-bold uppercase tracking-wider opacity-50 truncate mt-0.5">
                        {post.client_name}
                      </span>
                    )}
                  </button>
                ))}

                {/* Styled "More" Indicator */}
                {remainingCount > 0 && (
                  <button className="w-full py-1.5 px-2 rounded-md bg-muted/30 hover:bg-primary/10 hover:text-primary text-[10px] font-black text-muted-foreground border border-dashed border-muted-foreground/20 flex items-center justify-center gap-1 transition-all">
                    <Plus size={10} className="stroke-[3]" />
                    {remainingCount} more
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
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
