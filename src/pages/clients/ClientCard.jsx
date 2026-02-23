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
import {
  Instagram,
  Linkedin,
  Twitter,
  Crown,
  Zap,
  CalendarDays,
  Facebook,
  Youtube,
  Globe,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { getUrgencyStatus } from '@/lib/client-helpers'
import IndustryBadge from './IndustryBadge' // Ensure this path is correct
import TierBadge from '@/components/TierBadge'

import { useTransactions } from '@/api/transactions'
import { useExpenses } from '@/api/expenses'
import { useClientMetrics } from '@/api/clients'
import { calculatePeriodMetrics, formatCurrency } from '@/utils/finance'
import { startOfMonth, endOfMonth, format } from 'date-fns'

const PlatformIcon = ({ name }) => {
  // Map the id to the filename, handling your specific google_business naming
  const fileName = name === 'google_business' ? 'google_busines' : name
  const imgSrc = `/platformIcons/${fileName}.png`

  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-full border-white dark:border-[#1c1c1f] bg-white dark:bg-zinc-900 shadow-sm transition-transform hover:scale-110 overflow-hidden">
      <img
        src={imgSrc}
        alt={name}
        className="size-7 object-contain"
        // Fallback for missing images
        onError={(e) => (e.target.style.display = 'none')}
      />
    </div>
  )
}

const StatItem = ({ count, label, colorClass }) => {
  if (!count || count < 1) return null
  return (
    <div className="flex items-center gap-2 shrink-0">
      <div className={`size-2 rounded-full ${colorClass}`} />
      <div className="flex items-baseline gap-1.5">
        <span className="text-sm font-bold dark:text-white leading-none">
          {count}
        </span>
        <span className="text-xs text-muted-foreground font-medium">
          {label}
        </span>
      </div>
    </div>
  )
}

const ProfitMarginDisplay = ({ clientId }) => {
  const start = startOfMonth(new Date())
  const end = endOfMonth(new Date())

  const { data: transactions = [], isLoading: txLoading } = useTransactions({
    clientId,
    startDate: format(start, 'yyyy-MM-dd'),
    endDate: format(end, 'yyyy-MM-dd'),
  })

  const { data: expenses = [], isLoading: expLoading } = useExpenses({
    clientId,
  })

  // Should we show a loading state or just hidden? Hidden is cleaner for cards.
  if (txLoading || expLoading) return null

  const metrics = calculatePeriodMetrics({
    transactions,
    expenses,
    periodStart: start,
    periodEnd: end,
    method: 'CASH',
  })

  const { revenue, margin } = metrics

  if (revenue === 0) return null

  let colorClass = 'text-slate-600 dark:text-slate-400'
  if (margin >= 50) colorClass = 'text-emerald-600 dark:text-emerald-400'
  else if (margin < 20) colorClass = 'text-rose-600 dark:text-rose-400'
  else colorClass = 'text-amber-600 dark:text-amber-400'

  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] font-medium text-muted-foreground">
        Margin <span className="text-[9px] opacity-70">(Mo.)</span>
      </span>
      <span className={`text-sm font-bold ${colorClass}`}>
        {margin.toFixed(0)}%
      </span>
    </div>
  )
}

