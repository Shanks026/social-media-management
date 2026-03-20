import { supabase } from '@/lib/supabase'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/context/AuthContext'
import { resolveWorkspace } from '@/lib/workspace'

// Typed error thrown when the workspace has hit its proposal limit
export class ProposalLimitError extends Error {
  constructor() {
    super('PROPOSAL_LIMIT_REACHED')
    this.code = 'PROPOSAL_LIMIT_REACHED'
  }
}

// ─── Read ──────────────────────────────────────────────────────────────────────

export function useProposals({ clientId } = {}) {
  const { workspaceUserId } = useAuth()
  return useQuery({
    queryKey: ['proposals', 'list', { clientId: clientId ?? null }],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_proposals_with_totals', {
        p_user_id: workspaceUserId,
        p_client_id: clientId ?? null,
      })
      if (error) throw error
      return data ?? []
    },
    enabled: !!workspaceUserId,
    staleTime: 30000,
    retry: 1,
  })
}

export function useProposal(proposalId) {
  return useQuery({
    queryKey: ['proposals', 'detail', proposalId],
    queryFn: async () => {
      const { data: proposal, error: proposalError } = await supabase
        .from('proposals')
        .select('*')
        .eq('id', proposalId)
        .single()
      if (proposalError) throw proposalError

      const { data: lineItems, error: lineItemsError } = await supabase
        .from('proposal_line_items')
        .select('*')
        .eq('proposal_id', proposalId)
        .order('sort_order')
        .order('id')
      if (lineItemsError) throw lineItemsError

      return { ...proposal, line_items: lineItems ?? [] }
    },
    enabled: !!proposalId,
    staleTime: 30000,
    retry: 1,
  })
}

// ─── Mutations ─────────────────────────────────────────────────────────────────

export function useCreateProposal() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ line_items = [], ...fields }) => {
      const { workspaceUserId } = await resolveWorkspace()

      // Check proposal limit before inserting
      const { data: sub, error: subError } = await supabase
        .from('agency_subscriptions')
        .select('proposals_limit')
        .eq('user_id', workspaceUserId)
        .single()
      if (subError) throw subError

      if (sub.proposals_limit !== null) {
        const { count, error: countError } = await supabase
          .from('proposals')
          .select('*', { count: 'exact', head: true })
          .eq('agency_user_id', workspaceUserId)
          .neq('status', 'archived')
        if (countError) throw countError

        if (count >= sub.proposals_limit) {
          throw new ProposalLimitError()
        }
      }

      // Insert proposal
      const { data: proposal, error: insertError } = await supabase
        .from('proposals')
        .insert({ ...fields, agency_user_id: workspaceUserId })
        .select()
        .single()
      if (insertError) throw insertError

      // Insert line items
      if (line_items.length > 0) {
        const { error: itemsError } = await supabase
          .from('proposal_line_items')
          .insert(
            line_items.map((item, idx) => ({
              proposal_id: proposal.id,
              description: item.description,
              amount: item.amount,
              sort_order: item.sort_order ?? idx,
            })),
          )
        if (itemsError) throw itemsError
      }

      return proposal
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposals', 'list'] })
    },
  })
}

export function useUpdateProposal() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, line_items, ...fields }) => {
      const { data: proposal, error: updateError } = await supabase
        .from('proposals')
        .update({ ...fields, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
      if (updateError) throw updateError

      // Replace line items: delete all then re-insert
      // Fetch existing items first so we can roll back if re-insert fails
      if (line_items !== undefined) {
        const { data: existingItems } = await supabase
          .from('proposal_line_items')
          .select('description, amount, sort_order')
          .eq('proposal_id', id)
          .order('sort_order')

        const { error: deleteError } = await supabase
          .from('proposal_line_items')
          .delete()
          .eq('proposal_id', id)
        if (deleteError) throw deleteError

        if (line_items.length > 0) {
          const { error: insertError } = await supabase
            .from('proposal_line_items')
            .insert(
              line_items.map((item, idx) => ({
                proposal_id: id,
                description: item.description,
                amount: item.amount,
                sort_order: item.sort_order ?? idx,
              })),
            )
          if (insertError) {
            // Attempt to restore original items to avoid data loss
            if (existingItems?.length > 0) {
              await supabase.from('proposal_line_items').insert(
                existingItems.map((item, idx) => ({
                  proposal_id: id,
                  description: item.description,
                  amount: item.amount,
                  sort_order: item.sort_order ?? idx,
                })),
              )
            }
            throw insertError
          }
        }
      }

      return proposal
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['proposals', 'list'] })
      queryClient.invalidateQueries({ queryKey: ['proposals', 'detail', data.id] })
    },
  })
}

