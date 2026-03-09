# Tercero — Full Application Research Document

> **Purpose**: Comprehensive product/feature reference for building a landing page for Tercero.
> **Status**: Updated March 9, 2026 — reflects live codebase including campaigns (Phases 1–3), documents, subscription tier gating, calendar PDF export, and branding system.

---

## 1. WHAT IS TERCERO?

Tercero is a **social media agency management SaaS** — an all-in-one operations platform built for social media agencies to manage clients, content, finances, and operations from a single dashboard.

**The core problem it solves**: Agencies juggle multiple clients, dozens of in-progress posts, invoices, meetings, and tasks across fragmented tools (spreadsheets, Notion, scheduling apps, accounting software). Tercero replaces all of them with a unified, structured workspace.

**Target user**: Social media agency owners and managers running 3–30+ clients.

**Primary value propositions**:
1. See every client's content pipeline at a glance
2. Streamline content creation, review, and approval in one place
3. Track all agency finances (invoices, expenses, revenue)
4. Manage meetings and internal tasks without switching tools
5. Give clients a branded, shareable link to review and approve content

---

## 2. PRODUCT OVERVIEW

### Core Modules
| Module | Route | Purpose |
|--------|-------|---------|
| Dashboard | `/dashboard` | Executive overview — health, pipeline, revenue |
| Clients | `/clients` | Client management hub |
| Posts | `/posts` | Global content management |
| Calendar | `/calendar` | Visual content schedule |
| Campaigns | `/campaigns` | Group posts into initiatives with analytics (Velocity+) |
| Finance | `/finance` | Invoices, expenses, ledger, subscriptions |
| Documents | `/documents` | Per-client file storage with collections (Velocity+) |
| Meetings | `/operations/meetings` | Meeting scheduling and history |
| Notes | `/operations/notes` | Tasks and reminders |
| Settings | `/settings` | Profile and agency branding |
| Billing | `/billing` | Agency's own subscription plan |
| Public Review | `/review/:token` | Per-post client content approval (no login required) |
| Campaign Review | `/campaign-review/:token` | Bulk campaign approval for clients (no login required) |

### Tech Stack (for developer-facing messaging)
- React 19 + Vite SPA
- Supabase (PostgreSQL, Auth, Storage, Edge Functions)
- Hosted with Vercel (SPA routing configured)
- Row-Level Security enforced at DB level

---

## 3. FEATURE DEEP-DIVE

---

### 3.1 DASHBOARD

**What it is**: The first page users see after login. An at-a-glance summary of the entire agency's health.

**Sections and what they show**:

| Widget | Content |
|--------|---------|
| **Welcome Message** | Personalized greeting with agency logo |
| **Agency Health Bar** | KPI cards: total clients, posts due this week, upcoming meetings, monthly revenue |
| **Content Pipeline Bar** | Count of posts by status (Drafts, Pending Approval, Needs Revision, Scheduled) |
| **Week Timeline** | Posts scheduled for each day this week |
| **Client Health Grid** | Per-client urgency: Overdue, Urgent (<24h), Warning (<48h), Healthy |
| **Financial Snapshot** | Income vs expenses summary |
| **Lifetime Revenue** | Cumulative revenue chart |
| **Social Media Usage** | Platform distribution across all posts |
| **Recent Invoices** | Quick table of latest invoices with status |
| **Meetings & Notes** | Next upcoming meeting + recent open tasks |

**Key UX insight**: The dashboard is read-only. Every widget is a summary that links to the full feature. No actions happen here — it's a navigation hub.

---

### 3.2 CLIENT MANAGEMENT

**What it is**: The central database of all clients. Every piece of content, every invoice, every meeting is tied to a client.

#### Client List (`/clients`)
- Searchable, filterable grid of client cards
- **Filters**: Search by name, Industry dropdown, Tier dropdown, Urgency filter (All / Urgent / Upcoming / Idle)
- **Client Card** shows:
  - Logo/avatar with fallback initials
  - Status badge (Active / Inactive)
  - Tier badge (Bronze / Silver / Gold / Platinum / Custom)
  - Industry tag
  - Post pipeline mini-bar (Drafts · Pending · Revisions · Scheduled)
  - Urgency indicator dot (color-coded by next post deadline)
  - Next scheduled post date
- Clicking a card → Client Detail page

#### Create / Edit Client (`/clients/create`, `/clients/:id/edit`)
Full form with:
- Name, email, mobile
- Logo upload (stored in Supabase `post-media` bucket under `branding/`)
- Status (Active / Inactive)
- Industry (16 options: SaaS, Fintech, Agency, E-Commerce, Fashion, Beauty, Real Estate, Health, Food, Travel, Education, Creator, Other, Internal)
- Tier selection
- Platform checkboxes (Instagram, LinkedIn, Facebook, Twitter/X, YouTube)
- Social media links per platform
- Description/notes field

