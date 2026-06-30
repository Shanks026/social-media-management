# Subscription Features — Phase 2

Last updated: June 2026

Supersedes `subscription-features.md`. Effective after Phase 2 implementation: RBAC, Tasks, and Notes visibility are live.

---

## What Changed from Phase 1

| | Phase 1 | Phase 2 |
|---|---|---|
| Ignite price | ₹1,999/mo | ₹2,499/mo |
| Velocity price | ₹4,999/mo | ₹5,499/mo |
| Quantum price | ₹12,999/mo | Custom |
| Ignite clients | 5 | 8 |
| Velocity clients | 15 | 20 |
| Quantum clients | 30 | Unlimited |
| Ignite storage | 20 GB | 50 GB |
| Velocity storage | 100 GB | 200 GB |
| Quantum storage | 300 GB | 500 GB base |
| Ignite seats | 2 | 5 |
| Velocity seats | 5 | 10 |
| Quantum seats | Unlimited | 15 base + negotiable |
| Ignite proposals | 5 active | 10 active |
| Trial mirrors | Quantum | Velocity |
| Extra seat overage | — | ₹399/mo (Ignite), ₹499/mo (Velocity) |
| RBAC | Not implemented | Full — all tiers |
| Tasks | Not implemented | Personal (Ignite), Team (Velocity+) |
| Notes visibility | Not implemented | Private / team toggle — all tiers |

---

## Plan Overview

| | Ignite | Velocity | Quantum |
|---|---|---|---|
| **Price** | ₹2,499 / mo | ₹5,499 / mo | Custom |
| **Clients** | Up to 8 | Up to 20 | Unlimited |
| **Team seats** | 5 included | 10 included | 15 included |
| **Storage** | 50 GB | 200 GB | 500 GB base |
| **Extra client** | ₹500 / client | ₹500 / client | By arrangement |
| **Extra seat** | ₹399 / seat | ₹499 / seat | By arrangement |
| **Support** | Email | Priority Chat | VIP / Dedicated |
| **Trial** | 14-day full access (mirrors Velocity) | — | — |

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
| Proposals | 10 active | Unlimited | Unlimited |
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
| Confidential document protection | ✓ | ✓ | ✓ |
| Document collections (folders) | ✗ | ✓ | ✓ |

### Teams & RBAC

| Feature | Ignite | Velocity | Quantum |
|---|:---:|:---:|:---:|
| Team seats (included) | 5 | 10 | 15 base |
| Invite via link | ✓ | ✓ | ✓ |
| Role-based access (admin / member) | ✓ | ✓ | ✓ |
| Finance access toggle per member | ✓ | ✓ | ✓ |
| Documents access level per member | ✓ | ✓ | ✓ |
| Functional role badges | ✓ | ✓ | ✓ |
| Admin assigns roles at invite time | ✓ | ✓ | ✓ |

### Tasks

| Feature | Ignite | Velocity | Quantum |
|---|:---:|:---:|:---:|
| Personal tasks (self-assigned) | ✓ | ✓ | ✓ |
| Assign tasks to team members | ✗ | ✓ | ✓ |
| Admin / owner view all workspace tasks | ✗ | ✓ | ✓ |
| Filter by assignee, client, status | ✗ | ✓ | ✓ |
| Client & campaign scoped tasks | ✓ | ✓ | ✓ |

### Notes

| Feature | Ignite | Velocity | Quantum |
|---|:---:|:---:|:---:|
| Notes (client, campaign, personal) | ✓ | ✓ | ✓ |
| Private / team visibility toggle | ✓ | ✓ | ✓ |
| No note count cap | ✓ | ✓ | ✓ |

### Branding & Whitelabel

| Feature | Ignite | Velocity | Quantum |
|---|:---:|:---:|:---:|
| Tercero logo in sidebar | ✓ | ✗ | ✗ |
| Agency logo & name in sidebar | ✗ | ✓ | ✓ |
| "Powered by Tercero" on public pages | ✓ | ✓ | ✗ |
| Full whitelabel (no Tercero attribution) | ✗ | ✗ | ✓ |

---

## DB Flag Values per Plan

> New flag: `tasks_team` — controls team task assignment and admin task visibility.

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
| `tasks_team` | TRUE | FALSE | TRUE | TRUE |

## DB Limit Values per Plan

> New column: `extra_seat_price_inr` — overage price per team member beyond the included count.

| Column | Trial | Ignite | Velocity | Quantum |
|---|:---:|:---:|:---:|:---:|
| `max_clients` | 20 | 8 | 20 | null |
| `max_storage_bytes` | 214,748,364,800 | 53,687,091,200 | 214,748,364,800 | 536,870,912,000 |
| `max_team_members` | null | 5 | 10 | 15 |
| `proposals_limit` | null | 10 | null | null |
| `extra_client_price_inr` | null | 500 | 500 | null |
| `extra_seat_price_inr` | null | 399 | 499 | null |

> `campaigns_limit` is not a DB column — derived in `useSubscription.js` from `plan_name`: `ignite` → 5, all other plans → null (unlimited).

