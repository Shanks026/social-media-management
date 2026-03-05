# Finance Module — Overview & Architecture
**Location**: `src/pages/finance/` + `src/api/`
**Last Analysed**: March 2026
**Purpose**: Reference document for the Finance Hub — data model, flow, hooks, tables, and internal/external distinctions.

---

## 1. Route Structure

```
/finance                    → FinanceLayout.jsx (Outlet wrapper only)
  /finance/overview         → FinancialOverviewTab.jsx
  /finance/subscriptions    → SubscriptionsTab.jsx
  /finance/ledger           → LedgerTab.jsx
  /finance/invoices         → InvoicesTab.jsx
```

Finance is also embedded inside client detail pages (the same tab components are reused with a `clientId` prop to scope data).

---

## 2. Internal vs. External Client Distinction

Every financial record (transaction, expense, invoice) can be associated with a **client**. Clients fall into two categories:

| Type | `clients.is_internal` | Meaning |
|------|----------------------|---------|
| Internal Account | `true` | Represents the agency itself — operational costs, software subscriptions, internal transfers |
| External Client | `false` | A real paying client — generates revenue, invoices, and client-side expenses |

The internal account is a **regular `clients` row** with `is_internal = true`. There is exactly one per user. When `client_id` on a transaction/expense is `null`, it is also treated as internal/agency-level.

### How Views Filter

The global `FinancialOverviewTab` exposes a **view mode** selector with three options:

| Mode | Filter Logic |
|------|-------------|
| **Combined View** (`ALL`) | No filtering — all transactions, expenses, invoices |
| **Agency Only** (`INTERNAL`) | `client_id === internalAccount.id` OR `client_id === null` |
| **Client Projects** (`CLIENTS`) | `client_id IS NOT NULL` AND `client_id !== internalAccount.id` |

---

## 3. Database Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `transactions` | Raw ledger entries — income and expenses | `id`, `user_id`, `client_id`, `invoice_id`, `type` (INCOME/EXPENSE), `amount`, `date`, `category`, `description`, `status` (PAID/PENDING/OVERDUE) |
| `expenses` | Recurring/subscription costs | `id`, `user_id`, `assigned_client_id`, `name`, `cost`, `billing_cycle` (MONTHLY/QUARTERLY/YEARLY), `next_billing_date`, `category`, `is_active` |
| `invoices` | Client-facing invoices | `id`, `user_id`, `client_id`, `invoice_number`, `status` (DRAFT/SENT/PAID/OVERDUE), `issue_date`, `due_date`, `subtotal`, `total`, `category`, `notes`, `payment_terms`, `pdf_url` |
| `invoice_items` | Line items for invoices | `id`, `invoice_id`, `transaction_id`, `description`, `quantity`, `unit_price`, `total` |
| `agency_subscriptions` | Agency plan config + invoice counter | `user_id`, `next_invoice_number`, `plan_name`, `max_clients`, `current_storage_used`, `max_storage_bytes`, `basic_whitelabel_enabled`, `full_whitelabel_enabled` |
| `clients` | Client records (internal + external) | `id`, `user_id`, `name`, `is_internal`, `logo_url`, `email` |

### Database Views

| View | Purpose | Used By |
|------|---------|---------|
| `view_finance_overview` | Aggregated totals: `total_income`, `total_one_off_expenses`, `monthly_recurring_burn` | `useFinanceOverview()` (legacy — currently unused in favour of client-side calc) |
| `view_monthly_burn_rate` | Monthly burn from active expenses | `useBurnRate()` |
| `view_client_profitability` | Per-client profitability metrics | `useClientMetrics()`, `useAllClientsMetrics()` |

---

## 4. API Layer — Hooks & Functions

### `src/api/transactions.js`

