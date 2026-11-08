import { SYSTEM_ROLE_PALETTE } from '@/lib/team-roles'
import { Ban, Eye, FolderOpen } from 'lucide-react'

// ─── Documents level labels ────────────────────────────────────────────────────

export const DOCS_LEVEL_CONFIG = {
  none: { label: 'No access', description: 'Cannot see the documents section', icon: Ban },
  view: { label: 'View', description: 'Can read non-confidential documents', icon: Eye },
  manage: { label: 'Manage', description: 'Can upload, edit, and delete non-confidential documents', icon: FolderOpen },
}

// ─── Invite role options ───────────────────────────────────────────────────────

export const INVITE_ROLE_OPTIONS = [
  {
    value: 'member',
    label: 'Team Member',
    description: 'Access to client work, posts, calendar, and documents.',
    palette: SYSTEM_ROLE_PALETTE.member,
  },
  {
    value: 'admin',
    label: 'Team Admin',
    description:
      'Full access including finance, proposals, prospects, and reports.',
    palette: SYSTEM_ROLE_PALETTE.admin,
  },
]
