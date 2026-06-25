import { useState } from 'react'
import { Plus, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import TagPill from './TagPill'

// Notion-style inline tag picker. Controlled by the parent:
//  - selectedTagIds: array of tag ids currently applied to the note
//  - allTags:        every tag in the workspace (from useNoteTags)
//  - onToggle(tagId): attach/detach an existing tag
//  - onCreate(name):  create a new tag (async → returns the created tag), then it
//                     is toggled on by the parent
export default function TagPicker({
  selectedTagIds = [],
  allTags = [],
  onToggle,
  onCreate,
  onManage,
  isBusy = false,
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const q = query.trim().toLowerCase()
  const filtered = q
    ? allTags.filter((t) => t.name.toLowerCase().includes(q))
    : allTags
  const exactMatch = allTags.some((t) => t.name.toLowerCase() === q)
  const showCreate = q.length > 0 && !exactMatch

  async function handleCreate() {
    const created = await onCreate(query.trim())
    if (created) onToggle(created.id)
    setQuery('')
  }

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) setQuery('')
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
        >
          <Plus className="size-3.5" />
          Add tag
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-0">
        <div className="border-b p-2">
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && showCreate) {
                e.preventDefault()
                handleCreate()
              }
            }}
            placeholder="Search or create a tag…"
            className="h-8 text-sm"
          />
        </div>
        <div className="max-h-60 overflow-y-auto p-1">
          {filtered.map((tag) => {
            const selected = selectedTagIds.includes(tag.id)
            return (
              <button
                key={tag.id}
                type="button"
                onClick={() => onToggle(tag.id)}
                className="flex w-full items-center justify-between gap-2 rounded-sm px-1.5 py-1.5 text-sm hover:bg-accent"
              >
                <TagPill tag={tag} size="sm" />
                {selected && <Check className="size-4 text-muted-foreground shrink-0" />}
              </button>
            )
          })}

          {showCreate && (
            <button
              type="button"
              disabled={isBusy}
              onClick={handleCreate}
              className={cn(
                'flex w-full items-center gap-2 rounded-sm px-1.5 py-1.5 text-sm hover:bg-accent disabled:opacity-50',
                filtered.length > 0 && 'mt-1 border-t pt-2',
              )}
            >
              <Plus className="size-3.5 text-muted-foreground" />
              <span className="truncate">
                Create <span className="font-medium">“{query.trim()}”</span>
              </span>
            </button>
          )}

          {filtered.length === 0 && !showCreate && (
            <p className="px-2 py-4 text-center text-xs text-muted-foreground">
              No tags yet — type to create one.
            </p>
          )}
        </div>

        {onManage && (
          <div className="border-t p-1">
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                onManage()
              }}
              className="flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              Manage tags
              <span className="text-muted-foreground/50">→</span>
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