function ClientCard({ client, onOpen, onDelete }) {
  const [deleteOpen, setDeleteOpen] = useState(false)

  // Fetch financial metrics (LTV, Burn Rate)
  const { data: metrics } = useClientMetrics(client.id)

  const tier = client.tier?.toUpperCase() || 'BASIC'

  const platforms = client.platforms || []
  const pipeline = client.pipeline || {
    drafts: 0,
    pending: 0,
    revisions: 0,
    scheduled: 0,
    next_post_at: null,
  }

  const MAX_DISPLAY = 3
  const visiblePlatforms = platforms.slice(0, MAX_DISPLAY)
  const remainingCount = platforms.length - MAX_DISPLAY

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

  return (
    <>
      <Card
        onClick={() => onOpen(client)}
        className={cn(
          "group relative cursor-pointer shadow-none transition-all duration-300 py-2 border hover:bg-gray-100/50 dark:hover:bg-card h-full flex flex-col overflow-hidden",
          client.is_internal
            ? " bg-gray-50 dark:bg-card/50 dark:border-border"
            : "dark:bg-card/30 dark:border-none"
        )}
      >
        <CardContent className="p-6 flex flex-col flex-1 min-w-0">
          {/* Header */}
          <div className="flex justify-between gap-2 items-start mb-6">
            <div className="absolute top-4 right-4">{/* Badge removed */}</div>
            <div className="flex gap-4 items-center min-w-0">
              <div className="h-14 w-14 shrink-0 rounded-2xl bg-transparent flex items-center justify-center overflow-hidden transition-transform">
                {client.logo_url ? (
                  <img
                    src={client.logo_url}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-gray-400 font-bold text-lg">
                    {initials}
                  </div>
                )}
              </div>
              <div className="space-y-2 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-medium text-foreground tracking-tight leading-none truncate]">
                    {client.name}
                  </h3>
                  <TierBadge tier={client.tier} />
                </div>
                {/* Industry Display using the Badge for Label Lookup */}
                <div className="flex">
                  <IndustryBadge industryValue={client.industry} />
                </div>
              </div>
            </div>
          </div>

          {/* Pipeline Stats */}
          <div className="flex-1 min-w-0">
            {hasPipelineData ? (
              <div className="flex flex-wrap items-center gap-x-6 gap-y-3 mb-6">
                <StatItem
                  count={pipeline.drafts}
                  label="Drafts"
                  colorClass="bg-blue-600"
                />
                <StatItem
                  count={pipeline.revisions}
                  label="Revisions"
                  colorClass="bg-pink-600"
                />
                <StatItem
                  count={pipeline.pending}
                  label="Pending"
                  colorClass="bg-orange-600"
                />
                <StatItem
                  count={pipeline.scheduled}
                  label="Scheduled"
                  colorClass="bg-purple-600"
                />
              </div>
            ) : (
              <div className="mb-6 flex items-center gap-2">
                <div className="size-1.5 rounded-full bg-muted-foreground/20" />
                <span className="text-xs italic text-muted-foreground/50 tracking-wide">
                  No active workflow
                </span>
              </div>
            )}

            {/* Financial Snapshot */}
            <div className="grid grid-cols-3 gap-4 py-4 border-t border-dashed border-gray-100 dark:border-white/5">
              {/* Column 1: LTV */}
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] font-medium text-muted-foreground truncate">
                  Lifetime Value{' '}
                  <span className="text-[9px] opacity-70">(Cash)</span>
                </span>
                <span className="text-sm font-bold text-foreground">
                  {metrics?.total_revenue
                    ? formatCurrency(metrics.total_revenue)
                    : formatCurrency(0)}
                </span>
              </div>

              {/* Column 2: Burn */}
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] font-medium text-muted-foreground truncate">
                  Monthly Burn
                </span>
                <span className="text-sm font-bold text-foreground">
                  {metrics?.monthly_recurring_costs
                    ? formatCurrency(metrics.monthly_recurring_costs)
                    : formatCurrency(0)}
                  <span className="text-[10px] text-muted-foreground font-medium ml-0.5">
                    /mo
                  </span>
                </span>
              </div>

              {/* Column 3: Profit Margin (Aligned to end or center vertically) */}
              <div className="flex items-center justify-end md:justify-start">
                <ProfitMarginDisplay clientId={client.id} />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-5 border-t border-dashed border-gray-100 dark:border-white/5 mt-auto min-w-0">
            <div className="flex items-center -space-x-3 overflow-hidden">
              {platforms.length > 0 ? (
                <>
                  {visiblePlatforms.map((p) => (
                    <PlatformIcon key={p} name={p} />
                  ))}
                  {remainingCount > 0 && (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white dark:border-[#1c1c1f] bg-gray-200 dark:bg-zinc-800 text-[10px] font-bold text-gray-600 dark:text-gray-400 z-10">
                      +{remainingCount}
                    </div>
                  )}
                </>
              ) : (
                <span className="text-[11px] font-medium text-muted-foreground/60 ml-3">
                  No active platforms
                </span>
              )}
            </div>

            <div className="flex items-center min-w-0">
              {health && nextPostFormatted ? (
                <div className="flex items-center gap-2.5 px-3 py-1.5 bg-gray-100 dark:bg-white/5 rounded-full border border-gray-100 dark:border-white/5 shrink-0">
                  <div
                    className={`size-2 rounded-full ${health.color} ${health.pulse ? 'animate-pulse shadow-[0_0_8px_rgba(0,0,0,0.1)]' : ''}`}
                  />
                  <div className="flex items-center text-[11px] gap-1 whitespace-nowrap">
                    <span className="text-muted-foreground font-semibold">
                      Next
                    </span>
                    <span className="font-bold text-gray-900 dark:text-gray-100">
                      {nextPostFormatted}
                    </span>
                    {health.label && (
                      <span
                        className={`ml-1 mt-0.5 leading-none font-black ${health.color.replace('bg-', 'text-')}`}
                      >
                        {health.label.toUpperCase()}
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center text-xs gap-2 font-medium text-muted-foreground/60">
                  <CalendarDays size={14} className="opacity-50" />
                  <span>Joined {formatDate(client.created_at)}</span>
                </div>
              )}
            </div>
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
