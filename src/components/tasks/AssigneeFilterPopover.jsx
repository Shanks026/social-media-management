import { MemberAvatar } from '@/components/MemberAvatar'
import { Users, Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

const MAX_TRIGGER_AVATARS = 3

export default function AssigneeFilterPopover({ members = [], selected = [], onChange }) {
  const toggle = (id) => {
    if (selected.includes(id)) onChange(selected.filter((x) => x !== id))
    else onChange([...selected, id])
  }

  const selectedMembers = selected.map((id) => members.find((m) => m.id === id)).filter(Boolean)
  const visibleAvatars = selectedMembers.slice(0, MAX_TRIGGER_AVATARS)
  const overflow = selectedMembers.length - visibleAvatars.length

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
          {selectedMembers.length === 0 ? (
            <>
              <Users className="size-3.5 shrink-0" />
              Assignee
            </>
          ) : (
            <>
              <div className="flex -space-x-1.5 shrink-0">
                {visibleAvatars.map((m) => (
                  <MemberAvatar key={m.id} member={m} size="size-5" className="ring-2 ring-background" />
                ))}
                {overflow > 0 && (
                  <Avatar className="size-5 ring-2 ring-background">
                    <AvatarFallback className="text-[9px] font-medium text-muted-foreground">
                      +{overflow}
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
              {selectedMembers.length === 1 ? selectedMembers[0].name : `${selectedMembers.length} selected`}
            </>
          )}
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
                  <MemberAvatar member={m} size="size-6" className="ring-1 ring-border" />
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
