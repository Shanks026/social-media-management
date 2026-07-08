import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useHeader } from '@/components/misc/header-context'
import { useSubscription } from '@/api/useSubscription'
import { useMyChannels, useMemberMap } from '@/api/chat'
import { MemberAvatar, TeamChatAvatar } from '@/components/chat/MemberAvatar'
import { ChatThread } from '@/components/chat/ChatThread'

// Reflects the URL's selected channel (?channel=<id>), which ChatSidebar also
// reads/writes — the two stay in sync through the router, no prop drilling.
// The conversation identity (avatar + name) lives in its own bar here, not
// the main AppHeader — chat is the one page that needs this to grow richer
// later (member count, presence, room actions) without crowding the shared
// header every other page in the app also uses.
export default function ChatPage() {
  const { setHeader } = useHeader()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeChannelId = searchParams.get('channel')
  const { data: sub } = useSubscription()
  const { data: channels = [] } = useMyChannels()
  const memberMap = useMemberMap()

  useEffect(() => {
    setHeader({ title: 'Chat', breadcrumbs: [{ label: 'Chat' }] })
  }, [setHeader])

  const workspaceChannel = channels.find((c) => c.type === 'workspace')

  // Default straight into the team room instead of an empty "pick something"
  // page — mirrors how Slack/Teams always land you somewhere on open.
  useEffect(() => {
    if (activeChannelId || !workspaceChannel) return
    setSearchParams({ channel: workspaceChannel.channel_id }, { replace: true })
  }, [activeChannelId, workspaceChannel, setSearchParams])

  const activeChannel = channels.find((c) => c.channel_id === activeChannelId)
  const isWorkspaceChannel = activeChannel?.type === 'workspace'
  const dmMember = activeChannel?.type === 'dm' ? memberMap[activeChannel.other_user_id] : null
  const teamChatName = sub?.agency_name ? `${sub.agency_name} (Room)` : 'Team Chat'

  // Nothing to show yet — either channels are still loading, or (edge case)
  // the caller isn't in any channel. The effect above will redirect into the
  // team room the moment it's available; this is just the brief gap before that.
  if (!activeChannel) {
    return <div className="h-[calc(100vh-4rem)]" />
  }

  return (
    <div className="flex flex-col min-h-0 h-[calc(100vh-4rem)]">
      <div className="flex items-center gap-2.5 border-b px-4 py-3 shrink-0">
        {isWorkspaceChannel ? (
          <TeamChatAvatar logoUrl={sub?.logo_url} name={sub?.agency_name} />
        ) : (
          <MemberAvatar member={dmMember} />
        )}
        <span className="font-medium truncate">
          {isWorkspaceChannel ? teamChatName : dmMember?.full_name || dmMember?.email || 'Direct Message'}
        </span>
      </div>
      <ChatThread
        key={activeChannelId}
        channelId={activeChannelId}
        channelType={activeChannel.type}
        otherUserId={activeChannel.other_user_id}
      />
    </div>
  )
}
