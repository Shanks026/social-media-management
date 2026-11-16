// Ledger transaction status vocabulary: ADR 0006.
// STATUSES mirrors transactions_status_check.
import { labeler } from './labeler'

export const STATUSES = ['PAID', 'PENDING', 'OVERDUE']

export const statusLabel = labeler({
  PAID: 'Paid',
  PENDING: 'Pending',
  OVERDUE: 'Overdue',
})
