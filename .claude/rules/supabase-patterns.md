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

## Migrations

`supabase/migrations/` rebuilds the whole schema from nothing (ADR 0005, #90). It
starts with a squashed baseline taken from production on 2026-11-08:

- `20261108120000_baseline.sql` — `supabase db dump` of the `public` schema
  (tables, functions, policies, grants, Realtime publication membership);
- `20261108120001_baseline_platform_objects.sql` — what that dump cannot see:
  triggers on `auth.users` / `storage.objects`, `storage.objects` policies,
  pg_cron jobs, and the EXECUTE revokes production applied (pg_dump records
  grants, not their absence).

Storage buckets are declared in `config.toml` (`[storage.buckets.*]`). Vault
secrets (`service_role_key`, `project_url`) are per environment and never live
in a migration. The 244 pre-baseline migrations are in git history only.

The folder must mirror the remote history table exactly; the CLI pairs the two
by the numeric version prefix, not by name.

**Write and test locally, then push:**

```bash
npx supabase migration new <name>      # write the SQL
npx supabase db reset                  # rebuild locally from the folder; must pass
npx supabase db diff --remote --schema public   # optional: compare with production
npx supabase db push                   # apply to production
npx supabase migration list --remote   # every row should have both columns filled
```

Applying SQL through the Supabase MCP or the dashboard SQL editor records it
remotely but **creates no local file**. Hand-writing one afterwards with an
invented timestamp does not match the recorded version, so the CLI would treat
it as pending and re-apply it. If you do apply remotely, sync with
`npx supabase migration fetch --remote`. On Windows, that rewrites every file
with LF line endings, so restore the unchanged ones
(`git checkout -- supabase/migrations`) and keep only the new file.

Never pass `-f` to `db diff` just to see output: `-f` writes a new migration
file. Repairs and pushes to production need `--yes` in agent runs, and the
CLI asks the user first. `--linked` is deprecated; use `--remote`.
