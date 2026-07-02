import { PlayCircle, PauseCircle, UploadCloud } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { POST_STATUS_CONFIG } from '@/lib/post-statuses'

const STATUS_CONFIG = {
  // Post / deliverable statuses — sourced from shared post-statuses.js
  ...POST_STATUS_CONFIG,

  // Non-deliverable statuses
  ACTIVE: {
    label: 'Active',
    icon: PlayCircle,
    className: 'bg-green-100 text-green-800 dark:bg-green-500/10 dark:text-green-400',
  },
  INACTIVE: {
    label: 'Inactive',
    icon: PauseCircle,
    className: 'bg-slate-100 text-slate-800 dark:bg-slate-500/20 dark:text-slate-400',
  },
  MONTHLY: {
    label: 'Monthly',
    className: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-500/10 dark:text-cyan-400',
  },
  QUARTERLY: {
    label: 'Quarterly',
    className: 'bg-teal-100 text-teal-800 dark:bg-teal-500/10 dark:text-teal-400',
  },
  YEARLY: {
    label: 'Yearly',
    className: 'bg-violet-100 text-violet-800 dark:bg-violet-500/10 dark:text-violet-400',
  },

  // Finance statuses
  PAID: {
    label: 'Paid',
    className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-400',
  },
  PENDING: {
    label: 'Pending',
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-500/10 dark:text-amber-400',
  },
  OVERDUE: {
    label: 'Overdue',
    className: 'bg-rose-100 text-rose-800 dark:bg-rose-500/10 dark:text-rose-400',
  },
  SENT: {
    label: 'Sent',
    icon: UploadCloud,
    className: 'bg-sky-100 text-sky-800 dark:bg-sky-500/10 dark:text-sky-400',
  },
  INCOME: {
    label: 'Income',
    className: 'bg-teal-50 text-teal-700 border-teal-200',
  },
  EXPENSE: {
    label: 'Expense',
    className: 'bg-pink-50 text-pink-700 border-pink-200',
  },
}

export default function StatusBadge({ status, className }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.INACTIVE
  const Icon = config.icon

  return (
    <Badge
      variant="none"
      className={cn(
        'flex items-center gap-2 rounded-full px-2.5 py-1 border-none shadow-none transition-colors',
        config.className,
        className,
      )}
    >
      {Icon && <Icon className="size-4 shrink-0" aria-hidden />}
      <span className="text-xs font-semibold whitespace-nowrap">
        {config.label}
      </span>
    </Badge>
  )
}
