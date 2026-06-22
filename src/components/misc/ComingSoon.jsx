import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Per-feature accent palettes. Full class strings (no interpolation) so the
 * Tailwind JIT compiler keeps them.
 */
const ACCENTS = {
  indigo: {
    badge:
      'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400',
    dotPing: 'bg-indigo-400',
    dotCore: 'bg-indigo-500',
  },
  violet: {
    badge:
      'bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400',
    dotPing: 'bg-violet-400',
    dotCore: 'bg-violet-500',
  },
}

/**
 * Reusable placeholder for features that are announced but not yet built.
 * A single focused hero (emoji, accent badge, title, subtitle, description),
 * with an optional borderless 3-up "what's coming" row beneath a hairline.
 *
 * Props:
 *  - emoji        large decorative emoji (string)
 *  - title        page title (string)
 *  - subtitle     one-line positioning under the title (string)
 *  - status       short status label shown in the badge (string)
 *  - description  reassuring paragraph (string)
 *  - points       optional array of { title, description } capability previews
 *  - accent       'amber' | 'violet' — per-feature identity color
 *  - className    optional wrapper overrides
 */
export default function ComingSoon({
  emoji = '🚧',
  title,
  subtitle,
  status = 'Coming Soon',
  description,
  points = [],
  accent = 'indigo',
  className,
}) {
  const a = ACCENTS[accent] ?? ACCENTS.indigo

  return (
    <div className="h-full bg-background overflow-y-auto selection:bg-primary/10">
      <div
        className={cn(
          'px-8 py-16 max-w-3xl mx-auto min-h-[70vh] flex flex-col justify-center',
          'animate-in fade-in duration-700',
          className,
        )}
      >
        {/* ── Hero ── */}
        <span className="text-6xl leading-none select-none">{emoji}</span>

        <span
          className={cn(
            'mt-6 inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wider',
            a.badge,
          )}
        >
          <span className="relative flex size-1.5">
            <span
              className={cn(
                'absolute inline-flex h-full w-full animate-ping rounded-full opacity-75',
                a.dotPing,
              )}
            />
            <span
              className={cn(
                'relative inline-flex size-1.5 rounded-full',
                a.dotCore,
              )}
            />
          </span>
          {status}
        </span>

        <h1 className="mt-5 text-4xl font-normal tracking-tight text-foreground bricolage">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-2.5 text-base text-muted-foreground font-normal">
            {subtitle}
          </p>
        )}
        {description && (
          <p className="mt-4 max-w-xl text-sm text-muted-foreground/90 leading-relaxed">
            {description}
          </p>
        )}

        {/* ── What's coming — stacked list ── */}
        {points.length > 0 && (
          <div className="mt-6 space-y-3">
            {points.map((point) => (
              <div
                key={point.title}
                className="flex items-start gap-2.5 text-sm"
              >
                <Check
                  className="mt-0.5 size-4 shrink-0 text-green-600 dark:text-green-500"
                  strokeWidth={2.5}
                />
                <p className="leading-relaxed">
                  <span className="font-medium text-foreground">
                    {point.title}
                  </span>
                  {point.description && (
                    <span className="text-muted-foreground">
                      {' — '}
                      {point.description}
                    </span>
                  )}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
