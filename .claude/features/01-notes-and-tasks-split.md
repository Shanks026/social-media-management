# Feature: Notes & Tasks Split

**Product**: Tercero — Social Media Agency Management SaaS
**File**: `.claude/features/01-notes-and-tasks-split.md`
**Status**: ✅ Complete (both phases)
**Last Updated**: June 2026

---

## Context

The existing "Notes & Reminders" surface (`/operations/notes`, table `client_notes`) is actually a **task/reminder tracker** — it has statuses (`TODO`/`DONE`/`ARCHIVED`), due dates, and a kanban board. The naming is misleading. Agencies separately need a true **freeform notes** surface (Notion-style) for SOPs, briefs, client context, and meeting prep — something they currently keep in an external tool.

This feature does two things: (1) renames the existing tasks tracker to **"Tasks & Reminders"** and frees up the accurate `/operations/notes` URL, and (2) builds a brand-new **Notes** feature — plain-text notes, optionally linked to a client (default = global agency note). Follows the Operations global-page pattern used by Meetings and Documents.

---

## Phase Overview

```
Phase 1 — Rename Tasks (no DB change)
  Rename the existing "Notes & Reminders" to "Tasks & Reminders" and move its
  route from /operations/notes to /operations/tasks. Frees the /operations/notes URL.

Phase 2 — New Notes feature
  New `notes` table, src/api/agencyNotes.js module, /operations/notes page with
  card grid + create/edit dialog + delete confirm, and a "Notes" sidebar entry.
```

**After each phase: stop and wait for approval before proceeding.**

---

## Phase 1 — Rename Tasks (no DB change) ✅ Complete

### Goal
The existing tasks/reminders feature is relabeled "Tasks & Reminders" everywhere it's user-visible, and its route moves to `/operations/tasks`. Nothing about its behaviour, data, or DB changes. After this phase the `/operations/notes` URL and the "Notes" label are free for Phase 2.

### Before Starting — Confirm With Codebase
1. Confirm the full list of `/operations/notes` references is still exactly these 6 source files (grep `/operations/notes`):
   `src/App.jsx`, `src/components/sidebar/nav-main.jsx`, `src/pages/NotesAndReminders.jsx`, `src/pages/dashboard/DashboardMeetingsNotes.jsx`, `src/pages/clients/clientSections/OverviewTab.jsx`, `src/pages/campaigns/CampaignDetailPage.jsx`.
2. Read the `setHeader({...})` call in `NotesAndReminders.jsx` (~line 538) — note the title/breadcrumb strings to change.
3. Confirm `nav-main.jsx:98` is the sidebar entry (`{ title: 'Notes & Reminders', url: '/operations/notes', icon: Bell }`).
4. Confirm the table `client_notes` and the API module `src/api/notes.js` are NOT touched by anything in this phase (they stay exactly as-is).
5. Rename the file `NotesAndReminders.jsx` → `TasksAndReminders.jsx` (confirmed) — update the component function name and its import in `App.jsx`.

### 1.1 Database
No database changes in this phase. The table stays `client_notes`; all `src/api/notes.js` functions stay unchanged.

### 1.2 API Layer
No API changes in this phase. `src/api/notes.js` is untouched (it remains the tasks/reminders API).

### 1.3 Components
- **`src/pages/NotesAndReminders.jsx`** (optionally renamed to `TasksAndReminders.jsx`):
  - `setHeader` title `'Notes & Reminders'` → `'Tasks & Reminders'`
  - Breadcrumb `{ label: 'Notes & Reminders', href: '/operations/notes' }` → `{ label: 'Tasks & Reminders', href: '/operations/tasks' }`
  - Any other user-visible "Notes & Reminders" / "Notes" copy in the page header area → "Tasks & Reminders" / "Tasks". (Do NOT rename internal variables like the `notesView` localStorage key — leave functional internals alone to avoid breakage. Renaming is cosmetic/user-facing only.)
  - **File is renamed** to `TasksAndReminders.jsx`; the component function name and its `App.jsx` import update accordingly.

### 1.4 Routing & Nav Integration
- **`src/App.jsx:118`** — change `<Route path="/operations/notes" ...>` to `<Route path="/operations/tasks" ...>`. (Update the imported component name if the file was renamed.)
- **`src/components/sidebar/nav-main.jsx:98`** — change the Operations sub-item to `{ title: 'Tasks & Reminders', url: '/operations/tasks', icon: Bell }`.
- **`src/pages/dashboard/DashboardMeetingsNotes.jsx:169,274`** — change both `/operations/notes` navigation targets to `/operations/tasks`.
- **`src/pages/clients/clientSections/OverviewTab.jsx:435`** — change the navigate target to `/operations/tasks`.
- **`src/pages/campaigns/CampaignDetailPage.jsx:1080`** — change the navigate target to `/operations/tasks`.

