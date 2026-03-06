import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
} from 'date-fns'

/**
 * Builds a flat report structure from calendar posts data.
 * @param {Array} posts - Posts array from the calendar query
 * @param {'month'|'week'} viewMode
 * @param {Date} currentDate
 * @returns {{ days: Array, summary: Object, periodLabel: string }}
 */
export function buildCalendarReport(posts, viewMode, currentDate) {
  const start =
    viewMode === 'month'
      ? startOfMonth(currentDate)
      : startOfWeek(currentDate)
  const end =
    viewMode === 'month' ? endOfMonth(currentDate) : endOfWeek(currentDate)

  const days = eachDayOfInterval({ start, end })
    .filter((day) => viewMode === 'week' || isSameMonth(day, currentDate))
    .map((day) => {
      const key = format(day, 'yyyy-MM-dd')
      const dayPosts = posts.filter(
        (p) =>
          !p.isMeeting &&
          p.target_date &&
          format(new Date(p.target_date), 'yyyy-MM-dd') === key,
      )
      return { date: day, posts: dayPosts }
    })
    .filter((d) => d.posts.length > 0)

  const allPosts = posts.filter((p) => !p.isMeeting)

  const byStatus = allPosts.reduce((acc, p) => {
    const s = p.status || 'UNKNOWN'
    acc[s] = (acc[s] || 0) + 1
    return acc
  }, {})

  const byPlatform = allPosts.reduce((acc, p) => {
    const platforms = p.platforms || []
    platforms.forEach((pl) => {
      acc[pl] = (acc[pl] || 0) + 1
    })
    return acc
  }, {})

  return {
    days,
    summary: { total: allPosts.length, byStatus, byPlatform },
  }
}

/**
 * Returns a human-readable period label for a given view + date.
 */
export function getPeriodLabel(viewMode, currentDate) {
  if (viewMode === 'month') return format(currentDate, 'MMMM yyyy')
  const start = startOfWeek(currentDate)
  const end = endOfWeek(currentDate)
  return `${format(start, 'MMM d')}–${format(end, 'MMM d, yyyy')}`
}

/**
 * Returns a safe filename-friendly version of the period label.
 */
export function getPeriodFilename(viewMode, currentDate) {
  if (viewMode === 'month') return format(currentDate, 'MMMM-yyyy').toLowerCase()
  const start = startOfWeek(currentDate)
  const end = endOfWeek(currentDate)
  return `${format(start, 'MMM-d')}-to-${format(end, 'MMM-d-yyyy')}`.toLowerCase()
}
