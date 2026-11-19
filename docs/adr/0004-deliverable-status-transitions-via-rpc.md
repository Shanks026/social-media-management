---
status: accepted
---

# Deliverable status transitions only happen through database functions

Every change to a Deliverable Version's status, and its side effects (notifications, emails, task auto-completion), goes through a database function, never a raw client-side `UPDATE`. When this was decided (2026-11-19), transitions were split three ways: guard triggers, the internal-review and client-approval RPCs, and direct updates from the browser (scheduling, approving non-social work, marking published or delivered). Rules and emails only ran when the change came from the React UI. RLS let any workspace user, Members included, make those moves with one raw request, and the transition trigger checked which move it was, never who made it. Auto-publishing (a scheduled job), the client portal and WhatsApp approvals all need to trigger the same transitions without the browser, so there is exactly one path.

The scope is Deliverables only. Other statuses (Proposals, Prospects, Invoices, documents) adopt the rule when they get a caller other than the browser. Tasks already go through `update_task_status`.

## Consequences

- **One function per action**, not a generic `transition(to_status)`: `schedule_deliverable`, `approve_deliverable`, `mark_platform_published`, `mark_published`, `mark_delivered` and `archive_deliverable`, alongside the existing internal-review, send-for-approval and review-link functions. Each takes its own inputs and checks its own actor. The transition check and the side effects are shared through one internal helper (`deliverable_event(version, event, details)`).
- **The database refuses raw writes.** Each function sets a transaction-local flag (`set_config('tercero.deliverable_transition', 'on', true)`). `enforce_post_status_transition` rejects any change to `status`, `published_at` or a platform's `published_at` inside `platform_schedules` unless the flag is set. This holds for the service role and cron too. Dates and content stay editable as before.
- **Who may make each move**, enforced in the functions:

  | Transition | Actor |
  |---|---|
  | Submit, resubmit after changes | the Member who created it, or Owner/Admin |
  | Internal review (READY / CHANGES_REQUESTED) | Owner/Admin |
  | Send for Client approval | Owner/Admin |
  | Client approval | the Client, through an active review link for that Version only |
  | Schedule, approve non-social, mark published, mark delivered | Owner/Admin. The system (cron) may also publish |
  | Archive | Owner/Admin anytime. A Member only for their own Deliverable while it's DRAFT/SUBMITTED |

- **The review link sends a decision, not a status.** `update_post_status_by_token` takes `APPROVE` or `REQUEST_REVISIONS`, and derives `SCHEDULED` (has platforms) or `APPROVED` (non-social) itself. The campaign review page uses the same function. An anonymous link holder can no longer pick any status the trigger permits, such as `ARCHIVED`.
- **Emails start in the database.** The helper queues the edge function through `pg_net` with the Vault secrets, as `update_post_status_by_token` already did. That covers the approval email and the platform-published email, including the partial publishes that don't change the status. Sending is fire-and-forget, so when a send fails the edge function writes an `email_failed` in-app notification to Owner/Admins. That replaces the "status changed but the email failed" toast. Resend Link isn't a transition and stays a direct edge-function call.
- **Rollout is expand → contract**, in order: (1) add the functions, the helper, the review-link decision and `email_failed`; (2) switch `src/api/posts.js` and both review pages to them, and delete the browser email calls; (3) only once (2) is deployed, turn on the trigger guard.
- The client-approval bug for non-social Deliverables (`PENDING_APPROVAL → APPROVED` missing from the trigger) is fixed separately in #167, ahead of this work.
