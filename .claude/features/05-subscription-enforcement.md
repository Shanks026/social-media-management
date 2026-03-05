# Subscription Enforcement — Implementation Guide
**Location**: `.claude/features/`  
**Last Updated**: March 2026  
**Purpose**: Step-by-step implementation instructions for gating existing features behind subscription tiers. Each phase is independently testable. Complete and manually verify each phase before starting the next.

> **Current state**: Only `white_label_flag` is enforced. Client count (`max_clients`) and storage (`storage_limit_bytes`) are partially enforced. Everything else is open to all users regardless of plan.

> **Lock icon approach**: Locked features are NOT hidden. They are shown in a visually muted state with a `🔒` lock indicator. Clicking a locked item opens an `UpgradeNudge` dialog. This is intentional — it sells the upgrade passively and prevents users from thinking features don't exist.

---

## Before You Start — Read This First

These notes exist to prevent the most common mistakes when working through this file with Claude Code. Read them before opening the codebase.

### 1. Run the database migration before touching any frontend code

The `S3 — Database Migration` section in Shared Infrastructure contains the full `ALTER TABLE` SQL. This migration is the foundation — it adds every feature flag column to `agency_subscriptions`. If Claude Code starts wiring `can.financeInvoicing()` or any other flag in the frontend before those columns exist in the database, the hook will return `undefined` for everything and nothing will behave correctly.

**The strict order is:**
1. Run the SQL migration manually in Supabase
2. Verify the migration (see note below)
3. Then hand Claude Code this file to begin frontend work

### 2. Verify `finance_invoicing = false` after the migration

All new columns default to Ignite values, which is correct for existing users. But after running the migration, manually confirm in Supabase that `finance_invoicing` is `false` on your existing rows. This is the most critical flag — if it defaults to `true` somehow, Ignite users will continue seeing the full Finance module unlocked and the enforcement will appear to work during testing when it hasn't.

```sql
-- Run this after the migration to confirm
SELECT user_id, plan_name, finance_invoicing, finance_subscriptions, finance_reports
FROM agency_subscriptions
LIMIT 10;
-- Expected: finance_invoicing = false for all existing Ignite rows
```

### 3. Tell Claude Code the phase number explicitly when starting each phase

This file covers six phases. When starting work on a phase, tell Claude Code "work on Phase 1" (or whichever phase) rather than describing the work in your own words. Claude Code will have this file in context and can reference the exact components, flags, and file targets listed for that phase without you repeating them. Describing it in your own words risks scope creep or missed details.

### 4. Tell Claude Code to grep for `useSubscription` before touching anything

`useSubscription` is already called in specific places in the codebase. Claude Code must find where it is currently consumed and extend those existing call sites rather than creating duplicate fetches. If it creates a second `useSubscription` call in a component that already has one, you will get double queries and potential state conflicts.

Tell Claude Code explicitly at the start of each session:
> *"Before making any changes, grep the codebase for `useSubscription` to understand where it is currently used."*

### 5. Use test accounts, not your real account, when verifying each phase

Your real account may be on a plan that unlocks everything — if so, locked states will never trigger and every phase will appear to pass testing when it hasn't. The Testing Checklist at the bottom of this file includes SQL to flip a test account between Ignite and Velocity. Run those before testing each phase.

### 6. Complete and manually verify each phase before starting the next

Each phase ends with a checklist. Do not skip it. Subscription enforcement is invisible when it works and catastrophically wrong when it doesn't — a bug that lets Ignite users access Velocity features indefinitely is a revenue problem, not just a UI bug.

---

## Lock Pattern Reference

Three distinct patterns are used throughout this implementation. Refer back to these definitions when building each phase.

### Pattern A — Nav Item Lock
Used for: Sidebar navigation items that lead to fully locked pages (Invoices, Subscriptions, Finance Overview).

**Behaviour**: Item is visible in nav, rendered with a `Lock` icon (lucide-react). Clicking does NOT navigate — it opens `UpgradeNudge` dialog instead. No `<Link>` wrapper on locked items.

```jsx
// Example nav item with lock
<NavItem
  icon={Receipt}
  label="Invoices"
  locked={!can.financeInvoicing()}
  lockedFeature="finance_invoicing"
  href="/finance/invoices"
/>

// NavItem internal logic
if (locked) {
  return (
    <button onClick={() => openUpgradeNudge(lockedFeature)}>
      <icon /> {label} <Lock size={12} className="ml-auto opacity-50" />
    </button>
  );
}
```

