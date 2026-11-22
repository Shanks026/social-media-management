// Proposals API (ADR 0007): the key factory, a plain async function per
// mutation (the unit-test surface, callable outside React), and a hook that
// wraps each one and owns the cache invalidation.
import { supabase } from '@/lib/supabase'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/context/AuthContext'
import { useSubscription } from '@/api/useSubscription'
import { resolveWorkspace } from '@/lib/workspace'
import { logStatusChange } from '@/api/prospectActivities'
import { STAGES_BEFORE_PROPOSAL_SENT } from '@/lib/domain/prospectStatus'
import { proposalKeys, prospectActivityKeys, prospectKeys } from '@/api/queryKeys'

export { proposalKeys }

// Typed error thrown when the workspace has hit its proposal limit
export class ProposalLimitError extends Error {
  constructor() {
    super('PROPOSAL_LIMIT_REACHED')
    this.code = 'PROPOSAL_LIMIT_REACHED'
  }
}

// ─── Read ──────────────────────────────────────────────────────────────────────

// Every scope reads the one cached workspace-wide list (the RPC with no Client),
// so a Client's or Prospect's tab and the Plan limit share a single query.
export function useProposals({ clientId, prospectId } = {}) {
  const { workspaceUserId } = useAuth()
  return useQuery({
    queryKey: proposalKeys.list(workspaceUserId),
    queryFn: async () => {
      // The caller's workspace, Owner/Admin only (ADR 0008).
      const { data, error } = await supabase.rpc('get_proposals_with_totals', {
        p_client_id: null,
      })
      if (error) throw error
      return data ?? []
    },
    select: prospectId
      ? (rows) => rows.filter((p) => p.prospect_id === prospectId)
      : clientId
        ? (rows) => rows.filter((p) => p.client_id === clientId)
        : undefined,
    enabled: !!workspaceUserId,
    staleTime: 30000,
    retry: 1,
  })
}

// The Plan's Proposal limit (spec #200): `used` is the workspace's non-archived
// Proposals, `limit` is null on an unlimited Plan. The one place that decides
// whether "New Proposal" is allowed.
export function useProposalLimit() {
  const { data: sub } = useSubscription()
  const { data: proposals = [] } = useProposals()
  const used = proposals.filter((p) => p.status !== 'ARCHIVED').length
  const limit = sub?.proposals_limit ?? null
  return { used, limit, atLimit: limit !== null && used >= limit }
}

export function useProposal(proposalId) {
  return useQuery({
    queryKey: proposalKeys.detail(proposalId),
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

export async function createProposal({ line_items = [], ...fields }) {
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
      .neq('status', 'ARCHIVED')
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
}

export function useCreateProposal() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createProposal,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: proposalKeys.lists() })
    },
  })
}

export async function updateProposal({ id, line_items, ...fields }) {
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
}

export function useUpdateProposal() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateProposal,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: proposalKeys.lists() })
      queryClient.invalidateQueries({ queryKey: proposalKeys.detail(data.id) })
    },
  })
}

/** Drafts are hard-deleted (with their file); anything later is archived. */
export async function deleteProposal({ id, status, file_url }) {
  if (status === 'DRAFT') {
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
      .update({ status: 'ARCHIVED', updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw error
  }
}

export function useDeleteProposal() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteProposal,
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: proposalKeys.lists() })
      queryClient.invalidateQueries({ queryKey: proposalKeys.detail(id) })
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
  } catch (err) {
console.warn('deleteProposalFile error:', err)
  }
}

export async function generateProposalToken(proposalId) {
  const { data: token, error } = await supabase.rpc('generate_proposal_token', {
    p_proposal_id: proposalId,
  })
  if (error) throw error

  const baseUrl = import.meta.env.VITE_APP_URL || window.location.origin
  return { token, url: `${baseUrl}/proposal/${token}` }
}

export function useGenerateProposalToken() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: generateProposalToken,
    onSuccess: (_, proposalId) => {
      queryClient.invalidateQueries({ queryKey: proposalKeys.detail(proposalId) })
      queryClient.invalidateQueries({ queryKey: proposalKeys.lists() })
    },
  })
}

// ─── Advance to SENT when share link is first generated ───────────────────────

/**
 * Marks a Proposal sent (first share, or a resend after changes were
 * requested) and advances its linked Prospect to PROPOSAL_SENT when the
 * Prospect is still at an earlier stage (STAGES_BEFORE_PROPOSAL_SENT). A
 * Prospect the agency already moved further along is left alone. This is a
 * plain authenticated table write, so the sync happens here rather than in a
 * SQL RPC like accept/decline.
 *
 * @returns {{ prospectId: string|null, advanced: boolean }}
 */
export async function markProposalSent(proposalId) {
  const { data, error } = await supabase
    .from('proposals')
    .update({ status: 'SENT', sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', proposalId)
    .in('status', ['DRAFT', 'CHANGES_REQUESTED']) // resend after a rework, too
    .select('prospect_id')
    .maybeSingle()
  if (error) throw error

  const prospectId = data?.prospect_id ?? null
  if (!prospectId) return { prospectId, advanced: false }

  const { workspaceUserId } = await resolveWorkspace()
  const { data: prospect, error: prospectError } = await supabase
    .from('prospects')
    .select('status')
    .eq('id', prospectId)
    .single()
  if (prospectError) throw prospectError

  if (!STAGES_BEFORE_PROPOSAL_SENT.includes(prospect.status)) {
    return { prospectId, advanced: false }
  }

  const { error: advanceError } = await supabase
    .from('prospects')
    .update({ status: 'PROPOSAL_SENT', updated_at: new Date().toISOString() })
    .eq('id', prospectId)
  if (advanceError) throw advanceError

  await logStatusChange({
    prospect_id: prospectId,
    from_status: prospect.status,
    to_status: 'PROPOSAL_SENT',
    workspaceUserId,
  })

  return { prospectId, advanced: true }
}

export function useMarkProposalSent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: markProposalSent,
    onSuccess: ({ prospectId, advanced }, proposalId) => {
      queryClient.invalidateQueries({ queryKey: proposalKeys.detail(proposalId) })
      queryClient.invalidateQueries({ queryKey: proposalKeys.lists() })
      if (advanced) {
        queryClient.invalidateQueries({ queryKey: prospectKeys.lists() })
        queryClient.invalidateQueries({ queryKey: prospectKeys.detail(prospectId) })
        queryClient.invalidateQueries({ queryKey: prospectActivityKeys.list(prospectId) })
      }
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

export async function sendProposalEmail({ recipientEmail, recipientName, proposalTitle, proposalUrl, agencyUserId }) {
  const { error } = await supabase.functions.invoke('send-proposal-email', {
    body: {
      recipient_email: recipientEmail,
      recipient_name: recipientName,
      proposal_title: proposalTitle,
      proposal_url: proposalUrl,
      agency_user_id: agencyUserId,
    },
  })
  if (error) throw error
}

export async function declineProposal(token, reason = null) {
  const { error } = await supabase.rpc('decline_proposal', {
    p_token: token,
    p_reason: reason,
  })
  if (error) throw error
}

export async function requestProposalChanges(token, notes = null) {
  const { error } = await supabase.rpc('request_proposal_changes', {
    p_token: token,
    p_notes: notes,
  })
  if (error) throw error
}
