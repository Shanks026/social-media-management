# Tercero — Feature Tiers & Implementation Guide (v5 — Final)

**Last Updated**: March 2026
**Status**: Implemented. All features documented here are live in the codebase.
**Scope**: Full feature set — Core platform, Finance gating, Whitelabeling, Campaigns, Documents, Teams, Proposals.

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

### Client Review Pages (`/review/:token` and `/campaign-review/:token`)

| Feature                                  | Ignite | Velocity | Quantum |
| ---------------------------------------- | :----: | :------: | :-----: |
| Application logo in header               |   ✓    |    ✗     |    ✗    |
| Agency logo in header                    |   ✗    |    ✓     |    ✓    |
| Horizontal logo preferred in header      |   ✗    |    ✓     |    ✓    |
| "Powered by Tercero" footer              |   ✓    |    ✓     |    ✗    |

> Both `/review/:token` (per-post) and `/campaign-review/:token` (campaign bulk review) use identical branding logic.

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
| Cash vs Accrual accounting toggle|   ✓    |    ✓     |    ✓    |

### Content Calendar

| Feature                                              | Ignite | Velocity | Quantum |
| ---------------------------------------------------- | :----: | :------: | :-----: |
| Month view                                           |   ✓    |    ✓     |    ✓    |
| Week view                                            |   ✓    |    ✓     |    ✓    |
| Filter by client / platform / status                 |   ✓    |    ✓     |    ✓    |
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
| Meetings & notes widgets  |   ✓    |    ✓     |    ✓    |

### Client Management

| Feature                                | Ignite | Velocity | Quantum |
| -------------------------------------- | :----: | :------: | :-----: |
| Max active clients                     |   5    |    15    |   35    |
| Internal workspace                     |   ✓    |    ✓     |    ✓    |
| Client tiers (Bronze/Silver/Gold etc.) |   ✓    |    ✓     |    ✓    |
| Per-client profitability metrics       |   ✓    |    ✓     |    ✓    |

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

### Documents

| Feature                                     | Ignite | Velocity | Quantum |
| ------------------------------------------- | :----: | :------: | :-----: |
| Upload, view, preview, download documents   |   ✓    |    ✓     |    ✓    |
| Rename, recategorise, archive, delete       |   ✓    |    ✓     |    ✓    |
| Global `/documents` page                    |   ✓    |    ✓     |    ✓    |
| Per-client Documents tab                    |   ✓    |    ✓     |    ✓    |
| Collections (create, manage, move)          |   ✗    |    ✓     |    ✓    |

> Collections locked on Ignite — visible, disabled with lock icon. All basic document operations open on all tiers.

### Campaigns

| Feature                                        | Ignite | Velocity | Quantum |
| ---------------------------------------------- | :----: | :------: | :-----: |
| Campaign list (`/campaigns`)                   |   ✗    |    ✓     |    ✓    |
| Campaign detail page (KPIs, posts, budget)     |   ✗    |    ✓     |    ✓    |
| Campaign PDF report export                     |   ✗    |    ✓     |    ✓    |
| Share review link (bulk client approval)       |   ✗    |    ✓     |    ✓    |
| Campaign review email                          |   ✗    |    ✓     |    ✓    |
| Per-client Campaigns tab in Client Detail      |   ✗    |    ✓     |    ✓    |

> Campaigns are hidden on Trial/Ignite — the `/campaigns` route and the per-client Campaigns tab both render a `CampaignUpgradePrompt` component instead. Controlled by the `campaigns` boolean flag.

### Proposals

| Feature                                              | Ignite | Velocity | Quantum |
| ---------------------------------------------------- | :----: | :------: | :-----: |
| Global Proposals page (`/proposals`)                 |   ✓    |    ✓     |    ✓    |
| Proposal detail page (`/proposals/:id`)              |   ✓    |    ✓     |    ✓    |
| Build proposal in Tercero (form + live preview)      |   ✓    |    ✓     |    ✓    |
| Upload existing PDF proposal                         |   ✓    |    ✓     |    ✓    |
| Proposal PDF export (built proposals only)           |   ✓    |    ✓     |    ✓    |
| Share proposal link (public review page)             |   ✓    |    ✓     |    ✓    |
| Client accept / decline flow                         |   ✓    |    ✓     |    ✓    |
| Per-client Proposals tab in Client Detail            |   ✓    |    ✓     |    ✓    |
| Prospect proposals (no linked client)                |   ✓    |    ✓     |    ✓    |
| Proposal limit: 5 total (non-archived)               |   5    |    ✗     |    ✗    |
| Unlimited proposals                                  |   ✗    |    ✓     |    ✓    |

