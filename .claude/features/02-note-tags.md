# Feature: Note Tags

**Product**: Tercero — Social Media Agency Management SaaS
**File**: `.claude/features/02-note-tags.md`
**Status**: Planned
**Last Updated**: June 2026

---

## Context

Notes (`/operations/notes`) currently have one organization axis — an optional client link. To make Notes feel like a real Notion replacement, we add **dynamic, user-created tags**: colored pill labels the agency defines once and reuses across all notes. Tags are a flat, many-to-many label system (a note can carry several), deliberately **not** a folder/collection hierarchy — we evaluated collections (mirroring `document_collections`) and chose tags for flexibility and lower management overhead. Tags are workspace-scoped like every other Notes entity (`user_id = get_my_agency_user_id()`).

---

## Phase Overview

```
Phase 1 — Tags: model + apply + display
  Create the tag data model, let users create/apply/remove tags inline in the
  note editor (Notion-style picker), and render tag pills on note cards.

Phase 2 — Organize: filter + manage
  Filter the notes list by one or more tags via clickable chips, and add a
  lightweight manage-tags surface to rename, recolor, and delete tags.
```

**After each phase: stop and wait for approval before proceeding.**

---

## Phase 1 — Tags: model + apply + display — ✅ Complete

### Goal

A user opens a note, clicks "+ Add tag", and either picks an existing tag or types a new name and creates it on the spot (auto-assigned a color from a fixed palette). The tag attaches immediately and renders as a colored pill on both the editor page and the note card in the list. Tags are reusable across every note in the workspace. At the end of this phase the agency can label notes; filtering and tag management come in Phase 2.

### Before Starting — Confirm With Codebase

Read and verify these before writing any code:

1. **`src/api/agencyNotes.js`** — confirm `useAgencyNotes()` / `useAgencyNoteById()` use `.select('*')` and the list query key is `['agency-notes', 'list', { userId: workspaceUserId }]`, detail is `['agency-notes', 'detail', noteId]`. The new tag joins extend these selects.
2. **`src/lib/workspace.js`** — confirm `resolveWorkspace()` returns `{ workspaceUserId }` (used by plain mutation functions, matching `createAgencyNote`).
3. **`document_collections` RLS** — already confirmed: single `FOR ALL` policy `user_id = get_my_agency_user_id()` (both USING and WITH CHECK). Mirror this for `note_tags`.
4. **`src/components/notes/AgencyNoteCard.jsx`** — confirm the footer layout (dashed separator + client/date row) so tag pills slot in cleanly between the body excerpt and the dashed separator.
5. **`src/pages/NoteEditorPage.jsx`** — confirm the client-link bar (`{/* Client link */}`, the `border-b` row) so the tag row sits directly beneath it, and confirm `editorRef`/`queryClient` are already in scope.
6. **shadcn `Popover` + `Command`** — verify `@/components/ui/popover.jsx` and `@/components/ui/command.jsx` exist (used for the tag picker). If `command` is absent, fall back to a plain filtered list inside the popover.

### 1.1 Database

Two new tables. Apply via `apply_migration` (migration name: `note_tags`).

```sql
-- Dynamic tag definitions, workspace-scoped.
create table public.note_tags (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null,
  color      text not null default 'slate',
  created_at timestamptz not null default now()
);

-- One tag name per workspace (case-insensitive).
create unique index note_tags_user_name_unique
  on public.note_tags (user_id, lower(name));

-- Note ↔ tag junction.
create table public.note_tag_links (
  note_id uuid not null references public.notes (id) on delete cascade,
  tag_id  uuid not null references public.note_tags (id) on delete cascade,
  primary key (note_id, tag_id)
);

-- Filter-by-tag lookups (note_id is already the PK's leading column).
create index note_tag_links_tag_id_idx on public.note_tag_links (tag_id);

-- RLS
alter table public.note_tags enable row level security;
alter table public.note_tag_links enable row level security;

create policy note_tags_workspace_scoped on public.note_tags
  for all
  using (user_id = get_my_agency_user_id())
  with check (user_id = get_my_agency_user_id());

-- Junction has no user_id; scope through the parent note.
create policy note_tag_links_workspace_scoped on public.note_tag_links
  for all
  using (
    exists (
      select 1 from public.notes n
      where n.id = note_id and n.user_id = get_my_agency_user_id()
    )
  )
  with check (
    exists (
      select 1 from public.notes n
      where n.id = note_id and n.user_id = get_my_agency_user_id()
    )
  );
```

