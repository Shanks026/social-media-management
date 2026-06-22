# Feature: Ads Management — Implementation Plan
**Product**: Tercero — Social Media Agency Management SaaS
**File**: `documentation/features/feature-ads-plan.md`
**Brief**: `documentation/features/feature-ads.md`
**Status**: Planned
**Last Updated**: June 2026

---

## Context

Tercero tracks organic work (posts, campaigns, approvals) but paid media is invisible — ad spend is buried in the general ledger with no context. The Ads module makes paid media a first-class citizen: per client, every paid campaign, what it costs (spend the agency paid the platform), and what was billed back. It is the **paid-media twin of organic Campaigns** and reuses the same architecture almost entirely.

This plan is grounded in an analysis of the existing **Campaigns** and **Finance** modules. The core finding: the finance-linking mechanism Ads needs **already exists** — `transactions.campaign_id` and `invoices.campaign_id`, the `defaultCampaignId`/`preselectedCampaignId` props on the finance dialogs, the `get_campaign_analytics` RPC, and the `useCampaignTransactions`/`useCampaignInvoices` hooks. Ads adds a parallel `ad_id` link and a richer analytics RPC.

### Decisions locked during planning
- **Detail surface**: full page at `/ads/:adId` (mirrors `CampaignDetailPage`), not a drawer.
- **Finance model**: **dual-sided** — every ad tracks both *spend* (linked EXPENSE transactions) and *billed* (linked invoices) simultaneously. This is the divergence from Campaigns (which is internal=expenses / external=invoices, either-or) and it is the core value: it surfaces the agency's unrecouped float.
- **FK column**: `ad_id` (referencing `ad_campaigns.id`) on both `transactions` and `invoices`.
- **Sidebar placement**: next to **Campaigns** (same nav group, `requiresFlag: 'ads'`), plus an `AdTab` in the client profile. The "My Organization" sidebar restructure is **deferred to the Partnerships feature**, where it belongs.
- **Gating**: new `ads` boolean flag — Trial TRUE, Ignite **FALSE** (hidden), Velocity TRUE, Quantum TRUE. Unlike Campaigns, Ads is hidden entirely on Ignite.

---

## How Ads maps onto existing infrastructure

| Ads need | Existing pattern to clone / extend | Source |
|---|---|---|
| `ad_campaigns` table | `campaigns` table (id, user_id, client_id, name, goal, status, start/end_date, budget) | DB |
| Tag spend to an ad | add `ad_id` to `transactions` (parallel to `campaign_id`) | `transactions` |
| Link invoice to an ad | add `ad_id` to `invoices` (parallel to `campaign_id`) | `invoices` |
| Log spend from detail page | `AddTransactionDialog` `defaultCampaignId` → add `defaultAdId` | `src/pages/finance/AddTransactionDialog.jsx` |
| Create/link invoice from detail | `CreateInvoiceDialog` `preselectedCampaignId` → add `preselectedAdId` | `src/pages/finance/CreateInvoiceDialog.jsx` |
| Budget vs spend/billed math | `get_campaign_analytics` → clone as `get_ad_analytics` (superset) | RPC |
| List with rollups | `get_campaigns_with_post_summary` → clone as `get_ads_with_summary` | RPC |
| Per-record finance hooks | `useCampaignTransactions`/`useCampaignInvoices` → `useAdTransactions`/`useAdInvoices` | `src/api/transactions.js`, `src/api/campaigns.js` |
| API module | `src/api/campaigns.js` | clone → `src/api/ads.js` |
| Global list + client tab | `CampaignTab` (`clientId` prop toggles scope) | `src/components/campaigns/CampaignTab.jsx` |
| Card / Dialog | `CampaignCard` / `CampaignDialog` | `src/components/campaigns/` |
| Detail page | `CampaignDetailPage` | `src/pages/campaigns/CampaignDetailPage.jsx` |
| Gating flag | `reports` / `finance_subscriptions` boolean flag pattern | `src/api/useSubscription.js` |
| Sidebar entry | `requiresFlag: 'campaigns'` nav item | `src/components/sidebar/nav-main.jsx` |