> Proposals use a **hybrid gating pattern**: the nav item, page, and per-client tab are always visible on all tiers. Gating triggers only at the point of creation — Trial/Ignite show a live counter ("3 of 5 used") and open `ProposalsUpgradePrompt` when the limit is reached. Velocity+ has no counter and no limit. Controlled by `proposals_limit` integer column (`5` for Trial/Ignite, `null` for Velocity/Quantum).
>
> Two proposal types exist: **built** (created in Tercero with full inline editing, live preview, and PDF export) and **uploaded** (pre-written PDF attached to metadata — title, client, valid_until, deal value; shows embedded PDF viewer with Download + Replace File buttons; PDF export not available). Both types share the same status lifecycle (draft → sent → viewed → accepted/declined/expired/archived), share link flow, and limit counting. Uploaded files are stored in the `proposal-files` bucket (public) scoped to `${workspaceUserId}/${proposalId}/${timestamp}.pdf`. Storage usage tracked via `increment_storage_used` RPC. Hard-deleting a draft proposal also removes its uploaded file from storage.

### Teams

| Feature                                          | Ignite | Velocity | Quantum |
| ------------------------------------------------ | :----: | :------: | :-----: |
| Invite team members via link                     |   ✓    |    ✓     |    ✓    |
| Team member roster (Settings → Team tab)         |   ✓    |    ✓     |    ✓    |
| Remove team members                              |   ✓    |    ✓     |    ✓    |
| Revoke pending invites                           |   ✓    |    ✓     |    ✓    |
| Full workspace access for team members           |   ✓    |    ✓     |    ✓    |
| Real-time team roster updates                    |   ✓    |    ✓     |    ✓    |
| Seat limits per plan                             |   ✗    |    ✗     |    ✗    |

> **Teams Phase 1**: No subscription gating — all plans allow unlimited team members. Seat limits deferred until beta usage data is collected. Teams lives in Settings → Team tab (not the sidebar).

### Storage & Support

| Feature             | Ignite  |   Velocity    |    Quantum    |
| ------------------- | :-----: | :-----------: | :-----------: |
| Storage             |  20 GB  |    100 GB     |    500 GB     |
| Extra client add-on | ₹500/mo |    ₹500/mo    |    ₹450/mo    |
| Support             |  Email  | Priority Chat | VIP Concierge |

---

## DB Reference

### Confirmed `agency_subscriptions` Table (Live — March 2026)

