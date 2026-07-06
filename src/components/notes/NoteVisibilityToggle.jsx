import { Lock, Globe, Users } from 'lucide-react'
import { cn } from '@/lib/utils'

const OPTIONS = [
  { value: 'private', label: 'Private', icon: Lock },
  { value: 'shared', label: 'Shared', icon: Users },
  { value: 'workspace', label: 'Workspace', icon: Globe },
]

// Clicking "Shared" always opens ShareNoteDialog (onShareClick) — whether to
// invite the first collaborator (visibility only flips once someone is
// actually added, inside shareNote()) or to manage an existing share list.
// Private/Workspace still flip directly via onChange.
export default function NoteVisibilityToggle({ visibility, onChange, onShareClick, disabled }) {
  const current = OPTIONS.find((o) => o.value === visibility) ?? OPTIONS[0]

  if (disabled) {
    const Icon = current.icon
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5" />
        {current.label}
      </span>
    )
  }

  return (
    <div className="inline-flex items-center gap-0.5 rounded-md border border-border/60 bg-muted/40 p-0.5">
      {OPTIONS.map((opt) => {
        const Icon = opt.icon
        const active = opt.value === visibility
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => {
              if (opt.value === 'shared') onShareClick()
              else if (!active) onChange(opt.value)
            }}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
              active
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="size-3.5" />
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
