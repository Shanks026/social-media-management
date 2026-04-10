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
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { format, parseISO } from 'date-fns'

const STATUS_STYLES = {
  Active: 'bg-emerald-500/15 text-emerald-700',
  Completed: 'bg-blue-500/15 text-blue-700',
  Archived: 'bg-muted text-muted-foreground',
}

const PIPELINE_COLORS = {
  draft_count: 'bg-blue-600',
  pending_count: 'bg-orange-600',
  revision_count: 'bg-pink-600',
  approved_count: 'bg-green-600',
  scheduled_count: 'bg-purple-600',
}

const StatItem = ({ count, label, colorClass }) => {
  if (!count || count < 1) return null
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-1.5">
        <div className={`size-2 rounded-full ${colorClass}`} />
        <span className="text-xs text-muted-foreground leading-none truncate">{label}</span>
      </div>
      <span className="text-sm font-bold text-foreground leading-none">{count}</span>
    </div>
  )
}

const CircularProgress = ({ progress, size = 32, strokeWidth = 3 }) => {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (progress / 100) * circumference

  return (
    <div
      className="relative flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
    >
      <svg className="-rotate-90" width={size} height={size}>
        {/* Background circle */}
        <circle
          className="text-muted/30"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        {/* Progress circle */}
        <circle
          className="text-emerald-500 transition-all duration-500 ease-in-out"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
      </svg>
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
    approved_count,
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
    { key: 'pending_count', value: pending_count, label: 'Approval' },
    { key: 'revision_count', value: revision_count, label: 'Revision' },
    { key: 'approved_count', value: approved_count, label: 'Approved' },
    { key: 'scheduled_count', value: scheduled_count, label: 'Sched.' },
  ].filter((c) => c.value > 0)

  const hasPipelineData = pipelineCounts.length > 0 || published_count > 0

  return (
    <Card
      className="rounded-2xl border border-border/60 py-0 bg-card/50 h-full hover:border-border cursor-pointer shadow-none flex flex-col"
      onClick={() => navigate(`/campaigns/${id}`)}
    >
    <CardContent className="p-6 flex flex-col flex-1 min-w-0">
      {/* Row 1: Status + Progress (left) | Menu (right) */}
      <div
        className="flex items-center justify-between mb-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5">
          <span
            className={cn(
              'px-2.5 py-0.5 rounded-full text-xs font-medium',
              STATUS_STYLES[status] ?? STATUS_STYLES.Archived,
            )}
          >
            {status}
          </span>
          {total_posts > 0 && (
            <CircularProgress progress={progress} size={22} strokeWidth={2.5} />
          )}
        </div>
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

      {/* Row 2: Title */}
      <h3 className="text-lg font-semibold line-clamp-2 mb-5">{name}</h3>

      {/* Pipeline Stats */}
      <div className="min-w-0 mb-5">
        {hasPipelineData ? (
          <div className="grid grid-cols-5">
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
          <span className="text-xs italic text-muted-foreground/50 tracking-wide">
            No active pipeline workflow
          </span>
        )}
      </div>

      {/* Goal */}
      {goal && (
        <div className="flex items-center gap-2 text-foreground/80 mb-4">
          <Target className="size-4 shrink-0" />
          <span className="text-xs line-clamp-1" title={goal}>
            {goal}
          </span>
        </div>
      )}

      {/* Description */}
      {description && (
        <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
          {description}
        </p>
      )}

      <div className="flex-1" />

      {/* Footer */}
      <div className="flex items-center justify-between pt-5 border-t border-dashed border-border/50 mt-auto min-w-0">
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
    </CardContent>
    </Card>
  )
}
