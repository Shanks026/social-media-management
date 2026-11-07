# Research: dev-database options (Supabase branch vs local stack)

Ticket: #70 (E1), part of map #69. Feeds the decision in #71. This document gives facts and trade-offs only. It does **not** make the decision.

Researched 2026-11-07 against Supabase and Resend docs (URLs are cited inline) and this repo at `main` (`7c2a49e`). Nothing was run against production, and `supabase link` was not run.

---

## TL;DR comparison

| | **Supabase branch** (hosted) | **Local stack** (`supabase start`) |
|---|---|---|
| Cost | Needs **Pro plan or above** ($25/mo). Branch compute is **$0.01344/h** (Micro), about **$9.68/mo** if it runs 24/7, plus disk, egress and storage. Not covered by the Spend Cap or compute credits. "Include data" needs the **PITR add-on** ($100/mo per 7 days of retention). | Free. Needs Docker Desktop on Windows, and disk/RAM for about 10 containers. |
| Needs a schema baseline? | **Yes, it's a hard blocker.** Branches replay migrations, either from git or from production's migration history. Either way, the first migration (`20260215144136`) references `clients`, which nothing creates. | **Yes, it's a hard blocker.** `supabase start` / `db reset` replay `supabase/migrations/` and fail the same way. |
| Auth | Real hosted GoTrue. Auth settings are copied from production, but SMTP and OAuth secrets become placeholders. Users are not copied. The default SMTP only sends to org team members, at 2/hour. | Local GoTrue. Every auth email goes to the local **Mailpit** inbox (`:54324`), never to real people. |
| Storage buckets | Bucket settings are copied, objects are not. The `[storage]` config applies on GitHub-integrated branches. | Buckets are created from `[storage.buckets.*]` in `config.toml` (none declared today). Objects come from `objects_path`. |
| Edge functions | The base project's deployed functions are copied to new branches. The GitHub flow deploys `[functions.*]` from `config.toml`. Secrets are per branch. | Served by the local edge runtime. Secrets come from `supabase/functions/.env`. |
| pg_cron / pg_net | Jobs in migrations replay **active**. They currently hard-code the production URL. | Same replay, same hard-coded production URL problem. |
| Vault | Empty on a branch unless you seed it. Production's `service_role_key` is not there. | Empty unless seeded (`seed.sql` with `vault.create_secret(...)`). |
| Realtime | Hosted Realtime, settings copied. Publication membership comes from migrations. | Local Realtime container. Publication membership comes from migrations. |
| Seed data | `seed.sql` (or `[db.seed] sql_paths`) on GitHub branches. On persistent branches use `[remotes.<name>.db.seed]`. Optionally a full production copy via "Include data" (PITR). | `seed.sql` / `[db.seed] sql_paths` runs after migrations on first `start` and on every `db reset`. |
| Dev-email safety (Supabase side) | Partial. Auth mail is restricted by default SMTP, but app mail goes through Resend with whatever key the branch has. | Strong for auth mail (Mailpit). App mail still goes through Resend if `RESEND_API_KEY` is set locally. |
| Fidelity to prod | High. Same platform, same region options, real Storage/CDN URLs. | Good but not identical. Version drift in the CLI images, and some hosted-only behaviour. |
| Isolation for other people / CI | Shareable URL. Usable from preview deploys. | One machine only. |

**The facts favour the local stack as the first step.** It's free, sends auth mail to Mailpit by design, and doesn't depend on the plan. You need the same baseline work either way, and a branch can be added later on top of that baseline. The main reasons to prefer a branch are needing a shareable hosted environment (preview deploys, testers) or a production-shaped data copy. That is for #71 to weigh.

---

## 0. Work both options need first (the shared prerequisite)

### 0.1 A schema baseline

Both options build the database by **replaying migrations**:

