# Tercero — Feature Tiers & Implementation Guide (v5 — Final)

**Last Updated**: March 2026
**Status**: Implemented. All v5 features have been built and are live. This document reflects the current state of the codebase.
**Scope**: Current built features only. Campaigns, proposals, and documents are out of scope until those modules are built.

---

## Plan Overview

|                            | Ignite              | Velocity      | Quantum       |
| -------------------------- | ------------------- | ------------- | ------------- |
| **Price (Monthly)**        | ₹2,999/mo           | ₹8,999/mo     | ₹17,999/mo    |
| **Price (Annual, per mo)** | ₹2,499/mo           | ₹7,499/mo     | ₹14,999/mo    |
| **Billed Annually**        | ₹29,988/yr          | ₹89,988/yr    | ₹1,79,988/yr  |
| **Annual Saving**          | ₹6,000/yr           | ₹18,000/yr    | ₹36,000/yr    |
| **Trial**                  | 14 days full access | —             | —             |
| **Clients**                | Up to 5             | Up to 15      | Up to 35      |
| **Storage**                | 20 GB               | 100 GB        | 500 GB        |
| **Extra Client**           | ₹500/mo             | ₹500/mo       | ₹450/mo       |
| **Support**                | Email               | Priority Chat | VIP Concierge |

---

## Complete Feature Matrix

### Sidebar Branding

| Feature                                 | Ignite | Velocity | Quantum |
| --------------------------------------- | :----: | :------: | :-----: |
| Application logo (Tercero logo)         |   ✓    |    ✗     |    ✗    |
| Agency logo & name                      |   ✗    |    ✓     |    ✓    |
| "Tercero 2026" footer text              |   ✓    |    ✓     |    ✗    |

### Client Review Page (`/review/:token`)

| Feature                                  | Ignite | Velocity | Quantum |
| ---------------------------------------- | :----: | :------: | :-----: |
| Application logo in header               |   ✓    |    ✗     |    ✗    |
| Agency logo in header                    |   ✗    |    ✓     |    ✓    |
| "Powered by Tercero" footer              |   ✓    |    ✓     |    ✗    |

### Finance — Ledger

| Feature                         | Ignite | Velocity | Quantum |
| ------------------------------- | :----: | :------: | :-----: |
| Manual income & expense entries |   ✓    |    ✓     |    ✓    |
| Ledger filter by date & client  |   ✓    |    ✓     |    ✓    |

### Finance — Invoicing

| Feature                                       | Ignite | Velocity | Quantum |
| --------------------------------------------- | :----: | :------: | :-----: |
| Create & send invoices                        |   ✓    |    ✓     |    ✓    |
| Invoice PDF export                            |   ✓    |    ✓     |    ✓    |
| Invoice status workflow (Draft → Sent → Paid) |   ✓    |    ✓     |    ✓    |
| Auto-ledger entry when invoice marked paid    |   ✓    |    ✓     |    ✓    |
| Recurring invoice templates                   |   ✗    |    ✓     |    ✓    |
| Expense subscription tracking                 |   ✗    |    ✓     |    ✓    |
| Payment reminder emails                       |   ✗    |    ✗     |    ✗    |

> Payment reminders deferred — not being built at this stage.

### Finance — Reports & Overview

| Feature                          | Ignite | Velocity | Quantum |
| -------------------------------- | :----: | :------: | :-----: |
| Finance overview dashboard       |   ✓    |    ✓     |    ✓    |
| Revenue vs expenses chart        |   ✓    |    ✓     |    ✓    |
| Profitability trend chart        |   ✓    |    ✓     |    ✓    |
| Per-client profitability metrics |   ✓    |    ✓     |    ✓    |
| Outstanding invoices KPI         |   ✓    |    ✓     |    ✓    |

### Finance — Advanced

