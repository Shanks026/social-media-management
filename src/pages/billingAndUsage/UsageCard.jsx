import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

export const UsageCard = ({
  title,
  // eslint-disable-next-line no-unused-vars
  icon: Icon,
  value,
  valueUnit,
  max,
  unit,
  percent,
  status,
  remainingLabel,
}) => (
  <Card
    className={cn(
      'border border-border/50 bg-card/30 shadow-sm rounded-2xl py-2 overflow-hidden transition-all',
      status.border,
    )}
  >
    <CardContent className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-medium text-muted-foreground/70 uppercase tracking-wider">
          {title}
        </p>
        <div className={cn('p-2 rounded-xl bg-muted/50', status.text)}>
          <Icon className="size-4" />
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex items-baseline gap-1">
          <span
            className={cn('text-4xl font-light tracking-tight', status.text)}
          >
            {value}
          </span>
          {valueUnit && (
            <span className={cn('text-sm font-medium mr-1', status.text)}>
              {valueUnit}
            </span>
          )}
          <span className="text-sm font-light text-muted-foreground/60">
            / {max} {unit}
          </span>
        </div>
      </div>

      <div className="space-y-3">
        <Progress
          value={percent}
          className="h-1.5 bg-muted rounded-full"
          indicatorClassName={cn('rounded-full', status.progress)}
        />
        <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">
          <span>
            {remainingLabel || `${(max - value).toFixed(0)} ${unit} remaining`}
          </span>
          <span className={status.text}>{percent.toFixed(0)}%</span>
        </div>
      </div>
    </CardContent>
  </Card>
)