- **Local:** "`supabase db reset` rebuilds the local database by applying the current migrations, then runs `supabase/seed.sql`" ([local dev overview](https://supabase.com/docs/guides/local-development/overview)).
- **GitHub-integrated branch:** applies the files in `supabase/migrations/`. "A version in the branch's history with no matching file fails the step", and a failed migrate step skips seeding and later steps ([GitHub integration](https://supabase.com/docs/guides/deployment/branching/github-integration), [branching overview](https://supabase.com/docs/guides/deployment/branching)).
- **Dashboard branch (no git):** "replays your base project's migration history as migrations". It falls back to a schema dump **only if the project has no migration history** ([dashboard branching](https://supabase.com/docs/guides/deployment/branching/dashboard)). Production *has* a history starting at `20260215144136`, so a dashboard branch would replay that incomplete history. The docs also say: "If migrations have run on main, new branches are built from existing migrations instead of a full schema dump." **So dashboard branching does not get around the baseline problem.** (This is an inference from the docs. It hasn't been tested, because creating a branch would touch the production project.)

The repo's first migration, `20260215144136_cleanup_redundant_client_indexes.sql`, already assumes `public.clients` exists. Nothing creates `clients`, `posts`, `post_versions`, `agency_subscriptions`, `expenses`, `transactions` or `share_tokens`, so every replay fails at step one (see `documentation/audit-2026-11/DATABASE-AUDIT.md` §1–2).

**How to build a baseline** ([`supabase db dump`](https://supabase.com/docs/reference/cli/supabase-db-dump)):

- `supabase db dump` runs `pg_dump` in a container, so it needs Docker. It excludes Supabase-managed schemas (`auth`, `storage`, extension schemas) and by default contains "no data or custom roles". Flags include `--linked` or `--db-url`, `-s/--schema`, `--data-only`, `--role-only`, `-f` and `--dry-run`.
- It needs either `supabase link` (not yet done; it also fixes the stale `project_id` concern) or `--db-url` with the production connection string. Both are **read-only against production**, but they are still production access. That step belongs to the human or the implementation ticket, not this research.
- Restore caveat from the same page: before restoring into a fresh project, run `ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;`.
- Alternative: `supabase db pull --remote` generates a migration from the remote schema. With the default `pg-delta` engine it "includes auth triggers and RLS policies on `auth` tables, plus RLS policies on `storage` tables". With the legacy `migra` engine you must pull `--schema auth` and `--schema storage` separately ([local dev overview](https://supabase.com/docs/guides/local-development/overview), [diff engines](https://supabase.com/docs/guides/local-development/diff-engines)).

**What a plain `db dump --schema public` would miss for THIS repo** (from a repo grep):

- **Triggers on `storage.objects`.** There are about 30 references across migrations, including the storage-accounting triggers (`20260215145325_…`, `20261107143000_…`) and bucket-specific policies. These live in the `storage` schema, which `db dump` excludes.
- **Triggers on `auth.users`.** About 4 references, e.g. `20260302183307_add_free_tier_trigger.sql` and `20260910083714_…`.
- **Bucket rows** (`storage.buckets`). Only `note-media` is created in a migration (`20260629045553_note_media_bucket.sql`). `post-media`, `client-documents` and `proposal-files` were made by hand.
- **pg_cron jobs** (rows in `cron.job`) and **Vault secrets**. These are data, not schema, in managed schemas.
- **Realtime publication membership** (`ALTER PUBLICATION supabase_realtime ADD TABLE …`, e.g. `notifications`, `comments`, `chat_*`). Check whether the dump includes it, or keep those statements in a later migration.

So a baseline is "public-schema dump **plus** a hand-checked migration for the auth/storage triggers, buckets and publication". The `db pull` with pg-delta route may cover more of this automatically. Either way, verify the result by running `supabase db reset` locally and diffing against production.

**Reconciling the history.** After the baseline exists, the 243 existing migration files can't simply stay in the folder ahead of it, and the remote history table must keep matching the folder (see `.claude/rules/supabase-patterns.md`). The usual approach is to squash everything up to "now" into the baseline and mark it applied remotely with `supabase migration repair`. Squashing vs keeping the history is a sub-decision for #71 or the implementation ticket.

### 0.2 Production URLs and keys hard-coded in migrations (risk for both options)

Five migrations hard-code `https://ockvcyevnozuczzngrwg.supabase.co/functions/v1/...` (the production project):

| Migration | What it does |
|---|---|
| `20260228163108_trigger_client_welcome_email_on_insert.sql` | `AFTER INSERT ON clients` → `supabase_functions.http_request` to **prod** `send-client-welcome`, with a literal (now redacted/rotated) bearer in the trigger args |
| `20260622103627_schedule_workspace_purge_cron.sql` | pg_cron `purge-scheduled-workspaces` → `net.http_post` to **prod** `delete-workspace`, bearer read from `vault.decrypted_secrets` `service_role_key` (falls back to `''`) |
| `20260624102747_…`, `20260624103003_…`, `20260702120948_…` | review-decision notifications → `net.http_post` to **prod** `send-approval-email`, only `IF v_service_key IS NOT NULL` |

Supabase's own guidance: "Jobs defined in your migrations are replayed on a branch without data, and they're created active". "If a replayed job calls a production URL, it can reach your live app." Their advice is to keep production URLs and keys out of migrations, guard jobs with an `is_home()` marker row inserted by hand on production only, and note that pg_net triggers and DB webhooks are outside those guards ([KB: stop pg_cron jobs on a restored project or branch](https://supabase.com/kb/troubleshooting/how-to-stop-pg_cron-jobs-from-running-on-a-restored-project-or-branch)). The recommended pattern stores the **project URL and key in Vault** and reads them in the job ([Scheduling Edge Functions](https://supabase.com/docs/guides/functions/schedule-functions)). For local stacks, Supabase's own guide seeds `vault.create_secret('http://api.supabase.internal:8000', 'project_url')` in `seed.sql` ([automatic embeddings guide](https://supabase.com/docs/guides/ai/automatic-embeddings), linked from search).

What this means for a dev DB built today:

- With an empty Vault, the `send-approval-email` calls are skipped (the `IF … NOT NULL` guard), and the cron job sends `Bearer ''` to prod `delete-workspace`. That should be rejected, but it is still a call to production every day at 03:00 UTC.
- Inserting a `clients` row fires a call to **production** `send-client-welcome`. The bearer is the rotated, dead key, so it should 401, but it depends on what the live trigger definition (which the baseline dump will copy) actually holds.
- A baseline dumped from production will carry the **live** function and trigger bodies, including the prod URL. **Fix before or with the baseline:** read `project_url` (and the key) from Vault in every `net.http_post` or `http_request` caller, and seed Vault per environment.

---

## 1. Option A: Supabase branch

### Cost and plan

- Branching is **not included on Free**. It's available on **Pro and above**. Pro is "from $25/month" with $10/month of compute credits ([pricing](https://supabase.com/pricing)). The org's current plan isn't recorded in the repo, so check it on the dashboard.
- Per branch: Micro compute at **$0.01344/hour**, with "no fixed fee for a Preview branch". Charges are the sum of compute, disk, egress and storage. Branches are **not covered by the Spend Cap**, and **compute credits don't apply** to branching compute ([manage branching usage](https://supabase.com/docs/guides/platform/manage-your-usage/branching)). A persistent branch running 24/7 is about 720 h × $0.01344 ≈ **$9.68/mo** in compute alone (derived).
- **Include production data** needs the **PITR add-on** ($100/mo per 7 days of retention, [pricing](https://supabase.com/pricing)). The branch then matches production's compute size and gets a larger disk, which costs more ([dashboard branching](https://supabase.com/docs/guides/deployment/branching/dashboard)).

### Kinds of branch

- **Preview:** ephemeral, deleted when its PR merges or closes.
- **Persistent:** "aren't automatically paused or deleted due to inactivity". Suited to staging or dev ([branching](https://supabase.com/docs/guides/deployment/branching)). A shared "dev" database would be a persistent branch.
- **How it's created:** GitHub integration (reads the repo) or the dashboard (reads production's migration history, beta, feature-preview opt-in, Owner/Admin for the first click).

### What carries over and what doesn't ([branching](https://supabase.com/docs/guides/deployment/branching))

- **Copied:** Postgres settings, pooler, Auth/Data API/Realtime/Storage *settings*, SSL, network restrictions, **deployed edge functions**. DB webhooks are enabled.
- **Not copied:** schema (rebuilt from migrations), **data and storage objects**, auth users. Auth secrets (OAuth provider secrets, **SMTP password**) become **placeholders**.

### Per-concern notes for this repo

- **Auth.** Placeholder SMTP means Supabase's default mailer, which "only sends to pre-authorized addresses" (org team members) at "2 messages per hour" ([Auth SMTP](https://supabase.com/docs/guides/auth/auth-smtp)). Good for safety, but awkward for testing signup or invite flows with many test users. Per-branch SMTP can be set in a `[remotes.<name>]` block with `env()` or `encrypted:` values ([branch configuration](https://supabase.com/docs/guides/deployment/branching/configuration)). Test users must be seeded (an `auth.users` insert in seed) or signed up.
- **Storage buckets.** Settings carry over. Bucket rows for the three hand-made buckets don't, unless the baseline or `config.toml` declares them. Declaring them as `[storage.buckets.*]` makes the GitHub flow configure them. On a persistent branch, `config.toml` applies only when a `[remotes]` block names that branch's project id ([GitHub integration](https://supabase.com/docs/guides/deployment/branching/github-integration), [configuration](https://supabase.com/docs/guides/deployment/branching/configuration)). Objects (logos, media) start empty.
- **Edge functions.** The GitHub flow deploys only functions declared under `[functions.<slug>]`. All 15 except `toggle-maintenance` are declared today, so `toggle-maintenance` would need a `[functions.toggle-maintenance]` entry ([GitHub integration](https://supabase.com/docs/guides/deployment/branching/github-integration)). Function secrets are **per branch**: `supabase secrets set --env-file …` against the branch, or dotenvx-encrypted `.env.preview` ([configuration](https://supabase.com/docs/guides/deployment/branching/configuration)). That is where a dev `RESEND_API_KEY` or allow-list goes (see §3).
- **pg_cron.** Jobs replay active (see §0.2). Fix the prod URLs first.
- **Vault.** Empty on a branch. `[db.vault]` entries in config support `encrypted:` values ([configuration](https://supabase.com/docs/guides/deployment/branching/configuration)). You need a `service_role_key` (the branch's own key) and ideally `project_url`.
- **Realtime.** Hosted. Settings copied, publication membership comes from migrations.
- **Seed data.** `supabase/seed.sql` (already configured: `[db.seed] sql_paths = ["./seed.sql"]`, but the file doesn't exist). "Seed data isn't merged to production" ([GitHub integration](https://supabase.com/docs/guides/deployment/branching/github-integration)). Persistent branches use `[remotes.<name>.db.seed]` with a branch-specific path ([configuration](https://supabase.com/docs/guides/deployment/branching/configuration)). Or use "Include data" with PITR to get a real copy. That brings real client emails into a dev DB, which makes email safety (§3) mandatory, not optional.

### Gaps and risks specific to this repo

1. Blocked until the baseline in §0.1 exists. Dashboard branching doesn't avoid this (it replays the incomplete history).
2. Plan or cost dependency. Spend isn't capped.
3. Migrations run in one transaction per file, so a non-transactional statement (e.g. `CREATE INDEX CONCURRENTLY`) fails on deploy ([GitHub integration](https://supabase.com/docs/guides/deployment/branching/github-integration)). Grep the 243 files if the history is kept.
4. The branch gets **copies of production's deployed functions**, which use `notifications@tercerospace.com` via Resend. Without a branch-specific `RESEND_API_KEY` or allow-list, a branch can still email real addresses (whatever addresses exist in seeded or copied data).
5. "Custom roles created in the dashboard aren't captured" ([dashboard branching](https://supabase.com/docs/guides/deployment/branching/dashboard)).

### Concrete steps (if chosen)

1. Confirm the org is on Pro or higher, and accept the uncapped branch spend.
2. Do the baseline (§0.1) and remove the prod URLs from migrations (§0.2). Commit both.
3. Declare the 4 buckets under `[storage.buckets.*]` and add `[functions.toggle-maintenance]`. Fix `project_id`.
4. Write `supabase/seed.sql`: a test workspace, owner and member `auth.users`, clients with `delivered+…@resend.dev` emails, `agency_subscriptions`, and Vault rows (`project_url`, `service_role_key` for the branch).
5. Connect the GitHub integration (or create a persistent branch). Add `[remotes.dev]` with the branch `project_id`, seed path, and SMTP and Vault overrides.
6. `supabase secrets set` on the branch: dev `RESEND_API_KEY` plus an allow-list variable (§3).
7. Point `.env` at the branch URL and publishable key. Keep the production values out of the dev `.env`.

---

## 2. Option B: Local stack (`supabase start`)

### Cost and requirements

- Free. Needs a container runtime. **On Windows, Docker Desktop is the documented option.** The analytics service on Windows needs `tcp://localhost:2375` exposed manually. The first run pulls the full image set. Install the CLI with Scoop, or with npm (Node 20+). An experimental native (non-Docker) runtime exists for Linux and Apple-silicon macOS only ([CLI getting started](https://supabase.com/docs/guides/local-development/cli/getting-started)).
- Local endpoints: API `http://127.0.0.1:54321` (REST, Auth, Storage, Realtime, Functions behind the gateway), DB `postgresql://postgres:postgres@127.0.0.1:54322/postgres`, Studio `:54323`, **Mailpit `:54324`** ([CLI getting started](https://supabase.com/docs/guides/local-development/cli/getting-started)). The repo's `config.toml` already uses these ports and `major_version = 17`, matching production.

### Per-concern notes for this repo

- **Auth.** Local GoTrue. Auth emails (confirm, reset, magic link) go to **Mailpit**, a local inbox, by default. That's the strongest built-in protection against emailing real people. The repo's `config.toml` uses the `[inbucket]` section name. CLI v2.108.0+ renames it to `[local_smtp]` and warns on the old name ([CLI config](https://supabase.com/docs/guides/local-development/cli/config)). Rename it when upgrading.
- **Storage buckets.** Declared in `config.toml` under `[storage.buckets.<name>]` (`public`, `file_size_limit`, `allowed_mime_types`, `objects_path`). `supabase start` / `db reset` create them, and `objects_path` uploads seed files ([local dev overview](https://supabase.com/docs/guides/local-development/overview), [CLI config](https://supabase.com/docs/guides/local-development/cli/config)). None are declared today; the block is commented out. `note-media` has a 50 MB limit, matching the global `file_size_limit = "50MiB"`.
- **Edge functions.** Run by the local edge runtime. Secrets come from **`supabase/functions/.env`** (loaded on `start`; gitignore it). The root `.env` is only for `config.toml`'s `env()` ([function secrets](https://supabase.com/docs/guides/functions/secrets)). `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and similar are provided automatically. **If `RESEND_API_KEY` is put in that file, local functions send real email through Resend.** Leaving it out makes every send fail, which is safe but means you can't test templates. See §3.
- **pg_cron / pg_net.** The jobs and triggers from migrations replay. With the prod URLs in §0.2, a local DB would call **production** functions. Fix the URLs to read from Vault, and seed `project_url` as `http://api.supabase.internal:8000` (or `host.docker.internal`, per the getting-started note for DB-to-function calls).
- **Vault.** Empty locally. Seed with `vault.create_secret(...)` in `seed.sql`, as Supabase's own guide does. The local `service_role_key` is the fixed local secret key printed by `supabase start`. (`[db.vault]` appears commented out in `config.toml`. It isn't documented on the CLI config page, so prefer seeding.)
- **Realtime.** A local Realtime container is enabled (`[realtime] enabled = true`). Publication membership comes from migrations.
- **Seed data.** `[db.seed] enabled = true, sql_paths = ["./seed.sql"]` is already set, but `supabase/seed.sql` doesn't exist. Seeds run "the first time you run `supabase start` and every time you run `supabase db reset`", after migrations ([seeding](https://supabase.com/docs/guides/local-development/seeding-your-database)). Keep schema out of seeds. `@snaplet/seed` can generate volume data ([seeding](https://supabase.com/docs/guides/local-development/seeding-your-database)). A one-off sanitised copy of production rows (`supabase db dump --data-only`) is possible, but brings real emails in.

### Gaps and risks specific to this repo

1. Blocked until the baseline (§0.1) exists. Same as a branch.
2. Fidelity: the local Studio and images track the CLI version, so the CLI must stay current. Settings are changed in `config.toml`, not a dashboard ([local dev overview](https://supabase.com/docs/guides/local-development/overview)). Hosted-only extras (custom domains, PITR, log drains) don't exist.
3. Per-developer only. It can't back a Vercel or Netlify preview, and testers can't reach it.
4. Docker Desktop on Windows has a resource cost (RAM, disk) and licensing considerations for large companies (not checked here; out of scope for a solo dev).
5. Public review links (`/review/:token`, `/campaign-review/:token`) and invite links use `VITE_APP_URL` and `APP_URL`/`FRONTEND_URL` in functions. These must point at `localhost:5173` locally, or emails will contain production links.

### Concrete steps (if chosen)

1. Install Docker Desktop and the Supabase CLI (Scoop). `supabase --version`, then upgrade.
2. Do the baseline (§0.1) and the Vault-URL fix (§0.2). Commit both.
3. In `config.toml`: fix `project_id`, add 4 × `[storage.buckets.*]`, rename `[inbucket]` to `[local_smtp]` (if CLI ≥ 2.108), and add `[functions.toggle-maintenance]`.
4. Write `supabase/seed.sql` (test workspace, users, clients with `@resend.dev` addresses, subscription row, Vault `project_url` + `service_role_key`). Optionally add seed objects via `objects_path`.
5. `supabase start`, then `supabase db reset`. Compare the schema with production (`supabase db diff`, read-only against the linked remote) until it's clean.
6. Create `supabase/functions/.env` (gitignored): dev Resend key plus allow-list vars (§3), and `APP_URL`/`FRONTEND_URL=http://localhost:5173`.
7. Create `.env.local` (or a `dev` Vite mode) with `VITE_SUPABASE_URL=http://127.0.0.1:54321` and the local publishable key, so `npm run dev` stops pointing at production.

---

## 3. Stopping dev emails reaching real recipients (Resend)

Current state: about 12 functions call Resend with `RESEND_API_KEY`, all sending `from` `…@tercerospace.com`. There's no environment switch (repo grep). Resend rejects `example.com`-style addresses with **422** ([which test addresses to use](https://resend.com/docs/knowledge-base/what-email-addresses-to-use-for-testing)).

**What Resend offers:**

- **Test recipient addresses.** `delivered@resend.dev`, `bounced@resend.dev`, `complained@resend.dev` and `suppressed@resend.dev` simulate each outcome. `+label` works (`delivered+invite@resend.dev`) except on `suppressed@`. They **count toward quota**. Resend warns against fake addresses or a fake SMTP server because they hurt domain reputation ([send test emails](https://resend.com/docs/dashboard/emails/send-test-emails)).
- **`resend.dev` sender (`onboarding@resend.dev`).** Testing only. It can only send to **your own account email**, and other recipients get **403** ([403 with resend.dev](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain)). A dev key used with this sender can't reach clients even if the code picks a real address. The catch: every send must go to one inbox.
- **API key scoping.** Keys have `full_access` or `sending_access`. A `sending_access` key can be **restricted to one domain**. You can create multiple keys to isolate uses. Permission and domain can only be edited in the dashboard ([API keys](https://resend.com/docs/dashboard/api-keys/introduction), [create API key](https://resend.com/docs/api-reference/api-keys/create-api-key)). A separate dev key lets you revoke it and see dev traffic on its own. **Resend has no "test mode" key** (none documented). A dev key on `tercerospace.com` can still email anyone.
- **A separate sending domain** (e.g. `dev.tercerospace.com`) would keep dev sends from affecting production domain reputation. It still delivers to real people, so on its own it's **not** a recipient guard. Verifying it needs DNS records ([domains](https://resend.com/docs/dashboard/domains/introduction)).

**What the code would need (an allow-list or redirect in the edge functions).** Resend has no recipient allow-list feature, so the guard has to live in our code. One shared helper (`supabase/functions/_shared/`, which doesn't exist yet) used by every `send-*` function, driven by function secrets:

- `EMAIL_MODE=live|redirect|block` (unset counts as `block` everywhere except production).
- `EMAIL_ALLOWLIST=` comma-separated addresses or domains (e.g. `resend.dev, chris@…`).
- In `redirect` mode, rewrite non-allowed recipients to `delivered+<original-local-part>@resend.dev`, or to the developer's inbox, and log the original. Strip `cc`/`bcc` too.

This works the same on a branch (per-branch secrets) and locally (`supabase/functions/.env`). It's the only option that also protects against **copied production data** (e.g. a branch with "Include data"). Production keeps `EMAIL_MODE=live`.

**Layered options (trade-offs):**

| Layer | Stops real recipients? | Cost / effort |
|---|---|---|
| Local Mailpit (auth mail only) | Yes, for Supabase Auth mail on a local stack | Free, already on |
| Branch default SMTP (auth mail only) | Yes, team members only, 2/h | Free; limiting |
| No `RESEND_API_KEY` in dev | Yes; every send errors | Free; can't test emails |
| Dev key + `onboarding@resend.dev` sender | Yes; only your account inbox | Code must switch `from` per env |
| Separate dev key on prod domain | **No**; isolation and revocation only | Trivial |
| Seed data uses only `@resend.dev` addresses | Only if no real data gets in | Free; fragile |
| `_shared` allow-list / redirect helper | Yes, in all environments, with real or copied data | Small code change across about 12 functions |

---

## Open questions for #71

1. Is a shareable hosted dev or staging environment needed now (preview deploys, testers)? If yes, a branch. If no, local-first.
2. Is the org on Pro already, and is uncapped branch spend acceptable?
3. Baseline style: squash all 243 migrations into one baseline plus `migration repair`, or keep the history and add a "pre-history" baseline with an earlier timestamp?
4. Seed strategy: hand-written fixtures vs a sanitised production extract.
5. Email guard: which of the layers above (the allow-list helper is the only one that's environment-agnostic).
6. Do the prod-URL migrations (§0.2) get fixed as part of the baseline ticket or separately? Either way, it has to happen before any non-production DB is started.
