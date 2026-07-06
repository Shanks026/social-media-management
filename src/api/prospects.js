import { supabase } from '@/lib/supabase'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { useAuth } from '@/context/AuthContext'
import { resolveWorkspace } from '@/lib/workspace'
import { logStatusChange } from '@/api/prospectActivities'

// ─── Constants ────────────────────────────────────────────────────────────────

export const PROSPECT_STATUSES = [
  { value: 'new',              label: 'New' },
  { value: 'contacted',        label: 'Contacted' },
  { value: 'follow_up',        label: 'Follow-Up' },
  { value: 'demo_scheduled',   label: 'Discovery Call' },
  { value: 'proposal_sent',      label: 'Proposal Sent' },
  { value: 'changes_requested',  label: 'Changes Requested' },
  { value: 'proposal_accepted',  label: 'Proposal Accepted' },
  { value: 'contract_sent',      label: 'Contract Sent' },
  { value: 'won',                label: 'Won' },
  { value: 'lost',               label: 'Lost' },
]

export const PROSPECT_SOURCES = [
  { value: 'manual',         label: 'Manual Entry' },
  { value: 'apollo',         label: 'Apollo' },
  { value: 'apify',          label: 'Apify' },
  { value: 'google_maps',    label: 'Google Maps' },
  { value: 'referral',       label: 'Referral' },
  { value: 'cold_outreach',  label: 'Cold Outreach' },
  { value: 'instagram',      label: 'Instagram' },
  { value: 'linkedin',       label: 'LinkedIn' },
  { value: 'other',          label: 'Other' },
]

// ─── Read ──────────────────────────────────────────────────────────────────────

export function useProspect(prospectId) {
  return useQuery({
    queryKey: ['prospects', 'detail', prospectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('prospects')
        .select('*')
        .eq('id', prospectId)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!prospectId,
    staleTime: 30000,
    retry: 1,
  })
}

export function useProspects({ search = '', status = 'all' } = {}) {
  const { workspaceUserId } = useAuth()

  return useQuery({
    queryKey: ['prospects', 'list', { search, status }],
    queryFn: async () => {
      let query = supabase
        .from('prospects')
        .select('*')
        .eq('user_id', workspaceUserId)
        .order('created_at', { ascending: false })

      if (status && status !== 'all') {
        query = query.eq('status', status)
      }

      if (search) {
        query = query.or(
          `business_name.ilike.%${search}%,contact_name.ilike.%${search}%,email.ilike.%${search}%,location.ilike.%${search}%`
        )
      }

      const { data, error } = await query
      if (error) throw error
      return data ?? []
    },
    enabled: !!workspaceUserId,
    staleTime: 30000,
    retry: 1,
  })
}

// ─── Mutations ─────────────────────────────────────────────────────────────────

export function useCreateProspect() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (fields) => {
      const { workspaceUserId } = await resolveWorkspace()
      const { data, error } = await supabase
        .from('prospects')
        .insert({ ...fields, user_id: workspaceUserId })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prospects', 'list'] })
    },
  })
}

export function useImportProspects() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ rows, source }) => {
      const { workspaceUserId } = await resolveWorkspace()
      const records = rows.map((row) => ({
        user_id: workspaceUserId,
        business_name: row.business_name,
        contact_name: row.contact_name || null,
        email: row.email || null,
        phone: row.phone || null,
        website: row.website || null,
        location: row.location || null,
        address: row.address || null,
        instagram: row.instagram || null,
        linkedin: row.linkedin || null,
        source: source || 'manual',
        status: 'new',
      }))
      const { data, error } = await supabase
        .from('prospects')
        .insert(records)
        .select()
      if (error) throw error
      return data ?? []
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prospects', 'list'] })
    },
  })
}

export function useUpdateProspect() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, _prevStatus, ...fields }) => {
      const { workspaceUserId } = await resolveWorkspace()

      const { data, error } = await supabase
        .from('prospects')
        .update({ ...fields, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error

      // Auto-log status changes
      if (fields.status && _prevStatus && fields.status !== _prevStatus) {
        await logStatusChange({
          prospect_id:    id,
          from_status:    _prevStatus,
          to_status:      fields.status,
          workspaceUserId,
        })
      }

      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['prospects', 'list'] })
      queryClient.invalidateQueries({ queryKey: ['prospects', 'detail', data.id] })
      queryClient.invalidateQueries({ queryKey: ['prospect-activities', data.id] })
    },
  })
}

// Local duplicate of the storage-removal snippet in `@/api/proposals`'
// `deleteProposalFile` — not imported directly to avoid a circular import
// (prospects.js → proposals.js → prospectActivities.js → prospects.js).
async function removeProposalFileByUrl(fileUrl) {
  try {
    const storagePath = fileUrl?.split('/proposal-files/')[1]
    if (!storagePath) return
    const { error } = await supabase.storage.from('proposal-files').remove([storagePath])
    if (error) console.warn('Failed to remove proposal file:', error)
  } catch (err) {
    console.warn('Failed to remove proposal file:', err)
  }
}

export function useDeleteProspect() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id) => {
      // `proposals.prospect_id` is ON DELETE SET NULL, so without this,
      // proposals attached to the prospect survive as orphaned rows (still
      // showing the old prospect's name, still visible workspace-wide).
      // Apply the same rule used to delete a single proposal elsewhere
      // (see useDeleteProposal): drafts are hard-deleted (+ file cleanup);
      // anything past draft is a real business record (sent/accepted/etc.)
      // and gets soft-archived instead, never destroyed. Once archived, the
      // prospect delete below naturally unlinks it via ON DELETE SET NULL.
      const { data: proposals } = await supabase
        .from('proposals')
        .select('id, status, file_url')
        .eq('prospect_id', id)

      const draftIds = (proposals ?? []).filter((p) => p.status === 'draft').map((p) => p.id)
      const otherIds = (proposals ?? []).filter((p) => p.status !== 'draft').map((p) => p.id)

      for (const p of proposals ?? []) {
        if (p.status === 'draft' && p.file_url) await removeProposalFileByUrl(p.file_url)
      }
      if (draftIds.length) {
        const { error: draftError } = await supabase.from('proposals').delete().in('id', draftIds)
        if (draftError) throw draftError
      }
      if (otherIds.length) {
        const { error: archiveError } = await supabase
          .from('proposals')
          .update({ status: 'archived', updated_at: new Date().toISOString() })
          .in('id', otherIds)
        if (archiveError) throw archiveError
      }

      // `client_documents.prospect_id` is also ON DELETE SET NULL — left as
      // the default behavior (unlink, keep the file and row) since documents
      // can hold signed contracts/NDAs that shouldn't disappear as a side
      // effect of deleting an unrelated prospect record.

      // prospect_activities.prospect_id is ON DELETE CASCADE — no manual
      // cleanup needed, it's removed automatically with the prospect.
      const { error } = await supabase.from('prospects').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prospects', 'list'] })
      queryClient.invalidateQueries({ queryKey: ['proposals', 'list'] })
      queryClient.invalidateQueries({ queryKey: ['documents'] })
    },
  })
}
