# Feature: Proposals & Client Pipeline
**Product**: Tercero — Social Media Agency Management SaaS  
**Feature Folder**: `.claude/features/`  
**Status**: Planned  
**Phase 1**: Prospect client status + pre-onboarding pipeline  
**Phase 2**: Full proposal builder with shareable preview link  

---

## 1. What Is This Feature?

**Proposals** cover the stage of the agency workflow that happens *before* a client is onboarded — the pitch, the scoping, and the conversion. Currently, Tercero's client lifecycle begins at onboarding. There is no representation of potential clients, active pitches, or proposals in progress.

### Current Client Lifecycle in Tercero:
```
[External tools: Google Docs, email, Notion]
         ↓ (manual, disconnected)
Client created in Tercero (Active)
         ↓
Posts, Invoices, Meetings begin
```

### Proposed Client Lifecycle:
```
Prospect created in Tercero
         ↓
Proposal drafted and sent (shareable link)
         ↓
Prospect converted → Active Client (one click)
         ↓
Posts, Invoices, Meetings begin (all pre-filled from proposal data)
```

This closes the lifecycle gap and positions Tercero as the single tool for the entire client relationship — from first contact to final invoice.

---

## 2. Phase 1 — Prospect Pipeline (Pre-Proposal MVP)

### 2.1 Philosophy

Phase 1 does **not** build the full proposal document creator. The risk of building a half-baked proposal tool is that it competes unfavorably with dedicated tools (PandaDoc, Proposify, Google Docs) and damages perception. Instead, Phase 1 introduces **Prospect** as a first-class client status — a lightweight pre-onboarding state that tracks potential clients and the pipeline stage they're in.

This gives agency owners:
- A place inside Tercero to track who they're pitching
- Context on each prospect (notes, industry, platforms, source)
- A clear conversion path from Prospect → Active Client
- The foundation for Phase 2's full proposal builder

### 2.2 What Gets Built

#### New Client Status: `Prospect`
Add `Prospect` as a valid status alongside `Active` and `Inactive` in the `clients` table's status field.

Prospects:
- Appear on the Clients page with a distinct visual treatment (e.g., dashed border, muted palette, "PROSPECT" badge)
- Do NOT count against the plan's client slot limit (they're not paying clients yet)
- Cannot have posts created under them (Phase 1)
- CAN have notes, meetings, and file attachments (for tracking pitch conversations)
- Have a dedicated **Pipeline Stage** field

#### Pipeline Stages
A new field on clients (or a separate `prospect_stages` concept):
- `Lead` — identified, not yet contacted
- `Contacted` — initial outreach made
- `Pitch Sent` — proposal or pitch deck shared
- `Negotiating` — in active back-and-forth
- `Won` — converted to active client
- `Lost` — did not convert (kept for historical tracking)

#### Prospect-Specific Fields
Additional fields on the client record for prospects:
- `lead_source` — how they found the agency (Referral, Instagram, LinkedIn, Cold Outreach, Other)
- `estimated_value` — expected monthly retainer or project value
- `pipeline_stage` — from stages above
- `expected_close_date` — target date to convert
- `lost_reason` — if stage is Lost (optional text)

#### Clients Page Enhancement
The Clients page (`/clients`) gains:
- A **Pipeline tab** alongside the existing client grid — shows only Prospects in a Kanban-style board grouped by pipeline stage
- Existing All/Active/Inactive filters unchanged
- Prospect count shown separately from active client count (so plan limits are clear)
- "Convert to Client" action on prospect card — changes status to Active, clears pipeline fields, redirects to full client onboarding

#### Dashboard Integration
- New widget or section: **Prospect Pipeline** — shows count per pipeline stage and total estimated pipeline value
- Only shown if at least one Prospect exists (progressive disclosure)

### 2.3 Convert to Active Client Flow

When "Convert to Client" is triggered:
1. Confirmation dialog: "Convert [Name] to an active client? This will count against your plan's client slots."
2. On confirm:
   - `status` → `Active`
   - `pipeline_stage` → NULL (or archived)
   - `estimated_value` → can optionally pre-fill a draft invoice
   - Redirect to Client Detail page
   - Toast: "Nova Corps is now an active client. Start by creating their first post."

### 2.4 Phase 1 Explicitly Out of Scope
- Proposal document creation or editing
- Shareable proposal preview links
- E-signature or acceptance flow
- Proposal templates
- Proposal PDF export
- Automated follow-up reminders

---

## 3. Phase 2 — Full Proposal Builder

### 3.1 What Gets Built

#### Proposal Record
A new `proposals` table linked to a client (prospect or active):
- Title (e.g., "Social Media Management Proposal — Q2 2026")
- Status: `Draft`, `Sent`, `Accepted`, `Declined`, `Expired`
- Valid until date (expiry)
- Shareable token (like the existing Public Review link pattern)
- Sections (ordered, rich content)
- Line items / pricing table
- Created at / Sent at / Accepted at timestamps

