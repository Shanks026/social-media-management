# Subscription Features — Phase 2 (Revised)

Last updated: July 2026

**Supersedes both `subscription-features.md` (Phase 1) and the earlier Phase-2 draft.** This is the single source of truth for tier pricing, limits, and feature gating. Reflects the post-Phase-2 product: RBAC, Tasks (fully ungated), the collaboration layer (notifications + comments), and the proposals request-changes flow are all live.

> **Positioning shift:** Ignite is now for **freelancers *and* small agencies** (3–8 clients, small team), not freelancers alone. Consequently, **team collaboration is not a paywall** — Ignite serves teams, so the paywall moved to *capacity* (clients, seats, storage) and *operational sophistication* (advanced finance, branding, reports). Team features (task assignment, comments, notifications) are unlocked on every tier.

---

## Implementation Deltas — ✅ DONE in the main Tercero app (this repo)

1. ✅ **New DB column** `extra_seat_price_inr integer` added to `agency_subscriptions`.
2. ✅ **`planMeta.js`** — plan cards updated: new limits/storage/seats, **Quantum → "Custom"** (no fixed price).
3. ✅ **`useSubscription.js`** — derived `campaigns_limit` bumped: `plan_name === 'ignite' ? 8 : null` (was `5`).
4. ✅ **Seed correction** — the 2 live trial accounts were wrong (30 clients / 100 GB / `extra_client_price_inr` 499). Corrected to the Trial spec below (unlimited clients / 200 GB / no overage pricing). The actual root cause — the `handle_new_user_subscription()` signup trigger — was also fixed, since patching only the 2 existing rows would have left every *future* signup mis-seeded the same way.
5. ✅ **`tasks_team` was NOT added.** We do not gate team tasks, so an always-TRUE flag would be dead weight. No flag, no gate.
6. ✅ **`campaigns` boolean left as deprecated/ignored** — `useSubscription.js` hardcodes `campaigns: true`; access is universal and only the *count* is capped (via `campaigns_limit`, derived from `plan_name`).
7. ✅ **Null-safety hardening (unplanned but required):** setting `max_clients = NULL` for Quantum/Trial (unlimited) exposed 3 latent bugs where code compared/divided against `max_clients` without a null guard — `count >= null` coerces `null` to `0` in JS, which would have made `is_client_limit_reached` true for *any* client count on an unlimited plan. Fixed in `useSubscription.js` (`is_client_limit_reached`), `UsageTab.jsx` (client-capacity card — now shows "∞" / "Unlimited"), and `sidebar-sub-card.jsx` (usage widget — 3 separate spots). Also fixed two now-mismatched `₹{price}/mo` string interpolations in `TertiarySubscriptionTab.jsx` (the plan card and the upgrade-request email body) to handle Quantum's `"Custom"` price correctly.

Verified: `npm run build` succeeds; `npm test` shows the same 38 pre-existing failures with or without these changes (confirmed via `git stash`) — nothing in this change introduced a regression.

---

## Handoff Prompt — Admin Portal (separate project)

The Tercero admin portal that agency staff use to set a workspace's plan lives in a **separate codebase** ("admin-tercero"), not this repo. It writes to the same shared Supabase `agency_subscriptions` table, so its own plan-setting logic/UI needs updating to match everything above. **Copy the prompt below into a Claude session running in that project:**

