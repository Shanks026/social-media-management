import { useState } from 'react'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { CalendarDays, TrendingUp, Percent, Megaphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { getUrgencyStatus } from '@/lib/client-helpers'
import IndustryBadge from './IndustryBadge'
import TierBadge from '@/components/TierBadge'
import { PlatformStack } from '@/components/PlatformIcon'
import { useSubscription } from '@/api/useSubscription'


const StatItem = ({ count, label, colorClass }) => {
  if (!count || count < 1) return null
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <div className={`size-2 rounded-full ${colorClass}`} />
      <span className="text-xs font-semibold text-foreground leading-none">{count}</span>
      <span className="text-xs text-muted-foreground/60">{label}</span>
    </div>
  )
}

const MetricItem = ({ label, icon: Icon, value, valueClass }) => (
  <div className="flex flex-col gap-1.5">
    <div className="flex items-center gap-1 leading-none">
      {Icon && <Icon className="size-3 text-muted-foreground/60" />}
      <span className="text-[10px] font-medium text-muted-foreground/60 capitalize leading-none">
        {label}
      </span>
    </div>
    <span className={`text-sm font-semibold leading-none ${valueClass ?? 'text-foreground'}`}>
      {value}
    </span>
  </div>
)

function ClientCard({ client, onOpen, onDelete }) {
  const [deleteOpen, setDeleteOpen] = useState(false)
  const { data: sub } = useSubscription()

  const platforms = client.platforms || []
  const pipeline = client.pipeline || {
    drafts: 0,
    pending: 0,
    revisions: 0,
    scheduled: 0,
    next_post_at: null,
  }

  const health = getUrgencyStatus(pipeline.next_post_at)

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }

  const nextPostFormatted = pipeline.next_post_at
    ? formatDate(pipeline.next_post_at)
    : null
  const joinedDateFormatted = formatDate(client.created_at)

  const formatMRR = (val) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val)

  const initials = client.name
    ? client.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'CL'

  const hasPipelineData =
    pipeline.drafts > 0 ||
    pipeline.pending > 0 ||
    pipeline.revisions > 0 ||
    pipeline.scheduled > 0

  const showFinancials = !client.is_internal
  const showCampaigns = !!sub?.campaigns && (client.active_campaigns ?? 0) > 0
  const hasMetrics = showFinancials || showCampaigns

  const margin = client.profit_margin ?? 0
  const marginColorClass =
    margin === 0
      ? 'text-foreground'
      : margin >= 70
        ? 'text-emerald-500'
        : margin >= 40
          ? 'text-amber-500'
          : 'text-red-500'

  return (
    <>
      <Card
        onClick={() => onOpen(client)}
        className={cn(
          'group cursor-pointer shadow-none transition-all duration-200 border hover:bg-accent/30 dark:hover:bg-card flex flex-col overflow-hidden py-2',
          client.is_internal
            ? 'bg-muted/30 dark:bg-card dark:border-border border-dashed'
            : 'dark:bg-card/70 dark:border-none',
        )}
      >
        <CardContent className="p-7 flex flex-col gap-5 h-full">
          {/* Header: logo + name + tier + industry */}
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 shrink-0 rounded-xl overflow-hidden bg-muted">
              {client.logo_url ? (
                <img src={client.logo_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full flex items-center justify-center text-muted-foreground font-semibold text-sm">
                  {initials}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 min-w-0">
                <h3 className="text-base font-semibold text-foreground tracking-tight truncate">
                  {client.name}
                </h3>
                <TierBadge tier={client.tier} />
              </div>
              <div className="mt-2">
                <IndustryBadge industryValue={client.industry} />
              </div>
            </div>
          </div>

          {/* Pipeline stats */}
          <div className="pt-5 border-t border-dashed border-border/50 min-h-9.5">
            {hasPipelineData ? (
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                <StatItem count={pipeline.drafts} label="Drafts" colorClass="bg-blue-500" />
                <StatItem count={pipeline.revisions} label="Revisions" colorClass="bg-pink-500" />
                <StatItem count={pipeline.pending} label="Pending" colorClass="bg-orange-500" />
                <StatItem count={pipeline.scheduled} label="Scheduled" colorClass="bg-purple-500" />
              </div>
            ) : (
              <span className="text-xs italic text-muted-foreground/40">No active workflow</span>
            )}
          </div>

          {/* Metrics row: MRR + Margin + Campaigns */}
          {hasMetrics && (
            <div className="pt-5 border-t border-dashed border-border/50 grid grid-cols-3">
              {showFinancials ? (
                <MetricItem icon={TrendingUp} label="MRR" value={formatMRR(client.avg_monthly_retainer ?? 0)} />
              ) : <div />}
              {showFinancials ? (
                <MetricItem
                  icon={Percent}
                  label="Margin"
                  value={`${margin}%`}
                  valueClass={marginColorClass}
                />
              ) : <div />}
              {showCampaigns ? (
                <MetricItem icon={Megaphone} label="Campaigns" value={client.active_campaigns} />
              ) : <div />}
            </div>
          )}

          {/* Footer: platform icons | next post / joined date */}
          <div className="mt-auto flex items-center justify-between pt-5 border-t border-dashed border-border/50">
            <PlatformStack platforms={platforms} max={3} size={22} />

            {/* Right: next scheduled post with urgency indicator, or joined date */}
            {health && nextPostFormatted ? (
              <div className="flex items-center gap-2 shrink-0">
                <div
                  className={`size-2 rounded-full ${health.color} ${health.pulse ? 'animate-pulse' : ''}`}
                />
                <span className="text-xs text-muted-foreground/60">Next</span>
                <span className="text-xs font-medium text-foreground">{nextPostFormatted}</span>
                {health.label && (
                  <span className={`text-xs font-semibold ${health.color.replace('bg-', 'text-')}`}>
                    {health.label}
                  </span>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground/60">
                <CalendarDays size={13} />
                <span>{joinedDateFormatted}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Remove <span className="font-bold">{client.name}</span> from the
              workspace?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                onDelete(client)
                setDeleteOpen(false)
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default ClientCard