30 columns total.

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
| `logo_url`                   | text        | —           |   YES    | Agency square logo — sidebar + review pages                    |
| `logo_horizontal_url`        | text        | —           |   YES    | Agency landscape logo — preferred in sidebar expanded state and review page headers (Velocity+); managed via HorizontalLogoCropDialog |
| `primary_color`              | text        | `'#6366f1'` |   YES    | Agency brand colour                                            |
| `social_links`               | jsonb       | `'{}'`      |   YES    | Agency social media links                                      |
| `industry`                   | text        | —           |   YES    | Agency industry (settings)                                     |
| `platforms`                  | jsonb       | `'[]'`      |   YES    | Active platforms (settings)                                    |
| `email`                      | text        | —           |   YES    | Agency contact email                                           |
| `mobile_number`              | text        | —           |   YES    | Agency contact number                                          |
| `description`                | text        | —           |   YES    | Agency description                                             |
| `next_invoice_number`        | integer     | `1`         |    NO    | Sequential invoice number counter                              |
| `branding_agency_sidebar`    | boolean     | `false`     |   YES    | Show agency logo+name in sidebar + on public review page headers (Velocity+) |
| `branding_powered_by`        | boolean     | `true`      |   YES    | Show "Tercero 2026" sidebar footer + "Powered by Tercero" on public pages (Ignite + Velocity) |
| `billing_cycle`              | text        | `'monthly'` |   YES    | monthly / annual                                               |
| `trial_ends_at`              | timestamptz | —           |   YES    | Trial expiry — null after conversion                           |
| `extra_client_price_inr`     | integer     | `500`       |   YES    | Add-on client price in INR                                     |
| `finance_subscriptions`      | boolean     | `false`     |   YES    | Expense subscriptions route gate (Velocity+)                   |
| `finance_accrual`            | boolean     | `false`     |   YES    | Cash vs Accrual accounting mode toggle in Finance overview — available on all tiers (flag exists but set true on all plans) |
| `calendar_export`            | boolean     | `false`     |   YES    | Calendar PDF export gate (Velocity+)                           |
| `finance_recurring_invoices` | boolean     | `false`     |   YES    | Recurring invoice templates gate (Velocity+)                   |
| `documents_collections`      | boolean     | `false`     |   YES    | Document collections create/manage/move gate (Velocity+)       |
| `campaigns`                  | boolean     | `false`     |   YES    | Campaigns feature gate — list, detail, review link (Velocity+) |
| `proposals_limit`            | integer     | `5`         |   YES    | Max non-archived proposals (null = unlimited; 5 for Trial/Ignite) |

> **Column naming**: `branding_agency_sidebar` controls agency logo display in both the sidebar AND public review page headers. `branding_powered_by` controls the sidebar footer text AND "Powered by Tercero" on public pages. These are the canonical column names.

---

### Feature Flag Values per Plan

| Flag                         | Trial | Ignite | Velocity | Quantum |
| ---------------------------- | :---: | :----: | :------: | :-----: |
| `branding_agency_sidebar`    | TRUE  | FALSE  |   TRUE   |  TRUE   |
| `branding_powered_by`        | FALSE |  TRUE  |   TRUE   |  FALSE  |
| `finance_recurring_invoices` | TRUE  | FALSE  |   TRUE   |  TRUE   |
| `finance_subscriptions`      | TRUE  | FALSE  |   TRUE   |  TRUE   |
| `finance_accrual`            | TRUE  | FALSE  |   TRUE   |  TRUE   |
| `calendar_export`            | TRUE  | FALSE  |   TRUE   |  TRUE   |
| `documents_collections`      | TRUE  | FALSE  |   TRUE   |  TRUE   |
| `campaigns`                  | TRUE  | FALSE  |   TRUE   |  TRUE   |

### Plan Limit Values per Plan

| Column                   |    Trial     |   Ignite    |   Velocity   |   Quantum    |
| ------------------------ | :----------: | :---------: | :----------: | :----------: |
| `max_clients`            |      30      |      5      |      15      |      30      |
| `max_storage_bytes`      | 107374182400 | 21474836480 | 53687091200  | 107374182400 |
| `extra_client_price_inr` |     null     |     499     |     499      |     499      |
| `proposals_limit`        |     null     |      5      |    null      |    null      |
| `max_team_members`       |     null     |      2      |      5       |    null      |

### Seed SQL (run when a plan is created or changed)

```sql
-- TRIAL (mirrors Quantum — full access, time-limited via trial_ends_at)
UPDATE agency_subscriptions SET
  plan_name                  = 'trial',
  max_clients                = 30,
  max_storage_bytes          = 107374182400,
  branding_agency_sidebar    = TRUE,
  branding_powered_by        = FALSE,
  finance_recurring_invoices = TRUE,
  finance_subscriptions      = TRUE,
  finance_accrual            = TRUE,
  calendar_export            = TRUE,
  documents_collections      = TRUE,
  campaigns                  = TRUE,
  proposals_limit            = NULL,
  max_team_members           = NULL
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
  documents_collections      = FALSE,
  campaigns                  = FALSE,
  proposals_limit            = 5
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
  documents_collections      = TRUE,
  campaigns                  = TRUE,
  proposals_limit            = NULL
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
  documents_collections      = TRUE,
  campaigns                  = TRUE,
  proposals_limit            = NULL
WHERE user_id = $1;
```

