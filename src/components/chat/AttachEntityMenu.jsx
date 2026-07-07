import { useEffect, useMemo, useRef, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { ListChecks, Image as ImageIcon, Play, Building2, PencilRuler } from 'lucide-react'
import { useGlobalPosts } from '@/api/useGlobalPosts'
import { useTasks } from '@/api/tasks'
import { useClients } from '@/api/clients'
import { PlatformStack } from '@/components/PlatformIcon'
import StatusBadge from '@/components/StatusBadge'
import { STATUS_CONFIG, STATUS_DOT } from '@/components/tasks/TaskCard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command'

// Mirrors DeliverablePickerSection's Thumb — thumbnail with video/image
// detection, same fallback treatment for items with no media.
function Thumb({ post, className }) {
  const mediaUrl = post.media_urls?.[0]
  if (!mediaUrl) {
    return (
      <div className={cn('shrink-0 flex items-center justify-center rounded-md border border-border/50 bg-muted', className)}>
        <ImageIcon className="size-3.5 text-muted-foreground/50" />
      </div>
    )
  }
  return (
    <div className={cn('relative shrink-0 overflow-hidden rounded-md border border-border/50 bg-muted', className)}>
      {mediaUrl.match(/\.(mp4|mov|webm)$/i) ? (
        <div className="absolute inset-0 flex items-center justify-center bg-black/90">
          <Play className="size-3 fill-current text-white" />
        </div>
      ) : (
        <img src={mediaUrl} alt="" className="size-full object-cover" />
      )}
    </div>
  )
}

function referenceFor(category, item) {
  return category === 'post'
    ? { type: 'post', id: item.version_id, title: item.title || 'Untitled Draft', client_id: item.client_id ?? null }
    : { type: 'task', id: item.id, title: item.title || 'Untitled', client_id: null }
}

const CATEGORIES = [
  { key: 'post', label: 'Attach deliverable', icon: PencilRuler },
  { key: 'task', label: 'Attach task', icon: ListChecks },
]

// Mirrors the notes editor's SlashCommandList (src/components/notes/editor/
// SlashCommandList.jsx) — a self-contained keyboard-navigable menu: wraparound
// ArrowUp/Down, Enter to confirm, hover syncs the highlight, focused on mount
// so keydowns actually reach it instead of the composer textarea underneath.
function CategoryPicker({ onChoose }) {
  const [highlighted, setHighlighted] = useState(0)
  const containerRef = useRef(null)

  useEffect(() => {
    containerRef.current?.focus()
  }, [])

  function handleKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlighted((i) => (i + 1) % CATEGORIES.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlighted((i) => (i - 1 + CATEGORIES.length) % CATEGORIES.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      onChoose(CATEGORIES[highlighted].key)
    }
  }

  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      className="w-56 rounded-md border bg-popover p-1.5 shadow-lg outline-none"
    >
      {CATEGORIES.map((c, i) => (
        <button
          key={c.key}
          onClick={() => onChoose(c.key)}
          onMouseMove={() => setHighlighted(i)}
          className={cn(
            'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-left transition-colors',
            i === highlighted ? 'bg-accent text-accent-foreground' : 'hover:bg-muted/60',
          )}
        >
          <c.icon className="size-4 text-muted-foreground" />
          {c.label}
        </button>
      ))}
    </div>
  )
}

