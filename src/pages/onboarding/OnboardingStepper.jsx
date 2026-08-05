import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Vertical progress rail for the onboarding wizard.
 *
 * `steps` is an array of `{ label, description }`. Completed steps are clickable
 * (to go back); upcoming ones are not. `lockedBefore` seals off steps whose data
 * has already been committed, so a user can't navigate back and re-submit it.
 */
export default function OnboardingStepper({
  steps,
  current,
  onStepClick,
  lockedBefore = 0,
}) {
  return (
    <ol className="space-y-0">
      {steps.map((step, i) => {
        const isDone = i < current
        const isActive = i === current
        const isLast = i === steps.length - 1
        const canClick =
          isDone && i >= lockedBefore && typeof onStepClick === 'function'

        return (
          <li key={step.label} className={cn('relative flex gap-4', !isLast && 'pb-7')}>
            {/* Connector — runs from below this circle to the next one */}
            {!isLast && (
              <span
                aria-hidden
                className={cn(
                  'absolute left-3.5 top-8 -ml-px h-[calc(100%-2rem)] w-px transition-colors',
                  isDone ? 'bg-primary/40' : 'bg-border',
                )}
              />
            )}

            <button
              type="button"
              disabled={!canClick}
              onClick={() => canClick && onStepClick(i)}
              className={cn(
                'group flex flex-1 items-start gap-3 text-left',
                canClick ? 'cursor-pointer' : 'cursor-default',
              )}
            >
              <span
                className={cn(
                  'relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full border bg-background text-xs font-semibold transition-colors',
                  isDone &&
                    'border-primary bg-primary text-primary-foreground group-hover:opacity-80',
                  isActive && 'border-primary text-primary ring-4 ring-primary/10',
                  !isDone && !isActive && 'border-border text-muted-foreground/60',
                )}
              >
                {isDone ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
              </span>

              <span className="min-w-0 pt-0.5">
                <span
                  className={cn(
                    'block text-sm font-medium transition-colors',
                    isActive
                      ? 'text-foreground'
                      : isDone
                        ? 'text-muted-foreground group-hover:text-foreground'
                        : 'text-muted-foreground/60',
                  )}
                >
                  {step.label}
                </span>
                {step.description && (
                  <span
                    className={cn(
                      'block text-xs transition-colors',
                      isActive
                        ? 'text-muted-foreground'
                        : 'text-muted-foreground/50',
                    )}
                  >
                    {step.description}
                  </span>
                )}
              </span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}
