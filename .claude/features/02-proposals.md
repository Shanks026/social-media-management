# Tercero — Proposals Feature

**Status**: Approved for Build — Phase 1
**Last Updated**: March 2026
**Build Sequence**: After Teams Phase 1 is complete and stable

---

## What Are Proposals?

A proposal is the structured document an agency sends to a **prospective or existing client** before work begins or before a retainer renews. It outlines what the agency will do, for how long, at what price, and under what terms — and gives the client a clear, formal mechanism to accept or decline.

Currently, Indian social media agency owners build these in Canva, Google Docs, or PowerPoint, export to PDF, and send via email or WhatsApp. This is disconnected from their operations tool, inconsistent in quality, impossible to track, and leaves no formal record of acceptance.

Tercero already owns the **entire post-signature workflow** — content, finance, approvals, meetings. Proposals is the natural front door: it captures the moment before a client is a client and creates a seamless handoff into the rest of the workspace.

---

## The Problem It Solves

- **Inconsistency** — Every proposal looks different depending on which template the owner found last time. No standardised structure, no consistent branding.
- **Disconnection** — Agreed scope and pricing from a proposal has to be manually re-entered into Tercero when the client signs. Errors and double work.
- **No tracking** — The agency has zero visibility into whether a prospect opened the proposal, is sitting on it, or has lost it entirely.
- **No formal acceptance** — A WhatsApp "yes sounds good" is not a paper trail. There is no record of what was agreed.
- **Lost revenue** — Informal proposals are easier to ghost. A professional, structured proposal with a clear acceptance mechanism closes faster.

---

## Use Cases

**New client pitch** — Agency has a discovery call with a D2C brand. Within 24 hours they need to send something professional before momentum dies. Create proposal in Tercero, share link, prospect clicks Accept.

**Retainer renewal** — Existing client's engagement is ending. Clone the previous proposal, adjust pricing, send link. Client formally accepts the renewed terms. Renewal is on record.

**Scope expansion / upsell** — Existing client on Instagram retainer. Agency pitches adding LinkedIn and YouTube for ₹15,000/month extra. A formal proposal with a pricing breakdown closes this faster than a WhatsApp message.

**One-off campaign work** — Product launch, fixed scope, fixed fee. Locks deliverables in writing before work starts. Prevents scope creep.

---

## Proposal Statuses

```
DRAFT      → Being built by the agency owner. Not shared yet.
SENT       → Share link has been copied or shared. Prospect has access.
VIEWED     → Prospect opened the public page (auto-tracked on first page load).
ACCEPTED   → Prospect clicked Accept on the public page.
DECLINED   → Prospect clicked Decline (optional reason recorded).
EXPIRED    → valid_until date passed with no response.
ARCHIVED   → Manually archived by owner. Out of active pipeline.
```

**Status flow:**

```
DRAFT → SENT → VIEWED → ACCEPTED
                       → DECLINED
      (any non-terminal) → EXPIRED  (automatic, date-based)
      (any)              → ARCHIVED (manual)
```

**VIEWED** is important: when the public page loads via token, `mark_proposal_viewed()` fires automatically — sets `first_viewed_at` and advances SENT → VIEWED. This gives the owner meaningful signal: "they've seen it and haven't responded" is different from "they never opened it."

---

## Subscription Tier Scoping

| Plan         | Proposals | Limit Behaviour                                                        |
| ------------ | --------- | ---------------------------------------------------------------------- |
| **Trial**    | 5 total   | Same as Ignite                                                         |
| **Ignite**   | 5 total   | Counter shown: "3 of 5 used". At limit, creation opens upgrade dialog. |
| **Velocity** | Unlimited | No restrictions                                                        |
| **Quantum**  | Unlimited | No restrictions + AI features in Phase 3                               |

### DB Column on `agency_subscriptions`

```sql
proposals_limit   integer  default 5   -- null = unlimited
```

| Plan     | `proposals_limit` |
| -------- | ----------------- |
| Trial    | 5                 |
| Ignite   | 5                 |
| Velocity | null              |
| Quantum  | null              |

**Enforcement**: Count all non-archived proposals for the workspace. If `proposals_limit` is not null and count >= limit, block creation and show upgrade prompt. The "New Proposal" button on Ignite shows a live counter (e.g. "2 of 5 used"). At limit, button opens upgrade dialog instead of the create form.

