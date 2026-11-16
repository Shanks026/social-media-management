// Invoice status vocabulary: ADR 0006. STATUSES mirrors invoices_status_check.
import { labeler } from './labeler'

export const STATUSES = ['DRAFT', 'SENT', 'PAID', 'OVERDUE', 'VOID']

export const statusLabel = labeler({
  DRAFT: 'Draft',
  SENT: 'Sent',
  PAID: 'Paid',
  OVERDUE: 'Overdue',
  VOID: 'Void',
})
