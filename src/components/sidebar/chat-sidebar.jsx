import { useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { format, isToday, isYesterday, differenceInCalendarDays } from 'date-fns'
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
    return <span className="ml-auto text-sm font-bold text-rose-500 dark:text-rose-400 shrink-0">@</span>
  }
  if (!count) return null
  return (
    <span className="ml-auto flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shrink-0">
      {count > 99 ? '99+' : count}
    </span>
  )
}

// WhatsApp-style compact stamp: time for today, "Yesterday", weekday name
// within the last week, otherwise a short date.
function formatChatTimestamp(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  if (isToday(date)) return format(date, 'h:mm a')
  if (isYesterday(date)) return 'Yesterday'
  if (differenceInCalendarDays(new Date(), date) < 7) return format(date, 'EEE')
  return format(date, 'd MMM')
}

// Two-line row shared by the workspace channel and DMs that have at least one
// message — avatar left, name+timestamp on top, last-message preview+unread
// badge below. Bold/dark when unread, muted when read (WhatsApp convention).
function ChannelRow({ avatar, name, isActive, onClick, lastMessageAt, lastMessageBody, unreadCount, hasUnreadMention }) {
  const unread = !!unreadCount || hasUnreadMention
  return (
    <SidebarMenuButton
      isActive={isActive}
      onClick={onClick}
      size="lg"
      className="h-auto min-h-12 items-center gap-2.5 py-1.5"
    >
      {avatar}
      <div className="flex flex-col min-w-0 flex-1 gap-0.5">
        <div className="flex items-baseline gap-2">
          <span className={cn('truncate flex-1 min-w-0', unread ? 'font-semibold text-foreground' : 'font-medium')}>
            {name}
          </span>
          {lastMessageAt && (
            <span className={cn('text-[10px] shrink-0', unread ? 'text-foreground font-medium' : 'text-muted-foreground')}>
              {formatChatTimestamp(lastMessageAt)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={cn('truncate flex-1 min-w-0 text-xs', unread ? 'text-foreground/80 font-medium' : 'text-muted-foreground')}>
            {lastMessageBody || 'No messages yet'}
          </span>
          <UnreadBadge count={unreadCount} mentioned={hasUnreadMention} />
        </div>
      </div>
    </SidebarMenuButton>
  )
}

// Rendered alongside AppSidebar (not in place of it) while on /chat — AppShell
// collapses the main sidebar to its icon-rail and mounts this beside it. Shows
// the workspace-wide channel pinned at top, then Direct Messages sorted by
// most recent activity (like a WhatsApp chat list) — teammates you haven't
// messaged yet are listed alphabetically underneath so they stay discoverable.
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

  // get_my_chat_channels() already orders by last_message_at (most recent
  // first) — preserve that order rather than re-deriving it client-side.
  const dmChannels = useMemo(() => channels.filter((c) => c.type === 'dm'), [channels])

  // useMemberMap() already merges teammates + the workspace owner + de-dupes
  // (some workspaces have a self-referential agency_members row for the
  // owner, some don't) — just drop the caller themselves for the DM list.
  const teammates = useMemo(
    () => Object.values(memberMap).filter((m) => m.id !== user?.id),
    [memberMap, user?.id],
  )

  const messagedMemberIds = useMemo(
    () => new Set(dmChannels.map((c) => c.other_user_id)),
    [dmChannels],
  )

  const noChatTeammates = useMemo(
    () =>
      teammates
        .filter((m) => !messagedMemberIds.has(m.id))
        .sort((a, b) => (a.full_name || a.email || '').localeCompare(b.full_name || b.email || '')),
    [teammates, messagedMemberIds],
  )

  function selectChannel(channelId) {
    setSearchParams({ channel: channelId })
    markChannelRead(channelId).catch(() => {})
  }

  async function openDm(otherUserId) {
    const existing = dmChannels.find((c) => c.other_user_id === otherUserId)
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
                  <Skeleton className="h-12 w-full rounded-md" />
                </SidebarMenuItem>
              )}
              {!isLoading && workspaceChannel && (
                <SidebarMenuItem>
                  <ChannelRow
                    avatar={<TeamChatAvatar logoUrl={sub?.logo_url} name={sub?.agency_name} className="size-8 shrink-0" />}
                    name={teamChatName}
                    isActive={activeChannelId === workspaceChannel.channel_id}
                    onClick={() => selectChannel(workspaceChannel.channel_id)}
                    lastMessageAt={workspaceChannel.last_message_at}
                    lastMessageBody={workspaceChannel.last_message_body}
                    unreadCount={workspaceChannel.unread_count}
                    hasUnreadMention={workspaceChannel.has_unread_mention}
                  />
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
                    <Skeleton className="h-12 w-full rounded-md" />
                  </SidebarMenuItem>
                ))}
              {!isLoading && teammates.length === 0 && (
                <p className="px-2 py-1.5 text-xs text-muted-foreground">No teammates yet</p>
              )}

              {/* Active conversations, most recent first */}
              {!isLoading &&
                dmChannels.map((dm) => {
                  const member = memberMap[dm.other_user_id]
                  if (!member) return null
                  return (
                    <SidebarMenuItem key={dm.channel_id}>
                      <ChannelRow
                        avatar={<MemberAvatar member={member} className="size-8 shrink-0" />}
                        name={member.full_name || member.email}
                        isActive={activeChannelId === dm.channel_id}
                        onClick={() => selectChannel(dm.channel_id)}
                        lastMessageAt={dm.last_message_at}
                        lastMessageBody={dm.last_message_body}
                        unreadCount={dm.unread_count}
                        hasUnreadMention={dm.has_unread_mention}
                      />
                    </SidebarMenuItem>
                  )
                })}

              {/* Teammates you haven't messaged yet — alphabetical, no preview/badge */}
              {!isLoading && noChatTeammates.length > 0 && (
                <>
                  {dmChannels.length > 0 && <div className="my-1.5 border-t border-sidebar-border" />}
                  {noChatTeammates.map((member) => (
                    <SidebarMenuItem key={member.id}>
                      <SidebarMenuButton onClick={() => openDm(member.id)} className="gap-2">
                        <MemberAvatar member={member} className="size-6" />
                        <span className="truncate">{member.full_name || member.email}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
