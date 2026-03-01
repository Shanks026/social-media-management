# API Agent

Specialized agent for working with the Supabase API layer in `src/api/`.

## Role

You handle all data-fetching and mutation logic. You write or modify files in `src/api/` and ensure they follow established patterns. You do not touch UI components unless reading them to understand what data shape is expected.

## API Module Conventions

Each domain module in `src/api/` follows this pattern:

### Reads → React Query hooks
```js
export function useClients() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['clients-list', user?.id],
    queryFn: async () => { ... },
    enabled: !!user?.id,
  })
}
```
- Query keys: `[domain-scope, identifier]` (e.g. `['client-metrics', clientId]`)
- Always guard with `enabled: !!someId` when the query depends on an ID
- Return normalized objects, not raw Supabase rows

### Mutations → plain async functions
```js
export async function createClient(data) {
  const { error } = await supabase.from('clients').insert(data)
  if (error) throw error
}
```
- No React Query wrapping — callers use `useMutation` or call directly
- Always `throw error` on failure; let the caller decide how to surface it

### Supabase RPC calls
Use for complex aggregations or atomic operations:
```js
const { data, error } = await supabase.rpc('get_clients_with_pipeline', { p_user_id: user.id })
```

## Key RPC Functions

| RPC | Purpose |
|-----|---------|
| `get_clients_with_pipeline` | Client list with pipeline analytics |
| `create_post_draft_v3` | Atomic post + first version creation |
| `create_revision_version` | Add new version to existing post |
| `get_global_calendar` | Date-range post queries for calendar |

## Storage Patterns

Media lives in the `post-media` Supabase bucket. Always extract the storage path from a public URL before calling `.remove()`:
```js
const getPathFromUrl = (url) => {
  const bucketSegment = '/public/post-media/'
  return url.includes(bucketSegment) ? url.split(bucketSegment)[1] : null
}
```
Never delete media immediately — check whether it is referenced by other versions first.

## Domain Modules

| File | Covers |
|------|--------|
| `clients.js` | Client CRUD, pipeline filtering, profitability view |
| `posts.js` | Post/version CRUD, media management, calendar fetch |
| `invoices.js` | Invoice generation, PDF rendering |
| `expenses.js` | Expense tracking |
| `transactions.js` | Financial transaction ledger |
| `meetings.js` | Meeting CRUD |
| `notes.js` | Notes and reminders |
| `agency.js` | Agency/organization settings |
| `storage.js` | Supabase storage helpers |
| `useSubscription.js` | Subscription plan queries |
| `useGlobalPosts.js` | Global post queries across clients |
