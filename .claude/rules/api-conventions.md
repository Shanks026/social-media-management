# API Layer Conventions

Rules for all code in `src/api/`, and for how the rest of the app uses it. This follows ADR 0007: `src/api` owns every query, mutation and cache key; components only call its hooks.

## The shape of a module

Each domain module (`campaigns.js`, `posts.js`) has these parts:

1. **Its key factory, re-exported** from `queryKeys.js` (below): `export { campaignKeys }`.
2. **Read hooks** (`useXxxList()`, `useXxxById(id)`): `useQuery` over a `queryFn` that throws on error.
3. **Mutations as plain exported async functions** (`createXxx(payload)`, `updateXxx({ id, ...fields })`, `deleteXxx(id)`). These are the unit-test surface and can be called outside React (realtime handlers, scripts).
4. **A hook per mutation** (`useCreateXxx(options)`), built with `useApiMutation`, which **owns the invalidation**.

```js
import { useApiMutation } from '@/api/mutation'
import { campaignKeys, postKeys } from '@/api/queryKeys'

export { campaignKeys }

export async function deleteCampaign(id) {
  const { error } = await supabase.from('campaigns').delete().eq('id', id)
  if (error) throw error
}

export function useDeleteCampaign(options) {
  return useApiMutation(deleteCampaign, (queryClient) => {
    queryClient.invalidateQueries({ queryKey: campaignKeys.all })
    queryClient.invalidateQueries({ queryKey: postKeys.all })
  }, options)
}
```

## `useApiMutation(fn, invalidate, options)`

`src/api/mutation.js`. It runs `invalidate(queryClient, data, variables)` first, then the caller's `options` callbacks, so callers pass only UI work: toasts, closing a dialog, navigating.

```js
const remove = useDeleteCampaign({ onSuccess: () => toast.success('Campaign deleted') })
remove.mutate(campaign.id)
```

- Callers pass **variables**, not closures. A hook whose function needs several values takes an object (`{ versionId, notes }`).
- `invalidateOn: 'settled'` refreshes even when the mutation throws. Use it for multi-step writes where an early step can land before a later one fails (status changed, email failed).
- Optimistic updates (kanban drops) live in the hook too: see `useUpdateTaskStatus` and `useSetMeetingCompleted`. They patch every cached list with `setQueriesData` and roll back on error.

## Query keys

Every factory lives in **`src/api/queryKeys.js`**, a leaf module with no imports. Domains refresh each other: a Deliverable change refreshes Campaigns, Clients and Tasks. Factories imported between domain modules would make import cycles.

- **One root per domain.** Every key a domain caches starts with its root (`postKeys.all = ['posts']`), so `xxxKeys.all` refreshes every view of it. Prefer invalidating the root over listing narrow keys; a missed key is a stale screen. A test checks every factory keeps to its root.
- Workspace-scoped keys take `workspaceUserId` (from `useAuth()`), never `user.id`, so the Owner and invited Members share cache entries. Keys that are genuinely per person (notifications, chat, "my submissions", "my tasks") take the user's id and say so in `queryKeys.js`.
- Build keys with the factory, in hooks and in every `invalidateQueries`. A new key goes into `queryKeys.js` under its domain's root.
- Realtime subscriptions are **invalidators only**: subscribe, then `invalidateQueries` with a factory key. Never write payloads into the cache.

## What callers may do

Components, pages, `src/hooks` and `App.jsx` call `src/api` hooks and plain functions. A lint rule (`no-restricted-imports`, **error**) rejects their importing `useQuery`, `useMutation`, `useQueryClient` or `@/lib/supabase`.

- If a screen needs data or a change that no hook provides, add a function and a hook to the owning `src/api` module.
- A plain function called from a handler (a reaction, an inline edit) is fine. When its change must show before realtime arrives, the module offers a stable refresh hook (`useRefreshChannel`, `useRefreshCommentThread`).
- Sign-out and account switch clear the cache through `useClearSessionCache()` in `auth.js`.

## Error handling

```js
const { data, error } = await supabase.from('table').select('*')
if (error) throw error  // always throw, never swallow
```

Never return `null` to hide an error. Let it reach React Query's `error` state or the mutation caller. Best-effort side effects (welcome emails, storage cleanup after the row is gone) log and carry on, and say so in a comment.

## Enabled guards

Always guard queries that depend on IDs:

```js
enabled: !!clientId                    // single dependency
enabled: !!workspaceUserId             // workspace scope
enabled: !!clientId && !!dateRange     // multiple dependencies
```

## Workspace and auth

Use `useAuth()` only inside hooks. Plain async mutation functions that need the workspace call `resolveWorkspace()` (`src/lib/workspace.js`), and use `auth.getUser()` for `created_by`. Writes to the agency's own row (`agency_subscriptions`) filter by the resolved `workspaceUserId`, never the caller's id.

## Data normalization

Map raw Supabase rows to clean shapes before returning from hooks, so consumers never see join aliases like `post_versions!fk_current_version`:

```js
return data.map((post) => ({
  ...post.post_versions,
  id: post.id,
  version_id: post.post_versions?.id,
}))
```

## Tests

Test the plain functions without React. `src/tests/api/supabaseStub.js` records every call and answers per table and operation. `src/tests/api/mutationHarness.jsx` renders a mutation hook and reports which keys it invalidated. `src/tests/finance/financeApi.test.js` uses both.
