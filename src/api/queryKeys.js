// Every React Query key factory in the app (ADR 0007).
//
// They live in this one leaf module, with no imports, because domains refresh
// each other: a Deliverable change refreshes Campaigns, Clients and Tasks; an
// Invoice refreshes Campaigns and Clients; deleting a Prospect archives its
// Proposals. Factories imported from domain modules would make import cycles.
// Each domain module re-exports its own factory, so callers can import
// `campaignKeys` from '@/api/campaigns' as before.
//
// Rules:
// - One root per domain. Everything a domain caches starts with its root, so
//   `xxxKeys.all` refreshes every view of it.
// - Workspace-scoped keys take workspaceUserId (from useAuth), never the
//   signed-in user's id, so the Owner and invited Members share entries.
//   Keys that really are per-person (notifications, chat, "my" lists) take the
//   user's id and say so.

// ─── Deliverables (posts) ─────────────────────────────────────────────────────

export const postKeys = {
  all: ['posts'],
  // one version with its post and client (PostDetails); keyed by version id
  detail: (versionId) => ['posts', 'detail', versionId],
  // every version of one post (the history sidebar)
  versions: (postId) => ['posts', 'versions', postId],
  byClient: (clientId) => ['posts', 'by-client', clientId],
  drafts: (clientId) => ['posts', 'drafts', clientId],
  clientCounts: (clientId) => ['posts', 'client-counts', clientId],
  global: (workspaceId, filters = {}) => ['posts', 'global', workspaceId, { ...filters }],
  globalCounts: (workspaceId) => ['posts', 'global-counts', workspaceId],
  // every Deliverable labelled by client (the task deliverable picker)
  picker: (workspaceId) => ['posts', 'picker', workspaceId],
  calendar: (workspaceId, params = {}) => ['posts', 'calendar', workspaceId, { ...params }],
  week: (workspaceId, params = {}) => ['posts', 'week', workspaceId, { ...params }],
  pendingApprovals: (workspaceId) => ['posts', 'pending-approvals', workspaceId],
  pendingApprovalsCount: (workspaceId) => ['posts', 'pending-approvals-count', workspaceId],
  approvalLog: (workspaceId, action, page) => ['posts', 'approval-log', workspaceId, action ?? null, page],
  approvalLogCount: (workspaceId, action) => ['posts', 'approval-log-count', workspaceId, action ?? null],
  // per person: the signed-in Member's own submissions
  mySubmissions: (userId, status, page) => ['posts', 'my-submissions', userId, status ?? null, page],
  mySubmissionsCount: (userId, status) => ['posts', 'my-submissions-count', userId, status ?? null],
  review: (token) => ['posts', 'review', token],
  trialCount: (workspaceId) => ['posts', 'trial-count', workspaceId],
}

// ─── Tasks ────────────────────────────────────────────────────────────────────

export const taskKeys = {
  all: ['tasks'],
  lists: () => ['tasks', 'list'],
  list: (workspaceId, filters = {}) => ['tasks', 'list', workspaceId, { ...filters }],
  // per person
  mine: (userId) => ['tasks', 'mine', userId],
  myOpenCount: (userId) => ['tasks', 'my-open-count', userId],
  detail: (id) => ['tasks', 'detail', id],
  activity: (id) => ['tasks', 'activity', id],
  exists: (id) => ['tasks', 'exists', id],
  forPost: (postId) => ['tasks', 'for-post', postId],
  deliverables: (taskId) => ['tasks', 'deliverables', taskId],
  postIds: (taskId) => ['tasks', 'post-ids', taskId],
}

// ─── Clients ──────────────────────────────────────────────────────────────────

export const clientKeys = {
  all: ['clients'],
  // id/name/logo options for pickers and lookups, split into the internal
  // account and real clients
  options: (workspaceId) => ['clients', 'options', workspaceId],
  // the Clients page, with pipeline analytics
  list: (workspaceId, filters = {}) => ['clients', 'list', workspaceId, { ...filters }],
  // the unfiltered pipeline the dashboard reads
  pipeline: (workspaceId) => ['clients', 'pipeline', workspaceId],
  detail: (id) => ['clients', 'detail', id],
  internal: (workspaceId) => ['clients', 'internal', workspaceId],
}

// ─── Campaigns ────────────────────────────────────────────────────────────────

export const campaignKeys = {
  all: ['campaigns'],
  list: (workspaceId, filters = {}) => [
    'campaigns',
    'list',
    workspaceId,
    { clientId: filters.clientId ?? null },
  ],
  detail: (id) => ['campaigns', 'detail', id],
  analytics: (id) => ['campaigns', 'analytics', id],
  invoices: (id) => ['campaigns', 'invoices', id],
  review: (token) => ['campaigns', 'review', token],
  activeByClient: (clientId) => ['campaigns', 'active-by-client', clientId],
  unlinkedPosts: (clientId) => ['campaigns', 'unlinked-posts', clientId],
}

// ─── Finance ──────────────────────────────────────────────────────────────────

export const invoiceKeys = {
  all: ['invoices'],
  list: (workspaceId, filters = {}) => ['invoices', 'list', workspaceId, { ...filters }],
  detail: (id) => ['invoices', 'detail', id],
  nextNumber: (workspaceId) => ['invoices', 'next-number', workspaceId],
}

export const recurringInvoiceKeys = {
  all: ['recurring_invoices'],
  list: (workspaceId, filters = {}) => ['recurring_invoices', 'list', workspaceId, { ...filters }],
}

