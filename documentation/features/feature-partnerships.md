# Feature: Partnership Management

## Purpose

Agencies are often co-owned, externally funded, or built with partners who have equity stakes. Today there is no place in Tercero to track this. Ownership structures live in spreadsheets or legal documents that no one looks at regularly.

The Partnerships module gives the agency a clean operational record of who its partners are, what they contributed, what they own, and what has been paid back to them — the same way the app manages clients, but for the people and entities who have a stake in the agency itself.

---

## Scope

This module is **agency-level only**. It is about the agency's own ownership and investment structure — not about client relationships or external business deals. Those can be considered in a later phase.

It is not a legal cap table tool. No waterfall calculations, liquidation preferences, or legal compliance features. It is an operational record designed for day-to-day clarity.

---

## Where it lives

- Route: `/partnerships` (or nested under `/myorganization`)
- Sits alongside Billing and Settings — it describes the agency itself, not client work
- Not visible to invited team members by default (owner-only access)

---

## Data Model

```
agency_partners
  id
  workspace_user_id (scoped to agency owner)
  name
  type: individual | company | fund
  email
  phone
  role: co_founder | investor | silent_partner | advisor
  joined_date
  status: active | exited | inactive
  notes

agency_equity
  id
  partner_id
  round: bootstrapped | pre_seed | seed | series_a | grant | loan | other
  contribution_type: cash | resources | services | equipment | ip
  contribution_value (monetary equivalent)
  equity_percent
  share_count (optional)
  vesting_start
  vesting_end
  date
  documents[] (term sheets, shareholder agreements — stored in Supabase storage)

agency_partner_transactions
  id
  partner_id
  type: capital_in | distribution | dividend | buyout | loan_repayment
  amount
  date
  notes
```

---

## What the Agency Sees

### Partners List (`/partnerships`)
- All partners with their equity %, contribution type, joined date, and status badge
- Quick stats at the top: total partners, total capital raised, total equity distributed
- Filter by status (active / exited) and type (individual / company / fund)

### Partner Detail
- Full profile: name, role, contact, status
- Equity record: round, contribution, % owned, vesting timeline
- Transaction history: capital contributions in, distributions and dividends out
- Documents: upload and view term sheets or agreements

### Cap Table View
A simple summary table:

| Partner | Role | Contribution | Equity % | Status |
|---|---|---|---|---|
| Jane Smith | Co-Founder | Services | 40% | Active |
| Acme Fund | Investor | ₹50,00,000 | 25% | Active |
| ...| | | | |

Exportable as PDF.

---

## Finance Integration

Partner transactions use the same ledger pattern as Finance:

| Movement | Type |
|---|---|
| Partner invests cash | `capital_in` transaction |
| Agency pays dividend | `distribution` transaction |
| Agency buys out partner | `buyout` transaction |
| Loan repaid to investor | `loan_repayment` transaction |

These are tracked within the partnerships module and do not clutter the client-facing finance ledger.

---

## Phases

### Phase 1 — Partner Registry
- Partner CRUD (create, edit, deactivate)
- Equity record per partner (round, contribution, %)
- Partner detail page with documents upload
- Basic cap table view (list, not chart)

### Phase 2 — Transaction Tracking
- Log capital in / distributions out per partner
- Transaction history on partner detail
- Total capital raised and total distributed shown on the list page

### Phase 3 — Reporting
- Cap table PDF export
- Vesting timeline view
- Equity distribution chart (pie / bar)

---

## Subscription Gating

| Plan | Access |
|---|---|
| Trial | Full (mirrors Quantum — 14 day window) |
| Ignite | Hidden |
| Velocity | Phase 1 + 2 |
| Quantum | Full (all phases) |

This is a high-trust, agency-structural feature. Keeping it Velocity+ (and Quantum) ensures it reaches agencies operating at a scale where ownership structure actually matters. Trial gets full access so agencies can evaluate the feature before committing to a plan.