### Pattern B — Page-Level Lock Overlay
Used for: When a user navigates directly to a locked route (deep link, bookmark).

**Behaviour**: Full page shell renders (sidebar, header intact). Content area replaced with a centred upgrade card. Never a blank page or redirect to 404.

```jsx
// Wrap page content
function FinanceInvoicesPage() {
  const { can } = useSubscription();
  
  if (!can.financeInvoicing()) {
    return <LockedPage featureKey="finance_invoicing" />;
  }
  
  return <InvoicesContent />;
}

// LockedPage component
function LockedPage({ featureKey }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
      <Lock size={40} className="text-muted-foreground" />
      <h2 className="text-xl font-semibold">{NUDGE_COPY[featureKey].title}</h2>
      <p className="text-muted-foreground max-w-sm">{NUDGE_COPY[featureKey].body}</p>
      <Button asChild><Link to="/billing">{NUDGE_COPY[featureKey].cta}</Link></Button>
    </div>
  );
}
```

### Pattern C — Feature-Level Lock Overlay
Used for: Individual widgets, tabs, or sections within an otherwise accessible page (Profitability chart on Dashboard, Campaign Analytics tab, etc).

**Behaviour**: Component renders in a visually muted/blurred state. A lock badge is positioned over it. Clicking anywhere on the component opens `UpgradeNudge`. The user can see the shape and layout of what's locked — this is intentional.

```jsx
function LockedFeature({ featureKey, children }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div 
        className="relative cursor-pointer select-none"
        onClick={() => setOpen(true)}
      >
        {/* Blur/mute the content */}
        <div className="pointer-events-none blur-[2px] opacity-40 saturate-0">
          {children}
        </div>
        {/* Lock badge overlay */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex items-center gap-2 bg-background/90 border rounded-md px-3 py-2 shadow-sm">
            <Lock size={14} />
            <span className="text-sm font-medium">
              {NUDGE_COPY[featureKey].cta}
            </span>
          </div>
        </div>
      </div>
      <UpgradeNudge featureKey={featureKey} open={open} onClose={() => setOpen(false)} />
    </>
  );
}

// Usage
<LockedFeature featureKey="finance_invoicing">
  <InvoicesTable data={mockData} />
</LockedFeature>
```

---

## Shared Infrastructure (Build Once, Before Any Phase)

These three pieces must exist before any phase begins. They are the foundation everything else references.

### S1 — UpgradeNudge Component

Create `src/components/misc/UpgradeNudge.jsx`:

