import { MessagesSquare } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { initials } from '@/lib/format'

// Same visual footprint as the shared MemberAvatar, for the workspace-wide channel
// (which has no single "member" to show). Shows the agency logo when one's
// configured, falling back to a plain icon — same logo/initials-vs-icon
// tradeoff MemberAvatar makes for people.
export function TeamChatAvatar({ logoUrl, name, className }) {
  if (logoUrl) {
    return (
      <Avatar className={cn('size-7', className)}>
        <AvatarImage src={logoUrl} alt="" />
        <AvatarFallback className="bg-primary/10 text-[11px] font-semibold text-primary">
          {initials(name || 'T', { max: 1 })}
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
