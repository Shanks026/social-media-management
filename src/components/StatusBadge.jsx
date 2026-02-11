import {
  Clock,
  CalendarClock,
  AlertTriangle,
  CheckCircle2,
  Archive,
  PlayCircle,
  UploadCloud,
  PauseCircle,
  Pencil,
  CircleDashed,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'

const STATUS_CONFIG = {
  DRAFT: {
    label: 'Draft',
    icon: Pencil,
    className:
      'bg-blue-100 text-blue-800 dark:bg-blue-500/10 dark:text-blue-400',
  },
  PENDING_APPROVAL: {
    label: 'Awaiting Approval',
    icon: Clock,
    className:
      'bg-orange-100 text-orange-800 dark:bg-orange-500/10 dark:text-orange-400',
  },
  SCHEDULED: {
    label: 'Scheduled',
    icon: CalendarClock,
    className:
      'bg-purple-100 text-purple-800 dark:bg-purple-500/10 dark:text-purple-400',
  },
  NEEDS_REVISION: {
    label: 'Needs Revision',
    icon: CircleDashed,
    className:
      'bg-pink-100 text-pink-800 dark:bg-pink-500/10 dark:text-pink-400',
  },
  APPROVED: {
    label: 'Approved',
    icon: CheckCircle2,
    className:
      'bg-lime-100 text-lime-800 dark:bg-lime-500/10 dark:text-lime-400',
  },
  ARCHIVED: {
    label: 'Archived - Read Only',
    icon: Archive,
    className:
      'bg-slate-100 text-slate-800 dark:bg-slate-500/20 dark:text-slate-400',
  },
  ACTIVE: {
    label: 'Active',
    icon: PlayCircle,
    className:
      'bg-green-100 text-green-800 dark:bg-green-500/10 dark:text-green-400',
  },
  PUBLISHED: {
    label: 'Published',
    icon: UploadCloud,
    className:
      'bg-lime-100 text-lime-800 dark:bg-lime-500/10 dark:text-lime-400',
  },
  INACTIVE: {
    label: 'Inactive',
    icon: PauseCircle,
    className:
      'bg-slate-100 text-slate-800 dark:bg-slate-500/20 dark:text-slate-400',
  },
  MONTHLY: {
    label: 'Monthly',
    className:
      'bg-cyan-100 text-cyan-800 dark:bg-cyan-500/10 dark:text-cyan-400',
  },
  QUARTERLY: {
    label: 'Quarterly',
    className:
      'bg-indigo-100 text-indigo-800 dark:bg-indigo-500/10 dark:text-indigo-400',
  },
  YEARLY: {
    label: 'Yearly',
    className:
      'bg-violet-100 text-violet-800 dark:bg-violet-500/10 dark:text-violet-400',
  },
}

export default function StatusBadge({ status }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.INACTIVE
  const Icon = config.icon

  return (
    <Badge
      variant="none"
      className={`flex items-center gap-2 rounded-full px-2.5 py-1 border-none shadow-none transition-colors ${config.className}`}
    >
      {Icon && <Icon className="size-4 shrink-0" aria-hidden />}
      <span className="text-xs font-semibold whitespace-nowrap">
        {config.label}
      </span>
    </Badge>
  )
}