```jsx
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Lock } from 'lucide-react';
import { Link } from 'react-router-dom';

export const NUDGE_COPY = {
  // Finance
  finance_invoicing:        { title: "Invoicing", body: "Create and send invoices to clients directly from Tercero.", cta: "Upgrade to Velocity — from ₹8,999/mo" },
  finance_subscriptions:    { title: "Recurring Expenses", body: "Track subscriptions and recurring costs across all clients.", cta: "Upgrade to Velocity — from ₹8,999/mo" },
  finance_reports:          { title: "Profitability Reports", body: "See revenue, expenses, and profit margin per client.", cta: "Upgrade to Velocity — from ₹8,999/mo" },
  finance_cfo:              { title: "CFO Analysis", body: "Advanced financial reporting with accrual accounting and multi-currency.", cta: "Upgrade to Quantum — from ₹17,999/mo" },
  
  // Campaigns
  campaigns_limit:          { title: "Campaign Limit Reached", body: "You've reached the maximum active campaigns for your plan. Upgrade for unlimited campaigns per client.", cta: "Upgrade to Velocity — from ₹8,999/mo" },
  campaigns_analytics:      { title: "Campaign Analytics", body: "See delivery rates, approval timelines, and post performance per campaign.", cta: "Upgrade to Velocity — from ₹8,999/mo" },
  campaigns_budget:         { title: "Campaign Budgets", body: "Track spend per campaign and link directly to invoices.", cta: "Upgrade to Velocity — from ₹8,999/mo" },
  campaigns_approval_link:  { title: "Campaign Approval Link", body: "Share a single link for clients to approve all posts in a campaign at once.", cta: "Upgrade to Velocity — from ₹8,999/mo" },
  campaigns_templates:      { title: "Campaign Templates", body: "Save and reuse campaign structures across clients.", cta: "Upgrade to Velocity — from ₹8,999/mo" },
  
  // Proposals
  proposal_builder:         { title: "Proposal Builder", body: "Send professional proposals with a shareable link. Clients accept online — no printing, no email chains.", cta: "Upgrade to Ignite — from ₹2,999/mo" },
  proposal_templates:       { title: "Proposal Templates", body: "Save time with reusable proposal structures for recurring pitch types.", cta: "Upgrade to Velocity — from ₹8,999/mo" },
  proposal_esignature:      { title: "E-Signature", body: "Let clients sign proposals online. Acceptance recorded with timestamp.", cta: "Upgrade to Velocity — from ₹8,999/mo" },
  proposal_analytics:       { title: "Proposal Analytics", body: "See if clients opened your proposal and how long they spent reading it.", cta: "Upgrade to Quantum — from ₹17,999/mo" },
  
  // Documents
  document_limit:           { title: "Document Limit Reached", body: "You've reached the document limit for this client. Upgrade for unlimited document storage.", cta: "Upgrade to Velocity — from ₹8,999/mo" },
  document_sharing:         { title: "Document Sharing", body: "Share contracts and briefs with clients via a secure link. No email attachments.", cta: "Upgrade to Velocity — from ₹8,999/mo" },
  document_templates:       { title: "Document Templates", body: "Generate contracts, briefs, and SOPs from reusable templates.", cta: "Upgrade to Velocity — from ₹8,999/mo" },
  document_ai_generation:   { title: "AI Document Generation", body: "Generate contracts and briefs automatically using your client data.", cta: "Upgrade to Quantum — from ₹17,999/mo" },
  
  // Branding
  branding_client_pages:    { title: "Agency Branding on Client Pages", body: "Show your agency logo on all client-facing pages — review links, proposals, and shared documents.", cta: "Upgrade to Velocity — from ₹8,999/mo" },
  branding_custom_domain:   { title: "Custom Domain", body: "Use your own domain on all client-facing links. Remove all Tercero branding.", cta: "Upgrade to Quantum — from ₹17,999/mo" },
  
  // Calendar
  calendar_export:          { title: "Calendar Export", body: "Export your content calendar as a PDF to share with clients.", cta: "Upgrade to Velocity — from ₹8,999/mo" },
};

export function UpgradeNudge({ featureKey, open, onClose }) {
  const copy = NUDGE_COPY[featureKey];
  if (!copy) return null;
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <Lock size={16} className="text-muted-foreground" />
            <DialogTitle>{copy.title}</DialogTitle>
          </div>
          <DialogDescription>{copy.body}</DialogDescription>
        </DialogHeader>
        <Button asChild className="w-full mt-2">
          <Link to="/billing" onClick={onClose}>{copy.cta}</Link>
        </Button>
        <Button variant="ghost" className="w-full" onClick={onClose}>
          Maybe later
        </Button>
      </DialogContent>
    </Dialog>
  );
}
```

### S2 — Extend `useSubscription` Hook

Extend `src/api/useSubscription.js` to expose a `can` object. The existing hook already fetches the subscription row — add the `can` API on top of the existing return value.

```javascript
// Add to the existing useSubscription hook's return value

const sub = subscriptionData; // existing fetched row

const can = {
  // Numeric limits
  addClient:          (count) => sub?.max_clients == null || count < sub.max_clients,
  addCampaign:        (count) => sub?.max_campaigns_per_client == null || count < sub.max_campaigns_per_client,
  addProspect:        (count) => sub?.max_prospects == null || count < sub.max_prospects,
  addProposal:        (count) => sub?.max_proposals == null || count < sub.max_proposals,
  addDocument:        (count) => sub?.max_docs_per_client == null || count < sub.max_docs_per_client,
  uploadFile:         (bytes) => bytes <= (sub?.max_doc_file_size_bytes ?? Infinity),

  // Finance
  financeInvoicing:   () => sub?.finance_invoicing === true,
  financeSubscriptions:()=> sub?.finance_subscriptions === true,
  financeReports:     () => sub?.finance_reports === true,
  financeCfo:         () => sub?.finance_cfo_analysis === true,
  financeMultiCurrency:()=> sub?.finance_multi_currency === true,

  // Campaigns
  campaignAnalytics:  () => sub?.campaigns_analytics === true,
  campaignBudgets:    () => sub?.campaigns_budget === true,
  campaignApprovalLink:()=> sub?.campaigns_approval_link === true,
  campaignTemplates:  () => sub?.campaigns_templates === true,
  campaignCrossClient:() => sub?.campaigns_cross_client === true,

  // Proposals
  proposalBuilder:    () => sub?.proposal_builder === true,
  proposalFullBranding:()=> sub?.proposal_full_branding === true,
  proposalTemplates:  () => sub?.proposal_templates === true,
  proposalEsignature: () => sub?.proposal_esignature === true,
  proposalAnalytics:  () => sub?.proposal_analytics === true,

  // Documents
  documentVersionHistory: () => sub?.document_version_history === true,
  documentSharing:    () => sub?.document_sharing === true,
  documentTemplates:  () => sub?.document_templates === true,
  documentAiGeneration:() => sub?.document_ai_generation === true,
  documentFulltextSearch:()=> sub?.document_fulltext_search === true,

  // Branding
  brandingClientPages:() => sub?.branding_client_pages === true,
  brandingCustomDomain:()=> sub?.branding_custom_domain === true,
  brandingRemoveTercero:()=> sub?.branding_remove_tercero === true,

  // Calendar & misc
  calendarExport:     () => sub?.calendar_export === true,
  clientActivityLog:  () => sub?.client_activity_log === true,
  meetingNotesExport: () => sub?.meeting_notes_export === true,
};

// Add planName helper
const planName = sub?.plan_name ?? 'ignite';
const isTrialExpired = sub?.plan_name === 'trial' && 
  sub?.trial_ends_at && new Date() > new Date(sub.trial_ends_at);

return { 
  ...existingReturnValues,  // keep everything currently returned
  can, 
  planName,
  isTrialExpired,
};
```

