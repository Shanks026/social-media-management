import { Sparkles, Zap, Rocket, Atom } from 'lucide-react'

export const allPlanMeta = {
  trial:    { name: 'Trial',    icon: Sparkles, bestFor: 'Evaluating Tercero',          accent: { text: 'text-sky-500',    bg: 'bg-sky-500/10'    } },
  ignite:   { name: 'Ignite',   icon: Zap,      bestFor: 'Freelancers & Solopreneurs',   accent: { text: 'text-amber-500',  bg: 'bg-amber-500/10'  } },
  velocity: { name: 'Velocity', icon: Rocket,   bestFor: 'Boutique Agencies',            accent: { text: 'text-lime-500',   bg: 'bg-lime-500/10'   } },
  quantum:  { name: 'Quantum',  icon: Atom,     bestFor: 'Scaling Firms & Enterprises',  accent: { text: 'text-violet-500', bg: 'bg-violet-500/10' } },
}

// Purchasable plans (no trial entry)
export const plans = [
  {
    id: 'ignite',
    name: 'Ignite',
    icon: Zap,
    bestFor: 'Freelancers & Solopreneurs',
    price: '1,999',
    accent: { text: 'text-amber-500', bg: 'bg-amber-500/10' },
    features: [
      { value: 'Up to 5 clients', included: true },
      { value: '20 GB storage', included: true },
      { value: '2 team seats', included: true },
      { value: '5 active proposals', included: true },
      { value: 'Invoicing, ledger & reports', included: true },
      { value: 'Content calendar & scheduling', included: true },
      { value: 'Client review & approval flow', included: true },
      { value: 'Up to 5 campaigns', included: true },
      { value: 'Agency branding', included: false },
      { value: 'Email support', included: true },
    ],
  },
  {
    id: 'velocity',
    name: 'Velocity',
    icon: Rocket,
    bestFor: 'Boutique Agencies',
    price: '4,999',
    popular: true,
    includesBase: 'Ignite',
    accent: { text: 'text-lime-500', bg: 'bg-lime-500/10' },
    features: [
      { value: 'Up to 15 clients', included: true },
      { value: '100 GB storage', included: true },
      { value: '5 team seats', included: true },
      { value: 'Unlimited proposals', included: true },
      { value: 'Campaigns (unlimited)', included: true },
      { value: 'Agency logo & name in sidebar', included: true },
      { value: 'Recurring invoices & subscriptions', included: true },
      { value: 'Calendar PDF export', included: true },
      { value: 'Document collections', included: true },
      { value: 'Priority chat support', included: true },
    ],
  },
  {
    id: 'quantum',
    name: 'Quantum',
    icon: Atom,
    bestFor: 'Scaling Firms & Enterprises',
    price: '12,999',
    includesBase: 'Velocity',
    accent: { text: 'text-violet-500', bg: 'bg-violet-500/10' },
    features: [
      { value: 'Up to 30 clients', included: true },
      { value: '300 GB storage', included: true },
      { value: 'Unlimited team seats', included: true },
      { value: 'Full whitelabel — no Tercero branding', included: true },
      { value: 'VIP Concierge support', included: true },
    ],
  },
]
