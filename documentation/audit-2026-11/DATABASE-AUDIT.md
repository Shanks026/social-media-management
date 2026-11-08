# Tercero — Database & Supabase Audit (2026-11-07)

Companion to [`AUDIT-REPORT.md`](AUDIT-REPORT.md).

**What I inspected:** the live production project ("Social Media Management", Postgres 17.6, ap-southeast-1), using read-only queries through the Supabase MCP. That covered:
- the catalog: tables, functions, triggers, policies, views, cron jobs, storage buckets, the realtime publication and enums
- migration history
- performance advisors
- the last 24 h of logs

I then cross-checked every database object against `src/` and `supabase/functions/`.

**Nothing was changed.** Scope is cleanup and maintainability. Security findings are **not analysed** here; things I noticed in passing are listed at the end as hand-offs for the security review.

Legend: 🗑 Remove · ✅ Can stay · 🔧 Needs improvement · 🐞 Bug.

---

## 1. Big picture

| | |
|---|---|
| Projects in the org | 2: this one (active) and one inactive, unrelated project |
| Public tables / views | 47 tables, 4 views, 0 materialized views, 513 columns, 87 FKs |
| Public functions | 113, including 30 trigger functions; 4 overloads of `create_post_draft_v3` and 2 of `create_revision_version` |
| Triggers (public + storage + auth) | 26 app triggers |
| Cron jobs | 3: `purge-scheduled-workspaces` (03:00 → `delete-workspace` edge fn), `cleanup-old-notifications` (03:30), `notify-overdue-invoices` (08:00) |
| Storage buckets | `post-media` (public, **no size limit**, 69 objects), `client-documents` (private, 50 MB), `proposal-files` (**public**, 20 MB), `note-media` (private, 50 MB) |
| Realtime publication | notifications, comments, comment_reactions, chat_channels, chat_channel_members, chat_messages, chat_message_reactions |
| Edge functions deployed | 15, matching the 15 folders in `supabase/functions/` exactly |
| Migrations | **242 remote = 242 local**, versions identical, so the history is in sync ✅ |
| Data volume | Tiny (largest table is about 128 kB). There's no performance pressure yet, so now is the cheap time to fix structure |

🔧 **There's only one environment.** `npm run dev` (`.env`) points at this same production project, and there are no branches. Every local test, this audit included, writes to production data and sends real emails. Before epic 6 (the server-side state machine), set up a **dev branch or local stack**. That needs the baseline schema dump described in §2.

## 2. Migrations & schema reproducibility
- ✅ The history is in sync and the names are descriptive.
- 🔧 **There's no baseline.** The remote history starts at `20260215144136`, but the core tables (`clients`, `posts`, `post_versions`, `agency_subscriptions`, `expenses`, `transactions`, `share_tokens`, the `post_status` enum…) were created before that date and appear in **no** migration. The folder can't rebuild the database. Fix: `supabase db dump --schema public` and commit it as a squashed baseline that a local stack or branch can start from.
- ✅ The two debug migrations (`debug_chat_dm_notify_temp`, `…temp2`) were restored by a follow-up. They can stay, since history has to match the remote.

## 3. Tables

### 🗑 Legacy / dead tables (0 rows; no app or function references, apart from dead RPCs)
| Table | Evidence | Note |
|---|---|---|
| `schedules` | 0 rows. Only written by the dead `schedule_post()` | Superseded by `post_versions.platform_schedules` |
| `approvals` | 0 rows. Only written by the dead `submit_approval()` | Superseded by `approval_events` + `update_post_status_by_token` |
| `client_users` | 0 rows, RLS on with **0 policies**, no references | A v1 "client portal" stub. Design the real client portal (roadmap 04) fresh rather than reviving it |

### ✅ Used only through RPCs (not dead, even though `src/` never names them)
`chat_channels` (via `get_my_chat_channels` / `ensure_workspace_channel`), `approval_events` (written by the internal-approval RPCs, read by `get_approval_log`).

