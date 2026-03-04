# Routing Conventions

How React Router is configured in Tercero (`src/App.jsx`).

## Route Structure

```
/login                → LoginPage (public)
/signup               → SignupPage (public)
/review/:token        → PublicReview (public, no auth required)

Protected routes (inside <AppShell>):
/dashboard            → Dashboard
/clients              → Clients list
/clients/create       → CreateClientPage
/clients/:clientId    → ClientDetails (tabs: Overview, Management, Workflow)
/clients/:clientId/edit         → CreateClientPage (edit mode)
/clients/:clientId/posts/:postId → PostDetails
/posts                → Posts list
/calendar             → ContentCalendar
/finance              → FinanceLayout (nested)
  /finance/overview       → FinancialOverviewTab
  /finance/subscriptions  → SubscriptionsTab
  /finance/ledger         → LedgerTab
  /finance/invoices       → InvoicesTab
/operations/meetings  → MeetingsPage
/operations/notes     → NotesAndReminders
/settings             → Settings
/myorganization       → MyOrganization
/billing              → BillingUsage
* (catch-all)         → redirect to /dashboard
```

## Auth Guard

Protected routes are wrapped inside a component that checks the Supabase session. If no session, the user is redirected to `/login`. Do not add custom auth logic inside individual pages — rely on the existing route-level guard.

## Adding a New Route

1. Import the page component at the top of `App.jsx`
2. Add `<Route path="/your-path" element={<YourPage />} />` inside the protected route group
3. Add a sidebar nav entry if it should be globally accessible

## Client-Side Only

This is a fully client-side SPA (no SSR). All data fetching happens in components after mount via React Query. `react-router-dom` v7 is used (`BrowserRouter`).
