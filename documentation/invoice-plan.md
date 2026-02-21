# Invoice Generation Strategy

> **Status**: Approved — Ready for structured implementation  
> **Last Updated**: 2026-02-21

---

## 1. Current State Analysis

### 1.1 Database Schema (Existing)

| Table                  | Role in Invoicing                                             | Key Columns                                                                                                                             |
| ---------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `transactions`         | **Primary source** — INCOME entries represent billable events | `type` (INCOME/EXPENSE), `status` (PAID/PENDING/OVERDUE), `client_id`, `amount`, `date`, `category`, **`invoice_url`** ← already exists |
| `expenses`             | Recurring costs assignable to clients                         | `cost`, `billing_cycle` (MONTHLY/QUARTERLY/YEARLY), `assigned_client_id`, `next_billing_date`                                           |
| `clients`              | Invoiceable entities                                          | `name`, `email`, `is_internal` (boolean), `tier`, `logo_url`                                                                            |
| `agency_subscriptions` | Agency profile data (issuer details)                          | `agency_name`, `logo_url`, `email`, `mobile_number`, `primary_color`                                                                    |

> **Key finding**: The `transactions` table already has an **`invoice_url`** column (currently unused), confirming invoicing was always intended to be transaction-linked.

### 1.2 Database Views (Relevant)

| View                        | Purpose                                                        |
| --------------------------- | -------------------------------------------------------------- |
| `view_finance_overview`     | Aggregated income, expenses, burn rate per user                |
| `view_client_profitability` | Revenue, one-off costs, monthly recurring costs **per client** |
| `view_monthly_burn_rate`    | Total monthly burn from recurring expenses                     |

### 1.3 Frontend Modules

**Finance Module** (`src/pages/finance/`)

- `OverviewTab.jsx` — Pending Invoices KPI card + list (PENDING INCOME transactions), Cash/Accrual toggle, All/Internal/Clients filter
- `LedgerTab.jsx` — Full transaction log with client filter, add/edit/delete
- `SubscriptionsTab.jsx` — Recurring expense management with client assignment
- `AddTransactionDialog.jsx` — INCOME categories: Monthly Retainer, Setup/Onboarding, Performance Fee, Ad Budget Reimbursement, Creative Project, Consulting/Audit, Other

**Billing & Usage Module** (`src/pages/billingAndUsage/`)

- 3-tab layout: Usage, Subscription, Invoices
- `InvoicesTab.jsx` — Placeholder ("No invoices yet")

**Client Profile** (`src/pages/clients/ClientProfileView.jsx`)

- Financials tab has sub-tabs: Overview, Ledger, Subscriptions
- All finance components accept `clientId` prop (already client-scoped)

---

## 2. Decisions (Confirmed)

| Decision                           | Choice                                                                                                                             |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Architecture**                   | **Option B** — New `invoices` + `invoice_items` tables                                                                             |
| **Tax Handling**                   | No tax for now (can be added later)                                                                                                |
| **Line Items**                     | Multi-item invoices supported (e.g., "Retainer + Creative + Ad Budget" on one invoice)                                             |
| **Invoice Prefix**                 | `INV-2026-001` format                                                                                                              |
| **PDF Library**                    | Client-side (`@react-pdf/renderer`) for MVP; server-side Edge Function for production email integration later                      |
| **Billing & Usage > Invoices Tab** | **Deferred** — focus on client invoicing first. The agency's own SaaS subscription bills tab is a separate, lower-priority concern |
| **Internal Agency Invoices**       | **Not needed** — you don't invoice yourself. The existing Finance Overview with Internal filter serves this purpose                |

---

## 3. Proposed Database Schema

### `invoices` Table

```sql
CREATE TABLE invoices (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id),
  client_id       uuid NOT NULL REFERENCES clients(id),
  invoice_number  text NOT NULL UNIQUE,          -- "INV-2026-001"
  status          text NOT NULL DEFAULT 'DRAFT', -- DRAFT, SENT, PAID, OVERDUE, VOID
  issue_date      date NOT NULL DEFAULT CURRENT_DATE,
  due_date        date NOT NULL,
  subtotal        numeric NOT NULL DEFAULT 0,
  total           numeric NOT NULL DEFAULT 0,
  notes           text,
  payment_terms   text,                          -- "Net 30", "Due on Receipt"
  pdf_url         text,                          -- Supabase Storage URL
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
```

