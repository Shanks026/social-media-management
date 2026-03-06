# Finance Module — Redesign & Implementation Guide

**Location**: `.claude/features/`
**Created**: March 2026
**Purpose**: Step-by-step instructions for Claude Code to simplify the Finance module — removing client-level financial complexity, eliminating bloat, and establishing a clean agency-centric model that scales with subscription tiers.

> **Before starting**: Grep the codebase for `useClientMetrics`, `useAllClientsMetrics`, `view_client_profitability`, and `calculatePeriodMetrics` to locate every current call site. You will be removing or replacing all of them.

---

## The Core Decision

Finance in Tercero is **agency finance only**. The agency tracks:

1. What clients pay them (via Invoices → auto-creates income transaction)
2. What the agency spends (via Ledger manual entries + Subscriptions/recurring)
3. Their overall P&L (Overview)

**What is being removed:**

- Per-client profitability metrics (Net Profit, MRR, Margin) from client cards and client detail pages
- The Financials tab on the Internal Account (`My Organization`) page
- The Combined/Agency Only/Client Projects view mode toggle on Finance Overview
- `view_client_profitability` usage throughout the app
- Client-scoped finance calculations on the frontend

**What is being kept, unchanged:**

- All four `/finance` routes and their core functionality
- Invoice lifecycle (Draft → Sent → Paid → auto-transaction)
- Ledger (manual income/expense entries)
- Subscriptions (recurring expenses)
- Finance Overview KPI cards and Profitability Trend chart — but now always agency-wide, no filter toggle
- Dashboard financial widgets (pull from the same agency-wide data)

---

## Mental Model After This Change

```
Agency Finance (/finance)
├── Overview        — Agency P&L: Net Profit, Revenue, Expenses, Burn Rate
├── Invoices        — Bills sent to clients. Client field = "source of income"
├── Subscriptions   — Agency recurring costs (tools, software, overhead)
└── Ledger          — All transactions. Client field = optional attribution label only

External Client Detail (/clients/:id)
└── Billing tab     — Replaces "Financials" tab
    ├── Invoices sent to this client (filtered from invoices table)
    └── Total collected from this client (sum of paid invoices)
    — NO profit metrics, NO MRR, NO margin

My Organization (/clients/internal or /my-organization)
└── Remove Financials tab entirely
    — Agency P&L lives in /finance. No duplication here.

Dashboard
├── KPI bar         — Net Profit, Revenue, Expenses, Active Clients (agency-wide, unchanged)
├── Profitability Trend chart (agency-wide, unchanged)
├── Lifetime Revenue chart (agency-wide, unchanged)
└── Recent Invoices widget (agency-wide, unchanged)
    — Client Health Grid: remove financial metrics (revenue, burn, margin) from cards
```

---

## Phase 1 — Remove Client Profitability from Client Cards

**Files**: `src/pages/clients/Clients.jsx`, client card component (check for `useAllClientsMetrics`)

### 1.1 — Remove `useAllClientsMetrics` from Clients page

Find the call to `useAllClientsMetrics()` in `Clients.jsx`. Remove the import and the hook call entirely.

### 1.2 — Strip financial fields from client cards

In the client card component, remove these three display fields:

- Total Revenue (Cash)
- Monthly Burn
- Margin (Mo.)

The client card after this change should show:

- Client name + logo + badge (tier, industry)
- Post pipeline mini-bar (Drafts · Pending · Revisions · Scheduled) — keep
- Next scheduled post date — keep
- Urgency indicator dot — keep
- Platform icons — keep

Do NOT remove `useClients()` — it is still needed for the client list data itself.

**✅ Phase 1 complete when:**

- [ ] Client cards show no financial figures
- [ ] No call to `useAllClientsMetrics` exists in the file
- [ ] `view_client_profitability` is not queried from the clients list page

---

## Phase 2 — Replace "Financials" Tab with "Billing" Tab on External Client Detail

**Files**: `src/pages/clients/ClientDetails.jsx`, `src/api/clients.js`

### 2.1 — Remove Financials tab from ClientDetails

