// src/lib/utils/client-helpers.js
export function getUrgencyStatus(nextPostAt) {
  if (!nextPostAt) return null

  const now = new Date()
  const postDate = new Date(nextPostAt)
  const diffInHours = (postDate - now) / (1000 * 60 * 60)

  // Alarming color for missed deadlines
  if (diffInHours < 0) {
    return { color: 'bg-rose-600', label: 'Overdue', pulse: true }
  }

  // Under 24h: Urgent (Red)
  if (diffInHours < 24) {
    return { color: 'bg-red-500', label: 'Urgent', pulse: true }
  }

  // Under 48h: Warning (Amber)
  if (diffInHours < 48) {
    return { color: 'bg-amber-500', label: 'Warning', pulse: false }
  }

  // Healthy: No label needed
  return { color: 'bg-green-500', label: null, pulse: false }
}
