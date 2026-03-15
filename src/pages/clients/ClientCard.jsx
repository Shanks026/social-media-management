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
import { CalendarDays, Globe, Megaphone } from 'lucide-react'
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
      <span className="text-sm font-semibold text-foreground leading-none">{count}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  )
}

function ClientCard({ client, onOpen, onDelete }) {
  const [deleteOpen, setDeleteOpen] = useState(false)

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
          'group cursor-pointer shadow-none transition-all duration-200 border hover:bg-accent/30 dark:hover:bg-card flex flex-col py-2 overflow-hidden',
          client.is_internal
            ? 'bg-muted/30 dark:bg-card dark:border-border border-dashed'
            : 'dark:bg-card/70 dark:border-none',
        )}
      >
        <CardContent className="p-6 flex flex-col gap-5">
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
              <div className="mt-1.5">
                <IndustryBadge industryValue={client.industry} />
              </div>
            </div>
          </div>

          {/* Pipeline stats — fixed min-height keeps cards vertically aligned */}
          <div className="min-h-[22px]">
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

          {/* Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-dashed border-border/50">
            {/* Left: platform + campaign counts — AVG MRR slots in here for external clients */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <Globe className="size-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-foreground">{platforms.length}</span>
                <span className="text-xs text-muted-foreground/60">platforms</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Megaphone className="size-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-foreground">{client.active_campaigns ?? 0}</span>
                <span className="text-xs text-muted-foreground/60">campaigns</span>
              </div>
            </div>

            {/* Right: next scheduled post with urgency indicator, or joined date */}
            {health && nextPostFormatted ? (
              <div className="flex items-center gap-2 shrink-0">
                <div
                  className={`size-2 rounded-full ${health.color} ${health.pulse ? 'animate-pulse' : ''}`}
                />
                <span className="text-xs text-muted-foreground">Next</span>
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
