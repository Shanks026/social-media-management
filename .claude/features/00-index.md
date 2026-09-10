# Feature Index

Tracks planned and built features. Each entry links to its full planning doc.

## Feature Files

| # | Feature | Doc | Status |
|---|---------|-----|--------|
| 01 | Notes & Tasks Split | [01-notes-and-tasks-split.md](01-notes-and-tasks-split.md) | ✅ Complete |
| 02 | Note Tags | [02-note-tags.md](02-note-tags.md) | ✅ Complete |
| 04 | Team Task Management | [04-team-task-management.md](04-team-task-management.md) | 🔵 Planned |
| 06 | Multi-Account Switcher | [06-multi-account-switcher.md](06-multi-account-switcher.md) | ✅ Complete |
| 07 | Invite Link Upgrade | [07-invite-link-upgrade.md](07-invite-link-upgrade.md) | 🟡 Built + links now multi-use (see addendum); pending verification |
| 08 | Onboarding Enhancement | [08-onboarding-enhancement.md](08-onboarding-enhancement.md) | ✅ Complete |
| 09 | Task Collaboration — History, Watchers & Detail Page | [09-task-collaboration.md](09-task-collaboration.md) | 🟢 All 4 phases built and applied; pending live multi-account smoke test |
| 10 | Job Roles — Owner-Defined Job Titles | [10-job-roles.md](10-job-roles.md) | ✅ Complete |

## Key Database Changes

| Table | Feature | Notes |
|-------|---------|-------|
| `notes` (new) | 01 | Freeform agency notes; `client_id` nullable (NULL = global) |
| `note_tags` (new) | 02 | Dynamic, workspace-scoped tag definitions (name + color key) |
| `note_tag_links` (new) | 02 | Note↔tag junction; both FKs `ON DELETE CASCADE` |
| `tasks` (new) | 04 | Replaces `client_notes`; team task management with assignment + priority + RBAC |
| `client_notes` (dropped) | 04 | Replaced by `tasks`; data migrated in Phase 1 |
| `agency_subscriptions` (columns) | 08 | `address`, `website` (Phase 1); `onboarding_completed_at`, `onboarding_skipped_steps` (Phase 3) |
| `task_activity` (new) | 09 | Assignment + status history for tasks; also doubles as the watcher/participant list via `to_user_id` |
| `agency_job_roles` (new) | 10 | Owner-defined job titles per workspace (name + color). Identification only — never affects access |
| `agency_member_job_roles` (new) | 10 | Member↔job-role junction; one member holds many titles. `ON DELETE CASCADE` from the role |
| `agency_members.functional_role` (dropped) | 10 | Replaced by the junction table; single-value column removed in Phase 2 |

## Shared Infrastructure Notes

- No new storage buckets introduced yet. Feature 08 reuses the existing public
  `post-media` bucket under `branding/` (logos) and `signatures/`.
- **RLS security fixes landed alongside 08** (unrelated to onboarding itself, found while
  investigating a reported leak):
  - Dropped `posts_select_internal` / `posts_insert_internal` /
    `post_versions_select_internal` / `post_versions_insert_internal`. These were
    `auth.uid() IS NOT NULL`, and because Postgres **ORs** permissive policies they
    defeated the workspace-scoped policies entirely — every authenticated user could
    read and insert posts in *any* workspace. Surfaced via the Approvals pending queue,
    which filtered on status alone.
  - Dropped `Allow public read access to agency_subscriptions` (qual `true`), which
    exposed every agency's name, email, mobile, plan, storage and signatory to anon.
    Its only unauthenticated consumer, `PublicReview`'s branding lookup, now uses the
    new `get_agency_branding_by_token()` SECURITY DEFINER RPC — branding columns only,
    gated on a live share token.
  - `handle_new_user_subscription()` omitted `chat` from its INSERT, so new trials fell
    to the column default `false` and saw Chat locked despite Trial mirroring Quantum.
    Added and backfilled.
- **Lesson worth repeating:** when a table has several permissive policies, the
  broadest one wins. Grep for `qual = 'true'` / `auth.uid() IS NOT NULL` before
  trusting that a scoped policy is doing the scoping.