| Export | Type | Description |
|--------|------|-------------|
| `transactionKeys` | Key factory | `all`, `list(filters)`, `overview()` |
| `useTransactions(filters)` | Query hook | Fetch list with optional `clientId`, `startDate`, `endDate`, `limit`. Joins `client` (id, name, logo_url, is_internal) |
| `useFinanceOverview()` | Query hook | Reads `view_finance_overview` for aggregated totals |
| `useCreateTransaction()` | Mutation | Insert to `transactions`. Sanitises `client_id` — empty/`'agency'` → `null` |
| `useUpdateTransaction()` | Mutation | Update transaction by `id`. Same sanitisation |
| `useDeleteTransaction()` | Mutation | Delete by `id`. Invalidates `transactionKeys.all` |

### `src/api/invoices.js`

| Export | Type | Description |
|--------|------|-------------|
| `invoiceKeys` | Key factory | `all`, `list(filters)`, `detail(id)`, `nextNumber()` |
| `useInvoices(filters)` | Query hook | Fetch list with optional `clientId`, `status`. Joins `client` |
| `useInvoice(id)` | Query hook | Fetch single invoice + its `invoice_items` |
| `useNextInvoiceNumber()` | Query hook | Reads `agency_subscriptions.next_invoice_number`, formats as `INV-YYYY-NNN` |
| `useCreateInvoice()` | Mutation | Multi-step: get+format invoice number → insert `invoices` → insert `invoice_items` → increment `next_invoice_number` on `agency_subscriptions` |
| `useUpdateInvoice()` | Mutation | Update invoice + optionally replace line items. **Auto-creates INCOME transaction on PAID**. **Deletes linked transaction if reverted from PAID** |
| `useDeleteInvoice()` | Mutation | Delete invoice (cascades to `invoice_items` and linked `transactions` via FK ON DELETE CASCADE) |

### `src/api/expenses.js`

| Export | Type | Description |
|--------|------|-------------|
| `expenseKeys` | Key factory | `all`, `list(filters)`, `burnRate()` |
| `useExpenses(filters)` | Query hook | Fetch list with optional `clientId`. Joins `assigned_client` |
| `useBurnRate()` | Query hook | Reads `view_monthly_burn_rate.total_monthly_burn` |
| `useCreateExpense()` | Mutation | Insert to `expenses`. Sanitises `assigned_client_id` — `'myself'`/empty → `null` |
| `useUpdateExpense()` | Mutation | Update expense by `id` |
| `useDeleteExpense()` | Mutation | Delete by `id` |
| `useRenewSubscription()` | Mutation | Calls RPC `advance_expense_billing_date(expense_id)` to advance `next_billing_date` |

### `src/api/useSubscription.js`

| Export | Type | Description |
|--------|------|-------------|
| `useSubscription()` | Query hook | Reads `agency_subscriptions` + counts external clients. Returns plan name, whitelabel flags, client count vs max, and formatted storage usage (MB/GB display, % used, remaining label) |

### `src/api/clients.js` (finance-relevant)

| Export | Type | Description |
|--------|------|-------------|
| `useClients()` | Query hook | Returns `{ internalAccount, realClients[] }` — used throughout finance to separate internal vs external |
| `useClientMetrics(clientId)` | Query hook | Reads `view_client_profitability` for a single client |
| `useAllClientsMetrics()` | Query hook | Reads all rows from `view_client_profitability` |

---

## 5. Transaction ↔ Invoice Relationship

```
invoices
  └── invoice_items (invoice_id FK, optional transaction_id FK)
  └── transactions  (invoice_id FK — auto-created on PAID, cascade-deleted with invoice)
```

### Invoice → Transaction lifecycle

1. **Invoice created** → no transaction yet
2. **Invoice → SENT** → no transaction
3. **Invoice → PAID** → `useUpdateInvoice` auto-inserts an INCOME transaction:
   - `type: 'INCOME'`
   - `amount: invoice.total`
   - `category: 'Client Payment'`
   - `description: 'Payment received — INV-YYYY-NNN (Client Name)'`
   - `invoice_id: invoice.id` (FK link)
4. **Invoice reverted from PAID** → linked transaction is deleted
5. **Invoice deleted** → `invoice_items` and linked `transactions` cascade-deleted via DB FK

### Transaction categories (manual entry)

