import { ArrowDownCircle, Zap, Calendar, AlertTriangle } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/helper'

export const PlanOverview = ({ sub, currentPlan, onUpgradeClick, isFree }) => {
  const Icon = currentPlan?.icon || Zap
  const planName = currentPlan?.name || sub?.plan_name || 'Ignite'
  const bestFor = currentPlan?.bestFor?.toLowerCase() || 'growing businesses'
  const iconColor = currentPlan?.accent?.text || 'text-primary'

  if (isFree) {
    return (
      <Card className="border border-border/40 bg-muted/20 rounded-2xl overflow-hidden">
        <div className="p-6 lg:p-8 flex flex-col md:flex-row md:items-center justify-between gap-10">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            <div className="p-4 rounded-2xl border border-border/40 bg-muted/40 shadow-sm text-muted-foreground">
              <Zap className="size-8" />
            </div>
            <div className="space-y-2 text-center sm:text-left">
              <h2 className="text-3xl font-normal tracking-tight flex items-center justify-center sm:justify-start gap-2 text-muted-foreground">
                Free
                <span className="font-normal italic text-muted-foreground/40 text-3xl">
                  Subscription.
                </span>
              </h2>
              <p className="w-[70%] text-muted-foreground/70 text-sm font-normal leading-relaxed">
                You're on the Free tier with limited access. Upgrade to unlock
                more clients, storage, and advanced features for your agency.
              </p>
            </div>
          </div>

          <Button
            size="lg"
            variant="outline"
            className="h-12 px-8 rounded-full font-medium text-sm transition-all gap-2"
            onClick={onUpgradeClick}
          >
            Upgrade Plan <ArrowDownCircle size={18} />
          </Button>
        </div>
      </Card>
    )
  }

  const renewalDate = sub?.subscription_ends_at ? formatDate(sub.subscription_ends_at) : null
  const subPhase = sub?.sub_phase

  const renewalBadge = subPhase === 'grace'
    ? { label: 'Expired · Grace Period', color: 'text-destructive bg-destructive/8 border-destructive/20' }
    : subPhase === 'critical'
      ? { label: `Expires ${sub.sub_days_remaining === 0 ? 'today' : sub.sub_days_remaining === 1 ? 'tomorrow' : `in ${sub.sub_days_remaining} days`}`, color: 'text-destructive bg-destructive/8 border-destructive/20' }
      : subPhase === 'warning'
        ? { label: `Renews in ${sub.sub_days_remaining} day${sub.sub_days_remaining !== 1 ? 's' : ''}`, color: 'text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950/40 dark:border-amber-900/30' }
        : null

  return (
    <Card className="border border-border/50 bg-card/30 rounded-2xl overflow-hidden">
      <div className="p-6 lg:p-8 flex flex-col md:flex-row md:items-center justify-between gap-10">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
          <div
            className={cn(
              'p-4 rounded-2xl border border-border/50 bg-muted/40 shadow-sm',
              iconColor,
            )}
          >
            <Icon className="size-8" />
          </div>

          <div className="space-y-2 text-center sm:text-left">
            <h2 className="text-3xl font-normal tracking-tight flex items-center justify-center sm:justify-start gap-2">
              {planName}
              <span className="font-normal italic text-muted-foreground/50 text-3xl">
                Subscription.
              </span>
            </h2>
            <p className="w-[70%] text-muted-foreground text-sm font-normal leading-relaxed">
              Your agency is currently on the {planName} tier, ideal for{' '}
              {bestFor}. You have access to all your included core features and
              storage.
            </p>
            {renewalDate && (
              <div className="flex items-center justify-center sm:justify-start gap-3 pt-1 flex-wrap">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Calendar className="size-3.5 shrink-0" />
                  <span>Next renewal: <span className="font-medium text-foreground">{renewalDate}</span></span>
                </div>
                {renewalBadge && (
                  <span className={cn('inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border', renewalBadge.color)}>
                    {(subPhase === 'grace' || subPhase === 'critical') && <AlertTriangle className="size-3 shrink-0" />}
                    {renewalBadge.label}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <Button
          size="lg"
          className="h-12 px-8 rounded-full font-medium text-sm shadow-lg shadow-primary/5 transition-all gap-2"
          onClick={onUpgradeClick}
        >
          Upgrade Plan <ArrowDownCircle size={18} />
        </Button>
      </div>
    </Card>
  )
}
