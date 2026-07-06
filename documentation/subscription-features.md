# Subscription Features

Last updated: June 2026

---

## Plan Overview

| | Ignite | Velocity | Quantum |
|---|---|---|---|
| **Price** | ₹1,999 / mo | ₹4,999 / mo | ₹12,999 / mo |
| **Clients** | Up to 5 | Up to 15 | Up to 30 |
| **Storage** | 20 GB | 100 GB | 300 GB |
| **Extra Client** | ₹500 / client | ₹500 / client | ₹500 / client |
| **Support** | Email | Priority Chat | VIP Concierge |
| **Trial** | 14-day full access (mirrors Quantum) | — | — |

---

## Feature Matrix

### Client & Content Management

| Feature | Ignite | Velocity | Quantum |
|---|:---:|:---:|:---:|
| Client management | ✓ | ✓ | ✓ |
| Internal workspace account | ✓ | ✓ | ✓ |
| Post creation & workflow | ✓ | ✓ | ✓ |
| Post versioning & history | ✓ | ✓ | ✓ |
| Platform previews (IG, LinkedIn, X, YouTube) | ✓ | ✓ | ✓ |
| Media upload | ✓ | ✓ | ✓ |
| Public client review link | ✓ | ✓ | ✓ |
| Content calendar (month & week view) | ✓ | ✓ | ✓ |
| Calendar PDF export | ✗ | ✓ | ✓ |
| Campaigns | Up to 5 | Unlimited | Unlimited |

### Prospects & Proposals

| Feature | Ignite | Velocity | Quantum |
|---|:---:|:---:|:---:|
| Prospects CRM | ✓ | ✓ | ✓ |
| CSV import (Apollo, Google Maps, etc.) | ✓ | ✓ | ✓ |
| Follow-up scheduling | ✓ | ✓ | ✓ |
| Prospect → Client conversion | ✓ | ✓ | ✓ |
| Proposals | 5 active | Unlimited | Unlimited |
| Proposal PDF export | ✓ | ✓ | ✓ |
| Upload existing PDF proposal | ✓ | ✓ | ✓ |
| Public proposal review link | ✓ | ✓ | ✓ |
| Client accept / decline flow | ✓ | ✓ | ✓ |

### Finance

| Feature | Ignite | Velocity | Quantum |
|---|:---:|:---:|:---:|
| Invoicing (create, send, PDF export) | ✓ | ✓ | ✓ |
| Invoice status workflow | ✓ | ✓ | ✓ |
| Expense & transaction ledger | ✓ | ✓ | ✓ |
| Finance overview dashboard | ✓ | ✓ | ✓ |
| Recurring invoice templates | ✗ | ✓ | ✓ |
| Expense subscription tracking | ✗ | ✓ | ✓ |
| Accrual accounting toggle | ✗ | ✓ | ✓ |
| Client report generation (Reports) | ✗ | ✓ | ✓ |

### Documents

| Feature | Ignite | Velocity | Quantum |
|---|:---:|:---:|:---:|
| Upload, view, download documents | ✓ | ✓ | ✓ |
| Document categories & archiving | ✓ | ✓ | ✓ |
| Document collections (folders) | ✗ | ✓ | ✓ |

### Teams

| Feature | Ignite | Velocity | Quantum |
|---|:---:|:---:|:---:|
| Team seats | 2 | 5 | Unlimited |
| Invite via link | ✓ | ✓ | ✓ |
| Full workspace access for members | ✓ | ✓ | ✓ |
| Workspace chat (team channel + DMs) | ✗ | ✓ | ✓ |

### Branding & Whitelabel

| Feature | Ignite | Velocity | Quantum |
|---|:---:|:---:|:---:|
| Tercero logo in sidebar | ✓ | ✗ | ✗ |
| Agency logo & name in sidebar | ✗ | ✓ | ✓ |
| "Powered by Tercero" on public pages | ✓ | ✓ | ✗ |
| Full whitelabel (no Tercero attribution) | ✗ | ✗ | ✓ |

---

## DB Flag Values per Plan

| Flag | Trial | Ignite | Velocity | Quantum |
|---|:---:|:---:|:---:|:---:|
| `branding_agency_sidebar` | TRUE | FALSE | TRUE | TRUE |
| `branding_powered_by` | FALSE | TRUE | TRUE | FALSE |
| `finance_recurring_invoices` | TRUE | FALSE | TRUE | TRUE |
| `finance_subscriptions` | TRUE | FALSE | TRUE | TRUE |
| `finance_accrual` | TRUE | FALSE | TRUE | TRUE |
| `calendar_export` | TRUE | FALSE | TRUE | TRUE |
| `documents_collections` | TRUE | FALSE | TRUE | TRUE |
| `reports` | TRUE | FALSE | TRUE | TRUE |
| `campaigns` | TRUE | TRUE | TRUE | TRUE |
| `chat` | TRUE | FALSE | TRUE | TRUE |

