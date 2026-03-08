import { MoreHorizontal, FolderOpen } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { format, parseISO } from 'date-fns'

const STATUS_STYLES = {
  Active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
  Completed: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400',
  Archived: 'bg-muted text-muted-foreground',
}

function formatDateRange(start, end) {
  if (!start && !end) return 'No dates set'
  const fmt = (d) => format(parseISO(d), 'MMM d, yyyy')
  if (start && end) return `${fmt(start)} – ${fmt(end)}`
  if (start) return `From ${fmt(start)}`
  return `Until ${fmt(end)}`
}

const STATUS_LABELS = {
  draft_count: 'Drafts',
  pending_count: 'Pending',
  revision_count: 'Revisions',
  scheduled_count: 'Scheduled',
  published_count: 'Published',
}

export function CampaignCard({ campaign, onEdit, onDelete, onStatusChange }) {
  const {
    name,
    goal,
    status,
    start_date,
    end_date,
    total_posts,
    draft_count,
    pending_count,
    revision_count,
    scheduled_count,
    published_count,
  } = campaign

  const progress =
    total_posts > 0 ? Math.round((published_count / total_posts) * 100) : 0

  const pipelineCounts = [
    { key: 'draft_count', value: draft_count, label: 'Drafts' },
    { key: 'pending_count', value: pending_count, label: 'Pending' },
    { key: 'revision_count', value: revision_count, label: 'Revisions' },
    { key: 'scheduled_count', value: scheduled_count, label: 'Scheduled' },
    { key: 'published_count', value: published_count, label: 'Published' },
  ].filter((c) => c.value > 0)

  return (
    <div className="rounded-xl border border-border/60 bg-card p-4 flex flex-col gap-3 hover:border-border transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <FolderOpen className="size-4 text-muted-foreground shrink-0" />
          <span className="font-medium text-sm truncate">{name}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className={cn(
              'text-xs font-medium px-2 py-0.5 rounded-full',
              STATUS_STYLES[status] ?? STATUS_STYLES.Archived,
            )}
          >
            {status}
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(campaign)}>
                Edit
              </DropdownMenuItem>
              {status === 'Active' && (
                <DropdownMenuItem
                  onClick={() => onStatusChange(campaign, 'Completed')}
                >
                  Mark Complete
                </DropdownMenuItem>
              )}
              {(status === 'Active' || status === 'Completed') && (
                <DropdownMenuItem
                  onClick={() => onStatusChange(campaign, 'Archived')}
                >
                  Archive
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => onDelete(campaign)}
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Goal */}
      {goal && (
        <p
          className="text-xs text-muted-foreground truncate"
          title={goal}
        >
          {goal}
        </p>
      )}

      {/* Date range */}
      <p className="text-xs text-muted-foreground">
        {formatDateRange(start_date, end_date)}
      </p>

      {/* Pipeline mini counts */}
      {pipelineCounts.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {pipelineCounts.map((c) => (
            <span
              key={c.key}
              className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground"
            >
              {c.value} {c.label}
            </span>
          ))}
        </div>
      )}

      {/* Progress bar */}
      {total_posts > 0 && (
        <div className="space-y-1" data-testid="progress-bar">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Progress</span>
            <span>{progress}%</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
