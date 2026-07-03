import { supabase } from '@/lib/supabase'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/context/AuthContext'
import { useEffect } from 'react'
import { resolveWorkspace } from '@/lib/workspace'

// ─── Query Keys ────────────────────────────────────────────────────────────────

export const commentKeys = {
  thread: (entityType, entityId) => ['comments', entityType, entityId],
}

// ─── Read Hook ─────────────────────────────────────────────────────────────────

/**
 * Comment thread for a single entity (post or campaign), oldest-first.
 * Subscribes to Realtime changes on the entity's comments and invalidates the
 * query (same invalidator pattern as team.js and the notification bell).
 */
export function useComments({ entityType, entityId }) {
  const { workspaceUserId } = useAuth()
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!entityType || !entityId) return

    const invalidate = () =>
      queryClient.invalidateQueries({ queryKey: commentKeys.thread(entityType, entityId) })

    const channel = supabase
      .channel(`comments:${entityType}:${entityId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'comments',
          filter: `entity_id=eq.${entityId}`,
        },
        invalidate,
      )
      .on(
        // comment_reactions has no entity_id column, so it can't use a server-side
        // filter like the one above — check membership against the loaded thread
        // client-side before invalidating, instead of denormalizing entity_id onto it.
        'postgres_changes',
        { event: '*', schema: 'public', table: 'comment_reactions' },
        (payload) => {
          const commentId = payload.new?.comment_id ?? payload.old?.comment_id
          const current = queryClient.getQueryData(commentKeys.thread(entityType, entityId))
          if (Array.isArray(current) && current.some((c) => c.id === commentId)) {
            invalidate()
          }
        },
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [entityType, entityId, queryClient])

  return useQuery({
    queryKey: commentKeys.thread(entityType, entityId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('comments')
        .select('*, comment_reactions(id, user_id, emoji)')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []).map((c) => ({
        ...c,
        reactions: c.comment_reactions ?? [],
      }))
    },
    enabled: !!entityType && !!entityId && !!workspaceUserId,
    staleTime: 30000,
    retry: 1,
  })
}

// ─── Mutations ─────────────────────────────────────────────────────────────────

/**
 * Create a comment. author_user_id is the actual caller (auth.uid()), NOT the
 * workspace owner — this is what enables per-author attribution.
 */
export async function createComment({ entityType, entityId, body, mentionedUids = [] }) {
  const { user, workspaceUserId } = await resolveWorkspace()
  const { data, error } = await supabase
    .from('comments')
    .insert({
      workspace_id: workspaceUserId,
      entity_type: entityType,
      entity_id: entityId,
      author_user_id: user.id,
      body,
      mentioned_uids: mentionedUids,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

/** Edit a comment body. Author-only (enforced by RLS). */
export async function updateComment(id, body) {
  const { error } = await supabase
    .from('comments')
    .update({ body, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

/** Soft-delete a comment. Author or workspace admin (enforced in the RPC). */
export async function softDeleteComment(id) {
  const { error } = await supabase.rpc('soft_delete_comment', {
    p_comment_id: id,
  })
  if (error) throw error
}

// Fixed 14-emoji set — no open picker, matches the DB check constraint on comment_reactions.emoji.
export const REACTION_EMOJIS = ['👍', '👎', '❤️', '😂', '😮', '😢', '🎉', '🙌', '🔥', '👀', '✅', '🤔', '➕', '➖']

/**
 * Toggle the current user's reaction on a comment. Atomic add-or-remove via RPC
 * (avoids a client-side race between reading existing state and writing it).
 */
export async function toggleReaction(commentId, emoji) {
  const { error } = await supabase.rpc('toggle_comment_reaction', {
    p_comment_id: commentId,
    p_emoji: emoji,
  })
  if (error) throw error
}