---

## `useSubscription` Hook — Current Implementation

The hook lives at `src/api/useSubscription.js`. Returns a **React Query result** — consume via `const { data: sub } = useSubscription()`.

The `data` object is a **flat object** — read flags directly. There are **no** `can.*` methods.

```js
const { data: sub } = useSubscription()

// Plan name
sub?.plan_name          // 'trial' | 'ignite' | 'velocity' | 'quantum'

// Agency branding
sub?.agency_name
sub?.logo_url                 // square logo
sub?.logo_horizontal_url      // landscape logo; preferred in sidebar expanded + review page headers

// Limits
sub?.client_count             // current active client count (excludes is_internal clients)
sub?.max_clients              // plan limit

// Storage (pre-calculated display strings)
sub?.storage_display          // { usage_value, usage_unit, max_value, max_unit, percent, remaining_label }

// Feature flags (all boolean, read directly)
sub?.branding_agency_sidebar    // Agency logo+name in sidebar (Velocity+)
sub?.branding_powered_by        // "Tercero YYYY" footer + "Powered by Tercero" on public pages (Ignite + Velocity)
sub?.finance_recurring_invoices // Recurring invoice templates tab (Velocity+)
sub?.finance_subscriptions      // Expense subscriptions route (Velocity+)
sub?.finance_accrual            // Cash vs Accrual accounting toggle (all tiers — flag exists, true on all plans)
sub?.calendar_export            // Calendar PDF export button (Velocity+)
sub?.documents_collections      // Document collections grouping (Velocity+)
sub?.campaigns                  // Campaigns feature (Velocity+)
sub?.proposals_limit            // integer | null — 5 for Trial/Ignite; null = unlimited (Velocity/Quantum)

// Derived convenience flags (computed in the hook, not DB columns)
sub?.basic_whitelabel_enabled   // branding_agency_sidebar && branding_powered_by  → Velocity
sub?.full_whitelabel_enabled    // branding_agency_sidebar && !branding_powered_by → Quantum
```

**Defaults are defensive**: if a flag is missing from the DB row, it falls back to the most restricted state — **except** `branding_powered_by` which defaults to `true` to protect Tercero brand attribution.

**Important**: Always use this hook — never query `agency_subscriptions` directly in components. The hook uses `workspaceUserId` from `AuthContext` internally, so team members correctly read the workspace owner's subscription row.

---

## Gating Patterns

Two distinct patterns depending on the feature:

### Pattern 1 — Visible but locked (disabled + lock icon)

Use for individual UI elements where showing the locked state communicates value.

```jsx
import { Lock } from 'lucide-react'
const { data: sub } = useSubscription()

{sub?.calendar_export ? (
  <Button onClick={handleExport}>Export Report</Button>
) : (
  <Button disabled title="Upgrade to Velocity to export calendar reports">
    Export Report
    <Lock className="ml-2 h-3 w-3 opacity-50" />
  </Button>
)}
```

Use for: `calendar_export`, `documents_collections` UI elements.

### Pattern 2 — Hidden entirely

Use for nav items and routes that would be confusing to show disabled.

```jsx
// Nav item — hidden on Ignite
{sub?.finance_subscriptions && (
  <NavItem to="/finance/subscriptions">Subscriptions</NavItem>
)}

// Route — redirect if accessed directly on Ignite
{!sub?.finance_subscriptions && (
  <Route path="/finance/subscriptions" element={<Navigate to="/finance/invoices" replace />} />
)}
```

Use for: `finance_subscriptions` nav item, `finance_recurring_invoices` tab.

### Pattern 3 — Upgrade prompt component

For whole features that warrant their own upgrade CTA.

```jsx
{!sub?.campaigns ? (
  <CampaignUpgradePrompt />
) : (
  <CampaignsList />
)}
```

Use for: `campaigns` on Trial/Ignite.

---

## Whitelabeling Architecture

Two flags work together to control all branding surfaces:

| Plan     | `branding_agency_sidebar` | `branding_powered_by` | Result |
|----------|:-------------------------:|:---------------------:|--------|
| Ignite   | FALSE | TRUE  | Tercero logo everywhere, "Powered by Tercero" on public pages |
| Velocity | TRUE  | TRUE  | Agency logo everywhere, "Powered by Tercero" on public pages |
| Quantum  | TRUE  | FALSE | Agency logo everywhere, no Tercero attribution (full whitelabel) |

**Derived flags** (computed in `useSubscription`, not DB columns):
- `basic_whitelabel_enabled` = Velocity (agency logo + Tercero attribution)
- `full_whitelabel_enabled` = Quantum (agency logo, no Tercero attribution)

**Logo priority on public pages**: prefer `logo_horizontal_url`, fall back to `logo_url`, fall back to agency name text. Never render a broken `<img>` — always have a text fallback.

**Where whitelabeling applies:**
1. **Sidebar header** (`nav-header.jsx`) — agency logo+name vs Tercero logo; prefers `logo_horizontal_url` when expanded
2. **Sidebar footer** (`app-sidebar.jsx`) — "Tercero YYYY" text; controlled by `branding_powered_by`
3. **Per-post review page** (`/review/:token`) — header logo + "Powered by Tercero" footer; data fetched via secondary query using `user_id` from `get_post_by_token` RPC
4. **Campaign review page** (`/campaign-review/:token`) — identical branding logic; flags returned directly in `get_campaign_by_review_token` RPC response
5. **Horizontal logo management** — `HorizontalLogoCropDialog` in `AgencySettings.jsx`

---

## Teams — No Subscription Scope (Phase 1)

Teams is ungated — all plans allow unlimited team members. No feature flag controls it.

