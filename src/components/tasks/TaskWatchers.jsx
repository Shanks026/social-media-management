import { Eye } from 'lucide-react'
import { HoverCard, HoverCardTrigger, HoverCardContent } from '@/components/ui/hover-card'
import { getRolePalette } from '@/lib/team-roles'
import { cn } from '@/lib/utils'

/**
 * Who is following a task: its creator plus everyone who has ever held it,
 * minus the current assignee (already shown as "Assigned To"). These are the
 * same people `tg_notify_task_changes` fans out to, so the chip is a direct
 * readout of "who hears about this", not a separate concept.
 *
 * `watcherIds` comes from `useTaskWatchers(task)`; `memberMap` from
 * `useTaskLookups()`, so removed members still resolve to a name.
 */
export default function TaskWatchers({ watcherIds = [], memberMap = {} }) {
  if (watcherIds.length === 0) return null

  const watchers = watcherIds.map((id) => memberMap[id]).filter(Boolean)
  if (watchers.length === 0) return null

  return (
    <HoverCard openDelay={100}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-full border border-border/60 px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
        >
          <Eye className="size-3.5 shrink-0" />
          {watchers.length}
        </button>
      </HoverCardTrigger>
      <HoverCardContent align="start" className="w-64 p-0">
        <p className="border-b border-border/50 px-3 py-2 text-xs font-medium text-muted-foreground">
          Notified about this task
        </p>
        <div className="flex flex-col py-1">
          {watchers.map((m) => {
            const palette = getRolePalette(m.functional_role)
            return (
              <div key={m.member_user_id} className={cn('flex items-center gap-2.5 px-3 py-1.5', m._removed && 'opacity-60')}>
                {m.avatar_url ? (
                  <img
                    src={m.avatar_url}
                    alt=""
                    className={cn('size-6 shrink-0 rounded-full object-cover', m._removed && 'grayscale')}
                  />
                ) : (
                  <div
                    className={cn(
                      'flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold',
                      m._removed ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary',
                    )}
                  >
                    {(m.full_name || m.email || '?')[0].toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm leading-tight">
                    {m.full_name || m.email}
                    {m._removed && <span className="text-muted-foreground"> (Removed)</span>}
                  </p>
                  {m.functional_role && (
                    <span className="mt-0.5 flex items-center gap-1.5">
                      <span className={cn('size-1.5 shrink-0 rounded-full', palette?.dot ?? 'bg-muted-foreground/50')} />
                      <span className="truncate text-xs text-muted-foreground">{m.functional_role}</span>
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}
