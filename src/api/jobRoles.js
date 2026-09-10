import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { resolveWorkspace } from '@/lib/workspace'

/**
 * Job roles are the workspace's own job titles — owner-defined, many per
 * member, and purely for identification. They never affect access: every
 * permission comes from `system_role` and the `permissions` JSONB.
 *
 * Reads are workspace-wide (a member sees their own titles in Settings, and
 * hiding a colleague's job title would be a distinction without a purpose);
 * every write is owner-only, enforced by RLS and by `set_member_job_roles`.
 */

// ─── Reads ───────────────────────────────────────────────────────────────────

export function useJobRoles() {
  const { workspaceUserId } = useAuth()
  return useQuery({
    queryKey: ['job-roles', 'list', workspaceUserId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agency_job_roles')
        .select('id, name, color, created_at')
        .eq('workspace_id', workspaceUserId)
        .order('name', { ascending: true })
      if (error) throw error
      return data ?? []
    },
    enabled: !!workspaceUserId,
  })
}

/**
 * `member_user_id` → array of job role rows, so a roster can render everyone's
 * titles without a query per member. The join table stores `member_user_id`
 * directly, which is the same key `memberMap` uses everywhere else.
 */
export function useMemberJobRoles() {
  const { workspaceUserId } = useAuth()
  return useQuery({
    queryKey: ['job-roles', 'by-member', workspaceUserId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agency_member_job_roles')
        .select('member_user_id, agency_job_roles ( id, name, color )')
        .eq('workspace_id', workspaceUserId)
      if (error) throw error

      const map = {}
      for (const row of data ?? []) {
        if (!row.agency_job_roles) continue
        ;(map[row.member_user_id] ??= []).push(row.agency_job_roles)
      }
      // Stable order so badges don't reshuffle between renders.
      for (const list of Object.values(map)) list.sort((a, b) => a.name.localeCompare(b.name))
      return map
    },
    enabled: !!workspaceUserId,
  })
}

// ─── Mutations ───────────────────────────────────────────────────────────────

export async function createJobRole({ name, color }) {
  const { workspaceUserId } = await resolveWorkspace()
  const { data, error } = await supabase
    .from('agency_job_roles')
    .insert([{ name: name.trim(), color, workspace_id: workspaceUserId }])
    .select('id, name, color, created_at')
    .single()
  if (error) throw error
  return data
}

/**
 * Recolour an existing job role. Colour is presentation, not identity — the
 * "create and delete only, no edit" rule exists so a role's *meaning* can't
 * shift under the people holding it, and a different shade doesn't do that.
 * Renaming is still deliberately absent.
 *
 * No RPC needed: `agency_job_roles_write_owner` is a FOR ALL policy, so a plain
 * update is already owner-gated.
 */
export async function updateJobRoleColor(id, color) {
  const { data, error } = await supabase
    .from('agency_job_roles')
    .update({ color })
    .eq('id', id)
    .select('id, name, color, created_at')
    .single()
  if (error) throw error
  return data
}

/**
 * Deleting a job role removes it from everyone holding it — the FK cascades.
 * That is the intended meaning of delete here, which is why the confirmation
 * has to state how many members are affected before this is called.
 */
export async function deleteJobRole(id) {
  const { error } = await supabase.from('agency_job_roles').delete().eq('id', id)
  if (error) throw error
}

/**
 * Replaces a member's whole set of job roles. Goes through the RPC rather than
 * writing the join table directly: the write policies are owner-only, and the
 * RPC additionally rejects role ids belonging to another workspace.
 */
export async function setMemberJobRoles(memberUserId, jobRoleIds) {
  const { error } = await supabase.rpc('set_member_job_roles', {
    p_member_user_id: memberUserId,
    p_job_role_ids: jobRoleIds,
  })
  if (error) throw error
}

/**
 * A member's free-text responsibilities note. Owner-only, and separate from
 * `updateMemberAccess` because that function refuses the owner row outright —
 * which is right for access, but left the owner unable to describe themselves.
 * This touches no access field, so that protection stays intact.
 */
export async function setMemberResponsibilities(memberUserId, text) {
  const { error } = await supabase.rpc('set_member_responsibilities', {
    p_member_user_id: memberUserId,
    p_text: text ?? null,
  })
  if (error) throw error
}