| Feature                           | Ignite | Velocity | Quantum |
| --------------------------------- | :----: | :------: | :-----: |
| Cash vs Accrual accounting toggle |   ✓    |    ✓     |    ✓    |
| CFO analysis / advanced reports   |   ✓    |    ✓     |    ✓    |
| Multi-currency support            |   ✓    |    ✓     |    ✓    |

### Content Calendar

| Feature                                              | Ignite | Velocity | Quantum |
| ---------------------------------------------------- | :----: | :------: | :-----: |
| Month view                                           |   ✓    |    ✓     |    ✓    |
| Week view                                            |   ✓    |    ✓     |    ✓    |
| Filter by client / platform / status                 |   ✓    |    ✓     |    ✓    |
| View posts & meetings on calendar                    |   ✓    |    ✓     |    ✓    |
| Create post from calendar                            |   ✓    |    ✓     |    ✓    |
| Generate & export calendar report (PDF)              |   ✗    |    ✓     |    ✓    |

### Posts & Content

| Feature                                      | Ignite | Velocity | Quantum |
| -------------------------------------------- | :----: | :------: | :-----: |
| Post creation                                |   ✓    |    ✓     |    ✓    |
| Post versioning & history                    |   ✓    |    ✓     |    ✓    |
| All post statuses (Draft → Scheduled)        |   ✓    |    ✓     |    ✓    |
| Platform previews (IG, LinkedIn, X, YouTube) |   ✓    |    ✓     |    ✓    |
| Media upload (images & video)                |   ✓    |    ✓     |    ✓    |
| Public client review link                    |   ✓    |    ✓     |    ✓    |
| Admin notes on posts                         |   ✓    |    ✓     |    ✓    |
| Global posts page                            |   ✓    |    ✓     |    ✓    |
| Bulk post actions                            |   ✓    |    ✓     |    ✓    |

### Dashboard

| Feature                   | Ignite | Velocity | Quantum |
| ------------------------- | :----: | :------: | :-----: |
| Agency health KPI bar     |   ✓    |    ✓     |    ✓    |
| Content pipeline widget   |   ✓    |    ✓     |    ✓    |
| Week timeline             |   ✓    |    ✓     |    ✓    |
| Client health grid        |   ✓    |    ✓     |    ✓    |
| Financial snapshot        |   ✓    |    ✓     |    ✓    |
| Lifetime revenue chart    |   ✓    |    ✓     |    ✓    |
| Recent invoices widget    |   ✓    |    ✓     |    ✓    |
| Profitability trend chart |   ✓    |    ✓     |    ✓    |
| Meetings & notes widgets  |   ✓    |    ✓     |    ✓    |

### Client Management

| Feature                                | Ignite | Velocity | Quantum |
| -------------------------------------- | :----: | :------: | :-----: |
| Max active clients                     |   5    |    15    |   35    |
| Internal workspace                     |   ✓    |    ✓     |    ✓    |
| Client tiers (Bronze/Silver/Gold etc.) |   ✓    |    ✓     |    ✓    |
| Per-client profitability metrics       |   ✓    |    ✓     |    ✓    |
| Client activity log                    |   ✓    |    ✓     |    ✓    |

### Meetings

| Feature                      | Ignite | Velocity | Quantum |
| ---------------------------- | :----: | :------: | :-----: |
| Create & manage meetings     |   ✓    |    ✓     |    ✓    |
| Meeting link (Zoom/Meet URL) |   ✓    |    ✓     |    ✓    |
| In-app meeting reminders     |   ✓    |    ✓     |    ✓    |

### Notes & Reminders

| Feature                                 | Ignite | Velocity | Quantum |
| --------------------------------------- | :----: | :------: | :-----: |
| Create & manage notes                   |   ✓    |    ✓     |    ✓    |
| Status cycling (Todo / Done / Archived) |   ✓    |    ✓     |    ✓    |
| Client assignment                       |   ✓    |    ✓     |    ✓    |
| Due date email reminders                |   ✓    |    ✓     |    ✓    |

### Documents