In `ClientDetails.jsx`, find the tab definitions. Replace the "Financials" tab with a "Billing" tab.

The new Billing tab renders a single component: `<ClientBillingTab clientId={clientId} />` (to be created in 2.2).

Remove any import or use of `useClientMetrics(clientId)` from `ClientDetails.jsx`.

### 2.2 — Create `ClientBillingTab.jsx`

Create `src/pages/clients/ClientBillingTab.jsx`:

```jsx
import { useInvoices } from '@/api/invoices'
import { formatCurrency } from '@/utils/finance'

export function ClientBillingTab({ clientId }) {
  const { data: invoices = [], isLoading } = useInvoices({ clientId })

  const totalCollected = invoices
    .filter((inv) => inv.status === 'PAID')
    .reduce((sum, inv) => sum + inv.total, 0)

  const pendingTotal = invoices
    .filter((inv) => inv.status === 'SENT' || inv.status === 'OVERDUE')
    .reduce((sum, inv) => sum + inv.total, 0)

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4">
        <SummaryCard
          label="Total Collected"
          value={formatCurrency(totalCollected)}
        />
        <SummaryCard
          label="Outstanding"
          value={formatCurrency(pendingTotal)}
          highlight={pendingTotal > 0}
        />
      </div>

      {/* Invoice list — reuse existing InvoiceRow component */}
      <InvoiceList
        invoices={invoices}
        isLoading={isLoading}
        clientId={clientId}
      />
    </div>
  )
}
```

This component:

- Uses the existing `useInvoices({ clientId })` hook — no new API needed
- Shows total collected and outstanding amounts
- Lists invoices for this client
- Has a quick action to create a new invoice (pass `clientId` as default to `CreateInvoiceDialog`)

### 2.3 — Remove `useClientMetrics` from `clients.js`

In `src/api/clients.js`, remove the `useClientMetrics` and `useAllClientsMetrics` hooks entirely. They both read from `view_client_profitability` which is no longer consumed anywhere.

**✅ Phase 2 complete when:**

- [ ] External client detail page shows "Billing" tab, not "Financials"
- [ ] Billing tab shows invoice list + collected/outstanding totals
- [ ] No call to `useClientMetrics` exists anywhere in the codebase
- [ ] No call to `useAllClientsMetrics` exists anywhere in the codebase

---

## Phase 3 — Remove Financials Tab from My Organization / Internal Account

**Files**: `src/pages/clients/ClientDetails.jsx` (or the dedicated My Organization page if separate)

The Internal Account (`is_internal = true`) uses the same `ClientDetails` component or a variant of it. The Financials/Billing tab should not appear for the internal account at all. Agency P&L is in `/finance`.

### 3.1 — Conditionally hide Billing tab for internal account

```jsx
// In ClientDetails.jsx tab definitions
const tabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'workflow', label: 'Workflow' },
  // Only show Billing for external clients
  ...(!client.is_internal ? [{ id: 'billing', label: 'Billing' }] : []),
  { id: 'calendar', label: 'Calendar' },
  { id: 'settings', label: 'Settings' },
]
```

### 3.2 — Clean up Internal Account overview card

In the Overview tab of the Internal Account, remove any financial summary metrics (Net Profit, Total MRR, Total Expenses, Monthly Burn, Margin) from the Financials section/card.

Replace that card entirely with a simple prompt:

```jsx
{
  client.is_internal && (
    <div className="rounded-lg border p-4 text-sm text-muted-foreground">
      Agency financials are managed in the{' '}
      <Link to="/finance" className="underline">
        Finance Hub
      </Link>
      .
    </div>
  )
}
```

**✅ Phase 3 complete when:**

- [ ] My Organization / Internal Account page has no Billing or Financials tab
- [ ] No financial summary metrics appear on the Internal Account overview card
- [ ] A link to /finance is shown in place of financial data

---

## Phase 4 — Simplify Finance Overview (Remove View Mode Toggle)

**Files**: `src/pages/finance/FinancialOverviewTab.jsx`, `src/utils/finance.js`

