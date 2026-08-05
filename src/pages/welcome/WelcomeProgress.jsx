import { cn } from '@/lib/utils'

/**
 * Dotted position indicator for the /welcome sections. The active dot widens
 * into a pill; already-visited dots are clickable to jump back, upcoming ones
 * are not — same rule as the onboarding stepper.
 */
export default function WelcomeProgress({ total, index, onJump }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }, (_, i) => {
        const canJump = i < index && typeof onJump === 'function'

        return (
          <button
            key={i}
            type="button"
            aria-label={`Go to section ${i + 1}`}
            aria-current={i === index ? 'step' : undefined}
            disabled={!canJump}
            onClick={() => canJump && onJump(i)}
            className={cn(
              'h-1.5 rounded-full transition-all duration-300',
              i === index
                ? 'w-7 bg-foreground'
                : i < index
                  ? 'w-1.5 bg-foreground/40 cursor-pointer hover:bg-foreground/70'
                  : 'w-1.5 bg-muted-foreground/20',
            )}
          />
        )
      })}
    </div>
  )
}
