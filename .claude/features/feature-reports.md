# Feature: Reports

**Product**: Tercero — Agency Management SaaS (industry-agnostic / "deliverables" framing)
**File**: `.claude/features/feature-reports.md`
**Status**: Planned
**Last Updated**: June 2026

---

## Context

Agencies need to show clients (and themselves) a consolidated picture of what's been **delivered, approved, and billed** — without logging into five places. Tercero already stores all of this, so "Reports" is a generation layer over existing data: pick a client, generate a branded per-client report (PDF first, Excel later), and keep a downloadable history.

**Industry-agnostic principle:** Tercero is for *any* agency (architecture, interior design, gigs, social, etc.). All report copy and metrics MUST be deliverable-scoped and neutral — "deliverables," "approvals," "billed/collected." **No social-platform metrics** (reach/impressions/engagement) in this feature — that is a future expansion (Phase 3, out of scope here).

Reuses: `@react-pdf/renderer` (invoices/proposals already use it), `view_client_profitability` (finance metrics), the private-bucket + signed-URL + storage-tracking pattern (Documents), `useSubscription` gating, and the Operations sidebar group.

---

## Phase Overview

```
Phase 1 — Per-client PDF report + Reports page + gating
  Select a client → aggregate existing data → generate & download a branded PDF report.
  No storage, no Excel, no new dependency. This is the demo/sales asset.

Phase 2 — Persistence + Excel export
  Store generated reports (DB + private bucket), history list with re-download/delete,
  add Excel (.xlsx) output format.

Phase 3 — (FUTURE, OUT OF SCOPE HERE) Agency-wide rollup + social-platform analytics
  Cross-client dashboard and platform performance metrics slot into the same page.
```

**After each phase: stop and wait for approval before proceeding.**

Placement: own **"Reports"** nav item in the **Operations** sidebar group. Route `/reports` (mirrors `/documents`, the closest analog — also a file/document-centric Operations feature).

---

## Phase 1 — Per-client PDF report + page + gating ✅ Complete

### Goal
A user opens **Reports** from the Operations group, selects a client, clicks **Generate Report**, and downloads a branded, professional PDF summarising that client across deliverables, approvals, campaigns, finance, proposals, and documents — all from data Tercero already holds. Gated to Velocity+ (locked state shown for Ignite, never fully hidden). Nothing is persisted yet; this phase is generate-and-download only.

### Before Starting — Confirm With Codebase
Read these and confirm exact names before writing code:
1. **Post/deliverable model** — `posts` + `post_versions` (status enum values, `current_version_id` FK alias `post_versions!fk_current_version`, `target_date`, `created_at`). Confirm the exact status values (`DRAFT|PENDING|REVISIONS|SCHEDULED|ARCHIVED`) and how approval/revision history is queryable (is there a timestamp when status changed, or do versions carry it?).
2. **Finance view** — confirm `view_client_profitability` columns (billed, collected, outstanding, overdue, profit/margin) and that it filters by `client_id`.
3. **Campaigns** — `campaigns` table columns for budget (allocated vs spent) and status; confirm a client filter.
4. **Proposals** — `proposals` table: status values (`draft/sent/viewed/accepted/declined/expired/archived`) and amount/total column; confirm per-client filter.
5. **Documents** — `documents` table: count + size per client.
6. **PDF pattern** — read `src/utils/downloadInvoicePDF.jsx` and `src/components/InvoicePDF.jsx` for the exact react-pdf + blob-download + font registration pattern (note the full-glyph Inter font fix and SVG rasterisation already in place).
7. **Subscription hook** — `src/api/useSubscription.js` return shape; confirm how to add a new boolean flag and how existing flags (e.g. `documents_collections`) are read in components.
8. **Sidebar** — find the nav config file and the Operations group; confirm how `/documents` is registered (route in `App.jsx` + nav entry).
9. **Agency branding source** — confirm how `downloadInvoicePDF` receives agency name/logo/address (via `useSubscription` data) so the report header/footer matches invoices.

### 1.1 Database

**Add gating flag** to `agency_subscriptions`:

```sql
ALTER TABLE agency_subscriptions
  ADD COLUMN IF NOT EXISTS reports boolean NOT NULL DEFAULT false;

-- Plan values (mirror existing flag conventions; Trial mirrors Quantum)
-- Trial: TRUE, Ignite: FALSE, Velocity: TRUE, Quantum: TRUE
UPDATE agency_subscriptions SET reports = TRUE  WHERE plan_name IN ('trial','velocity','quantum');
UPDATE agency_subscriptions SET reports = FALSE WHERE plan_name = 'ignite';
```

**Aggregation RPC** — one call returns the full report payload as JSON (SECURITY INVOKER so RLS applies; the caller must own the client). Verify exact source columns during the "Before Starting" step and adjust:

```sql
CREATE OR REPLACE FUNCTION get_client_report(p_client_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT jsonb_build_object(
    'client', (SELECT to_jsonb(c) FROM clients c WHERE c.id = p_client_id),
    'deliverables', (
      SELECT jsonb_build_object(
        'total', count(*),
        'by_status', jsonb_object_agg(status, cnt)
      )
      FROM (
        SELECT pv.status, count(*) AS cnt
        FROM posts p
        JOIN post_versions pv ON pv.id = p.current_version_id
        WHERE p.client_id = p_client_id
        GROUP BY pv.status
      ) s
    ),
    'campaigns', (
      SELECT jsonb_build_object(
        'total', count(*),
        'budget_allocated', COALESCE(sum(budget), 0)
        -- add budget_spent once the spend source is confirmed
      )
      FROM campaigns WHERE client_id = p_client_id
    ),
    'finance', (
      SELECT to_jsonb(v) FROM view_client_profitability v WHERE v.client_id = p_client_id
    ),
    'proposals', (
      SELECT jsonb_build_object(
        'sent', count(*) FILTER (WHERE status <> 'draft'),
        'accepted', count(*) FILTER (WHERE status = 'accepted')
        -- 'value_won', sum(total) FILTER (WHERE status = 'accepted')  -- confirm column
      )
      FROM proposals WHERE client_id = p_client_id
    ),
    'documents', (
      SELECT jsonb_build_object('count', count(*))
      FROM documents WHERE client_id = p_client_id
    )
  );
$$;
```

> Note: column names above are provisional. The "Before Starting" step exists precisely to confirm them. If any source is missing (e.g. campaign spend, approval timestamps), omit that metric from Phase 1 rather than inventing data, and note it as deferred.

### 1.2 API Layer

New file `src/api/reports.js`:

```javascript
// Read hook — aggregated report payload for one client
export function useClientReportData(clientId) // useQuery, key: ['reports','data', clientId], enabled: !!clientId
//   → supabase.rpc('get_client_report', { p_client_id: clientId })
```

No mutations in Phase 1 (nothing persisted). Follow API conventions: `if (error) throw error`, `enabled: !!clientId`, `staleTime: 30000`.

### 1.3 Components

```
src/
├── pages/
│   └── reports/
│       └── ReportsPage.jsx        — global page: client selector + Generate button + (Phase 2) history
├── components/
│   └── reports/
│       └── ClientReportPDF.jsx     — @react-pdf/renderer document (deliverable-neutral copy)
└── utils/
    └── downloadClientReportPDF.jsx — assembles agency branding + report data, renders PDF to blob, triggers download
                                        (mirror src/utils/downloadInvoicePDF.jsx, incl. Inter full-glyph font + SVG rasterisation)
```

**`ReportsPage.jsx`**
- `useHeader({ title: 'Reports', breadcrumbs: [{label:'Reports'}] })`.
- Reads `useSubscription()` → `data.reports`. If `false` (Ignite): render the page with a **locked state** (lock icon, short "Available on Velocity & Quantum" upgrade prompt) — never hidden. Client selector + Generate disabled.
- Client selector: reuse `useClients()` (`realClients`), shadcn `Select` (logo + name items, same as invoice dialog).
- **Generate Report** button → fetches/awaits `useClientReportData(selectedClientId)` (or imperatively triggers), then calls `downloadClientReportPDF(reportData, agencyData)`. Loading state on the button; `toast.success('Report generated')` / `toast.error(...)`.
- Empty state when no client selected (skeleton/illustration per empty-states convention).

**`ClientReportPDF.jsx`** — branded A4 document, sections (deliverable-neutral copy):
1. Header — agency logo/name (same branding source as invoices) + client name + "Generated on {formatDate(today)}".
2. Deliverables — total + breakdown by status (relabel for clients: In Progress / Awaiting Approval / In Revision / Scheduled / Delivered).
3. Campaigns — count + budget allocated (spend if confirmed).
4. Finance — billed, collected, outstanding, overdue, profitability (from `view_client_profitability`).
5. Proposals — sent / accepted (value won if column confirmed).
6. Documents — count.
7. Footer — agency email/website (reuse invoice footer pattern).

**`downloadClientReportPDF.jsx`** — mirror `downloadInvoicePDF.jsx`: register full-glyph Inter, rasterise any SVG logo, `pdf(<ClientReportPDF .../>).toBlob()`, download as `{client-name}-report-{date}.pdf`.

### 1.4 Reports Integration (routing + nav)
- `App.jsx` — import `ReportsPage`, add `<Route path="/reports" element={<ReportsPage />} />` inside the protected group.
- Sidebar nav — add a **"Reports"** entry in the **Operations** group (mirror the `/documents` entry). Use a `lucide-react` icon (e.g. `FileBarChart` or `FileText`). Show it for all plans (locked state lives inside the page).