The Finance Overview currently has a Combined / Agency Only / Client Projects toggle. Since finance is now always agency-wide, this toggle is removed. The view is always combined (all transactions, all invoices).

### 4.1 — Remove view mode state and selector

In `FinancialOverviewTab.jsx`:

- Remove the view mode state: `const [viewMode, setViewMode] = useState('ALL')`
- Remove the `<ViewModeSelector>` or equivalent button group UI
- Remove the filtering logic that scopes transactions/invoices by internal vs external client

### 4.2 — Simplify `calculatePeriodMetrics`

In `src/utils/finance.js`, if `calculatePeriodMetrics` accepts a `viewMode` parameter or filters by internal/external, remove that parameter. The function should always operate on all transactions passed to it — the caller no longer filters by client type.

### 4.3 — Update Overview KPI card labels

The 4th KPI card currently toggles between "Pending invoices total" (external view) and "Next upcoming subscription billing" (internal view). Since there's only one view now:

Show: **Pending Invoices** — total of all SENT + OVERDUE invoices across all clients.

```jsx
// 4th KPI card — always shows pending invoices
<KpiCard
  label="PENDING INVOICES"
  value={formatCurrency(pendingInvoicesTotal)}
  subLabel={`${pendingCount} unpaid`}
  highlight={pendingCount > 0}
/>
```

**✅ Phase 4 complete when:**

- [ ] Finance Overview shows no view mode toggle
- [ ] All KPI values reflect agency-wide data (same as old "Combined View")
- [ ] Profitability Trend chart is always agency-wide
- [ ] No reference to `viewMode`, `INTERNAL`, `CLIENTS` filter in FinancialOverviewTab

---

## Phase 5 — Clean Up Dashboard Financial Widgets

**Files**: `src/pages/dashboard/Dashboard.jsx`

Dashboard financial widgets already pull from agency-wide data. The only change here is the **Client Health Grid** at the bottom of the dashboard.

### 5.1 — Remove financial metrics from Client Health Grid

The Client Health Grid currently shows per-client stats including pipeline and financial data. Remove:

- Total Revenue / Monthly Burn from each client card in this grid

Keep:

- Client name + logo
- Pipeline health (post counts, urgency status)
- Next drop date

The grid's purpose is content pipeline health, not financial health. Financial health is in `/finance`.

### 5.2 — Verify Dashboard KPI bar still works

The top KPI bar (Net Profit, Revenue, Expenses, Active Clients) pulls from `useFinanceOverview()` or `calculatePeriodMetrics` on all transactions. This should still work without changes since those hooks are agency-wide already.

Run a quick sanity check: confirm `useFinanceOverview` in `transactions.js` does NOT filter by `is_internal` anywhere. If it does, remove that filter.

**✅ Phase 5 complete when:**

- [ ] Dashboard Client Health Grid shows no per-client financial figures
- [ ] Dashboard KPI bar still shows correct agency-wide figures
- [ ] No broken queries or undefined values in dashboard financial widgets

---

## Phase 6 — Database Cleanup (via Supabase MCP)

Use the Supabase MCP to execute these. **Read-only views can be dropped safely — they have no FK dependencies.**

### 6.1 — Drop unused DB view

```sql
-- Safe to drop — no longer consumed by any hook after Phase 2
DROP VIEW IF EXISTS view_client_profitability;
```

### 6.2 — Verify `view_finance_overview` is not broken

The `view_finance_overview` view is marked as "legacy — currently unused in favour of client-side calc" in the finance architecture doc. Confirm `useFinanceOverview()` in `transactions.js` either:

- Still reads this view correctly (acceptable to keep), OR
- Has already been replaced by client-side calc (then drop the view too)

```sql
-- Check if view still exists and has data
SELECT * FROM view_finance_overview LIMIT 1;

-- If unused, drop it
DROP VIEW IF EXISTS view_finance_overview;
```

### 6.3 — Do NOT drop any tables

Do not drop `transactions`, `invoices`, `invoice_items`, `expenses`, or any column on `clients`. The `client_id` FK on transactions/invoices is still valid and needed (it just means "source/attribution" now, not "this client's financial entity").