| Feature                                     | Ignite | Velocity | Quantum |
| ------------------------------------------- | :----: | :------: | :-----: |
| Upload, view, preview, download documents   |   ✓    |    ✓     |    ✓    |
| Rename, recategorise, archive, delete       |   ✓    |    ✓     |    ✓    |
| Global `/documents` page                    |   ✓    |    ✓     |    ✓    |
| Per-client Documents tab                    |   ✓    |    ✓     |    ✓    |
| Collections (create, manage, move)          |   ✗    |    ✓     |    ✓    |

> Collections locked on Ignite (visible, disabled with lock icon). All basic document operations open on all tiers.

### Storage & Support

| Feature             | Ignite  |   Velocity    |    Quantum    |
| ------------------- | :-----: | :-----------: | :-----------: |
| Storage             |  20 GB  |    100 GB     |    500 GB     |
| Extra client add-on | ₹500/mo |    ₹500/mo    |    ₹450/mo    |
| Support             |  Email  | Priority Chat | VIP Concierge |

---

## DB Reference

### Confirmed `agency_subscriptions` Table (Live — March 2026)

This is the current confirmed state of the table after the v5 migration + Phase 6 documents gating. 28 columns total.

| column_name                  | data_type   | default     | nullable | purpose                                                        |
| ---------------------------- | ----------- | ----------- | :------: | -------------------------------------------------------------- |
| `user_id`                    | uuid        | —           |    NO    | Primary key / RLS                                              |
| `plan_name`                  | text        | `'ignite'`  |   YES    | Tier name: trial / ignite / velocity / quantum                 |
| `max_clients`                | integer     | —           |   YES    | Client count limit enforcement                                 |
| `max_storage_bytes`          | bigint      | —           |   YES    | Storage limit enforcement                                      |
| `current_storage_used`       | bigint      | `0`         |   YES    | Tracks current storage consumption                             |
| `is_active`                  | boolean     | `true`      |   YES    | Account active / suspended flag                                |
| `created_at`                 | timestamptz | `now()`     |   YES    | Account creation timestamp                                     |
| `updated_at`                 | timestamptz | `now()`     |   YES    | Last update timestamp                                          |
| `agency_name`                | text        | —           |   YES    | Agency display name — sidebar + invoice PDF                    |
| `logo_url`                   | text        | —           |   YES    | Agency logo — sidebar + review page                            |
| `primary_color`              | text        | `'#6366f1'` |   YES    | Agency brand colour                                            |
| `social_links`               | jsonb       | `'{}'`      |   YES    | Agency social media links                                      |
| `industry`                   | text        | —           |   YES    | Agency industry (settings)                                     |
| `platforms`                  | jsonb       | `'[]'`      |   YES    | Active platforms (settings)                                    |
| `email`                      | text        | —           |   YES    | Agency contact email                                           |
| `mobile_number`              | text        | —           |   YES    | Agency contact number                                          |
| `description`                | text        | —           |   YES    | Agency description                                             |
| `next_invoice_number`        | integer     | `1`         |    NO    | Sequential invoice number counter                              |
| `branding_agency_sidebar`    | boolean     | `false`     |   YES    | Show agency logo+name in sidebar (Velocity+)                   |
| `branding_powered_by`        | boolean     | `true`      |   YES    | Show "Tercero 2026" + "Powered by Tercero" (Ignite + Velocity) |
| `billing_cycle`              | text        | `'monthly'` |   YES    | monthly / annual                                               |
| `trial_ends_at`              | timestamptz | —           |   YES    | Trial expiry — null after conversion                           |
| `extra_client_price_inr`     | integer     | `500`       |   YES    | Add-on client price in INR                                     |
| `finance_subscriptions`      | boolean     | `false`     |   YES    | Expense subscriptions route gate (Velocity+)                   |
| `calendar_export`            | boolean     | `false`     |   YES    | Calendar PDF export gate (Velocity+)                           |
| `finance_recurring_invoices` | boolean     | `false`     |   YES    | Recurring invoice templates gate (Velocity+)                   |
| `documents_collections`      | boolean     | `false`     |   YES    | Document collections create/manage/move gate (Velocity+)       |

