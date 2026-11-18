import { supabase } from '@/lib/supabase'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/context/AuthContext'
import { useEffect, useId, useMemo } from 'react'
import { resolveWorkspace } from '@/lib/workspace'
import { chatKeys } from '@/api/queryKeys'

export { chatKeys }

// Fixed 14-emoji set — matches the DB check constraint on
// chat_message_reactions.emoji (kept separately from comments.REACTION_EMOJIS
// since the two are enforced by independent constraints).
export const CHAT_REACTION_EMOJIS = ['👍', '👎', '❤️', '😂', '😮', '😢', '🎉', '🙌', '🔥', '👀', '✅', '🤔', '➕', '➖']

// ─── Read Hooks ────────────────────────────────────────────────────────────────

/**
 * The caller's channel list — the single workspace channel plus any DMs —
 * with unread counts, per-channel mention state, and DM-partner resolution
 * via get_my_chat_channels(). Bootstraps the workspace channel (and the
 * caller's membership in it) on first call via ensure_workspace_channel(),
 * so this works for members who existed before the chat feature shipped.
 *
 * `enabled` lets callers outside the chat pages (e.g. the main sidebar's nav
 * badge) gate this off entirely for workspaces without the `chat` plan flag
 * — otherwise every page load would bootstrap chat infra for users who don't
 * have the feature at all.
 */
export function useMyChannels({ enabled = true } = {}) {
  const { user, workspaceUserId } = useAuth()
  const queryClient = useQueryClient()
  // ChatSidebar and ChatPage both call this hook while /chat is open, so two
  // instances are mounted concurrently. Supabase's realtime client keys
  // subscriptions by topic — if both instances subscribed to the identical
  // `chat-channels:${user.id}` topic, only the first join's postgres_changes
  // filters actually get registered with the server, so whichever instance
  // mounted second silently never fires (only a full reload's initial fetch
  // would then reflect a new message, never the live update). useId() gives
  // each mounted instance its own topic so both subscriptions actually work.
  const instanceId = useId()

  useEffect(() => {
    if (!user?.id || !enabled) return

    const invalidate = () =>
      queryClient.invalidateQueries({ queryKey: chatKeys.channels(user.id) })

    const channel = supabase
      .channel(`chat-channels:${user.id}:${instanceId}`)
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
  }, [user?.id, enabled, queryClient, instanceId])

  return useQuery({
    queryKey: chatKeys.channels(user?.id),
    queryFn: async () => {
      await supabase.rpc('ensure_workspace_channel')

      const { data, error } = await supabase.rpc('get_my_chat_channels')
      if (error) throw error
      return data ?? []
    },
    enabled: !!user?.id && !!workspaceUserId && enabled,
    staleTime: 30000,
    retry: 1,
  })
}

/**
 * Aggregate unread state across every channel — total count, and whether any
 * unread message actually mentions the caller. Powers the main sidebar's
 * Chat nav badge (a plain count normally, an "@" takes priority when
 * mentioned). Gated the same way as useMyChannels — see its `enabled` note.
 */
export function useChatUnreadSummary({ enabled = true } = {}) {
  const { data: channels = [] } = useMyChannels({ enabled })

  return useMemo(
    () => ({
      count: channels.reduce((sum, c) => sum + Number(c.unread_count || 0), 0),
      hasMention: channels.some((c) => c.has_unread_mention),
    }),
    [channels],
  )
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
        // entity_references is the DB column name (references is a reserved
        // SQL keyword) — normalized to `references` here so consumers don't
        // need to know that.
        references: m.entity_references ?? [],
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
export async function sendMessage({ channelId, body, mentionedUids = [], references = [] }) {
  const { user, workspaceUserId } = await resolveWorkspace()
  const { data, error } = await supabase
    .from('chat_messages')
    .insert({
      workspace_id: workspaceUserId,
      channel_id: channelId,
      author_user_id: user.id,
      body,
      mentioned_uids: mentionedUids,
      entity_references: references,
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
