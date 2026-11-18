// Query-key factories for the sales domain (ADR 0007): Proposals, Prospects
// and Outreach (prospect activities).
//
// They live in this leaf module, not in proposals.js / prospects.js, because
// those two invalidate each other (sending a Proposal advances its Prospect;
// deleting a Prospect archives its Proposals). Importing each other's module
// for a key would make a cycle. Each domain module re-exports its own factory,
// so callers still import `proposalKeys` from '@/api/proposals', and so on.

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
