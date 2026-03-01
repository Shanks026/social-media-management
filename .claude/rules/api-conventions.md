# API Layer Conventions

Rules for all code in `src/api/`.

## Read vs. Mutation Pattern

| Operation | Pattern | Export type |
|-----------|---------|-------------|
| Fetch list | `useXxxList()` React Query hook | Named export |
| Fetch single | `useXxxById(id)` React Query hook | Named export |
| Create / Update / Delete | `createXxx()`, `updateXxx()`, `deleteXxx()` | Plain async function |

Never wrap mutations in React Query hooks at the API layer. Callers use `useMutation` from `@tanstack/react-query` if they need loading/error state.

## Query Key Structure

```js
// List: ['domain-list', userId]
queryKey: ['clients-list', user?.id]

// Single: ['domain-detail', entityId]
queryKey: ['client-metrics', clientId]

// Compound: ['domain-scope', scopeId]
queryKey: ['posts-calendar', { clientId, startDate, endDate }]
```

Keep keys consistent across hooks and `invalidateQueries` calls. If a mutation affects a list, invalidate the list key.

## Error Handling

```js
const { data, error } = await supabase.from('table').select('*')
if (error) throw error  // always throw, never swallow
```

Never return `null` to hide an error — let it propagate to React Query's `error` state or the mutation caller.

## Enabled Guards

Always guard queries that depend on IDs:
```js
enabled: !!clientId          // single dependency
enabled: !!user?.id          // optional chaining is fine
enabled: !!clientId && !!dateRange  // multiple dependencies
```

## Supabase Auth in API Hooks

Use `useAuth()` only inside hooks (component context). Plain async mutation functions receive user ID as a parameter if needed — do not call hooks inside them.

```js
// Correct — hook uses context
export function useClients() {
  const { user } = useAuth()
  ...
}

// Correct — mutation receives userId
export async function createClient(userId, data) { ... }
```

## Data Normalization

Map raw Supabase rows to clean shapes before returning from hooks:
```js
return data.map((post) => ({
  ...post.post_versions,
  id: post.id,
  version_id: post.post_versions?.id,
}))
```

Consumers should not need to know about Supabase join aliases like `post_versions!fk_current_version`.
