# Tercero — Proposals Feature

**Status**: Phase 1 Complete — Phase 2 Pending
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
SENT       → Share link has been copied/shared, or manually marked as Sent.
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

**SENT transition — two paths:**
1. **Copy Link** — generates/reuses the share token, copies URL to clipboard, automatically advances DRAFT → SENT.
2. **Mark as Sent** — manual button on the detail page (visible when status is DRAFT). Use this when the agency exports the PDF and sends it via email or WhatsApp outside Tercero.

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

# PHASE 1 — Core Build ✅ COMPLETE

**Goal**: Working proposal creation, sharing, and acceptance flow with professional default Tercero design.
**Prerequisite**: Teams Phase 1 complete — `get_my_agency_user_id()` SECURITY DEFINER helper must exist in the database.

---

### Section 1 — Database ✅

- [x] Add `proposals_limit integer default 5` column to `agency_subscriptions`
- [x] Update seed SQL for all plans (Trial=5, Ignite=5, Velocity=null, Quantum=null)
- [x] Create `proposals` table with all columns as defined in the data model above
- [x] Create `proposal_line_items` table with `on delete cascade` on `proposal_id`
- [x] Write RLS policy for `proposals` using `get_my_agency_user_id()` pattern
- [x] Write RLS policy for `proposal_line_items` (access via proposal ownership)
- [x] Write `get_proposals_with_totals` RPC — returns proposals list with sum of line item amounts as `total_value`
- [x] Write `get_proposal_by_token(p_token)` public SECURITY DEFINER RPC — returns full proposal data + agency branding flags joined from `agency_subscriptions`
- [x] Write `mark_proposal_viewed(p_token)` public SECURITY DEFINER RPC
- [x] Write `accept_proposal(p_token)` public SECURITY DEFINER RPC
- [x] Write `decline_proposal(p_token, p_reason text)` public SECURITY DEFINER RPC
- [x] Write `generate_proposal_token(p_proposal_id uuid)` authenticated RPC

---

### Section 2 — API Layer ✅

**File**: `src/api/proposals.js`

- [x] `useProposals({ clientId? })` — React Query hook
- [x] `useProposal(proposalId)` — fetches single proposal with its `proposal_line_items`
- [x] `useCreateProposal()` — mutation with limit check + `ProposalLimitError`
- [x] `useUpdateProposal()` — updates proposal fields and replaces line items (with rollback safety — see bugs fixed below)
- [x] `useDeleteProposal()` — hard delete if DRAFT; archive otherwise
- [x] `useGenerateProposalToken()` — calls `generate_proposal_token` RPC
- [x] `useMarkProposalSent()` — advances DRAFT → SENT with `sent_at` timestamp
- [x] `fetchProposalByToken(token)` — plain async, no auth
- [x] `markProposalViewed(token)` — plain async, no auth
- [x] `acceptProposal(token)` — plain async, no auth
- [x] `declineProposal(token, reason)` — plain async, no auth
- [x] `uploadProposalFile(proposalId, workspaceUserId, file)` — uploads to `proposal-files` bucket, tracks storage
- [x] `deleteProposalFile(fileUrl)` — removes file from storage

---

### Section 3 — Create/Edit Dialog ✅

**File**: `src/components/proposals/ProposalDialog.jsx`
**File**: `src/components/proposals/ProposalPreview.jsx`

- [x] Two-panel layout — left form, right live preview
- [x] Title, client/prospect selector, validity date, introduction, scope, payment terms, contract duration, notes, line items
- [x] Prospect mode: "New Prospect" option reveals name + email fields
- [x] Zod validation — title required, at least one line item required
- [x] Create + edit mode (pre-fills when `proposalId` provided)
- [x] On save as DRAFT — closes dialog, shows success toast
- [x] **Extra (not in original spec)**: "Upload Existing File" path — `UploadProposalDialog.jsx` accepts PDF upload, creates `proposal_type: 'uploaded'` record, navigates to detail page. Enables agencies to use Tercero tracking for externally-built proposals.

---

### Section 4 — Global Proposals Page ✅

**File**: `src/pages/proposals/ProposalsPage.jsx`

