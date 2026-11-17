// Presentation wrapper over the Client urgency domain module: adds the dot colour.
import { urgencyOf } from '@/lib/domain/clientStatus'

const URGENCY_DOT = {
  OVERDUE: 'bg-red-500',
  URGENT: 'bg-rose-500',
  WARNING: 'bg-amber-500',
  HEALTHY: 'bg-green-500',
}

export function getUrgencyStatus(nextPostAt) {
  const urgency = urgencyOf(nextPostAt)
  return urgency && { ...urgency, color: URGENCY_DOT[urgency.key] }
}
