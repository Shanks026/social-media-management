import { supabase } from '@/lib/supabase'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/context/AuthContext'
import { useTeamMembers } from '@/api/team'
import { useEffect, useMemo } from 'react'
import { resolveWorkspace } from '@/lib/workspace'

// ─── Query Keys ────────────────────────────────────────────────────────────────

export const chatKeys = {
  channels: (userId) => ['chat', 'channels', userId],
  messages: (channelId) => ['chat', 'messages', channelId],
}

// Fixed 14-emoji set — matches the DB check constraint on
// chat_message_reactions.emoji (kept separately from comments.REACTION_EMOJIS
// since the two are enforced by independent constraints).
export const CHAT_REACTION_EMOJIS = ['👍', '👎', '❤️', '😂', '😮', '😢', '🎉', '🙌', '🔥', '👀', '✅', '🤔', '➕', '➖']

// ─── Read Hooks ────────────────────────────────────────────────────────────────

/**
 * The workspace owner's profile, for the DM list. Isolated from
 * useTeamMembers() (get_team_members only returns agency_members rows, never
 * the owner) — a dedicated fetch instead of extending that shared RPC, so
 * this stays scoped to chat with no risk to its other consumers.
 */
export function useWorkspaceOwner() {
  const { workspaceUserId } = useAuth()

  return useQuery({
    queryKey: ['chat', 'workspace-owner', workspaceUserId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_my_workspace_owner')
      if (error) throw error
      return data?.[0] ?? null
    },
    enabled: !!workspaceUserId,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })
}

/**
 * Every person the caller can see in chat, keyed by user id — teammates
 * (useTeamMembers), the workspace owner (useWorkspaceOwner, de-duplicated
 * against teamMembers since some workspaces already return the owner's own
 * agency_members row), and the caller themselves as a fallback. Single source
 * of truth for author lookups (ChatThread) and the DM roster (ChatSidebar) —
 * kept in one place after a real duplicate-owner bug surfaced from having
 * this merge logic written out twice.
 */
export function useMemberMap() {
  const { user } = useAuth()
  const { data: teamMembers = [] } = useTeamMembers()
  const { data: owner } = useWorkspaceOwner()

  return useMemo(() => {
    const map = {}
    teamMembers.forEach((m) => {
      map[m.member_user_id] = { id: m.member_user_id, full_name: m.full_name, avatar_url: m.avatar_url, email: m.email }
    })
    if (owner && !map[owner.user_id]) {
      map[owner.user_id] = { id: owner.user_id, full_name: owner.full_name, avatar_url: owner.avatar_url, email: owner.email }
    }
    if (user && !map[user.id]) {
      map[user.id] = {
        id: user.id,
        full_name: user.user_metadata?.full_name || user.user_metadata?.name || null,
        email: user.email,
        avatar_url: user.user_metadata?.avatar_url || null,
      }
    }
    return map
  }, [teamMembers, owner, user])
}

/**
 * The caller's channel list — the single workspace channel plus any DMs —
 * with unread counts and DM-partner resolution via get_my_chat_channels().
 * Bootstraps the workspace channel (and the caller's membership in it) on
 * first call via ensure_workspace_channel(), so this works for members who
 * existed before the chat feature shipped.
 */
export function useMyChannels() {
  const { user, workspaceUserId } = useAuth()
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!user?.id) return

    const invalidate = () =>
      queryClient.invalidateQueries({ queryKey: chatKeys.channels(user.id) })

    const channel = supabase
      .channel(`chat-channels:${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_channel_members', filter: `user_id=eq.${user.id}` },
        invalidate,
      )
      .on(
        // Unfiltered — a new message in any of my channels affects unread
        // counts/last-message preview; cheap to just invalidate and refetch.
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        invalidate,
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [user?.id, queryClient])

  return useQuery({
    queryKey: chatKeys.channels(user?.id),
    queryFn: async () => {
      await supabase.rpc('ensure_workspace_channel')

      const { data, error } = await supabase.rpc('get_my_chat_channels')
      if (error) throw error
      return data ?? []
    },
    enabled: !!user?.id && !!workspaceUserId,
    staleTime: 30000,
    retry: 1,
  })
}

/**
 * Message thread for a single channel, oldest-first, with reactions joined in.
 * Realtime is an invalidator (same pattern as useComments): subscribe to
 * chat_messages filtered by channel_id, and to chat_message_reactions
 * unfiltered (no channel_id column to filter server-side — check the changed
 * row's message_id against the loaded thread client-side before invalidating).
 */
export function useChannelMessages(channelId) {
  const { workspaceUserId } = useAuth()
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!channelId) return

    const invalidate = () =>
      queryClient.invalidateQueries({ queryKey: chatKeys.messages(channelId) })

    const channel = supabase
      .channel(`chat-messages:${channelId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_messages', filter: `channel_id=eq.${channelId}` },
        invalidate,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_message_reactions' },
        (payload) => {
          const messageId = payload.new?.message_id ?? payload.old?.message_id
          const current = queryClient.getQueryData(chatKeys.messages(channelId))
          if (Array.isArray(current) && current.some((m) => m.id === messageId)) {
            invalidate()
          }
        },
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [channelId, queryClient])

  return useQuery({
    queryKey: chatKeys.messages(channelId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*, chat_message_reactions(id, user_id, emoji)')
        .eq('channel_id', channelId)
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []).map((m) => ({
        ...m,
        reactions: m.chat_message_reactions ?? [],
      }))
    },
    enabled: !!channelId && !!workspaceUserId,
    staleTime: 30000,
    retry: 1,
  })
}

// ─── Mutations ─────────────────────────────────────────────────────────────────

/**
 * Send a message. author_user_id is the actual caller (auth.uid()), NOT the
 * workspace owner — enables per-author attribution, same rule as comments.
 */
export async function sendMessage({ channelId, body, mentionedUids = [] }) {
  const { user, workspaceUserId } = await resolveWorkspace()
  const { data, error } = await supabase
    .from('chat_messages')
    .insert({
      workspace_id: workspaceUserId,
      channel_id: channelId,
      author_user_id: user.id,
      body,
      mentioned_uids: mentionedUids,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

/** Edit a message body. Author-only (enforced by RLS). */
export async function editMessage(id, body) {
  const { error } = await supabase
    .from('chat_messages')
    .update({ body, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

/** Soft-delete a message. Author or workspace admin (enforced in the RPC). */
export async function softDeleteMessage(id) {
  const { error } = await supabase.rpc('soft_delete_chat_message', {
    p_message_id: id,
  })
  if (error) throw error
}

/**
 * Toggle the current user's reaction on a message. Atomic add-or-remove via
 * RPC (avoids a client-side race between reading existing state and writing it).
 */
export async function toggleChatReaction(messageId, emoji) {
  const { error } = await supabase.rpc('toggle_chat_reaction', {
    p_message_id: messageId,
    p_emoji: emoji,
  })
  if (error) throw error
}

/** Bump the caller's last_read_at for a channel — drives unread badges. */
export async function markChannelRead(channelId) {
  const { error } = await supabase.rpc('mark_channel_read', {
    p_channel_id: channelId,
  })
  if (error) throw error
}

/**
 * Get (or create, on first contact) the 1:1 DM channel between the caller and
 * another workspace member. Deterministic — both sides converge on the same
 * channel id.
 */
export async function getOrCreateDmChannel(otherUserId) {
  const { data, error } = await supabase.rpc('get_or_create_dm_channel', {
    p_other_user_id: otherUserId,
  })
  if (error) throw error
  return data
}
