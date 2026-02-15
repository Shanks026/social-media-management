# Profit Margin Calculation Logic

## Overview

The profit margin displayed on the **Client Card** and the **Financial Dashboard** is calculated using a standardized "Current Month" logic. This ensures consistency across the application.

## Formula

The margin is calculated as:

```math
Margin = ((Revenue - Total Expenses) / Revenue) * 100
```

Where:

- **Revenue**: Total income from transactions dated within the current month.
  - **Cash Basis (Default for Badge)**: Includes only `PAID` income.
  - **Accrual Basis**: Includes all `INCOME` transactions (Pending, Overdue, Paid).
- **Total Expenses**: Sum of:
  - **One-Off Expenses**: Transactions of type `EXPENSE` dated within the current month.
  - **Recurring Expenses**: The sum of all _active_ subscriptions (from the `expenses` table) assigned to the client.
    - Monthly subscriptions are added as-is.
    - Quarterly subscriptions are divided by 3.
    - Yearly subscriptions are divided by 12.

## Implementation Details

- **Source of Truth**: The calculation logic is centralized in `src/utils/finance.js` (`calculatePeriodMetrics`).
- **Client Card**:
  - Displays the margin for `Current Month` (Start of Month to End of Month).
  - Uses `CASH` basis to reflect actual cash flow health.
  - Hides the badge if `Revenue` is 0 to avoid confusion (or division by zero).
- **Dashboard**:
  - Allows toggling between `CASH` and `ACCRUAL` basis.
  - Shows the same calculation but allows for historical comparison (Last 6 months).

## Color Coding

The badge color indicates the health of the margin:

- **Green (Emerald)**: Margin ≥ 50% (Healthy)
- **Amber**: 20% ≤ Margin < 50% (Moderate)
- **Red (Rose)**: Margin < 20% (Low / At Risk)

## Note on Discrepancies

Previously, the Client Card used a "Lifetime" approximation which effectively ignored recurring costs in some views, leading to an incorrect "100%" margin. The new logic aligns strictly with the dashboard's "Monthly Run Rate" to provide a realistic view of current profitability.
