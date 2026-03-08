import { MoreHorizontal, Target, CalendarDays, User } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
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
  Active:
    'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  Completed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  Archived: 'bg-muted text-muted-foreground',
}

const PIPELINE_COLORS = {
  draft_count: 'bg-blue-600',
  revision_count: 'bg-pink-600',
  pending_count: 'bg-orange-600',
  scheduled_count: 'bg-purple-600',
  published_count: 'bg-emerald-600',
}

const StatItem = ({ count, label, colorClass }) => {
  if (!count || count < 1) return null
  return (
    <div className="flex items-center gap-2 shrink-0">
      <div className={`size-2 rounded-full ${colorClass}`} />
      <div className="flex items-baseline gap-1.5">
        <span className="text-sm font-bold dark:text-white leading-none">
          {count}
        </span>
        <span className="text-xs text-muted-foreground font-medium">
          {label}
        </span>
      </div>
    </div>
  )
}

function formatDateRange(start, end) {
  if (!start && !end) return 'No dates set'
  const fmt = (d) => format(parseISO(d), 'MMM d, yyyy')
  if (start && end) return `${fmt(start)} – ${fmt(end)}`
  if (start) return `From ${fmt(start)}`
  return `Until ${fmt(end)}`
}

export function CampaignCard({
  campaign,
  onEdit,
  onDelete,
  onStatusChange,
  showClient,
}) {
  const navigate = useNavigate()
  const {
    id,
    name,
    description,
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
    client_name,
    client_avatar,
  } = campaign

  // Progress is displayed if there is a known capacity, even if 0% is completed.
  const progress =
    total_posts > 0 ? Math.round((published_count / total_posts) * 100) : 0

  const pipelineCounts = [
    { key: 'draft_count', value: draft_count, label: 'Drafts' },
    { key: 'revision_count', value: revision_count, label: 'Rev.' },
    { key: 'pending_count', value: pending_count, label: 'Pend.' },
    { key: 'scheduled_count', value: scheduled_count, label: 'Sched.' },
    { key: 'published_count', value: published_count, label: 'Pub.' },
  ].filter((c) => c.value > 0)

  const hasPipelineData = pipelineCounts.length > 0 || published_count > 0

  return (
    <div
      className="rounded-2xl border border-border/60 bg-card/50 p-6 flex flex-col h-full hover:border-border transition-colors cursor-pointer shadow-sm"
      onClick={() => navigate(`/campaigns/${id}`)}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-6">
        <div className="flex flex-col gap-2 min-w-0">
          <h3 className="text-lg font-semibold truncate">{name}</h3>
          {description && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {description}
            </p>
          )}
        </div>

        <div
          className="flex items-center gap-2 shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <span
            className={cn(
              'px-2.5 py-0.5 rounded-full text-xs font-medium',
              STATUS_STYLES[status] ?? STATUS_STYLES.Archived,
            )}
          >
            {status}
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground -mr-2"
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation()
                  onEdit(campaign)
                }}
              >
                Edit
              </DropdownMenuItem>
              {status === 'Active' && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation()
                    onStatusChange(campaign, 'Completed')
                  }}
                >
                  Mark Complete
                </DropdownMenuItem>
              )}
              {(status === 'Active' || status === 'Completed') && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation()
                    onStatusChange(campaign, 'Archived')
                  }}
                >
                  Archive
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(campaign)
                }}
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Goal */}
      {goal && (
        <div className="flex items-center gap-2 text-foreground/80 mb-6">
          <Target className="size-4 shrink-0" />
          <span className="text-xs line-clamp-1" title={goal}>
            {goal}
          </span>
        </div>
      )}

      {/* Pipeline Stats */}
      <div className="flex-1 min-w-0 mb-6">
        {hasPipelineData ? (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            {pipelineCounts.map((c) => (
              <StatItem
                key={c.key}
                count={c.value}
                label={c.label}
                colorClass={PIPELINE_COLORS[c.key]}
              />
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="size-1.5 rounded-full bg-muted-foreground/20" />
            <span className="text-xs italic text-muted-foreground/50 tracking-wide">
              No active pipeline workflow
            </span>
          </div>
        )}

        {/* Progress bar */}
        {total_posts > 0 && (
          <div className="space-y-2 mt-6" data-testid="progress-bar">
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

      {/* Footer */}
      <div className="flex items-center justify-between pt-6 border-t border-dashed border-gray-100 dark:border-white/5 mt-auto min-w-0">
        {/* Client Info */}
        <div className="flex items-center min-w-0">
          {showClient && client_name && (
            <div className="flex items-center gap-2">
              {client_avatar ? (
                <img
                  src={client_avatar}
                  alt={client_name}
                  className="size-6 rounded-full object-cover border border-border"
                />
              ) : (
                <div className="size-6 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="size-3 text-primary" />
                </div>
              )}
              <span className="text-xs font-medium truncate max-w-[120px]">
                {client_name}
              </span>
            </div>
          )}
        </div>

        {/* Date Range */}
        <div className="flex items-center shrink-0 text-xs gap-1.5 font-medium text-muted-foreground/80">
          <CalendarDays className="size-3.5 opacity-70" />
          <span>{formatDateRange(start_date, end_date)}</span>
        </div>
      </div>
    </div>
  )
}
