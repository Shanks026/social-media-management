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

**API layer (src/api/):** Domain-scoped modules (clients, posts, invoices, expenses, transactions, meetings, notes, documents, agency, storage). Each exports plain async functions for mutations and React Query hooks for reads. `useGlobalPosts.js` handles cross-client post queries. Supabase RPC calls are used for complex aggregations:
- `get_clients_with_pipeline()` — client analytics
- `create_post_draft_v3()` — atomic post creation
- `create_revision_version()` — post versioning
- `get_global_calendar()` — date-range post queries

**Pages (src/pages/):** Feature directories — clients, posts, calendar, finance, billingAndUsage, operations (notes/meetings), documents, dashboard, settings, public review.

**Header context (`src/components/misc/header-context.jsx`):** Pages call `useHeader()` to set the dynamic breadcrumb/title in the shell header via `setHeader({ title, breadcrumbs })`.

**Shared utilities:**
- `src/lib/helper.js` — `formatDate(dateInput)` → "2 Jan, 2026"; `formatFileSize(bytes)` → "2.3 MB"; `MAX_DOCUMENT_SIZE_BYTES` constant (50 MB)
- `src/lib/client-helpers.js` — `getUrgencyStatus(nextPostAt)` → urgency color/label for pipeline indicators

### Domain Patterns

**Post management:** Versioning via parent-child post relationships. Statuses: `DRAFT`, `PENDING`, `REVISIONS`, `SCHEDULED`, `ARCHIVED`. In the campaign review flow, posts are set to `PENDING_APPROVAL` when awaiting client review, then transitioned to `SCHEDULED` (approved) or `NEEDS_REVISION` (revisions requested) via the `update_post_status_by_token` RPC. Media stored in Supabase `post-media` bucket; deletions are deferred until media is unused. Shareable public review via token. `DraftPostForm` (`src/pages/posts/DraftPostForm.jsx`) is used both as a standalone page and as a dialog (pass `open`/`onOpenChange` props); it accepts `clientId`, `initialCampaignId`, and `initialCampaignName` to pre-fill context.

**Clients:** "Internal Account" vs real clients (`is_internal` flag) — `client_count` in `useSubscription` excludes internal accounts. Pipeline analytics (`view_client_profitability` DB view). Tiers and industries for filtering.

**Reusable tab pattern:** Feature tabs like `CampaignTab` and `DocumentsTab` accept an optional `clientId` prop. Without it they show all records (global page); with it they scope to that client (used inside `ClientProfileView`). The "New" button and `showClient` label on cards also toggle based on whether `clientId` is present.

**Campaigns (`/campaigns`):** Group posts into initiatives per client. Subscription-gated (`sub?.campaigns`). Three surfaces: global list (`/campaigns`), detail page (`/campaigns/:campaignId`), and public client review (`/campaign-review/:token`). Detail page shows KPI bar, post list, platform distribution chart, budget tracker, and linked invoices. The "Share Review Link" button appears only when `campaign.review_token` exists and at least one post has `PENDING_APPROVAL` status — opens a dialog to copy the URL or email it via the `send-campaign-review-email` edge function. Review tokens can be regenerated; `last_review_sent_at` is tracked. Key API hooks live in `src/api/campaigns.js`; key RPCs: `get_campaigns_with_post_summary`, `get_campaign_analytics`, `get_campaign_by_review_token` (public, SECURITY DEFINER), `update_post_status_by_token` (public).

**Public campaign review (`/campaign-review/:token`):** Fully unauthenticated two-panel UI — left panel lists all `PENDING_APPROVAL` posts, right panel shows the selected post with Approve / Request Revisions actions. Per-post tokens come from the `share_tokens` table via a LATERAL JOIN in the RPC (not from a column on `post_versions`). Branding flags (`branding_agency_sidebar`, `branding_powered_by`) are read from the RPC response.

**Documents (`/documents`):** File storage per client using a private Supabase `client-documents` bucket (signed URLs). Documents have categories, belong to optional collections (`documents_collections` feature flag), and are scoped by `client_id`. The global page shows all documents with a client filter dropdown; the same `DocumentsTab` component is reused in the Client Detail page, filtering by `clientId` prop. Storage usage is tracked on `agency_subscriptions.current_storage_used` via `increment_storage_used` / `decrement_storage_used` RPCs.

**Finance (`/finance`):** Agency-side financial tracking — invoice generation with PDF export, expense tracking, transaction ledger, client subscription plan management. Nested routes: `overview`, `subscriptions`, `ledger`, `invoices`.

**Billing (`/billing`):** The agency's own subscription to Tercero — plan details, usage stats, and internal invoices. Separate from client Finance.

**Supabase Edge Functions (supabase/):** `send-approval-email`, `send-client-welcome`, `send-password-update-email`, `send-campaign-review-email`.

### Subscription & Feature Gating

**`useSubscription()` (`src/api/useSubscription.js`):** Central hook for all plan/tier checks. Returns a React Query result; access via `const { data } = useSubscription()`. Always use this hook — never query `agency_subscriptions` directly in components.

The `data` object includes:
- `plan_name` — `'trial'` | `'ignite'` | `'velocity'` | `'quantum'`
- `agency_name`, `logo_url` — agency branding
- `client_count`, `max_clients` — for client limit checks
- `storage_display` — pre-calculated storage usage strings (`usage_value`, `usage_unit`, `max_value`, `percent`, `remaining_label`)
- Feature flags (all boolean):
  - `branding_agency_sidebar` — show agency logo+name in sidebar (Velocity+)
  - `branding_powered_by` — show "Powered by Tercero" footer (Ignite + Velocity; Quantum hides it)
  - `finance_recurring_invoices` — recurring invoice templates tab (Velocity+)
  - `finance_subscriptions` — expense subscriptions route (Velocity+)
  - `finance_accrual` — accrual accounting mode (Velocity+)
  - `calendar_export` — calendar PDF export button (Velocity+)
  - `documents_collections` — document collections grouping (Velocity+)
  - `campaigns` — campaigns feature (Velocity+)

**Gating pattern:** Read flags directly from `data` (e.g. `data?.finance_subscriptions`). For locked features (visible but disabled), show with a disabled state + lock icon + tooltip. For hidden features (like nav items), conditionally render them. See `.claude/features/feature-tiers-v5.md` for the full feature matrix.

**Public review page (`/review/:token`):** This page is unauthenticated. To access branding flags, extend the token query to join through `post_versions → posts → clients → agency_subscriptions`.

### Environment Variables

```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```
