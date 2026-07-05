import { useMemo } from 'react'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { useTeamMembers } from '@/api/team'
import { useNoteShares } from '@/api/noteShares'
import { cn } from '@/lib/utils'

// shadcn has no dedicated "avatar group" component — their own avatar-group
// example is just <Avatar> children in a `-space-x` flex container with a
// ring, which is what this reuses. Shows the note's author plus any invited
// Shared collaborators; hovering the stack opens a card listing everyone
// with their access level, rather than a tooltip per avatar. A private note
// is definitionally single-user, so nothing renders for that visibility.
export default function NoteCollaboratorAvatars({
  noteId,
  authorId,
  authorName,
  visibility,
  size = 'size-7',
  max = 3,
  className,
}) {
  const { data: shares = [] } = useNoteShares(noteId)
  const { data: teamMembers = [] } = useTeamMembers()

  const memberMap = useMemo(
    () => Object.fromEntries(teamMembers.map((m) => [m.member_user_id, m])),
    [teamMembers],
  )

  const people = useMemo(() => {
    const author = memberMap[authorId]
    const list = [
      {
        id: authorId,
        name: author?.full_name || authorName || author?.email || 'Unknown',
        avatar_url: author?.avatar_url || null,
        roleLabel: 'Author',
      },
    ]
    for (const s of shares) {
      const m = memberMap[s.member_user_id]
      list.push({
        id: s.member_user_id,
        name: m?.full_name || m?.email || 'Unknown',
        avatar_url: m?.avatar_url || null,
        roleLabel: s.permission === 'write' ? 'Write access' : 'Read access',
      })
    }
    return list
  }, [memberMap, authorId, authorName, shares])

  if (visibility === 'private') return null

  const visible = people.slice(0, max)
  const overflow = people.length - visible.length

  return (
    <HoverCard openDelay={100} closeDelay={100}>
      <HoverCardTrigger asChild>
        <div
          onClick={(e) => e.stopPropagation()}
          className={cn('flex -space-x-2 shrink-0', className)}
        >
          {visible.map((p) => (
            <Avatar key={p.id} className={cn(size, 'ring-2 ring-background')}>
              {p.avatar_url && <AvatarImage src={p.avatar_url} alt={p.name} />}
              <AvatarFallback className="text-[10px] font-semibold">
                {(p.name || '?')[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>
          ))}
          {overflow > 0 && (
            <Avatar className={cn(size, 'ring-2 ring-background')}>
              <AvatarFallback className="text-[10px] font-medium text-muted-foreground">
                +{overflow}
              </AvatarFallback>
            </Avatar>
          )}
        </div>
      </HoverCardTrigger>
      <HoverCardContent
        align="start"
        className="w-56 p-1.5"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="px-1.5 pb-1.5 pt-0.5 text-xs font-medium text-muted-foreground">
          {people.length} {people.length === 1 ? 'person' : 'people'} involved
        </p>
        <div className="space-y-0.5">
          {people.map((p) => (
            <div key={p.id} className="flex items-center gap-2.5 rounded-md px-1.5 py-1.5">
              <Avatar className="size-7">
                {p.avatar_url && <AvatarImage src={p.avatar_url} alt={p.name} />}
                <AvatarFallback className="text-[10px] font-semibold">
                  {(p.name || '?')[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{p.name}</p>
                <p className="text-xs text-muted-foreground">{p.roleLabel}</p>
              </div>
            </div>
          ))}
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}
