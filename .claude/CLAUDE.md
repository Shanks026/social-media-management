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

### Domain Patterns

**Post management:** Versioning via parent-child post relationships. Statuses: `DRAFT`, `PENDING`, `REVISIONS`, `SCHEDULED`, `ARCHIVED`. Media stored in Supabase `post-media` bucket; deletions are deferred until media is unused. Shareable public review via token.

**Clients:** "Internal Account" vs real clients. Pipeline analytics (`view_client_profitability` DB view). Tiers and industries for filtering.

**Finance:** Invoice generation with PDF export (`@react-pdf/renderer`), expense tracking, transaction ledger, subscription plan management.

**Supabase Edge Functions (supabase/):** `send-approval-email`, `send-client-welcome`, `send-password-update-email`.

### Environment Variables

```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```
