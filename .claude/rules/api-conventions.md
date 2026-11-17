# API Layer Conventions

Rules for all code in `src/api/`, and for how the rest of the app uses it. This follows ADR 0007: `src/api` owns every query, mutation and cache key; components only call its hooks.

## The shape of a module

Each domain module (`campaigns.js` is the reference) has four parts, in this order:

1. **A query-key factory**, exported: `campaignKeys.all`, `.list(workspaceId, filters)`, `.detail(id)` and any other keys the module needs.
2. **Read hooks** (`useXxxList()`, `useXxxById(id)`): `useQuery` over a `queryFn` that throws on error.
3. **Mutations as plain exported async functions** (`createXxx(payload)`, `updateXxx({ id, ...fields })`, `deleteXxx(id)`). These are the unit-test surface and can be called outside React (realtime handlers, scripts).
4. **A hook per mutation** (`useCreateXxx()`) that wraps the plain function in `useMutation` and **owns the `onSuccess` invalidation**.

```js
export const campaignKeys = {
  all: ['campaigns'],
  list: (workspaceId, filters = {}) => ['campaigns', 'list', workspaceId, { clientId: filters.clientId ?? null }],
  detail: (id) => ['campaigns', 'detail', id],
}

export async function deleteCampaign(id) {
  const { error } = await supabase.from('campaigns').delete().eq('id', id)
  if (error) throw error
}

export function useDeleteCampaign() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteCampaign,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: campaignKeys.all }),
  })
}
```

## What callers may do

Components, pages and `src/hooks` **never**:

- call `useQuery` or `useMutation` directly,
- call `invalidateQueries` themselves (the mutation hook already did),
- import `@/lib/supabase`.

An ESLint `no-restricted-imports` rule reports the first and third. It is a **warning** while the existing call sites are migrated, and becomes an error in the contract ticket (#158). New code must not add to the warnings.

If a screen needs data or a change that no hook provides, add a function and a hook to the owning `src/api` module.

## Query keys

- Always build keys with the module's factory, in hooks and in every `invalidateQueries`. No inline arrays.
- Workspace-scoped keys take `workspaceUserId` (from `useAuth()`), never `user.id`, so the Owner and invited Members share cache entries.
- Cross-domain invalidation imports the other module's key factory (creating an invoice invalidates `campaignKeys` analytics and invoices). Until a module has a factory, spell its key once, in the module that needs it, and move it when the factory lands.
- Realtime subscriptions are **invalidators only**: subscribe, then `invalidateQueries` with a factory key. Never write payloads into the cache.

## Error handling

```js
const { data, error } = await supabase.from('table').select('*')
if (error) throw error  // always throw, never swallow
```

Never return `null` to hide an error. Let it reach React Query's `error` state or the mutation caller.

## Enabled guards

Always guard queries that depend on IDs:

```js
enabled: !!clientId                    // single dependency
enabled: !!workspaceUserId             // workspace scope
enabled: !!clientId && !!dateRange     // multiple dependencies
```

## Workspace and auth

Use `useAuth()` only inside hooks. Plain async mutation functions that need the workspace call `resolveWorkspace()` (`src/lib/workspace.js`), and use `auth.getUser()` for `created_by`. Do not call hooks inside them.

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

Test the plain functions without React: stub `@/lib/supabase` and `@/lib/workspace`, call the function, and assert on the query it built (see `src/tests/campaigns/campaignsApi.test.js`). Test key factories for shape and workspace scoping.