### S3 — Database Migration

Run this migration **before any phase begins**. All new columns default to the correct Ignite values so existing users are not broken.

```sql
-- Migration: add subscription feature flags
-- Safe to run on existing data — all columns have defaults matching Ignite behaviour

ALTER TABLE agency_subscriptions
  -- Plan metadata
  ADD COLUMN IF NOT EXISTS plan_name TEXT DEFAULT 'ignite'
    CHECK (plan_name IN ('trial', 'ignite', 'velocity', 'quantum')),
  ADD COLUMN IF NOT EXISTS billing_cycle TEXT DEFAULT 'monthly'
    CHECK (billing_cycle IN ('monthly', 'annual')),
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS extra_client_price_inr INTEGER DEFAULT 500,

  -- Campaign flags (default = Ignite limits)
  ADD COLUMN IF NOT EXISTS max_campaigns_per_client INTEGER DEFAULT 5,
  ADD COLUMN IF NOT EXISTS campaigns_analytics BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS campaigns_budget BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS campaigns_approval_link BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS campaigns_templates BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS campaigns_cross_client BOOLEAN DEFAULT FALSE,

  -- Prospect & proposal flags
  ADD COLUMN IF NOT EXISTS max_prospects INTEGER DEFAULT 15,
  ADD COLUMN IF NOT EXISTS max_proposals INTEGER DEFAULT 5,
  ADD COLUMN IF NOT EXISTS proposal_builder BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS proposal_full_branding BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS proposal_templates BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS proposal_esignature BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS proposal_invoice_bridge BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS proposal_view_tracking BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS proposal_analytics BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS proposal_custom_domain BOOLEAN DEFAULT FALSE,

  -- Document flags
  ADD COLUMN IF NOT EXISTS max_docs_per_client INTEGER DEFAULT 30,
  ADD COLUMN IF NOT EXISTS max_doc_file_size_bytes BIGINT DEFAULT 52428800,
  ADD COLUMN IF NOT EXISTS document_version_history BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS document_sharing BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS document_templates BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS document_esignature BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS document_ai_generation BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS document_fulltext_search BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS document_custom_domain BOOLEAN DEFAULT FALSE,

  -- Finance flags
  ADD COLUMN IF NOT EXISTS finance_invoicing BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS finance_tax_line_items BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS finance_payment_reminders BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS finance_subscriptions BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS finance_reports BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS finance_cfo_analysis BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS finance_accrual_toggle BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS finance_multi_currency BOOLEAN DEFAULT FALSE,

  -- Calendar & content flags
  ADD COLUMN IF NOT EXISTS calendar_export BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS bulk_post_actions BOOLEAN DEFAULT TRUE,

  -- Operational flags
  ADD COLUMN IF NOT EXISTS meeting_notes_export BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS client_activity_log BOOLEAN DEFAULT FALSE,

  -- Branding flags (white_label_flag already exists)
  ADD COLUMN IF NOT EXISTS branding_client_pages BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS branding_custom_domain BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS branding_custom_email BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS branding_remove_tercero BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS branding_client_portal BOOLEAN DEFAULT FALSE;

-- Update existing rows to match Ignite plan correctly
-- (defaults above handle new rows; this corrects any existing rows)
UPDATE agency_subscriptions
SET plan_name = 'ignite'
WHERE plan_name IS NULL;
```