### Built fresh (no reuse)
- **`AD_PLATFORMS` constant** — `meta | google | linkedin | youtube | tiktok | other`. NOT the organic `SUPPORTED_PLATFORMS` (instagram/linkedin/facebook/twitter/youtube); ad networks are different.
- **`AD_TYPES` constant** — `awareness | retargeting | lead_gen | conversion | engagement | other`.
- **Optional `campaign_id`** on an ad (link to an organic campaign — contextual only, never a billing dependency).

---

## Phase Overview

```
Phase 1 — Core + Finance Linking
  Ad CRUD, dual-sided finance (spend + billed), global /ads list + /ads/:adId
  detail page, per-client AdTab, link to client (required) & campaign (optional),
  ads gating flag. The complete, independently useful MVP.

Phase 2 — Reporting
  Ads section in the client report PDF; ad summary block on the linked organic
  campaign's detail page.

Phase 3 — Auto (deferred; depends on OAuth publishing work)
  Pull spend & performance metrics from Meta / Google / LinkedIn APIs;
  auto-create expense transactions. Out of scope until OAuth lands.
```

**After each phase: stop and wait for approval before proceeding.**

---

## Phase 1 — Core + Finance Linking

### Goal
An agency can create an ad campaign for a client (optionally linked to an organic campaign), pick its platform/type/status/budget/date-range, log the spend they paid the platform, link the invoices they billed the client, and see budget-vs-spend-vs-billed at a glance — both globally at `/ads` and per-client in the client profile. Nothing about paid media lives in a spreadsheet anymore.

### Before Starting — Confirm With Codebase
1. `src/api/campaigns.js` — exact hook/mutation shapes and query-key conventions to mirror in `src/api/ads.js`.
2. `src/pages/finance/AddTransactionDialog.jsx` (lines ~77–155) — how `defaultCampaignId` locks the field and how `fetchActiveCampaignsByClient` populates the campaign select; replicate for `defaultAdId`.
3. `src/pages/finance/CreateInvoiceDialog.jsx` (lines ~61–129, 243, 486) — how `preselectedCampaignId` flows into state and the `campaign_id` payload; replicate for `ad_id`.
4. `src/components/sidebar/nav-main.jsx` (~line 72) — the `requiresFlag` nav-item shape and which group Campaigns sits in.
5. `src/pages/clients/ClientProfileView.jsx` — how `CampaignTab` is mounted as a tab with `clientId`; mirror for `AdTab`.
6. `src/App.jsx` (~lines 27–29, 111–112) — campaign route registration to mirror for `/ads` and `/ads/:adId`.

### 1.1 Database

**New enum types** (mirrors how `client_tier`, `transaction_status` are defined):
```sql
CREATE TYPE ad_platform AS ENUM ('meta','google','linkedin','youtube','tiktok','other');
CREATE TYPE ad_type     AS ENUM ('awareness','retargeting','lead_gen','conversion','engagement','other');
CREATE TYPE ad_status   AS ENUM ('draft','active','paused','completed','cancelled');
```

**New table `ad_campaigns`:**
```sql
CREATE TABLE ad_campaigns (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL,                       -- workspace owner UID (RLS scope)
  client_id   uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES campaigns(id) ON DELETE SET NULL,   -- optional organic link
  name        text NOT NULL,
  platform    ad_platform NOT NULL DEFAULT 'meta',
  ad_type     ad_type     NOT NULL DEFAULT 'awareness',
  goal        text,
  budget      numeric,
  status      ad_status   NOT NULL DEFAULT 'draft',
  start_date  date,
  end_date    date,
  notes       text,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);
CREATE INDEX idx_ad_campaigns_user   ON ad_campaigns(user_id);
CREATE INDEX idx_ad_campaigns_client ON ad_campaigns(client_id);
CREATE INDEX idx_ad_campaigns_campaign ON ad_campaigns(campaign_id);
```

**Finance link columns** (parallel to existing `campaign_id`):
```sql
ALTER TABLE transactions ADD COLUMN ad_id uuid REFERENCES ad_campaigns(id) ON DELETE SET NULL;
ALTER TABLE invoices     ADD COLUMN ad_id uuid REFERENCES ad_campaigns(id) ON DELETE SET NULL;
CREATE INDEX idx_transactions_ad ON transactions(ad_id);
CREATE INDEX idx_invoices_ad     ON invoices(ad_id);
```