Transactions can also be created manually (no invoice) via the Ledger. The `client_id = null` or `client_id = 'agency'` sentinel is normalised to `null` on save.

---

## 6. Subscription / Expense Flow

Expenses represent **recurring costs** (software, tools, retainers). They are separate from one-off transactions.

```
expenses
  ├── billing_cycle: MONTHLY | QUARTERLY | YEARLY
  ├── next_billing_date (advanced by advance_expense_billing_date RPC on renewal)
  ├── assigned_client_id → FK to clients (nullable = agency-level)
  └── is_active (toggle to pause without deleting)
```

**Burn rate calculation** (client-side, `src/utils/finance.js`):
- MONTHLY: `cost × 1`
- QUARTERLY: `cost ÷ 3`
- YEARLY: `cost ÷ 12`

Only `is_active = true` expenses are counted. The "Mark as Paid" action in SubscriptionsTab calls `advance_expense_billing_date` (RPC) to roll `next_billing_date` forward without creating a transaction (subscriptions ≠ ledger entries).

---

## 7. Financial Overview Calculation (Client-Side)

`FinancialOverviewTab` does **not** rely solely on the DB view. It fetches raw transactions + expenses + invoices and computes metrics in `calculatePeriodMetrics()` (`src/utils/finance.js`):

### Two accounting methods

| Method | Revenue counts | Use case |
|--------|---------------|----------|
| **Cash** | Only `PAID` INCOME transactions in period | Actual money received |
| **Accrual** | All INCOME transactions + SENT/OVERDUE invoices (deduped by invoice_id) | Earned revenue |

### KPI Cards

| Card | External view | Internal (agency) view |
|------|--------------|----------------------|
| Net Profit | Revenue − (one-off + recurring burn) | Same (labelled "Operational savings") |
| Revenue | Cash inflow / Invoiced this month | Same |
| Expenses | One-offs + subscriptions | Same |
| 4th card | Pending invoices total | Next upcoming subscription billing |

---

## 8. Invoice Number Sequencing

Invoice numbers are globally sequential per user:
- Stored in `agency_subscriptions.next_invoice_number` (integer)
- Formatted as `INV-{YEAR}-{NNN}` on creation (e.g. `INV-2026-007`)
- Incremented atomically during `useCreateInvoice` mutation (read → insert → increment)
- No server-side sequence — race condition risk if two invoices are created simultaneously (known MVP limitation)

---

## 9. Billing Page (Agency's Own Subscription)

`/billing` → `BillingUsage` page is **separate from `/finance`**. It shows:
- Tercero plan name and limits
- Client count vs `max_clients`
- Storage used vs `max_storage_bytes`
- Whitelabel status flags

This uses `useSubscription()` and reads only `agency_subscriptions`. It has no link to the finance ledger, invoices, or client money flow.

---

## 10. Files Reference

```
src/
├── api/
│   ├── transactions.js     — Transaction CRUD + finance overview query
│   ├── invoices.js         — Invoice CRUD + auto-transaction logic
│   ├── expenses.js         — Expense/subscription CRUD + burn rate
│   ├── useSubscription.js  — Agency plan + storage usage
│   └── clients.js          — useClients() (internal/external split)
├── pages/finance/
│   ├── FinanceLayout.jsx         — Route wrapper (Outlet + breadcrumb)
│   ├── FinancialOverviewTab.jsx  — KPI dashboard, profitability chart
│   ├── SubscriptionsTab.jsx      — Recurring expenses table + burn rate
│   ├── LedgerTab.jsx             — Transaction ledger table
│   ├── InvoicesTab.jsx           — Invoice list + stats
│   ├── AddTransactionDialog.jsx  — Create/edit transaction form
│   ├── AddSubscriptionDialog.jsx — Create/edit expense form
│   ├── CreateInvoiceDialog.jsx   — New invoice + line items form
│   └── EditInvoiceDialog.jsx     — Edit existing invoice
└── utils/
    └── finance.js          — calculatePeriodMetrics(), calculateRecurringBurn(), formatCurrency()
```