### 1.5 Impact on Existing Features
| Existing Feature | Impact | Watch for |
|---|---|---|
| `useSubscription` | New `reports` boolean returned | Add to the returned object; default `false` if null |
| Sidebar / `App.jsx` | New route + nav entry | Keep Operations group ordering consistent |
| `agency_subscriptions` | New column + seed updates | Run the plan UPDATEs so existing accounts get correct value |

### 1.6 What This Phase Does NOT Include
- No storing/persisting reports (Phase 2).
- No Excel export (Phase 2).
- No history list (Phase 2).
- No date-range picker, no scheduling, no configurable report builder (out of scope, all phases).
- No agency-wide rollup, no social-platform metrics (Phase 3 / out of scope).
- No client-detail Reports tab (global page only for now).

### 1.7 Phase 1 Checklist — Before Marking Complete
- [x] `reports` column added to `agency_subscriptions`; plan UPDATEs run; `useSubscription` returns `data.reports`.
- [x] `get_client_report` RPC created and returns valid JSON for a real client (verified against actual columns; missing sources omitted, not faked).
- [x] `src/api/reports.js` exposes `useClientReportData(clientId)` with `enabled: !!clientId`, throws on error.
- [x] `/reports` route added; **Reports** appears in the Operations sidebar group.
- [x] On Ignite, the sidebar item is locked (tooltip) and the page renders a locked upgrade state.
- [x] On Velocity/Quantum/Trial, selecting a client shows a live KPI preview and Generate downloads a branded PDF — deliverable-neutral copy, no social-platform metrics.
- [x] PDF branding (logo/name/email/website) sourced from `useSubscription` (same as invoices); uses the fixed full-glyph Inter font so ₹ renders.
- [x] `npm run build` passes; no lint errors in new files.

### Implementation Notes (Phase 1)
**Data-source corrections** (CLAUDE.md was out of date; verified against the live DB):
- `documents` table is actually **`client_documents`**.
- **`view_client_profitability` does not exist.** Finance is computed directly from the **`invoices`** table (billed = SENT+PAID+OVERDUE, collected = PAID, outstanding = SENT+OVERDUE, overdue = OVERDUE, + invoice count).
- The analytics view is **`client_pipeline_analytics`** — used only for `next_deliverable_at` (`next_post_at`).
- Post status enum is richer than documented: `DRAFT, PENDING_APPROVAL, APPROVED, SCHEDULED, NEEDS_REVISION, PUBLISHED, ARCHIVED, DELIVERED` — mapped to deliverable-neutral labels in the PDF.

**Omitted (not faked), per the "no invented data" rule — candidates for later phases:**
- **Approval turnaround time** — no per-status timestamps exist on `post_versions`.
- **Campaign spend / budget utilisation** — `campaigns` has `budget` but no spend column (only allocated budget is shown).
- **Profitability** — needs per-client expense allocation that isn't cleanly queryable.

**Other decisions:**
- Gating mirrors the Subscriptions section: sidebar uses the `requiresFlag: 'reports'` lock pattern (locked, non-clickable on Ignite), and a `ReportsRoute` guard in `App.jsx` hard-redirects to `/dashboard` if `!sub.reports` (handles direct-URL access). **Root-cause fix:** the `reports` flag was missing from the seed SQL + flag matrix in `documentation/subscription-features.md`, so switching a plan to Ignite left `reports` stale-`true`. Added `reports` to the flag matrix, feature matrix, and all four seed SQL blocks (Ignite FALSE, others TRUE), and enforced existing rows in the DB.
- Added a small on-screen KPI preview (deliverables / billed / collected / outstanding) when a client is selected — reuses the fetched payload, strengthens the demo. Minor addition beyond "generate + download".
- Report is an all-time snapshot (no date range), as planned.
- `get_client_report` is `STABLE` / SECURITY INVOKER so RLS applies (no `SECURITY DEFINER`).

**→ Phase 1 complete. Stopped for approval before Phase 2 (persistence + Excel).**

---

## Phase 2 — Persistence + Excel export

### Goal
Generated reports are saved and listed. The user generates a report (PDF or Excel), it's uploaded to a private bucket and recorded in a `reports` table, and the page shows a downloadable history per client (with delete). Adds the Excel (.xlsx) format.

### Before Starting — Confirm Phase 1 is Approved
1. Re-read `src/api/storage.js` (or wherever uploads live) and the Documents upload/delete + storage-tracking flow (`increment_storage_used` / `decrement_storage_used`, `GREATEST(0, ...)`).
2. Confirm the private bucket creation process and signed-URL helper used by Documents.
3. Decide the Excel library — **recommend SheetJS `xlsx`** (lightweight) unless rich styling is wanted (`exceljs`). Confirm and install.

