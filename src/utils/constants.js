export const CURRENCY = {
  CODE: 'INR',
  LOCALE: 'en-IN',
  SYMBOL: '₹',
}

// --- TRANSACTION CATEGORIES ---
export const INCOME_CATEGORIES = [
  'Monthly Retainer',
  'Setup / Onboarding',
  'Performance / Success Fee',
  'Ad Budget Reimbursement',
  'Creative Project',
  'Consulting / Audit',
  'Other',
]

export const EXPENSE_CATEGORIES = [
  'Ad Spend / Media Buying',
  'Freelancer / Contractor',
  'SaaS / Marketing Tools',
  'Content Production',
  'Stock / Assets',
  'Travel & Meetings',
  'Training / Courses',
  'Office / Rent',
  'Taxes / Legal',
  'Other',
]

/**
 * Income categories that REQUIRE a formal invoice.
 * These represent billable client work where a document trail is mandatory.
 * When a user tries to record a direct ledger entry for these, they are
 * redirected to the invoice flow instead.
 *
 * Ledger-only (no invoice required): Ad Budget Reimbursement, Other
 */
export const INVOICE_REQUIRED_CATEGORIES = new Set([
  'Monthly Retainer',
  'Setup / Onboarding',
  'Performance / Success Fee',
  'Creative Project',
  'Consulting / Audit',
])