**Gating pattern**: Hybrid — the nav item and page are always visible. Gating only triggers at the point of creation. Ignite users can view, manage, and share their 5 proposals freely.

---

## Architecture — How It Fits the Existing App

Proposals mirrors the **Campaigns** module architecture throughout:

| Concern        | Campaigns (existing)                              | Proposals (new)         |
| -------------- | ------------------------------------------------- | ----------------------- |
| Global page    | `/campaigns`                                      | `/proposals`            |
| Per-client tab | `CampaignTab.jsx`                                 | `ProposalTab.jsx`       |
| Public page    | `/campaign-review/:token`                         | `/proposal/:token`      |
| Public RPC     | `get_campaign_by_review_token`                    | `get_proposal_by_token` |
| Branding logic | `branding_agency_sidebar` + `branding_powered_by` | Identical flags         |
| PDF export     | `CampaignReportPDF.jsx`                           | `ProposalPDF.jsx`       |
| API file       | `src/api/campaigns.js`                            | `src/api/proposals.js`  |

**Sidebar placement**: Standalone nav item directly below Clients. Always visible regardless of tier; gating is internal.

**Create/Edit layout**: Left form, right live preview — identical to `EditInvoiceDialog` + `HTMLInvoicePreview.jsx`. Preview updates reactively as the owner types.

**Client Detail tab**: Proposals added as a tab to `ClientProfileView.jsx` using the same `clientId` scoping pattern as `CampaignTab` and `DocumentsTab`.

---

## Data Model

```sql
proposals (
  id                uuid primary key default gen_random_uuid(),
  agency_user_id    uuid references auth.users not null,
  client_id         uuid references clients,        -- null if prospect
  prospect_name     text,                           -- used when client_id is null
  prospect_email    text,
  title             text not null,
  status            text default 'draft',
  introduction      text,
  scope_notes       text,
  payment_terms     text,
  contract_duration text,
  valid_until       date,
  share_token       text unique,
  first_viewed_at   timestamptz,
  sent_at           timestamptz,
  accepted_at       timestamptz,
  declined_at       timestamptz,
  decline_reason    text,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
)

proposal_line_items (
  id            uuid primary key default gen_random_uuid(),
  proposal_id   uuid references proposals on delete cascade,
  description   text not null,
  amount        numeric not null,
  sort_order    integer default 0
)
```

### RLS Policy Pattern

Uses the `get_my_agency_user_id()` SECURITY DEFINER helper established by Teams — team members get transparent access automatically:

```sql
create policy "proposals_access" on proposals
  for all using (
    auth.uid() = agency_user_id
    or auth.uid() in (
      select member_user_id from agency_members
      where agency_user_id = proposals.agency_user_id
      and is_active = true
    )
  );
```

### RPCs Required

| RPC                                      | Auth                    | Purpose                                         |
| ---------------------------------------- | ----------------------- | ----------------------------------------------- |
| `get_proposals_with_totals`              | Authenticated           | List proposals with calculated line item totals |
| `get_proposal_by_token(p_token)`         | Public SECURITY DEFINER | Returns proposal + agency branding flags        |
| `mark_proposal_viewed(p_token)`          | Public SECURITY DEFINER | Sets first_viewed_at, SENT → VIEWED             |
| `accept_proposal(p_token)`               | Public SECURITY DEFINER | Sets status=accepted, accepted_at=now()         |
| `decline_proposal(p_token, p_reason)`    | Public SECURITY DEFINER | Sets status=declined, records reason            |
| `generate_proposal_token(p_proposal_id)` | Authenticated           | Creates or regenerates share token              |

---

## New Files

```
src/api/proposals.js
src/pages/proposals/ProposalsPage.jsx
src/pages/proposals/ProposalDetailPage.jsx
src/pages/proposals/ProposalReview.jsx           ← public, unauthenticated
src/components/proposals/ProposalTab.jsx          ← reusable per-client tab
src/components/proposals/ProposalDialog.jsx       ← create/edit form
src/components/proposals/ProposalPreview.jsx      ← live HTML preview panel
src/components/proposals/ProposalPDF.jsx          ← @react-pdf/renderer document
src/components/proposals/ProposalsUpgradePrompt.jsx
```

