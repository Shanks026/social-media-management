---
status: proposed
---

# Deliverable status transitions only happen through database functions

Every change to a Deliverable Version's status, and its side-effects (notifications, emails, task auto-completion), goes through a database function, never a raw client-side `UPDATE`. Today the transitions are split three ways: guard triggers, the internal-review and client-approval RPCs, and direct updates from the browser (scheduling, marking published or delivered). That means rules and emails only run when the change comes from the React UI. Auto-publishing (a scheduled job), the client portal and WhatsApp approvals all need to trigger the same transitions without the browser, so there must be exactly one path.

## Consequences

- New RPCs are needed for schedule, publish and deliver. `PostDetails.jsx` and `markPostDelivered` stop writing `status` directly.
- Email sending moves from React success handlers to server-side code (an edge function invoked by the RPC or a DB webhook).
- The "approve → SCHEDULED if it has platforms, else APPROVED" rule moves into `update_post_status_by_token`.
