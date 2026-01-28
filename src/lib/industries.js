// constants/industries.js

export const INDUSTRY_OPTIONS = [
  // Tech & B2B
  { label: 'SaaS & Tech', value: 'SaaS', color: 'blue' },
  { label: 'Fintech & Crypto', value: 'Fintech', color: 'indigo' },
  { label: 'Agency & Services', value: 'Agency', color: 'slate' },

  // Retail & Consumer
  { label: 'E-Commerce', value: 'E-Commerce', color: 'emerald' },
  { label: 'Fashion & Apparel', value: 'Fashion', color: 'pink' },
  { label: 'Beauty & Personal Care', value: 'Beauty', color: 'rose' },

  // Local & Lifestyle
  { label: 'Real Estate', value: 'Real Estate', color: 'amber' },
  { label: 'Health & Wellness', value: 'Health', color: 'teal' },
  { label: 'Food & Beverage', value: 'Food', color: 'orange' },
  { label: 'Travel & Hospitality', value: 'Travel', color: 'cyan' },

  // Knowledge
  { label: 'Education', value: 'Education', color: 'violet' },
  { label: 'Creator / Personal Brand', value: 'Creator', color: 'fuchsia' },

  // Catch-all
  { label: 'Other', value: 'Other', color: 'gray' },
]

// Helper to get color safely
export const getIndustryColor = (industryValue) => {
  const found = INDUSTRY_OPTIONS.find((i) => i.value === industryValue)
  return found ? found.color : 'gray' // Default to gray if not found
}