### `invoice_items` Table

```sql
CREATE TABLE invoice_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id      uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  transaction_id  uuid REFERENCES transactions(id),  -- optional link to ledger
  description     text NOT NULL,
  quantity        numeric NOT NULL DEFAULT 1,
  unit_price      numeric NOT NULL,
  total           numeric NOT NULL,
  created_at      timestamptz DEFAULT now()
);
```

### Invoice Number Tracking

Add `next_invoice_number` (integer, default 1) to `agency_subscriptions`, or use a dedicated DB sequence.

---

## 4. Display Locations

### 4.1 Finance Module — New "Invoices" Tab (Global)

**Location**: Add alongside existing Overview, Ledger, Subscriptions tabs in Finance

| Feature      | Description                                                    |
| ------------ | -------------------------------------------------------------- |
| Invoice List | Table: Invoice #, Client, Issue Date, Due Date, Amount, Status |
| Filters      | By client, status (All/Draft/Sent/Paid/Overdue), date range    |
| Actions      | Create New, View PDF, Download PDF, Mark as Sent/Paid/Void     |
| Quick Stats  | Total Outstanding, Overdue Amount, Paid This Month             |

### 4.2 Client Profile — New "Invoices" Sub-tab

**Location**: Inside Financials tab of `ClientProfileView.jsx`

Current sub-tabs: `Overview | Ledger | Subscriptions`  
Proposed: `Overview | Ledger | Subscriptions | Invoices`

Client-scoped view with "Generate Invoice" button.

### 4.3 Finance Overview — Enhanced Pending Invoices

The existing **Pending Invoices** KPI card and list in `OverviewTab.jsx` should eventually link to actual invoice records instead of raw PENDING transactions.

### 4.4 Billing & Usage > Invoices Tab (Deferred)

This is for **agency's own SaaS subscription bills** — a separate concern. Will implement later.

---

## 5. User Flows

### Flow 1: Generate from Ledger

```
Ledger → INCOME transaction (PENDING) → "⋮" menu → "Generate Invoice"
→ Dialog pre-fills: client, amount, description
→ User sets due date, adds items/notes → Save as DRAFT
→ Preview PDF → Mark as SENT
```

### Flow 2: Generate from Client Profile

```
Client Profile → Financials → Invoices → "Create Invoice"
→ Client pre-selected, pick transactions to include or add custom line items
→ Due date, payment terms, notes → Save
```

### Flow 3: Generate from Finance > Invoices Tab

```
Finance → Invoices → "New Invoice"
→ Select client, add line items (from transactions or custom)
→ Full invoice creation form
```

---

## 6. Invoice PDF Template

| Section               | Source                                                     |
| --------------------- | ---------------------------------------------------------- |
| Agency Logo & Name    | `agency_subscriptions.logo_url`, `agency_name`             |
| Agency Contact        | `agency_subscriptions.email`, `mobile_number`              |
| Client Name & Contact | `clients.name`, `clients.email`                            |
| Invoice Number        | Auto-generated: `INV-2026-NNN`                             |
| Issue Date & Due Date | From invoice record                                        |
| Line Items            | From `invoice_items` — description, qty, unit price, total |
| Subtotal & Total      | Calculated from line items (no tax for now)                |
| Payment Terms & Notes | User-provided                                              |
| Branding Accent       | `agency_subscriptions.primary_color`                       |

---

## 7. Technical Stack

| Area            | Choice                                                               |
| --------------- | -------------------------------------------------------------------- |
| PDF Generation  | `@react-pdf/renderer` (client-side MVP)                              |
| Storage         | Supabase Storage: `invoices/{user_id}/{invoice_id}.pdf`              |
| Invoice Numbers | Sequential per agency via `agency_subscriptions.next_invoice_number` |
| Currency        | Existing `CURRENCY` constant (₹ / INR)                               |
| API Layer       | New `src/api/invoices.js` with React Query hooks                     |
| Email           | Deferred — manual "Mark as Sent" for now                             |
