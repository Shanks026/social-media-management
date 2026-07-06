import { MessagesSquare } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'

// Shared across ChatSidebar, ChatThread, and ChatPage's header — one place
// for "member profile → avatar" so the three don't drift into slightly
// different custom avatar divs.
export function MemberAvatar({ member, className }) {
  return (
    <Avatar className={cn('size-7', className)}>
      <AvatarImage src={member?.avatar_url} alt="" />
      <AvatarFallback className="bg-primary/10 text-[11px] font-semibold text-primary">
        {(member?.full_name || member?.email || '?')[0].toUpperCase()}
      </AvatarFallback>
    </Avatar>
  )
}

// Same visual footprint as MemberAvatar, for the workspace-wide channel
// (which has no single "member" to show). Shows the agency logo when one's
// configured, falling back to a plain icon — same logo/initials-vs-icon
// tradeoff MemberAvatar makes for people.
export function TeamChatAvatar({ logoUrl, name, className }) {
  if (logoUrl) {
    return (
      <Avatar className={cn('size-7', className)}>
        <AvatarImage src={logoUrl} alt="" />
        <AvatarFallback className="bg-primary/10 text-[11px] font-semibold text-primary">
          {(name || 'T')[0].toUpperCase()}
        </AvatarFallback>
      </Avatar>
    )
  }
  return (
    <div
      className={cn(
        'flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary',
        className,
      )}
    >
      <MessagesSquare className="size-3.5" />
    </div>
  )
}