## Files Modified

| File                                      | Change                                                            |
| ----------------------------------------- | ----------------------------------------------------------------- |
| `src/App.jsx`                             | Add routes: `/proposals`, `/proposals/:id`, `/proposal/:token`    |
| `src/components/sidebar/app-sidebar.jsx`  | Add Proposals nav item below Clients                              |
| `src/pages/clients/ClientProfileView.jsx` | Add Proposals tab                                                 |
| `src/api/useSubscription.js`              | Expose `proposals_limit` from subscription row                    |
| `feature-tiers-v5.md`                     | Add Proposals section, DB column, seed SQL                        |
| `app-research.md`                         | Add Proposals to Core Modules table and feature deep-dive section |

---

---

# PHASE 1 — Core Build

**Goal**: Working proposal creation, sharing, and acceptance flow with professional default Tercero design.
**Prerequisite**: Teams Phase 1 complete — `get_my_agency_user_id()` SECURITY DEFINER helper must exist in the database.

> Claude Code: work through each section in order. Check off tasks as completed.
> At the ⏸ marker at the end of each section — stop and wait for the user to confirm before continuing.

---

### Section 1 — Database

- [ ] Add `proposals_limit integer default 5` column to `agency_subscriptions`
- [ ] Update seed SQL for all plans (Trial=5, Ignite=5, Velocity=null, Quantum=null)
- [ ] Create `proposals` table with all columns as defined in the data model above
- [ ] Create `proposal_line_items` table with `on delete cascade` on `proposal_id`
- [ ] Write RLS policy for `proposals` using `get_my_agency_user_id()` pattern
- [ ] Write RLS policy for `proposal_line_items` (access via proposal ownership)
- [ ] Write `get_proposals_with_totals` RPC — returns proposals list with sum of line item amounts as `total_value`
- [ ] Write `get_proposal_by_token(p_token)` public SECURITY DEFINER RPC — returns full proposal data + agency branding flags (`agency_name`, `logo_url`, `logo_horizontal_url`, `branding_agency_sidebar`, `branding_powered_by`) joined from `agency_subscriptions`
- [ ] Write `mark_proposal_viewed(p_token)` public SECURITY DEFINER RPC — sets `first_viewed_at = now()` (only if null), advances status SENT → VIEWED
- [ ] Write `accept_proposal(p_token)` public SECURITY DEFINER RPC — sets `status = 'accepted'`, `accepted_at = now()`; no-op if already accepted
- [ ] Write `decline_proposal(p_token, p_reason text)` public SECURITY DEFINER RPC — sets `status = 'declined'`, `declined_at = now()`, stores reason
- [ ] Write `generate_proposal_token(p_proposal_id uuid)` authenticated RPC — generates a UUID token, sets `share_token` on the proposal, returns the full shareable URL

**⏸ STOP — confirm all DB objects are created and tested before proceeding to Section 2.**

---

### Section 2 — API Layer

**File**: `src/api/proposals.js`

- [ ] `useProposals({ clientId? })` — React Query hook, fetches from `get_proposals_with_totals`, scoped by `workspaceUserId` from AuthContext; accepts optional `clientId` filter
- [ ] `useProposal(proposalId)` — fetches single proposal with its `proposal_line_items`
- [ ] `useCreateProposal()` — mutation that first counts non-archived proposals, compares to `proposals_limit`; if at limit, throws a typed upgrade error instead of inserting; otherwise inserts proposal + line items atomically
- [ ] `useUpdateProposal(proposalId)` — updates proposal fields and replaces line items (delete existing, re-insert)
- [ ] `useDeleteProposal(proposalId)` — hard delete if DRAFT; sets `status = 'archived'` for any other status
- [ ] `useGenerateProposalToken(proposalId)` — calls `generate_proposal_token` RPC, returns shareable URL, invalidates proposal query
- [ ] `fetchProposalByToken(token)` — plain async function, no auth, calls `get_proposal_by_token`
- [ ] `markProposalViewed(token)` — plain async function, no auth, calls `mark_proposal_viewed`
- [ ] `acceptProposal(token)` — plain async function, no auth, calls `accept_proposal`
- [ ] `declineProposal(token, reason)` — plain async function, no auth, calls `decline_proposal`

