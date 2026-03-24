# Feature: Prospect Tracker
**File**: `.claude/features/feature-prospects.md`
**Status**: Phase 1 — Ready to build
**Last Updated**: March 2026

---

## Overview

A lightweight CRM-style prospect tracker that sits **upstream** of Proposals and Clients in the Tercero agency lifecycle:

```
Prospect → Proposal → Client → Deliverables / Finance
```

Agency owners generate leads via scraping tools (Apollo, Apify, Google Maps) or AI lead gen — these produce CSV exports with raw contact data. The Prospect Tracker is where those leads land, get worked through a sales pipeline, and eventually convert into Clients.

**Not gated** — available on all plans (Trial, Ignite, Velocity, Quantum). No feature flag needed. Follows the same access pattern as Clients and Meetings.

---

## Data Model

Two conceptual layers in one table:

### Layer 1 — Lead Data (populated at import)
Raw contact fields that match what scraping tools export. This is reference data — it doesn't change much after import.

### Layer 2 — CRM Data (managed in-app)
Pipeline fields the agency owner updates as they work the lead. This is living data.

### `prospects` Table

```sql
CREATE TABLE prospects (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Layer 1: Lead data (from scraping tools / CSV import)
  business_name       text        NOT NULL,
  contact_name        text,
  email               text,
  phone               text,
  website             text,
  location            text,                        -- city / area (e.g. "Mumbai", "Bandra, Mumbai")
  address             text,                        -- full street address (Google Maps exports this)
  instagram           text,                        -- handle or full URL
  linkedin            text,                        -- profile URL

  -- Layer 2: CRM data (managed in-app)
  industry            text,                        -- reuses INDUSTRY_OPTIONS from @/lib/industries.js
  source              text        NOT NULL DEFAULT 'manual',
  status              text        NOT NULL DEFAULT 'new',
  last_contacted_at   timestamptz,
  next_followup_at    timestamptz,
  notes               text,

  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE prospects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prospects_workspace_policy" ON prospects
  FOR ALL USING (user_id = (SELECT get_my_agency_user_id()));

-- Indexes
CREATE INDEX prospects_user_id_idx ON prospects (user_id);
CREATE INDEX prospects_status_idx  ON prospects (user_id, status);
CREATE INDEX prospects_followup_idx ON prospects (user_id, next_followup_at);
```

### Status Values

| Value | Label | Meaning |
|---|---|---|
| `new` | New | Just imported, not yet contacted |
| `contacted` | Contacted | First outreach sent |
| `follow_up` | Follow-Up | Awaiting reply, needs a nudge |
| `demo_scheduled` | Demo Scheduled | Call or meeting booked |
| `proposal_sent` | Proposal Sent | Formal proposal shared |
| `won` | Won | Became a client |
| `lost` | Lost | Not interested / didn't convert |

### Source Values

| Value | Label |
|---|---|
| `manual` | Manual Entry |
| `apollo` | Apollo |
| `apify` | Apify |
| `google_maps` | Google Maps |
| `referral` | Referral |
| `cold_outreach` | Cold Outreach |
| `instagram` | Instagram |
| `linkedin` | LinkedIn |
| `other` | Other |

---

## CSV Import Template

Fixed column definition. The template is designed to match what Apollo, Apify, and Google Maps scraping tools naturally output — agencies can import directly with minimal reformatting.

**Template columns (exact header names):**

```
Business Name, Contact Name, Email, Phone, Website, Location, Address, Instagram, LinkedIn
```

**Mapping rules:**

| CSV Column | Maps to DB field | Required |
|---|---|---|
| Business Name | `business_name` | Yes — row skipped if blank |
| Contact Name | `contact_name` | No |
| Email | `email` | No |
| Phone | `phone` | No |
| Website | `website` | No |
| Location | `location` | No |
| Address | `address` | No |
| Instagram | `instagram` | No |
| LinkedIn | `linkedin` | No |