> We just revised Tercero's subscription pricing/gating model. The canonical spec is `documentation/subscription-features-phase2.md` in the main Tercero repo (paste its full contents into this conversation if you can't access that repo directly — the key facts are summarized below). Please:
>
> 1. **Find where this admin portal sets/edits a workspace's plan** (likely a form or action that writes `plan_name` + limit/flag columns to `agency_subscriptions` for a given `user_id`).
> 2. **Update the per-plan values it applies** to match the new spec:
>    - **Ignite** (₹1,999/mo): `max_clients=8`, `max_storage_bytes=53687091200` (50GB), `max_team_members=4`, `proposals_limit=10`, `extra_client_price_inr=500`, `extra_seat_price_inr=399`, `campaigns=TRUE` (informational only — count-capping is client-side at 8), finance/branding/reports/calendar_export/documents_collections flags = `FALSE`.
>    - **Velocity** (₹4,999/mo): `max_clients=20`, `max_storage_bytes=214748364800` (200GB), `max_team_members=10`, `proposals_limit=NULL` (unlimited), `extra_client_price_inr=500`, `extra_seat_price_inr=399` (same flat rate as Ignite — deliberately not tiered), all finance/branding/reports/calendar_export/documents_collections flags = `TRUE`, `branding_powered_by=TRUE` (still shows "Powered by Tercero").
>    - **Quantum** (Custom pricing — no fixed price): `max_clients=NULL`, `max_storage_bytes=536870912000` (500GB base, adjust per deal), `max_team_members=NULL`, `proposals_limit=NULL`, `extra_client_price_inr=NULL`, `extra_seat_price_inr=NULL`, all feature flags = `TRUE` except `branding_powered_by=FALSE` (full whitelabel).
>    - **Trial** (14 days, mirrors Quantum): `max_clients=NULL`, `max_storage_bytes=214748364800` (200GB cap — the one deliberate limit), `max_team_members=NULL`, `proposals_limit=NULL`, `extra_client_price_inr=NULL`, `extra_seat_price_inr=NULL`, all feature flags = `TRUE` except `branding_powered_by=FALSE`.
> 3. **A new column `extra_seat_price_inr integer` now exists** on `agency_subscriptions` (already migrated in the shared DB — don't re-run any schema migration, just start reading/writing it wherever seat-overage pricing is set or displayed).
> 4. **Do NOT add a `tasks_team` column/flag** — team task assignment is intentionally ungated on every tier now.
> 5. **Quantum has no fixed price** — if this portal displays/stores a numeric price for Quantum anywhere (e.g. an invoice line, a plan-comparison table), it needs to either show "Custom" or read from a per-workspace negotiated value instead of a constant.
> 6. **Client/seat/storage limits are validated null-safely** — if this portal ever does `count >= max_clients`-style comparisons for Quantum/Trial (which now legitimately have `max_clients = NULL` for "unlimited"), guard with a null check first — `null` coerces to `0` in JS numeric comparisons, so `count >= null` is `true` for any positive count, which would incorrectly flag an unlimited plan as "over limit." We hit exactly this bug in the main app and had to patch 3 separate call sites.
>
> Full context, all seed SQL, and the reasoning behind each gating decision is in `documentation/subscription-features-phase2.md`.

### Follow-up Handoff Prompt — `chat` flag (paste separately)

A `chat` boolean column was added to `agency_subscriptions` after the above revision and was never included in this portal's plan-setting logic, since it didn't exist yet when that logic was written. It also turned out to be enforced only in the main app's UI, not the database — since fixed on the main-app side (see below), but the admin portal's plan-setting code needs the same update or it will keep writing rows with a stale/missing `chat` value. **Copy the prompt below into a Claude session running in the admin portal project:**

> Tercero's `agency_subscriptions` table has a `chat` boolean column (workspace chat feature — a shared team channel plus 1:1 DMs) that this admin portal's plan-setting logic doesn't know about yet. Please:
>
> 1. **Find the same plan-setting code you updated for the Phase 2 pricing revision** (the form/action that writes `plan_name` + flag columns to `agency_subscriptions`).
> 2. **Add `chat` to the values it writes per plan**, following the exact same Trial-mirrors-Quantum pattern already used for `campaigns`/`finance_*`/`calendar_export`/`documents_collections`/`branding_agency_sidebar`: `chat = TRUE` for Trial, Velocity, and Quantum; `chat = FALSE` for Ignite.
> 3. **This is now enforced in the database, not just the main app's UI** — `ensure_workspace_channel()`, `get_or_create_dm_channel()`, and the `chat_messages` insert RLS policy all now call a new `is_chat_enabled_for_workspace()` helper that reads the `chat` column directly. This means `chat` is a genuine access gate now, not cosmetic — getting it wrong on a plan change actually breaks or unlocks the feature for that workspace, not just the sidebar nav item.
> 4. **`chat` is an independent, override-capable flag** — same as every other feature boolean on this table. If this portal has (or gets) a way to toggle individual feature flags per workspace outside the plan-preset buttons (e.g. a raw field editor, a "grant this feature as a one-off" action), `chat` should be editable there too, and that path should NOT get silently overwritten by whatever "apply plan defaults" action exists — a manual grant/revoke should stick until someone explicitly changes it again.
> 5. **No schema migration needed** — the `chat` column already exists in the shared Supabase database; this is purely an update to what values this portal writes to it.
>
> Reference: `documentation/subscription-features-phase2.md`'s "DB Flag Values per Plan" table and Seed SQL blocks in the main Tercero repo now include `chat` alongside every other flag — copy its values exactly rather than re-deriving them.

---

## What Changed from Live (Phase 1)

| | Live (Phase 1) | Now (Phase 2 Revised) |
|---|---|---|
| Ignite price | ₹1,999/mo | ₹1,999/mo (unchanged) |
| Velocity price | ₹4,999/mo | ₹4,999/mo (unchanged) |
| Quantum price | ₹12,999/mo | **Custom** |
| Ignite clients | 5 | **8** |
| Velocity clients | 15 | **20** |
| Quantum clients | 30 | **Unlimited** |
| Ignite storage | 20 GB | **50 GB** |
| Velocity storage | 100 GB | **200 GB** |
| Quantum storage | 300 GB | **500 GB base (custom)** |
| Ignite seats | 2 | **4** |
| Velocity seats | 5 | **10** |
| Quantum seats | Unlimited | Unlimited (unchanged) |
| Ignite proposals | 5 | **10** |
| Ignite campaigns | 5 | **8** |
| Seat overage | — | **₹399 flat (Ignite & Velocity)** |
| Trial storage | 100 GB (misconfigured) | **200 GB** (Quantum-mirror, storage-capped) |
| Team task assignment | ungated | ungated (unchanged — now intentional) |
| Collaboration (comments/notifications) | ungated | ungated (unchanged) |

---

## Plan Overview

| | Ignite | Velocity | Quantum | Trial |
|---|---|---|---|---|
| **Best for** | Freelancers & small teams | Growing agencies | Scaling firms & enterprises | Evaluating Tercero |
| **Price** | ₹1,999 / mo | ₹4,999 / mo | Custom | Free, 14 days |
| **Clients** | Up to 8 | Up to 20 | Unlimited | Unlimited |
| **Team seats** | 4 included | 10 included | Unlimited | Unlimited |
| **Storage** | 50 GB | 200 GB | 500 GB base | 200 GB |
| **Proposals** | 10 active | Unlimited | Unlimited | Unlimited |
| **Campaigns** | 8 | Unlimited | Unlimited | Unlimited |
| **Extra client** | ₹500 / client | ₹500 / client | By arrangement | — |
| **Extra seat** | ₹399 / seat | ₹399 / seat | By arrangement | — |
| **Support** | Email | Priority Chat | VIP / Dedicated | — |

**Trial = Quantum in every respect except a 200 GB storage cap and the 14-day clock.** Full whitelabel, all features, unlimited clients/seats — the strongest possible eval. Storage is the one axis capped, since it's the only trial-abuse vector that costs real money.

---

## Feature Matrix

### Client & Content Management

| Feature | Ignite | Velocity | Quantum |
|---|:---:|:---:|:---:|
| Client management | ✓ | ✓ | ✓ |
| Client limit | 8 | 20 | Unlimited |
| Internal workspace account | ✓ | ✓ | ✓ |
| Post creation & workflow | ✓ | ✓ | ✓ |
| Post versioning & history | ✓ | ✓ | ✓ |
| Platform previews (IG, LinkedIn, X, YouTube) | ✓ | ✓ | ✓ |
| Media upload | ✓ | ✓ | ✓ |
| Public client review link | ✓ | ✓ | ✓ |
| Content calendar (month & week view) | ✓ | ✓ | ✓ |
| Calendar PDF export | ✗ | ✓ | ✓ |
| Campaigns | Up to 8 | Unlimited | Unlimited |

### Prospects & Proposals

| Feature | Ignite | Velocity | Quantum |
|---|:---:|:---:|:---:|
| Prospects CRM | ✓ | ✓ | ✓ |
| CSV import (Apollo, Google Maps, etc.) | ✓ | ✓ | ✓ |
| Follow-up scheduling & pipeline | ✓ | ✓ | ✓ |
| Prospect → Client conversion | ✓ | ✓ | ✓ |
| Proposals (active) | 10 | Unlimited | Unlimited |
| Proposal PDF export | ✓ | ✓ | ✓ |
| Upload existing PDF proposal | ✓ | ✓ | ✓ |
| Public proposal review link | ✓ | ✓ | ✓ |
| Accept / decline / request-changes flow | ✓ | ✓ | ✓ |

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
| Team seats (included) | 4 | 10 | Unlimited |
| Extra seat (overage) | ₹399 | ₹399 | By arrangement |
| Invite via link | ✓ | ✓ | ✓ |
| Role-based access (admin / member) | ✓ | ✓ | ✓ |
| Finance access toggle per member | ✓ | ✓ | ✓ |
| Documents access level per member | ✓ | ✓ | ✓ |
| Functional role badges | ✓ | ✓ | ✓ |
| Admin assigns roles at invite time | ✓ | ✓ | ✓ |

> RBAC capabilities are **role-based** (owner / admin / member), independent of tier. Every tier gets full RBAC.

### Tasks — **ungated, all tiers**

| Feature | Ignite | Velocity | Quantum |
|---|:---:|:---:|:---:|
| Personal tasks (self-assigned) | ✓ | ✓ | ✓ |
| Assign tasks to team members | ✓ | ✓ | ✓ |
| Assignee filter / owner sees workspace tasks | ✓ | ✓ | ✓ |
| Client & campaign scoped tasks | ✓ | ✓ | ✓ |
| Task ↔ deliverable linking | ✓ | ✓ | ✓ |

### Collaboration — **ungated, all tiers**

| Feature | Ignite | Velocity | Quantum |
|---|:---:|:---:|:---:|
| In-app notifications (bell, fan-out) | ✓ | ✓ | ✓ |
| Contextual comments (posts + campaigns) | ✓ | ✓ | ✓ |
| @mentions & reactions | ✓ | ✓ | ✓ |

### Notes — **ungated, no count cap, all tiers**

| Feature | Ignite | Velocity | Quantum |
|---|:---:|:---:|:---:|
| Notes (client, campaign, personal) | ✓ | ✓ | ✓ |
| Tags & media attachments | ✓ | ✓ | ✓ |
| No note count cap | ✓ | ✓ | ✓ |
| *Future: private/shared + invited-member access* | ✓ | ✓ | ✓ |

> Note media counts against `max_storage_bytes` — so heavy notes usage naturally pressures the storage cap. That is the intended implicit gate; there is no count cap.

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
| `campaigns` *(deprecated — ignored)* | TRUE | TRUE | TRUE | TRUE |
| `chat` | TRUE | FALSE | TRUE | TRUE |

> **`chat` added post-Phase-2** (Workspace Chat feature, `documentation/features/feature-workspace-chat.md`) — same Trial-mirrors-Quantum precedent as every other Velocity+ flag. As of this update it is also enforced **in the database**, not just the UI: `ensure_workspace_channel()`, `get_or_create_dm_channel()`, and the `chat_messages` insert policy all call `is_chat_enabled_for_workspace()`, which reads the `chat` column directly (not `plan_name`) — so `chat` remains an independent, override-capable flag (a superadmin can grant/revoke it per workspace via `admin_update_subscription()` regardless of plan) rather than something purely derived at read time. `set_agency_plan()` sets it to the table above on every plan change.

## DB Limit Values per Plan

| Column | Trial | Ignite | Velocity | Quantum |
|---|:---:|:---:|:---:|:---:|
| `max_clients` | null | 8 | 20 | null |
| `max_storage_bytes` | 214,748,364,800 | 53,687,091,200 | 214,748,364,800 | 536,870,912,000 |
| `max_team_members` | null | 4 | 10 | null |
| `proposals_limit` | null | 10 | null | null |
| `extra_client_price_inr` | null | 500 | 500 | null |
| `extra_seat_price_inr` *(new)* | null | 399 | 399 | null |

> `campaigns_limit` is **not** a DB column — derived in `useSubscription.js` from `plan_name`: `ignite` → 8, all other plans (incl. trial) → null (unlimited).
>
> `null` on `max_clients` / `max_team_members` means unlimited. Quantum is custom-priced, so its base storage (500 GB) and any additional clients/seats are set per agreement.

---

## Storage Reference

| Plan | GB | Bytes |
|---|---|---|
| Ignite | 50 GB | 53,687,091,200 |
| Velocity / Trial | 200 GB | 214,748,364,800 |
| Quantum | 500 GB (base) | 536,870,912,000 |

All three media buckets — `post-media`, `note-media`, `client-documents` — draw from this single pool.

---

## Overage Pricing

Overages apply when a workspace exceeds the included limit. Charged per unit per month on top of the base plan fee. Billing is processed manually (via the upgrade-request flow).

| Overage type | Ignite | Velocity | Quantum |
|---|---|---|---|
| Extra client | ₹500 / mo | ₹500 / mo | By arrangement |
| Extra team seat | ₹399 / mo | ₹399 / mo | By arrangement |

> **Deliberately flat, not tiered.** Seat overage is the same ₹399 on both Ignite and Velocity — same marginal resource, same price, regardless of which base plan you're on. We considered scaling it with the tier (₹399 Ignite / ₹499 Velocity) but rejected that: charging a pricier-tier customer more for the identical extra seat is margin extraction, not value pricing. The upgrade incentive already comes from the **included** seat count (4 vs 10) and the finance/branding/reports features — not from the overage rate.

**Natural upgrade nudge:** An Ignite workspace adding 3 extra seats pays ₹1,999 + (3 × ₹399) = ₹3,196 — climbing toward Velocity (₹4,999). Combined with hitting the 8-client cap and wanting recurring invoices / branding, upgrading becomes the sensible choice.

> **Soft guardrail (manual):** overages are a growth cushion, not an escape hatch. An Ignite account running many overage seats should simply be told to upgrade when processing the request. Not enforced in code.

---

## Upgrade Triggers

- **Ignite → Velocity:** Hit the 8-client cap; adding a 5th+ team seat (overage accumulating); need to auto-bill monthly retainers (recurring invoices); want accrual accounting; need client reports; need calendar PDF export; need document collections; want agency branding on client-facing pages.
- **Velocity → Quantum:** Need full whitelabel (remove Tercero attribution entirely); scaling past 20 clients or 10 seats; need VIP support and dedicated onboarding; want a negotiated custom plan.

---

## Seed SQL

> Run from the admin portal when setting a plan. **Requires the `extra_seat_price_inr` column** on `agency_subscriptions` (add it first). `tasks_team` is intentionally absent. For Quantum, adjust `max_clients` / `max_storage_bytes` per the custom agreement.

```sql
-- TRIAL (mirrors Quantum, storage-capped at 200 GB; time-limited via trial_ends_at)
UPDATE agency_subscriptions SET
  plan_name                  = 'trial',
  reports                    = TRUE,
  max_clients                = NULL,
  max_storage_bytes          = 214748364800,   -- 200 GB cap
  branding_agency_sidebar    = TRUE,
  branding_powered_by        = FALSE,           -- full whitelabel eval
  finance_recurring_invoices = TRUE,
  finance_subscriptions      = TRUE,
  finance_accrual            = TRUE,
  calendar_export            = TRUE,
  documents_collections      = TRUE,
  campaigns                  = TRUE,
  chat                       = TRUE,
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
  max_storage_bytes          = 53687091200,     -- 50 GB
  branding_agency_sidebar    = FALSE,
  branding_powered_by        = TRUE,
  finance_recurring_invoices = FALSE,
  finance_subscriptions      = FALSE,
  finance_accrual            = FALSE,
  calendar_export            = FALSE,
  documents_collections      = FALSE,
  campaigns                  = TRUE,
  chat                       = FALSE,
  proposals_limit            = 10,
  max_team_members           = 4,
  extra_client_price_inr     = 500,
  extra_seat_price_inr       = 399
WHERE user_id = $1;

-- VELOCITY
UPDATE agency_subscriptions SET
  plan_name                  = 'velocity',
  reports                    = TRUE,
  max_clients                = 20,
  max_storage_bytes          = 214748364800,    -- 200 GB
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
  max_team_members           = 10,
  extra_client_price_inr     = 500,
  extra_seat_price_inr       = 399
WHERE user_id = $1;

-- QUANTUM (base — adjust max_clients / max_storage_bytes per custom agreement)
UPDATE agency_subscriptions SET
  plan_name                  = 'quantum',
  reports                    = TRUE,
  max_clients                = NULL,
  max_storage_bytes          = 536870912000,    -- 500 GB base
  branding_agency_sidebar    = TRUE,
  branding_powered_by        = FALSE,           -- full whitelabel
  finance_recurring_invoices = TRUE,
  finance_subscriptions      = TRUE,
  finance_accrual            = TRUE,
  calendar_export            = TRUE,
  documents_collections      = TRUE,
  campaigns                  = TRUE,
  chat                       = TRUE,
  proposals_limit            = NULL,
  max_team_members           = NULL,
  extra_client_price_inr     = NULL,
  extra_seat_price_inr       = NULL
WHERE user_id = $1;
```

---

## Gating Philosophy (why these lines are drawn here)

- **Team collaboration is never the paywall.** Tasks, comments, notifications, and notes are unlocked everywhere — because Ignite serves teams, and because these are the stickiest (retention-driving) features. Gating them would cripple the entry tier and undermine lock-in.
- **The paywall is capacity + sophistication + brand.** Clients, seats, and storage scale with the customer's own growth (natural expansion revenue). Advanced finance (recurring/accrual/reports), calendar export, and document collections mark operational maturity. Branding/whitelabel is client-facing polish. These are what a *growing agency* pays to unlock — not the ability to assign a task.
- **Overages are a growth cushion and a nudge.** They prevent rage-churn from someone needing one more seat/client, while the accumulating cost makes the next tier the rational choice.
- **Quantum is custom-priced, so unlimited seats/clients is safe** — value from large teams is captured in the negotiated base price, not per-seat metering.

---

## Planned Features (post Phase 2)

| Feature | Target Tier |
|---|---|
| Notes: private/shared visibility + invited-member access | All tiers (not gated) |
| OAuth social publishing (Instagram, LinkedIn, X, YouTube) | Velocity+ |
| Social analytics (reach, impressions, engagement) | Velocity+ |
| WhatsApp integration (approvals / reviews) | Velocity+ |
| Client portal (branded client-facing workspace) | Velocity+ |
| AI (caption drafting, platform rewrites, campaign health) | Velocity+ |
| Deep team management (per-member profile, salary tracker) | Velocity+ |
| Activity logs (team audit trail) | Velocity+ |
