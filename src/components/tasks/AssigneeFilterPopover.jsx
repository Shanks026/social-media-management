import { Users, Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

export default function AssigneeFilterPopover({ members = [], selected = [], onChange }) {
  const toggle = (id) => {
    if (selected.includes(id)) onChange(selected.filter((x) => x !== id))
    else onChange([...selected, id])
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'h-9 gap-2 shadow-none border-border/60 font-normal text-sm',
            selected.length > 0 && 'border-foreground/40 bg-muted/50',
          )}
        >
          <Users className="size-3.5 shrink-0" />
          {selected.length === 0
            ? 'Assignee'
            : selected.length === 1
              ? members.find((m) => m.id === selected[0])?.name || '1 selected'
              : `${selected.length} selected`}
          {selected.length > 0 && (
            <span
              role="button"
              className="ml-0.5 -mr-1 text-muted-foreground hover:text-foreground"
              onClick={(e) => { e.stopPropagation(); onChange([]) }}
            >
              <X className="size-3" />
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-1">
        {members.length === 0 ? (
          <p className="text-xs text-muted-foreground px-2 py-3 text-center">No team members</p>
        ) : (
          <div className="space-y-px">
            {members.map((m) => {
              const isSelected = selected.includes(m.id)
              return (
                <button
                  key={m.id}
                  onClick={() => toggle(m.id)}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm transition-colors text-left',
                    isSelected ? 'bg-muted' : 'hover:bg-muted/60',
                  )}
                >
                  {m.avatar_url ? (
                    <img src={m.avatar_url} alt="" className="size-6 rounded-full object-cover shrink-0 ring-1 ring-border" />
                  ) : (
                    <div className="size-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-semibold text-primary shrink-0 ring-1 ring-border">
                      {(m.name || '?')[0].toUpperCase()}
                    </div>
                  )}
                  <span className="flex-1 truncate">{m.name}</span>
                  {isSelected && <Check className="size-3.5 shrink-0 text-primary" />}
                </button>
              )
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
