import JobRolePill from './JobRolePill'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

/**
 * A member's job titles as a capped row of pills.
 *
 * The cap is load-bearing, not decoration: a member can hold any number of
 * titles, and the tightest consumer is the 256px-wide TaskWatchers hover card.
 * Overflow collapses to "+N" rather than wrapping indefinitely; the full list
 * is in a real Tooltip rather than a native `title` attribute, which renders
 * inconsistently (delay, styling, sometimes not at all on a nested SVG/span)
 * across browsers.
 *
 * Renders nothing when the member holds no titles — every caller previously
 * guarded on `functional_role` being truthy, and this keeps that behaviour so
 * no separator or empty badge is left behind.
 */
export default function JobRoleBadges({ roles = [], max = 2, size = 'sm', className }) {
  if (!roles.length) return null

  const shown = roles.slice(0, max)
  const overflow = roles.length - shown.length

  return (
    <span className={cn('inline-flex flex-wrap items-center gap-1', className)}>
      {shown.map((role) => (
        <JobRolePill key={role.id} role={role} size={size} />
      ))}
      {overflow > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
              +{overflow}
            </span>
          </TooltipTrigger>
          <TooltipContent>{roles.map((r) => r.name).join(', ')}</TooltipContent>
        </Tooltip>
      )}
    </span>
  )
}
