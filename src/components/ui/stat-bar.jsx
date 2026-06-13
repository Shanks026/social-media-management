import { cn } from '@/lib/utils'

/**
 * StatBar — a row of connected metric blocks inside a single bordered container,
 * cells divided by vertical rules. Use for page-level summary metrics.
 *
 *   <StatBar>
 *     <StatCell label="Total" value={42} icon={<Users />} iconBg="bg-blue-100" />
 *     <StatCell label="Churn Risk" value={3} valueClass="text-rose-600" />
 *   </StatBar>
 *
 * valueClass  — overrides default value text styles (text-2xl font-bold tracking-tight)
 *               via tailwind-merge, e.g. "text-3xl font-medium bricolage"
 * subClass    — extra classes on the sub-text wrapper
 * sub         — accepts strings or JSX (rendered in a div, not a p)
 */
export function StatBar({ children, className }) {
  return (
    <div className={cn('rounded-xl border flex flex-wrap divide-x divide-border', className)}>
      {children}
    </div>
  )
}

export function StatCell({ label, labelClass, value, valueClass, sub, subClass, icon, iconBg, className }) {
  return (
    <div className={cn('flex-1 min-w-35 px-6 py-5 flex items-start justify-between gap-5', className)}>
      <div className="min-w-0">
        <p className={cn('text-xs text-muted-foreground mb-2.5', labelClass)}>{label}</p>
        <div className={cn('text-2xl font-bold tracking-tight', valueClass)}>{value}</div>
        {sub && (
          <div className={cn('text-xs text-muted-foreground mt-2', subClass)}>{sub}</div>
        )}
      </div>
      {icon && (
        <span className={cn('flex size-6 shrink-0 items-center justify-center rounded-full', iconBg ?? 'bg-muted/80')}>
          {icon}
        </span>
      )}
    </div>
  )
}
