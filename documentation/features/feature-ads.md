# Feature: Ads Management

## Purpose

Tercero currently tracks organic work — posts, campaigns, approvals. Most agencies also run paid media for clients, and that work is invisible in the app today. Ad spend gets buried in the general ledger with no context, and the client report shows nothing about paid campaigns running in parallel.

The Ads module makes paid media a first-class part of the agency workflow. An agency should be able to see, per client, every paid campaign running, what it's costing, and what they've billed for it — all in one place.

Without it, paid media work exists entirely outside Tercero.

---

## Where it lives

- **Global list:** `/ads` — all ad campaigns across all clients
- **Per-client:** `AdTab` inside the client profile (same pattern as Campaigns and Documents tabs)
- **Linked to campaigns:** optionally attach an ad to an organic campaign

---

## Data Model

```
ad_campaigns
  id
  client_id
  campaign_id (optional — link to an organic campaign)
  name
  platform: meta | google | linkedin | youtube | tiktok | other
  ad_type: awareness | retargeting | lead_gen | conversion | engagement | other
  goal (free text)
  budget
  status: draft | active | paused | completed | cancelled
  start_date
  end_date
  notes

  → linked expense transactions (ad spend paid out by agency)
  → linked invoices (billed back to client)
```

---

## Finance Integration

Ads do not introduce a new finance system. They sit on top of what already exists:

| Money movement | How it's handled |
|---|---|
| Agency pays ad platform | Expense transaction in ledger, tagged to the ad |
| Agency bills client for spend | Invoice line item, linked to the ad record |
| Management fee | Additional invoice line item |

The `AddTransactionDialog` and `CreateInvoiceDialog` are reused — they just gain an optional ad association.

---

## What the Agency Sees

**Ad list (per client or global)**
- Platform icon, ad name, type, status badge
- Budget vs total spent (sum of linked expense transactions)
- Total billed (sum of linked invoice amounts)
- Date range

**Ad detail / drawer**
- All fields editable
- Linked transactions — log spend directly from here
- Linked invoices — create or link an invoice
- Budget progress bar (spend vs budget)

**Client report PDF**
- Ads section: count of active ads, total spend, total billed per platform

---

## Phases

### Phase 1 — Core
- Ad CRUD (create, edit, archive)
- Link to client and optionally to campaign
- Log expense transactions against an ad
- Link invoices to an ad
- Budget vs spend tracker
- Global ads list + per-client `AdTab`

### Phase 2 — Reporting
- Ads section in the client report PDF
- Summary stats on campaign detail page if ads are linked

### Phase 3 — Auto (depends on OAuth publishing)
- Pull spend data automatically from Meta Ads API, Google Ads API, LinkedIn Campaign Manager
- Auto-create expense transactions from platform data
- Performance metrics (impressions, clicks, CTR, ROAS)

---

## Subscription Gating

| Plan | Access |
|---|---|
| Trial | Full (mirrors Quantum — 14 day window) |
| Ignite | Basic (Phase 1) |
| Velocity | Full (Phase 1 + 2) |
| Quantum | Full + Phase 3 when live |
