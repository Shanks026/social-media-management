// Proposal status vocabulary: ADR 0006. STATUSES mirrors proposals_status_check.
import { labeler } from './labeler'

/** The stored statuses, in lifecycle order. */
export const STATUSES = [
  'DRAFT',
  'SENT',
  'VIEWED',
  'CHANGES_REQUESTED',
  'ACCEPTED',
  'DECLINED',
  'ARCHIVED',
]

/** Derived, never stored: an outstanding Proposal past its valid-until date. */
export const EXPIRED = 'EXPIRED'

/** Every status a Proposal can show, in the order the list tabs use. */
export const DISPLAY_STATUSES = [
  'DRAFT',
  'SENT',
  'VIEWED',
  'ACCEPTED',
  'DECLINED',
  'CHANGES_REQUESTED',
  EXPIRED,
  'ARCHIVED',
]

// Statuses that can't expire: not yet sent, already decided, or archived.
const NEVER_EXPIRES = ['DRAFT', 'ACCEPTED', 'DECLINED', 'ARCHIVED']

export const statusLabel = labeler({
  DRAFT: 'Draft',
  SENT: 'Sent',
  VIEWED: 'Viewed',
  CHANGES_REQUESTED: 'Changes Requested',
  ACCEPTED: 'Accepted',
  DECLINED: 'Declined',
  ARCHIVED: 'Archived',
  [EXPIRED]: 'Expired',
})

function isoDay(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * The status to show for a Proposal: EXPIRED when it is still outstanding and
 * its valid-until date has passed, otherwise its stored status. Mirrors what
 * get_proposals_with_totals computes, for rows fetched without that RPC.
 */
export function displayStatus(proposal, today = new Date()) {
  const { status, valid_until: validUntil } = proposal ?? {}
  if (!status || NEVER_EXPIRES.includes(status) || !validUntil) return status
  return String(validUntil).slice(0, 10) < isoDay(today) ? EXPIRED : status
}
