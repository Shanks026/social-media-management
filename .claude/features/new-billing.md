# Billing & Invoice System — Deep Analysis
**Location**: `src/pages/finance/`, `src/api/invoices.js`, `src/api/transactions.js`
**Last Analysed**: March 2026
**Purpose**: Detailed breakdown of how billing, invoices, and financial calculations work across global, internal, and external client contexts.

---

## 1. Two Invoice Types

The system now has two parallel invoice tracks:

| Type | Table | Created By | Purpose |
|------|-------|-----------|---------|
| **One-off Invoice** | `invoices` + `invoice_items` | Manual creation via `CreateInvoiceDialog` | Standard billable work |
| **Recurring Template** | `recurring_invoices` | `RecurringInvoiceDialog` | Repeated periodic billing (retainers, subscriptions) |

These are surfaced as two tabs inside `InvoicesTab` — `one-off` and `recurring`.

---

## 2. Database Tables

### `invoices`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `user_id` | uuid | Agency owner |
| `client_id` | uuid FK → clients | External client only |
| `invoice_number` | text | `INV-YYYY-NNN`, sequential |
| `status` | enum | `DRAFT → SENT → PAID / OVERDUE` |
| `issue_date` | date | |
| `due_date` | date | |
| `category` | text | Retainer, Creative Project, etc. |
| `subtotal` | numeric | Sum of line items |
| `total` | numeric | = subtotal (no tax in MVP) |
| `notes` | text | Optional client-facing notes |
| `payment_terms` | text | Due on Receipt, Net 15/30/60 |
| `pdf_url` | text | Stored PDF URL (optional) |

### `invoice_items`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `invoice_id` | uuid FK → invoices | CASCADE DELETE |
| `transaction_id` | uuid FK → transactions | Optional link (for prefill flow) |
| `description` | text | Line item label |
| `quantity` | numeric | |
| `unit_price` | numeric | |
| `total` | numeric | `quantity × unit_price` |

### `recurring_invoices`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `user_id` | uuid | |
| `client_id` | uuid FK → clients | External clients only (dialog filters `realClients`) |
| `description` | text | Line item description for generated invoice |
| `amount` | numeric | Fixed amount per cycle |
| `category` | text | |
| `billing_cycle` | enum | `MONTHLY / QUARTERLY / YEARLY` |
| `next_invoice_date` | date | Advanced by RPC on generation |
| `payment_terms` | text | Used when generating real invoice |
| `notes` | text | |
| `is_active` | boolean | Togglable; inactive templates stay but can't be generated |

---

## 3. Invoice Number Sequencing

**Source**: `agency_subscriptions.next_invoice_number` (integer, per user)

**Format**: `INV-{YEAR}-{NNN}` → e.g. `INV-2026-007`

**Sequence on creation** (both one-off and generated from recurring):
1. Read `next_invoice_number` from `agency_subscriptions`
2. Format the number (`padStart(3, '0')`)
3. Insert invoice with this number
4. Update `agency_subscriptions.next_invoice_number += 1`

> **Known MVP limitation**: Steps 1–4 are not atomic. Concurrent invoice creation could produce duplicate invoice numbers. A server-side DB sequence or RPC would be safer.

---

## 4. One-off Invoice Lifecycle

```
CreateInvoiceDialog
  → useCreateInvoice()
    → Read next_invoice_number from agency_subscriptions
    → Insert into invoices (status: DRAFT)
    → Insert into invoice_items (one row per line item)
    → Increment next_invoice_number

InvoicesTab (one-off tab)
  → Mark as SENT   → useUpdateInvoice({ status: 'SENT' })
  → Mark as PAID   → useUpdateInvoice({ status: 'PAID' })
                       ↳ auto-inserts INCOME transaction in transactions table
                       ↳ transaction has invoice_id FK set
  → Revert from PAID → useUpdateInvoice({ status: anything else })
                         ↳ deletes linked transaction (by invoice_id)
  → Delete invoice → useDeleteInvoice()
                      ↳ CASCADE: deletes invoice_items + linked transaction
```

### Invoice → Transaction auto-creation fields (on PAID)
```js
{
  user_id: user.id,
  client_id: invoice.client_id,
  invoice_id: invoice.id,       // FK back to invoice
  type: 'INCOME',
  amount: invoice.total,
  date: today,
  category: invoice.category || 'Other',  // inherits invoice category, not hardcoded
  description: 'Payment received — INV-YYYY-NNN (Client Name)',
  status: 'PAID',
}
```