**Gating flag** (mirrors `reports`, `finance_subscriptions`):
```sql
ALTER TABLE agency_subscriptions ADD COLUMN ads boolean DEFAULT false;
UPDATE agency_subscriptions SET ads = TRUE  WHERE plan_name IN ('trial','velocity','quantum');
UPDATE agency_subscriptions SET ads = FALSE WHERE plan_name = 'ignite';
```
> Also update `documentation/subscription-features.md` (feature matrix + DB flag table + all four Seed SQL blocks) so the `ads` flag is documented.

**RLS policies** (workspace-scoped via `get_my_agency_user_id()`, mirroring `campaigns`):
```sql
ALTER TABLE ad_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY ad_campaigns_select ON ad_campaigns FOR SELECT USING (user_id = get_my_agency_user_id());
CREATE POLICY ad_campaigns_insert ON ad_campaigns FOR INSERT WITH CHECK (user_id = get_my_agency_user_id());
CREATE POLICY ad_campaigns_update ON ad_campaigns FOR UPDATE USING (user_id = get_my_agency_user_id());
CREATE POLICY ad_campaigns_delete ON ad_campaigns FOR DELETE USING (user_id = get_my_agency_user_id());
```
> Verify the exact RLS helper/policy form against the live `campaigns` policies before applying.

**RPC `get_ads_with_summary(p_user_id uuid, p_client_id uuid DEFAULT NULL)`** — list with rollups (mirrors `get_campaigns_with_post_summary`). Returns each ad plus `client_name`, `client_logo_url`, `client_is_internal`, `total_spent` (Σ linked EXPENSE transactions), `total_billed` (Σ linked invoices where status in SENT/OVERDUE/PAID), `linked_campaign_name`.

**RPC `get_ad_analytics(p_ad_id uuid)`** — clone of `get_campaign_analytics`, returns the dual-sided superset:
```
budget          numeric   -- from ad_campaigns.budget
total_spent     numeric   -- Σ transactions.amount WHERE ad_id = p_ad_id AND type='EXPENSE'
total_billed    numeric   -- Σ invoices.total      WHERE ad_id = p_ad_id AND status IN ('SENT','OVERDUE','PAID')
total_collected numeric   -- Σ invoices.total      WHERE ad_id = p_ad_id AND status = 'PAID'
```
`STABLE SECURITY DEFINER`, same structure as `get_campaign_analytics`.

### 1.2 API Layer — `src/api/ads.js`
Mirror `src/api/campaigns.js` conventions exactly (query keys `['ads','list',{clientId}]`, `['ads','detail',id]`, `['ads','analytics',id]`; mutations as plain functions wrapped in `useMutation`; invalidate `['ads','list']`).

- `useAds({ clientId })` — list via `get_ads_with_summary`.
- `useAd(adId)` — single row + `clients(...)` join + optional linked campaign name.
- `useAdAnalytics(adId)` — `get_ad_analytics`, normalized to Numbers.
- `useCreateAd()` / `useUpdateAd()` / `useDeleteAd()` — CRUD (delete relies on `ON DELETE SET NULL` for finance links; archive = status `cancelled`/`completed`).
- `useAdTransactions(adId)` — `transactions` where `ad_id = adId` (clone of `useCampaignTransactions`; can live in `transactions.js` or `ads.js`).
- `useAdInvoices(adId)` — `invoices` where `ad_id = adId` (clone of `useCampaignInvoices`).
- `fetchActiveAdsByClient(clientId)` — plain async for dialog selects (clone of `fetchActiveCampaignsByClient`).

Constants → `src/lib/ads.js` (new): `AD_PLATFORMS`, `AD_TYPES`, `AD_STATUS_CONFIG` (colors/labels for badges), and a platform-icon helper.

### 1.3 Components
```
src/pages/ads/
  AdsPage.jsx          -- global /ads (wraps AdTab with no clientId; header + gating guard)
  AdDetailPage.jsx     -- /ads/:adId (mirror CampaignDetailPage: header, KPI StatBar,
                          Finance tab = dual budget/spend/billed cards + linked
                          transactions + linked invoices, Activity tab optional)
src/components/ads/
  AdTab.jsx            -- global list + per-client (clientId prop); search + status/platform filter
  AdCard.jsx           -- platform icon, name, type, status badge, budget vs spent bar, billed
  AdDialog.jsx         -- create/edit form (RHF + Zod): name, platform, ad_type, goal,
                          budget, status, start/end_date, notes, client (locked when clientId),
                          optional campaign select (fetchActiveCampaignsByClient)
```
- Dual-finance display on `AdDetailPage`: two cards side by side — **Spend** (budget vs `total_spent`, progress bar, "+ log spend" → `AddTransactionDialog` with `defaultAdId`) and **Billed** (`total_billed` / `total_collected`, "+ invoice" → `CreateInvoiceDialog` with `preselectedAdId`). Internal-account ads show the Spend card only.
- Empty states via `@/components/ui/empty` per the empty-states skill (emoji header, e.g. 📢).