- [x] Route `/proposals` added to `App.jsx`
- [x] Proposals nav item in sidebar
- [x] "New Proposal" dropdown — "Build in Tercero" or "Upload Existing File"
- [x] Ignite/Trial: limit counter ("X of 5 used"); hidden on Velocity+
- [x] Status filter tabs: All / Draft / Sent / Viewed / Accepted / Declined / Expired / Archived
- [x] Client filter dropdown (includes Prospects filter)
- [x] Search by title, client name, or prospect name
- [x] Proposal list: title, client/prospect, status badge, total value, valid until, created date
- [x] Row click navigates to `/proposals/:proposalId`
- [x] Empty state with CTA

---

### Section 5 — Proposal Detail Page ✅

**File**: `src/pages/proposals/ProposalDetailPage.jsx`

- [x] Route `/proposals/:proposalId` added to `App.jsx`
- [x] Left-form / right-preview layout (built proposals); single-column with iframe (uploaded proposals)
- [x] Action bar: **Copy Link**, **Mark as Sent**, **Export PDF**, **Archive**, **Delete**
  - Copy Link: generates/reuses token, copies URL, auto-advances DRAFT → SENT
  - Mark as Sent: manual transition for when PDF is sent outside Tercero (visible when status is DRAFT)
  - Export PDF: available for built proposals only
  - Archive: available for all non-archived statuses; confirmation dialog
  - Delete: DRAFT only; hard delete with confirmation
- [x] Status timeline: Created → Sent → Viewed → Accepted/Declined
- [x] Decline reason displayed when status is DECLINED
- [x] ACCEPTED and DECLINED → read-only (fields disabled, lock icon)
- [x] Auto-save on blur — debounced 300 ms to prevent concurrent saves when tabbing fields
- [x] Uploaded proposal: iframe PDF viewer + Download + Replace File buttons

---

### Section 6 — Public Proposal Page ✅

**File**: `src/pages/proposals/ProposalReview.jsx`

- [x] Route `/proposal/:token` — outside AppShell, fully unauthenticated
- [x] 6 states: Loading, Invalid token, Expired, Already accepted, Already declined, Active
- [x] Agency branding in header (identical whitelabeling to all other public pages)
- [x] "Powered by Tercero" footer controlled by `branding_powered_by` flag
- [x] Auto-tracks first view (SENT → VIEWED) on page load
- [x] Accept flow: green button → confirmation dialog → success state
- [x] Decline flow: ghost button → reason textarea dialog → declined state
- [x] Uploaded proposals: PDF iframe with download fallback link

---

### Section 7 — PDF Export ✅

**File**: `src/components/proposals/ProposalPDF.jsx`
**File**: `src/utils/downloadProposalPDF.jsx`

- [x] `@react-pdf/renderer` — agency logo, title, prepared-for, dates, all content sections, pricing table, grand total
- [x] Filename: `Proposal-[ClientOrProspectName]-YYYY-MM-DD.pdf`
- [x] Canvas-rasterised Tercero SVG logo fallback when no agency branding

---

### Section 8 — Per-Client Proposals Tab ✅

**File**: `src/components/proposals/ProposalTab.jsx`

- [x] Accepts `clientId` prop — scopes to that client
- [x] Status tabs, search, proposal rows — same UI as global page
- [x] Client filter omitted when scoped
- [x] "New Proposal" pre-fills client field
- [x] Empty state
- [x] Tab added to `ClientProfileView.jsx`

---

### Section 9 — Subscription Enforcement ✅

- [x] `useSubscription` exposes `proposals_limit`
- [x] `useCreateProposal` throws `ProposalLimitError` at limit
- [x] `ProposalsUpgradePrompt.jsx` upgrade dialog
- [x] Counter visible on Ignite/Trial, hidden on Velocity+

---

## Phase 1 — Bugs Fixed (Post-Launch)

These issues were identified after the initial build and patched in March 2026.

### 1. Orphaned files on Replace File
**Bug**: `handleReplaceFile` uploaded a new file at a new path (including `Date.now()` in path) but never deleted the old file. Each replace created an orphan in the `proposal-files` bucket.
**Fix**: Capture `proposal.file_url` before uploading. After the DB record updates successfully, call `deleteProposalFile(oldFileUrl)` to clean up the previous file.
**File**: `src/pages/proposals/ProposalDetailPage.jsx`

