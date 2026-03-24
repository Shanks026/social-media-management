import { Database, Users, ShieldCheck } from 'lucide-react'
import { UsageCard } from './UsageCard'
import { getStatusConfig } from './utils'

const LoadingSkeleton = () => (
  <div className="grid gap-6 md:grid-cols-2">
    <div className="h-44 bg-muted/40 animate-pulse rounded-2xl col-span-2" />
    <div className="h-44 bg-muted/40 animate-pulse rounded-2xl" />
    <div className="h-44 bg-muted/40 animate-pulse rounded-2xl" />
  </div>
)

export const UsageTab = ({ sub, isLoading }) => {
  if (isLoading) return <LoadingSkeleton />
  if (!sub) return null

  const clientPercent = (sub.client_count / sub.max_clients) * 100

  return (
    <div className="space-y-8">
      <div className="grid gap-6 md:grid-cols-2">
        <UsageCard
          title="Client Capacity"
          icon={Users}
          value={sub.client_count}
          max={sub.max_clients}
          unit="slots"
          percent={clientPercent}
          status={getStatusConfig(clientPercent)}
        />

        <UsageCard
          title="Storage Limit"
          icon={Database}
          value={sub.storage_display.usage_value}
          valueUnit={sub.storage_display.usage_unit}
          unit={sub.storage_display.max_unit}
          max={sub.storage_display.max_value}
          remainingLabel={sub.storage_display.remaining_label}
          percent={sub.storage_display.percent}
          status={getStatusConfig(sub.storage_display.percent)}
        />
      </div>

      <div className="flex items-center gap-4 p-5 rounded-2xl bg-secondary/20 border border-border/40">
        <ShieldCheck className="size-4 text-muted-foreground" />
        <p className="text-[13px] text-muted-foreground font-normal">
          Workspace managed by administrator. For higher limits, upgrade plan or{' '}
          <a
            href="mailto:support@domain.com"
            className="text-primary hover:underline font-medium"
          >
            contact support
          </a>
          .
        </p>
      </div>
    </div>
  )
}
