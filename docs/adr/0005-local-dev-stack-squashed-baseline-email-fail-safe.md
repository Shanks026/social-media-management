# Develop against a local Supabase stack built from a squashed baseline; email fails safe outside production

Until now, development ran against the only Supabase project, which is production. Development now runs against a **local Supabase stack** (`supabase start`, Docker), and `npm run dev` points at it by default. Using production locally takes an explicit opt-in. We chose local over a hosted Supabase branch because the org is on the Free plan, where branching needs Pro ($25/mo plus uncapped branch compute), and nothing yet needs a shared hosted environment. A branch can be added later on top of the same baseline.

The 243 historical migrations could not rebuild the database: core tables such as `clients`, `posts` and `agency_subscriptions` were never created in them. They are **squashed into one baseline** taken from production and marked applied there with `supabase migration repair`, and only new migrations go on top. The old files remain in git history. The baseline also covers what a `public`-schema dump misses: the triggers on `storage.objects` and `auth.users`, the hand-made storage buckets, and the Realtime publication. Database code reads the functions URL and key from Vault per environment, never a hard-coded production URL.

Outgoing email goes through one shared edge-function helper controlled by `EMAIL_MODE`:
- `live` delivers;
- `redirect` rewrites recipients to `@resend.dev` test addresses and logs the original;
- `block` drops the email;
- **unset means `block`**.

Only production sets `live`. Resend has no test mode or recipient allow-list, so this helper is the only guard that holds in every environment, even with copied data.

## Consequences

- Schema changes are written and tested locally (`supabase db reset`) before they reach production.
- `supabase/seed.sql` holds hand-written fixtures: one workspace with an owner, admin and member, a few clients and deliverables, and only `@resend.dev` addresses.
- A missing or misconfigured `EMAIL_MODE` silently sends nothing. Production must set it explicitly, and the helper logs every block or redirect, so the cause is visible.
- Testers and preview deploys can't reach a dev database until a hosted branch is added.