**How team access works:**
- `agency_members` table stores all workspace participants (owner row with `system_role = 'admin'` + member rows with `system_role = 'member'`)
- `agency_invites` table stores pending invite tokens (7-day expiry)
- `get_my_agency_user_id()` SECURITY DEFINER helper in RLS policies resolves the correct workspace for both owners and members
- `AuthContext` exposes `workspaceUserId` (owner's UID for everyone in the workspace) and `userRole`
- All API hooks use `workspaceUserId` — team members see the same workspace data as the owner transparently

**When building any new feature**, always use `workspaceUserId` (not `user.id`) for queries scoped to the agency workspace. The RLS helper handles the rest.

---

## Implementation Notes — Built Features

### Sidebar Footer "Tercero 2026" Text

Rendered just above `<SidebarFooter>` in `src/components/sidebar/app-sidebar.jsx`. Year is dynamic (`new Date().getFullYear()`). The user account footer is always visible on all tiers regardless of this flag.

### "Powered by Tercero" on Public Review Pages

Both `PublicReview.jsx` and `CampaignReview.jsx` receive branding flags from the RPC response. The RPC joins back to `agency_subscriptions` through the token chain, keeping the page fully unauthenticated. Header logo prefers `logo_horizontal_url`, falls back to `logo_url`, falls back to Tercero logo. Footer conditionally rendered on `branding_powered_by`.

### Calendar Report PDF Export

`CalendarReportPDF.jsx` (PDF document) + `useCalendarReport.js` (data prep) in `src/pages/calendar/`. Button in `ContentCalendar.jsx` — locked on Ignite, active on Velocity+. Uses `@react-pdf/renderer` consistent with invoice PDF implementation.

### Recurring Invoice Templates

`InvoicesTab.jsx` — Recurring tab is hidden entirely on Ignite. One-off invoicing fully accessible on all tiers.

### Expense Subscriptions

`/finance/subscriptions` nav item hidden on Ignite. Direct navigation to the route redirects to `/finance/invoices` on Ignite.

### Campaigns

`/campaigns` and per-client Campaigns tab both render `CampaignUpgradePrompt` on Trial/Ignite. Fully functional on Velocity+. The Campaigns nav item in the sidebar is always shown — gating is handled inside the page/component.

### Proposals

`/proposals`, `/proposals/:proposalId`, and per-client Proposals tab are all visible on all tiers. Gating triggers only at creation time — `useCreateProposal` counts non-archived proposals workspace-wide before inserting; if `proposals_limit` is not null and `count >= limit`, throws a typed `ProposalLimitError`. UI-side: `ProposalsPage` and `ProposalTab` compute `atLimit` from live `useProposals()` data and open `ProposalsUpgradePrompt` instead of the create form. `ProposalTab` uses a second `useProposals()` call (without `clientId`) for the workspace-wide count so the counter is accurate even when scoped to a single client. Both the "Build in Tercero" and "Upload Existing File" options in the "New Proposal" dropdown check `atLimit` before opening their respective dialogs.

**Two proposal types** are supported:
- **Built** (`proposal_type = 'built'`): Created in-app with inline editing, live preview (`ProposalPreview`), and PDF export (`downloadProposalPDF`). Detail page is a two-panel layout (form left, preview right). Auto-saves on blur.
- **Uploaded** (`proposal_type = 'uploaded'`): PDF file attached via `UploadProposalDialog`. Detail page shows a metadata grid (title, client, valid_until, deal value) + embedded `<iframe>` PDF viewer with Download + Replace File buttons. Export PDF button hidden. Auto-saves metadata on blur.

Public review page (`/proposal/:token`) is fully unauthenticated. For built proposals it renders `ProposalPreview`; for uploaded proposals it renders an embedded `<iframe>` PDF viewer. Branding logic (header logo chain + "Powered by Tercero" footer) mirrors the per-post and campaign review pages. PDF export via `@react-pdf/renderer` + `downloadProposalPDF.jsx` only for built proposals.

**Uploaded proposal file storage**: `proposal-files` bucket (public), path `${workspaceUserId}/${proposalId}/${timestamp}.pdf`. `uploadProposalFile()` helper uploads and calls `increment_storage_used` RPC. Hard delete of draft proposals calls `deleteProposalFile()` to clean up storage. Replace File flow uploads a new file without removing the old one.

### Documents Collections

"New Collection" buttons, collection cards, and "Move to Collection" menu items all locked on Ignite with lock icon + upgrade tooltip. Basic document operations (upload, view, download, delete) open on all tiers.

---

## Trial Account Behaviour

Trial accounts (`plan_name = 'trial'`) receive full Ignite-level access with a `trial_ends_at` timestamp.

- Day 10: Dashboard banner — "4 days left on your trial."
- Day 13: Email — "Your trial ends tomorrow."
- Day 14: In-app banner — "Your trial has ended."
- Day 14 + 48h: Read-only mode.
- Day 44: Soft delete.

Expired trials redirect to `/billing` with banner: "Your trial has ended. Your data is safe — choose a plan to continue."

---

## Change Log

| Version | Date       | Summary |
| ------- | ---------- | ------- |
| v1      | March 2026 | Original |
| v2      | March 2026 | Updated pricing, restructured finance gating |
| v3      | March 2026 | Stripped campaigns, proposals, documents from scope |
| v4      | March 2026 | Basic invoicing open to all tiers. Recurring templates → Velocity+. |
| v5      | March 2026 | Final confirmed decisions. Sidebar footer, review page branding, calendar PDF export built. DB table confirmed. |
| v5.1    | March 2026 | Documents Phase 6 — `documents_collections` flag (Velocity+). Collections locked on Ignite. |
| v5.2    | March 2026 | Campaigns Phase 1 complete — `campaigns` flag (Velocity+). Campaign review page with whitelabeling. |
| v5.3    | March 2026 | Teams Phase 1 complete — ungated (all plans). `logo_horizontal_url` column added. `useSubscription` flat object pattern documented. Gating patterns and whitelabeling architecture added. Seed SQL updated with `campaigns` flag. |
| v5.4    | March 2026 | Proposals Phase 1 complete — `proposals_limit` column (integer, default 5, null = unlimited). Hybrid gating pattern: always visible, limit enforced at creation. Counter shown on Trial/Ignite, hidden on Velocity+. Seed SQL updated. |
| v5.5    | March 2026 | Proposals Phase 2 — Upload Existing File workflow (`UploadProposalDialog`, `proposal_type: built/uploaded`, `file_url`, `proposal-files` bucket, Deal Value field, Replace File, embedded PDF iframe in detail + public review). `finance_accrual` flag added to DB reference (available all tiers). Status timeline component on detail page. Auto-save on blur for both proposal types. |