---

## 5. Recurring Invoice Lifecycle

```
RecurringInvoiceDialog
  → useCreateRecurringInvoice() → INSERT into recurring_invoices

InvoicesTab (recurring tab) — "Generate" button
  → useGenerateFromRecurring(templateId)
    → RPC: generate_invoice_from_template(p_template_id, p_user_id)
      ↳ atomic server-side operation (replaces previous multi-step client logic)
      ↳ returns new invoice UUID
    → Fetch full invoice row by returned UUID
    → Returns invoice → tab switches to 'one-off' and opens EditInvoiceDialog
```

> **Architecture change**: generation is now fully atomic via a single RPC call (`generate_invoice_from_template`). The previous client-side approach (fetch template → format number → insert invoice → insert item → increment counter → advance date) has been replaced. All those steps now happen in one server-side transaction, eliminating the race condition on `next_invoice_number`.

**Due date calculation on generation**: now handled server-side inside the `generate_invoice_from_template` RPC (previously client-side). Payment terms offsets (Net 15/30/60) are applied within the DB function.

---

## 6. Transaction Recording (Ledger)

### Via AddTransactionDialog

The transaction dialog is the direct ledger entry form. It handles both INCOME and EXPENSE entries.

**Client type awareness**: The dialog reads `useClients()` and knows which client is internal. It filters available categories accordingly:

| Context | INCOME categories excluded | EXPENSE categories excluded |
|---------|---------------------------|----------------------------|
| Internal client | Monthly Retainer, Setup/Onboarding, Performance Fee, Ad Budget Reimbursement, Creative Project | None |
| External client | None | Office/Rent, Taxes/Legal |
| No client selected | All INCOME categories | All EXPENSE categories |

**Invoice gate**: When `type === INCOME` AND a real external client is selected AND NOT in edit mode → a warning banner appears:
> *"Invoice required for client income"*

The "Create Invoice instead" button closes the transaction dialog and triggers the parent (`LedgerTab`) to open `CreateInvoiceDialog` with prefill data (client, category, amount, description). This enforces the pattern that **external client revenue should always flow through invoices**, not be logged directly.

---

## 7. Global Finance Overview — Calculation Logic

`FinancialOverviewTab` (updated) now fetches **all** data without client-scope filtering (no more internal/external view mode selector). The overview is always agency-wide.

### Data sources
```
useTransactions({})       → all transactions
useExpenses({})           → all expenses
useInvoices({})           → all invoices
```

### Accounting methods

| Method | Revenue = | Expense = |
|--------|-----------|-----------|
| **Cash** | PAID INCOME transactions in current month | One-off EXPENSE transactions + recurring burn |
| **Accrual** | All INCOME transactions + SENT/OVERDUE invoices (not already in a PAID tx) | Same |

Double-counting prevention in Accrual: a Set of `invoice_id`s from PAID transactions is built first. Any SENT/OVERDUE invoice whose `id` is in the set is skipped.

### KPI Cards (global view)
| Card | Value |
|------|-------|
| Net Profit | `revenue − (one-off expenses + monthly recurring burn)` |
| Revenue | Cash inflow or Invoiced this month (depending on method) |
| Expenses | One-off transaction expenses + recurring burn prorated to monthly |
| Pending Invoices | `pendingIncome (PENDING tx) + overdueIncome (OVERDUE tx) + outstanding invoice total (SENT+OVERDUE invoices)` |

### Chart
Bar chart of `income vs expenses` over 3M/6M/12M. Each month computed independently using same cash/accrual logic.

---

## 8. Invoice Display — Client vs Internal Scoping

### Global page (`/finance/invoices`)
- Fetches all invoices (no `clientId` filter)
- Shows client column in table
- Filters: status + client dropdown

### External client detail page (`/clients/:id/finance/invoices`)
- `clientId` prop passed to `InvoicesTab`
- Fetches `useInvoices({ clientId })`
- Client column hidden from table
- New Invoice button pre-selects the client (locked)
- Recurring template dialog also pre-selects client (locked)

### Internal client detail page
- Same `InvoicesTab` with `clientId` of the internal account
- Since `CreateInvoiceDialog` and `RecurringInvoiceDialog` both use `clientData?.realClients` (filtering `is_internal = false`), **invoices cannot be created for the internal account** through the normal UI — only external clients appear in the client dropdown
- Internal account overview shows "Next Subscription" KPI instead of "Pending Invoices"

