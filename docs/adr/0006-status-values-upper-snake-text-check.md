# Status values are UPPER_SNAKE text with a CHECK, mirrored in `src/lib` by a drift test

Every stored lifecycle status and level (Deliverable, Task, Invoice, Client, Campaign, document, Proposal, Prospect, transaction status, and Task priority) is an UPPER_SNAKE `text` column with a `CHECK` constraint listing its values. The two Postgres enums (`post_status`, `transaction_status`) are converted to text + CHECK, and the lowercase or Title-case columns (prospects, proposals, campaigns, client documents) are rewritten to UPPER_SNAKE. We chose CHECK over enums because an enum value can't be dropped or renamed without rebuilding the type and every function that names it, while a CHECK is replaced in one statement. We chose UPPER_SNAKE because most columns already used it, and production held almost no rows when this was decided (2026-11-16), so the rewrite was cheap.

`src/lib` holds a hand-written list of **stored statuses** per entity. A Vitest drift test parses `supabase/migrations/*.sql` for each table's latest status CHECK and fails if the JS list differs, so it runs in `npm test` without Docker. **Display states** that are derived and never stored (`PARTIALLY_PUBLISHED`, Proposal `EXPIRED`) live beside the stored list but are not checked against the DB.

## Consequences

- The convention covers lifecycle states and levels only. Kind/type columns (notification `type`, activity types, `entity_type`, prospect source, outreach channel) stay lowercase snake_case. Tercero-staff tables (`admin_feedback`, `admin_prospects`, `user_feedback`) are out of scope.
- Stored names follow the glossary: prospect `demo_scheduled` becomes `DISCOVERY_CALL`.
- RPCs that return or cast `post_status` (for example `get_global_calendar` and `create_post_draft_v3`) are recreated with `text` when the enum is dropped.
- A new status needs three edits together: the migration's CHECK, the `src/lib` list, and the drift test passing.
