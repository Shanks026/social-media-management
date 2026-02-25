# Financial Calculations Test Plan

This document outlines precise test scenarios to verify the accuracy of the recent financial logic changes, specifically focusing on how subscriptions, ledger entries, and invoices impact the financial views across different client profiles.

## Prerequisites

Ensure you have three distinct clients configured in the system:

1. **The Strawhats** - Tagged as an _Internal_ client.
2. **Popeyes** - Tagged as an _External_ client.
3. **Domino's** - Tagged as an _External_ client.

Ensure the test environment is clear of pre-existing transactions for these clients in the current month to make verification easier, or note their current baseline.

---

## Scenario 1: The Strawhats (Internal Client)

**Objective:** Verify that income/expenses tagged to the internal client, as well as unallocated (null) agency overheads, consolidate correctly in the internal Overview and the Finance "All" tab.

### Steps

1. **Add a General Agency Expense (Null Client):**
   - Go to Finance -> Ledger.
   - Add a transaction: Type = `EXPENSE`, Category = `Office / Rent`, Amount = `₹10,000`, Client = _(Leave empty/None)_.
2. **Add an Internal Revenue Source:**
   - Go to Finance -> Ledger.
   - Add a transaction: Type = `INCOME`, Category = `Other`, Amount = `₹5,000`, Client = `The Strawhats`.
3. **Add an Agency Recurring Expense:**
   - Go to Finance -> Subscriptions.
   - Add a subscription: Name = `Slack`, Billing = `Monthly`, Amount = `₹1,200`, Client = _(Leave empty/None)_.

### Expected Results

- **"The Strawhats" Overview Tab (Internal):**
  - **Revenue:** Should include the `₹5,000` (plus any other agency revenue in the current month).
  - **One-off Costs:** Should include the `₹10,000` expense.
  - **Monthly Recurring:** Should include the `₹1,200` Slack subscription (plus other existing).
- **Finance -> All Tab:**
  - The metrics should exactly match the "The Strawhats" Overview Tab. The internal client card is a consolidated mirror of the agency's net profit.

---

## Scenario 2: Popeyes (External Client)

**Objective:** Verify that external client recurring subscriptions, invoice revenue, and external-specific expenses calculate strictly for their profile without falsely inflating general revenue.

### Steps

1. **Add a Client-Specific Recurring Expense:**
   - Go to Finance -> Subscriptions.
   - Add a subscription: Name = `Canva Pro`, Billing = `Monthly`, Amount = `₹800`, Client = `Popeyes`.
2. **Add a Client-Specific One-Off Cost:**
   - Go to Finance -> Ledger.
   - Add a transaction: Type = `EXPENSE`, Category = `SaaS / Marketing Tools`, Amount = `₹1,500`, Client = `Popeyes`.
3. **Create an Invoice & Pay It:**
   - Go to Invoices.
   - Create an invoice for `Popeyes`, adding a line item for `Monthly Retainer` = `₹30,000`.
   - Update the invoice status to `PAID`. (This should auto-generate a ledger entry).

### Expected Results

- **"Popeyes" Overview Tab (External):**
  - **Total Revenue:** `₹30,000`
  - **One-off Costs:** `₹1,500`
  - **Monthly Recurring Costs:** `₹800`
  - **Net Profit (for this client):** `₹27,700` (`30000 - 1500 - 800`).
- **"The Strawhats" / Finance -> All Tab:**
  - **Revenue:** The `₹30,000` from Popeyes should be added to the overall agency revenue.
  - **One-off Costs:** The `₹1,500` from Popeyes should be added to overall agency costs.
  - **Monthly Recurring:** The `₹800` Canva subscription should be added to overall agency recurring costs.

---

## Scenario 3: Domino's (External Client - Workflow Guardrails)

**Objective:** Verify that the system enforces invoice creation for `INCOME` transactions attempting to bypass the proper workflow, and that accrual vs cash accounting works correctly.

### Steps

1. **Attempt Manual Ledger Income:**
   - Go to Finance -> Ledger.
   - Click "Add Transaction".
   - Select Type = `INCOME`, Category = `Monthly Retainer`, Client = `Domino's`.
   - _Expected:_ The system should show a banner blocking standard creation and prompt you to "Create Invoice" instead.
2. **Follow the Redirect & Create Invoice:**
   - Click "Create Invoice" from the prompt.
   - Ensure the Create Invoice dialog opens and the first line item description pre-fills with "Monthly Retainer" (or whatever category you selected).
   - Set the amount to `₹40,000` and issue the invoice (Status = `SENT`).
3. **Verify Accrual vs Cash Mode:**
   - Go to Finance -> All.
   - Toggle to **CASH** mode. _Expected:_ Domino's `₹40,000` is NOT included in Revenue (because it is only SENT, not PAID).
   - Toggle to **ACCRUAL** mode. _Expected:_ Domino's `₹40,000` IS included in Revenue.
4. **Pay the Invoice:**
   - Go to Invoices and mark Domino's invoice as `PAID`.
   - Go back to Finance -> All.
   - _Expected:_ Both CASH and ACCRUAL modes should now include the `₹40,000` in Revenue exactly once (no double counting).
5. **Revert the Invoice:**
   - Go to Invoices and change Domino's invoice status back to `SENT` or `DRAFT`.
   - Check the Ledger. _Expected:_ The auto-generated PAID transaction for Domino's should be deleted.

### Expected Results

- All workflow guardrails (preventing double entries, forcing invoices for standard income paths) and accounting toggles function as intended.