### 🔧 Not used by this repo: the admin console
`admin_prospects`, `admin_prospect_activity`, `admin_outreach_notes`, `admin_outreach_log`, `admin_feedback` (the last is referenced only by the `send-feedback-notification` edge fn), `app_config` (maintenance mode), plus 9 `admin_*` / `set_agency_plan` RPCs. They serve a separate superadmin tool that isn't in this repo.
- **Action:** document where that tool lives. Consider moving these objects to an `admin` schema so `public` only holds product tables. Then the table and function lists stop mixing two products, which also makes the security review easier.

### 🔧 Shape / consistency
- **Status vocabulary is stored four different ways:**
  - a Postgres enum (`post_status`, 11 values)
  - UPPER-case text CHECKs (`tasks`, `invoices`, `clients`)
  - Title-case CHECKs (`campaigns.status` = `Active/Completed/Archived`, `client_documents.status` = `Active/Archived`)
  - lower-case CHECKs (`chat_channels.type`, `proposals.proposal_type`)
  - and prospect/proposal statuses with **no CHECK at all** (the free-text label is mapped by the `prospect_status_label()` SQL function)

  Pick one convention, say UPPER_SNAKE text with a CHECK, or enums everywhere. Mirror the same lists in `src/lib/*-statuses.js` so the DB and UI can't drift. This is the database side of the "single source of truth" problem in the main report §6.
- ✅ `post_status` enum: the real values are `DRAFT, PENDING_APPROVAL, APPROVED, SCHEDULED, NEEDS_REVISION, PUBLISHED, ARCHIVED, DELIVERED, SUBMITTED, CHANGES_REQUESTED, READY`. This **confirms** the docs (`DRAFT/PENDING/REVISIONS/…`) are wrong; `PENDING` and `REVISIONS` don't exist in the database.
- 🔧 `agency_subscriptions` has 44 columns. It mixes plan, feature flags, branding, invoice settings, signatory, onboarding progress, storage counters and the deletion schedule. Split it into `agency_profile` (identity, branding, invoice settings, signatory), `agency_plan` (plan, flags, limits, ends_at) and `agency_usage` (counters). Many future features will touch it, and every one currently risks colliding with this table.
- ✅ Integrity spot checks: 0 posts without `current_version_id`, and 0 orphaned `task_posts`.

## 4. Functions (RPCs)

### 🗑 Dead functions
These are called from neither `src/` nor `supabase/functions/`, and aren't referenced by any other function, policy, view or cron job. All checked:

| Function | Superseded by |
|---|---|
| `create_new_post_with_version`, `create_new_version`, `edit_draft`, `delete_draft_post` | `create_post_draft_v3`, `create_revision_version`, direct updates, `deletePost` |
| `schedule_post`, `send_for_approval`, `send_post_for_approval`, `submit_approval` | `platform_schedules`, `submit_for_internal_approval`, `update_post_status_by_token` |
| `get_global_calendar_posts` | `get_global_calendar` |
| `advance_recurring_invoice_date` | nothing calls it. Verify whether recurring invoices should advance (possible missing feature, see 🐞 D4) |

