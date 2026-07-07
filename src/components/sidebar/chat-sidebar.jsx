import { useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/context/AuthContext'
import { useSubscription } from '@/api/useSubscription'
import { useMyChannels, useMemberMap, markChannelRead, getOrCreateDmChannel } from '@/api/chat'
import { MemberAvatar, TeamChatAvatar } from '@/components/chat/MemberAvatar'
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar'
import { Skeleton } from '@/components/ui/skeleton'

// Mention takes priority over the plain unread count — a higher-attention
// signal than "something's unread". No pill background on the "@", matching
// the same treatment used for inline mentions and the main-sidebar nav badge.
function UnreadBadge({ count, mentioned }) {
  if (mentioned) {
    return <span className="ml-auto text-sm font-bold text-rose-500 dark:text-rose-400">@</span>
  }
  if (!count) return null
  return (
    <span className="ml-auto flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
      {count > 99 ? '99+' : count}
    </span>
  )
}

// Rendered alongside AppSidebar (not in place of it) while on /chat — AppShell
// collapses the main sidebar to its icon-rail and mounts this beside it. Shows
// the workspace-wide channel pinned at top, then one row per teammate (plus
// the owner) for DMs, created on demand via get_or_create_dm_channel.
export function ChatSidebar() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data: sub } = useSubscription()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeChannelId = searchParams.get('channel')

  const teamChatName = sub?.agency_name ? `${sub.agency_name} (Room)` : 'Team Chat'
  const memberMap = useMemberMap()
  const { data: channels = [], isLoading } = useMyChannels()

  const workspaceChannel = channels.find((c) => c.type === 'workspace')

  const dmByOtherUser = useMemo(() => {
    const map = {}
    channels
      .filter((c) => c.type === 'dm')
      .forEach((c) => {
        map[c.other_user_id] = c
      })
    return map
  }, [channels])

  // useMemberMap() already merges teammates + the workspace owner + de-dupes
  // (some workspaces have a self-referential agency_members row for the
  // owner, some don't) — just drop the caller themselves for the DM list.
  const teammates = useMemo(
    () => Object.values(memberMap).filter((m) => m.id !== user?.id),
    [memberMap, user?.id],
  )

  function selectChannel(channelId) {
    setSearchParams({ channel: channelId })
    markChannelRead(channelId).catch(() => {})
  }

  async function openDm(otherUserId) {
    const existing = dmByOtherUser[otherUserId]
    if (existing) {
      selectChannel(existing.channel_id)
      return
    }
    const channelId = await getOrCreateDmChannel(otherUserId)
    selectChannel(channelId)
  }

  return (
    // collapsible="none" — a plain fixed-width panel, deliberately NOT tied to
    // the shared sidebar open/collapsed state (that state now drives the main
    // AppSidebar's icon-rail mode instead). Two Sidebar components sharing one
    // SidebarProvider would otherwise collapse/expand together.
    <Sidebar className="border-r flex flex-col overflow-x-hidden" collapsible="none">
      <SidebarHeader className="px-2 pt-4 pb-5">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={() => navigate('/dashboard')} className="gap-2" tooltip="Back to Tercero">
              <ArrowLeft className="size-4 shrink-0" />
              <span className="font-semibold">Back</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="flex flex-col flex-1 min-h-0 overflow-x-hidden">
        {/* No "Team" label — the row itself (agency avatar + name) is already
            self-descriptive, and dropping it raises this row so it sits
            closer to the chat header bar's vertical position. Most of that
            spacing now lives as breathing room under the back button
            (SidebarHeader's padding) instead of a standalone gap here, so
            the rhythm matches the Direct Messages section below. */}
        <SidebarGroup className="pt-2 pb-0">
          <SidebarGroupContent>
            <SidebarMenu>
              {isLoading && (
                <SidebarMenuItem>
                  <Skeleton className="h-8 w-full rounded-md" />
                </SidebarMenuItem>
              )}
              {!isLoading && workspaceChannel && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={activeChannelId === workspaceChannel.channel_id}
                    onClick={() => selectChannel(workspaceChannel.channel_id)}
                    className="gap-2"
                  >
                    <TeamChatAvatar logoUrl={sub?.logo_url} name={sub?.agency_name} className="size-6" />
                    <span className="truncate">{teamChatName}</span>
                    <UnreadBadge count={workspaceChannel.unread_count} mentioned={workspaceChannel.has_unread_mention} />
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="flex-1 min-h-0 overflow-y-auto">
          <SidebarGroupLabel>Direct Messages</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {isLoading &&
                Array.from({ length: 3 }).map((_, i) => (
                  <SidebarMenuItem key={i}>
                    <Skeleton className="h-8 w-full rounded-md" />
                  </SidebarMenuItem>
                ))}
              {!isLoading && teammates.length === 0 && (
                <p className="px-2 py-1.5 text-xs text-muted-foreground">No teammates yet</p>
              )}
              {!isLoading &&
                teammates.map((member) => {
                  const dm = dmByOtherUser[member.id]
                  const isActive = !!dm && activeChannelId === dm.channel_id
                  return (
                    <SidebarMenuItem key={member.id}>
                      <SidebarMenuButton
                        isActive={isActive}
                        onClick={() => openDm(member.id)}
                        className={cn('gap-2')}
                      >
                        <MemberAvatar member={member} className="size-6" />
                        <span className="truncate">{member.full_name || member.email}</span>
                        <UnreadBadge count={dm?.unread_count} mentioned={dm?.has_unread_mention} />
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
