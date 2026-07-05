import { useState } from 'react'
import { Image as ImageIcon, Play, Search, ChevronDown, ChevronUp, FileText, X, Check, Building2 } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { PlatformStack } from '@/components/PlatformIcon'
import StatusBadge from '@/components/StatusBadge'
import { cn } from '@/lib/utils'

function Thumb({ post, className }) {
  const mediaUrl = post.media_urls?.[0]
  if (!mediaUrl) {
    return (
      <div className={cn('rounded-md border border-border/50 bg-muted flex items-center justify-center shrink-0', className)}>
        <ImageIcon className="size-3.5 text-muted-foreground/50" />
      </div>
    )
  }
  return (
    <div className={cn('rounded-md border border-border/50 bg-muted overflow-hidden shrink-0 relative', className)}>
      {mediaUrl.match(/\.(mp4|mov|webm)$/i) ? (
        <div className="absolute inset-0 flex items-center justify-center bg-black/90">
          <Play className="size-3 text-white fill-current" />
        </div>
      ) : (
        <img src={mediaUrl} alt="" className="size-full object-cover" />
      )}
    </div>
  )
}

/**
 * Multi-select deliverable picker as an inline expandable section (not a
 * Popover) — used inside CreateTaskDialog/EditTaskDialog. A Popover here had
 * scroll issues once its list content overflowed a portaled, unconstrained
 * PopoverContent; an inline section scrolls within the dialog's own layout
 * instead, no portal/positioning involved.
 *
 * selectedPosts: array of the currently-linked post objects.
 * onToggle(post): add/remove a single post. onClear(): remove all.
 */
export function DeliverablePickerSection({ posts, selectedPosts = [], onToggle, onClear, disabled, showClient = false }) {
  const [expanded, setExpanded] = useState(false)
  const [search, setSearch] = useState('')

  const selectedIds = new Set(selectedPosts.map((p) => p.id))
  const filtered = posts.filter((p) =>
    (p.title || '').toLowerCase().includes(search.toLowerCase()),
  )
  const count = selectedPosts.length

  return (
    <div className="w-full">
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        aria-expanded={expanded}
        onClick={() => !disabled && setExpanded((e) => !e)}
        onKeyDown={(e) => {
          if (disabled) return
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setExpanded((x) => !x)
          }
        }}
        className={cn(
          'w-full rounded-lg border p-3 flex items-center gap-3 transition-colors cursor-pointer',
          disabled && 'opacity-50 pointer-events-none',
          count
            ? 'border-border bg-card hover:bg-muted/40'
            : 'border-dashed border-border/70 hover:border-border hover:bg-muted/30',
        )}
      >
        {count ? (
          <>
            <div className="flex -space-x-2 shrink-0">
              {selectedPosts.slice(0, 3).map((p) => (
                <Thumb key={p.id} post={p} className="size-8 ring-2 ring-card" />
              ))}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">
                {count} deliverable{count > 1 ? 's' : ''} linked
              </p>
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {selectedPosts.map((p) => p.title || 'Untitled').join(', ')}
              </p>
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onClear() }}
              className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted shrink-0"
              aria-label="Clear all deliverables"
            >
              <X className="size-3.5" />
            </button>
          </>
        ) : (
          <div className="flex items-center justify-center gap-2 py-1 flex-1 text-muted-foreground">
            <FileText className="size-4" />
            <span className="text-sm">Click to link deliverables</span>
          </div>
        )}
        {expanded ? (
          <ChevronUp className="size-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="size-4 text-muted-foreground shrink-0" />
        )}
      </div>

      {expanded && (
        <div className="mt-2 rounded-md border bg-background">
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                autoFocus
                placeholder="Search deliverables…"
                className="pl-8 h-8 text-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <ScrollArea className="h-56">
            {filtered.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">
                {posts.length === 0 ? 'No deliverables for this client.' : 'No matches.'}
              </p>
            ) : (
              <div className="divide-y divide-dashed divide-border">
              {filtered.map((post) => {
                const isSelected = selectedIds.has(post.id)
                return (
                  <button
                    key={post.id}
                    type="button"
                    onClick={() => onToggle(post)}
                    aria-pressed={isSelected}
                    className={cn(
                      'w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors',
                      isSelected ? 'bg-primary/10' : 'hover:bg-muted/60',
                    )}
                  >
                    <span
                      className={cn(
                        'size-4 rounded border flex items-center justify-center shrink-0 transition-colors',
                        isSelected ? 'bg-primary border-primary text-primary-foreground' : 'border-border',
                      )}
                    >
                      {isSelected && <Check className="size-3" />}
                    </span>

                    <Thumb post={post} className="size-9" />

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{post.title || 'Untitled'}</p>
                      {showClient && post.client_name && (
                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5">
                          {post.client_logo ? (
                            <img src={post.client_logo} alt="" className="size-3 rounded-full object-cover shrink-0" />
                          ) : (
                            <Building2 className="size-3 shrink-0" />
                          )}
                          <span className="truncate">{post.is_internal ? 'Internal' : post.client_name}</span>
                        </span>
                      )}
                      {post.target_date && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {format(parseISO(post.target_date), 'MMM d, yyyy')}
                        </p>
                      )}
                    </div>

                    <div className="shrink-0 flex flex-col items-end gap-1">
                      <StatusBadge status={post.status} className="scale-90 origin-right" />
                      {post.platforms?.length > 0 && (
                        <PlatformStack platforms={post.platforms} size={14} max={3} />
                      )}
                    </div>
                  </button>
                )
              })}
              </div>
            )}
          </ScrollArea>
        </div>
      )}
    </div>
  )
}