## DB Limit Values per Plan

| Column | Trial | Ignite | Velocity | Quantum |
|---|:---:|:---:|:---:|:---:|
| `max_clients` | 30 | 5 | 15 | 30 |
| `max_storage_bytes` | 322,122,547,200 | 21,474,836,480 | 107,374,182,400 | 322,122,547,200 |
| `max_team_members` | null | 2 | 5 | null |
| `proposals_limit` | null | 5 | null | null |
| `extra_client_price_inr` | null | 500 | 500 | 500 |

> `campaigns_limit` is not a DB column — it is derived in `useSubscription.js` from `plan_name`:
> `ignite` → 5, all other plans → null (unlimited).

---

## Storage Reference

| Plan | GB | Bytes |
|---|---|---|
| Ignite | 20 GB | 21,474,836,480 |
| Velocity | 100 GB | 107,374,182,400 |
| Quantum / Trial | 300 GB | 322,122,547,200 |

---

## Upgrade Triggers (natural pain points per tier)

- **Ignite → Velocity**: Hit the 5-client cap, need campaigns beyond 5, want recurring invoices or accrual accounting, need more team seats, want agency branding on client-facing pages.
- **Velocity → Quantum**: Need full whitelabel (remove Tercero branding), scaling past 15 clients, need VIP support.

---

## Seed SQL

Run these when setting a plan from the admin portal.

```sql
-- TRIAL (mirrors Quantum — full access, time-limited via trial_ends_at)
UPDATE agency_subscriptions SET
  plan_name                  = 'trial',
  reports                    = TRUE,
  max_clients                = 30,
  max_storage_bytes          = 322122547200,
  branding_agency_sidebar    = TRUE,
  branding_powered_by        = FALSE,
  finance_recurring_invoices = TRUE,
  finance_subscriptions      = TRUE,
  finance_accrual            = TRUE,
  calendar_export            = TRUE,
  documents_collections      = TRUE,
  campaigns                  = TRUE,
  chat                       = TRUE,
  proposals_limit            = NULL,
  max_team_members           = NULL
WHERE user_id = $1;

-- IGNITE
UPDATE agency_subscriptions SET
  plan_name                  = 'ignite',
  reports                    = FALSE,
  max_clients                = 5,
  max_storage_bytes          = 21474836480,
  extra_client_price_inr     = 500,
  branding_agency_sidebar    = FALSE,
  branding_powered_by        = TRUE,
  finance_recurring_invoices = FALSE,
  finance_subscriptions      = FALSE,
  finance_accrual            = FALSE,
  calendar_export            = FALSE,
  documents_collections      = FALSE,
  campaigns                  = TRUE,
  chat                       = FALSE,
  proposals_limit            = 5,
  max_team_members           = 2
WHERE user_id = $1;

-- VELOCITY
UPDATE agency_subscriptions SET
  plan_name                  = 'velocity',
  reports                    = TRUE,
  max_clients                = 15,
  max_storage_bytes          = 107374182400,
  extra_client_price_inr     = 500,
  branding_agency_sidebar    = TRUE,
  branding_powered_by        = TRUE,
  finance_recurring_invoices = TRUE,
  finance_subscriptions      = TRUE,
  finance_accrual            = TRUE,
  calendar_export            = TRUE,
  documents_collections      = TRUE,
  campaigns                  = TRUE,
  chat                       = TRUE,
  proposals_limit            = NULL,
  max_team_members           = 5
WHERE user_id = $1;

-- QUANTUM
UPDATE agency_subscriptions SET
  plan_name                  = 'quantum',
  reports                    = TRUE,
  max_clients                = 30,
  max_storage_bytes          = 322122547200,
  extra_client_price_inr     = 500,
  branding_agency_sidebar    = TRUE,
  branding_powered_by        = FALSE,
  finance_recurring_invoices = TRUE,
  finance_subscriptions      = TRUE,
  finance_accrual            = TRUE,
  calendar_export            = TRUE,
  documents_collections      = TRUE,
  campaigns                  = TRUE,
  chat                       = TRUE,
  proposals_limit            = NULL,
  max_team_members           = NULL
WHERE user_id = $1;
```

---

## Phase 2 Planned Features (post-launch)

These features are planned after reaching the first 5 clients and will slot into existing tiers:

| Feature | Target Tier |
|---|---|
| OAuth social publishing (Instagram, LinkedIn, X) | Velocity+ |
| WhatsApp integration (replaces email notifications) | Velocity+ |
| Client portal (branded client-facing workspace) | Velocity+ |
| Deep team management (roles, permissions, activity logs) | Quantum |
