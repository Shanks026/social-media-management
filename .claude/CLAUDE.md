# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start Vite dev server with HMR
npm run build    # Production build
npm run lint     # Run ESLint
npm run preview  # Preview production build locally
```

No test framework is configured.

## Architecture Overview

**Tercero** is a React + Supabase SPA for social media agency management (client management, post scheduling, finance, operations).

### Tech Stack

- **React 19** + **React Router 7** (client-side routing)
- **Vite** (build tool, `@` alias → `./src`)
- **Tailwind CSS 4** + **shadcn/ui** (new-york style, neutral base, lucide icons)
- **TanStack React Query** (server state, 30s staleTime, retry: 1, no refetch on focus)
- **React Hook Form** + **Zod** (forms and validation)
- **Supabase** (PostgreSQL, auth, storage, edge functions)
- **date-fns** (date manipulation; used in API layer and components)
- **@react-pdf/renderer** (PDF generation — invoices and calendar reports)

### Data Flow

```
Pages/Components → API functions (src/api/) → Supabase client → PostgreSQL
                                           ↑
                                   React Query cache
```

### Key Layers

**Entry (main.jsx):** Wraps app in `QueryClientProvider`, `ThemeProvider`, `SidebarProvider`, `TooltipProvider`, `Toaster`, `BrowserRouter`.

**Auth (src/context/AuthContext.jsx):** Supabase `onAuthStateChange` listener; session checked in `App.jsx` to protect routes.

**Layout (AppShell.jsx):** Sidebar nav + header wrapper; feature content renders via React Router `<Outlet>`.

**API layer (src/api/):** Domain-scoped modules (clients, posts, invoices, expenses, transactions, meetings, notes, agency, storage). Each exports plain async functions for mutations and React Query hooks for reads. Supabase RPC calls are used for complex aggregations:
- `get_clients_with_pipeline()` — client analytics
- `create_post_draft_v3()` — atomic post creation
- `create_revision_version()` — post versioning
- `get_global_calendar()` — date-range post queries

**Pages (src/pages/):** Feature directories — clients, posts, calendar, finance, billing, operations (notes/meetings), settings, public review.

**Header context (`src/components/misc/header-context.jsx`):** Pages call `useHeader()` to set the dynamic breadcrumb/title in the shell header via `setHeader({ title, breadcrumbs })`.

**Shared utilities:**
- `src/lib/helper.js` — `formatDate(dateInput)` → "2 Jan, 2026"
- `src/lib/client-helpers.js` — `getUrgencyStatus(nextPostAt)` → urgency color/label for pipeline indicators

### Domain Patterns

**Post management:** Versioning via parent-child post relationships. Statuses: `DRAFT`, `PENDING`, `REVISIONS`, `SCHEDULED`, `ARCHIVED`. Media stored in Supabase `post-media` bucket; deletions are deferred until media is unused. Shareable public review via token.

**Clients:** "Internal Account" vs real clients. Pipeline analytics (`view_client_profitability` DB view). Tiers and industries for filtering.

**Finance (`/finance`):** Agency-side financial tracking — invoice generation with PDF export (`@react-pdf/renderer`), expense tracking, transaction ledger, client subscription plan management. Nested routes: `overview`, `subscriptions`, `ledger`, `invoices`.

**Billing (`/billing`):** The agency's own subscription to Tercero — plan details, usage stats, and internal invoices. Separate from client Finance.

**Supabase Edge Functions (supabase/):** `send-approval-email`, `send-client-welcome`, `send-password-update-email`.

### Subscription & Feature Gating

**`useSubscription()` (`src/api/useSubscription.js`):** Central hook for all plan/tier checks. Returns the `agency_subscriptions` row with derived fields. Always use this hook — never query `agency_subscriptions` directly in components.

Plans: `trial` | `ignite` | `velocity` | `quantum`

Key feature flags on the `agency_subscriptions` table (all boolean):
- `branding_agency_sidebar` — show agency logo+name in sidebar (Velocity+)
- `branding_powered_by` — show "Tercero YYYY" / "Powered by Tercero" (Ignite + Velocity; Quantum hides it)
- `finance_recurring_invoices` — recurring invoice templates tab (Velocity+)
- `finance_subscriptions` — expense subscriptions route (Velocity+)
- `calendar_export` — calendar PDF export button (Velocity+)

**`can.*` pattern** — the hook exposes helper methods via the `can` object:
```js
const { subscription, can, planName } = useSubscription()
can.useAgencySidebar()        // branding_agency_sidebar
can.showPoweredBy()           // branding_powered_by
can.recurringInvoices()       // finance_recurring_invoices
can.expenseSubscriptions()    // finance_subscriptions
can.calendarExport()          // calendar_export
can.addClient(currentCount)   // checks max_clients limit
```

**Gating pattern:** Gate UI with `can.*()` checks. For locked features (visible but disabled), show the feature with a disabled state + lock icon + tooltip. For hidden features (like nav items), conditionally render them. See `.claude/features/feature-tiers-v5.md` for the full feature matrix and gating implementation notes.

**Public review page (`/review/:token`):** This page is unauthenticated. To access branding flags, extend the token query to join through `post_versions → posts → clients → agency_subscriptions`.

### Environment Variables

```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```