**⏸ STOP — confirm all API hooks are working before proceeding to Section 3.**

---

### Section 3 — Create/Edit Dialog

**File**: `src/components/proposals/ProposalDialog.jsx`
**File**: `src/components/proposals/ProposalPreview.jsx`

- [ ] Dialog uses two-panel layout — form on the left, live HTML preview on the right — matching `EditInvoiceDialog` layout
- [ ] Left panel form fields:
  - [ ] Title (required, text input)
  - [ ] Client selector — dropdown of existing clients; includes a "New Prospect" option that reveals prospect name + email fields below
  - [ ] Validity date picker
  - [ ] Introduction (textarea)
  - [ ] Scope of work (textarea)
  - [ ] Payment terms (select: Due on Receipt / Net 15 / Net 30 / Net 60 — mirrors invoice options)
  - [ ] Contract duration (free text, placeholder: e.g. "3 months", "Ongoing")
  - [ ] Additional notes (textarea)
  - [ ] Line items section: add/remove rows, each row has description (text) + amount (number); same UX as invoice line items in `EditInvoiceDialog`; grand total calculated and displayed at bottom
- [ ] Right panel `ProposalPreview.jsx` — styled HTML preview that updates reactively on every field change, renders: agency logo + name (from `useSubscription`), proposal title, "Prepared for: [client/prospect name]", validity date, all sections with headings, pricing table with line items and formatted grand total (`formatCurrency()`), payment terms, contract duration, notes
- [ ] Zod validation — title required, at least one line item with description and amount required
- [ ] Dialog functions as both create (no `proposalId` prop) and edit (pre-fills all fields when `proposalId` provided)
- [ ] On save as DRAFT — closes dialog, shows success toast

**⏸ STOP — confirm dialog and live preview are rendering correctly before proceeding to Section 4.**

---

### Section 4 — Global Proposals Page

**File**: `src/pages/proposals/ProposalsPage.jsx`

- [ ] Route `/proposals` added to `App.jsx`
- [ ] Proposals nav item added to `app-sidebar.jsx` — placed directly below the Clients nav item
- [ ] Page header: "Proposals" heading + "New Proposal" button on the right
- [ ] Ignite/Trial: proposal limit counter displayed near the button ("2 of 5 proposals used"); hidden on Velocity+
- [ ] "New Proposal" button behaviour: opens `ProposalDialog` if under limit; opens `ProposalsUpgradePrompt` dialog if at limit
- [ ] Status filter tabs: All / Draft / Sent / Viewed / Accepted / Declined / Expired / Archived
- [ ] Client filter dropdown (all clients in workspace)
- [ ] Search input — filters by proposal title or prospect name
- [ ] Proposal list rows/cards showing: title, client or prospect name, status badge, total value (formatted), valid until date, created date
- [ ] Status badge colours: Draft=muted, Sent=blue, Viewed=amber, Accepted=green, Declined=red, Expired=muted-red, Archived=muted
- [ ] Clicking a proposal row navigates to `/proposals/:proposalId`
- [ ] Empty state: appropriate message + "Create your first proposal" CTA
- [ ] `ProposalsUpgradePrompt.jsx`: "You've used all 5 proposals on your Ignite plan. Upgrade to Velocity for unlimited proposals." with upgrade button

**⏸ STOP — confirm global proposals page is fully functional before proceeding to Section 5.**

---

### Section 5 — Proposal Detail Page

**File**: `src/pages/proposals/ProposalDetailPage.jsx`

- [ ] Route `/proposals/:proposalId` added to `App.jsx`
- [ ] Same left-form / right-preview layout as `ProposalDialog` — editing is done inline on this page
- [ ] Page header: proposal title + status badge + client/prospect name
- [ ] Action bar:
  - [ ] **Copy Link** button — calls `useGenerateProposalToken`, copies resulting URL to clipboard, if current status is DRAFT automatically advances to SENT, shows toast "Link copied — proposal marked as Sent"
  - [ ] **Export PDF** button — triggers `ProposalPDF` download
  - [ ] **Archive** button — confirmation dialog, then sets status to archived
  - [ ] **Delete** button — only shown when status is DRAFT, confirmation dialog, hard deletes
