import { ArrowDownCircle, Zap } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export const PlanOverview = ({ sub, currentPlan, onUpgradeClick }) => {
  // Fallbacks in case data hasn't loaded properly
  const Icon = currentPlan?.icon || Zap
  const planName = currentPlan?.name || sub?.plan_name || 'Ignite'
  const bestFor = currentPlan?.bestFor?.toLowerCase() || 'growing businesses'

  // Use the plan's accent color for the icon, or fallback to primary
  const iconColor = currentPlan?.accent?.text || 'text-primary'

  return (
    <Card className="border border-border/50 bg-card/30 rounded-2xl overflow-hidden">
      <div className="p-6 lg:p-8 flex flex-col md:flex-row md:items-center justify-between gap-10">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
          {/* Dynamic Icon with professional muted background */}
          <div
            className={cn(
              'p-4 rounded-2xl border border-border/50 bg-muted/40 shadow-sm',
              iconColor,
            )}
          >
            <Icon className="size-8" />
          </div>

          <div className="space-y-2 text-center sm:text-left">
            <h2 className="text-3xl font-light tracking-tight flex items-center justify-center sm:justify-start gap-2">
              {planName}
              <span className="font-normal italic text-muted-foreground/50 text-3xl">
                Subscription.
              </span>
            </h2>
            <p className="w-[70%] text-muted-foreground text-sm font-light leading-relaxed">
              Your agency is currently on the {planName} tier, ideal for{' '}
              {bestFor}. You have access to all your included core features and
              storage.
            </p>
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