> **Renamed columns**: `basic_whitelabel_enabled` → `branding_agency_sidebar`, `full_whitelabel_enabled` → `branding_powered_by`. Update all references in the codebase accordingly — search for both old names and replace.

---

### Feature Flag Values per Plan

| Flag                         | Trial | Ignite | Velocity | Quantum |
| ---------------------------- | :---: | :----: | :------: | :-----: |
| `branding_agency_sidebar`    | FALSE | FALSE  |   TRUE   |  TRUE   |
| `branding_powered_by`        | TRUE  |  TRUE  |   TRUE   |  FALSE  |
| `finance_recurring_invoices` | FALSE | FALSE  |   TRUE   |  TRUE   |
| `finance_subscriptions`      | FALSE | FALSE  |   TRUE   |  TRUE   |
| `calendar_export`            | FALSE | FALSE  |   TRUE   |  TRUE   |
| `documents_collections`      | FALSE | FALSE  |   TRUE   |  TRUE   |

### Plan Limit Values per Plan

| Column                   |    Trial    |   Ignite    |   Velocity   |   Quantum    |
| ------------------------ | :---------: | :---------: | :----------: | :----------: |
| `max_clients`            |      5      |      5      |      15      |      35      |
| `max_storage_bytes`      | 21474836480 | 21474836480 | 107374182400 | 536870912000 |
| `extra_client_price_inr` |     500     |     500     |     500      |     450      |

### Seed SQL (run when a plan is created or changed)

```sql
-- TRIAL (same limits as Ignite, time-limited via trial_ends_at)
UPDATE agency_subscriptions SET
  plan_name                  = 'trial',
  max_clients                = 5,
  max_storage_bytes          = 21474836480,
  branding_agency_sidebar    = FALSE,
  branding_powered_by        = TRUE,
  finance_recurring_invoices = FALSE,
  finance_subscriptions      = FALSE,
  calendar_export            = FALSE,
  documents_collections      = FALSE
WHERE user_id = $1;

-- IGNITE
UPDATE agency_subscriptions SET
  plan_name                  = 'ignite',
  max_clients                = 5,
  max_storage_bytes          = 21474836480,
  extra_client_price_inr     = 500,
  branding_agency_sidebar    = FALSE,
  branding_powered_by        = TRUE,
  finance_recurring_invoices = FALSE,
  finance_subscriptions      = FALSE,
  calendar_export            = FALSE,
  documents_collections      = FALSE
WHERE user_id = $1;

-- VELOCITY
UPDATE agency_subscriptions SET
  plan_name                  = 'velocity',
  max_clients                = 15,
  max_storage_bytes          = 107374182400,
  extra_client_price_inr     = 500,
  branding_agency_sidebar    = TRUE,
  branding_powered_by        = TRUE,
  finance_recurring_invoices = TRUE,
  finance_subscriptions      = TRUE,
  calendar_export            = TRUE,
  documents_collections      = TRUE
WHERE user_id = $1;

-- QUANTUM
UPDATE agency_subscriptions SET
  plan_name                  = 'quantum',
  max_clients                = 35,
  max_storage_bytes          = 536870912000,
  extra_client_price_inr     = 450,
  branding_agency_sidebar    = TRUE,
  branding_powered_by        = FALSE,
  finance_recurring_invoices = TRUE,
  finance_subscriptions      = TRUE,
  calendar_export            = TRUE,
  documents_collections      = TRUE
WHERE user_id = $1;
```

---

## `useSubscription` Hook — Updated

Extend the existing `src/api/useSubscription.js` to expose only the flags that are actively enforced:

```javascript
// src/api/useSubscription.js

export function useSubscription() {
  // ... existing query fetching agency_subscriptions row ...

  const sub = data // the subscription row

  const can = {
    // Branding
    useAgencySidebar: () => sub.branding_agency_sidebar ?? false,
    showPoweredBy: () => sub.branding_powered_by ?? true,

    // Finance
    recurringInvoices: () => sub.finance_recurring_invoices ?? false,
    expenseSubscriptions: () => sub.finance_subscriptions ?? false,

    // Calendar
    calendarExport: () => sub.calendar_export ?? false,

    // Limits
    addClient: (currentCount) =>
      sub.max_clients === null || currentCount < sub.max_clients,
  }

  return { subscription: sub, can, planName: sub.plan_name }
}
```

> **Defaults are defensive**: if a flag is missing from the DB row for any reason, it falls back to the most restricted state — except `branding_powered_by` which defaults to `true` (show Tercero branding) to protect brand exposure.

---

## Implementation Notes

Three features were built from scratch. Each section below documents what was built and where.

---

### Feature 1 — Sidebar Footer "Tercero 2026" Text

**What**: A small text label reading "Tercero 2026" (or the current year dynamically) rendered just above the existing `SidebarFooter` component. Visible on Ignite and Velocity. Hidden on Quantum.

**Why it exists**: Tercero brand attribution for non-whitelabelled tiers. On Quantum, the sidebar is fully agency-branded with no Tercero identity.

**Where to implement**: `src/AppShell.jsx` (or wherever your sidebar layout is composed — the file that renders the sidebar and includes the footer section).

**Implementation**:

```jsx
// Inside your sidebar layout, just above <SidebarFooter /> (or equivalent):

import { useSubscription } from '@/api/useSubscription'

const { can } = useSubscription()
const currentYear = new Date().getFullYear()

{
  can.showPoweredBy() && (
    <div className="px-3 py-2">
      <p className="text-xs text-muted-foreground/50 select-none">
        Tercero {currentYear}
      </p>
    </div>
  )
}
```

**Important — do not change**:

- The existing `SidebarFooter` component (user account, settings link) must remain untouched and always visible on all tiers.
- The sidebar header (logo + agency name area) already reads from `useSubscription` for `branding_agency_sidebar` — this new addition is only the footer text, independent of that logic.

**Checklist**:

- [x]Text appears on Ignite (app logo in header, "Tercero 2026" above footer)
- [x]Text appears on Velocity (agency logo in header, "Tercero 2026" above footer)
- [x]Text hidden on Quantum (agency logo in header, no Tercero attribution)
- [x]Year is dynamic (`new Date().getFullYear()`) — not hardcoded
- [x]Existing sidebar footer component unchanged

---

### Feature 2 — "Powered by Tercero" Footer on Public Review Page

**What**: A footer strip at the bottom of the public review page (`/review/:token`) that reads "Powered by Tercero". Visible on Ignite and Velocity. Hidden on Quantum.

**Where to implement**: `src/pages/PublicReview.jsx`

**Data source**: The review page is public and unauthenticated — it does not have access to `useSubscription()` directly. The subscription data needs to be fetched server-side or passed through the review token lookup.

**How to fetch plan data on the public page**:

The review token lookup already queries the `post_versions` table (or similar) to fetch the post. That query joins to `posts → clients → user_id`. From `user_id` you can fetch the relevant `agency_subscriptions` row in the same query or as a secondary query.

Option A — add to existing token query (recommended):

```javascript
// In your existing review token fetch (src/api/posts.js or similar)
// Extend the query to also return the agency's branding_powered_by flag

const { data } = await supabase
  .from('post_versions')
  .select(
    `
    *,
    posts (
      *,
      clients (
        *,
        agency_subscriptions!inner (
          branding_agency_sidebar,
          branding_powered_by,
          agency_name,
          logo_url
        )
      )
    )
  `,
  )
  .eq('review_token', token)
  .single()

// branding_powered_by and logo_url are now available from data.posts.clients.agency_subscriptions
```

Option B — separate lightweight query using the agency's user_id from the resolved post.

**Implementation in `PublicReview.jsx`**:

```jsx
// Derive from your review data fetch:
const agencySub = reviewData?.posts?.clients?.agency_subscriptions
const showPoweredBy = agencySub?.branding_powered_by ?? true
const showAgencyLogo = agencySub?.branding_agency_sidebar ?? false
const agencyLogoUrl = agencySub?.logo_url

// Header — conditional logo
;<header>
  {
    showAgencyLogo && agencyLogoUrl ? (
      <img src={agencyLogoUrl} alt="Agency logo" className="h-8 w-auto" />
    ) : (
      <TerceroLogo />
    ) // your existing app logo component
  }
</header>

// ... existing review page content (unchanged) ...

// Footer — add at the bottom of the page
{
  showPoweredBy && (
    <footer className="mt-auto py-4 text-center border-t border-border">
      <p className="text-xs text-muted-foreground/60">Powered by Tercero</p>
    </footer>
  )
}
```

**Important — do not change**:

- The entire existing review flow (feedback textarea, "Request Revisions" button, media gallery, platform previews, version number display) must remain completely untouched.
- This is purely additive — a header logo swap and an optional footer line.
- The page remains fully public and unauthenticated. No auth changes.

**Checklist**:

- [x]Ignite: Tercero app logo in header, "Powered by Tercero" in footer
- [x]Velocity: Agency logo in header (from `logo_url`), "Powered by Tercero" in footer
- [x]Quantum: Agency logo in header, no footer text
- [x]If `logo_url` is null on Velocity/Quantum, fall back to app logo gracefully (don't render broken image)
- [x]Footer does not appear if `branding_powered_by = false`
- [x]Existing review functionality (feedback, revisions, media) unchanged
- [x]Page still works with no authentication

---

### Feature 3 — Calendar Report Generation & PDF Export

**What**: A "Generate Report" button on the calendar page that produces a PDF summary of the content schedule for the selected month or week. Visible and functional on Velocity and Quantum. Hidden (or locked with upgrade nudge) on Ignite.

**Where to implement**: `src/pages/calendar/ContentCalendar.jsx`

**What the report should contain**:

- Agency name and logo (from subscription branding)
- Report period label (e.g. "March 2026" for month view, "3–9 Mar 2026" for week view)
- For each day in the period: list of posts with title, client name, platform badges, and status
- Summary counts at the top: total posts, breakdown by status, breakdown by platform
- Generated date in the footer

**PDF generation**: Use `@react-pdf/renderer` — it is already installed in the project (used for invoice PDF export). Follow the same pattern as the existing invoice PDF utility.

**Suggested file structure**:

```
src/pages/calendar/
  ContentCalendar.jsx          ← existing, add button here
  CalendarReportPDF.jsx        ← new: PDF document component
  useCalendarReport.js         ← new: data preparation hook
```

**Implementation outline**:

```jsx
// src/pages/calendar/useCalendarReport.js
// Transforms existing calendar data (already fetched by ContentCalendar)
// into a flat structure suitable for the PDF renderer.

export function useCalendarReport(posts, viewMode, currentDate) {
  // viewMode: 'month' | 'week'
  // posts: already fetched array from useGlobalPosts or get_global_calendar RPC
  // Returns: { days: [{ date, posts: [] }], summary: { total, byStatus, byPlatform } }
}
```

```jsx
// src/pages/calendar/CalendarReportPDF.jsx
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
} from '@react-pdf/renderer'

// Follows same styling conventions as existing invoice PDF
// Accepts: { reportData, agencyName, agencyLogoUrl, period }
```

```jsx
// In ContentCalendar.jsx — add to the filters bar:
import { useSubscription } from '@/api/useSubscription'
import { pdf } from '@react-pdf/renderer'

const { can } = useSubscription()

// In the filters/controls bar, alongside existing filter dropdowns:
{
  can.calendarExport() ? (
    <Button
      variant="outline"
      size="sm"
      onClick={handleGenerateReport}
      disabled={isGenerating}
    >
      {isGenerating ? 'Generating...' : 'Export Report'}
    </Button>
  ) : (
    <Button
      variant="outline"
      size="sm"
      disabled
      title="Upgrade to Velocity to export calendar reports"
    >
      Export Report
      <LockIcon className="ml-2 h-3 w-3 opacity-50" />
    </Button>
  )
}

// Handler:
const handleGenerateReport = async () => {
  setIsGenerating(true)
  const reportData = buildCalendarReport(posts, viewMode, currentDate)
  const blob = await pdf(
    <CalendarReportPDF
      reportData={reportData}
      agencyName={subscription.agency_name}
      agencyLogoUrl={subscription.logo_url}
      period={getPeriodLabel(viewMode, currentDate)}
    />,
  ).toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `tercero-calendar-${getPeriodLabel(viewMode, currentDate)}.pdf`
  a.click()
  URL.revokeObjectURL(url)
  setIsGenerating(false)
}
```

**Important — do not change**:

- Existing calendar data fetching logic (the `get_global_calendar` RPC or equivalent) is read-only input — do not modify it.
- Month view and week view rendering must remain exactly as-is.
- All existing filters (status, client, platform, search) remain unchanged.
- The export button is purely additive to the filters bar — do not restructure the calendar layout.

**Checklist**:

- [x]Export button visible on Velocity and Quantum
- [x]Export button visible but disabled (with lock icon + tooltip) on Ignite
- [x]Report generates correctly for both month view and week view
- [x]Report includes agency name and logo (respects branding tier)
- [x]PDF filename includes period (e.g. `tercero-calendar-march-2026.pdf`)
- [x]Loading state shown during generation (button disabled, "Generating..." text)
- [x]No changes to existing calendar rendering or data fetching
- [x]Uses `@react-pdf/renderer` consistent with invoice PDF implementation

---

## Finance Enforcement — Recurring Invoices & Subscriptions

These are existing built features that need gating — no new UI to build, just conditional rendering.

### Recurring Invoice Templates

**Where**: `src/pages/finance/InvoicesTab.jsx`

The invoices page has two tabs: "One-off" and "Recurring". On Ignite, hide the "Recurring" tab entirely. The one-off tab remains fully functional.

```jsx
import { useSubscription } from '@/api/useSubscription'
const { can } = useSubscription()

// In the tab list:
;<TabsList>
  <TabsTrigger value="one-off">Invoices</TabsTrigger>
  {can.recurringInvoices() && (
    <TabsTrigger value="recurring">Recurring</TabsTrigger>
  )}
</TabsList>

// Guard the TabsContent too:
{
  can.recurringInvoices() && (
    <TabsContent value="recurring">
      {/* existing recurring tab content */}
    </TabsContent>
  )
}
```

**Do not change**: The one-off invoice creation flow, `CreateInvoiceDialog`, `EditInvoiceDialog`, the invoice list table, PDF download, or any mutation hooks.

**Checklist**:

- [x]Recurring tab hidden on Ignite
- [x]Recurring tab visible and functional on Velocity and Quantum
- [x]One-off invoicing fully functional on all tiers
- [x]No changes to invoice hooks or dialogs

### Expense Subscriptions Route

**Where**: Finance nav item + `src/pages/finance/FinanceLayout.jsx` (or wherever finance sub-routes are defined)

On Ignite, hide the Subscriptions nav item and redirect `/finance/subscriptions` to `/finance/invoices` with a toast nudge.

```jsx
// In finance nav/sidebar sub-items:
{
  can.expenseSubscriptions() && (
    <NavItem to="/finance/subscriptions">Subscriptions</NavItem>
  )
}

// In route definitions (or FinanceLayout):
{
  !can.expenseSubscriptions() && (
    <Route
      path="/finance/subscriptions"
      element={
        <Navigate to="/finance/invoices" replace />
        // optionally fire a toast: "Upgrade to Velocity to track recurring expenses"
      }
    />
  )
}
```

**Checklist**:

- [x]Subscriptions nav item hidden on Ignite
- [x]Navigating to `/finance/subscriptions` on Ignite redirects to `/finance/invoices`
- [x]Subscriptions fully accessible on Velocity and Quantum
- [x]No changes to the subscriptions page itself or its hooks

---

## Trial Account Behaviour

Trial accounts (`plan_name = 'trial'`) receive full **Ignite-level** access with a `trial_ends_at` timestamp.

```javascript
// src/context/AuthContext.jsx or AppShell.jsx

const isTrialExpired = () => {
  if (subscription?.plan_name !== 'trial') return false
  return new Date() > new Date(subscription.trial_ends_at)
}

// If expired:
// → Redirect to /billing with banner: "Your trial has ended. Your data is safe — choose a plan to continue."
// → 48h grace period: read-only (all create/edit actions blocked)
// → Day 30 post-expiry: soft delete
```

**Trial expiry UX timeline**:

- Day 10: Dashboard banner — "4 days left on your trial."
- Day 13: Email — "Your trial ends tomorrow."
- Day 14: In-app banner — "Your trial has ended."
- Day 14 + 48h: Read-only mode.
- Day 44: Soft delete.

---

## Testing Checklist — Three Accounts

Create one account per tier and verify the following across all three.

### Sidebar

- [x]Ignite: Tercero app logo, "Tercero 2026" above footer, no agency branding
- [x]Velocity: Agency logo & name, "Tercero 2026" above footer
- [x]Quantum: Agency logo & name, no "Tercero 2026" text

### Public Review Page (`/review/:token`)

- [x]Ignite: App logo in header, "Powered by Tercero" in footer
- [x]Velocity: Agency logo in header, "Powered by Tercero" in footer
- [x]Quantum: Agency logo in header, no footer text
- [x]All three: Review flow (feedback, revisions, media) works identically

### Finance

- [x]Ignite: One-off invoices work fully. Recurring tab not visible. Subscriptions nav item not visible.
- [x]Velocity: Both invoice tabs visible. Subscriptions accessible.
- [x]Quantum: Same as Velocity.
- [x]All three: Ledger, finance overview, reports, per-client profitability all accessible.

### Calendar

- [x]Ignite: Calendar fully functional. Export button visible but disabled with lock icon.
- [x]Velocity: Export button active. PDF generates correctly for month and week view.
- [x]Quantum: Same as Velocity.

### Limits

- [x]Ignite: Cannot create a 6th client (hard block with message)
- [x]Velocity: Cannot create a 16th client
- [x]Quantum: Cannot create a 36th client

---

## Change Log

| Version | Date       | Summary                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| v1      | March 2026 | Original                                                                                                                                                                                                                                                                                                                                                                                                                  |
| v2      | March 2026 | Updated pricing, restructured finance gating                                                                                                                                                                                                                                                                                                                                                                              |
| v3      | March 2026 | Stripped campaigns, proposals, documents                                                                                                                                                                                                                                                                                                                                                                                  |
| v4      | March 2026 | Basic invoicing open to all tiers. Per-client profitability open to all tiers. Recurring templates → Velocity+.                                                                                                                                                                                                                                                                                                           |
| v5      | March 2026 | Final confirmed decisions. Most features open to all tiers. Only gates: sidebar branding, review page branding, recurring invoices, expense subscriptions, calendar export. Three new features to build: sidebar footer text, review page "Powered by Tercero" footer, calendar PDF export. Payment reminders deferred. Full implementation instructions added. DB table confirmed and documented with live column state. |
| v5.1    | March 2026 | Documents Phase 6 — subscription-based scoping for Collections. Added `documents_collections` flag (Velocity+). DB column live. UI: "New Collection" buttons locked, CollectionCards dimmed with lock icon, "Move to Collection" menu item disabled, Collections section on global page shows upgrade banner. Per-client basic document operations remain open on all tiers. |