export const transactionKeys = {
  all: ['transactions'],
  list: (workspaceId, filters = {}) => ['transactions', 'list', workspaceId, { ...filters }],
  overview: (workspaceId) => ['transactions', 'overview', workspaceId],
  byCampaign: (campaignId) => ['transactions', 'campaign', campaignId],
}

export const expenseKeys = {
  all: ['expenses'],
  list: (workspaceId, filters = {}) => ['expenses', 'list', workspaceId, { ...filters }],
  burnRate: (workspaceId) => ['expenses', 'burn-rate', workspaceId],
}

// ─── Sales ────────────────────────────────────────────────────────────────────

export const proposalKeys = {
  all: ['proposals'],
  lists: () => ['proposals', 'list'],
  list: (workspaceId, filters = {}) => [
    'proposals',
    'list',
    workspaceId,
    { clientId: filters.clientId ?? null, prospectId: filters.prospectId ?? null },
  ],
  detail: (id) => ['proposals', 'detail', id],
}

export const prospectKeys = {
  all: ['prospects'],
  lists: () => ['prospects', 'list'],
  list: (workspaceId, filters = {}) => [
    'prospects',
    'list',
    workspaceId,
    { search: filters.search ?? '', status: filters.status ?? 'all' },
  ],
  detail: (id) => ['prospects', 'detail', id],
}

export const prospectActivityKeys = {
  all: ['prospect-activities'],
  list: (prospectId) => ['prospect-activities', prospectId],
}

// ─── Meetings ─────────────────────────────────────────────────────────────────

export const meetingKeys = {
  all: ['meetings'],
  // a date range, optionally one client (Meetings page, calendar, timelines)
  range: (workspaceId, params = {}) => ['meetings', 'range', workspaceId, { ...params }],
  upcoming: (workspaceId, clientId = null, limit = 3) => ['meetings', 'upcoming', workspaceId, clientId, limit],
  today: (workspaceId) => ['meetings', 'today', workspaceId],
  byCampaign: (campaignId) => ['meetings', 'campaign', campaignId],
}

// ─── Notes ────────────────────────────────────────────────────────────────────

export const noteKeys = {
  all: ['agency-notes'],
  list: (workspaceId) => ['agency-notes', 'list', workspaceId],
  detail: (id) => ['agency-notes', 'detail', id],
  // signed URL for an uploaded image/video; outside the notes root so a note
  // edit doesn't re-sign URLs that are still valid
  mediaUrl: (path) => ['note-media-url', path],
}

export const noteTagKeys = {
  all: ['note-tags'],
  list: (workspaceId) => ['note-tags', 'list', workspaceId],
}

export const noteShareKeys = {
  all: ['note-shares'],
  list: (noteId) => ['note-shares', 'list', noteId],
}

// ─── Documents ────────────────────────────────────────────────────────────────

export const documentKeys = {
  all: ['documents'],
  list: (filters) => ['documents', 'list', filters ?? {}],
  detail: (id) => ['documents', 'detail', id],
  collections: (clientId) => ['documents', 'collections', clientId],
  allCollections: () => ['documents', 'collections', 'all'],
  // Outside the 'documents' root: broad document invalidations shouldn't
  // re-sign URLs that are still valid.
  signedUrl: (storagePath) => ['document-signed-url', storagePath],
}

// ─── Team ─────────────────────────────────────────────────────────────────────

export const teamKeys = {
  all: ['team'],
  members: (workspaceId) => ['team', 'members', workspaceId],
  invites: (workspaceId) => ['team', 'invites', workspaceId],
  removed: (workspaceId) => ['team', 'removed', workspaceId],
  myRecord: (workspaceId, userId) => ['team', 'my-record', workspaceId, userId],
  owner: (workspaceId) => ['team', 'owner', workspaceId],
  invite: (token) => ['team', 'invite', token],
}

export const jobRoleKeys = {
  all: ['job-roles'],
  list: (workspaceId) => ['job-roles', 'list', workspaceId],
  byMember: (workspaceId) => ['job-roles', 'by-member', workspaceId],
}

// ─── Collaboration ────────────────────────────────────────────────────────────

export const commentKeys = {
  all: ['comments'],
  thread: (entityType, entityId) => ['comments', entityType, entityId],
  count: (entityType, entityId) => ['comments', 'count', entityType, entityId],
}

// per person: a notification belongs to its recipient
export const notificationKeys = {
  all: ['notifications'],
  count: (userId) => ['notifications', 'count', userId],
  list: (userId) => ['notifications', 'list', userId],
}

// per person: channel membership and unread state are the viewer's own
export const chatKeys = {
  all: ['chat'],
  channels: (userId) => ['chat', 'channels', userId],
  messages: (channelId) => ['chat', 'messages', channelId],
}

// ─── Agency ───────────────────────────────────────────────────────────────────

// The agency's own plan row (flags, limits, branding, invoice numbering).
export const subscriptionKeys = {
  all: ['subscription'],
  detail: (workspaceId) => ['subscription', workspaceId],
}

export const agencyKeys = {
  all: ['agency'],
  settings: (workspaceId) => ['agency', 'settings', workspaceId],
  profile: (userId) => ['agency', 'profile', userId],
}

export const feedbackKeys = {
  all: ['feedback'],
  list: (workspaceId) => ['feedback', 'list', workspaceId],
}

export const appConfigKeys = {
  all: ['app-config'],
  maintenance: () => ['app-config', 'maintenance_mode'],
}

export const reportKeys = {
  all: ['reports'],
  client: (clientId) => ['reports', 'data', clientId],
}
