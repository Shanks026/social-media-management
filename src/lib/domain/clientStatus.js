// Client status vocabulary: ADR 0006. STATUSES mirrors clients_status_check.
import { labeler } from './labeler'

export const STATUSES = ['ACTIVE', 'PAUSED', 'ARCHIVED']

export const statusLabel = labeler({
  ACTIVE: 'Active',
  PAUSED: 'Paused',
  ARCHIVED: 'Archived',
})

// Client urgency: how soon the next scheduled post is due (the pipeline
// indicator). Compare keys, never labels. Colours live in client-helpers.
export const URGENCIES = ['OVERDUE', 'URGENT', 'WARNING', 'HEALTHY']

export const urgencyLabel = labeler({
  OVERDUE: 'Overdue',
  URGENT: 'Urgent',
  WARNING: 'Warning',
  HEALTHY: '',
})

/** Keys that mean the next post needs attention now. */
export const isNeedsAttention = (key) => key === 'OVERDUE' || key === 'URGENT'

/**
 * Urgency for a due date: { key, label, pulse }, or null when there is no
 * date. HEALTHY has a null label (nothing to show).
 */
export function urgencyOf(nextPostAt, now = new Date()) {
  if (!nextPostAt) return null
  const hours = (new Date(nextPostAt) - now) / 3600000
  let key = 'HEALTHY'
  if (hours < 0) key = 'OVERDUE'
  else if (hours < 24) key = 'URGENT'
  else if (hours < 48) key = 'WARNING'
  return {
    key,
    label: urgencyLabel(key) || null,
    pulse: key === 'OVERDUE' || key === 'URGENT',
  }
}
