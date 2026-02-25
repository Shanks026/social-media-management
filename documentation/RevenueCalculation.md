# Revenue Calculation — Research Observations

> Last updated: 2026-02-25
> Author: Research via Supabase MCP + codebase analysis

---

## Overview

The application has **three distinct financial contexts**, each calculating profit/revenue/expenses differently and serving a different purpose.

---

## The Three Financial Contexts

### 1. Finance Page → "All" Tab (`FinancialOverviewTab.jsx`, `viewMode = 'ALL'`)

**Purpose:** Shows the **total consolidated P&L for the entire agency**.

**Data Sources:**

- `useTransactions()` — All transactions across all clients (no `client_id` filter)
- `useExpenses()` — All recurring expenses across the agency (no `assigned_client_id` filter)

**Calculation (via `calculatePeriodMetrics` in `utils/finance.js`):**

```
Revenue       = SUM of all INCOME transactions this month with status = 'PAID' (CASH mode)
One-off Cost  = SUM of all EXPENSE transactions this month
Recurring     = SUM of all expenses (normalized to monthly)
Net Profit    = Revenue − One-off Cost − Recurring
Margin        = (Net Profit / Revenue) × 100
```

> ✅ This is the true "agency bank account" view. If Client A pays ₹50K and Client B pays ₹30K, this tab shows ₹80K revenue. All agency overhead (subscriptions, tools, salaries) is deducted here.

---

### 2. Internal Client Profile Card (`clientSections/OverviewTab.jsx`, `client.is_internal = true`)

**Purpose:** Shows the **agency's overall financial health** — the same consolidated picture as Finance → All, but surfaced inside the internal account profile for convenience.

**Data Sources (after fix):**

- `useTransactions()` — All transactions, no `clientId` filter, scoped to current month
- `useExpenses()` — All expenses, no `clientId` filter

**Calculation:**

```
Revenue       = SUM of all INCOME transactions (this month, status = PAID)
Expenses      = SUM of all EXPENSE transactions + SUM of all recurring (normalized to monthly)
Net Profit    = Revenue − Expenses
```

> ✅ This is the correct interpretation for the internal account. The agency earns money FROM its clients — so the income recorded for Client A (retainer payments) IS the agency's income. Showing only "internally-tagged" transactions would be misleading.

**Previous (incorrect) behavior:**
Previously, the internal client card read from `view_client_profitability` filtered by `client_id = internal_id`. This only included transactions where you explicitly tagged the internal account, which would typically be near-zero or only show agency overhead income (e.g., non-client income like investment). This was misleading.

---

### 3. External Client Profile Card (`clientSections/OverviewTab.jsx`, `client.is_internal = false`)

**Purpose:** Shows the **agency's profitability ON this specific client relationship**.

**Data Sources:**

- `useClientMetrics(clientId)` → reads from `view_client_profitability` SQL view

**SQL View Logic (`view_client_profitability`):**

```sql
client_revenue  = SUM(amount) WHERE type = 'INCOME' AND client_id = X
client_expenses = SUM(amount) WHERE type = 'EXPENSE' AND client_id = X
client_recurring = SUM(monthly_cost) FROM expenses WHERE assigned_client_id = X

-- Exposed fields:
total_revenue           → what you've billed/earned from this client
one_off_costs           → one-time expenses you incurred for this client
monthly_recurring_costs → subscriptions/tools assigned to this client
```

**Net Profit for external client:**

```
Net Profit = total_revenue − one_off_costs − monthly_recurring_costs
```

> ⚠️ **Important Interpretation:** This is NOT the client's own profit. It is the **agency's profitability on the relationship with that client**. A ₹5K/month net profit for "Client A" means: after all costs to service them, you keep ₹5K per month from that engagement.

---

## Database Views Used

| View                        | Purpose                                                      | Filters By  |
| --------------------------- | ------------------------------------------------------------ | ----------- |
| `view_finance_overview`     | All-time total income vs one-off expense + monthly recurring | `user_id`   |
| `view_client_profitability` | Per-client revenue, one-off cost, and recurring cost         | `client_id` |
| `view_monthly_burn_rate`    | Total monthly burn from all recurring `expenses`             | `user_id`   |

---

## Financial Tables & Their Roles

| Table           | Purpose                                           | Key Field                                                                   |
| --------------- | ------------------------------------------------- | --------------------------------------------------------------------------- |
| `transactions`  | Manual one-time income or expense entries         | `client_id` (nullable), `type = INCOME/EXPENSE`                             |
| `expenses`      | Recurring subscriptions/tools with billing cycle  | `assigned_client_id` (nullable), `billing_cycle = MONTHLY/QUARTERLY/YEARLY` |
| `invoices`      | Formal billing documents sent to external clients | `client_id` (always external)                                               |
| `invoice_items` | Line items within an invoice                      | Linked to `invoice_id`, optionally `transaction_id`                         |

---

## Transaction `client_id` Values — What They Mean

| `client_id` value    | Meaning                                                                      |
| -------------------- | ---------------------------------------------------------------------------- |
| `null`               | Agency-level entry (not tied to any specific client or the internal account) |
| `internal_client.id` | Explicitly tagged to the agency's own account                                |
| `externalClient.id`  | Tied to a specific paying client engagement                                  |

> **Note:** Null-tagged transactions are included in the Finance → All view and in the internal client card consolidated view, since they represent unallocated agency activity (e.g., a general bank transfer, untagged subscription).

---

## Cash vs. Accrual Accounting (Finance Page Only)

The Finance Overview page supports two accounting modes, controlled by a toggle. This is **only relevant for external clients** (invoice-based billing):

| Mode        | Revenue Definition                                                               |
| ----------- | -------------------------------------------------------------------------------- |
| **CASH**    | Only includes PAID transactions within the period                                |
| **ACCRUAL** | Includes PAID transactions + SENT/OVERDUE invoices (billed but not yet received) |

> The accrual toggle is **hidden for the internal account** because the agency doesn't invoice itself.

---

## Correct Mental Model

```
Agency Total Revenue (Finance → All)
= Client A monthly retainer
+ Client B project fee
+ Client C setup fee
+ Any other INCOME transactions (null or internal tagged)

Agency Total Expenses (Finance → All)
= All EXPENSE transactions
+ All recurring expenses (Figma, Slack, etc.) — normalized to monthly

Agency Net Profit = Revenue − Expenses
```

The **internal client card now mirrors this view** (consolidated), while each **external client card** shows only its own contribution to agency revenue and costs.

---

## Edge Cases & Known Behaviors

1. **Expenses with `assigned_client_id = null`** are included in Finance → All but NOT in any individual client's profitability view. They are correctly included in the consolidated internal client view.

2. **Double-counting prevention (Accrual mode):** The `view_finance_overview` and `calculatePeriodMetrics` both track `linkedInvoiceIds` — if an invoice is already marked PAID via a transaction, it is excluded from accrual calculation to prevent counting it twice.

3. **Recurring expenses** are normalized per month: QUARTERLY ÷ 3, YEARLY ÷ 12, MONTHLY as-is.
