import { useMemo } from 'react'
import { useTeamMembers, useRemovedMembers } from '@/api/team'
import { useMemberJobRoles } from '@/api/jobRoles'
import { useClients } from '@/api/clients'
import { useCampaigns } from '@/api/campaigns'
import { useAuth } from '@/context/AuthContext'

/**
 * The id→record lookups every task surface needs to render a TaskCard or the
 * task detail page: clients, campaigns and members keyed by id, plus the
 * current user id.
 *
 * Removed members are merged in (flagged _removed) purely so an existing
 * assignment still resolves to a name instead of vanishing once someone
 * leaves the workspace.
 */
export function useTaskLookups() {
  const { user } = useAuth()
  const { data: teamMembers = [] } = useTeamMembers()
  const { data: removedMembers = [] } = useRemovedMembers()
  const { data: memberJobRoles = {} } = useMemberJobRoles()
  const { data: clientsData } = useClients()
  const { data: allCampaigns = [] } = useCampaigns()

  const memberMap = useMemo(() => {
    const map = Object.fromEntries(teamMembers.map((m) => [m.member_user_id, m]))
    removedMembers.forEach((m) => {
      if (!map[m.member_user_id]) map[m.member_user_id] = { ...m, _removed: true }
    })
    if (user && !map[user.id]) {
      map[user.id] = {
        member_user_id: user.id,
        full_name: user.user_metadata?.full_name || user.user_metadata?.name || null,
        email: user.email,
        avatar_url: user.user_metadata?.avatar_url || null,
      }
    }
    // Job titles live in their own table (one member holds several), so they're
    // merged in here rather than arriving on the member row. One merge point
    // keeps every consumer of memberMap reading them the same way.
    for (const [id, member] of Object.entries(map)) {
      map[id] = { ...member, job_roles: memberJobRoles[id] ?? [] }
    }
    return map
  }, [teamMembers, removedMembers, user, memberJobRoles])

  const clientMap = useMemo(() => {
    const all = [
      ...(clientsData?.internalAccount ? [clientsData.internalAccount] : []),
      ...(clientsData?.realClients ?? []),
    ]
    return Object.fromEntries(all.map((c) => [String(c.id), c]))
  }, [clientsData])

  const campaignMap = useMemo(
    () => Object.fromEntries(allCampaigns.map((c) => [String(c.id), c])),
    [allCampaigns],
  )

  return { clientMap, campaignMap, memberMap, currentUserId: user?.id ?? null }
}
