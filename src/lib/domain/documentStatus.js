// Client document status vocabulary: ADR 0006.
// STATUSES mirrors client_documents_status_check.
import { labeler } from './labeler'

export const STATUSES = ['ACTIVE', 'ARCHIVED']

export const statusLabel = labeler({
  ACTIVE: 'Active',
  ARCHIVED: 'Archived',
})