> `max_team_members` for Quantum is 15 (base included). Additional seats are negotiated in the custom agreement and updated manually.

---

## Storage Reference

| Plan | GB | Bytes |
|---|---|---|
| Ignite | 50 GB | 53,687,091,200 |
| Velocity / Trial | 200 GB | 214,748,364,800 |
| Quantum | 500 GB | 536,870,912,000 |

---

## Overage Pricing

Overages apply when a workspace exceeds the included limit. Charged per unit per month on top of the base plan fee.

| Overage type | Ignite | Velocity | Quantum |
|---|---|---|---|
| Extra client | ₹500/mo | ₹500/mo | By arrangement |
| Extra team seat | ₹399/mo | ₹499/mo | By arrangement |

**Natural upgrade nudge:** An Ignite workspace with 9 team members pays ₹2,499 + (4 × ₹399) = ₹4,095 — close enough to Velocity (₹5,499) that upgrading becomes the sensible choice, especially when they also need team tasks and advanced finance features.

---

## Upgrade Triggers

- **Ignite → Velocity**: Hit the 8-client cap, overage seats accumulating, need team task assignment, want recurring invoices or accrual accounting, need calendar PDF export, need document collections, want agency branding on client-facing pages.
- **Velocity → Quantum**: Need full whitelabel (remove Tercero branding entirely), scaling past 20 clients, need more than 10 base seats, need VIP support and dedicated onboarding.

---

## Seed SQL

> Run these from the admin portal when setting a plan. Requires `tasks_team` and `extra_seat_price_inr` columns to exist on `agency_subscriptions` — add them as part of the Tasks feature DB migration.

```sql
-- TRIAL (mirrors Velocity — full feature access, time-limited via trial_ends_at)
UPDATE agency_subscriptions SET
  plan_name                  = 'trial',
  reports                    = TRUE,
  max_clients                = 20,
  max_storage_bytes          = 214748364800,
  branding_agency_sidebar    = TRUE,
  branding_powered_by        = FALSE,
  finance_recurring_invoices = TRUE,
  finance_subscriptions      = TRUE,
  finance_accrual            = TRUE,
  calendar_export            = TRUE,
  documents_collections      = TRUE,
  campaigns                  = TRUE,
  tasks_team                 = TRUE,
  proposals_limit            = NULL,
  max_team_members           = NULL,
  extra_client_price_inr     = NULL,
  extra_seat_price_inr       = NULL
WHERE user_id = $1;

-- IGNITE
UPDATE agency_subscriptions SET
  plan_name                  = 'ignite',
  reports                    = FALSE,
  max_clients                = 8,
  max_storage_bytes          = 53687091200,
  branding_agency_sidebar    = FALSE,
  branding_powered_by        = TRUE,
  finance_recurring_invoices = FALSE,
  finance_subscriptions      = FALSE,
  finance_accrual            = FALSE,
  calendar_export            = FALSE,
  documents_collections      = FALSE,
  campaigns                  = TRUE,
  tasks_team                 = FALSE,
  proposals_limit            = 10,
  max_team_members           = 5,
  extra_client_price_inr     = 500,
  extra_seat_price_inr       = 399
WHERE user_id = $1;

-- VELOCITY
UPDATE agency_subscriptions SET
  plan_name                  = 'velocity',
  reports                    = TRUE,
  max_clients                = 20,
  max_storage_bytes          = 214748364800,
  branding_agency_sidebar    = TRUE,
  branding_powered_by        = TRUE,
  finance_recurring_invoices = TRUE,
  finance_subscriptions      = TRUE,
  finance_accrual            = TRUE,
  calendar_export            = TRUE,
  documents_collections      = TRUE,
  campaigns                  = TRUE,
  tasks_team                 = TRUE,
  proposals_limit            = NULL,
  max_team_members           = 10,
  extra_client_price_inr     = 500,
  extra_seat_price_inr       = 499
WHERE user_id = $1;

-- QUANTUM (base — adjust limits per custom agreement)
UPDATE agency_subscriptions SET
  plan_name                  = 'quantum',
  reports                    = TRUE,
  max_clients                = NULL,
  max_storage_bytes          = 536870912000,
  branding_agency_sidebar    = TRUE,
  branding_powered_by        = FALSE,
  finance_recurring_invoices = TRUE,
  finance_subscriptions      = TRUE,
  finance_accrual            = TRUE,
  calendar_export            = TRUE,
  documents_collections      = TRUE,
  campaigns                  = TRUE,
  tasks_team                 = TRUE,
  proposals_limit            = NULL,
  max_team_members           = 15,
  extra_client_price_inr     = NULL,
  extra_seat_price_inr       = NULL
WHERE user_id = $1;
```

---

## Planned Features (post Phase 2)

| Feature | Target Tier |
|---|---|
| OAuth social publishing (Instagram, LinkedIn, X) | Velocity+ |
| WhatsApp integration (replaces email notifications) | Velocity+ |
| Client portal (branded client-facing workspace) | Velocity+ |
| Activity logs (team audit trail) | Velocity+ |
| Notes sharing (invite specific members to view / edit) | All tiers |
