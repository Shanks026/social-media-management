// Deliverable (post_versions.status) vocabulary: ADR 0006.
// Pure domain module: no JSX, icons or colours (those live in StatusBadge).
//
// STATUSES mirrors the post_versions_status_check constraint; the drift test
// in src/tests/domain/statusDrift.test.js fails if the two disagree.
import { labeler } from './labeler'

/** The stored statuses, in lifecycle order. */
export const STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'CHANGES_REQUESTED',
  'READY',
  'PENDING_APPROVAL',
  'NEEDS_REVISION',
  'APPROVED',
  'SCHEDULED',
  'PUBLISHED',
  'DELIVERED',
  'ARCHIVED',
]

/** Derived, never stored: some but not all platforms are live. */
export const PARTIALLY_PUBLISHED = 'PARTIALLY_PUBLISHED'

/**
 * Statuses a non-admin Member may delete their own Deliverable in. Everything
 * from READY onward is a committed agency or Client action. Mirrors the
 * posts_workspace_delete RLS policy, which is the real gate.
 */
export const DELETABLE_STATUSES = ['DRAFT', 'SUBMITTED', 'ARCHIVED']

const LABELS = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  CHANGES_REQUESTED: 'Changes Requested',
  READY: 'Ready',
  PENDING_APPROVAL: 'Awaiting Approval',
  NEEDS_REVISION: 'Needs Revision',
  APPROVED: 'Approved',
  SCHEDULED: 'Scheduled',
  PUBLISHED: 'Published',
  DELIVERED: 'Delivered',
  ARCHIVED: 'Archived',
  [PARTIALLY_PUBLISHED]: 'Partially Published',
}

// What a Client reads (reports, PDFs). Internal review is invisible to them.
const CLIENT_LABELS = {
  ...LABELS,
  DRAFT: 'In Progress',
  SUBMITTED: 'In Progress',
  CHANGES_REQUESTED: 'In Progress',
  READY: 'In Progress',
  NEEDS_REVISION: 'In Revision',
}

/** Internal label for a stored or display status. */
export const statusLabel = labeler(LABELS)

/** Client-facing label for a stored or display status. */
export const clientStatusLabel = labeler(CLIENT_LABELS)

/**
 * The status to show for a Version: its stored status, unless per-platform
 * schedules say it is fully or partially published.
 */
export function displayStatus(version) {
  if (!version?.platform_schedules) return version?.status
  const entries = Object.values(version.platform_schedules)
  if (!entries.length) return version.status
  const publishedCount = entries.filter((e) => e.published_at).length
  if (publishedCount === 0) return version.status
  if (publishedCount === entries.length) return 'PUBLISHED'
  return PARTIALLY_PUBLISHED
}