**After running migration — verify:**
```sql
SELECT plan_name, finance_invoicing, max_campaigns_per_client, 
       max_docs_per_client, branding_client_pages
FROM agency_subscriptions LIMIT 5;
-- Expected: plan_name='ignite', finance_invoicing=false, 
--           max_campaigns_per_client=5, max_docs_per_client=30,
--           branding_client_pages=false
```

---

## Phase 1 — Finance Module Gating

**Priority**: Critical. This is the highest-revenue leak. Ignite users currently have full Velocity finance access.  
**Affected files**: `src/AppShell.jsx` (nav), `src/pages/finance/*`, `src/pages/dashboard/Dashboard.jsx`  
**Flags used**: `finance_invoicing`, `finance_subscriptions`, `finance_reports`  
**Lock pattern**: Pattern A (nav), Pattern B (page), Pattern C (dashboard widgets)

### 1.1 — Sidebar Navigation

In `AppShell.jsx` (or wherever the Finance nav group is rendered), apply Pattern A to Invoices and Subscriptions nav items.

**Changes:**
- Finance nav group itself: always visible, always clickable (leads to Overview)
- "Overview" sub-item: always accessible (basic ledger is available to all)
- "Invoices" sub-item: lock if `!can.financeInvoicing()`
- "Subscriptions" sub-item: lock if `!can.financeSubscriptions()`
- "Ledger" sub-item: always accessible

```jsx
// In the Finance nav group sub-items

{ label: 'Overview',      href: '/finance/overview',       locked: false },
{ label: 'Ledger',        href: '/finance/ledger',         locked: false },
{ label: 'Invoices',      href: '/finance/invoices',       locked: !can.financeInvoicing(),      lockedFeature: 'finance_invoicing' },
{ label: 'Subscriptions', href: '/finance/subscriptions',  locked: !can.financeSubscriptions(),  lockedFeature: 'finance_subscriptions' },
```

### 1.2 — Finance Overview Page (`/finance/overview`)

The Finance Overview page is accessible to all tiers but shows different depth. Apply Pattern C to the locked sections.

**For Ignite users — show locked:**
- Profitability Trend chart → `<LockedFeature featureKey="finance_reports">`
- Net Profit / Cash Inflow / Expenses KPI cards → show, but values hidden with `—` placeholder and lock badge

**For Velocity+ users — show fully:**
- All cards and charts render normally

```jsx
// In FinanceOverview.jsx
const { can } = useSubscription();

// KPI Cards — show structure, hide values if locked
<KpiCard 
  label="NET PROFIT (CASH)"
  value={can.financeReports() ? formatCurrency(netProfit) : null}
  locked={!can.financeReports()}
  lockedFeature="finance_reports"
/>

// Profitability Trend chart
{can.financeReports() ? (
  <ProfitabilityTrendChart data={trendData} />
) : (
  <LockedFeature featureKey="finance_reports">
    <ProfitabilityTrendChart data={mockTrendData} />
  </LockedFeature>
)}
```

### 1.3 — Invoices Page (`/finance/invoices`)

Apply Pattern B. If `!can.financeInvoicing()`, replace content with `<LockedPage featureKey="finance_invoicing" />`.

```jsx
// In FinanceInvoices.jsx
const { can } = useSubscription();
if (!can.financeInvoicing()) return <LockedPage featureKey="finance_invoicing" />;
// ... rest of component unchanged
```

### 1.4 — Subscriptions Page (`/finance/subscriptions`)

Apply Pattern B. If `!can.financeSubscriptions()`, replace content with `<LockedPage featureKey="finance_subscriptions" />`.

```jsx
// In FinanceSubscriptions.jsx
const { can } = useSubscription();
if (!can.financeSubscriptions()) return <LockedPage featureKey="finance_subscriptions" />;
```

### 1.5 — Dashboard Financial Widgets

In `Dashboard.jsx`, apply Pattern C to the widgets that require the finance module.

**Affected widgets:**
- Profitability Trend chart → lock if `!can.financeReports()`
- Lifetime Revenue chart → lock if `!can.financeReports()`
- Recent Invoices table → lock if `!can.financeInvoicing()`
- Financial Snapshot KPIs → show basic (revenue only) for Ignite, full for Velocity+