**✅ Phase 6 complete when:**

- [ ] `view_client_profitability` is dropped
- [ ] No 404 or DB errors on Finance Overview, Ledger, Invoices, Subscriptions pages
- [ ] `view_finance_overview` confirmed as either in-use (keep) or unused (drop)

---

## Subscription Tier Considerations

After this refactor, finance gating in the subscription enforcement doc (`05-subscription-enforcement.md`) remains valid as written. Map cleanly:

| Flag                    | What it gates                               | Tier      |
| ----------------------- | ------------------------------------------- | --------- |
| `finance_invoicing`     | `/finance/invoices` page + Invoice creation | Velocity+ |
| `finance_subscriptions` | `/finance/subscriptions` page               | Velocity+ |
| `finance_reports`       | Profitability Trend chart on Overview       | Velocity+ |
| `finance_cfo_analysis`  | Accrual toggle, advanced KPIs               | Quantum   |

The new `ClientBillingTab` (Phase 2) should also be gated:

```jsx
// In ClientBillingTab.jsx
const { can } = useSubscription()
if (!can.financeInvoicing()) {
  return <LockedPage featureKey="finance_invoicing" />
}
```

This is consistent — if you can't use Invoices globally, you can't see the per-client billing tab either.

---

## Future Feature Compatibility

This architecture cleanly accommodates planned features without re-opening the finance complexity question:

**Campaigns with budgets (Phase 6 in enforcement doc)**
Budget tracking per campaign is a _content operations_ concern, not a finance ledger concern. Store it on the campaign record itself (`campaigns.budget_inr`, `campaigns.spend_inr`). Do not pipe it into the `transactions` table. Show it only within the campaign detail view.

**Proposals**
Proposal values (deal size) are sales pipeline data, not ledger data. A proposal accepted → manually create an invoice. The link is intentional human action, not automatic.

**Client Budget Management (if ever needed)**
If a future tier wants to let agencies manage ad spend on behalf of clients, this should be a new table (`client_budget_entries`) completely separate from `transactions`. It never touches the agency ledger. It lives inside the client detail page under a new "Ad Budget" tab. Do not retrofit this into the existing finance tables.

---

## Phase 7 — Invoice Categories (Replace Hardcoded "Client Payment")

**Files**: `src/api/invoices.js`, `src/pages/finance/CreateInvoiceDialog.jsx`, `src/pages/finance/EditInvoiceDialog.jsx`, Supabase (via MCP)

Right now every invoice-generated ledger entry is hardcoded with `category: 'Client Payment'` regardless of the type of work. This makes the ledger meaningless for breakdown analysis. Fix it by adding a `category` field to invoices and passing it through to the auto-created transaction.

### 7.1 — Add `category` column to `invoices` table (Supabase MCP)

```sql
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Retainer'
    CHECK (category IN ('Retainer', 'Project Fee', 'Ad Management', 'Other'));
```

### 7.2 — Add category selector to `CreateInvoiceDialog` and `EditInvoiceDialog`

Add a required dropdown field labelled "Income Type" with four options:

- **Retainer** — Monthly or recurring fixed fee (default)
- **Project Fee** — One-off project delivery
- **Ad Management** — Paid media / ad budget management fee
- **Other** — Anything else

This field maps directly to `invoices.category`. It is required — do not allow invoice creation without selecting a category.

### 7.3 — Pass invoice category to the auto-created transaction

In `src/api/invoices.js`, in the `useUpdateInvoice` mutation where a transaction is auto-created on PAID status, replace the hardcoded category string:

```javascript
// BEFORE
category: 'Client Payment',

// AFTER
category: invoice.category ?? 'Retainer',
description: `Payment received — ${invoice.invoice_number} (${invoice.client?.name}) — ${invoice.category}`,
```

This means the Ledger will now show entries like:

- "Payment received — INV-2026-003 (Nova Corps) — Retainer"
- "Payment received — INV-2026-004 (Sinister Six) — Project Fee"

### 7.4 — Update `InvoicesTab` to show category column