Notes:
- `color` stores a palette **key** (e.g. `'blue'`), never a raw hex — the app maps it to Tailwind classes. No DB `CHECK` so the palette can grow without a migration.
- `ON DELETE CASCADE` on both junction FKs: deleting a note removes its links; deleting a tag removes its links from all notes (no orphan rows). This matches the `notes.client_id` cascade behavior already in place.

### 1.2 API Layer

**New file: `src/api/noteTags.js`**

```js
// Reads
useNoteTags()                         // queryKey: ['note-tags', 'list', { userId }]
                                      // → [{ id, name, color, created_at }] ordered by name asc
                                      // enabled: !!workspaceUserId

// Mutations (plain async — used with useMutation by callers)
createNoteTag({ name, color })        // resolveWorkspace() → insert; returns the row.
                                      //   Throws on unique-violation (caller surfaces "Tag already exists").
addTagToNote(noteId, tagId)           // upsert into note_tag_links (ignore-duplicates)
removeTagFromNote(noteId, tagId)      // delete one link row
```

`updateNoteTag` / `deleteNoteTag` are **deferred to Phase 2** (management surface). Only what Phase 1 needs ships in Phase 1.

**Edit `src/api/agencyNotes.js`** — extend both read queries to embed tags via PostgREST and normalize the shape so consumers get a flat `tags` array:

```js
// list + detail select string
`*, note_tag_links ( note_tags ( id, name, color ) )`

// normalize each row before returning:
const normalize = (row) => ({
  ...row,
  tags: (row.note_tag_links ?? [])
    .map((l) => l.note_tags)
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name)),
})
```

Apply `normalize` in both `useAgencyNotes` (map over array) and `useAgencyNoteById` (single row). Drop the raw `note_tag_links` key from the returned object so consumers only see `note.tags`. Per `api-conventions.md`, consumers must not deal with join aliases.

**Query invalidation contract** (callers do this in `useMutation` `onSuccess`):
- After create/add/remove tag → invalidate `['note-tags', 'list']` (for create) **and** `['agency-notes', 'list']` + `['agency-notes', 'detail', noteId]` (so cards and the editor re-fetch tags).

### 1.3 Components

**New file: `src/lib/noteTags.js`** — color palette (plain JS, no React).

```js
// Fixed palette. Keys are stored in the DB; classes are STATIC strings so
// Tailwind's JIT never purges them. Each entry: pill (bg+text+border) + dot.
export const TAG_COLORS = {
  slate:  { label: 'Slate',  pill: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',  dot: 'bg-slate-400' },
  red:    { ... },
  orange: { ... },
  amber:  { ... },
  green:  { ... },
  teal:   { ... },
  blue:   { ... },
  indigo: { ... },
  violet: { ... },
  pink:   { ... },
}
export const TAG_COLOR_KEYS = Object.keys(TAG_COLORS)
export function getTagColor(key) { return TAG_COLORS[key] ?? TAG_COLORS.slate }
// Deterministic default color for a freshly created tag (spreads colors out).
export function nextTagColor(existingCount) {
  return TAG_COLOR_KEYS[existingCount % TAG_COLOR_KEYS.length]
}
```

