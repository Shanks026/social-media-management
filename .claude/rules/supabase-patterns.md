# Supabase Patterns

How to interact with Supabase in Tercero.

## Client Import

```js
import { supabase } from '@/lib/supabase'
```

Never instantiate a new Supabase client inline. Always use this shared singleton.

## Auth

```js
import { useAuth } from '@/context/AuthContext'
const { user, session } = useAuth()
```

Auth state is managed by `AuthContext` via `supabase.auth.onAuthStateChange`. Do not call `supabase.auth.getUser()` or `supabase.auth.getSession()` directly in components — use the context.

## Row-Level Security

All tables use RLS. Queries are automatically scoped via the Supabase anon key + user session. Still explicitly filter by `user_id` where appropriate as a secondary guard:
```js
.eq('user_id', user.id)
```

## Joins and Relationships

Use Supabase's PostgREST join syntax for related data:
```js
.select(`
  id,
  post_versions!fk_current_version (
    id, title, status, version_number
  )
`)
```

The `!fk_constraint_name` syntax selects a specific FK when multiple FKs reference the same table.

## RPC Calls

```js
const { data, error } = await supabase.rpc('function_name', {
  p_param1: value1,
  p_param2: value2,
})
if (error) throw error
```

Use RPCs for operations that need atomicity or complex SQL that PostgREST can't express simply.

## Storage

Bucket: `post-media`

```js
// Upload
const { data, error } = await supabase.storage
  .from('post-media')
  .upload(path, file)

// Get public URL
const { data } = supabase.storage.from('post-media').getPublicUrl(path)

// Delete (requires storage path, not public URL)
await supabase.storage.from('post-media').remove([storagePath])
```

Always extract the storage path from a public URL before deleting:
```js
const path = url.split('/public/post-media/')[1]
```

## Edge Functions

Deployed under `supabase/functions/`. Call them via:
```js
const { data, error } = await supabase.functions.invoke('function-name', {
  body: { key: value },
})
```

Current functions: `send-approval-email`, `send-client-welcome`, `send-password-update-email`.

## Views

`view_client_profitability` — read-only aggregated view for client financial metrics. Query it like a table:
```js
supabase.from('view_client_profitability').select('*').eq('client_id', id).single()
```
