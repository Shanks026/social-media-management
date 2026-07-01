export const SYSTEM_ROLES = {
  OWNER: 'owner',
  ADMIN: 'admin',
  MEMBER: 'member',
  SUPERADMIN: 'superadmin',
}

export const DOCUMENT_LEVELS = ['none', 'view', 'manage']

export const MEMBER_DEFAULT_PERMISSIONS = { documents: 'view' }

// Categories that auto-default to confidential on upload (see UploadMetaDialog)
export const CONFIDENTIAL_DEFAULT_CATEGORIES = ['Contract', 'NDA', 'Invoice / Finance']

/**
 * Derive a flat capability object from a user's system role + stored permissions.
 * This is the single source of truth — read by usePermissions() and AuthContext.
 *
 * role       — system_role string ('owner' | 'admin' | 'member' | 'superadmin')
 * permissions — the permissions JSONB from agency_members, e.g. { documents: 'view' }
 */
export function resolveCapabilities({ role, permissions }) {
  const full = role === 'owner' || role === 'admin' || role === 'superadmin'
  const isOwnerTier = role === 'owner' || role === 'superadmin'

  return {
    // Role identifiers
    isOwner: role === 'owner',
    isAdmin: full,
    isTeamMember: role === 'member',

    // Owner-only powers
    canManageTeam: isOwnerTier,
    canBilling: isOwnerTier,
    canEditWorkspace: isOwnerTier,
    canEditInvoiceSignatory: isOwnerTier,

    // Owner/admin powers (members never get these regardless of flags)
    finance: full,
    proposals: full,
    prospects: full,
    reports: full,
    canCreateClients: full,
    canCreateCampaigns: full,
    canSendDeliverables: full,
    viewConfidentialDocs: full,

    // Per-member tunable (owner/admin always 'manage')
    documents: full ? 'manage' : (permissions?.documents ?? 'view'),

    // Convenience boolean for nav/route guards (true unless level is 'none')
    hasDocuments: full ? true : (permissions?.documents ?? 'view') !== 'none',
  }
}
