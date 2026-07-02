import { useAuth } from '@/context/AuthContext'
import { resolveCapabilities } from '@/lib/permissions'

/**
 * Returns the resolved capability set for the current user.
 * Single source of truth for nav, routes, dashboard, and feature pages.
 *
 * Reads userRole + userPermissions from AuthContext (set at login via the
 * agency_members row). Falls back to the most-restricted set if not yet resolved.
 */
export function usePermissions() {
  const { userRole, userPermissions } = useAuth()
  return resolveCapabilities({
    role: userRole ?? 'member',
    permissions: userPermissions ?? { documents: 'view' },
  })
}