### 1.5 Impact on Existing Features
| Feature | Impact | Watch for |
|---|---|---|
| Tasks/Reminders page | Label + route change only; behaviour identical | Old bookmarks to `/operations/notes` will 404-redirect to dashboard (catch-all). Acceptable — internal tool, no public links. |
| Dashboard widget (`DashboardMeetingsNotes`) | "View notes" deep-links retargeted | Confirm both links navigate to `/operations/tasks` |
| Client Overview & Campaign Detail | "Go to tasks" buttons retargeted | Confirm buttons land on the right page |
| `.claude` docs | `routing.md`, `app-research.md`, skill docs reference old route | Update for accuracy (non-functional) |

### 1.6 What This Phase Does NOT Include
- No DB rename (table stays `client_notes`).
- No changes to task behaviour, statuses, kanban, or filters.
- No new Notes feature (that's Phase 2).
- No client-detail tab changes.

### 1.7 Phase 1 Checklist — Before Marking Complete
- [x] Sidebar shows "Tasks & Reminders" pointing at `/operations/tasks`
- [x] Visiting `/operations/tasks` renders the existing tasks page unchanged
- [x] Page header title and breadcrumb read "Tasks & Reminders"
- [x] All 6 source references to `/operations/notes` now point to `/operations/tasks` (grep returns no `/operations/notes` in `src/`)
- [x] Dashboard, Client Overview, and Campaign Detail navigation buttons land on `/operations/tasks`
- [x] `client_notes` table and `src/api/notes.js` are unchanged
- [x] `npm run lint` — no errors in Phase 1 files (pre-existing errors in other files unrelated)
- [x] File renamed `NotesAndReminders.jsx` → `TasksAndReminders.jsx`, function name updated, App.jsx import updated

**→ Stop here. Show the result and wait for approval.**

---

## Phase 2 — New Notes feature ✅ Complete

### Goal
A new **Notes** page at `/operations/notes` where the agency creates freeform plain-text notes. Each note has a title and a body, and can optionally be linked to a client (default = none = a global agency-wide note). Full CRUD: create, edit, delete (with confirm), displayed as a card grid with an empty state. A "Notes" entry appears in the Operations sidebar group.

### Before Starting — Confirm Phase 1 is Approved
1. Confirm `/operations/notes` is now FREE (Phase 1 moved tasks to `/operations/tasks`).
2. Read `src/api/notes.js` — confirm the tasks API still owns the `notes.js` filename and `createNote`/`updateNote`/`deleteNote` names; the new module MUST be `agencyNotes.js` with `…AgencyNote` names to avoid collision.
3. Read `src/context/AuthContext.jsx` — confirm `useAuth()` exposes `workspaceUserId` (used for the read hook's query scoping & key).
4. RLS scoping is CONFIRMED: `client_notes` uses `USING (user_id = get_my_agency_user_id())` (team-visible across the agency workspace). The new `notes` table uses the same policy so agency team members can see all workspace notes.
5. Read `NotesAndReminders.jsx` lines ~549-560 for the established `allClients` pattern (`internalAccount` + `realClients`) to reuse in the client selector.
6. Read `src/components/ui/empty.jsx` and the `empty-states` skill for the correct empty-state composition.

### 2.1 Database

New table `notes`:

```sql
CREATE TABLE notes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id  UUID REFERENCES clients(id) ON DELETE CASCADE,  -- nullable: NULL = global agency note
  title      TEXT NOT NULL,
  body       TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notes_user_id ON notes (user_id);
CREATE INDEX idx_notes_client_id ON notes (client_id);

ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

-- CONFIRMED to mirror client_notes: team-visible across the agency workspace.
CREATE POLICY "Workspace manages own notes"
  ON notes FOR ALL
  USING (user_id = get_my_agency_user_id())
  WITH CHECK (user_id = get_my_agency_user_id());
```

Notes on decisions (all confirmed against the live `client_notes` schema):
- `client_id` is `ON DELETE CASCADE` — matches `client_notes`. Deleting a client deletes its linked notes. Global notes (`client_id IS NULL`) are unaffected.
- `user_id` is `ON DELETE CASCADE`, FK → `auth.users` — matches `client_notes`.
- RLS uses `get_my_agency_user_id()` — matches `client_notes` exactly, so all agency team members see workspace notes.
- `body` defaults to empty string so a title-only note is valid.
- `updated_at` is set by the app on update (set `updated_at: new Date().toISOString()` in `updateAgencyNote`). Note: `client_notes` has no `updated_at` column at all; the new `notes` table adds one so we can sort by recency.
- Apply via Supabase MCP `apply_migration` (migration name e.g. `create_notes_table`).

### 2.2 API Layer — `src/api/agencyNotes.js`

New module. Per `api-conventions.md`: reads are React Query hooks; mutations are plain async functions (never wrapped in `useMutation` at the API layer).

```js
// Read hook — list all notes for the workspace, optional client filter
export function useAgencyNotes({ clientId } = {}) {
  const { workspaceUserId } = useAuth()
  return useQuery({
    queryKey: ['agency-notes', 'list', { userId: workspaceUserId, clientId: clientId ?? null }],
    queryFn: async () => {
      let q = supabase.from('notes').select('*')
        .eq('user_id', workspaceUserId)
        .order('updated_at', { ascending: false })
      if (clientId) q = q.eq('client_id', clientId)
      const { data, error } = await q
      if (error) throw error
      return data
    },
    enabled: !!workspaceUserId,
    staleTime: 30000,
    retry: 1,
  })
}

// Mutations — plain async, resolve workspace internally (mirror src/api/notes.js style)
export async function createAgencyNote({ title, body, client_id = null }) {
  const { workspaceUserId } = await resolveWorkspace()
  const { data, error } = await supabase.from('notes')
    .insert([{ title, body, client_id, user_id: workspaceUserId }])
    .select().single()
  if (error) throw error
  return data
}

export async function updateAgencyNote(noteId, updates) {
  const { data, error } = await supabase.from('notes')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', noteId).select().single()
  if (error) throw error
  return data
}

export async function deleteAgencyNote(noteId) {
  const { error } = await supabase.from('notes').delete().eq('id', noteId)
  if (error) throw error
  return true
}
```

Callers wrap mutations with `useMutation` and invalidate `['agency-notes', 'list']` on success.

### 2.3 Components

```
src/
├── api/
│   └── agencyNotes.js            — hook + mutations (above)
├── pages/
│   └── Notes.jsx                 — global page at /operations/notes
└── components/
    └── notes/
        ├── AgencyNoteCard.jsx    — single note card (title, body preview, client badge, edit/delete menu)
        └── AgencyNoteDialog.jsx  — create/edit dialog (RHF + Zod)
```

**`src/pages/Notes.jsx`** (`/operations/notes`):
- `useHeader({ title: 'Notes', breadcrumbs: [{ label: 'Operations', href: '/operations' }, { label: 'Notes', href: '/operations/notes' }] })`
- Page layout: `<div className="flex flex-col gap-6 p-6">`
- Header row: title/description + "New Note" button (opens `AgencyNoteDialog` in create mode)
- Optional client filter dropdown (All clients / Agency-wide / each client) — reuses the `allClients` pattern. Keep simple; "All" is default.
- `useAgencyNotes()` → loading = skeleton card grid; error = `text-destructive` message
- Empty state via `<Empty>` composition (see `empty-states` skill) when zero notes — `EmptyTitle className="font-bold text-xl"`, a "New Note" CTA, large emoji per `feedback_emojis_over_icons` preference (e.g. 📝)
- Card grid: responsive `grid gap-4 sm:grid-cols-2 lg:grid-cols-3`

**`src/components/notes/AgencyNoteCard.jsx`**:
- Props: `note`, `clientMap` (id→client for badge label/avatar), `onEdit`, `onDelete`
- Shows title (bold, truncate), body preview (line-clamp ~4, `whitespace-pre-wrap` to preserve line breaks), updated date via `formatDate(note.updated_at)`
- Client badge: if `note.client_id` → client name (+ `ClientAvatar`); else a muted "Agency-wide" badge
- Top-right `DropdownMenu` (⋯) with Edit and Delete (Delete item is `text-destructive`)
- Delete uses `AlertDialog` confirm ("Delete note? This cannot be undone.")

**`src/components/notes/AgencyNoteDialog.jsx`**:
- shadcn `Dialog`, controlled via `open`/`onOpenChange`
- Props: `open`, `onOpenChange`, `note` (null = create, object = edit), `clients` (for selector)
- RHF + Zod schema: `{ title: z.string().min(1, 'Title is required').max(200), body: z.string().max(20000).optional(), client_id: z.string().nullable() }`
- Fields via `<FormField>`: Title (`Input`), Body (`Textarea`, ~8 rows, text only), Client (`Select` — first option "Agency-wide (no client)" mapping to `null`, then internal account + real clients)
- On submit: create → `createAgencyNote`; edit → `updateAgencyNote(note.id, …)`. Wrap in `useMutation`, invalidate `['agency-notes','list']`, toast success/error, close dialog.

### 2.4 Routing & Nav Integration
- **`src/App.jsx`** — add `<Route path="/operations/notes" element={<Notes />} />` (import `Notes` from `@/pages/Notes`). Place it near the other `/operations/*` routes.
- **`src/components/sidebar/nav-main.jsx`** — add a new Operations sub-item after "Tasks & Reminders": `{ title: 'Notes', url: '/operations/notes', icon: NotebookPen }` (import `NotebookPen` from `lucide-react`). No `requiresFlag` — Notes is available on all plans.

### 2.5 Impact on Existing Features
| Feature | Impact | Watch for |
|---|---|---|
| Operations sidebar group | Gains a 5th item ("Notes") | Group ordering; ensure both collapsed-popover and expanded-collapsible render it |
| Tasks & Reminders | None (separate table/module) | Confirm no accidental import of `src/api/notes.js` into the new code |
| Clients | New `notes.client_id` FK references `clients` | Client delete cascades — linked notes are deleted (matches `client_notes`). Global notes unaffected. |

### 2.6 What This Phase Does NOT Include
- No client-detail tab for notes (explicitly deferred — global page only).
- No rich text / markdown / attachments / images — plain text body only.
- No sharing, public tokens, or client-facing access.
- No subscription gating (available on all tiers).
- No pinning, tags, folders, or search beyond the optional client filter.
- No realtime subscription (simple React Query invalidation).

### 2.7 Phase 2 Checklist — Before Marking Complete
- [x] `notes` table exists with RLS `user_id = get_my_agency_user_id()`; agency team members can access workspace notes
- [x] `client_id` FK is `ON DELETE CASCADE`; deleting a client deletes its linked notes (global notes untouched)
- [x] `src/api/agencyNotes.js` exports `useAgencyNotes`, `createAgencyNote`, `updateAgencyNote`, `deleteAgencyNote` (no name collision with `src/api/notes.js`)
- [x] `/operations/notes` renders the new Notes page
- [x] "Notes" appears in the Operations sidebar group with the `NotebookPen` icon
- [x] Create note: title required, body optional, client optional (default Agency-wide)
- [x] Edit note: dialog pre-fills, updates `updated_at` on save
- [x] Delete note: behind `AlertDialog` confirm in the card
- [x] Client badge shown when `client_id` is set; "Agency-wide" badge when null
- [x] Body preview: `whitespace-pre-wrap line-clamp-4`
- [x] Empty state with 📝 emoji and "New Note" CTA
- [x] Loading: skeleton grid; errors: destructive message
- [x] Toasts via `sonner`; dates via `formatDate`; icons from `lucide-react`
- [x] `npx eslint` on all Phase 2 files: zero errors

**→ Stop here. Show the result and wait for approval.**

---

## Data Model Summary (Final State After All Phases)

```
auth.users (agency owner / workspace)
   │
   ├── client_notes        (UNCHANGED — tasks & reminders; route /operations/tasks)
   │
   └── notes               (NEW — freeform notes; route /operations/notes)
          └── client_id ──▶ clients (nullable; NULL = agency-wide; ON DELETE CASCADE)
```

### `notes` — Schema
| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK, `gen_random_uuid()` |
| `user_id` | UUID | NOT NULL, FK → `auth.users` (ON DELETE CASCADE), RLS scope (= workspace owner UID) |
| `client_id` | UUID | Nullable, FK → `clients` (ON DELETE CASCADE); NULL = global agency note |
| `title` | TEXT | NOT NULL |
| `body` | TEXT | NOT NULL DEFAULT `''`; plain text only |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW(); set by app on update |

No storage bucket (text only).

---

## Impact on Existing Features

| Existing Feature | Impact | Action Required |
|---|---|---|
| Tasks/Reminders (`client_notes`) | Renamed + route moved to `/operations/tasks` | Phase 1: update 6 references, header, sidebar |
| Dashboard widget | Deep-links retargeted | Phase 1 |
| Client Overview / Campaign Detail | "Go to tasks" buttons retargeted | Phase 1 |
| Clients | New FK from `notes.client_id` | Phase 2: `ON DELETE CASCADE` (matches `client_notes`) |
| Operations sidebar | New "Notes" item | Phase 2 |

---

## Out of Scope (All Phases)

- Client-detail Notes tab — deferred; global page only for v1 (per user).
- Rich text / markdown / images / attachments — plain text only for v1; future build.
- Note sharing / public tokens / client-facing view — future build.
- Subscription gating — Notes available on all tiers.
- Tags, folders, pinning, full-text search — future build.
- Renaming the `client_notes` table itself — intentionally avoided (risky migration; only the UI label changes).
