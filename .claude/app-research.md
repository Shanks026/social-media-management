# Tercero — Full Application Research Document

> **Purpose**: Comprehensive product/feature reference for building a landing page for Tercero.
> **Status**: Based on live codebase analysis (March 2026).

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
| Finance | `/finance` | Invoices, expenses, ledger, subscriptions |
| Meetings | `/operations/meetings` | Meeting scheduling and history |
| Notes | `/operations/notes` | Tasks and reminders |
| Settings | `/settings` | Profile and agency branding |
| Billing | `/billing` | Agency's own subscription plan |
| Public Review | `/review/:token` | Client-facing content approval (no login required) |

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
1. **Overview** — Profile card, contact info, social links, profitability metrics, upcoming meeting widget, recent posts summary
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

---

### 3.4 FINANCE

Three conceptually separate but integrated financial tools.

#### Financial Overview (`/finance/overview`)
Summary dashboard for the agency's financial health:
- **Total Income**: Sum of all paid invoice amounts
- **Total Expenses**: One-off expense entries
- **Monthly Burn Rate**: Recurring subscription costs (auto-calculated from active subscriptions)
- Trend cards with directional indicators

#### Invoices (`/finance/invoices`)
Full invoice lifecycle management:
- Create invoices with line items (description, quantity, unit price)
- Auto-generated invoice numbers (format: `INV-YYYY-###`)
- Status workflow: `Draft → Sent → Paid → Archived`
- **PDF Export**: Professionally formatted invoice PDF (generated client-side with `@react-pdf/renderer`)
- **PDF Preview**: HTML preview before downloading
- When an invoice is marked **Paid** → automatically creates an INCOME transaction in the ledger
- Filters: by client, by status

**Invoice Fields**:
- Client
- Invoice number (auto-suggested, editable)
- Issue date, due date
- Line items (unlimited)
- Payment terms
- Notes
- Category

#### Subscriptions / Recurring Expenses (`/finance/subscriptions`)
Track all recurring costs:
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
- Media gallery (images/videos) with full-screen carousel
- Platform-specific social media preview (Instagram, LinkedIn, etc.)
- Target date and version number
- Feedback textarea
- "Request Revisions" submit button

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
- Storage usage bar (current MB/GB vs. plan limit)
- Client count vs. max clients on current plan
- Visual progress bars with percentage

**Plan Tab**:
- Current plan name
- Pricing and features
- Upgrade/downgrade options

**Invoices Tab**:
- History of charges from Tercero to the agency
- Download invoices

---

## 4. USER EXPERIENCE PATTERNS

### Navigation
- **Sidebar** (always visible on desktop, collapsible on mobile):
  - Agency logo + name at top
  - Nav groups: Dashboard, Clients, Content (Posts, Calendar), Operations (Meetings, Notes), Finance
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
    ├── Meetings
    ├── Notes / Tasks
    ├── Invoices
    │   └── Invoice Items
    └── Transactions (auto-created on invoice paid)
```

### Key Database RPCs (complex operations)
| RPC | What it does |
|-----|-------------|
| `get_clients_with_pipeline` | Returns clients + post counts per status + next_scheduled date |
| `create_post_draft_v3` | Atomically creates posts row + post_versions row + links them |
| `create_revision_version` | Creates new version, updates current_version_id |
| `get_global_calendar` | Returns posts in date range with version data |
| `advance_expense_billing_date` | Moves next_billing_date forward by one billing cycle |

### Database Views (read-only aggregations)
| View | Purpose |
|------|---------|
| `view_client_profitability` | Per-client financial metrics |
| `view_finance_overview` | Total income, total expenses, burn rate |
| `view_monthly_burn_rate` | Sum of active recurring expenses |

---

## 6. SUBSCRIPTION & PLAN SYSTEM

Each agency has an `agency_subscriptions` row that controls:
- Plan name (e.g., Starter, Growth, Pro)
- Max clients allowed
- Storage limit (bytes)
- White-label flags
- Agency branding (name, logo)

This data powers:
- The Billing page (usage bars)
- The sidebar (shows agency name/logo)
- The enforcement of limits (client count guards)

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

Three Supabase Edge Functions handle transactional email:

| Function | Trigger | Email sent |
|----------|---------|-----------|
| `send-approval-email` | Post marked as PENDING | Notifies approver/client |
| `send-client-welcome` | New client created | Welcome email to client |
| `send-password-update-email` | Password changed | Confirmation to user |

---

## 9. SUPPORTED SOCIAL PLATFORMS

| Platform | Preview Available | Icon |
|----------|------------------|------|
| Instagram | Yes (feed post style) | ✓ |
| LinkedIn | Yes (feed post style) | ✓ |
| Twitter / X | Yes (tweet card) | ✓ |
| YouTube | Yes (video thumbnail + title) | ✓ |
| Facebook | No dedicated preview | ✓ |

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
src/api/useSubscription.js          — Plan/branding hook
src/api/useGlobalPosts.js           — Filtered post list
src/pages/dashboard/Dashboard.jsx  — Dashboard composition
src/pages/clients/Clients.jsx       — Client list
src/pages/clients/ClientDetails.jsx — Client detail + tabs
src/pages/Posts.jsx                 — Global post list
src/pages/posts/postDetails/PostDetails.jsx — Post editor
src/pages/calendar/ContentCalendar.jsx — Calendar views
src/pages/finance/FinanceLayout.jsx — Finance shell
src/pages/MeetingsPage.jsx          — Meetings
src/pages/NotesAndReminders.jsx     — Notes
src/pages/PublicReview.jsx          — Client review link
src/pages/billingAndUsage/BillingUsage.jsx — Plan/billing
src/lib/helper.js                   — formatDate()
src/lib/client-helpers.js           — getUrgencyStatus()
src/lib/industries.js               — Industry constants
src/components/misc/header-context.jsx — useHeader() hook
```
