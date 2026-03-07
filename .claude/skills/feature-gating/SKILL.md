---
name: feature-gating
description: >
  Implement subscription-based feature gating in Tercero. Use this skill whenever
  adding, modifying, or auditing any feature that is restricted to a specific plan
  (Ignite, Velocity, Quantum). The golden rule: NEVER hide locked features entirely —
  always show them in a disabled/locked state with a Lock icon so users understand
  what they're missing. Triggers on: "gate this feature", "lock this for lower tiers",
  "add subscription check", "restrict to Velocity", "show upgrade prompt", any feature
  that involves plan_name or feature flags from useSubscription, or any UI element
  that should only be available on certain plans.
---

# Feature Gating in Tercero

## The Core Rule

**Locked features are visible, not invisible.**

When a feature is unavailable on the current plan, show it in a disabled/locked state with a `Lock` icon. This tells the user what they can get by upgrading — a completely hidden feature teaches them nothing.

The only exception is **sidebar nav items**, which already have their own lock pattern (see nav-main.jsx).

---

## Reading the Feature Flag

Always use `useSubscription()`. Never query `agency_subscriptions` directly in components.

```jsx
import { useSubscription } from '@/api/useSubscription'

const { data: sub } = useSubscription()
// Then check: sub?.calendar_export, sub?.finance_subscriptions, etc.
```

### Available flags

| Flag | Unlocked on |
|---|---|
| `sub?.calendar_export` | Velocity, Quantum |
| `sub?.finance_recurring_invoices` | Velocity, Quantum |
| `sub?.finance_subscriptions` | Velocity, Quantum |
| `sub?.branding_agency_sidebar` | Velocity, Quantum |
| `sub?.branding_powered_by` | Ignite, Velocity (hidden on Quantum) |

Plan hierarchy: `trial` (= Ignite limits) → `ignite` → `velocity` → `quantum`

---

## Upgrade tooltip text

Be consistent. Use these exact phrases in lock tooltips:

| Unlocked on | Tooltip text |
|---|---|
| Velocity+ | `"Available on Velocity & Quantum"` |
| Quantum only | `"Available on Quantum"` |

---

## Pattern 1 — Locked Button

A button that exists in the toolbar or header but is disabled when the feature is gated.

```jsx
import { Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip'

{sub?.calendar_export ? (
  <Button variant="outline" size="sm" onClick={handleAction}>
    Export Report
  </Button>
) : (
  <Tooltip>
    <TooltipTrigger asChild>
      <Button
        variant="outline"
        size="sm"
        disabled
        className="opacity-50 cursor-not-allowed"
      >
        Export Report
        <Lock size={12} className="ml-1.5" />
      </Button>
    </TooltipTrigger>
    <TooltipContent>Available on Velocity & Quantum</TooltipContent>
  </Tooltip>
)}
```

Key points:
- `disabled` on the Button prevents click and native focus
- `opacity-50 cursor-not-allowed` reinforces disabled visually
- Lock icon is `size={12}` (small, inline, at the end)
- Wrap with `Tooltip` — not `title=""` attribute

---

## Pattern 2 — Locked Tab

A tab that is visible but shows a lock icon and cannot be selected.

```jsx
import { Lock } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip'

<TabsList>
  <TabsTrigger value="one-off">One-off</TabsTrigger>

  {sub?.finance_recurring_invoices ? (
    <TabsTrigger value="recurring">Recurring</TabsTrigger>
  ) : (
    <Tooltip>
      <TooltipTrigger asChild>
        <TabsTrigger
          value="recurring-locked"
          disabled
          className="opacity-50 cursor-not-allowed gap-1.5"
        >
          Recurring
          <Lock size={11} />
        </TabsTrigger>
      </TooltipTrigger>
      <TooltipContent>Available on Velocity & Quantum</TooltipContent>
    </Tooltip>
  )}
</TabsList>

{/* Only render content when unlocked — no content to show when locked */}
{sub?.finance_recurring_invoices && (
  <TabsContent value="recurring">
    {/* ... */}
  </TabsContent>
)}
```

Note: The locked tab has a different `value` (e.g. `"recurring-locked"`) so it can never become the active tab, while still being visible in the list.