**Layer 2 defaults on import (set in the import dialog, applied to entire batch):**
- `source` → user selects from source dropdown in the import dialog (defaults to `manual`)
- `status` → always `new`
- `industry`, `notes`, `last_contacted_at`, `next_followup_at` → blank

**Validation:**
- Skip rows where `Business Name` is empty
- Show a summary after import: "47 imported, 3 skipped (missing Business Name)"
- Duplicate detection: warn if email already exists in workspace prospects (don't block — let user decide)

---

## Phase 1 — Core Tracker

### What gets built
- `prospects` table + RLS migration
- `/prospects` route + sidebar nav entry
- Data table with search + status filter
- CSV import dialog (upload → set source → import → summary)
- Manual "Add Prospect" sheet
- Prospect detail/edit sheet (all fields, status update)

### File Map

```
src/
  api/
    prospects.js                          ← React Query hooks + plain mutations
  pages/
    prospects/
      ProspectsPage.jsx                   ← Main list page (/prospects)
  components/
    prospects/
      ProspectSheet.jsx                   ← Detail + edit sheet (open on row click)
      AddProspectDialog.jsx               ← Manual add form (dialog)
      ImportProspectsDialog.jsx           ← CSV import flow (dialog)
      ProspectStatusBadge.jsx             ← Coloured status badge
      ProspectSourceBadge.jsx             ← Source label badge
```

### API Layer — `src/api/prospects.js`

**Hooks (reads):**
```js
useProspects({ search, status })          // list with filters
// queryKey: ['prospects', 'list', { search, status }]
```

**Mutations (plain async functions used with useMutation):**
```js
createProspect(fields)                    // single manual create
importProspects(rows, source)            // bulk insert array
updateProspect(id, fields)               // partial update
deleteProspect(id)                        // hard delete (no archive needed)
```

### Data Table Columns

Displayed columns in the table (curated — not all fields):

| Column | Source | Notes |
|---|---|---|
| Business Name | Layer 1 | Primary identifier, clickable → opens sheet |
| Contact Name | Layer 1 | |
| Email | Layer 1 | Truncated if long |
| Location | Layer 1 | |
| Status | Layer 2 | `ProspectStatusBadge` |
| Next Follow-up | Layer 2 | Formatted via `formatDate()`; highlighted if overdue |
| Source | Layer 2 | `ProspectSourceBadge` |
| Created | — | `formatDate(created_at)` |

Hidden in table, visible in detail sheet: `phone`, `website`, `instagram`, `linkedin`, `address`, `industry`, `notes`, `last_contacted_at`.

### ProspectSheet Layout

Two sections:

**Contact Card (Layer 1 — top half)**
- Business name (large, editable)
- Contact name, email, phone (inline editable)
- Website, Instagram, LinkedIn as clickable links
- Location / address

**Pipeline Section (Layer 2 — bottom half)**
- Status dropdown (full 7-step list)
- Industry select (reuses `INDUSTRY_OPTIONS`)
- Source select
- Last contacted date picker
- Next follow-up date picker
- Notes textarea (free text)

Save on explicit "Save" button (not auto-save — pipeline fields need intentional updates).

### Import Flow (ImportProspectsDialog)

**Step 1 — Upload**
- Drag-and-drop or file picker (`.csv` only)
- "Download Template" button — downloads the fixed-column CSV template
- Brief explanation: "Upload a CSV from Apollo, Apify, Google Maps, or our template"

**Step 2 — Configure**
- Source selector: "Where did these leads come from?" (source dropdown)
- Preview table: first 5 rows of detected data with column headers
- Count of rows detected
- Duplicate warning if any emails already exist in the workspace

**Step 3 — Import**
- "Import X prospects" button
- Progress indicator for large files
- Success summary: "47 imported · 3 skipped (missing Business Name) · 2 duplicates (kept)"

### Sidebar Nav

Add between Clients and Proposals in `src/components/sidebar/nav-main.jsx`:

```js
{ title: 'Prospects', url: '/prospects', icon: Target }
```

No `requiresFlag` — ungated on all plans.

Import `Target` from `lucide-react`.

### Route

Add to `src/App.jsx` inside the protected route group:

```jsx
import ProspectsPage from './pages/prospects/ProspectsPage'
// ...
<Route path="/prospects" element={<ProspectsPage />} />
```

Position between `/clients` routes and `/proposals`.

### Phase 1 Checklist

- [x] DB migration: `prospects` table + RLS policy + indexes
- [x] `src/api/prospects.js` — `useProspects`, `createProspect`, `importProspects`, `updateProspect`, `deleteProspect`
- [x] Route added to `App.jsx`
- [x] Sidebar nav entry added to `nav-main.jsx` (between Clients and Proposals)
- [x] `ProspectsPage.jsx` — data table, search bar, status filter, empty state
- [x] `ProspectStatusBadge.jsx` — colour-coded badge for all 7 status values
- [x] `ProspectSourceBadge.jsx` — label badge for source values
- [x] `AddProspectDialog.jsx` — manual add form (React Hook Form + Zod, all fields)
- [x] `ProspectSheet.jsx` — detail/edit sheet (Layer 1 contact card + Layer 2 pipeline section)
- [x] `ImportProspectsDialog.jsx` — 3-step CSV import (upload → configure → import)
- [x] CSV template file available for download from the import dialog
- [x] Overdue follow-up highlight in the table (next_followup_at < today → amber/red)
- [x] Delete prospect with `AlertDialog` confirmation
- [x] `useHeader()` called in ProspectsPage with title "Prospects"

### Implementation Notes
- Phase 1 complete — March 2026
- CSV header auto-detection uses a normalised lowercase lookup table covering common variations from Apollo, Apify, Google Maps, and manual sheets
- `business_name` is the required field; rows without it are skipped at import time with a count shown in the summary
- Duplicate email detection is advisory only (warns but still imports)
- Source is set per-batch at import time via a dropdown — not per-row in the CSV
- Sheet uses `form id` + external submit button pattern to keep the footer sticky outside the scroll area
- `Target` icon from lucide-react used for the sidebar nav item and empty state

---

## Phase 2 — Prospect Detail Page & Linked Records

**Status**: Planned — build in this order. Each sub-phase is independently deployable.

---

### Phase 2a — Prospect Detail Page ✳️ Build first

Replace the sheet with a full dedicated page at `/prospects/:prospectId`. Same structural pattern as `ClientDetails` — header strip + tabbed content.

#### Route
```
/prospects/:prospectId     → ProspectDetailPage
```

Add to `App.jsx` immediately after the `/prospects` route:
```jsx
import ProspectDetailPage from './pages/prospects/ProspectDetailPage'
<Route path="/prospects/:prospectId" element={<ProspectDetailPage />} />
```

List row click in `ProspectsPage` navigates to the detail page instead of opening the sheet. `ProspectSheet` is retired — the detail page replaces it entirely.

#### Page Layout

**Header strip** (above tabs):
- Business name — large, prominent
- Contact name + email as subtitle
- `ProspectStatusBadge` + `ProspectSourceBadge` inline
- Quick-link buttons: Website / Instagram / LinkedIn (open in new tab, only rendered if value exists)
- Action buttons (top-right): Edit (opens inline edit mode on Overview tab) · Delete (AlertDialog)

**Tabs:**

| Tab | Component | Contents |
|---|---|---|
| Overview | `ProspectOverviewTab` | Contact card (Layer 1) + Pipeline section (Layer 2) |
| Outreach | `ProspectOutreachTab` | Activity log — deferred to Phase 2b |
| Notes | (Phase 2c) | Notes linked to this prospect |
| Meetings | (Phase 2c) | Meetings linked to this prospect |
| Documents | (Phase 2c) | Files linked to this prospect |

Phase 2a ships with just **Overview** tab visible. Outreach / Notes / Meetings / Documents tabs are added in their respective sub-phases.

#### Overview Tab — Edit Pattern

Two modes:
- **View mode** — read-only display of all fields, clean layout with labels + values
- **Edit mode** — form fields replace display values (React Hook Form + Zod), Save / Cancel buttons appear

Toggle via an "Edit" button in the page header. On save, call `useUpdateProspect`. No auto-save — explicit save only.

#### File Map (Phase 2a)
```
src/
  pages/
    prospects/
      ProspectDetailPage.jsx        ← Shell: header + tabs routing
      prospectSections/
        ProspectOverviewTab.jsx     ← View/edit for all prospect fields
```

#### Phase 2a Checklist ✅ Complete
- [x] Add `/prospects/:prospectId` route to `App.jsx`
- [x] `ProspectDetailPage.jsx` — header strip with name, badges, quick-links, actions
- [x] `ProspectOverviewTab.jsx` — view mode (all fields displayed) + edit mode (form)
- [x] `ProspectsPage.jsx` — row click navigates to `/prospects/:prospectId` (remove sheet open)
- [x] `useProspect(id)` hook added to `src/api/prospects.js` for single-record fetch
- [x] `useHeader()` called with breadcrumbs: `Prospects → [business_name]`
- [x] Delete from detail page header with `AlertDialog` (navigates back to `/prospects` on confirm)
- [x] `ProspectSheet.jsx` retired and deleted

---

### Phase 2b — Outreach Log

Timestamped activity trail per prospect. Distinct from Notes — this is a chronological log of touchpoints, not freeform thoughts.

#### DB Migration
```sql
CREATE TABLE prospect_activities (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id  uuid        NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  user_id      uuid        NOT NULL,
  type         text        NOT NULL DEFAULT 'note',
  -- type values: 'call' | 'email' | 'dm' | 'meeting' | 'note' | 'status_change'
  body         text,
  metadata     jsonb,
  -- metadata examples:
  -- status_change: { from_status: 'new', to_status: 'contacted' }
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE prospect_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prospect_activities_workspace_policy" ON prospect_activities
  FOR ALL USING (user_id = (SELECT get_my_agency_user_id()));

CREATE INDEX prospect_activities_prospect_idx ON prospect_activities (prospect_id, created_at DESC);
```

Auto-log status changes: when `status` is updated via `useUpdateProspect`, insert a `status_change` activity entry in the same mutation.

#### Outreach Tab UI
- Chronological feed (newest first)
- Entry card: type icon + body text + timestamp
- "Log Activity" button: type selector (Call / Email / DM / Meeting / Note) + text field + date (defaults to today)
- Status change entries are auto-generated (not manually editable)

#### File Map (Phase 2b)
```
src/
  api/
    prospectActivities.js           ← useProspectActivities(prospectId), useLogActivity()
  pages/
    prospects/
      prospectSections/
        ProspectOutreachTab.jsx     ← Activity feed + log activity form
```

#### Phase 2b Checklist ✅ Complete
- [x] DB migration: `prospect_activities` table + RLS + index
- [x] `src/api/prospectActivities.js` — `useProspectActivities`, `useLogActivity`, `useDeleteActivity`, `logStatusChange`
- [x] Auto-log status changes inside `useUpdateProspect` via `_prevStatus` param + `logStatusChange` helper
- [x] `ProspectOutreachTab.jsx` — date-grouped feed + inline log activity form (collapsible)
- [x] Outreach tab wired into `ProspectDetailPage`
- [x] Edit button hidden when Outreach tab is active (only relevant on Overview)

#### Implementation Notes
- `occurred_at` field added to activities (separate from `created_at`) so users can backdate entries
- Status change entries auto-generated body text: "Status changed from X to Y"
- Status change entries cannot be manually deleted (system-generated) — only manual entries show the delete button
- Activities grouped by date in the feed (Today / Yesterday / full date)
- `logStatusChange` is a plain async helper (not a hook) so it can be called inside `useUpdateProspect`'s mutationFn

---

### Phase 2c — Link Documents to Prospects ✅ Complete

**Scope decision:** Notes and Meetings tabs were intentionally skipped. The Outreach tab (Phase 2b) already covers meeting and note activity logging via `type: 'meeting'` and `type: 'note'` entries. Adding separate Notes/Meetings tabs would create two places to log the same thing for a pre-client record. Documents are kept because files genuinely need to attach and transfer on conversion.

**Document attachment to outreach log entries was also considered and rejected.** The Documents tab is the file cabinet; the Outreach tab is the timeline. Uploading to Documents and logging the activity in Outreach separately is sufficient for the prospect lifecycle.

#### DB Migration
```sql
-- Documents only (notes and meetings skipped — covered by Outreach tab)
ALTER TABLE client_documents
  ADD COLUMN prospect_id uuid REFERENCES prospects(id) ON DELETE SET NULL;
CREATE INDEX client_documents_prospect_id_idx ON client_documents (prospect_id);

-- client_id made nullable to support prospect documents (no client association)
ALTER TABLE client_documents ALTER COLUMN client_id DROP NOT NULL;

-- category CHECK constraint expanded to include prospect-specific categories
ALTER TABLE client_documents
  DROP CONSTRAINT client_documents_category_check,
  ADD CONSTRAINT client_documents_category_check CHECK (
    category = ANY (ARRAY[
      'Contract', 'NDA', 'Brand Guidelines', 'Creative Brief', 'Brand Assets',
      'Meeting Notes', 'Invoice / Finance', 'SOP', 'Other',
      'Proposal', 'Pitch Deck', 'Case Study', 'Discovery Notes'
    ])
  );
```

#### What was built

**API (`src/api/documents.js`):**
- `useDocuments({ prospectId })` — filters by `prospect_id` when provided
- `uploadDocument({ prospectId })` — uses `{workspaceUserId}/prospects/{prospectId}/{documentId}/{filename}` storage path; sets `prospect_id`, leaves `client_id` null
- `useDocuments` select joins `prospects(business_name)` alongside `clients` for display in global list

**New component (`src/pages/prospects/prospectSections/ProspectDocumentsTab.jsx`):**
- Purpose-built lighter version — no collections, no status sub-tabs (Active/Archived), no archive flow
- Upload zone + search + category filter (prospect categories only)
- Reuses `DocumentCard`, `DocumentUploadZone`, `UploadMetaDialog`
- Shows only Active documents

**`ProspectDetailPage.jsx`:** Documents tab added (Outreach → Overview → Documents)

**`DocumentsTab.jsx` (client tab) — unchanged.** Prospect documents don't appear in client context; client documents don't appear in prospect context.

**`DocumentCard.jsx`:** Falls back to `doc.prospects?.business_name` when `doc.clients` is null — prospect docs show the prospect name in the global list.

**`DocumentsPage.jsx` (global page):**
- Filter dropdown now includes a Prospects group alongside Clients
- When a prospect is selected: Collections tab + Ungrouped tab hidden; New Collection button hidden; category filter switches to prospect categories; auto-switches away from Collections/Ungrouped tabs
- Upload dialog "Link to" selector includes a Prospects group

**`UploadMetaDialog.jsx`:**
- "Client" selector renamed to "Link to" with three groups: Workspace, Clients, Prospects
- Values encoded as `client:uuid` / `prospect:uuid`; parsed before `onConfirm` — callers receive clean `{ clientId, prospectId }`
- `categories` prop added (defaults to `DOCUMENT_CATEGORIES`); when `showClientSelector` is true, dynamically switches between `DOCUMENT_CATEGORIES` and `PROSPECT_DOCUMENT_CATEGORIES` based on the selected link target; resets category field on switch

**`DocumentCategoryBadge.jsx`:** Prospect category colours added — violet (Proposal), cyan (Pitch Deck), amber (Case Study), teal (Discovery Notes).

**`PROSPECT_DOCUMENT_CATEGORIES`** exported from `UploadMetaDialog.jsx`:
`Proposal`, `Pitch Deck`, `Case Study`, `NDA`, `Discovery Notes`, `Contract`, `Other`
> ⚠️ `Proposal` will be removed in Phase 2d — proposals move to the dedicated Proposals tab.

#### File Map (Phase 2c)
```
src/
  api/
    documents.js                              ← prospectId support in useDocuments + uploadDocument
  pages/
    prospects/
      prospectSections/
        ProspectDocumentsTab.jsx              ← Purpose-built prospect documents tab
    documents/
      DocumentsPage.jsx                       ← Prospect filter + prospect-aware upload
  components/
    documents/
      DocumentCard.jsx                        ← Prospect name fallback
      DocumentCategoryBadge.jsx               ← Prospect category colours
      UploadMetaDialog.jsx                    ← Link to selector + dynamic categories
```

#### Phase 2c Checklist
- [x] DB migration: `prospect_id` FK on `client_documents` + `client_id` made nullable
- [x] DB constraint: `category` CHECK expanded for prospect categories
- [x] `useDocuments` updated to accept `{ prospectId }` filter
- [x] `uploadDocument` accepts `prospectId` — prospect-scoped storage path
- [x] `useDocuments` joins `prospects(business_name)` for global list display
- [x] `ProspectDocumentsTab.jsx` — purpose-built tab (no collections, active docs only)
- [x] Documents tab wired into `ProspectDetailPage` (3rd tab after Outreach, Overview)
- [x] `DocumentCard` shows prospect name when `client_id` is null
- [x] `UploadMetaDialog` — "Link to" selector with Prospects group + dynamic category switching
- [x] `DocumentsPage` — prospect filter, prospect-aware upload, hides collections UI for prospects
- [x] `PROSPECT_DOCUMENT_CATEGORIES` constant + colours in `DocumentCategoryBadge`
- [x] Notes tab — skipped (covered by Outreach)
- [x] Meetings tab — skipped (covered by Outreach)

---

### Phase 2d — Link Proposals to Prospects ✅ Complete

**Status:** Complete — March 2026.

#### Design Decisions

- Proposals tab on prospect detail page — single source of truth for all proposals sent to a prospect
- Two creation modes: **build in Tercero** (existing flow) and **upload existing** (new — a proposal record with a file attachment via nullable `file_path` column)
- Status tracking works for both modes — uploaded proposals can still be marked sent, accepted, declined
- `Proposal` category removed from `PROSPECT_DOCUMENT_CATEGORIES` — Documents tab is strictly for supporting materials (Pitch Deck, Case Study, NDA, Discovery Notes, Contract, Other). No overlap with Proposals tab.
- When creating a proposal from the prospect page, `prospect_id` is pre-filled automatically

#### DB Migrations

```sql
-- Link proposals to prospects
ALTER TABLE proposals
  ADD COLUMN prospect_id uuid REFERENCES prospects(id) ON DELETE SET NULL;
CREATE INDEX proposals_prospect_id_idx ON proposals (prospect_id);

-- Support uploaded proposals (null = built in Tercero, set = uploaded file)
ALTER TABLE proposals
  ADD COLUMN file_path text;

-- Remove 'Proposal' from prospect document category constraint
ALTER TABLE client_documents
  DROP CONSTRAINT client_documents_category_check,
  ADD CONSTRAINT client_documents_category_check CHECK (
    category = ANY (ARRAY[
      'Contract', 'NDA', 'Brand Guidelines', 'Creative Brief', 'Brand Assets',
      'Meeting Notes', 'Invoice / Finance', 'SOP', 'Other',
      'Pitch Deck', 'Case Study', 'Discovery Notes'
    ])
  );
```

#### API Changes (`src/api/proposals.js`)

- `useProposals({ prospectId })` — filter by `prospect_id` when provided
- `createProposal` — accept `prospect_id` and optional `file_path`
- `get_proposals_with_totals` RPC — confirm it returns `prospect_id` (or extend if needed)

#### UI

**`ProspectProposalsTab.jsx`** (`src/pages/prospects/prospectSections/`):
- Same list UI as global Proposals page, scoped to `prospectId`
- "New Proposal" button — opens existing proposal creation flow with `prospect_id` pre-filled
- "Upload Existing" button — file picker (PDF only) → name + status → creates a proposal record with `file_path` set
- Uploaded proposals show a file chip instead of the built-in preview; clicking downloads/opens the file
- Status badge, accepted/declined state — same as built proposals

**`ProspectDetailPage.jsx`:** Add Proposals tab (Outreach → Proposals → Documents → Overview)

**`PROSPECT_DOCUMENT_CATEGORIES`** updated — `Proposal` removed:
`Pitch Deck`, `Case Study`, `NDA`, `Discovery Notes`, `Contract`, `Other`

#### File Map (Phase 2d)

```
src/
  api/
    proposals.js                              ← prospectId filter + file_path support
  pages/
    prospects/
      prospectSections/
        ProspectProposalsTab.jsx              ← Proposals tab scoped to prospect
  components/
    proposals/
      UploadProposalDialog.jsx                ← Upload existing proposal flow
```

#### Phase 2d Checklist
- [x] DB migration: `prospect_id` FK + `file_path` column on `proposals`
- [x] DB constraint: remove `Proposal` from `client_documents` category CHECK
- [x] `useProposals({ prospectId })` — client-side filter on `prospect_id` field
- [x] `createProposal` — accepts `prospect_id` via spread fields
- [x] `get_proposals_with_totals` RPC extended to return `prospect_id`
- [x] `ProspectProposalsTab.jsx` — thin wrapper delegating to `ProposalTab` with prospect context
- [x] `UploadProposalDialog.jsx` — three-group selector (existing client / CRM prospect / new prospect) + PDF upload
- [x] `ProposalDialog.jsx` — three-group selector with client logos + prospect `Target` icon
- [x] `ProposalTab.jsx` — forwards `prospectId`, `prospectName`, `prospectEmail` to both dialogs
- [x] Proposals tab wired into `ProspectDetailPage` (order: Outreach → Proposals → Documents → Overview)
- [x] `PROSPECT_DOCUMENT_CATEGORIES` — `Proposal` removed (Pitch Deck, Case Study, NDA, Discovery Notes, Contract, Other)
- [x] `DocumentCategoryBadge.jsx` — `Proposal` entry removed
- [x] Global proposals list — `prospect_name` shown when `client_id` is null, with `(prospect)` label
- [x] Draft proposals no longer shown as expired in table (RPC fix: `'draft'` added to status exclusion list)
- [x] Copy link no longer auto-advances status to `sent` — only explicit "Mark as Sent" or "Send via Email" does
- [x] `SendProposalEmailDialog.jsx` — pre-filled email, sends via `send-proposal-email` edge function, marks as `sent` on success
- [x] `ProposalDetailPage.jsx` — client/prospect selector locked (read-only) when `prospect_id` is set; "Send via Email" button added
- [x] `send-proposal-email` Supabase edge function deployed (`verify_jwt: false`)

#### Implementation Notes
- `ProspectProposalsTab` is a thin wrapper — all the heavy lifting lives in the existing `ProposalTab` + `ProposalDialog` + `UploadProposalDialog`
- Both creation dialogs use a single grouped `<Select>` with encoded values (`client:uuid` / `prospect:uuid` / `__new_prospect__`) rather than two separate selectors
- Client logos (or initial fallback) and a `Target` icon for CRM prospects render inside the `SelectItem` — shadcn copies them into the trigger automatically after selection
- `useProposals` filters prospect proposals client-side (pass `p_client_id: null` to RPC, filter on `prospect_id` in JS) — avoids RPC changes
- Uploaded proposals store the file in `proposal-files` bucket; `file_url` is saved back on the record after upload
- `send-proposal-email` edge function deployed with `verify_jwt: false` (uses service role key internally; no caller JWT needed)
- Proposal detail page locks the "For" selector to read-only when `prospect_id` is set, preventing reassignment

---

### Phase 2e — Convert to Client

"Convert to Client" button on the prospect detail page header — only rendered when `status === 'won'`.

#### DB Migration
```sql
ALTER TABLE prospects
  ADD COLUMN converted_client_id uuid REFERENCES clients(id) ON DELETE SET NULL;
```

#### Conversion Flow

1. User clicks "Convert to Client" on a Won prospect
2. Confirmation dialog opens — shows what will happen: "A new client will be created from this prospect. All linked notes, meetings, and documents will transfer to the new client."
3. On confirm, the conversion RPC runs atomically:
   - Insert new `clients` row (pre-filled from prospect Layer 1 data: `business_name → name`, `email`, `phone`, `website`, `instagram`, `linkedin`)
   - Bulk-update `client_documents.client_id = new_client_id`, clear `client_documents.prospect_id` where `prospect_id = id`
   - Set `prospects.converted_client_id = new_client_id`
   - Set `prospects.status = 'won'` (if not already)
4. Navigate to the new client's page on success

Use an RPC for atomicity — this is too important to do as separate JS calls:
```sql
-- RPC: convert_prospect_to_client(p_prospect_id uuid) RETURNS uuid (client id)
```

#### Post-conversion State
- Prospect record is preserved as a historical record with `converted_client_id` set
- Prospect row in the list shows a "Converted" indicator (link to client)
- All linked records now live under the client — nothing orphaned

#### Phase 2e Checklist
- [ ] DB migration: `converted_client_id` FK on `prospects`
- [ ] RPC `convert_prospect_to_client` — atomic client creation + document migration
- [ ] "Convert to Client" button in `ProspectDetailPage` header (won status only)
- [ ] Confirmation dialog with summary of what transfers (documents only — notes/meetings not linked)
- [ ] Converted prospect indicator on the list page row
- [ ] Navigate to new client on success

---

### Phase 2f — Deferred (post-Phase 2)

- **WhatsApp follow-up reminders** — trigger when `next_followup_at` is reached

---

## Decisions Log

| Decision | Rationale |
|---|---|
| Separate `prospects` table (not reusing `clients`) | Prospects are pre-client leads — mixing them into `clients` would pollute client counts, RLS, and the `max_clients` limit |
| Fixed CSV template (not dynamic column mapping) | Simpler to build; agency owners control their own sheets; template column names are designed to match Apollo/Apify/Google Maps output closely |
| Source set per-batch at import time | Scraping runs are typically single-source; setting per-row in the CSV adds friction with no real benefit |
| Single `notes` text field (not activity log) | Sufficient for Phase 1; activity timeline deferred to Phase 2 once usage patterns are known |
| No feature flag / subscription gate | Prospects are a fundamental sales tool — gating hurts adoption. Follows same access pattern as Clients and Meetings |
| Hard delete (no archive) | Prospects don't have financial history or linked records in Phase 1. Simpler to just delete. Phase 2 reconsiders if activities are attached |
| `business_name` as the required field (not `name`) | Scraping tools output company names, not personal names. `contact_name` is optional because B2B scrapes often don't include a contact person |
| Prospect documents use same `client-documents` bucket + table | Adding a `prospect_id` FK alongside `client_id` means zero migration cost on conversion — just flip the FK. A separate bucket would require file copies on convert |
| Notes/Meetings/Documents use nullable `prospect_id` alongside `client_id` | Records belong to one context at a time. On conversion, `prospect_id` is cleared and `client_id` is set — clean cut, no orphans, no dual ownership |
| Outreach log is a separate table from Notes | Notes are internal thoughts; outreach log is a chronological touchpoint trail. Mixing them into one table conflates two different mental models |
| Detail page replaces the sheet (Phase 2a) | Sheet pattern breaks down once more than 2 sections exist. Full page gives room for tabs, linked records, and the outreach log |