export function useDeleteProposal() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, status, file_url }) => {
      if (status === 'draft') {
        // Hard delete for drafts — also clean up uploaded file if present
        if (file_url) {
          await deleteProposalFile(file_url)
        }
        const { error } = await supabase.from('proposals').delete().eq('id', id)
        if (error) throw error
      } else {
        // Soft archive for any other status
        const { error } = await supabase
          .from('proposals')
          .update({ status: 'archived', updated_at: new Date().toISOString() })
          .eq('id', id)
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposals', 'list'] })
    },
  })
}

// ─── File storage helpers ───────────────────────────────────────────────────

/**
 * Upload a proposal PDF to the proposal-files bucket.
 * Returns the public URL of the uploaded file.
 */
export async function uploadProposalFile(proposalId, workspaceUserId, file) {
  const ext = file.name.split('.').pop()
  const path = `${workspaceUserId}/${proposalId}/${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('proposal-files')
    .upload(path, file, { upsert: true })
  if (uploadError) throw uploadError

  // Track storage usage
  const { error: storageError } = await supabase.rpc('increment_storage_used', {
    p_user_id: workspaceUserId,
    p_bytes: file.size,
  })
  if (storageError) console.warn('Storage tracking error:', storageError)

  const { data } = supabase.storage.from('proposal-files').getPublicUrl(path)
  return data.publicUrl
}

/**
 * Remove a proposal file from storage and decrement storage usage.
 * Silently ignores if the file doesn't exist.
 */
export async function deleteProposalFile(fileUrl) {
  try {
    const storagePath = fileUrl.split('/proposal-files/')[1]
    if (!storagePath) return

    const { error } = await supabase.storage.from('proposal-files').remove([storagePath])
    if (error) console.warn('File deletion error:', error)

    // Approximate size decrement is not possible without fetching metadata,
    // so we skip storage tracking on delete for proposal files.
  } catch (err) {
    console.warn('deleteProposalFile error:', err)
  }
}

export function useGenerateProposalToken() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (proposalId) => {
      const { data: token, error } = await supabase.rpc('generate_proposal_token', {
        p_proposal_id: proposalId,
      })
      if (error) throw error

      const baseUrl = import.meta.env.VITE_APP_URL || window.location.origin
      return { token, url: `${baseUrl}/proposal/${token}` }
    },
    onSuccess: (_, proposalId) => {
      queryClient.invalidateQueries({ queryKey: ['proposals', 'detail', proposalId] })
      queryClient.invalidateQueries({ queryKey: ['proposals', 'list'] })
    },
  })
}

// ─── Advance to SENT when share link is first generated ───────────────────────

export function useMarkProposalSent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (proposalId) => {
      const { error } = await supabase
        .from('proposals')
        .update({ status: 'sent', sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', proposalId)
        .eq('status', 'draft') // only advance from draft → sent
      if (error) throw error
    },
    onSuccess: (_, proposalId) => {
      queryClient.invalidateQueries({ queryKey: ['proposals', 'detail', proposalId] })
      queryClient.invalidateQueries({ queryKey: ['proposals', 'list'] })
    },
  })
}

// ─── Public functions (no auth) ────────────────────────────────────────────────

export async function fetchProposalByToken(token) {
  const { data, error } = await supabase.rpc('get_proposal_by_token', {
    p_token: token,
  })
  if (error) throw error
  return data?.[0] ?? null
}

export async function markProposalViewed(token) {
  const { error } = await supabase.rpc('mark_proposal_viewed', { p_token: token })
  if (error) throw error
}

export async function acceptProposal(token) {
  const { error } = await supabase.rpc('accept_proposal', { p_token: token })
  if (error) throw error
}

export async function declineProposal(token, reason = null) {
  const { error } = await supabase.rpc('decline_proposal', {
    p_token: token,
    p_reason: reason,
  })
  if (error) throw error
}