---

## Pattern 3 — Locked Section (within a page)

A card or section within a page that is visible but locked.

```jsx
import { Lock } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip'

<Card className={!sub?.some_flag ? 'opacity-60 pointer-events-none' : ''}>
  <CardHeader>
    <CardTitle className="flex items-center gap-2">
      Section Title
      {!sub?.some_flag && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Lock size={14} className="text-muted-foreground cursor-not-allowed" />
          </TooltipTrigger>
          <TooltipContent>Available on Velocity & Quantum</TooltipContent>
        </Tooltip>
      )}
    </CardTitle>
  </CardHeader>
  <CardContent>
    {/* Content renders but pointer-events-none blocks interaction */}
  </CardContent>
</Card>
```

For denser sections where showing real content under a lock overlay makes more sense:

```jsx
<div className="relative">
  {/* Actual content — rendered but blurred */}
  <div className={cn(!sub?.some_flag && 'blur-sm pointer-events-none select-none')}>
    {/* ... section content ... */}
  </div>

  {/* Lock overlay */}
  {!sub?.some_flag && (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="flex flex-col items-center gap-2 text-center bg-background/80 rounded-lg p-4">
        <Lock size={20} className="text-muted-foreground" />
        <p className="text-sm font-medium">Available on Velocity & Quantum</p>
      </div>
    </div>
  )}
</div>
```

Use the blur overlay approach when you want to hint at what the content looks like. Use `opacity-60 pointer-events-none` when the content is complex and blurring looks messy.

---

## Pattern 4 — Locked Page (full route)

When an entire page/route is locked, render a gate screen instead of the page content. Do not redirect — the user landed here intentionally.

```jsx
import { Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useNavigate } from 'react-router-dom'

function LockedPageGate({ featureName, requiredPlan = 'Velocity' }) {
  const navigate = useNavigate()
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
      <div className="rounded-full bg-muted p-4">
        <Lock size={24} className="text-muted-foreground" />
      </div>
      <h2 className="text-lg font-semibold">{featureName} is a {requiredPlan}+ feature</h2>
      <p className="text-sm text-muted-foreground max-w-sm">
        Upgrade your plan to unlock this feature and more.
      </p>
      <Button variant="outline" onClick={() => navigate('/billing')}>
        View Plans
      </Button>
    </div>
  )
}

// Usage at the top of the page component:
export default function SubscriptionsPage() {
  const { data: sub } = useSubscription()

  if (!sub?.finance_subscriptions) {
    return <LockedPageGate featureName="Expense Subscriptions" />
  }

  return (/* ... real page content ... */)
}
```

---

## Styling reference

| Context | Lock size | Opacity |
|---|---|---|
| Inline in button | `size={12}` | Button gets `opacity-50` |
| Inline in tab | `size={11}` | Tab gets `opacity-50` |
| In card/section header | `size={14}` | Card gets `opacity-60` |
| Full page gate | `size={24}` | N/A — standalone icon |
| Sidebar nav item | `size-3` (className) | Item gets `opacity-40` |

Always import: `import { Lock } from 'lucide-react'`

---

## What NOT to do

```jsx
// ❌ Don't hide the feature — user learns nothing
{sub?.calendar_export && <Button>Export Report</Button>}

// ❌ Don't use native title= for tooltips — inconsistent and unstyled
<Button disabled title="Upgrade to Velocity">...</Button>

// ❌ Don't import Lock from anywhere other than lucide-react
import { LockIcon } from 'some-other-library'

// ❌ Don't call useSubscription inside a plain async function
async function doSomething() {
  const { data } = useSubscription() // hooks can't be called here
}
```

---

## Checklist when adding a gated feature

- [ ] Feature is visible on all plans (not conditionally hidden)
- [ ] Feature is disabled/non-interactive when flag is false
- [ ] Lock icon present on the disabled element
- [ ] Tooltip explains which plan unlocks it (`"Available on Velocity & Quantum"`)
- [ ] `useSubscription()` used — no direct `agency_subscriptions` queries
- [ ] Tooltip uses shadcn `Tooltip` component, not `title=""` attribute
