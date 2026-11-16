// Task status and priority vocabulary: ADR 0006.
// STATUSES mirrors tasks_status_check; PRIORITIES mirrors tasks_priority_check.
import { labeler } from './labeler'

export const STATUSES = ['TODO', 'IN_PROGRESS', 'COMPLETED', 'ARCHIVED']

export const PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT']

export const statusLabel = labeler({
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  ARCHIVED: 'Archived',
})

export const priorityLabel = labeler({
  LOW: 'Low',
  NORMAL: 'Normal',
  HIGH: 'High',
  URGENT: 'Urgent',
})
