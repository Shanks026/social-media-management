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

### Phase 2c — Link Notes, Meetings & Documents to Prospects

Add `prospect_id` nullable FK to three existing tables. Same `client_id` column remains — records can belong to a prospect OR a client, not both simultaneously. The existing `NotesAndReminders`, `MeetingsPage`, and `DocumentsTab` components get a `prospectId` prop alongside the existing `clientId` prop.

#### DB Migrations
```sql
-- Notes
ALTER TABLE notes
  ADD COLUMN prospect_id uuid REFERENCES prospects(id) ON DELETE SET NULL;
CREATE INDEX notes_prospect_id_idx ON notes (prospect_id);

-- Meetings
ALTER TABLE meetings
  ADD COLUMN prospect_id uuid REFERENCES prospects(id) ON DELETE SET NULL;
CREATE INDEX meetings_prospect_id_idx ON meetings (prospect_id);

-- Documents (reuse existing client_documents table + client-documents bucket)
ALTER TABLE client_documents
  ADD COLUMN prospect_id uuid REFERENCES prospects(id) ON DELETE SET NULL;
CREATE INDEX client_documents_prospect_id_idx ON client_documents (prospect_id);
```

#### Component Updates

Each tab component needs a `prospectId` prop. When `prospectId` is present (and `clientId` absent), filter and create records scoped to the prospect.

**Notes** (`src/api/notes.js` + `NotesAndReminders` / reused tab component):
- `useNotes({ prospectId })` — filter by `prospect_id`
- `createNote` — pass `prospect_id` when creating from prospect context

**Meetings** (`src/api/meetings.js` + meetings tab component):
- `useMeetings({ prospectId })` — filter by `prospect_id`
- `createMeeting` — pass `prospect_id` when creating from prospect context

**Documents** (`src/api/documents.js` + `DocumentsTab`):
- `useDocuments({ prospectId })` — filter by `prospect_id`
- Upload path: `{workspaceUserId}/prospects/{prospectId}/{filename}` (within same `client-documents` bucket)
- `createDocument` — pass `prospect_id` when creating from prospect context

#### File Map (Phase 2c)
```
src/
  pages/
    prospects/
      prospectSections/
        ProspectNotesTab.jsx        ← Thin wrapper: <NotesTab prospectId={id} />
        ProspectMeetingsTab.jsx     ← Thin wrapper: <MeetingsTab prospectId={id} />
        ProspectDocumentsTab.jsx    ← Thin wrapper: <DocumentsTab prospectId={id} />
```

#### Phase 2c Checklist
- [ ] DB migrations: `prospect_id` FK on `notes`, `meetings`, `client_documents`
- [ ] `useNotes` updated to accept `{ prospectId }` filter
- [ ] `useMeetings` updated to accept `{ prospectId }` filter
- [ ] `useDocuments` updated to accept `{ prospectId }` filter
- [ ] `createNote`, `createMeeting`, `createDocument` mutations accept `prospect_id`
- [ ] Notes, Meetings, Documents tabs wired into `ProspectDetailPage`
- [ ] Document upload path scoped to `prospects/{prospectId}/` within `client-documents` bucket

---

### Phase 2d — Convert to Client

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
   - Bulk-update `notes.client_id = new_client_id`, clear `notes.prospect_id` where `prospect_id = id`
   - Bulk-update `meetings.client_id = new_client_id`, clear `meetings.prospect_id`
   - Bulk-update `client_documents.client_id = new_client_id`, clear `client_documents.prospect_id`
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

#### Phase 2d Checklist
- [ ] DB migration: `converted_client_id` FK on `prospects`
- [ ] RPC `convert_prospect_to_client` — atomic client creation + record migration
- [ ] "Convert to Client" button in `ProspectDetailPage` header (won status only)
- [ ] Confirmation dialog with summary of what transfers
- [ ] Converted prospect indicator on the list page row
- [ ] Navigate to new client on success

---

### Phase 2e — Deferred (post-Phase 2)

- **Link to Proposal** — optional `proposal_id` FK on prospects; show linked proposal in Overview tab
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
