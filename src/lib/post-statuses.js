// Single source of truth for post/deliverable status display properties.
// Used by StatusBadge, WorkflowHealth, ContentPipelineBar, and OverviewTab.
import {
  Pencil,
  Send,
  MessageSquareWarning,
  ShieldCheck,
  Clock,
  CheckCircle2,
  CircleDashed,
  CalendarClock,
  PackageCheck,
  UploadCloud,
  Archive,
} from 'lucide-react'

// Keys are DB enum values (underscores). `color` is the hex used in charts;
// `className` is the Tailwind badge class used in StatusBadge.
export const POST_STATUS_CONFIG = {
  DRAFT: {
    label: 'Draft',
    icon: Pencil,
    color: '#3b82f6',
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-500/10 dark:text-blue-400',
  },
  SUBMITTED: {
    label: 'Submitted',
    icon: Send,
    color: '#f59e0b',
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-500/10 dark:text-amber-400',
  },
  CHANGES_REQUESTED: {
    label: 'Changes Requested',
    icon: MessageSquareWarning,
    color: '#f43f5e',
    className: 'bg-rose-100 text-rose-800 dark:bg-rose-500/10 dark:text-rose-400',
  },
  READY: {
    label: 'Ready',
    icon: ShieldCheck,
    color: '#8b5cf6',
    className: 'bg-violet-100 text-violet-800 dark:bg-violet-500/10 dark:text-violet-400',
  },
  PENDING_APPROVAL: {
    label: 'Awaiting Approval',
    icon: Clock,
    color: '#f97316',
    className: 'bg-orange-100 text-orange-800 dark:bg-orange-500/10 dark:text-orange-400',
  },
  APPROVED: {
    label: 'Approved',
    icon: CheckCircle2,
    color: '#22c55e',
    className: 'bg-green-100 text-green-800 dark:bg-green-500/10 dark:text-green-400',
  },
  NEEDS_REVISION: {
    label: 'Needs Revision',
    icon: CircleDashed,
    color: '#ec4899',
    className: 'bg-pink-100 text-pink-800 dark:bg-pink-500/10 dark:text-pink-400',
  },
  SCHEDULED: {
    label: 'Scheduled',
    icon: CalendarClock,
    color: '#a855f7',
    className: 'bg-purple-100 text-purple-800 dark:bg-purple-500/10 dark:text-purple-400',
  },
  DELIVERED: {
    label: 'Delivered',
    icon: PackageCheck,
    color: '#14b8a6',
    className: 'bg-teal-100 text-teal-800 dark:bg-teal-500/10 dark:text-teal-400',
  },
  PARTIALLY_PUBLISHED: {
    label: 'Partially Published',
    icon: UploadCloud,
    color: '#84cc16',
    className: 'bg-lime-100 text-lime-800 dark:bg-lime-500/10 dark:text-lime-400',
  },
  PUBLISHED: {
    label: 'Published',
    icon: UploadCloud,
    color: '#10b981',
    className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-400',
  },
  ARCHIVED: {
    label: 'Archived - Read Only',
    icon: Archive,
    color: '#94a3b8',
    className: 'bg-slate-100 text-slate-800 dark:bg-slate-500/20 dark:text-slate-400',
  },
}

// Statuses a deliverable may be deleted in by its *creator* (a non-admin member).
// Everything from READY onward represents a committed agency/client action, so
// deletion is blocked there for members. Owner/admin can delete in any status.
export const DELETABLE_POST_STATUSES = ['DRAFT', 'SUBMITTED', 'ARCHIVED']

// Chart statuses in render order — ARCHIVED intentionally excluded from charts.
const CHART_STATUS_KEYS = [
  'DRAFT',
  'SUBMITTED',
  'CHANGES_REQUESTED',
  'READY',
  'PENDING_APPROVAL',
  'APPROVED',
  'NEEDS_REVISION',
  'SCHEDULED',
  'DELIVERED',
  'PARTIALLY_PUBLISHED',
  'PUBLISHED',
]

// Maps DB enum key (underscores) → chart display name (spaces).
// e.g. PENDING_APPROVAL → 'PENDING APPROVAL'
export const STATUS_DISPLAY_MAP = Object.fromEntries(
  CHART_STATUS_KEYS.map((k) => [k, k.replace(/_/g, ' ')])
)

// Ordered array of chart display names (spaces) — drop-in for ALLOWED_STATUSES.
export const ALLOWED_CHART_STATUSES = CHART_STATUS_KEYS.map((k) => k.replace(/_/g, ' '))

// recharts/shadcn ChartContainer config keyed by display name (spaces).
export const POST_CHART_CONFIG = Object.fromEntries(
  CHART_STATUS_KEYS.map((k) => [
    k.replace(/_/g, ' '),
    { label: POST_STATUS_CONFIG[k].label, color: POST_STATUS_CONFIG[k].color },
  ])
)