#### Proposal Builder UI (`/clients/:clientId/proposals/new`)
A full-page document editor with:
- **Section blocks** (drag to reorder):
  - Executive Summary (rich text)
  - Scope of Work (rich text + bullet builder)
  - Deliverables Table (structured rows: deliverable, quantity, frequency)
  - Pricing Table (line items with qty, unit price, subtotal — same pattern as invoice line items)
  - Timeline (milestone rows: date + description)
  - Terms & Conditions (rich text, with agency default template)
  - About Us (rich text, auto-populated from agency settings)
- Live preview panel (right side) showing formatted proposal as client would see it
- "Save Draft" and "Send to Client" actions

#### Shareable Proposal Preview (`/proposal/:token`)
Public-facing, no-login-required page (same pattern as `/review/:token`):
- Professionally formatted proposal view
- Agency logo and branding from agency settings
- All sections rendered clearly
- **Accept / Decline** buttons at the bottom
- Optional: message field for client to leave a note when declining
- On Accept:
  - Proposal status → `Accepted`
  - Agency notified via email (Edge Function)
  - One-click prompt in Tercero: "Proposal accepted — convert [Name] to active client?"

#### Proposal Templates
- Agency can save any proposal as a template
- "Start from template" when creating a new proposal
- Templates store section structure and default text, not pricing (pricing is always entered fresh)

#### Proposal → Invoice Bridge
- When a proposal is accepted, line items from the Pricing Table can be imported directly into a new invoice
- Eliminates re-entry of scope and pricing data

#### Proposal List per Client
- New "Proposals" tab on Client Detail page
- Shows all proposals (draft, sent, accepted, declined) with status badges and timestamps
- History preserved even after conversion to active client

### 3.2 Phase 2 Integration with Existing Features

| Feature | Integration |
|---------|-------------|
| Agency Settings | About Us block auto-populated from agency name, logo, description |
| Finance — Invoices | Accepted proposal line items importable as invoice line items |
| Public Review link | Same token pattern reused for proposal shareable link |
| Email Edge Functions | New `send-proposal-email` function triggered on "Send to Client" |
| Client Detail tabs | New "Proposals" tab |

---

## 4. Database Analysis

### 4.1 Modified Table: `clients`

```sql
-- Phase 1 additions
ALTER TABLE clients 
ADD COLUMN pipeline_stage    TEXT CHECK (pipeline_stage IN 
  ('Lead','Contacted','Pitch Sent','Negotiating','Won','Lost')),
ADD COLUMN lead_source       TEXT,
ADD COLUMN estimated_value   NUMERIC(12,2),
ADD COLUMN expected_close    DATE,
ADD COLUMN lost_reason       TEXT;

-- Status field already exists — add 'Prospect' as valid value
-- Requires updating the CHECK constraint or enum type
```

Note on `status` field: If it's a `TEXT` with a CHECK constraint, add `'Prospect'` to the allowed values. If it's a PostgreSQL enum, run `ALTER TYPE client_status ADD VALUE 'Prospect'`.

### 4.2 New Table: `proposals` (Phase 2)

```sql
CREATE TABLE proposals (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id         UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  title             TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'Draft'
                      CHECK (status IN ('Draft','Sent','Accepted','Declined','Expired')),
  valid_until       DATE,
  review_token      UUID DEFAULT gen_random_uuid() UNIQUE NOT NULL,
  sections          JSONB DEFAULT '[]',   -- ordered array of section blocks
  line_items        JSONB DEFAULT '[]',   -- pricing table rows
  total_value       NUMERIC(12,2),
  client_message    TEXT,                 -- message from client on decline
  sent_at           TIMESTAMPTZ,
  accepted_at       TIMESTAMPTZ,
  declined_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own proposals"
  ON proposals FOR ALL
  USING (user_id = auth.uid());

-- Public access via token (no auth required — same pattern as post review)
CREATE POLICY "Public read via token"
  ON proposals FOR SELECT
  USING (true);  -- filtered by token in application layer
```

### 4.3 Relationship Map

```
auth.users
└── clients (user_id FK)
    ├── status: Prospect | Active | Inactive
    ├── pipeline_stage (nullable, only for Prospects)
    └── proposals (Phase 2)
        └── review_token → /proposal/:token (public)
```

### 4.4 Impact on Existing Tables

| Table | Change | Risk |
|-------|--------|------|
| `clients` | Add 4 nullable prospect fields + new status value | Low — all nullable, existing rows unaffected |
| `posts` | No change — prospects cannot have posts in Phase 1 | None |
| `invoices` | Phase 2: optional `proposal_id` FK for bridge feature | Low |
| `agency_subscriptions` | Client count logic must exclude Prospect status | Medium — needs careful query update |

