// --- FILE SIZE LIMITS ---
export const MAX_VIDEO_SIZE_MB = 500
export const MAX_VIDEO_SIZE_BYTES = MAX_VIDEO_SIZE_MB * 1024 * 1024

export const CURRENCY = {
  CODE: 'INR',
  LOCALE: 'en-IN',
  SYMBOL: '₹',
}

// --- TRANSACTION CATEGORIES ---

// Income from external clients (billable work)
export const INCOME_CATEGORIES = [
  'Monthly Retainer',
  'Setup / Onboarding',
  'Performance / Success Fee',
  'Ad Budget Reimbursement',
  'Creative Project',
  'Consulting / Audit',
  'Other',
]

// Income recorded against My Agency (internal account or no client selected)
export const AGENCY_INCOME_CATEGORIES = [
  'Consulting / Audit',
  'Referral / Commission',
  'Workshop / Training Fee',
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

// --- INVOICE CATEGORIES ---
export const INVOICE_CATEGORIES = [
  'Retainer',
  'Project Fee',
  'Ad Management',
  'Other',
]
