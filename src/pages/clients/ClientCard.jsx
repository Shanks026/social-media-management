import { useState } from 'react'
import { cn } from '@/lib/utils'

const CLIENT_TYPE_LABELS = {
  monthly_retainer: 'Retainer',
  project_based: 'Project',
  campaign_based: 'Campaign',
  one_off: 'One-Off',
  advisory: 'Advisory',
}
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { CalendarDays } from 'lucide-react'
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
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-1.5">
        <div className={`size-2 rounded-full ${colorClass}`} />
        <span className="text-[10px] text-muted-foreground leading-none truncate">{label}</span>
      </div>
      <span className="text-sm font-bold text-foreground leading-none">{count}</span>
    </div>
  )
}


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

  const activePipelineCount = [pipeline.drafts, pipeline.pending, pipeline.revisions, pipeline.scheduled].filter(
    (v) => v > 0,
  ).length
  const hasPipelineData = activePipelineCount > 0
  const pipelineCols = Math.max(activePipelineCount, 3)

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
        <CardContent className="p-7 flex flex-col gap-4 h-full">
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
              <div className="mt-1 flex items-center gap-2">
                <IndustryBadge industryValue={client.industry} />
                {client.client_type && (
                  <>
                    <div className="size-1 rounded-full bg-muted-foreground/30 shrink-0" />
                    <span className="text-xs text-muted-foreground mt-0.5 leading-none">
                      {CLIENT_TYPE_LABELS[client.client_type] ?? client.client_type}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Pipeline stats */}
          <div className="pt-4 border-t border-dashed border-border">
            {hasPipelineData ? (
              <div className={cn('grid', pipelineCols === 4 ? 'grid-cols-4' : 'grid-cols-3')}>
                <StatItem count={pipeline.drafts} label="Drafts" colorClass="bg-blue-500" />
                <StatItem count={pipeline.pending} label="Submit." colorClass="bg-orange-500" />
                <StatItem count={pipeline.revisions} label="Needs Rev." colorClass="bg-pink-500" />
                <StatItem count={pipeline.scheduled} label="Sched." colorClass="bg-purple-500" />
              </div>
            ) : (
              <span className="text-xs italic text-muted-foreground">No active workflow</span>
            )}
          </div>

          {/* Metrics row: MRR + Margin + Campaigns */}
          {hasMetrics && (
            <div className="pt-4 border-t border-dashed border-border flex items-center gap-2.5">
              {showFinancials && (
                <span className="text-xs font-semibold text-foreground">
                  {(client.avg_monthly_retainer ?? 0) > 0 ? formatMRR(client.avg_monthly_retainer) : '-'}{' '}
                  <span className="font-normal text-muted-foreground">MRR</span>
                </span>
              )}
              {showFinancials && (
                <>
                  <div className="size-1 rounded-full bg-muted-foreground/30 shrink-0" />
                  <span className={`text-xs font-semibold ${margin > 0 ? marginColorClass : 'text-foreground'}`}>
                    {margin > 0 ? `${margin}%` : '-'}{' '}
                    <span className="font-normal text-muted-foreground">Margin</span>
                  </span>
                </>
              )}
              {showCampaigns && (
                <>
                  {showFinancials && <div className="size-1 rounded-full bg-muted-foreground/30 shrink-0" />}
                  <span className="text-xs font-semibold text-foreground">
                    {client.active_campaigns}{' '}
                    <span className="font-normal text-muted-foreground">Campaigns</span>
                  </span>
                </>
              )}
            </div>
          )}

          {/* Footer: platform icons | next post / joined date */}
          <div className="mt-auto flex items-center justify-between pt-5 border-t border-dashed border-border">
            <PlatformStack platforms={platforms} max={3} size={22} />

            {/* Right: next scheduled post with urgency indicator, or joined date */}
            {health && nextPostFormatted ? (
              <div className="flex items-center gap-2 shrink-0">
                <div className="relative flex size-2 items-center justify-center shrink-0">
                  {health.pulse && (
                    <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${health.color}`} />
                  )}
                  <span className={`relative inline-flex size-2 rounded-full ${health.color}`} />
                </div>
                <span className="text-xs text-muted-foreground">Next Post:</span>
                <span className="text-xs font-medium text-foreground">{nextPostFormatted}</span>
                {health.label && (
                  <span className={`text-xs font-semibold ${health.color.replace('bg-', 'text-')}`}>
                    {health.label}
                  </span>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
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
