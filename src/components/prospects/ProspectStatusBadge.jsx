import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const STATUS_CONFIG = {
  new: {
    label: 'New',
    className: 'bg-gray-100 text-gray-600 border-transparent dark:bg-gray-800 dark:text-gray-300',
  },
  contacted: {
    label: 'Contacted',
    className: 'bg-blue-100 text-blue-700 border-transparent dark:bg-blue-950 dark:text-blue-300',
  },
  follow_up: {
    label: 'Follow-Up',
    className: 'bg-amber-100 text-amber-700 border-transparent dark:bg-amber-950 dark:text-amber-300',
  },
  demo_scheduled: {
    label: 'Demo Scheduled',
    className: 'bg-violet-100 text-violet-700 border-transparent dark:bg-violet-950 dark:text-violet-300',
  },
  proposal_sent: {
    label: 'Proposal Sent',
    className: 'bg-indigo-100 text-indigo-700 border-transparent dark:bg-indigo-950 dark:text-indigo-300',
  },
  won: {
    label: 'Won',
    className: 'bg-green-100 text-green-700 border-transparent dark:bg-green-950 dark:text-green-300',
  },
  lost: {
    label: 'Lost',
    className: 'bg-red-100 text-red-600 border-transparent dark:bg-red-950 dark:text-red-300',
  },
}

export function ProspectStatusBadge({ status, className }) {
  const config = STATUS_CONFIG[status] ?? {
    label: status,
    className: 'bg-muted text-muted-foreground border-transparent',
  }
  return (
    <Badge
      variant="outline"
      className={cn('text-[11px] font-medium whitespace-nowrap', config.className, className)}
    >
      {config.label}
    </Badge>
  )
}

export { STATUS_CONFIG as PROSPECT_STATUS_CONFIG }
