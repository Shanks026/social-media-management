# admin-tercero Design Guide

`admin-tercero` is a separate internal CRM project for Tercero staff to manage agencies, subscriptions, billing, and platform health. It shares the same design DNA as the main Tercero app.

---

## Key Differences from Tercero

| Aspect | Tercero (main app) | admin-tercero |
|--------|-------------------|---------------|
| Users | Agency owners & team members | Tercero internal staff only |
| Auth | Supabase user auth | Separate admin auth (service role or separate user table) |
| Data scope | Per-workspace (workspaceUserId) | Cross-workspace (full platform view) |
| Primary entities | Clients, posts, campaigns | Agencies, subscriptions, users, billing |
| Feature gating | Plan-based for agencies | Not applicable (internal tool) |
| Branding | Tercero brand | Tercero brand (internal variant) |

---

## Layout Guidance

Use the same page layout pattern as Tercero:

```jsx
// Standard admin page wrapper
<div className="p-8 max-w-[1400px] mx-auto space-y-6">
  <div className="flex items-center justify-between">
    <div className="space-y-1">
      <h1 className="text-3xl font-light tracking-tight">
        Agencies
        <span className="text-muted-foreground/50 ml-2 font-extralight">{count}</span>
      </h1>
      <p className="text-sm text-muted-foreground font-light">
        Manage all agency accounts on the platform
      </p>
    </div>
    <Button className="gap-2 h-9">
      <Plus size={16} />
      Add Agency
    </Button>
  </div>

  {/* Content */}
</div>
```

## Recommended Admin Sidebar Nav Items

```
Dashboard       → /admin/dashboard
Agencies        → /admin/agencies          (list, search, filter by plan)
Users           → /admin/users             (all platform users)
Subscriptions   → /admin/subscriptions     (plan management, upgrades)
Billing         → /admin/billing           (invoices, payments)
Content Health  → /admin/content           (post volume, client activity)
Settings        → /admin/settings          (platform configuration)
```

## Key Admin Data Patterns

**Agency list page** — same card/table toggle pattern as Tercero's Clients page:
- Search by agency name
- Filter by plan (trial/ignite/velocity/quantum)
- Sort by MRR, created_at, last_activity
- Show: agency name, owner email, plan, client count, MRR, created_at

**Agency detail page** — same tab pattern as ClientProfileView:
- Tabs: Overview, Users, Clients, Billing, Activity
- Overview: subscription stats, storage usage, plan details
- Users: all members of that workspace
- Clients: all clients under that agency
- Billing: their subscription invoices

**Status indicators for agencies:**
```jsx
// Plan badge
const PLAN_COLORS = {
  trial:    'bg-gray-100 text-gray-700 dark:bg-gray-500/10 dark:text-gray-400',
  ignite:   'bg-orange-100 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400',
  velocity: 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400',
  quantum:  'bg-violet-100 text-violet-700 dark:bg-violet-500/10 dark:text-violet-400',
}
```

**Health indicators:**
```jsx
// Agency health (active vs churned vs at-risk)
active:   'bg-emerald-100 text-emerald-700'
at_risk:  'bg-orange-100 text-orange-700'
churned:  'bg-rose-100 text-rose-700'
```

## Shared Design Rules (same as Tercero)

- All imports from `@/components/ui/` (or the equivalent admin alias)
- `cn()` for class merging
- `lucide-react` for all icons
- `react-hook-form` + `zod` for forms
- `sonner` for notifications
- `CustomTable` pattern for data tables
- `Empty` component for empty states
- Skeleton loaders that match content shape
- `max-w-[1400px] mx-auto` page container
- Underline tab style (not pill style)

## Supabase Access

Admin tools should use the **service role key** (server-side only) to bypass RLS, since admin needs cross-workspace access. Never expose the service role key client-side.

Recommended approach:
- Admin Next.js app with API routes
- Or separate Supabase Edge Functions with service role
- Admin queries should explicitly join `agency_subscriptions` to scope context

## Recommended Tech Stack for admin-tercero

Same as Tercero main app since it's a related project:
- React 19 + React Router 7 (or Next.js 15 if preferred for SSR)
- Tailwind CSS 4 + shadcn/ui (copy the same `components/ui/` directory)
- TanStack React Query
- Supabase client (service role for admin queries)
- Same `index.css` with CSS variable tokens
- Google Sans font
