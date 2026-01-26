import { Badge } from '@/components/ui/badge'

const STATUS_CONFIG = {
  DRAFT: {
    label: 'Draft',
    dot: 'bg-blue-500',
    className:
      'bg-blue-100 text-blue-800 dark:bg-blue-500/10 dark:text-blue-400',
  },
  PENDING_APPROVAL: {
    label: 'Awaiting Approval',
    dot: 'bg-orange-500',
    className:
      'bg-orange-100 text-orange-800 dark:bg-orange-500/10 dark:text-orange-400',
  },
  SCHEDULED: {
    label: 'Scheduled',
    dot: 'bg-purple-500',
    className:
      'bg-purple-100 text-purple-800 dark:bg-purple-500/10 dark:text-purple-400',
  },
  NEEDS_REVISION: {
    label: 'Needs Revision',
    dot: 'bg-pink-500',
    className:
      'bg-pink-100 text-pink-800 dark:bg-pink-500/10 dark:text-pink-400',
  },
  APPROVED: {
    label: 'Approved',
    dot: 'bg-lime-500',
    className:
      'bg-lime-100 text-lime-800 dark:bg-lime-500/10 dark:text-lime-400',
  },
  ARCHIVED: {
    label: 'Archived - Read Only',
    dot: 'bg-slate-500',
    className:
      'bg-slate-100 text-slate-800 dark:bg-slate-500/20 dark:text-slate-400',
  },
  ACTIVE: {
    label: 'Active',
    dot: 'bg-green-500',
    className:
      'bg-green-100 text-green-800 dark:bg-green-500/10 dark:text-green-400',
  },
  PUBLISHED: {
    label: 'Published',
    dot: 'bg-lime-500',
    className:
      'bg-lime-100 text-lime-800 dark:bg-lime-500/10 dark:text-lime-400',
  },
  INACTIVE: {
    label: 'Inactive',
    dot: 'bg-slate-500',
    className:
      'bg-slate-100 text-slate-800 dark:bg-slate-500/20 dark:text-slate-400',
  },
}

export default function StatusBadge({ status }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.INACTIVE

  return (
    <Badge
      variant="none"
      className={`flex items-center gap-2 rounded-md px-3 py-1 capitalize border-none shadow-none transition-colors ${config.className}`}
    >
      <span
        className={`size-2 rounded-full ${config.dot} dark:brightness-125`}
        aria-hidden
      />
      <span className="text-xs font-semibold whitespace-nowrap">
        {config.label}
      </span>
    </Badge>
  )
}