In `src/pages/finance/InvoicesTab.jsx`, add a Category column to the invoice table between Client and Issue Date. Show the category as a small badge or plain text label.

**✅ Phase 7 complete when:**

- [ ] `invoices` table has `category` column in Supabase
- [ ] Create/Edit invoice dialogs show Income Type dropdown (required)
- [ ] Existing invoices without a category display "Retainer" as default
- [ ] Auto-created ledger transaction inherits category from invoice
- [ ] Ledger entries show descriptive descriptions including category
- [ ] Invoice list table shows category column

---

## Phase 8 — Recurring Invoices (Retainer Flow)

**Files**: Supabase (via MCP), `src/api/invoices.js`, new `src/pages/finance/RecurringInvoiceDialog.jsx`, `src/pages/finance/InvoicesTab.jsx`, `src/pages/clients/ClientBillingTab.jsx`

The most common income type for a social media agency is a fixed monthly retainer. Currently there is no recurring invoice concept — the agency must manually create a fresh invoice every month per client. This phase adds a lightweight retainer template system that mirrors how Subscriptions work for expenses.

### 8.1 — Create `recurring_invoices` table (Supabase MCP)

```sql
CREATE TABLE IF NOT EXISTS recurring_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  amount NUMERIC(12, 2) NOT NULL,
  category TEXT NOT NULL DEFAULT 'Retainer'
    CHECK (category IN ('Retainer', 'Project Fee', 'Ad Management', 'Other')),
  description TEXT,
  billing_cycle TEXT NOT NULL DEFAULT 'MONTHLY'
    CHECK (billing_cycle IN ('MONTHLY', 'QUARTERLY', 'YEARLY')),
  next_invoice_date DATE NOT NULL,
  payment_terms TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: users can only see their own recurring invoices
ALTER TABLE recurring_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own recurring invoices"
  ON recurring_invoices FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

### 8.2 — Add hooks to `src/api/invoices.js`

Add these hooks alongside the existing invoice hooks:

```javascript
// Query: fetch all recurring invoices (optionally filtered by clientId)
export function useRecurringInvoices(filters = {}) { ... }

// Mutation: create a recurring invoice template
export function useCreateRecurringInvoice() { ... }

// Mutation: update a recurring invoice template
export function useUpdateRecurringInvoice() { ... }

// Mutation: delete a recurring invoice template
export function useDeleteRecurringInvoice() { ... }

// Mutation: generate a real invoice from a recurring template
// - Creates a new invoice pre-filled with the template's client, amount, category, description
// - Advances next_invoice_date by one billing cycle
// - Returns the new invoice id so the UI can open it immediately
export function useGenerateFromRecurring() {
  // On success:
  // 1. Insert new invoice row using template values
  // 2. Insert invoice_items row (single line item: template.description, qty 1, template.amount)
  // 3. Call advance_recurring_invoice_date RPC (see 8.3) to move next_invoice_date forward
  // 4. Invalidate invoiceKeys.all and recurringInvoiceKeys.all
}
```

### 8.3 — Create Supabase RPC to advance next_invoice_date (Supabase MCP)

```sql
CREATE OR REPLACE FUNCTION advance_recurring_invoice_date(p_recurring_invoice_id UUID)
RETURNS VOID AS $$
DECLARE
  rec recurring_invoices%ROWTYPE;
BEGIN
  SELECT * INTO rec FROM recurring_invoices WHERE id = p_recurring_invoice_id;

  UPDATE recurring_invoices
  SET next_invoice_date = CASE rec.billing_cycle
    WHEN 'MONTHLY'    THEN rec.next_invoice_date + INTERVAL '1 month'
    WHEN 'QUARTERLY'  THEN rec.next_invoice_date + INTERVAL '3 months'
    WHEN 'YEARLY'     THEN rec.next_invoice_date + INTERVAL '1 year'
  END
  WHERE id = p_recurring_invoice_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 8.4 — Add Recurring tab to `InvoicesTab`

In `src/pages/finance/InvoicesTab.jsx`, add a "Recurring" tab alongside the existing invoice status tabs (All / Draft / Sent / Paid / Overdue).

