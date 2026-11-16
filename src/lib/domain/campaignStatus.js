// Campaign status vocabulary: ADR 0006. STATUSES mirrors campaigns_status_check.
import { labeler } from './labeler'

export const STATUSES = ['ACTIVE', 'COMPLETED', 'ARCHIVED']

export const statusLabel = labeler({
  ACTIVE: 'Active',
  COMPLETED: 'Completed',
  ARCHIVED: 'Archived',
})