---

## 9. Invoice PDF

Two paths for PDF:
1. **Download from list** (`handleDownloadPDF` in `InvoicesTab`): fetches `invoice_items` on demand (not included in list query), then calls `downloadInvoicePDF(invoice, subscription)`
2. **Live preview while creating** (`CreateInvoiceDialog`): renders `<HTMLInvoicePreview>` in real-time as form fields change. Uses `useSubscription()` to inject agency name/logo/whitelabel flags.

Agency branding on PDF comes from `agency_subscriptions`:
- `agency_name` — displayed as sender
- `logo_url` — shown on PDF header
- `basic_whitelabel_enabled` / `full_whitelabel_enabled` — controls Tercero branding visibility

---

## 10. Hooks Reference

### `src/api/invoices.js`

| Hook | Query Key | Table(s) | Notes |
|------|-----------|---------|-------|
| `useInvoices(filters)` | `['invoices', 'list', filters]` | `invoices` + join `clients` | Filtered by clientId, status |
| `useInvoice(id)` | `['invoices', 'detail', id]` | `invoices` + `invoice_items` | Two sequential queries |
| `useNextInvoiceNumber()` | `['invoices', 'nextNumber']` | `agency_subscriptions` | Formatted as INV-YYYY-NNN |
| `useCreateInvoice()` | — | `invoices`, `invoice_items`, `agency_subscriptions` | 4-step mutation |
| `useUpdateInvoice()` | — | `invoices`, `invoice_items`, `transactions` | Auto-tx on PAID; invalidates both invoice + transaction keys |
| `useDeleteInvoice()` | — | `invoices` (cascade) | Invalidates invoice + transaction keys |
| `useRecurringInvoices(filters)` | `['recurring_invoices', 'list', filters]` | `recurring_invoices` + join `clients` | |
| `useCreateRecurringInvoice()` | — | `recurring_invoices` | |
| `useUpdateRecurringInvoice()` | — | `recurring_invoices` | |
| `useDeleteRecurringInvoice()` | — | `recurring_invoices` | |
| `useGenerateFromRecurring()` | — | `invoices` (read-back only) | RPC: `generate_invoice_from_template` — fully atomic server-side |

### RPCs used

| RPC | Called By | Effect |
|-----|----------|--------|
| `generate_invoice_from_template(p_template_id, p_user_id)` | `useGenerateFromRecurring` | Atomically: reads template, formats invoice number, inserts invoice + line item, increments `next_invoice_number`, advances `next_invoice_date`. Returns new invoice UUID. |
| `advance_expense_billing_date(expense_id)` | `useRenewSubscription` | Advances `next_billing_date` on `expenses` |

---

## 11. Files Reference

```
src/
├── api/
│   └── invoices.js           — All invoice + recurring invoice hooks and mutations
├── pages/finance/
│   ├── InvoicesTab.jsx        — Two-tab UI: one-off + recurring. Stats, table, dialogs
│   ├── CreateInvoiceDialog.jsx — Multi-item invoice form with live HTML preview
│   ├── EditInvoiceDialog.jsx   — Edit existing invoice + line items
│   ├── RecurringInvoiceDialog.jsx — Create/edit recurring template
│   ├── AddTransactionDialog.jsx   — Direct ledger entry (INCOME/EXPENSE); invoice gate
│   └── FinancialOverviewTab.jsx   — KPI dashboard (agency-wide, cash/accrual toggle)
└── utils/
    └── finance.js             — calculatePeriodMetrics(), calculateRecurringBurn()
```

---

## 12. Key Behavioural Rules Summary

| Rule | Where Enforced |
|------|---------------|
| External client income → must go through invoice | `AddTransactionDialog` invoice gate banner |
| Internal client cannot be invoiced | `CreateInvoiceDialog` / `RecurringInvoiceDialog` only show `realClients` |
| Marking invoice PAID auto-creates a ledger transaction | `useUpdateInvoice` |
| Reverting from PAID deletes the auto-created transaction | `useUpdateInvoice` |
| Deleting invoice cascades to items and linked transaction | DB FK ON DELETE CASCADE |
| Generating from recurring is fully atomic (number, invoice, item, date advance) | `useGenerateFromRecurring` via `generate_invoice_from_template` RPC |
| Invoice number is globally sequential per agency | `agency_subscriptions.next_invoice_number` |
| No tax applied | `total = subtotal` (MVP) |