The Recurring tab shows a table of active recurring invoice templates with columns:

- Client
- Amount
- Category
- Cycle (Monthly / Quarterly / Yearly)
- Next Invoice Date
- Status (Active / Paused toggle)
- Actions: Generate Invoice (primary), Edit, Delete

**"Generate Invoice" button behaviour:**

1. Calls `useGenerateFromRecurring(recurringInvoice.id)`
2. On success — opens the newly created invoice in `EditInvoiceDialog` so the agency can review/adjust before sending
3. Shows a toast: "Invoice created for [Client Name] — ₹[amount]"

**Visual indicator for due/overdue templates:**

- If `next_invoice_date` is today or in the past → show an amber "Due" badge next to the client name
- This prompts the agency to generate the invoice without them having to remember

### 8.5 — Show recurring templates on `ClientBillingTab`

In `src/pages/clients/ClientBillingTab.jsx`, below the invoice list, add a small "Recurring Setup" section showing the active recurring templates for this client (filtered by `clientId`).

Each row shows: amount, cycle, next invoice date, Generate Invoice button.

This lets the agency see and trigger retainer invoices directly from the client detail page without navigating to `/finance/invoices`.

**✅ Phase 8 complete when:**

- [ ] `recurring_invoices` table exists in Supabase with RLS enabled
- [ ] `advance_recurring_invoice_date` RPC exists in Supabase
- [ ] `useRecurringInvoices`, `useCreateRecurringInvoice`, `useGenerateFromRecurring` hooks exist
- [ ] Invoices page has Recurring tab with template list
- [ ] Due/overdue templates show amber badge
- [ ] Generate Invoice creates a real invoice and advances next date
- [ ] ClientBillingTab shows recurring setup for that client
- [ ] Active/Paused toggle works on templates

---

## Phase 9 — Income Entry Rule Enforcement in Ledger

**Files**: `src/pages/finance/AddTransactionDialog.jsx`

The rule established: **all client income must flow through an invoice**. Manual INCOME entries in the Ledger should only be for non-client income (grants, rebates, miscellaneous agency income with no client source). If a client is selected on a manual INCOME entry, it means the agency is bypassing the invoice system — this creates an inconsistent audit trail.

### 9.1 — Block client-attributed manual income entries

In `AddTransactionDialog.jsx`, add a conditional check when:

- Transaction `type` is `INCOME`, AND
- A `client_id` is selected (not null / not "agency")

Show an inline warning replacing the Save button:

```jsx
{
  type === 'INCOME' && clientId && clientId !== 'agency' ? (
    <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
      <p className="font-medium">Use an invoice to record client income.</p>
      <p className="mt-1 text-xs">
        Income from clients should be recorded by creating an invoice and
        marking it as paid. This keeps your ledger accurate and gives you a
        proper audit trail.
      </p>
      <div className="mt-3 flex gap-2">
        <Button size="sm" asChild>
          <Link to="/finance/invoices">Create Invoice</Link>
        </Button>
        <Button size="sm" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </div>
  ) : (
    <Button type="submit">Save Transaction</Button>
  )
}
```

### 9.2 — Allow manual INCOME only for agency-level entries

When `type` is `INCOME` and no client is selected (or "Agency / Internal" is selected), the form submits normally. This covers:

- Grants received
- Rebates
- Miscellaneous non-client income

The client selector on INCOME type entries should default to blank / "No client" and show helper text: "For client income, use Invoices instead."

### 9.3 — Update the EXPENSE flow (no change needed, just confirm)

EXPENSE entries are unaffected. An expense can be attributed to a client (it means "this cost is associated with serving this client") and always allows manual entry. No invoice required for expenses.

**✅ Phase 9 complete when:**

- [ ] Creating an INCOME transaction with a client selected shows the warning + invoice CTA
- [ ] Save button is hidden/disabled when client-attributed income is attempted
- [ ] Creating an INCOME transaction with no client selected works normally
- [ ] EXPENSE entries are fully unaffected
- [ ] Existing ledger entries are not modified (this is UI-only enforcement, no data migration)