### 2. Auto-save race condition on rapid field blur
**Bug**: `autoSave` fired immediately on every `onBlur`. Tabbing through multiple form fields triggered concurrent saves, each doing a delete-all + re-insert of line items. Concurrent saves could clobber each other.
**Fix**: `autoSave` is now internally debounced with a 300 ms timer (`autoSaveTimerRef`). Rapid blurs within 300 ms collapse into a single save. Removed all `setTimeout(autoSave, 0)` wrappers — the 300 ms debounce already guarantees form values are settled.
**File**: `src/pages/proposals/ProposalDetailPage.jsx`

### 3. Non-atomic line item replacement
**Bug**: `useUpdateProposal` deleted all line items then re-inserted. If the insert failed, line items were permanently lost with no recovery path.
**Fix**: Fetch existing items before deleting. If the re-insert fails, immediately attempt to restore the original items before re-throwing the error.
**File**: `src/api/proposals.js`

### 4. Client name missing in detail page header
**Bug**: `ProposalDetailPage` computed `displayName` from `proposal.client_name`, but `useProposal` fetches raw `proposals` rows which have no `client_name` column. Client-linked proposals showed no name in the header.
**Fix**: Derive display name from `clients.find(c => c.id === proposal.client_id)?.name` using the already-loaded clients data, falling back to `proposal.prospect_name`.
**File**: `src/pages/proposals/ProposalDetailPage.jsx`

### 5. No manual "Mark as Sent" path
**Gap**: Status advanced to SENT only when "Copy Link" was clicked. If an agency exported the PDF and sent it via email/WhatsApp outside Tercero, the proposal stayed in DRAFT indefinitely, breaking tracking.
**Fix**: Added "Mark as Sent" button in the detail page action bar (visible when status is DRAFT). Calls `useMarkProposalSent` directly. Button is subtle (muted outline) since Copy Link is the primary flow.
**File**: `src/pages/proposals/ProposalDetailPage.jsx`

---

---

# PHASE 2 — Integration & Automations

**Goal**: Connect accepted proposals to the rest of Tercero. Reduce manual re-entry after a client signs.
**Prerequisite**: Phase 1 stable and in active use.

---

## Scope

### 2a — On-Acceptance Automations (Priority 1)

When a proposal moves to ACCEPTED, Tercero prompts the owner with contextual next steps. These are prompted actions — never automatic. Owner confirms each one.

**Prospect → Client conversion** (when `client_id` is null):
> "**[Prospect Name]** accepted this proposal. Ready to onboard them as a client?"
> → **Create Client** button → opens `CreateClientPage` pre-filled with `prospect_name` and `prospect_email`
> → This is the Phase 2 piece of the broader "Prospect → Client" pipeline

This banner appears on the `ProposalDetailPage` when `status === 'accepted'` and `client_id` is null. It replaces the need for a separate prospects module — proposals serve as the pre-engagement record, and acceptance triggers conversion.

**Generate Invoice prompt** (for all accepted proposals with line items):
> "Would you like to create an invoice from this proposal?"
> → pre-fills invoice with proposal line items, client, payment terms

**Create Campaign prompt** (conditional — only when `valid_until` exists):
> "Would you like to create a campaign for this project?"
> → pre-fills campaign with proposal title, client, date range

### 2b — Email Delivery

"Send via Email" button on the detail page (visible when status is `draft` or `sent`). Calls new Edge Function `send-proposal-email`. Subject: "Proposal from [Agency Name]: [Proposal Title]". Advances status to SENT and sets `sent_at`.

Edge function pattern: identical to `send-campaign-review-email` — Resend, accepts `to`, `subject`, `agency_name`, `proposal_url`.

### 2c — Duplicate Proposal

"Duplicate" action on detail page and list row menu. Creates a new DRAFT with all fields copied, title prefixed "Copy of —". Useful for retainer renewals and repeat pitches.

### 2d — Proposal Templates

Save any completed proposal as a reusable template. "Start from template" in the create flow. Templates store: introduction, scope, line items, payment terms, contract duration. Never store client, title, or dates.

---

## Phase 2 Checklist

- [ ] On-acceptance banner: convert prospect to client — pre-filled `CreateClientPage`
- [ ] On-acceptance prompt: generate first invoice from proposal pricing
- [ ] On-acceptance prompt: create campaign (conditional on `valid_until`)
- [ ] `send-proposal-email` Edge Function (Resend, same pattern as `send-campaign-review-email`)
- [ ] "Send via Email" button and dialog on detail page
- [ ] Clone / Duplicate action on detail page and proposal list
- [ ] Proposal templates — save as template + "start from template" in create flow
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
