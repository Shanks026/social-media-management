// Client status vocabulary: ADR 0006. STATUSES mirrors clients_status_check.
import { labeler } from './labeler'

export const STATUSES = ['ACTIVE', 'PAUSED', 'ARCHIVED']

export const statusLabel = labeler({
  ACTIVE: 'Active',
  PAUSED: 'Paused',
  ARCHIVED: 'Archived',
})
