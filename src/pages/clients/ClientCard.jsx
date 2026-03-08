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
import { CalendarDays, Globe, LayoutGrid, Megaphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { getUrgencyStatus } from '@/lib/client-helpers'
import IndustryBadge from './IndustryBadge'
import TierBadge from '@/components/TierBadge'


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

function ClientCard({ client, onOpen, onDelete }) {
  const [deleteOpen, setDeleteOpen] = useState(false)

  const tier = client.tier?.toUpperCase() || 'BASIC'

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
          'group relative cursor-pointer shadow-none transition-all duration-300 py-2 border hover:bg-gray-100/50 dark:hover:bg-card h-full flex flex-col overflow-hidden',
          client.is_internal
            ? ' bg-gray-50 dark:bg-card dark:border-border border-dashed'
            : 'dark:bg-card/70 dark:border-none',
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
              <div className="space-y-3 min-w-0">
                <div className="flex items-center gap-1">
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
              <div className="flex flex-wrap items-center gap-x-6 gap-y-3 mb-4">
                <StatItem
                  count={pipeline.drafts}
                  label="Drafts"
                  colorClass="bg-blue-600"
                />
                <StatItem
                  count={pipeline.revisions}
                  label="Rev."
                  colorClass="bg-pink-600"
                />
                <StatItem
                  count={pipeline.pending}
                  label="Pend."
                  colorClass="bg-orange-600"
                />
                <StatItem
                  count={pipeline.scheduled}
                  label="Sched."
                  colorClass="bg-purple-600"
                />
              </div>
            ) : (
              <div className="mb-4 flex items-center gap-2">
                <div className="size-1.5 rounded-full bg-muted-foreground/20" />
                <span className="text-xs italic text-muted-foreground/50 tracking-wide">
                  No active workflow
                </span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-5 border-t border-dashed border-gray-100 dark:border-white/5 mt-auto min-w-0">
            <div className="flex items-center gap-2 px-3 py-1 bg-gray-100 dark:bg-white/5 rounded-full border border-gray-100 dark:border-white/5 shrink-0">
              <Globe className="size-3 text-muted-foreground" />
              <span className="text-xs font-semibold text-foreground/80">{platforms.length}</span>
              {/* <span className="text-xs text-muted-foreground/50 font-medium">platforms</span>
              <span className="text-muted-foreground/30 text-[10px]">·</span> */}
              <Megaphone className="size-3 text-muted-foreground" />
              <span className="text-xs font-semibold text-foreground/80">{client.active_campaigns ?? 0}</span>
              {/* <span className="text-xs text-muted-foreground/50 font-medium">campaigns</span> */}
            </div>

            <div className="flex items-center min-w-0">
              {health && nextPostFormatted ? (
                <div className="flex items-center gap-2.5 px-3 py-1 bg-gray-100 dark:bg-white/5 rounded-full border border-gray-100 dark:border-white/5 shrink-0">
                  <div
                    className={`size-2 rounded-full ${health.color} ${health.pulse ? 'animate-pulse shadow-[0_0_8px_rgba(0,0,0,0.1)]' : ''}`}
                  />
                  <div className="flex items-center text-[11px] gap-1 whitespace-nowrap">
                    <span className="text-muted-foreground font-semibold">
                      Next
                    </span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {nextPostFormatted}
                    </span>
                    {health.label && (
                      <span
                        className={`ml-1 mt-0.5 leading-none font-medium ${health.color.replace('bg-', 'text-')}`}
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
