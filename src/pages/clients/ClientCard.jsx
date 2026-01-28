import { useState } from 'react'
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

const PlatformIcon = ({ name }) => {
  const icons = {
    instagram: {
      icon: <Instagram className="size-3.5 text-white" />,
      bg: 'bg-[#E4405F]',
    },
    linkedin: {
      icon: <Linkedin className="size-3.5 text-white" />,
      bg: 'bg-[#0077B5]',
    },
    twitter: {
      icon: <Twitter className="size-3.5 text-white" />,
      bg: 'bg-black',
    },
    facebook: {
      icon: <Facebook className="size-3.5 text-white" />,
      bg: 'bg-[#1877F2]',
    },
    youtube: {
      icon: <Youtube className="size-3.5 text-white" />,
      bg: 'bg-[#FF0000]',
    },
    google_business: {
      icon: <Globe className="size-3.5 text-white" />,
      bg: 'bg-[#4285F4]',
    },
  }

  const platform = icons[name.toLowerCase()]
  if (!platform) return null

  return (
    <div
      className={`flex h-8 w-8 items-center justify-center rounded-full border-2 border-background ${platform.bg} shadow-sm transition-transform hover:scale-110`}
    >
      {platform.icon}
    </div>
  )
}

const StatItem = ({ count, label, colorClass }) => {
  if (!count || count < 1) return null
  return (
    <div className="flex items-center gap-2 shrink-0">
      <div className={`size-2.5 rounded-full ${colorClass}`} />
      <div className="flex items-baseline gap-1.5">
        <span className="text-base font-bold dark:text-white leading-none">
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

  const renderTierBadge = () => {
    const baseStyles =
      'inline-flex items-center justify-center py-0.5 px-1.5 rounded-md shrink-0 shadow-md font-bold tracking-wider uppercase'

    if (tier === 'VIP')
      return (
        <div className={`${baseStyles} bg-purple-600 text-white`}>
          <Crown className="size-3 fill-current mr-1" />
          <span className="text-[10px]">VIP</span>
        </div>
      )

    if (tier === 'PRO')
      return (
        <div className={`${baseStyles} bg-amber-400 text-amber-950`}>
          <Zap className="size-3 fill-current mr-1" />
          <span className="text-[10px]">PRO</span>
        </div>
      )

    return null
  }

  return (
    <>
      <Card
        onClick={() => onOpen(client)}
        className="group relative cursor-pointer shadow-none border-none transition-all duration-300 py-2 bg-gray-50/80 dark:bg-card/50 hover:bg-gray-100/50 dark:hover:bg-card h-full flex flex-col overflow-hidden"
      >
        <CardContent className="p-6 flex flex-col flex-1 min-w-0">
          {/* Header */}
          <div className="flex justify-between gap-2 items-start mb-6">
            <div className="flex gap-4 items-center min-w-0">
              <div className="h-14 w-14 shrink-0 rounded-2xl bg-white dark:bg-white/5 border border-gray-100 dark:border-white/10 flex items-center justify-center overflow-hidden shadow-sm transition-transform">
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
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white tracking-normal leading-none truncate">
                    {client.name}
                  </h3>
                  {renderTierBadge()}
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
              <div className="flex flex-wrap items-center gap-x-6 gap-y-3 mb-8">
                <StatItem
                  count={pipeline.drafts}
                  label="Drafts"
                  colorClass="bg-blue-500"
                />
                <StatItem
                  count={pipeline.revisions}
                  label="Revisions"
                  colorClass="bg-red-500"
                />
                <StatItem
                  count={pipeline.pending}
                  label="Pending"
                  colorClass="bg-amber-500"
                />
                <StatItem
                  count={pipeline.scheduled}
                  label="Scheduled"
                  colorClass="bg-purple-500"
                />
              </div>
            ) : (
              <div className="mb-8 flex items-center gap-2">
                <div className="size-1.5 rounded-full bg-muted-foreground/20" />
                <span className="text-xs italic text-muted-foreground/50 tracking-wide">
                  No active workflow
                </span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-5 border-t border-gray-100 dark:border-white/5 mt-auto min-w-0">
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
                <div className="flex items-center text-xs gap-2 text-muted-foreground whitespace-nowrap overflow-hidden">
                  <CalendarDays className="size-4 shrink-0 opacity-60" />
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="font-medium">Onboarded</span>
                    <span className="font-bold text-gray-500 dark:text-gray-400">
                      {joinedDateFormatted}
                    </span>
                  </div>
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
