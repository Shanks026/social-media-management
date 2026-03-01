# Agency OS - Dashboard Ideas (Phase 1)

## Purpose

The dashboard is the first thing agency owners or managers see when they log in. It should provide an immediate pulse on the agency's health (financials and client activity) and highlight actionable items that require attention.

## Proposed Sections

### 1. Global Metrics (The 30,000 ft View)

A top row of KPI cards that gives an instant summary:

- **Total MRR / Revenue**: Current Monthly Recurring Revenue.
- **Active Clients**: Count of active clients (Internal vs External).
- **Posts in Pipeline**: Total posts currently in `DRAFT`, `PENDING_APPROVAL`, or `SCHEDULED`.
- **Overdue Action Items**: Aggregated count of overdue posts, invoices, and workflow tasks.

### 2. "Requires Attention" (Actionable Intelligence)

This is the most critical operational section. Instead of hunting through individual client pages, the dashboard pushes what needs to be done _now_.

- **Urgent / Overdue Posts**: A list of posts with the red "Overdue" or "Urgent" health status. Clicking takes them straight to the editor.
- **Pending Approvals**: Posts waiting for client approval or internal review.
- **Overdue Invoices**: Quick list of unpaid invoices spanning past their due date.
- **Upcoming Meetings**: Today's meetings pulled from the Meetings CRM.

### 3. Financial Snapshot

A miniature version of the global Finance tab to keep money top-of-mind.

- A simplified bar or line chart showing revenue over the last 3-6 months.
- A feed of recently paid invoices or newly active subscriptions.

### 4. Client Content Health (Churn Indicators)

A widget dedicated to post consistency and client retention.

- **Content-Starved Clients**: A list of clients who have no `SCHEDULED` or `DRAFT` posts for the upcoming week/month. This is a massive churn indicator for social media agencies.
- **Recent Approvals/Rejections**: Feed of recent major state changes on content.

### 5. Quick Actions

A floating or pinned section allowing immediate action from anywhere without navigating the sidebar:

- "Quick Create Post" (Using the dynamic target client dropdown we recently built)
- "Log a Meeting"
- "Create Invoice"
- "Add Client"

## Implementation Complexity for Phase 1

**High Value, Medium Effort.**
Most of these metrics require aggregating data we already fetch (Posts, Invoices, Clients, Meetings). To keep the dashboard snappy and prevent it from causing 20+ separate network requests on load, we should rely heavily on existing `Supabase` RPC functions or create new `get_dashboard_metrics` RPC views.