- [ ] Status timeline displayed below action bar: created date → sent date → viewed date (first_viewed_at) → accepted/declined date; each stage only shown if it has occurred
- [ ] Decline reason displayed as a note if status is DECLINED
- [ ] ACCEPTED and DECLINED proposals render as read-only — form fields are disabled, lock icon shown — same pattern as paid invoices in `EditInvoiceDialog`
- [ ] Auto-save on field blur for DRAFT and SENT proposals

**⏸ STOP — confirm detail page is complete before proceeding to Section 6.**

---

### Section 6 — Public Proposal Page

**File**: `src/pages/proposals/ProposalReview.jsx`

- [ ] Route `/proposal/:token` added to `App.jsx` — placed outside `AppShell`, fully unauthenticated
- [ ] Page handles 6 states:
  - [ ] **Loading** — skeleton screen while fetching
  - [ ] **Invalid/not found token** — "This proposal link is invalid. Please contact the agency for a new link."
  - [ ] **Expired** — "This proposal is no longer valid (expired [date]). Please contact [agency name] for an updated proposal."
  - [ ] **Already accepted** — confirmation message, no action buttons
  - [ ] **Already declined** — decline confirmation, no action buttons
  - [ ] **Active** — full proposal view with Accept/Decline buttons
- [ ] Agency branding in header: identical logic to `PublicReview.jsx` — Ignite shows Tercero logo; Velocity+ shows agency logo (prefers `logo_horizontal_url`, falls back to `logo_url`, falls back to agency name text)
- [ ] "Powered by Tercero" footer — controlled by `branding_powered_by` flag, same as all other public pages
- [ ] On page load when status is SENT: calls `markProposalViewed(token)` once — fires on mount, not on re-renders
- [ ] Proposal rendered in default Tercero design style — clean, professional, readable, consistent with preview
- [ ] Sections displayed: title, "Prepared for [name]", validity date, introduction, scope of work, pricing table with line items and grand total, payment terms, contract duration, notes
- [ ] **Accept flow**: prominent green "Accept Proposal" button → confirmation dialog ("By accepting, you agree to the terms outlined in this proposal.") → on confirm calls `acceptProposal(token)` → success state: "You've accepted this proposal. [Agency name] will be in touch shortly."
- [ ] **Decline flow**: ghost "Decline" button → dialog with optional reason textarea → calls `declineProposal(token, reason)` → "You've declined this proposal."
- [ ] After accept/decline: action buttons hidden, replaced by confirmation message; no page reload needed

**⏸ STOP — confirm all 6 page states and both action flows work correctly before proceeding to Section 7.**

---

### Section 7 — PDF Export

**File**: `src/components/proposals/ProposalPDF.jsx`

- [ ] Uses `@react-pdf/renderer` — consistent with `CampaignReportPDF.jsx` and invoice PDF
- [ ] Renders: agency logo, agency name, "Proposal" label, proposal title, "Prepared for: [name]", issue date, validity date
- [ ] All content sections: introduction, scope of work, pricing table (line items + grand total), payment terms, contract duration, notes
- [ ] Professional layout and typography matching Tercero's design language
- [ ] Download triggered from detail page "Export PDF" button using the same `downloadPDF` utility pattern
- [ ] Filename: `Proposal-[ClientOrProspectName]-[YYYY-MM-DD].pdf`

**⏸ STOP — confirm PDF renders correctly and downloads before proceeding to Section 8.**

---

### Section 8 — Per-Client Proposals Tab

**File**: `src/components/proposals/ProposalTab.jsx`