### 1.4 Finance Dialog + Routing + Sidebar Integration
- **`AddTransactionDialog`**: add `defaultAdId` prop; lock the field when set; include `ad_id` in the create/update payload (parallel to `campaign_id`'s `'none'`-sentinel handling). Update `useCreateTransaction`/`useUpdateTransaction` in `src/api/transactions.js` to persist `ad_id`.
- **`CreateInvoiceDialog`**: add `preselectedAdId` prop → `adId` state → `ad_id` in payload (parallel to lines 61/119/243).
- **`App.jsx`**: import `AdsPage`, `AdDetailPage`; add `/ads` and `/ads/:adId` inside the protected group.
- **`nav-main.jsx`**: add an Ads nav item next to Campaigns with `requiresFlag: 'ads'`.
- **`ClientProfileView.jsx`**: add an "Ads" tab rendering `<AdTab clientId={clientId} />`.
- **`useSubscription.js`**: expose `ads: sub.ads ?? false`.

### 1.5 Impact on Existing Features
| Feature | Impact | Watch for |
|---|---|---|
| Transactions / Ledger | New nullable `ad_id` column | A transaction may carry both `campaign_id` and `ad_id`; existing queries unaffected (column is additive). |
| Invoices | New nullable `ad_id` column | Same — additive. `CreateInvoiceDialog` gains one optional prop. |
| AddTransactionDialog / CreateInvoiceDialog | New optional prop, locked field | Default behaviour unchanged when prop absent. |
| useSubscription | New `ads` flag | Ignite must resolve FALSE; confirm seed SQL ran. |
| Sidebar | New gated nav item | Hidden on Ignite via `requiresFlag`. |

### 1.6 What This Phase Does NOT Include
- Ads section in the client report PDF (Phase 2).
- Ad summary block on the organic campaign detail page (Phase 2).
- Any platform API / OAuth / auto spend import / performance metrics (Phase 3).
- Public/shareable ad review link (not planned — ads are internal-facing).
- Management-fee automation (handled as a normal invoice line item, manual).

### 1.7 Phase 1 Checklist — Before Marking Complete
- [ ] `ad_campaigns` table + 3 enums created with RLS policies matching `campaigns`.
- [ ] `transactions.ad_id` and `invoices.ad_id` columns + indexes added.
- [ ] `agency_subscriptions.ads` column added; Trial/Velocity/Quantum = TRUE, Ignite = FALSE.
- [ ] `get_ads_with_summary` and `get_ad_analytics` RPCs created and return correct rollups.
- [ ] `src/api/ads.js` created following `campaigns.js` conventions; `useAdTransactions`/`useAdInvoices` work.
- [ ] `AddTransactionDialog` accepts `defaultAdId`, locks the field, persists `ad_id`.
- [ ] `CreateInvoiceDialog` accepts `preselectedAdId`, persists `ad_id`.
- [ ] `/ads` global list and `/ads/:adId` detail page render; detail shows dual spend+billed finance.
- [ ] `AdTab` works both globally (no `clientId`) and inside the client profile (`clientId`).
- [ ] Sidebar Ads item appears for Trial/Velocity/Quantum and is hidden for Ignite.
- [ ] `useSubscription().ads` returns the correct boolean per plan.
- [ ] `documentation/subscription-features.md` updated with the `ads` flag.
- [ ] Create / edit / archive an ad; log a spend transaction; link an invoice — all reflect in the budget tracker.

**→ Stop here. Show the result and wait for approval.**

---

## Phase 2 — Reporting

### Goal
Paid media appears in client-facing reporting. The client report PDF gains an Ads section (count of active ads, total spend, total billed, broken down per platform), and an organic campaign that has linked ads shows a paid-media summary on its detail page.

### Before Starting — Confirm Phase 1 is Approved
1. `src/components/campaigns/CampaignReportPDF.jsx` and the report generation in `src/pages/reports/` — how sections are composed with `@react-pdf/renderer`.
2. `CampaignDetailPage.jsx` — where to slot an "Ads linked to this campaign" summary (reads `ad_campaigns` where `campaign_id = :campaignId`).

### 2.1 Database
- Possibly one aggregation RPC `get_client_ads_summary(p_client_id)` returning per-platform spend/billed/active-count for the PDF. Otherwise compute client-side from `useAds({ clientId })`.

### 2.2 Components
- Ads section block in the client report PDF.
- "Paid Media" summary card on `CampaignDetailPage` when `ad_campaigns` link to that campaign (count, total spend, total billed, list with links to `/ads/:adId`).

### 2.3 Checklist
- [ ] Client report PDF renders an Ads section with per-platform spend/billed when ads exist; omitted when none.
- [ ] Campaign detail shows a paid-media summary only when ads are linked.
- [ ] Both gated behind the `ads` flag.

**→ Stop here. Show the result and wait for approval.**

---

## Phase 3 — Auto (Deferred)

Depends on the OAuth social-publishing work (listed in `subscription-features.md` Phase 2 features). Pulls spend and performance metrics (impressions, clicks, CTR, ROAS) from Meta Ads / Google Ads / LinkedIn Campaign Manager and auto-creates expense transactions tagged with `ad_id`. **Not scoped now** — revisit once OAuth infrastructure exists. Quantum-only when live.

---

## Data Model Summary (Final State After All Phases)

```
agency (workspace owner: user_id)
└── clients
    ├── campaigns ............ organic initiatives (existing)
    │     └── posts/post_versions
    └── ad_campaigns ......... paid media (NEW)
          ├── campaign_id ......... optional link → campaigns (contextual only)
          ├── transactions (ad_id) . spend the agency paid the platform (EXPENSE)
          └── invoices (ad_id) ..... amounts billed back to the client
```

### `ad_campaigns` — Schema
| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `user_id` | uuid | RLS scope (workspace owner) |
| `client_id` | uuid | FK → clients, ON DELETE CASCADE, required |
| `campaign_id` | uuid | FK → campaigns, ON DELETE SET NULL, optional |
| `name` | text | required |
| `platform` | ad_platform | meta/google/linkedin/youtube/tiktok/other |
| `ad_type` | ad_type | awareness/retargeting/lead_gen/conversion/engagement/other |
| `goal` | text | free text |
| `budget` | numeric | nullable (uncapped if null) |
| `status` | ad_status | draft/active/paused/completed/cancelled |
| `start_date` / `end_date` | date | nullable |
| `notes` | text | nullable |
| `created_at` / `updated_at` | timestamptz | |

### Added columns
| Table | Column | Type | Notes |
|---|---|---|---|
| `transactions` | `ad_id` | uuid | FK → ad_campaigns, ON DELETE SET NULL |
| `invoices` | `ad_id` | uuid | FK → ad_campaigns, ON DELETE SET NULL |
| `agency_subscriptions` | `ads` | boolean | gating flag, default false |

### Storage Bucket
None — Ads has no file uploads in any phase.

---

## Impact on Existing Features
| Existing Feature | Impact | Action Required |
|---|---|---|
| Transactions / Invoices | Additive nullable `ad_id` column | None to existing queries; dialogs gain one optional prop each |
| Finance dialogs | New `defaultAdId` / `preselectedAdId` props | Default behaviour unchanged when absent |
| useSubscription | New `ads` flag | Expose `ads`; ensure Ignite = FALSE |
| Sidebar | New gated nav item | `requiresFlag: 'ads'` |
| Client profile | New "Ads" tab | Mount `<AdTab clientId>` |
| subscription-features.md | New flag row | Update matrix + seed SQL |

---

## Out of Scope (All Phases)
- Public/shareable ad review link — ads are internal-facing, not client-approval artifacts.
- Billing inheritance from a linked organic campaign — billing is always handled at the ad level; the `campaign_id` link is contextual only.
- Management-fee automation — entered manually as an invoice line item.
- Platform OAuth, auto spend import, and performance metrics — Phase 3, gated on the OAuth publishing build.
- The "My Organization" sidebar-group restructure — belongs to the Partnerships feature, not Ads.
```