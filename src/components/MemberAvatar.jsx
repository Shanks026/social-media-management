import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { initials } from '@/lib/format'

/**
 * The one avatar for a person (#150): the profile picture, falling back to
 * initials when there is none or the image fails to load.
 *
 * `member` is any of { full_name | name, email, avatar_url | avatarUrl }.
 * `size` is a Tailwind size class; `shape="square"` gives the rounded-square
 * used on the Team page. Pass `className` for anything else.
 */
export function MemberAvatar({ member, size = 'size-7', shape = 'circle', className }) {
  const name = member?.full_name || member?.name
  const email = member?.email
  const src = member?.avatar_url || member?.avatarUrl
  const radius = shape === 'square' ? 'rounded-lg' : 'rounded-full'

  return (
    <Avatar className={cn(size, radius, 'shrink-0', className)}>
      <AvatarImage src={src || undefined} alt={name || email || ''} className={radius} />
      <AvatarFallback
        className={cn(
          radius,
          'bg-primary/10 text-[11px] font-semibold text-primary',
        )}
      >
        {initials(name, { email, max: 2 })}
      </AvatarFallback>
    </Avatar>
  )
}

export default MemberAvatar
