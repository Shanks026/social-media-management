// Prospects API (ADR 0007): the key factory, a plain async function per
// mutation (the unit-test surface, callable outside React), and a hook that
// wraps each one and owns the cache invalidation.
import { supabase } from '@/lib/supabase'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { useAuth } from '@/context/AuthContext'
import { resolveWorkspace } from '@/lib/workspace'
import { logStatusChange } from '@/api/prospectActivities'
import { deleteProposalFile } from '@/api/proposals'
import { STATUSES, statusLabel } from '@/lib/domain/prospectStatus'
import { documentKeys, proposalKeys, prospectActivityKeys, prospectKeys } from '@/api/queryKeys'

export { prospectKeys }

// ─── Constants ────────────────────────────────────────────────────────────────

// Select/tab options for Prospect stages, from the domain module (ADR 0006).
export const PROSPECT_STATUSES = STATUSES.map((value) => ({ value, label: statusLabel(value) }))

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
    queryKey: prospectKeys.detail(prospectId),
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
    queryKey: prospectKeys.list(workspaceUserId, { search, status }),
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

export async function createProspect(fields) {
  const { workspaceUserId } = await resolveWorkspace()
  const { data, error } = await supabase
    .from('prospects')
    .insert({ ...fields, user_id: workspaceUserId })
    .select()
    .single()
  if (error) throw error
  return data
}

export function useCreateProspect() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createProspect,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: prospectKeys.lists() })
    },
  })
}

export async function importProspects({ rows, source }) {
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
    status: 'NEW',
  }))
  const { data, error } = await supabase
    .from('prospects')
    .insert(records)
    .select()
  if (error) throw error
  return data ?? []
}

export function useImportProspects() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: importProspects,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: prospectKeys.lists() })
    },
  })
}

/**
 * Update a Prospect. Pass `_prevStatus` alongside a new `status` to log the
 * stage move as Outreach.
 */
export async function updateProspect({ id, _prevStatus, ...fields }) {
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
}

function invalidateProspect(queryClient, prospectId) {
  queryClient.invalidateQueries({ queryKey: prospectKeys.lists() })
  queryClient.invalidateQueries({ queryKey: prospectKeys.detail(prospectId) })
  queryClient.invalidateQueries({ queryKey: prospectActivityKeys.list(prospectId) })
}

export function useUpdateProspect() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateProspect,
    onSuccess: (data) => invalidateProspect(queryClient, data.id),
  })
}

/** Link a Prospect to the Client it was converted into. */
export async function markProspectConverted({ prospectId, clientId }) {
  const { error } = await supabase
    .from('prospects')
    .update({ converted_client_id: clientId, updated_at: new Date().toISOString() })
    .eq('id', prospectId)
  if (error) throw error
  return { prospectId, clientId }
}

export function useMarkProspectConverted() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: markProspectConverted,
    onSuccess: ({ prospectId }) => invalidateProspect(queryClient, prospectId),
  })
}

/**
 * Delete a Prospect. Its Proposals follow the single-proposal delete rule:
 * drafts are hard-deleted (with their file), anything later is archived.
 */
export async function deleteProspect(id) {
  // `proposals.prospect_id` is ON DELETE SET NULL, so without this, proposals
  // attached to the prospect survive as orphaned rows (still showing the old
  // prospect's name, still visible workspace-wide). Anything past draft is a
  // real business record (sent/accepted/etc.) and is archived, never
  // destroyed; the prospect delete below then unlinks it via ON DELETE SET NULL.
  const { data: proposals, error: proposalsError } = await supabase
    .from('proposals')
    .select('id, status, file_url')
    .eq('prospect_id', id)
  if (proposalsError) throw proposalsError

  const draftIds = (proposals ?? []).filter((p) => p.status === 'DRAFT').map((p) => p.id)
  const otherIds = (proposals ?? []).filter((p) => p.status !== 'DRAFT').map((p) => p.id)

  for (const p of proposals ?? []) {
    if (p.status === 'DRAFT' && p.file_url) await deleteProposalFile(p.file_url)
  }
  if (draftIds.length) {
    const { error: draftError } = await supabase.from('proposals').delete().in('id', draftIds)
    if (draftError) throw draftError
  }
  if (otherIds.length) {
    const { error: archiveError } = await supabase
      .from('proposals')
      .update({ status: 'ARCHIVED', updated_at: new Date().toISOString() })
      .in('id', otherIds)
    if (archiveError) throw archiveError
  }

  // `client_documents.prospect_id` is also ON DELETE SET NULL — left as the
  // default behavior (unlink, keep the file and row) since documents can hold
  // signed contracts/NDAs that shouldn't disappear as a side effect of
  // deleting an unrelated prospect record.

  // prospect_activities.prospect_id is ON DELETE CASCADE — removed with it.
  const { error } = await supabase.from('prospects').delete().eq('id', id)
  if (error) throw error
}

export function useDeleteProspect() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteProspect,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: prospectKeys.lists() })
      queryClient.invalidateQueries({ queryKey: proposalKeys.all })
      queryClient.invalidateQueries({ queryKey: documentKeys.all })
    },
  })
}