---

## Files to Touch (Summary)

| File                                                 | Action                                                                                                                                          |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/pages/clients/Clients.jsx`                      | Remove `useAllClientsMetrics`, remove financial fields from client cards                                                                        |
| `src/pages/clients/ClientDetails.jsx`                | Replace Financials tab with Billing tab; hide for internal account                                                                              |
| `src/pages/clients/ClientBillingTab.jsx`             | **Create new** — invoice list + collected/outstanding + recurring templates                                                                     |
| `src/pages/clients/MyOrganization.jsx` (if separate) | Remove Financials tab and financial summary card                                                                                                |
| `src/api/clients.js`                                 | Remove `useClientMetrics`, `useAllClientsMetrics`                                                                                               |
| `src/api/invoices.js`                                | Add recurring invoice hooks; fix auto-transaction category                                                                                      |
| `src/pages/finance/FinancialOverviewTab.jsx`         | Remove view mode toggle and filter logic                                                                                                        |
| `src/pages/finance/InvoicesTab.jsx`                  | Add category column; add Recurring tab                                                                                                          |
| `src/pages/finance/CreateInvoiceDialog.jsx`          | Add Income Type (category) dropdown                                                                                                             |
| `src/pages/finance/EditInvoiceDialog.jsx`            | Add Income Type (category) dropdown                                                                                                             |
| `src/pages/finance/AddTransactionDialog.jsx`         | Block client-attributed manual INCOME entries                                                                                                   |
| `src/pages/finance/RecurringInvoiceDialog.jsx`       | **Create new** — create/edit recurring invoice template form                                                                                    |
| `src/utils/finance.js`                               | Remove `viewMode` parameter from `calculatePeriodMetrics` if present                                                                            |
| `src/pages/dashboard/Dashboard.jsx`                  | Remove financial metrics from Client Health Grid                                                                                                |
| Supabase (via MCP)                                   | Drop `view_client_profitability`; verify `view_finance_overview`; add `invoices.category` column; create `recurring_invoices` table + RLS + RPC |

## Files to NOT touch

| File                                          | Reason                                  |
| --------------------------------------------- | --------------------------------------- |
| `src/api/transactions.js`                     | No changes needed — already agency-wide |
| `src/api/expenses.js`                         | No changes needed                       |
| `src/pages/finance/LedgerTab.jsx`             | No changes needed                       |
| `src/pages/finance/SubscriptionsTab.jsx`      | No changes needed                       |
| `src/pages/dashboard/Dashboard.jsx` (KPI bar) | No changes needed — already agency-wide |

---

## Verification Checklist (End-to-End)

Run through this after all phases are complete:

- [ ] `/clients` — no financial figures on any client card
- [ ] `/clients/:externalId` — Billing tab shows invoices + totals + recurring templates. No profit/MRR/margin.
- [ ] `/clients/:internalId` (My Organization) — No Billing or Financials tab. Finance Hub link shown.
- [ ] `/finance/overview` — No view mode toggle. All KPIs show agency-wide figures.
- [ ] `/finance/invoices` — Invoice list shows category column. Recurring tab shows templates with due indicators.
- [ ] `/finance/invoices` → Create Invoice — Income Type dropdown present and required.
- [ ] `/finance/invoices` → Recurring → Generate Invoice — creates invoice, advances next date, opens edit dialog.
- [ ] `/finance/ledger` — INCOME entry with a client selected shows warning + invoice CTA, not a save button.
- [ ] `/finance/ledger` — INCOME entry with no client selected saves normally.
- [ ] `/finance/ledger` — EXPENSE entries unaffected, all work normally.
- [ ] `/finance/subscriptions` — Works normally, no changes.
- [ ] `/dashboard` — KPI bar shows correct figures. Client Health Grid shows no financial data.
- [ ] Supabase — `view_client_profitability` dropped. `recurring_invoices` table exists. `invoices.category` column exists. RPC `advance_recurring_invoice_date` exists.
- [ ] Subscription enforcement — `ClientBillingTab` shows LockedPage for Ignite users.