> **Correction (2026-11-08, #101):** `send_post_for_approval` is **not** dead. `PostDetails.jsx` calls it to move a deliverable to `PENDING_APPROVAL`, so it was kept. The others in this table were dropped in #101, except `schedule_post` and `submit_approval`, which go with the legacy tables in #102.
| `my_system_role` | `usePermissions` / `is_workspace_owner` |
| **Stale overloads:** 3 of the 4 `create_post_draft_v3` signatures (the app passes the 11-argument version with `p_campaign_id` + `p_deliverable_type`), and the 2-argument `create_revision_version` (the app passes `p_admin_notes`) | the newest signature |

Removing these drops about 15 functions (13%) and removes the ambiguity of which overload PostgREST resolves.

### 🔧 Design
- **The post state machine is split across three places:**
  1. the `enforce_post_status_transition` and `prevent_illegal_updates` triggers on `post_versions`
  2. the RPCs (`submit_for_internal_approval`, `approve_internally`, `request_internal_changes`, `update_post_status_by_token`)
  3. raw client-side `UPDATE`s from `PostDetails.jsx` and `markPostDelivered`

  The trigger is a good guard. Move layer 3 into RPCs (`schedule_post_version`, `mark_published`, `mark_delivered`) so every transition, and the notification and email side-effects that go with it, sits behind one function. That's what auto-publishing will call from a cron job or edge function.
- **Workspace scoping is inconsistent.** `get_global_calendar(p_user_id)`, `get_clients_with_pipeline(p_user_id…)`, `get_campaigns_with_post_summary(p_user_id…)` and `get_proposals_with_totals(p_user_id…)` take the workspace id **as a parameter from the client**. Newer RPCs call `get_my_agency_user_id()` internally. Standardise on the internal call: drop the parameter and resolve the workspace server-side. This also fixes B2 (the calendar uses `user.id`) by construction.
- `SECURITY DEFINER` vs `INVOKER` is mixed with no visible rule (for example `get_campaigns_with_post_summary` is INVOKER but `get_proposals_with_totals` is DEFINER). Write the rule down in an ADR.
- The CLAUDE.md "key RPCs" list is incomplete. For the 54 RPCs the app actually calls, see `area-reports/` and the list at the end.

## 5. Triggers

🐞 **D1: storage usage is counted 2–3×** *(verified with live data)*
- Two identical triggers on `storage.objects`, `track_storage_usage` (INSERT/DELETE) and `on_storage_object_changed` (INSERT/UPDATE/DELETE), both run `update_storage_usage()`.
- On top of that, the app also calls `increment_storage_used` / `decrement_storage_used` RPCs (`api/storage.js:22`, `documents.js:140`, `proposals.js:240`, and others).
- Measured `current_storage_used` against the real object sizes:

| Workspace | Recorded vs actual |
|---|---|
| Test account `<test-workspace>` (1 logo) | **2.00×** |
| Three other workspaces | 2.00×, 2.00×, 1.68× |
| Largest workspace | **2.98×** |

- Storage limits and the Billing usage bar run on these inflated numbers.
- **Fix:**
  1. Drop one trigger.
  2. Pick **either** the trigger or the RPCs. The trigger is better, because it can't be skipped. Then delete the client-side calls.
  3. Make the trigger credit the **workspace owner**, not `objects.owner`. That also fixes B16 for invited members.
  4. Run a one-off recompute from `storage.objects`.

**Other triggers:**
- ✅ Notification fan-out (`tg_notify_*`), `tg_log_task_activity`, `tg_autocomplete_tasks_on_publish`, `trg_set_post_creator`, `enforce_task_assignment`, `check_client_limit` and the comment cascade triggers are all good, DB-side, and match the documented pattern.
- 🔧 There are 4 copies of the `updated_at` trigger function (`set_updated_at`, `update_app_config_timestamp`, `update_user_feedback_updated_at`, plus storage's own). Keep `set_updated_at` only.
  > **Done in #101:** the two public duplicates were dropped and their triggers repointed to `set_updated_at`. Storage's `storage.update_updated_at_column` is Supabase-owned and stays.
- 🔧 Two notification triggers still emit `/clients/:id/posts/:postId` links, which is why the legacy route redirect must stay. Update them to `/deliverables/`.
- 🔧 The client-welcome email has a DB trigger (`trigger_client_welcome_email_on_insert` migration) **and** an app call. On the live database no such trigger is attached to `clients` anymore (only `enforce_client_limit` is), so the **app call is the only path**. The migration file is historical, and the main report's "two triggers" note can be closed.

## 6. Views
- ✅ Used: `view_finance_overview`, `view_monthly_burn_rate`.
- 🗑 Unused: `subscription_usage_stats` and `client_pipeline_analytics`. Nothing in `src/`, the edge functions, other functions or cron uses them; `get_clients_with_pipeline` replaced the second. Drop both.
  > **Correction (2026-11-08, #73 / #101):** this was wrong about `client_pipeline_analytics`. `get_client_report` (the Reports page) reads it, so it stays. Only `subscription_usage_stats` was dropped (#101).
- 🔧 Docs: `view_client_profitability` is described in `.claude/CLAUDE.md`, `.claude/rules/supabase-patterns.md` and `.claude/app-research.md`, but it was **dropped** in migration `20260305153317`. Remove it from the docs.

## 7. Indexes & performance advisors
The data is tiny, so none of this hurts today. Fix it while it's cheap.

| Advisor | Count | Notes |
|---|---|---|
| `auth_rls_initplan` (WARN) | 42 policies | `auth.uid()` / helper calls are re-evaluated per row. Wrap them as `(select auth.uid())`. Affects posts, notes, comments, tasks, meetings, notifications, chat, agency_members… |
| `multiple_permissive_policies` (WARN) | 66 | Overlapping SELECT policies on agency_job_roles, agency_member_job_roles, agency_members, clients, note_shares, posts, user_feedback. Merge each into one policy per action |
| `duplicate_index` (WARN) | 1 | `agency_subscriptions_pkey` and `agency_subscriptions_user_id_key` are identical; drop one |
| `unindexed_foreign_keys` (INFO) | 37 FKs on 24 tables | Add covering indexes for the ones used in joins (post_versions, posts, tasks, invoices, invoice_items, meetings, share_tokens, chat_messages) |
| `unused_index` (INFO) | 13 | e.g. `idx_expenses_category`, `idx_client_documents_status/category/collection_id`, `prospects_status_idx`. Revisit once real traffic exists; it's too early to drop them |

**Hotspots from `pg_stat_user_tables`:**
- `agency_subscriptions`: **323k sequential scans**.
- `agency_members`: 73k.
- `clients`: 49k.
- `meetings`: 6.6k seq vs 7 index scans. It has only a PK index, but is polled and filtered by client and date.

The first two are hit by the RLS helper functions (`get_my_agency_user_id()` etc.) on every row of every policy check. The initplan fix plus an index on `agency_members(member_user_id) where is_active` will remove most of this. Add `meetings(client_id, datetime)`.

**From the API logs** (last 24 h, mostly this audit's own session): the busiest endpoints were `agency_members` 157, `meetings` 143, `clients` 108 + 68 HEAD, `agency_subscriptions` 106 and `posts` 98.
- `meetings` is hit by `useMeetingReminders` (5-minute poll) plus 7 different cache keys (main report §13).
- `agency_subscriptions` is double-fetched by AppShell and `useSubscription` (main report §3).
- Two `posts.js` queries poll every 60 s.

Consolidating the keys and the shell fetch will roughly halve the read traffic.

## 8. Edge functions
- ✅ The deployed set equals the repo set (15). Cron → `delete-workspace` ran successfully today (03:00).
- 🐞 **D2: email failures are invisible.**
  - During the walkthrough `send-approval-email` returned **500 twice**, on the initial send and on the resend. The function logged **nothing**: no error line, just a boot then the 500.
  - The UI reported the first send as successful, because the status changed and the email error was swallowed. Only the resend surfaced a raw error.
  - By contrast, `send-client-welcome` logged the cause properly: Resend 422, the `example.com` address rejected.
  - **Fix:** add structured error logging in every function, have the client surface email failures as "Status updated, but the email couldn't be sent", and put a shared `_shared/email.ts` wrapper around Resend.
- 🔧 Resend rejects `example.com`, and there's no dev/test inbox configuration. Add a `RESEND_TEST_MODE` / allow-list for non-production so testing doesn't need real addresses. This depends on the dev-environment point in §1.
- 🔧 There are two `verify_jwt` styles: 4 functions use platform `verify_jwt: true`, and 11 use `false` with manual verification inside, or none for public ones. Document which pattern applies to which kind of function.
- 🔧 Entrypoint paths show two deploy layouts (`source/index.ts` vs `source/supabase/functions/<name>/index.ts`), which means some were deployed from the dashboard or MCP and some from the CLI. Deploy everything from the repo with the CLI so the source of truth is git.
- 🔧 `toggle-maintenance` is deployed (v3) but invoked nowhere in this repo. It's presumably used by the admin console (see §3); document that.

## 9. Storage
- 🔧 `post-media` is **public with no file-size limit**. It's also used for client logos (`CreateClientPage`) and agency logos, so it's become the general bucket. Add a size limit and a separate `branding` bucket for logos.
- 🔧 `proposal-files` is public. This is noted for the security review rather than analysed here.
- 🔧 Bucket names in docs: `proposal-files` is missing from CLAUDE.md's bucket list.

## 10. Cron
- ✅ All three jobs are active and sensible.
- 🐞 **D4 (possible):** recurring invoices. `advance_recurring_invoice_date()` and `generate_invoice_from_template()` exist, and the app calls the latter, but **no cron job generates due recurring invoices**, and nothing calls the advance function. If recurring templates are meant to auto-generate, that job is missing; if generation is manual, delete `advance_recurring_invoice_date`. **Decide which.**
- 🔧 `notify_overdue_invoices` only notifies; it doesn't flip `invoices.status` to `OVERDUE`. Check that the UI derives overdue status, or add the update.

## 11. Data hygiene (test data on production)
Because there's no dev environment, test records live in production. This audit added:
- account `<test-account-email>` (workspace `<test-workspace>`)
- client "Acme Coffee Co"
- deliverable "Autumn latte launch reel" (`PENDING_APPROVAL`)
- prospect "Bloom Bakery"
- one logo object

The 6 workspaces present look like a mix of real and test data. Clean up once a dev environment exists.

## 12. Hand-offs to the security review (not analysed, listed so they aren't lost)
- Many `SECURITY DEFINER` functions are executable by `anon`, including several that look authenticated-only (`approve_internally`, `request_internal_changes`, `update_member_access`, `get_team_members`, `get_removed_members`, `admin_get_client_detail`, `delete_approval_events`, `cleanup_old_notifications`, `notify_overdue_invoices`). Grant hygiene needs a pass.
- `client_users` has RLS enabled with no policies (harmless only if unused; dropping it resolves this).
- Public buckets `post-media` and `proposal-files`.
- RPCs that accept a workspace id parameter from the client (§4).
- Run `get_advisors type=security` as part of that review.

---

## 13. Suggested database tickets (feed into the mattpocock flow, main report §25)
1. **Baseline and dev environment:** schema dump to baseline migration, a Supabase branch or local stack, and a non-production email allow-list. *(Prerequisite for everything below.)*
2. **Fix storage accounting (D1):** drop the duplicate trigger, pick trigger-only, attribute usage to the workspace, recompute. Test-first with `/tdd`.
3. **Edge-function observability (D2):** `_shared/` logging and email wrapper, client surfaces email failures.
4. **Drop dead objects:** 15 functions and overloads, 3 legacy tables, 2 views, the duplicate `updated_at` functions, the duplicate index.
5. **RLS performance:** initplan wrapping (42), merge permissive policies (66), FK indexes for join paths, `meetings` and `agency_members` indexes.
6. **Workspace-scoped RPCs:** remove the `p_user_id` workspace parameters and resolve server-side (fixes B2 by construction).
7. **Post state machine in RPCs:** schedule, publish and deliver transitions plus their side-effects (main report epic 6).
8. **Status vocabulary convention:** one casing and storage style, CHECKs for prospect and proposal statuses, mirrored in `src/lib`.
9. **Split `agency_subscriptions`** into profile, plan and usage.
10. **Admin objects:** move them to an `admin` schema and document the admin console.
11. **Recurring invoices (D4):** decide on auto-generation, then add the cron job or delete the function.
12. **Docs:** remove `view_client_profitability`, fix the RPC and bucket lists, link this file from CLAUDE.md.

### Appendix: RPCs called by the app (54)
accept_proposal, advance_expense_billing_date, approve_internally, cancel_workspace_deletion, check_email_exists, create_post_draft_v3, create_revision_version, decline_proposal, decrement_storage_used, delete_approval_events, ensure_workspace_channel, generate_proposal_token, generate_version_token, get_agency_branding_by_token, get_approval_log, get_approval_log_count, get_campaign_analytics, get_campaign_by_review_token, get_campaigns_with_post_summary, get_client_report, get_clients_with_pipeline, get_global_calendar, get_invite_by_token, get_my_chat_channels, get_my_submissions, get_my_submissions_count, get_my_workspace_owner, get_or_create_dm_channel, get_post_by_token, get_proposal_by_token, get_proposals_with_totals, get_removed_members, get_team_members, generate_invoice_from_template, hard_delete_team_member, increment_storage_used, join_team, mark_channel_read, mark_proposal_viewed, reassign_task, remove_team_member, request_internal_changes, request_proposal_changes, request_workspace_deletion, set_member_job_roles, set_member_responsibilities, set_my_email_task_assignments, soft_delete_chat_message, soft_delete_comment, submit_for_internal_approval, task_reference_exists, toggle_chat_reaction, toggle_comment_reaction, update_member_access, update_post_status_by_token, update_task_status.
