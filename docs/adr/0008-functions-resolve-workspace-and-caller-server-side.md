---
status: accepted
---

# Database functions resolve the workspace and the caller themselves

A database function that acts on "the caller's workspace" finds it with `get_my_agency_user_id()`, and finds the acting user with `auth.uid()`. It never takes either as a parameter. This builds on ADR 0001: the Workspace is the Owner's uid, and the server already knows it for every signed-in caller, so a `p_user_id` parameter that must equal that value only gives callers a way to get it wrong. When this was decided (2026-11-19), it had gone wrong both ways. The calendar passed the Member's own id, so invited Members saw an empty calendar (B2). And two `SECURITY DEFINER` functions trusted the parameter outright, so any signed-in user could change any Workspace's Plan (`set_agency_plan`) or read its Proposals (`get_proposals_with_totals`). Those two were closed first, in #169, as a stopgap that kept the signatures.

`SECURITY INVOKER` is the default, so RLS applies. A function is `SECURITY DEFINER` only when it must cross RLS on purpose: public review-link endpoints, notification fan-out, purge and cron helpers, reads of `auth` or `storage`. Every DEFINER function sets `search_path`, and either is revoked from `anon`/`authenticated` or authorizes the caller in its first statements. We chose a written rule plus a test over case-by-case review, because both holes passed review as ordinary-looking read and write helpers.

## Consequences

- These drop their parameter and resolve inside: `get_global_calendar`, `get_clients_with_pipeline`, `get_campaigns_with_post_summary`, `get_proposals_with_totals`, `generate_invoice_from_template`, `get_team_members`, `get_removed_members`. `create_post_draft_v3` and `create_revision_version` drop `p_user_id` and stamp `created_by = auth.uid()`, which matters because `created_by` decides whether a Member may delete a Deliverable.
- The no-op `increment_storage_used` / `decrement_storage_used` are dropped. `set_agency_plan` stays service-only.
- Exceptions keep a workspace parameter on purpose: internal helpers that users can't call (`emit_notifications`, `workspace_admin_uids`, `storage_workspace_for`, `workspace_purge_storage_objects`), and `is_chat_enabled_for_workspace`, which RLS policies call with the row's workspace, so users need execute. It reveals one boolean.
- **Rollout is expand → contract:** add each new signature beside the old one, which keeps its #169 check and delegates; switch `src/api`; deploy; then drop the old signatures. PostgREST picks the overload by argument names, so old and new bundles both work during the switch.
- A SQL privilege test lists every DEFINER function that `anon` or `authenticated` can execute and fails on any that isn't on a reviewed allow-list. A new user-callable DEFINER function is a visible change in its PR.
- Supersedes the per-function "pass `workspaceUserId`" habit in `src/api`. Callers stop sending the id. Query keys still take `workspaceUserId` (ADR 0007), because cache scoping is separate from authorization.
