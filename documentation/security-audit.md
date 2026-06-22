# Security Audit — June 2026

Diagnostic run across the Supabase database (RLS, policies, functions, advisors) and the client codebase. Findings are ordered by severity. **Three CRITICAL issues need action immediately.**

> Sourced from: Supabase security advisors, direct `pg_policies`/grant inspection, and a code scan. Remediation links point to Supabase's linter docs.

---

## ✅ Remediation status — applied 22 Jun 2026

| ID | Issue | Status |
|---|---|---|
| C1 | Service-role key in repo | **Partially fixed** — `test/` dir deleted, `.gitignore` hardened. ⚠️ **You must still: (1) rotate the `service_role` key in the Supabase dashboard, (2) scrub it from git history.** The committed key stays compromised until rotated. |
| C2 | `clients` cross-tenant RLS | **Fixed** — dropped the 4 legacy permissive policies; only `clients_workspace_scoped` + `clients_enforce_limit` remain. |
| C3 | `share_tokens` RLS disabled | **Fixed** — RLS enabled, all anon grants revoked, workspace-scoped `authenticated` policy added. Public review still works via SECURITY DEFINER RPCs. |
| H1 | SECURITY DEFINER views | **Fixed** — all 4 views set to `security_invoker = on`. |
| H2 | Public bucket listing | **Fixed** — `post_media_read` & `proposal_files_public_read` SELECT policies restricted from `public` to `authenticated` (public URL rendering unaffected). |
| M1 | Anon-executable functions | **Fixed** — `EXECUTE` revoked from `PUBLIC`/anon on 15 internal functions (+3 trigger fns), granted to `authenticated`. Anon retains only the public token/signup RPCs. |
| M2 | Mutable function search_path | **Fixed** — `search_path = public, pg_temp` pinned on all SECURITY DEFINER functions. |
| M3 | Policies scoped to `public` role | **Accepted (not changed)** — safe in practice (gated by `auth.uid()`/`get_my_agency_user_id()` which are null for anon). Bulk role-rescoping across 29 tables deferred as risky for marginal benefit. |
| L1 | Leaked-password protection off | ⚠️ **Manual** — enable in Supabase Dashboard → Auth → Password settings. |
| L2 | `client_users` RLS, no policy | **Left as-is** — currently deny-all (not a leak); confirm it's intentional. |
| L3 | shadcn chart `dangerouslySetInnerHTML` | **Left as-is** — controlled CSS, not user input. |

**Remaining manual actions (cannot be done via migration):**
1. **Rotate the `service_role` key** (Dashboard → Settings → API) — highest priority.
2. **Purge `test/automated/.env.test` from git history** (`git filter-repo`/BFG), then force-push.
3. **Enable leaked-password protection** (Auth settings).
4. Re-run the Supabase security advisor after rotating to confirm a clean bill.

Verified post-migration via direct catalog queries: `share_tokens` RLS on + zero anon grants; `clients` down to 2 correct policies; 4 views `security_invoker`; storage broad-read policies now `authenticated`; 15+3 functions no longer anon-executable; 0 SECURITY DEFINER functions without a pinned `search_path`.

---

## 🔴 CRITICAL

### C1. Service-role key committed to the git repository
**Where:** `test/automated/.env.test` (tracked in git — confirmed via `git ls-files`)

The file contains a live **`SUPABASE_SERVICE_KEY`** (a `service_role` JWT, valid to 2036) plus real test-account emails and passwords. The service-role key **bypasses every RLS policy** — anyone who can read this file (anyone with repo access, any fork/clone, CI logs, or the public if the repo is ever made public) has full read/write/delete on the entire production database.

The file even says "Never commit .env.test to version control" — but it is committed. `.gitignore` only excludes `.env` and `.env.local`, not `.env.test`.

**Remediation (do in this order, today):**
1. **Rotate the key now** — Supabase Dashboard → Project Settings → API → roll the `service_role` key. The committed key is permanently compromised; removing the file is not enough.
2. Rotate/replace the two test-account passwords (currently `qwer1234`, reused).
3. `git rm --cached test/automated/.env.test`, add `.env.test` (and `*.env.test`) to `.gitignore`.
4. Purge it from git history (`git filter-repo` or BFG) since it lives in past commits.
5. Confirm no service-role key is used anywhere in client-side `src/` (scan was clean — keep it that way; service keys belong only in server/edge contexts).

---

### C2. `clients` table — cross-tenant access via legacy RLS policies
**Where:** `public.clients` (6 policies; the workspace-scoped one is undermined by legacy permissive ones)

PostgreSQL combines multiple *permissive* policies with **OR**, so the loosest policy wins. Alongside the correct `clients_workspace_scoped` (`user_id = get_my_agency_user_id()`), these legacy policies exist:

| Policy | Cmd | Rule | Effect |
|---|---|---|---|
| `internal users can view clients` | SELECT | `USING (true)` (authenticated) | **Any logged-in user can read every agency's clients** |
| `clients_update_internal` | UPDATE | `USING (auth.uid() IS NOT NULL)` | Any logged-in user can edit any client |
| `clients_delete_internal` | DELETE | `USING (auth.uid() IS NOT NULL)` | Any logged-in user can delete any client |
| `internal users can create clients` | INSERT | `WITH CHECK (true)` | Bypasses workspace scoping + the client-count limit |

This breaks the core multi-tenant guarantee the app relies on (`workspaceUserId` scoping). A signed-up user of agency A can read/modify/delete agency B's client records by calling the API directly with the anon key + their JWT.