```jsx
// Recent Invoices widget
{can.financeInvoicing() ? (
  <RecentInvoicesWidget invoices={recentInvoices} />
) : (
  <LockedFeature featureKey="finance_invoicing">
    <RecentInvoicesWidget invoices={mockInvoices} />
  </LockedFeature>
)}

// Profitability Trend
{can.financeReports() ? (
  <ProfitabilityTrendWidget data={trendData} />
) : (
  <LockedFeature featureKey="finance_reports">
    <ProfitabilityTrendWidget data={mockTrendData} />
  </LockedFeature>
)}
```

### 1.6 — Client Detail Financials Tab

In `ClientDetails.jsx`, the Financials tab shows per-client profitability. Apply Pattern C on the profit metrics section.

```jsx
// Per-client profitability row (Net Profit, MRR, Margin)
{can.financeReports() ? (
  <ClientProfitabilityMetrics data={financials} />
) : (
  <LockedFeature featureKey="finance_reports">
    <ClientProfitabilityMetrics data={mockFinancials} />
  </LockedFeature>
)}
```

**✅ Phase 1 complete when:**
- [ ] Invoices nav item shows lock icon on Ignite plan
- [ ] Subscriptions nav item shows lock icon on Ignite plan
- [ ] Clicking locked nav items opens UpgradeNudge (does NOT navigate)
- [ ] Navigating directly to `/finance/invoices` on Ignite shows LockedPage
- [ ] Navigating directly to `/finance/subscriptions` on Ignite shows LockedPage
- [ ] Dashboard Profitability Trend and Recent Invoices show blur + lock on Ignite
- [ ] Velocity plan sees all finance fully unlocked
- [ ] Quantum plan sees all finance fully unlocked

---

## Phase 2 — Dashboard Widget Cleanup

**Priority**: Medium. Cleans up residual open widgets after Phase 1.  
**Affected files**: `src/pages/dashboard/Dashboard.jsx`  
**Flags used**: `finance_reports`, `finance_invoicing`  
**Lock pattern**: Pattern C only

This phase is mostly completed by Phase 1's dashboard changes. This phase catches anything missed and ensures the dashboard financial snapshot card itself is correctly scoped.

### 2.1 — Financial Snapshot KPI Bar

The top KPI bar on the dashboard (Net Profit, Revenue, Expenses, Active Clients) should show:
- **Ignite**: Active Clients count only. Revenue and Expenses show `—` with a small lock badge. No UpgradeNudge on hover — too aggressive for the top bar. Just visual indication.
- **Velocity+**: All values shown normally.

```jsx
// In the top KPI bar
<KpiCard label="NET PROFIT (MO)" 
  value={can.financeReports() ? formatCurrency(netProfit) : '—'} 
  locked={!can.financeReports()}
  showLockIcon={true}
  compact={true}   // small lock, no click handler for compact KPIs
/>
<KpiCard label="REVENUE (MO)"
  value={can.financeReports() ? formatCurrency(revenue) : '—'}
  locked={!can.financeReports()}
  showLockIcon={true}
  compact={true}
/>
// Active Clients — always shown, no lock
<KpiCard label="ACTIVE CLIENTS" value={clientCount} />
```

**✅ Phase 2 complete when:**
- [ ] Dashboard KPI bar shows `—` for financial values on Ignite plan
- [ ] Lock icon is visible on locked KPI cards (small, non-clickable)
- [ ] No NaN, undefined, or ₹0 shown for locked values — always `—`
- [ ] Velocity+ sees all KPI values normally

---

## Phase 3 — Client Profitability & Activity Log

**Priority**: Low-medium. Affects client detail pages.  
**Affected files**: `src/pages/clients/ClientDetails.jsx`, `src/pages/clients/Clients.jsx`  
**Flags used**: `finance_reports`, `client_activity_log`  
**Lock pattern**: Pattern C

### 3.1 — Client List Cards

On the Clients page (`/clients`), each client card shows financial metrics (Total Revenue, Monthly Burn, Margin). These should be locked on Ignite.

```jsx
// In client card component
{can.financeReports() ? (
  <ClientFinancialSummary revenue={revenue} burn={burn} margin={margin} />
) : (
  <LockedFeature featureKey="finance_reports">
    <ClientFinancialSummary revenue={99000} burn={12000} margin={88} />
  </LockedFeature>
)}
```

### 3.2 — Client Detail Financials Tab

Full profitability view on the Financials tab of each client.