**New file: `src/components/notes/TagPill.jsx`**
- Props: `tag` (`{ name, color }`), `onRemove` (optional), `size` (`'sm' | 'xs'`, default `'sm'`), `className`.
- Renders a rounded pill using `getTagColor(tag.color).pill`. A small leading dot (`getTagColor().dot`) is optional — include it for clarity.
- When `onRemove` is provided, render a trailing `X` (lucide, `size-3`) button; `onClick` calls `onRemove` and `stopPropagation` (so removing a tag on a card doesn't open the note).

**New file: `src/components/notes/TagPicker.jsx`** — the Notion-style inline picker.
- Props: `selectedTagIds` (array), `allTags` (array from `useNoteTags`), `onToggle(tagId)`, `onCreate(name)` → returns the created tag (async), `isBusy`.
- UI: a `Popover`. Trigger is a small dashed "+ Add tag" button (lucide `Plus`, `size-3.5`). Content:
  - A search `Input` (controlled `query` state) at the top.
  - A scrollable list of `allTags` filtered by `query` (case-insensitive). Each row: a `TagPill` (no remove) + a `Check` when selected; clicking toggles via `onToggle`.
  - When `query` is non-empty and **no exact (case-insensitive) name match** exists, show a final row: `Create "<query>"` with a `Plus` icon; clicking calls `onCreate(query)` then toggles it on, and clears `query`.
- Keep selection state owned by the parent (the editor) — the picker is controlled.

**File tree after Phase 1:**
```
src/
  api/
    noteTags.js            (new)
    agencyNotes.js         (edited — tag joins)
  lib/
    noteTags.js            (new — palette)
  components/notes/
    TagPill.jsx            (new)
    TagPicker.jsx          (new)
    AgencyNoteCard.jsx     (edited — render pills)
  pages/
    NoteEditorPage.jsx     (edited — tag row + picker)
```

### 1.4 Editor & Card Integration

**`src/pages/NoteEditorPage.jsx`**
- Add `const { data: allTags } = useNoteTags()`.
- Track applied tags from the loaded note: derive from `note.tags` (already embedded). Keep a local `tagIds` set seeded from `note.tags` on load (guarded set-during-render, same pattern as `title`/`clientId`), OR — simpler and preferred — drive directly off `note.tags` and rely on query invalidation to refresh after each toggle (no local mirror, fewer sync bugs). **Use the invalidation-driven approach**: the picker mutates, invalidates `['agency-notes','detail',noteId]`, and `note.tags` re-renders.
- Render a **tag row** directly beneath the client-link `border-b` bar: the note's current tags as `TagPill`s (each with `onRemove` → `removeTagFromNote` mutation), followed by `<TagPicker>`.
- Tag mutations use `useMutation` wrappers (add/remove/create) with the invalidation contract from 1.2. Tag changes are **independent of the note auto-save** (they're junction rows) — do **not** route them through `scheduleSave`/`valuesRef`, and do **not** set `dirtyRef` (so adding a tag then hitting Back doesn't bump `updated_at` / reorder the list — preserves the existing no-spurious-reorder behavior).

**`src/components/notes/AgencyNoteCard.jsx`**
- Between the body excerpt block and the dashed separator, render a wrapped row of `TagPill`s (size `'xs'`, no remove button) from `note.tags`. Cap at ~3 visible with a `+N` overflow pill if more. Render nothing if `note.tags` is empty (no layout shift).

### 1.5 Impact on Existing Features

| Existing Feature | Impact | Watch for |
|---|---|---|
| Notes list (`useAgencyNotes`) | Query select gains a tag join; return shape gains `note.tags` | Existing consumers untouched (`tags` is additive); confirm normalization strips `note_tag_links` |
| Note editor (`useAgencyNoteById`) | Same join + `note.tags` | Tag mutations must not trip `dirtyRef` / auto-save |
| Note card | Renders pills | Empty `tags` → render nothing, no spacing change |
| Note delete | `note_tag_links` rows cascade-delete | Verified via FK `ON DELETE CASCADE` |

### 1.6 What This Phase Does NOT Include

- Filtering the notes list by tag (Phase 2).
- Renaming, recoloring, or deleting tags (Phase 2 — `updateNoteTag`/`deleteNoteTag`).
- A dedicated tag-management settings screen.
- Tags on the per-client view, dashboard, or anywhere outside the Notes list + editor.
- Subscription gating (Notes is ungated; tags follow suit — see Out of Scope).
- Tag usage counts / analytics.

### 1.7 Phase 1 Checklist — Before Marking Complete

- [x] `note_tags` and `note_tag_links` tables exist with the RLS policies above; both confirmed via a test query (RLS on, single ALL policy each).
- [x] `note_tags_user_name_unique` rejects a duplicate tag name (case-insensitive) — unique index on `(user_id, lower(name))` confirmed present.
- [x] Deleting a note removes its `note_tag_links` rows; deleting a tag removes its links everywhere — both junction FKs confirmed `ON DELETE CASCADE` (`confdeltype = 'c'`).
- [x] `src/api/noteTags.js` exports `useNoteTags`, `createNoteTag`, `addTagToNote`, `removeTagFromNote` per the signatures in 1.2.
- [x] `useAgencyNotes` / `useAgencyNoteById` return `note.tags` as a sorted `[{id,name,color}]` array; `normalizeNote` strips the raw `note_tag_links` key.
- [x] `src/lib/noteTags.js` palette uses only static Tailwind class strings (survives production `npm run build`).
- [x] In the editor: "+ Add tag" opens the picker; selecting an existing tag attaches it; typing a new name shows `Create "<name>"` and creates + attaches it; the pill appears immediately. *(implemented per spec; ready for your click-through)*
- [x] Removing a tag (X on the editor pill) detaches it immediately. *(implemented)*
- [x] Adding/removing a tag in the editor then clicking Back does **not** reorder the note — tag mutations bypass `dirtyRef`/auto-save entirely.
- [x] Note cards show tag pills (max 3 + `+N` overflow), and show nothing when a note has no tags.
- [x] `npm run lint` clean; `npm run build` succeeds.

### Implementation Notes

- **DB**: migration `note_tags` created both tables, the case-insensitive unique index, the `tag_id` filter index, RLS (single ALL policy each, mirroring `document_collections`), and both cascade FKs. Verified live.
- **Tag picker UX**: built on `Popover` + a controlled `Input` + a plain filtered list rather than `cmdk`/`Command` — gives precise control over the toggle + `Create "<query>"` row and avoids cmdk's built-in filtering hiding the create option. Enter creates when a `Create` row is shown.
- **New-tag color**: auto-assigned via `nextTagColor(allTags.length)` (deterministic round-robin through the 10-color palette). Recoloring is a Phase 2 (manage-tags) capability.
- **No local tag mirror in the editor**: tags render directly off `note.tags`; each mutation invalidates `['agency-notes','detail',noteId]` + `['agency-notes','list']` so the pills and cards refresh. This is the invalidation-driven approach chosen in the plan (fewer sync bugs than a local copy).
- **Auto-save isolation confirmed**: tag mutations never call `scheduleSave` and never set `dirtyRef`, so they don't bump `updated_at` — the no-spurious-reorder behavior from feature 01 is preserved.

**→ Stopped here. Phase 2 (filter + manage) awaits approval.**

---

## Phase 2 — Organize: filter + manage — ✅ Complete

### Goal

The notes list gains a row of tag filter chips — clicking one (or several) narrows the grid to notes carrying those tags, composing with the existing search and client filter. A lightweight "Manage tags" surface lets the user rename a tag, change its color, and delete it (with a confirm that explains it will be removed from all notes). At the end of this phase tags are fully self-service.

### Before Starting — Confirm Phase 1 is Approved

1. Re-read `src/pages/Notes.jsx` — confirm the controls row (search + client `Select`) and the `filteredNotes` `useMemo` so the tag filter slots into the same memo.
2. Confirm `useNoteTags()` shape and the `['note-tags','list']` key from Phase 1.
3. Confirm `TagPill` accepts an `active`/selected visual state or decide whether filter chips reuse `TagPill` or a dedicated toggle chip.

### 2.1 Database

No database changes in this phase.

### 2.2 API Layer

**Add to `src/api/noteTags.js`:**
```js
updateNoteTag(id, { name, color })   // update; throws on unique-violation (rename collision)
deleteNoteTag(id)                    // delete tag row (links cascade away)
```
Invalidation: both invalidate `['note-tags','list']` and `['agency-notes','list']` (+ open detail) since pills on cards/editor reflect name/color or disappear.

### 2.3 Components

- **`src/pages/Notes.jsx`**:
  - Add `selectedTagIds` state (array). Render a wrap of tag chips under the controls row (only when `allTags.length > 0`): each chip is a clickable `TagPill` with an active/inactive state; clicking toggles membership in `selectedTagIds`. A "Clear" affordance appears when any are selected.
  - Extend the `filteredNotes` `useMemo`: a note passes the tag filter when it carries **all** selected tags (AND semantics) — decide AND vs OR; default **OR** (note has *any* selected tag) is the more common expectation for label filters. **Use OR.** Document the choice inline.
  - Empty state copy adjusts when a tag filter yields nothing ("No notes match these tags").
- **Manage tags** — a small surface reachable from the tag-chips row (e.g. a `Settings2`/`Tags` icon button opening a `Popover` or `Dialog`):
  - Lists all tags; each row: inline-editable name, a color swatch picker (the `TAG_COLORS` palette), and a delete button.
  - Delete uses `AlertDialog`: "Delete tag '<name>'? It will be removed from N notes. This can't be undone."
  - Rename collision (unique violation) surfaces a `toast.error`.

### 2.4 Impact on Existing Features

| Existing Feature | Impact | Watch for |
|---|---|---|
| Notes list filtering | New tag dimension composes with search + client filter | All three filters must AND together; tag membership is OR within the tag set |
| Note cards / editor pills | Rename/recolor reflects after invalidation; delete removes pill | Ensure open editor re-fetches |

### 2.5 What This Phase Does NOT Include

- Drag-to-reorder tags, tag groups, or nested tags.
- Bulk tag operations (apply a tag to many notes at once).
- Tag-based views outside the Notes list.

### 2.6 Phase 2 Checklist — Before Marking Complete

- [x] Tag filter chips render on the list (only when tags exist); clicking toggles selection; "Clear" resets.
- [x] Tag filter composes correctly with search and client filter (all AND together; OR within selected tags).
- [x] Manage-tags surface renames a tag (collision → toast error), recolors it (swatch popover), and deletes it.
- [x] Deleting a tag removes it from all note cards/editor and from the filter chips without a manual refresh (mutations invalidate `note-tags` + `agency-notes` lists; stale filter ids pruned).
- [x] Empty state copy reflects an active tag filter ("No notes match these tags…").
- [x] `npm run lint` clean; `npm run build` succeeds.

### Implementation Notes

- **Filter chips**: reuse `TagPill` wrapped in a toggle button — selected chips get a `ring-2 ring-offset` highlight, unselected are dimmed to `opacity-60`. OR semantics within the tag set, AND with search + client filter (documented inline in the `filteredNotes` memo).
- **Manage surface**: a `Dialog` (not a popover) reached via a "Manage" ghost button on the chips row. Each row = a color-swatch `Popover` (10-swatch grid) + inline-editable name `Input` (commits on blur/Enter) + "N notes" count + delete. Delete uses `AlertDialog` with a count-aware message ("removed from N notes").
- **Note counts**: computed client-side from the already-loaded `useAgencyNotes` data (`note.tags`), so no extra query — passed into the dialog as a `{tagId: count}` map.
- **Stale-filter guard**: deleting a tag that's an active filter would otherwise wedge the list; pruned via the guarded set-during-render pattern (`selectedTagIds` filtered against current `allTags`).
- **Rename collision**: unique-violation surfaces a friendly toast and reverts the input to the prior name.

**→ Phase 2 complete. Feature done.**

---

## Data Model Summary (Final State After All Phases)

```
auth.users (agency owner = workspace)
   │  user_id
   ├── notes ──────────────┐ (existing; client_id nullable = agency-wide)
   │                       │ note_id (ON DELETE CASCADE)
   │                  note_tag_links ── tag_id (ON DELETE CASCADE) ── note_tags
   │                       │                                              │
   └── note_tags ──────────┘ user_id (workspace-scoped)──────────────────┘
```

### `note_tags` — Schema
| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK, `gen_random_uuid()` |
| `user_id` | UUID | FK → auth.users, RLS scope (`get_my_agency_user_id()`) |
| `name` | text | NOT NULL; unique per workspace (case-insensitive) |
| `color` | text | NOT NULL, default `'slate'`; palette key, not hex |
| `created_at` | timestamptz | default `now()` |

### `note_tag_links` — Schema
| Column | Type | Notes |
|---|---|---|
| `note_id` | UUID | FK → notes, `ON DELETE CASCADE`, part of PK |
| `tag_id` | UUID | FK → note_tags, `ON DELETE CASCADE`, part of PK |

No storage bucket. No edge function.

---

## Impact on Existing Features

| Existing Feature | Impact | Action Required |
|---|---|---|
| `useAgencyNotes` / `useAgencyNoteById` | Selects gain tag join; rows gain `note.tags` | Normalize + strip `note_tag_links` |
| `AgencyNoteCard` | Renders tag pills | Handle empty/overflow |
| `NoteEditorPage` | Tag row + picker; tag mutations bypass auto-save | Don't trip `dirtyRef` |
| `Notes` list page | Tag filter chips + manage surface (Phase 2) | Compose filters |

---

## Out of Scope (All Phases)

- **Collections / folders for notes** — deliberately rejected in favor of tags; do not build a `note_collections` table.
- **Subscription gating** — Notes is ungated, so tags ship ungated. (If gating is later desired, `documents_collections` at Velocity+ is the precedent to follow — a separate decision, not this feature.)
- **Tags on entities other than notes** (posts, documents, clients) — future build if ever wanted; would not reuse `note_tags`.
- **Bulk tagging, tag groups, nested/hierarchical tags, tag analytics** — future builds.
- **Per-client view tag filtering** — Notes has no client-detail tab today; out of scope.