### 4.5 Critical: Plan Limit Enforcement

The existing `agency_subscriptions` table enforces `max_clients`. This query must be updated to count only `Active` (and `Inactive`) clients, not Prospects:

```sql
-- Before (assumed current)
SELECT COUNT(*) FROM clients WHERE user_id = $1;

-- After (must exclude prospects)
SELECT COUNT(*) FROM clients 
WHERE user_id = $1 AND status != 'Prospect';
```

This is the highest-risk change — if not updated, Prospects would incorrectly consume client slots.

---

## 5. Impact Analysis

### 5.1 Positive Impact

**Client Lifecycle Completeness**
The product story becomes "manage every client from first pitch to final invoice" — a fundamentally stronger value proposition than starting at onboarding.

**Retention Through Early Lock-In**
If agency owners track prospects in Tercero, the tool becomes part of their sales workflow, not just their delivery workflow. This dramatically increases daily engagement and switching cost.

**Conversion Funnel Visibility**
The Pipeline Kanban on the Clients page gives agency owners a view they've never had — how many leads are in the pipe, what's the estimated value, what stage is everything at. This is genuinely valuable business intelligence.

**Phase 2 Proposal → Invoice Bridge**
Eliminating the re-entry of scope and pricing from proposal to invoice is a meaningful time saving. Agencies that do 5+ new proposals per month feel this immediately.

**Consistent UX Pattern**
The shareable proposal link in Phase 2 reuses the same `/token` pattern as the existing Public Review link. Zero new UX paradigm to learn — for agency or client.

### 5.2 Negative / Risk Considerations

**Plan Limit Logic Complexity**
Prospect status must be explicitly excluded from all plan limit enforcement queries. Missing even one check could silently allow over-quota usage or incorrectly block legitimate prospects.

**Scope Creep Risk for Phase 1**
"Just add prospect tracking" can quietly expand into "but we also need email reminders for follow-ups, and a pipeline value chart, and..." — Phase 1 must be strictly bounded to the fields and views described above.

**Proposal Builder is High Effort**
A good proposal builder is genuinely hard to build well. Rich text, drag-to-reorder sections, live preview, and a polished shareable view is 3-4 weeks of serious frontend work. Phase 2 must be scoped with this in mind.

**Client Confusion: Prospect vs Client**
Agency owners may accidentally create a post or invoice for a Prospect. The UI must clearly communicate that Prospects are pre-activation and restrict certain actions until conversion.

---

## 6. Correlation with Existing Features

| Existing Feature | Relationship |
|-----------------|--------------|
| Client List (`/clients`) | Gains Pipeline tab. Active/Inactive view unchanged. |
| Client Detail Page | Prospect clients show limited tabs (no Posts, no Finance until converted) |
| Client Health Grid (Dashboard) | Only shows Active clients — Prospects shown in separate Pipeline widget |
| Finance — Invoices | Phase 2: Proposal line items importable to invoice |
| Public Review Link | Phase 2: Same token architecture reused for proposal preview |
| Agency Settings | Phase 2: Agency name/logo auto-populate proposal "About Us" section |
| Billing & Usage | Client count guard must exclude Prospects |
| Email Edge Functions | Phase 2: New `send-proposal-email` function |

---

## 7. File & Component Structure (Suggested)

```
src/
├── api/
│   ├── prospects.js              — Prospect-specific CRUD (Phase 1)
│   └── proposals.js              — Proposal CRUD + token lookup (Phase 2)
├── pages/
│   ├── clients/
│   │   └── ProspectPipeline.jsx  — Kanban board view on Clients page (Phase 1)
│   └── proposals/
│       ├── ProposalBuilder.jsx   — Full proposal editor (Phase 2)
│       └── PublicProposal.jsx    — /proposal/:token public page (Phase 2)
├── components/
│   └── prospects/
│       ├── ProspectCard.jsx      — Card in pipeline kanban
│       ├── PipelineBoard.jsx     — Kanban columns
│       ├── ConvertClientDialog.jsx — Confirmation + conversion flow
│       └── ProspectForm.jsx      — Create/edit prospect
```

---

## 8. Landing Page Relevance

**Hero/Features copy angle:**
> *"From first pitch to final invoice — without leaving Tercero. Track prospects, send proposals, convert clients, and invoice them — all in one place."*

**Phase 1 copy (Prospect Pipeline):**
> *"Know exactly where every potential client stands. Track your pipeline, log conversations, and convert prospects to active clients in one click."*

**Phase 2 copy (Proposal Builder):**
> *"Send polished proposals with a shareable link. Clients accept online — no printing, no email chains, no back-and-forth."*