```jsx
// Wrap the entire profitability section
{can.financeReports() ? (
  <ClientProfitabilityFull data={financials} />
) : (
  <LockedFeature featureKey="finance_reports">
    <ClientProfitabilityFull data={mockFinancials} />
  </LockedFeature>
)}
```

### 3.3 — Activity Log (when implemented)

When the activity log feature is built, wrap its tab/section:

```jsx
{can.clientActivityLog() ? (
  <ActivityLog clientId={clientId} />
) : (
  <LockedFeature featureKey="client_activity_log">
    <ActivityLog data={mockActivity} />
  </LockedFeature>
)}
```

**✅ Phase 3 complete when:**
- [ ] Client list cards show locked financial metrics on Ignite (blur + lock)
- [ ] Client detail Financials tab shows locked profitability section on Ignite
- [ ] Velocity+ sees full financials on all client cards and detail pages

---

## Phase 4 — Trial Enforcement

**Priority**: High before public launch. Required before running any acquisition campaign.  
**Affected files**: `src/context/AuthContext.jsx` or `src/AppShell.jsx`, new `TrialBanner.jsx`  
**Flags used**: `plan_name`, `trial_ends_at`

### 4.1 — Trial Banner Component

Create `src/components/misc/TrialBanner.jsx`:

```jsx
export function TrialBanner() {
  const { planName, subscription } = useSubscription();
  if (planName !== 'trial') return null;

  const trialEndsAt = new Date(subscription.trial_ends_at);
  const now = new Date();
  const daysLeft = Math.ceil((trialEndsAt - now) / (1000 * 60 * 60 * 24));

  if (daysLeft > 4) return null; // Silent until day 10 (14 - 4)

  const isExpired = daysLeft <= 0;

  return (
    <div className={`w-full px-4 py-2 text-sm text-center ${
      isExpired ? 'bg-destructive text-destructive-foreground' : 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
    }`}>
      {isExpired
        ? "Your trial has ended. Your data is safe — choose a plan to continue."
        : `${daysLeft} day${daysLeft === 1 ? '' : 's'} left on your trial.`
      }
      {' '}
      <Link to="/billing" className="underline font-medium">
        {isExpired ? 'Choose a plan' : 'Upgrade now'}
      </Link>
    </div>
  );
}
```

### 4.2 — Trial Expiry Gate

In `AppShell.jsx`, add the trial expiry check. After the 48-hour grace period, all creation actions are blocked.

```jsx
// In AppShell.jsx
const { isTrialExpired, subscription } = useSubscription();

const gracePeriodEnd = subscription?.trial_ends_at
  ? new Date(new Date(subscription.trial_ends_at).getTime() + 48 * 60 * 60 * 1000)
  : null;

const isHardLocked = isTrialExpired && gracePeriodEnd && new Date() > gracePeriodEnd;

// Pass isHardLocked down via context or zustand
// Components check isHardLocked before any create/edit/delete action
// Hard lock: show LockedPage on all routes except /billing and /settings
```

### 4.3 — Trial Signup Flow

When a new user completes onboarding, set their trial:

```sql
-- Run after onboarding completion
UPDATE agency_subscriptions
SET 
  plan_name = 'trial',
  trial_ends_at = NOW() + INTERVAL '14 days',
  -- Apply all Ignite flags
  finance_invoicing = false,
  max_campaigns_per_client = 5,
  -- ... all other Ignite values
WHERE user_id = $1;
```

**✅ Phase 4 complete when:**
- [ ] New signups show "14 days left" in no banner until day 10
- [ ] Day 10–13: amber banner with days remaining visible in app
- [ ] Day 14: banner changes to "trial ended" state
- [ ] Day 14 + 48h: all create actions blocked, only /billing accessible
- [ ] Existing paying users (Ignite/Velocity/Quantum) see no banner at all

---

## Phase 5 — Branding Enforcement (Extend Existing)

**Priority**: Low. Whitelabeling is already partially enforced. This extends it.  
**Affected files**: `src/pages/PublicReview.jsx`, review token generation, agency settings  
**Flags used**: `branding_client_pages`, `branding_custom_domain`, `branding_remove_tercero`  
**Note**: The existing `white_label_flag` maps to `branding_client_pages`. Migrate existing checks to use the new flag name for consistency, or alias it.

### 5.1 — Public Review Page

`/review/:token` — the client-facing post approval page.