#### Client Detail (`/clients/:clientId`)
Three-tab layout:
1. **Overview** — Profile card, contact info, social links, profitability metrics, upcoming meeting widget, recent posts summary, per-client invoice list, per-client transaction history, platform usage chart, month-over-month revenue bar chart, quick-add buttons (new post, new invoice, new meeting, new note, add transaction)
2. **Management** — Edit all client details inline
3. **Workflow** — The client's full post list + notes + meeting history

**Special concept: Internal Account**
- Every agency has one "Internal Account" client marked `is_internal = true`
- This represents the agency itself (e.g., posting on the agency's own Instagram)
- Created during onboarding; cannot be deleted
- Used for agency-level posts and content

---

### 3.3 CONTENT MANAGEMENT

This is the core of Tercero. The entire content workflow lives here.

#### Post Statuses and Their Meaning
```
DRAFT        → Being written by the agency; not submitted yet
PENDING      → Submitted for review (client or internal approval)
REVISIONS    → Client requested changes; new version created
SCHEDULED    → Approved and ready to publish on target date
ARCHIVED     → No longer active; preserved for history
```

#### Post Versioning System
- Every post has a **parent record** (`posts` table) and **one or more versions** (`post_versions` table)
- `posts.current_version_id` always points to the latest active version
- When revisions are requested, a **new version** is created (old version preserved as history)
- This means you can see the full edit history of any post, including what was changed and when
- Media (images/videos) are stored in Supabase storage and deferred-deleted (only removed when no version references them)

#### Global Posts Page (`/posts`)
- All posts across all clients in one view
- **View modes**: Card grid or data table
- **Filter options**:
  - Search (title or content)
  - Status tabs: All / Drafts / Pending Approval / Scheduled / Needs Revision / Published / Archived
  - Scope: All Posts / My Agency Only / Client Work Only
  - Client selector
  - Platform filter
  - Date range picker
- Each post shows: client name/logo, title, platform badges, status badge, target date

#### Post Details (`/clients/:clientId/posts/:postId`)
The richest view in the app. A full-screen editing and review interface:

**Left Panel — Content Editor**:
- Title field
- Rich content textarea
- Platform selector (multi-select checkboxes)
- Target date picker
- Media upload (drag/drop or file picker)
- Media gallery with delete-per-image capability
- Admin notes field (internal, not visible to client)

**Center — Social Media Preview**:
Platform-specific visual previews:
- **Instagram** — Square post preview with username, caption, engagement bar
- **LinkedIn** — Feed post with profile header and engagement
- **Twitter/X** — Tweet card with character count awareness
- **YouTube** — Thumbnail + title + channel header
- Tabs to switch between platforms

**Right Panel — Version History**:
- Scrollable list of all versions
- Version number, creation date, status badge
- Currently active version highlighted
- Click to view any historical version

**Action Buttons** (vary by current status):
- `DRAFT` → "Submit for Approval" (→ PENDING)
- `PENDING` → "Request Revisions" (→ REVISIONS, creates new version) or "Approve & Schedule" (→ SCHEDULED)
- `REVISIONS` → "Submit Updated Draft" (→ PENDING)
- Any → "Archive"

#### Content Calendar (`/calendar`)
Two views:
- **Month View**: Full calendar grid; posts shown as colored pills on their target date; clicking a date opens a day-detail sheet
- **Week View**: Horizontal timeline with posts per day in columns

Filters bar at top: status dropdown, client selector, platform filter, search.

**Color coding** in calendar: Each status has a distinct color so you can see the pipeline balance at a glance.

**Create from calendar**: Click any empty date to open the post creation dialog pre-filled with that date.

**Calendar PDF Export** (Velocity+ feature):
- "Export Report" button in the filters bar generates a PDF summary of the content schedule
- Available on Velocity and Quantum; visible but disabled (with lock icon) on Ignite
- Report contains: agency name/logo, period label, per-day post list (title, client, platform badges, status), and summary counts (total posts, by status, by platform)
- Works for both month view and week view
- Generated client-side with `@react-pdf/renderer`; downloads automatically
- Implementation: `CalendarReportPDF.jsx` (PDF document component) + `useCalendarReport.js` (data preparation — `buildCalendarReport()`, `getPeriodLabel()`, `getPeriodFilename()`)

---

### 3.4 FINANCE

Three conceptually separate but integrated financial tools.

#### Financial Overview (`/finance/overview`)
Summary dashboard for the agency's financial health:
- **Accounting method toggle**: Switch between Cash and Accrual basis
- **Chart range selector**: 3M, 6M, or 12M revenue vs. expenses bar chart
- **KPI cards**: Total revenue, total expenses, outstanding invoices (SENT + OVERDUE), net profit
- **Outstanding Invoice Total**: Sum of all SENT and OVERDUE invoices surfaced as a KPI
- Trend cards with directional indicators comparing to prior period

#### Invoices (`/finance/invoices`)
Full invoice lifecycle with two sub-tabs: **One-off** and **Recurring**.

**One-off Invoices**:
- Create invoices with unlimited line items (description, quantity, unit price)
- Auto-generated invoice numbers (format: `INV-YYYY-###`)
- Status workflow: `Draft → Sent → Overdue → Paid` (`OVERDUE` is an explicit auto-detectable status)
- **Edit/View dialog** (two-column layout with live HTML preview on the left, form on the right):
  - PAID invoices are read-only (lock icon shown)
  - SENT/OVERDUE invoices: client and line items locked; due date, payment terms, category, and notes remain editable
  - DRAFT invoices: fully editable
- **PDF Export**: Professionally formatted invoice PDF (generated client-side with `@react-pdf/renderer`)
- When an invoice is marked **Paid** → automatically creates an INCOME transaction in the ledger
- Quick stats bar: Outstanding amount, Collected amount, Overdue count, Draft count
- Filters: by client, by status, by search term

**Invoice Fields**:
- Client
- Invoice number (auto-suggested, editable)
- Issue date, due date
- Category (from shared `INVOICE_CATEGORIES` constant)
- Payment terms (Due on Receipt, Net 15, Net 30, Net 60)
- Line items (unlimited)
- Notes

**Recurring Invoice Templates** (`recurring` sub-tab — Velocity+ only):
- The "Recurring" tab is hidden on Ignite; visible and functional on Velocity and Quantum
- Define a reusable template for repeat billing (e.g., monthly retainers)
- Fields: client, line item description, amount, billing cycle (Monthly / Quarterly / Yearly), next invoice date, category, payment terms, notes, active toggle
- **Generate button**: One-click creates a new DRAFT one-off invoice from the template, advances the next invoice date, and opens the edit dialog
- Tracks `last_generated_at` for each template
- Active/Inactive toggle to pause templates without deleting them

#### Subscriptions / Recurring Expenses (`/finance/subscriptions` — Velocity+ only)
- The Subscriptions nav item is hidden on Ignite; navigating to `/finance/subscriptions` on Ignite redirects to `/finance/invoices`
- Fully accessible on Velocity and Quantum

Track all recurring costs (agency-side expenses, not client invoices):
- Name, cost, billing cycle (monthly/annual/weekly), category
- Next billing date
- Optional client assignment (e.g., "Canva license" assigned to a specific client)
- **Renew action**: Advances the next billing date by one cycle
- Active/Inactive toggle

#### Ledger (`/finance/ledger`)
Complete transaction history:
- Both income and expense entries
- Types: `INCOME` (manual or auto-from-invoice) and `EXPENSE` (manual)
- Filter by date range and client
- Used for full audit trail of cash flow

---

### 3.5 MEETINGS

Scheduling and history for client meetings.

**Meeting record contains**:
- Title
- Datetime (date + time)
- Client (linked)
- Notes (free-form text)
- Meeting link (Zoom/Meet/Teams URL — optional)

**Meeting List view**:
- Card layout with date block (large day number + month abbreviation)
- Upcoming vs Past tabs
- Search by title or notes
- Filter by client
- "Open meeting link" button opens external URL in new tab
- Edit and Delete actions per meeting

**Meeting Reminders**:
- `useMeetingReminders()` hook runs in the background
- Checks for meetings today and surfaces a reminder badge/notification
- No external push notifications — in-app only

---

### 3.6 NOTES & REMINDERS

Lightweight task manager for the agency team.

**Note record contains**:
- Title
- Description
- Status (`TODO`, `DONE`, `ARCHIVED`)
- Due date (optional)
- Client assignment (optional — can be "Internal" for agency-level tasks)

**Notes List view**:
- Status tabs: All / To Do / Done / Archived
- Search by title or description
- Filter by client
- Cards show title, truncated description, due date, client badge, status badge
- Click status badge to cycle: TODO → DONE → ARCHIVED inline
- Edit and Delete per note

---

### 3.7 PUBLIC REVIEW LINK

One of Tercero's most client-friendly features.

**What it is**: A shareable URL (`/review/:token`) that lets clients review and approve content **without needing to log in** to Tercero.

**How it works**:
1. Agency creates a post and marks it as PENDING
2. A unique token is associated with the post (or version)
3. Agency shares the link with the client (copy URL)
4. Client opens link in browser — sees a clean, read-only review page
5. Client can write feedback in a textarea and click "Request Revisions"
6. Agency receives the feedback (stored as a revision note)
7. Agency creates a new version, status returns to DRAFT/REVISIONS

**Review page shows**:
- Post title
- Full content text
- Media gallery (images/videos) with full-screen carousel with keyboard navigation (arrow keys + Escape)
- Platform-specific social media preview (Instagram, LinkedIn, etc.)
- Target date and version number
- Feedback textarea
- "Request Revisions" submit button

**Branding on the review page** (tier-controlled):
- **Ignite**: Tercero app logo in header, "Powered by Tercero" footer
- **Velocity**: Agency logo in header, "Powered by Tercero" footer
- **Quantum**: Agency logo in header, no Tercero attribution footer (full whitelabel)
- Branding data is fetched from `agency_subscriptions` via a secondary query using the `user_id` returned by the `get_post_by_token` RPC — the page remains fully unauthenticated
- If agency logo is missing on Velocity/Quantum, falls back to Tercero app logo gracefully

**Why this matters for the landing page**: This is a strong differentiator — clients don't need accounts. Zero friction for client review and approval.

---

### 3.8 SETTINGS

**Profile Settings** (`/settings` → Profile tab):
- First name, last name
- Email (read-only, managed by Supabase Auth)
- Change password (confirmation dialog with old + new password)
- Profile picture upload

**Agency Settings** (`/settings` → Agency tab):
- Agency name
- Logo upload
- Industry, platforms
- Social media links
- Email, phone
- Description
- Two setup modes:
  - **Full Setup**: Updates branding AND the internal "Internal Account" client record
  - **Branding Only**: Updates just the agency identity without touching client data
- Changes reflected immediately in sidebar header (logo + agency name)

---

### 3.9 BILLING & USAGE

The agency's own subscription to Tercero (separate from client finance).

**Usage Tab**:
- Storage usage bar (current MB/GB vs. plan limit — auto-selects MB or GB unit based on size)
- Client count vs. max clients on current plan
- Visual progress bars with percentage
- Remaining storage shown as a pre-calculated label (e.g., "500 MB remaining")

**Plan Tab** (`SubscriptionTab`):
- Current plan overview card (plan name, key limits, "Upgrade Plan" button that scrolls to the pricing grid)
- Three plan cards: **Ignite** (₹2,999/mo), **Velocity** (₹8,999/mo, marked "Recommended"), **Quantum** (₹17,999/mo)
- Full feature comparison table
- **Note**: Automated payment processing is not yet live. Upgrades are handled manually — users click "Contact Team" on a plan card, which opens an upgrade request dialog. The dialog sends a prefilled message to the Tercero team (currently logged to console; to be replaced by a dedicated API).
- Downgrade is handled the same way via the Contact Team flow.

**Invoices Tab**:
- History of charges from Tercero to the agency
- Download invoices

---

### 3.10 DOCUMENTS

**What it is**: Centralised file storage per client. Agencies upload contracts, briefs, brand kits, reports, and any other files associated with each client.

**Document record contains**:
- File name, size, and MIME type
- Category (e.g., Contract, Brief, Report, Asset, Other)
- Optional collection assignment (Velocity+ feature)
- `client_id` scope
- Signed URL (private bucket — URLs expire; regenerated on access)

**Two entry points**:
1. **Global Documents page** (`/documents`) — shows all files across all clients with a client filter dropdown
2. **Client Detail Documents tab** — same `DocumentsTab` component, filtered to that client via `clientId` prop

**Collections** (Velocity+ — `documents_collections` flag):
- Group related documents into named collections (e.g., "Q1 Brand Assets", "Onboarding Pack")
- Hidden for Ignite/Trial; shown as locked with upgrade prompt

**Storage**:
- Files stored in private Supabase `client-documents` bucket (signed URLs, not public)
- Quota tracked on `agency_subscriptions.current_storage_used`
- Upload/delete uses `increment_storage_used` / `decrement_storage_used` RPCs to keep quota accurate
- Max file size: 50 MB (`MAX_DOCUMENT_SIZE_BYTES` constant in `src/lib/helper.js`)

---

### 3.11 CAMPAIGNS

**What it is**: Group related posts into a named campaign initiative with analytics, budget tracking, and a single-link client approval flow. Velocity+ feature.

#### Campaign List (`/campaigns`)
- Global grid of all campaigns across all clients (Velocity+ gated — shows `CampaignUpgradePrompt` for Trial/Ignite)
- Same `CampaignTab` component is reused inside Client Detail (Campaigns tab), scoped to that client
- **Filters**: Search by name or goal, Status dropdown (All / Draft / Active / Completed)
- **Campaign card** shows: name, status badge, client name, date range, goal, post progress counts
- Cards navigate to the campaign detail page

#### Create / Edit Campaign
- Fields: Name (required), Client (required — selector shown on global page, pre-filled on client-scoped page), Goal, Description, Status (Active / Completed / Archived), Start date, End date, Budget (numeric)
- Zod-validated; `client_id` included in schema to prevent zodResolver stripping

#### Campaign Detail (`/campaigns/:campaignId`)
Four-section layout:

**KPI bar** (4 cards):
- Total Posts, Published, On-Time Rate (% published on or before target date), Avg Approval (days from creation to approval)

**Posts panel** (left, 2/3 width):
- All posts linked to this campaign; click any row → `/clients/:clientId/posts/:postId`
- When campaign is Active: "New Post" button (opens `DraftPostForm` pre-filled with campaign), "Link Posts" button (bulk-link existing unlinked posts via `LinkPostsToCampaignDialog`)
- Each row: thumbnail, title, target date, status badge, platform icons

**Right column**:
- Overall progress bar (published / total)
- Platform distribution horizontal bar chart (platform icons as Y-axis ticks)
- Budget tracker: Total Budget → Invoiced → Collected → Remaining (red if over-budget)
- Linked invoices list (click to navigate to `/finance?invoice=:id`)

**Header actions**: Edit, Export PDF (`CampaignReportPDF` — agency name/logo included), Share Review Link

#### Share Review Link
Button only visible when `campaign.review_token` exists AND at least one post has `PENDING_APPROVAL` status.

Dialog contains:
- Read-only URL + Copy button
- "Regenerate link" button (invalidates old token, updates URL in real time)
- "Last sent [date]" if previously emailed
- If client has email: client name + email + "Send Email" button (invokes `send-campaign-review-email` edge function)
- If no email: "Add email →" button navigates to client profile

#### Public Campaign Review (`/campaign-review/:token`)
Fully unauthenticated. The single link lets the client review and action all `PENDING_APPROVAL` posts in one session.

**6 page states**: Loading → Fetch error → Invalid/expired token → No posts to review → Review active → All reviewed (completion screen)

**Two-panel layout**:
- **Left panel (280px)**: Post list with thumbnail, title, target date, and status dot (pending / approved / revised)
- **Right panel**: Selected post — title, platforms, target date, content, media gallery (up to 4 items + overflow), feedback textarea, action buttons

**Actions per post**:
- "Approve This Post" → status → `SCHEDULED`; auto-advances to next unreviewed post
- "Request Revisions" → status → `NEEDS_REVISION`; requires non-empty feedback; auto-advances

**Branding**: Same tier-controlled logic as per-post public review (agency logo if `branding_agency_sidebar`; "Powered by Tercero" footer if `branding_powered_by`).

**Token architecture**: `campaigns.review_token` is a UUID on the campaign. Per-post review tokens come from the `share_tokens` table, resolved via a LATERAL JOIN in the `get_campaign_by_review_token` RPC — there is no `review_token` column on `post_versions`.

---

## 4. USER EXPERIENCE PATTERNS

### Navigation
- **Sidebar** (always visible on desktop, collapsible on mobile):
  - **Header** (tier-controlled branding):
    - **Ignite**: Tercero app logo always shown (landscape logo when expanded, icon when collapsed)
    - **Velocity**: Agency logo + name + verified badge; falls back to initials if no logo set
    - **Quantum**: Same as Velocity
    - Controlled by `branding_agency_sidebar` flag from `useSubscription()`
  - Nav groups: Dashboard, Clients, Content (Posts, Calendar), Operations (Meetings, Notes), Finance
  - **Footer text**: "Tercero [year]" shown above the user account footer on Ignite and Velocity; hidden on Quantum (`branding_powered_by` flag)
  - User account + settings at bottom
- **Header** (top bar):
  - Breadcrumbs (context-aware, set by each page via `useHeader()`)
  - Dark/Light mode toggle
  - Sidebar toggle (mobile)
  - User avatar dropdown

### Loading States
- Skeleton screens (not spinners) for content areas
- Button loading state during mutations (spinner in button)
- Never partially render data — always show skeleton until full data is ready

### Error States
- Inline error messages under form fields (Zod validation)
- Toast notifications for async errors (`sonner`)
- Error fallback text when queries fail

### Confirmations
- Destructive actions (delete client, delete post, delete invoice) show `AlertDialog` confirmation
- Non-destructive mutations happen immediately with toast success feedback

### Dark Mode
- Full dark/light mode support via `next-themes`
- Toggle in header
- Respects system preference on first load
- All components use CSS variable tokens (never hard-coded colors)

---

## 5. DATA ARCHITECTURE SUMMARY

### Client Data Model
```
Agency (user_id)
├── Internal Account (is_internal = true) — agency's own workspace
└── Real Clients (is_internal = false)
    ├── Posts
    │   └── Post Versions (DRAFT → PENDING → REVISIONS → SCHEDULED → ARCHIVED)
    │       └── share_tokens (per-version public review tokens)
    ├── Campaigns (Velocity+)
    │   ├── Posts (campaign_id FK on posts — nullable)
    │   └── Invoices (campaign_id FK on invoices — nullable)
    ├── Documents
    │   └── Collections (optional grouping — Velocity+)
    ├── Meetings
    ├── Notes / Tasks
    ├── Invoices (One-off)
    │   └── Invoice Items
    ├── Recurring Invoice Templates
    └── Transactions (auto-created on invoice paid)
```

### Key Database RPCs (complex operations)
| RPC | Auth | What it does |
|-----|------|-------------|
| `get_clients_with_pipeline` | Authenticated | Returns clients + post counts per status + next_scheduled date |
| `create_post_draft_v3` | Authenticated | Atomically creates posts row + post_versions row + links them |
| `create_revision_version` | Authenticated | Creates new version, updates current_version_id |
| `get_global_calendar` | Authenticated | Returns posts in date range with version data |
| `advance_expense_billing_date` | Authenticated | Moves next_billing_date forward by one billing cycle |
| `get_post_by_token` | Public (SECURITY DEFINER) | Returns post + `user_id` for per-post public review page |
| `update_post_status_by_token` | Public (SECURITY DEFINER) | Updates post status + stores feedback (per-post and campaign review) |
| `get_campaigns_with_post_summary` | Authenticated | Lists campaigns with post counts per status |
| `get_campaign_analytics` | Authenticated | Per-campaign KPIs: post counts, on-time rate, platform distribution, avg approval days, budget vs invoiced |
| `get_campaign_by_review_token` | Public (SECURITY DEFINER) | Returns campaign + all PENDING_APPROVAL posts with per-post tokens via LATERAL JOIN on share_tokens |
| `increment_storage_used` / `decrement_storage_used` | Authenticated | Keeps `agency_subscriptions.current_storage_used` accurate on document upload/delete |

### Database Views (read-only aggregations)
| View | Purpose |
|------|---------|
| `view_client_profitability` | Per-client financial metrics |
| `view_finance_overview` | Total income, total expenses, burn rate |
| `view_monthly_burn_rate` | Sum of active recurring expenses |

---

## 6. SUBSCRIPTION & PLAN SYSTEM

Each agency has an `agency_subscriptions` row (single row per user) that controls plan limits, feature flags, and branding.

### Plans
| Plan | Price | Clients | Storage |
|------|-------|---------|---------|
| **Trial** | Free (14 days) | 5 | 20 GB |
| **Ignite** | ₹2,999/mo | 5 | 20 GB |
| **Velocity** | ₹8,999/mo | 15 | 100 GB |
| **Quantum** | ₹17,999/mo | 35 | 500 GB |

### Feature Flags (boolean columns on `agency_subscriptions`)
| Flag | Ignite | Velocity | Quantum | Controls |
|------|--------|----------|---------|---------|
| `branding_agency_sidebar` | false | true | true | Show agency logo+name in sidebar |
| `branding_powered_by` | true | true | false | Show "Tercero YYYY" + "Powered by Tercero" attribution |
| `finance_recurring_invoices` | false | true | true | Recurring invoice templates tab |
| `finance_subscriptions` | false | true | true | Expense subscriptions route |
| `finance_accrual` | false | true | true | Accrual accounting mode toggle in Finance overview |
| `calendar_export` | false | true | true | Calendar PDF export button |
| `documents_collections` | false | true | true | Document collections grouping |
| `campaigns` | false | true | true | Campaigns feature (list, detail, review link) |

### `useSubscription()` Hook
Accessed via `src/api/useSubscription.js`. Returns a React Query result. Consume via `const { data: sub } = useSubscription()`.

The `data` object is a **flat object** — read flags directly (no `can.*` methods):
- `sub?.plan_name` — `'trial'` | `'ignite'` | `'velocity'` | `'quantum'`
- `sub?.agency_name`, `sub?.logo_url` — agency branding
- `sub?.client_count`, `sub?.max_clients` — for client limit checks
- `sub?.storage_display` — `{ usage_value, usage_unit, max_value, max_unit, percent, remaining_label }`
- All feature flags as direct booleans (e.g. `sub?.campaigns`, `sub?.calendar_export`)

Defaults are defensive (most-restricted) except `branding_powered_by` which defaults to `true` to protect Tercero brand attribution.

### Extra Client Add-on
- ₹500/mo per extra client on Ignite and Velocity
- ₹450/mo per extra client on Quantum

### Upgrade Flow
- No automated payment processing currently
- Users request upgrades via "Contact Team" dialog on the Billing page
- Tercero team manually processes the request and updates the account
- `trial_ends_at` controls trial expiry; expired trials redirect to `/billing`

---

## 7. ONBOARDING FLOW

When a new user signs up:
1. `/signup` → creates Supabase auth account
2. Redirects to `/onboarding` (the `Onboarding.jsx` page)
3. User sets up agency: name, logo, industry, platforms
4. Creates the agency's "Internal Account" client
5. Redirected to `/dashboard`

---

## 8. EDGE FUNCTIONS (Email Notifications)

Four Supabase Edge Functions handle transactional email (all use Resend, sent from `notifications@tercerospace.com`):

| Function | Trigger | Email sent |
|----------|---------|-----------|
| `send-approval-email` | Post marked as PENDING | Notifies approver/client |
| `send-client-welcome` | New client created | Welcome email to client |
| `send-password-update-email` | Password changed | Confirmation to user |
| `send-campaign-review-email` | Agency clicks "Send Email" in Share Review Link dialog | Campaign review link to client; `verify_jwt: false`; subject: "Action Required: Review posts for [campaign_name]" |

---

## 9. SUPPORTED SOCIAL PLATFORMS

| Platform | Preview Available | Icon |
|----------|------------------|------|
| Instagram | Yes (feed post style) | ✓ |
| LinkedIn | Yes (feed post style) | ✓ |
| Twitter / X | Yes (tweet card) | ✓ |
| YouTube | Yes (video thumbnail + title) | ✓ |
| Facebook | No dedicated preview | ✓ |
| Google Business | No dedicated preview | ✓ |

Platform icons are served from `/platformIcons/{name}.png`. The `google_business` icon maps to `google_busines.png` (filename inconsistency handled in code).

---

## 10. KEY DIFFERENTIATORS (For Landing Page Copywriting)

### 1. Everything in one place
Replaces: Notion/Asana (tasks), Google Sheets (finances), email (approvals), Calendly (meetings tracking)

### 2. Content versioning
Every post revision is preserved. Never lose track of what changed, when, and why. Full audit trail from first draft to published content.

### 3. Zero-friction client approvals
Clients approve content via a shareable link — no login required, no new account to set up.

### 4. Pipeline visibility at a glance
See every client's content health in one screen: how many drafts are stuck, what's pending approval, what's overdue.

### 5. Financial integration
Invoice clients, track expenses, and see profit per client — all connected to the same client records.

### 6. Built for agencies, not freelancers
Multi-client architecture from the ground up. Internal workspace for agency's own content separate from client work.

---

## 11. POTENTIAL LANDING PAGE SECTIONS

Based on the features above, here are logical landing page sections:

1. **Hero** — "The command center for social media agencies" + dashboard screenshot
2. **Problem section** — "You're juggling too many tools" (spreadsheets, email, scheduling apps, accounting)
3. **Feature: Pipeline Dashboard** — See every client's content health in one view
4. **Feature: Post Versioning & Approvals** — Draft → Review → Approve. Full history, zero email chains.
5. **Feature: Client Review Links** — Clients approve with a link. No login. No friction.
6. **Feature: Finance** — Invoice clients, track expenses, know your margin.
7. **Feature: Meetings & Tasks** — Schedule meetings, manage tasks, all tied to each client.
8. **Social proof / Testimonials** section
9. **Pricing** — Plan tiers with client/storage limits
10. **CTA** — Start free trial / Book a demo

---

## 12. TONE & BRAND NOTES

- Product name: **Tercero** (pronounced "ter-SAY-ro" — Spanish for "third", implying the third member of your team)
- Aesthetic: Clean, professional, modern dark UI with neutral palette
- Voice: Confident, direct, no fluff — built for operators who value efficiency
- Design style: shadcn/ui new-york (rounded corners, clean cards, clear hierarchy)
- Color system: CSS variables, dark mode first

---

## APPENDIX: FILE MAP

```
Key Files for Understanding the App:
src/App.jsx                         — Route definitions
src/AppShell.jsx                    — Layout wrapper
src/main.jsx                        — App entry + providers
src/context/AuthContext.jsx         — Auth state
src/api/clients.js                  — Client CRUD + RPC
src/api/posts.js                    — Post CRUD + versioning RPCs
src/api/meetings.js                 — Meeting CRUD
src/api/notes.js                    — Notes CRUD
src/api/invoices.js                 — Invoice lifecycle
src/api/transactions.js             — Ledger
src/api/expenses.js                 — Subscriptions
src/api/useSubscription.js          — Plan/branding hook (returns flat data object with boolean flags; no can.* methods)
src/api/useGlobalPosts.js           — Filtered post list (supports campaignId filter)
src/api/campaigns.js                — All campaign hooks and mutations (useCampaigns, useCampaign, useCampaignAnalytics, useCampaignReview, useCreateCampaign, useUpdateCampaign, useDeleteCampaign, useAssignPostsToCampaign, useRegenerateCampaignReviewToken, useMarkReviewSent, submitCampaignPostReview, fetchActiveCampaignsByClient, fetchUnlinkedPostsByClient)
src/api/documents.js                — Document CRUD + signed URL generation
src/pages/dashboard/Dashboard.jsx  — Dashboard composition
src/pages/clients/Clients.jsx       — Client list
src/pages/clients/ClientDetails.jsx — Client detail + tabs
src/pages/clients/ClientProfileView.jsx — Client profile with tabs (Overview, Management, Workflow, Campaigns, Documents)
src/pages/Posts.jsx                 — Global post list
src/pages/posts/DraftPostForm.jsx   — Post create/edit form; used as page and as dialog (open/onOpenChange props); accepts initialCampaignId
src/pages/posts/postDetails/PostDetails.jsx — Post editor with versioning, social preview, approval actions
src/pages/calendar/ContentCalendar.jsx  — Calendar views + Export Report button
src/pages/calendar/CalendarReportPDF.jsx — PDF document component (react-pdf/renderer)
src/pages/calendar/useCalendarReport.js  — buildCalendarReport(), getPeriodLabel(), getPeriodFilename()
src/pages/campaigns/CampaignsPage.jsx   — Global campaigns list (Velocity+ gated)
src/pages/campaigns/CampaignDetailPage.jsx — Campaign detail: KPIs, posts, platform chart, budget, invoices, share dialog
src/pages/campaigns/CampaignReview.jsx  — Public campaign review (unauthenticated two-panel UI)
src/pages/documents/DocumentsPage.jsx   — Global documents list with client filter
src/pages/finance/FinanceLayout.jsx          — Finance shell
src/pages/finance/FinancialOverviewTab.jsx  — Finance overview (cash/accrual toggle, charts)
src/pages/finance/InvoicesTab.jsx           — One-off + recurring invoice tabs (recurring gated by finance_recurring_invoices)
src/pages/finance/RecurringInvoiceDialog.jsx — Recurring template create/edit
src/pages/finance/EditInvoiceDialog.jsx     — Invoice edit/view (live preview)
src/pages/MeetingsPage.jsx          — Meetings
src/pages/NotesAndReminders.jsx     — Notes
src/pages/PublicReview.jsx          — Per-post client review link (fetches agency branding via secondary query)
src/pages/billingAndUsage/BillingUsage.jsx        — Plan/billing shell
src/pages/billingAndUsage/TertiarySubscriptionTab.jsx — Plan cards + comparison table + upgrade request dialog
src/components/campaigns/CampaignTab.jsx        — Reusable campaigns tab (clientId prop = scoped; no prop = global)
src/components/campaigns/CampaignDialog.jsx     — Create/edit campaign form (Zod validated; client selector shown when no clientId)
src/components/campaigns/CampaignReportPDF.jsx  — Campaign PDF report (@react-pdf/renderer)
src/components/documents/DocumentsTab.jsx       — Reusable documents tab (same clientId scoping pattern as CampaignTab)
src/components/sidebar/nav-header.jsx — Sidebar header (branding_agency_sidebar logic)
src/components/sidebar/app-sidebar.jsx — Sidebar composition + "Tercero YYYY" footer text
src/lib/helper.js                   — formatDate(), formatFileSize(), MAX_DOCUMENT_SIZE_BYTES
src/lib/client-helpers.js           — getUrgencyStatus()
src/lib/industries.js               — Industry constants
src/lib/platforms.js                — SUPPORTED_PLATFORMS constant (id, label, color per platform)
src/components/misc/header-context.jsx — useHeader() hook
src/utils/finance.js                — formatCurrency()
src/utils/downloadInvoicePDF.js     — Invoice PDF download utility
supabase/functions/send-campaign-review-email/index.ts — Campaign review email edge function
```
