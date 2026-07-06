import { DeliverableCard } from '@/components/deliverables/DeliverableCard'
import { MeetingCard } from '@/components/deliverables/MeetingCard'

/**
 * Dispatches to DeliverableCard or MeetingCard based on the item shape.
 * Kept as a thin wrapper so existing callers (Posts.jsx, DayDetailDialog.jsx)
 * don't need to know about the split.
 */
export function CalendarPostCard({ post }) {
  if (!post) return null
  if (post.isMeeting) return <MeetingCard meeting={post} />
  return <DeliverableCard post={post} />
}

export default CalendarPostCard