```jsx
// In PublicReview.jsx
// Agency logo shown only if branding_client_pages is true on the agency's subscription
// "Powered by Tercero" shown if branding_remove_tercero is false (i.e., all tiers except Quantum)

{agency.subscription.branding_client_pages && (
  <img src={agency.logo_url} alt={agency.name} className="h-8" />
)}

{!agency.subscription.branding_remove_tercero && (
  <p className="text-xs text-muted-foreground">Powered by Tercero</p>
)}
```

### 5.2 — Agency Settings — Branding Section

In Settings → Agency tab, show locked state for branding features not available on current plan.

```jsx
// Custom domain field
{can.brandingCustomDomain() ? (
  <CustomDomainInput value={customDomain} onChange={setCustomDomain} />
) : (
  <LockedFeature featureKey="branding_custom_domain">
    <CustomDomainInput value="yourdomain.com" disabled />
  </LockedFeature>
)}
```

**✅ Phase 5 complete when:**
- [ ] Public review page shows agency logo only on Velocity+ plans
- [ ] "Powered by Tercero" shows on Ignite and Velocity, hidden on Quantum
- [ ] Custom domain field locked on Ignite and Velocity
- [ ] Settings branding section shows appropriate locks per plan

---

## Phase 6 — Prepare Flags for New Features (Future-Proofing)

**Priority**: Before building any new Phase 1 features (Campaigns, Proposals, Documents).  
**This phase has no visible UI changes.** It is purely infrastructure and guard implementation so that when new features are built, enforcement is already wired in.

### 6.1 — Campaign Creation Guard

In whatever component or API handler creates a campaign (to be built), add the check:

```jsx
// In campaign creation handler
const { can } = useSubscription();
const activeCampaignCount = useActiveCampaignCount(clientId); // hook to be built with feature

const handleCreateCampaign = () => {
  if (!can.addCampaign(activeCampaignCount)) {
    openUpgradeNudge('campaigns_limit');
    return;
  }
  // proceed with creation
};
```

### 6.2 — Client Count Guard Update

**Critical**: When Prospect status is added to the `clients` table, update the client count check to exclude Prospects:

```javascript
// In src/api/clients.js — wherever active client count is calculated
// Change from:
const clientCount = clients.filter(c => c.user_id === userId).length;

// To:
const clientCount = clients.filter(c => 
  c.user_id === userId && 
  c.status !== 'Prospect'
).length;
```

Also update the Supabase RPC or query used in `get_clients_with_pipeline` to exclude Prospects from the count used in plan limit enforcement.

### 6.3 — Document Upload Guard

In the document upload handler (to be built with the Documents feature):

```jsx
const handleUpload = (file) => {
  if (!can.uploadFile(file.size)) {
    toast.error(`File too large. Your plan supports up to ${formatBytes(subscription.max_doc_file_size_bytes)} per file.`);
    return;
  }
  if (!can.addDocument(currentDocCount)) {
    openUpgradeNudge('document_limit');
    return;
  }
  // proceed with upload
};
```

**✅ Phase 6 complete when:**
- [ ] `useSubscription` can.addCampaign(), can.addDocument(), can.addProspect() return correct values for all plans (verify in browser console)
- [ ] Client count calculation excludes Prospect status (even though Prospect feature not built yet — the query must be correct before the status type is introduced)
- [ ] No visible UI changes — this phase is invisible to users

---

## Testing Checklist Per Phase

Use this to create test accounts for manual verification.

### Test accounts needed:
- `test-ignite@...` — Ignite plan (`finance_invoicing = false`, `max_campaigns_per_client = 5`)
- `test-velocity@...` — Velocity plan (`finance_invoicing = true`, `max_campaigns_per_client = NULL`)
- `test-quantum@...` — Quantum plan (all flags = true)
- `test-trial@...` — Trial account (`plan_name = 'trial'`, `trial_ends_at = NOW() + 1 day`)
- `test-expired@...` — Expired trial (`trial_ends_at = NOW() - 2 days`)

### To manually set a test account's plan:
```sql
-- Set to Velocity for testing
UPDATE agency_subscriptions SET
  plan_name = 'velocity',
  finance_invoicing = true,
  finance_subscriptions = true,
  finance_reports = true,
  max_campaigns_per_client = NULL,
  branding_client_pages = true
WHERE user_id = '[test-user-uuid]';

-- Set back to Ignite
UPDATE agency_subscriptions SET
  plan_name = 'ignite',
  finance_invoicing = false,
  finance_subscriptions = false,
  finance_reports = false,
  max_campaigns_per_client = 5,
  branding_client_pages = false
WHERE user_id = '[test-user-uuid]';
```