- [ ] `ProposalTab.jsx` component accepts `clientId` prop — uses `useProposals({ clientId })` to scope the list
- [ ] Same list UI as global page: status tabs, search, proposal rows
- [ ] Client filter dropdown omitted (redundant — already on a specific client's page)
- [ ] "New Proposal" button pre-fills the client field in `ProposalDialog`
- [ ] Empty state: "No proposals for this client yet." + New Proposal button
- [ ] Tab added to `ClientProfileView.jsx` after the Documents tab
- [ ] Tab label: "Proposals"

**⏸ STOP — confirm per-client tab is rendering and filtering correctly before proceeding to Section 9.**

---

### Section 9 — Subscription Enforcement

- [ ] `useSubscription` hook updated to read and expose `proposals_limit` from the subscription row
- [ ] `useCreateProposal` mutation correctly counts non-archived proposals before inserting and throws an upgrade error at the limit
- [ ] `ProposalsUpgradePrompt.jsx` renders the upgrade message and CTA correctly
- [ ] Limit counter on global page updates correctly after creating or archiving a proposal
- [ ] Counter is hidden entirely on Velocity+ accounts
- [ ] Trial accounts correctly enforce the 5-proposal limit (same as Ignite)
- [ ] Test: create 5 proposals on an Ignite account → 6th creation attempt opens upgrade prompt, not the create form

**⏸ STOP — confirm subscription enforcement is airtight before proceeding to Section 10.**

---

### Section 10 — Documentation and Final Wiring

- [ ] `app-research.md` updated: Proposals added to Core Modules table, new Section 3.12 Proposals deep-dive written, file map updated with all new files and modified files
- [ ] `feature-tiers-v5.md` updated: Proposals section added to feature matrix, `proposals_limit` column added to DB reference table, seed SQL updated for all plans
- [ ] All routes confirmed working and accessible in `App.jsx`
- [ ] Sidebar nav item shows correct active state when on `/proposals` or `/proposals/:id`
- [ ] End-to-end test: create proposal → copy link → open link in incognito → verify VIEWED status updates → accept → verify ACCEPTED status and accepted_at timestamp in DB
- [ ] Decline flow end-to-end tested with and without a reason
- [ ] Expired status tested: set `valid_until` to yesterday, confirm proposal shows as Expired on list and detail pages
- [ ] Team member access tested: log in as a team member, confirm they can see, edit, and share the owner's proposals
- [ ] Ignite limit tested end-to-end: hit the 5-proposal cap, confirm upgrade prompt appears

**⏸ STOP — Phase 1 is complete. Present full feature to user for review and sign-off before Phase 2 begins.**

---

---

# PHASE 2 — Integration & Templates

**Goal**: Connect accepted proposals to the rest of Tercero. Reduce manual re-entry after a client signs.
**Prerequisite**: Phase 1 stable and in active use.

---

## Scope

**On-acceptance automations** — when a proposal moves to ACCEPTED, Tercero prompts the owner with contextual next steps. These are prompted (not automatic) — the owner confirms each one:

- If prospect: "Would you like to create a client profile for [Prospect Name]?" — pre-fills client form
- "Would you like to create an invoice from this proposal?" — pre-fills with proposal line items, client, payment terms
- If proposal has an end date: "Would you like to create a campaign for this project?" — pre-fills with title, client, date range

**Proposal templates** — save any completed proposal as a reusable template; "Start from template" option in the create flow; templates store introduction, scope, line items, payment terms, contract duration (never client or title)

**Email delivery** — "Send via Email" button on detail page; calls new Edge Function `send-proposal-email`; subject: "Proposal from [Agency Name]: [Proposal Title]"; updates `sent_at`

**Cloning** — "Duplicate" action on any proposal; creates a new DRAFT with all fields copied, title prefixed "Copy of —"

---

## Phase 2 Checklist

- [ ] On-acceptance prompt: convert prospect to client (pre-filled form)
- [ ] On-acceptance prompt: generate first invoice from proposal pricing
- [ ] On-acceptance prompt: create campaign (conditional — only when end date exists)
- [ ] Proposal templates — save as template action on detail page
- [ ] Proposal templates — "start from template" option in create flow
- [ ] `send-proposal-email` Edge Function (Resend, same pattern as `send-campaign-review-email`)
- [ ] "Send via Email" button and confirmation dialog on detail page
- [ ] Clone / Duplicate action on detail page and proposal list
- [ ] `app-research.md` and `feature-tiers-v5.md` updated to reflect Phase 2

**⏸ STOP — Phase 2 complete. Present to user for review before Phase 3 begins.**

---

---

# PHASE 3 — AI-Powered Proposals

**Goal**: AI-assisted proposal writing. Two tiers of capability.
**Prerequisite**: Phase 2 stable. AI post generation feature already live (shared Edge Function infrastructure).

---

## Phase 3a — AI Introduction Generator (Velocity+)

A "Write with AI" button next to the introduction field. Owner's client, industry, and services are pre-loaded as context. AI generates a professional 2–3 paragraph introduction that streams into the field. Owner can accept, edit, or discard — never overwrites without confirmation.

Uses the same `generate-content` Edge Function as post caption generation.

**Tier**: Velocity+. Locked with tooltip on Ignite: "Upgrade to Velocity to use AI writing."

---

## Phase 3b — Full AI Proposal Generator (Quantum only)

Owner fills a brief form (client, industry, services, deliverable types, budget range, tone, talking points). Claude generates a complete proposal — all sections, all fields populated. Owner reviews and edits before saving. Optional PDF template upload to mirror an existing proposal's structure and tone.

**Tier**: Quantum only.

### New DB Columns

```sql
ai_proposal_intro      boolean  default false   -- Velocity+
ai_proposal_generation boolean  default false   -- Quantum only
```

| Plan     | `ai_proposal_intro` | `ai_proposal_generation` |
| -------- | ------------------- | ------------------------ |
| Trial    | false               | false                    |
| Ignite   | false               | false                    |
| Velocity | true                | false                    |
| Quantum  | true                | true                     |

---

## Phase 3 Checklist

- [ ] `ai_proposal_intro` and `ai_proposal_generation` columns added to `agency_subscriptions`
- [ ] Seed SQL updated for all plans
- [ ] `useSubscription` exposes both new flags
- [ ] "Write with AI" button added next to introduction field in `ProposalDialog` and `ProposalDetailPage` — Velocity+ only; shows lock tooltip on Ignite
- [ ] Edge Function handles proposal intro generation (reuse `generate-content` with proposal-specific system prompt, or create `generate-proposal-intro`)
- [ ] Streaming response into introduction field with accept / discard UI — never overwrites existing content without user action
- [ ] Full AI proposal generator — Quantum only, gated by `ai_proposal_generation` flag
- [ ] Brief form: client/industry, services, deliverables, budget range, tone, talking points
- [ ] Optional PDF template upload for structure/tone mirroring — Quantum only
- [ ] Claude API call via Edge Function with structured JSON output for all proposal fields
- [ ] Generated content loaded into `ProposalDialog` for review and editing before saving as DRAFT
- [ ] `app-research.md` and `feature-tiers-v5.md` updated

**⏸ STOP — Phase 3 complete. Present to user for review.**

---

---

# Summary

| Phase        | What                                                                           | Tier                        | Prerequisite                      |
| ------------ | ------------------------------------------------------------------------------ | --------------------------- | --------------------------------- |
| **Phase 1**  | Core build — create, preview, share link, accept/decline, PDF, status tracking | All tiers (5 cap on Ignite) | Teams Phase 1 done                |
| **Phase 2**  | On-acceptance automations, templates, email delivery, cloning                  | All tiers                   | Phase 1 stable                    |
| **Phase 3a** | AI introduction generator                                                      | Velocity+                   | Phase 2 stable + AI post gen live |
| **Phase 3b** | Full AI generator + template upload                                            | Quantum only                | Phase 3a done                     |

---

# Key Design Decisions (Confirmed)

| Decision                      | Choice                                                                                  |
| ----------------------------- | --------------------------------------------------------------------------------------- |
| Create/Edit layout            | Left form / right live preview — matches `EditInvoiceDialog` + `HTMLInvoicePreview.jsx` |
| Default proposal style        | Tercero default design — no custom client branding in Phase 1 or 2                      |
| VIEWED status                 | Auto-tracked on first public page load, not manual                                      |
| Prospect support              | Proposal can target a prospect (free text) or an existing client record                 |
| Sidebar gating                | Nav item always visible; limit only enforced at point of creation                       |
| Teams compatibility           | RLS uses `get_my_agency_user_id()` helper from day one                                  |
| Public page branding          | Identical whitelabeling to all other public pages                                       |
| AI in Phase 1                 | Excluded — get the core stable first                                                    |
| AI introduction (Phase 3a)    | Velocity+                                                                               |
| Full AI generation (Phase 3b) | Quantum only                                                                            |