// Two-step picker opened from the composer's "/" trigger or the "+" button's
// combined menu: pick a category, then multi-select from that category's
// items (checkbox rows, mirroring DeliverablePickerSection) and confirm with
// the footer button. onSelect receives an array of reference objects shaped
// for chat_messages.entity_references — { type, id, title, client_id }.
// initialCategory skips straight to search when the category was already
// chosen (the "+" menu's dedicated options); left null (the "/" trigger) to
// show the category picker first.
export function AttachEntityMenu({ onSelect, initialCategory = null }) {
  const [category, setCategory] = useState(initialCategory) // null | 'post' | 'task'
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const inputRef = useRef(null)

  const { data: posts = [] } = useGlobalPosts()
  const { data: tasks = [] } = useTasks()
  const { data: clientsData } = useClients()

  const clientMap = useMemo(() => {
    const map = {}
    ;[clientsData?.internalAccount, ...(clientsData?.realClients ?? [])]
      .filter(Boolean)
      .forEach((c) => { map[c.id] = c })
    return map
  }, [clientsData])

  // Relying on <CommandInput autoFocus> alone loses a race against Radix
  // Popover returning focus to its trigger (the "+" button) when it closes
  // after opening this menu — cmdk's own ArrowUp/Down/Enter handling only
  // fires for keydowns targeting its own subtree, so if focus lands
  // elsewhere, keyboard navigation silently does nothing. Force focus on a
  // later frame so it wins that race, both on mount and when the category
  // search screen appears after the category-picker step.
  useEffect(() => {
    if (!category) return
    const id = requestAnimationFrame(() => inputRef.current?.focus())
    return () => cancelAnimationFrame(id)
  }, [category])

  if (!category) {
    return <CategoryPicker onChoose={setCategory} />
  }

  const noun = category === 'post' ? 'deliverables' : 'tasks'
  const items = category === 'post' ? posts : tasks

  function toggleItem(item) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(item.id)) next.delete(item.id)
      else next.add(item.id)
      return next
    })
  }

  function handleConfirm() {
    const references = items.filter((item) => selectedIds.has(item.id)).map((item) => referenceFor(category, item))
    if (references.length) onSelect(references)
  }

  return (
    <Command className="w-104 rounded-md border shadow-lg" shouldFilter>
      <CommandInput ref={inputRef} placeholder={`Search ${noun}…`} autoFocus />
      <CommandList className="max-h-72">
        <CommandEmpty>No {noun} found.</CommandEmpty>
        <CommandGroup>
          {category === 'post'
            ? posts.map((post) => {
                const client = post.client_id ? clientMap[post.client_id] : null
                const isSelected = selectedIds.has(post.id)
                return (
                  <CommandItem
                    key={post.id}
                    value={post.title || 'Untitled'}
                    onSelect={() => toggleItem(post)}
                    className="items-center gap-2.5 py-2"
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleItem(post)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <Thumb post={post} className="size-9" />

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{post.title || 'Untitled'}</p>
                      {(client || post.target_date) && (
                        <span className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                          {client && (client.logo_url ? (
                            <img src={client.logo_url} alt="" className="size-3 shrink-0 rounded-full object-cover" />
                          ) : (
                            <Building2 className="size-3 shrink-0" />
                          ))}
                          {client && <span className="truncate">{client.is_internal ? 'Internal' : client.name}</span>}
                          {client && post.target_date && <span>·</span>}
                          {post.target_date && (
                            <span className="shrink-0">{format(parseISO(post.target_date), 'MMM d, yyyy')}</span>
                          )}
                        </span>
                      )}
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <StatusBadge status={post.status} className="scale-90 origin-right" />
                      {post.platforms?.length > 0 && (
                        <PlatformStack platforms={post.platforms} size={14} max={3} />
                      )}
                    </div>
                  </CommandItem>
                )
              })
            : tasks.map((task) => {
                const client = task.client_id ? clientMap[task.client_id] : null
                const statusCfg = STATUS_CONFIG[task.status] ?? STATUS_CONFIG.TODO
                const isSelected = selectedIds.has(task.id)
                return (
                  <CommandItem
                    key={task.id}
                    value={task.title || 'Untitled'}
                    onSelect={() => toggleItem(task)}
                    className="items-center gap-2.5 py-2"
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleItem(task)}
                      onClick={(e) => e.stopPropagation()}
                    />

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{task.title || 'Untitled'}</p>
                      {(client || task.due_at) && (
                        <span className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                          {client && (client.logo_url ? (
                            <img src={client.logo_url} alt="" className="size-3 shrink-0 rounded-full object-cover" />
                          ) : (
                            <Building2 className="size-3 shrink-0" />
                          ))}
                          {client && <span className="truncate">{client.is_internal ? 'Internal' : client.name}</span>}
                          {client && task.due_at && <span>·</span>}
                          {task.due_at && (
                            <span className="shrink-0">{format(parseISO(task.due_at), 'MMM d, yyyy')}</span>
                          )}
                        </span>
                      )}
                    </div>

                    <div className="shrink-0">
                      <Badge variant="outline" className={cn('scale-90 origin-right gap-1.5 select-none', statusCfg.className)}>
                        <span className={cn('size-2 shrink-0 rounded-full', STATUS_DOT[task.status] ?? 'bg-zinc-400')} />
                        {statusCfg.label}
                      </Badge>
                    </div>
                  </CommandItem>
                )
              })}
        </CommandGroup>
      </CommandList>

      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between gap-2 border-t px-3 py-2">
          <span className="text-xs text-muted-foreground">{selectedIds.size} selected</span>
          <Button size="sm" className="h-7 text-xs" onClick={handleConfirm}>
            Attach {selectedIds.size}
          </Button>
        </div>
      )}
    </Command>
  )
}