**Remediation:** Drop the four legacy policies; keep only `clients_workspace_scoped` (ALL) and `clients_enforce_limit` (INSERT). Then re-test client CRUD.
```sql
DROP POLICY "internal users can view clients"   ON public.clients;
DROP POLICY "internal users can create clients" ON public.clients;
DROP POLICY "clients_update_internal"           ON public.clients;
DROP POLICY "clients_delete_internal"           ON public.clients;
```
> Audit `posts` (4 policies) and `post_versions` (3) the same way for stray permissive policies. Most other tables have a single policy and look clean.

---

### C3. `share_tokens` — RLS disabled, full anonymous CRUD
**Where:** `public.share_tokens` (RLS **disabled**, 0 policies) — advisor lints `0013_rls_disabled_in_public` (ERROR) + `0023_sensitive_columns_exposed` (ERROR)

The `anon` role holds **SELECT, INSERT, UPDATE, DELETE, TRUNCATE**. Columns: `id, post_version_id, token, expires_at, created_at, is_active`. With the public anon key alone (no login), an attacker can:
- `SELECT *` → harvest **every** review token, then access/approve/reject every client's review content via `update_post_status_by_token` / `get_post_by_token`.
- `UPDATE`/`INSERT` → forge or re-point tokens.
- `DELETE`/`TRUNCATE` → wipe all review links (DoS).

**Remediation:** Enable RLS and remove the broad anon grants. Public review must go **only** through the `SECURITY DEFINER` token RPCs, never direct table access.
```sql
ALTER TABLE public.share_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.share_tokens FROM anon;
-- (authenticated access only if the app reads tokens directly; otherwise revoke too
--  and let SECURITY DEFINER RPCs handle all access)
```
Docs: https://supabase.com/docs/guides/database/database-linter?lint=0013_rls_disabled_in_public

---

## 🟠 HIGH

### H1. SECURITY DEFINER views bypass RLS
**Where:** `view_monthly_burn_rate`, `subscription_usage_stats`, `client_pipeline_analytics`, `view_finance_overview` — advisor `0010_security_definer_view` (ERROR)

These views run with the *creator's* permissions, ignoring the querying user's RLS. If exposed via the API and queried by a user, they can return data across tenants. Confirm each view filters by `get_my_agency_user_id()` internally, or recreate them as `security_invoker = true` (Postgres 15+).
Docs: https://supabase.com/docs/guides/database/database-linter?lint=0010_security_definer_view

### H2. Public storage buckets allow listing
**Where:** `post-media`, `proposal-files` — advisor `0025_public_bucket_allows_listing`

A broad `SELECT` policy on `storage.objects` lets clients **list all files** in these public buckets, not just access a known URL — enabling enumeration of other clients' media/proposal files. Scope the storage SELECT policy to the owner's path prefix (`{user_id}/...`), as the private `client-documents` bucket already does.

---

## 🟡 MEDIUM

### M1. `SECURITY DEFINER` functions executable by anon & authenticated (29 functions)
Advisors `0028`/`0029`. Some are intentionally public (token RPCs: `get_*_by_token`, `update_post_status_by_token`, `accept/decline/mark_proposal_*`). But several look like they should **not** be anon-callable — e.g. `admin_get_clients`, `admin_get_client_onboarding`, `admin_link_prospect_on_signup`, `set_agency_plan`, `generate_invoice_from_template`, `create_new_post_with_version`. Review each: `REVOKE EXECUTE ... FROM anon` (and `authenticated` where it's admin/internal-only).

### M2. Function `search_path` not set (42 SECURITY DEFINER functions)
Advisor `0011_function_search_path_mutable`. Without a pinned `search_path`, a SECURITY DEFINER function can be tricked into resolving objects from an attacker-controlled schema (privilege escalation). Add `SET search_path = public, pg_temp` (or `''`) to every function.
```sql
ALTER FUNCTION public.get_my_agency_user_id() SET search_path = public, pg_temp;
-- repeat for the rest
```

### M3. Policies grant the `anon` role access on 29 tables
Advisor `0012`. Most are *safe* — the workspace policies target `{public}` (which includes `anon`) but gate on `auth.uid()`/`get_my_agency_user_id()`, which are null for anon → effectively deny. Still, best practice is to scope these policies to the `authenticated` role explicitly so the intent is unambiguous and anon is never in scope.

---

## 🟢 LOW / INFO

- **L1. Leaked-password protection disabled** (advisor) — enable in Auth settings (checks passwords against HaveIBeenPwned). Also raise the weak/reused test password.
- **L2. `client_users` — RLS enabled, no policies** (INFO) — currently deny-all (not a leak), but likely a functional gap if the app expects to read it. Add a scoped policy or confirm it's intentionally locked.
- **L3. `dangerouslySetInnerHTML`** in `src/components/ui/chart.jsx` — this is stock shadcn chart CSS injection from a controlled config, not user input. Low risk; leave as-is but don't extend the pattern to user data.
- **Edge-function JWT:** `supabase/config.toml` sets no explicit `verify_jwt` flags — verify each function's auth expectation matches its deployment (per CLAUDE.md, several verify the JWT manually inside).

---

## Good news (verified clean)
- No hardcoded API keys, secrets, or `service_role` references in `src/` (only the public anon key + URL via env, which is correct).
- `.env` / `.env.local` are gitignored.
- 28 of 30 public tables have RLS enabled; most have exactly one, correctly-scoped policy.
- No `eval`, `new Function`, `document.write`, or user-driven `innerHTML` in the codebase.

---

## Suggested order of action
1. **C1** rotate service key + scrub history (minutes; highest blast radius).
2. **C2 + C3** RLS migrations (drop legacy `clients` policies; lock down `share_tokens`).
3. **H1 + H2** views & bucket listing.
4. **M1–M3** function execute grants, search_path, role scoping.
5. **L1–L3** auth hardening + cleanup.
