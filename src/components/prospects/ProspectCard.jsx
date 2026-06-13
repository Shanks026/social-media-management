import { useState } from 'react'
import { MapPin, MoreHorizontal, Pencil, Trash2, Check, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ProspectStatusBadge, PROSPECT_STATUS_CONFIG } from './ProspectStatusBadge'
import { ProspectSourceBadge } from './ProspectSourceBadge'
import { useUpdateProspect, PROSPECT_STATUSES } from '@/api/prospects'
import { formatDate } from '@/lib/helper'

// Solid dot color per status — matches badge palette
const STATUS_DOT = {
  new:            'bg-gray-400',
  contacted:      'bg-blue-500',
  follow_up:      'bg-amber-500',
  demo_scheduled: 'bg-violet-500',
  proposal_sent:  'bg-indigo-500',
  won:            'bg-green-500',
  lost:           'bg-red-500',
}


export function ProspectCard({ prospect, onClick, onEdit, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const updateProspect = useUpdateProspect()

  async function handleStatusChange(newStatus) {
    if (newStatus === prospect.status) return
    try {
      await updateProspect.mutateAsync({
        id: prospect.id,
        status: newStatus,
        _prevStatus: prospect.status,
      })
      toast.success(`Status updated to ${PROSPECT_STATUS_CONFIG[newStatus]?.label ?? newStatus}`)
    } catch (err) {
      toast.error(err.message || 'Failed to update status')
    }
  }

  return (
    <Card
      onClick={onClick}
      className="py-2 group cursor-pointer shadow-none transition-all duration-200 border hover:bg-accent/30 dark:hover:bg-card dark:bg-card/70 dark:border-none overflow-hidden"
    >
      <CardContent className="p-6 flex flex-col gap-4">

        {/* Top: status badge + source badge + actions menu */}
        <div className="flex items-center gap-2">
          <ProspectStatusBadge status={prospect.status} />
          <ProspectSourceBadge source={prospect.source} />

          {/* Actions menu — pushed to far right */}
          <div
            className="ml-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    'flex items-center justify-center size-6 rounded-md transition-all text-muted-foreground hover:text-foreground hover:bg-muted/60',
                    menuOpen
                      ? 'opacity-100 bg-muted/60'
                      : 'opacity-0 group-hover:opacity-100'
                  )}
                >
                  <MoreHorizontal className="size-3.5" />
                </button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-48" onClick={(e) => e.stopPropagation()}>

                {/* Status options */}
                <DropdownMenuLabel className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider px-2 py-1">
                  Set Status
                </DropdownMenuLabel>
                {PROSPECT_STATUSES.map((s) => (
                  <DropdownMenuItem
                    key={s.value}
                    onClick={() => handleStatusChange(s.value)}
                    className="gap-2.5"
                  >
                    <span
                      className={cn(
                        'size-3 rounded-[3px] shrink-0',
                        STATUS_DOT[s.value] ?? 'bg-muted-foreground'
                      )}
                    />
                    <span className="flex-1">{s.label}</span>
                    {prospect.status === s.value && (
                      <Check className="size-3 text-muted-foreground shrink-0" />
                    )}
                  </DropdownMenuItem>
                ))}

                <DropdownMenuSeparator />

                {/* Edit */}
                <DropdownMenuItem
                  onClick={() => onEdit?.(prospect)}
                  className="gap-2"
                >
                  <Pencil className="size-3.5" />
                  Edit
                </DropdownMenuItem>

                {/* Delete */}
                <DropdownMenuItem
                  onClick={() => onDelete?.(prospect)}
                  className="gap-2 text-destructive focus:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                  Delete
                </DropdownMenuItem>

              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Business name + location */}
        <div className="space-y-1.5">
          <h3 className="text-base font-semibold text-foreground tracking-tight leading-tight group-hover:text-primary transition-colors">
            {prospect.business_name}
          </h3>
          {(prospect.location || prospect.address) && (
            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <MapPin className="size-3 shrink-0 mt-0.5" />
              <span className="line-clamp-2">
                {[prospect.address, prospect.location].filter(Boolean).join(', ')}
              </span>
            </p>
          )}
        </div>

        {/* Fields grid */}
        <div className="border-t border-dashed border-border pt-4 grid grid-cols-2 gap-x-4 gap-y-3.5">
          <div className="min-w-0">
            <p className="text-[11px] text-muted-foreground mb-0.5">Contact Name</p>
            <p className="text-xs font-medium text-foreground truncate">
              {prospect.contact_name || '—'}
            </p>
          </div>

          <div className="min-w-0">
            <p className="text-[11px] text-muted-foreground mb-0.5">Website</p>
            <p className="text-xs font-medium text-muted-foreground truncate">
              {prospect.website || '—'}
            </p>
          </div>

          <div className="min-w-0">
            <p className="text-[11px] text-muted-foreground mb-0.5">Email</p>
            <p className="text-xs font-medium text-foreground truncate">
              {prospect.email || '—'}
            </p>
          </div>

          <div className="min-w-0">
            <p className="text-[11px] text-muted-foreground mb-0.5">Phone</p>
            <p className="text-xs font-medium text-foreground truncate">
              {prospect.phone || '—'}
            </p>
          </div>
        </div>

        {/* Footer: created date + view details */}
        <div className="border-t border-dashed border-border pt-4 flex items-center justify-between gap-2 mt-auto">
          <span className="text-xs text-muted-foreground">
            {formatDate(prospect.created_at)}
          </span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            View Details <ArrowRight className="size-3" />
          </span>
        </div>

      </CardContent>
    </Card>
  )
}
