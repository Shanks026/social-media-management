import { useState } from 'react'
import { Plus, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import JobRolePill from './JobRolePill'

/**
 * Multi-select job title picker, controlled by the parent. Mirrors TagPicker.
 *
 * A member holds any number of titles, so this replaces the old single-select
 * plus free-text "Custom…" field — which is also what produced "Video Editor",
 * "video editor" and "Editor (Video)" as three separate values.
 *
 *  - selectedRoleIds: ids currently on the member
 *  - allRoles:        every job role in the workspace (from useJobRoles)
 *  - onToggle(id):    add/remove one
 *  - onCreate(name):  create then select (async → returns the created row)
 *  - onManage:        open ManageJobRolesDialog
 *  - canCreate:       owner-only. Admins see a read-only list — no create row,
 *                     no manage footer — since every write is owner-gated in
 *                     RLS anyway and offering the affordance would just fail.
 */
export default function JobRolePicker({
  selectedRoleIds = [],
  allRoles = [],
  onToggle,
  onCreate,
  onManage,
  canCreate = false,
  isBusy = false,
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const q = query.trim().toLowerCase()
  const filtered = q ? allRoles.filter((r) => r.name.toLowerCase().includes(q)) : allRoles
  const exactMatch = allRoles.some((r) => r.name.toLowerCase() === q)
  const showCreate = canCreate && q.length > 0 && !exactMatch

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
          className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
        >
          <Plus className="size-3.5" />
          Add job role
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
            placeholder={canCreate ? 'Search or create a job role…' : 'Search job roles…'}
            className="h-8 text-sm"
          />
        </div>

        <div className="max-h-60 overflow-y-auto p-1">
          {filtered.map((role) => {
            const selected = selectedRoleIds.includes(role.id)
            return (
              <button
                key={role.id}
                type="button"
                onClick={() => onToggle(role.id)}
                className="flex w-full items-center justify-between gap-2 rounded-sm px-1.5 py-1.5 text-sm hover:bg-accent"
              >
                <JobRolePill role={role} size="sm" />
                {selected && <Check className="size-4 shrink-0 text-muted-foreground" />}
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
              {allRoles.length === 0
                ? canCreate
                  ? 'No job roles yet — type to create one.'
                  : 'No job roles defined yet.'
                : 'No match.'}
            </p>
          )}
        </div>

        {onManage && canCreate && (
          <div className="border-t p-1">
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                onManage()
              }}
              className="flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              Manage job roles
              <span className="text-muted-foreground/50">→</span>
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
