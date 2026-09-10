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
import ClientMetricsRow from './ClientMetricsRow'

// The deliverable pipeline, showing only the stages that actually have work.
//
// Two earlier shapes were tried and rejected. A five-column grid of counts
// reserved space for every stage even though most clients occupy two, so it
// read as mostly empty. A segmented colour bar was compact but meaningless
// without hovering for a legend, and worse: a client whose deliverables were
// all one status rendered as a single full-width bar, which reads as a
// progress bar at 100% rather than "all of these are drafts".
//
// Approved comes from the 6-arg get_clients_with_pipeline overload, which is
// the one the client calls. Do not go looking for it in the function's return
// type: that overload returns jsonb, so its column names are invisible in the
// signature. The 1-arg overload DOES return a TABLE and genuinely omits
// approved, which makes it an easy thing to mis-read.
//
// The stages are deliberately NOT weighted equally. Awaiting approval and In
// revision are blocked work someone may need to chase today, so they get a
// tinted chip. Drafts, Approved and Scheduled are just state, so they stay
// quiet behind a coloured dot. Scanning the grid should surface what needs
// attention rather than require reading five numbers per card.
const PIPELINE_STAGES = [
  { key: 'pending',   label: 'awaiting approval', one: 'awaiting approval', dot: 'bg-orange-500', chip: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300', urgent: true },
  { key: 'revisions', label: 'in revision',       one: 'in revision',       dot: 'bg-pink-500',   chip: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',        urgent: true },
  { key: 'drafts',    label: 'drafts',            one: 'draft',            dot: 'bg-blue-500' },
  { key: 'approved',  label: 'approved',          one: 'approved',         dot: 'bg-green-500' },
  { key: 'scheduled', label: 'scheduled',         one: 'scheduled',        dot: 'bg-purple-500' },
]

const PipelineStages = ({ pipeline }) => {
  const stages = PIPELINE_STAGES
    .map((s) => ({ ...s, count: pipeline[s.key] || 0 }))
    .filter((s) => s.count > 0)

  if (stages.length === 0) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="size-1.5 shrink-0 rounded-full bg-muted-foreground/30" />
        <span className="text-xs text-muted-foreground">No active workflow</span>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
      {stages.map((s) =>
        s.urgent ? (
          <span
            key={s.key}
            className={cn(
              'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium capitalize',
              s.chip,
            )}
          >
            <span className="font-semibold tabular-nums">{s.count}</span>
            {s.count === 1 ? s.one : s.label}
          </span>
        ) : (
          <span
            key={s.key}
            className="inline-flex items-center gap-1 py-0.5 text-xs capitalize text-muted-foreground"
          >
            <span className={cn('size-1.5 shrink-0 rounded-full', s.dot)} />
            <span className="font-semibold tabular-nums text-foreground/70">{s.count}</span>
            {s.count === 1 ? s.one : s.label}
          </span>
        ),
      )}
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


  return (
    <>
      <Card
        onClick={() => onOpen(client)}
        className={cn(
          'group cursor-pointer shadow-none transition-all duration-200 border hover:bg-accent/30 dark:hover:bg-card flex flex-col overflow-hidden py-0',
          client.is_internal
            ? 'border-border/70 dark:border-border/60'
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

          {/* Pipeline: only the stages that have work, blocked ones emphasised */}
          <div className="pt-4">
            <PipelineStages pipeline={pipeline} />
          </div>

          <ClientMetricsRow client={client} />

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