### 2.1 Database
```sql
CREATE TABLE reports (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id   uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  title       text NOT NULL,
  format      text NOT NULL CHECK (format IN ('pdf','xlsx')),
  file_path   text NOT NULL,           -- storage path in private bucket
  file_size_bytes bigint NOT NULL DEFAULT 0,
  generated_at timestamptz NOT NULL DEFAULT now(),
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own reports" ON reports FOR ALL USING (user_id = auth.uid());
```
Private bucket `client-reports`, path `{user_id}/{client_id}/{report_id}/{filename}`.

### 2.2 API Layer (additions to `src/api/reports.js`)
- `useReportsList({ clientId })` — `['reports','list',{clientId}]`, lists stored reports (optionally filtered by client).
- `createReport({ clientId, format, blob, title, sizeBytes })` — upload to bucket → insert `reports` row → `increment_storage_used`. Returns the row.
- `deleteReport(report)` — remove file → delete row → `decrement_storage_used`.
- `getReportSignedUrl(filePath)` — 1-hour signed URL for download.

### 2.3 Components
- `ReportsPage.jsx` — add a **history list/table** below the generator: title, client, format badge, size, `formatDate(generated_at)`, download (signed URL) + delete (`AlertDialog`). Client filter dropdown reused. Generate flow now: build blob → `createReport(...)` → refetch list → toast.
- `src/utils/generateClientReportExcel.js` — build `.xlsx` from the same `useClientReportData` payload (one sheet, sectioned rows).
- Format toggle (PDF / Excel) on the Generate control.

### 2.4 Impact
| Feature | Impact | Watch for |
|---|---|---|
| Storage usage | Reports count toward `current_storage_used` | Increment on create, decrement on delete with `GREATEST(0,...)` |
| Subscription/storage display | Larger storage use | None beyond tracking |

### 2.5 What This Phase Does NOT Include
- Agency-wide rollup and social-platform metrics (Phase 3).
- Auto-generation / scheduled reports, email delivery (out of scope).

### 2.6 Phase 2 Checklist
- [ ] `reports` table + RLS created; `client-reports` private bucket created.
- [ ] Generate (PDF or Excel) uploads + records a row + increments storage.
- [ ] History list shows stored reports with working signed-URL download.
- [ ] Delete removes file + row + decrements storage (never negative).
- [ ] Excel output opens correctly with all available sections.
- [ ] `npm run build` passes; no lint errors.

**→ Stop here. Show the result and wait for approval.**

---

## Data Model Summary (Final State After Phase 1 & 2)

```
agency_subscriptions
└── reports (boolean flag)              ← gating, Velocity+

clients (existing)
└── reports[] (Phase 2 table)
     ├── id, user_id, client_id
     ├── title, format (pdf|xlsx)
     ├── file_path → client-reports bucket
     ├── file_size_bytes, generated_at
     └── created_at
```

### `reports` — Schema (Phase 2)
| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `user_id` | UUID | RLS, FK → auth.users |
| `client_id` | UUID | FK → clients |
| `title` | text | report title |
| `format` | text | `pdf` \| `xlsx` |
| `file_path` | text | path in `client-reports` bucket |
| `file_size_bytes` | bigint | for storage tracking |
| `generated_at` | timestamptz | when generated |
| `created_at` | timestamptz | row created |

### Storage Bucket (Phase 2)
| Bucket | Access | Path |
|---|---|---|
| `client-reports` | Private (signed URLs) | `{user_id}/{client_id}/{report_id}/{filename}` |

---

## Impact on Existing Features

| Existing Feature | Impact | Action Required |
|---|---|---|
| `useSubscription` | New `reports` flag | Return it; default false |
| Sidebar + `App.jsx` | New `/reports` route + Operations nav item | Add both; visible to all (locked inside) |
| `agency_subscriptions` | New `reports` column | Migration + per-plan seed UPDATEs |
| Storage tracking (Phase 2) | Reports consume storage | Increment/decrement RPCs |
| `@react-pdf/renderer` | Reused for report PDF | Reuse invoice font/branding setup |
| `view_client_profitability` | Read-only source for finance section | None |

---

## Out of Scope (All Phases)

- **Social-platform analytics** (reach/impressions/engagement) — Phase 3 / requires platform APIs (paid, app review). Explicitly NOT in this feature.
- **Agency-wide cross-client rollup dashboard** — Phase 3; the Reports page is structured so it can be added as a second section/tab without rework.
- **Date-range selection, period comparisons, scheduling, auto-email delivery** — future build.
- **Configurable / custom report builder** (choose sections, branding themes) — future build.
- **Client-detail Reports tab** — global page only for now; add later if customers ask.
- **Inventing metrics** — any data source not present in the DB is omitted from the report, never faked.
```
