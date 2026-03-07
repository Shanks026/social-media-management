# Feature: Document Storage

**Product**: Tercero — Social Media Agency Management SaaS
**File**: `.claude/features/document-feature.md`
**Status**: All phases complete ✅
**Last Updated**: March 2026

---

## Context

Tercero already has a global pattern for operations-level data:

- `/operations/meetings` — global meetings list, filtered per client in the client detail page
- `/operations/notes` — global notes list, filtered per client in the client detail page

Documents follow the **exact same pattern**:

- `/documents` — global documents page (all documents across all clients)
- Client Detail page → Documents tab — filtered view for that client

Every document is tagged to a `client_id`. The default client is the **Internal Account** (`is_internal = true`) — the agency's own workspace. This mirrors how meetings and notes handle internal vs external client assignment.

The app uses React 19 + Vite, Tailwind CSS 4, shadcn/ui (New York style), TanStack React Query, React Hook Form + Zod, Supabase (PostgreSQL + Storage), and `@react-pdf/renderer`. All new code must follow these conventions. Use `useHeader()` for page titles. Follow the existing API layer pattern in `src/api/`.

---

## Phase Overview

```
Phase 1 — Basic Upload & List                          ✅ Complete
Phase 2 — Global Documents Page                        ✅ Complete
Phase 3 — Collections                                  ✅ Complete
Phase 4 — Preview & Enhanced UX                        ✅ Complete
Phase 5 — Move to Collection                           ✅ Complete
```

---

## Data Model (Current — Post Phase 4)

### `client_documents`

| Column              | Type        | Notes                                                                                                             |
| ------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------- |
| `id`                | UUID        | PK                                                                                                                |
| `user_id`           | UUID        | RLS, FK → auth.users                                                                                              |
| `client_id`         | UUID        | FK → clients                                                                                                      |
| `collection_id`     | UUID        | FK → document_collections, nullable — null = ungrouped                                                            |
| `display_name`      | TEXT        | User-facing name                                                                                                  |
| `original_filename` | TEXT        | Actual filename at upload                                                                                         |
| `storage_path`      | TEXT        | Supabase storage path                                                                                             |
| `file_size_bytes`   | BIGINT      | Used for storage quota tracking                                                                                   |
| `mime_type`         | TEXT        | e.g. `application/pdf`, `image/png`                                                                               |
| `category`          | TEXT        | Contract / NDA / Brand Guidelines / Creative Brief / Brand Assets / Meeting Notes / Invoice Finance / SOP / Other |
| `status`            | TEXT        | Active / Archived                                                                                                 |
| `created_at`        | TIMESTAMPTZ |                                                                                                                   |
| `updated_at`        | TIMESTAMPTZ |                                                                                                                   |

### `document_collections`

| Column        | Type        | Notes                                        |
| ------------- | ----------- | -------------------------------------------- |
| `id`          | UUID        | PK                                           |
| `user_id`     | UUID        | RLS, FK → auth.users                         |
| `client_id`   | UUID        | FK → clients — collections are client-scoped |
| `name`        | TEXT        | e.g. "Brand Refresh 2025"                    |
| `description` | TEXT        | Optional                                     |
| `created_at`  | TIMESTAMPTZ |                                              |
| `updated_at`  | TIMESTAMPTZ |                                              |

### Storage Bucket

| Bucket             | Access                     | Path pattern                                     |
| ------------------ | -------------------------- | ------------------------------------------------ |
| `client-documents` | Private — signed URLs only | `{user_id}/{client_id}/{document_id}/{filename}` |

---

## Phase 1 — Basic Upload & List ✅

**What was built:**

- `client_documents` table with RLS and indexes
- `client-documents` Supabase Storage bucket (private, 50MB per file limit)
- `src/api/documents.js` — `useDocuments`, `useDocument`, `useUploadDocument`, `useUpdateDocument`, `useDeleteDocument`, `useArchiveDocument`, `unarchiveDocument`, `getDocumentSignedUrl`
- `MAX_DOCUMENT_SIZE_BYTES` constant added to `src/lib/helper.js`
- Components: `DocumentsTab`, `DocumentUploadZone`, `DocumentCard`, `DocumentCategoryBadge`, `UploadMetaDialog`
- Documents tab added to Client Detail page (existing tabs untouched)
- Storage quota tracked via `increment_storage_used` / `decrement_storage_used` RPCs on `agency_subscriptions`
- Internal Account client gets the same Documents tab — no special casing

**Implementation notes:**

- Archive behaviour in Phase 1 was temporary: archived documents shown dimmed with a Restore option. Superseded by Phase 4 status filter.
- `unarchiveDocument()` added to API to support the temporary restore action.

---

## Phase 2 — Global Documents Page ✅

**What was built:**

- `/documents` route added to `src/App.jsx`
- Documents nav item added to Operations group in sidebar (`FileText` icon)
- `src/pages/documents/DocumentsPage.jsx` — global view of all documents across all clients
- `UploadMetaDialog` extended with optional `showClientSelector` and `defaultClientId` props — backward-compatible
- When uploading from the global page, client selector defaults to Internal Account
- Category filter applied client-side; document count shown in filter bar

---

## Phase 3 — Collections ✅

**What was built:**

- `document_collections` table with RLS and indexes
- `collection_id` nullable FK added to `client_documents` (`ON DELETE SET NULL` — deleting a collection never deletes documents, they become ungrouped)
- API additions: `useCollections`, `createCollection`, `updateCollection`, `deleteCollection`
- `useUploadDocument` updated to accept optional `collectionId`
- Components: `CollectionCard` (accordion expand/collapse), `CreateCollectionDialog`
- `DocumentUploadZone` extended with `compact` prop for use inside CollectionCard
- Collections section in `DocumentsTab` only shown when client has ≥1 collection
- Ungrouped documents shown separately below collections
- Collections filter on global `/documents` page — only shown when a client is selected; includes "Ungrouped" option

**Implementation notes:**

- "Move to Collection" was deprioritised in Phase 3. Built in Phase 5.
- Documents uploaded via the top-level upload zone are ungrouped (`collection_id = null`).
- Documents uploaded via a CollectionCard compact upload zone are assigned that collection.

---

## Phase 4 — Preview & Enhanced UX ✅

**What was built:**

- `DocumentPreviewModal` — PDF via `<iframe>` with signed URL; images via `<img>`; unsupported types (DOCX, XLSX, ZIP, MP4, MOV) show "Preview not available" + Download button
- Signed URL generated on modal open; skeleton shown during generation
- Preview triggered by clicking document name or "Preview" in three-dot menu
- Search input (debounced 300ms) on both `DocumentsTab` and `DocumentsPage` — filters by `display_name` client-side
- Full filter bar: Search / Category / Status / Collection / Upload Document
- Status filter defaults to Active — archived documents hidden until "Archived" or "All statuses" selected
- Archived documents render with `opacity-50` when visible
- Three empty state variants: no documents, empty collection, no search results

---

## Phase 5 — Move to Collection ✅

### Goal

Allow a document to be moved between states: ungrouped → collection, collection → ungrouped, or collection → different collection. This is a single consistent action — "Move to Collection" — available on every `DocumentCard` regardless of context.

No DB changes are required. The `collection_id` nullable FK is already in place from Phase 3. This phase is purely UI and one new API mutation.

### The Action Model

| Document's current state           | Action                 | Result                                            |
| ---------------------------------- | ---------------------- | ------------------------------------------------- |
| Ungrouped (`collection_id = null`) | Move to Collection     | `collection_id` set to selected collection        |
| In a collection                    | Move to Collection     | `collection_id` updated to a different collection |
| In a collection                    | Remove from Collection | `collection_id` set back to `null` (ungrouped)    |

All three map to the same underlying mutation — updating `collection_id` on the document row.

**There is no Copy action.** A document lives in exactly one place: either ungrouped or in one collection. Copy was evaluated and rejected — it creates duplicate records, complicates mutations, and adds dialog friction for a use case that doesn't arise in practice.

### 5.1 No Database Changes

No migrations needed. The `collection_id` column with `ON DELETE SET NULL` is already live from Phase 3.

### 5.2 API Addition

**File to modify: `src/api/documents.js`**

Add one new mutation — `useMoveToCollection`. The existing `useUpdateDocument` must **not** be used for this — it handles rename and category changes. Keep mutations single-purpose.

```javascript
export function useMoveToCollection() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ documentId, collectionId }) => {
      // collectionId: UUID to move into a collection
      // collectionId: null to remove from collection (back to ungrouped)
      const { error } = await supabase
        .from('client_documents')
        .update({
          collection_id: collectionId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', documentId)

      if (error) throw error
    },
    onSuccess: () => {
      // Both must be invalidated — collection document counts change on move
      queryClient.invalidateQueries({ queryKey: ['documents'] })
      queryClient.invalidateQueries({ queryKey: ['collections'] })
    },
  })
}
```

### 5.3 New Component: `MoveToCollectionDialog.jsx`

**New file: `src/components/documents/MoveToCollectionDialog.jsx`**

Triggered from the `DocumentCard` three-dot menu. Receives the document object and shows only collections belonging to that document's `client_id`.

**Props:**

```javascript
MoveToCollectionDialog({
  open, // boolean
  onOpenChange, // setter
  document, // { id, display_name, client_id, collection_id }
})
```

**Data fetching:**
Use the existing `useCollections({ clientId: document.client_id })` hook from Phase 3. No new queries needed.

**Dialog layout:**

```
Title:    "Move to Collection"
Subtitle: Moving: '{document.display_name}'

[ Selectable collection list ]
  ○ Brand Refresh 2025     4 documents
  ○ Onboarding Pack        2 documents
  ● Q1 Campaign            Current        ← pre-selected if doc is already here

[ Remove from collection ]  ← text link, only shown if collection_id is not null

[ Cancel ]  [ Move ]
```

**Behaviour rules:**

- Collections filtered to `document.client_id` — never show collections from other clients
- If document is currently in a collection, that collection is pre-selected with a "Current" label
- If selected collection matches current `collection_id`, the Move button is disabled
- "Remove from Collection" — shown only when `document.collection_id` is not null — calls `useMoveToCollection({ documentId, collectionId: null })`. Lightweight inline confirmation is acceptable (e.g. "Are you sure?" text under the link before confirming). This is not a destructive action — no `AlertDialog` needed.
- **Empty state** (client has no collections): show "No collections yet for this client." with a "Create a collection" button that opens `CreateCollectionDialog` inline. On collection creation, the list refreshes automatically via React Query invalidation — no page reload needed.
- Loading state: skeleton list while `useCollections` fetches
- On move success: toast — "Document moved to [collection name]" or "Document removed from collection" — dialog closes, both document list and collection counts update via query invalidation

**shadcn components:** `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter`, `Button`, `Skeleton`

### 5.4 DocumentCard Updates

**File to modify: `src/components/documents/DocumentCard.jsx`**

Add "Move to Collection" to the three-dot actions dropdown. Position after "Change Category" and before "Archive":

```
Download
Rename
Change Category
Move to Collection    ← new
──────────────────
Archive
Delete
```

Use `FolderInput` from lucide-react as the menu item icon.

`MoveToCollectionDialog` state is managed locally inside `DocumentCard` — no need to lift state up:

```jsx
const [moveDialogOpen, setMoveDialogOpen] = useState(false);

// In DropdownMenuContent:
<DropdownMenuItem onSelect={() => setMoveDialogOpen(true)}>
  <FolderInput className="mr-2 h-4 w-4" />
  Move to Collection
</DropdownMenuItem>

// Outside DropdownMenu:
<MoveToCollectionDialog
  open={moveDialogOpen}
  onOpenChange={setMoveDialogOpen}
  document={document}
/>
```

### 5.5 Context Awareness

`DocumentCard` renders in three contexts:

- `DocumentsTab` on the Client Detail page
- `DocumentsPage` (global)
- `CollectionCard` expanded view

The "Move to Collection" action works identically in all three. The dialog handles all logic internally using `document.client_id` and `document.collection_id`. No parent-level changes needed beyond the `DocumentCard` update itself.

### 5.6 Phase 5 Checklist

- [x] `moveDocumentToCollection()` plain async mutation added to `src/api/documents.js`
- [x] Both `['documents', 'list']` and `['document-collections', clientId]` query keys invalidated on mutation success
- [x] `MoveToCollectionDialog.jsx` created in `src/components/documents/`
- [x] Dialog fetches collections filtered by `document.client_id` via existing `useCollections` hook
- [x] Current collection pre-selected with "Current" label when document is already in one
- [x] Move button disabled when selected collection matches current `collection_id`
- [x] "Remove from Collection" link shown only when `document.collection_id` is not null
- [x] "Remove from Collection" sets `collection_id` to null, shows appropriate toast
- [x] Empty state shown when client has no collections
- [x] `CreateCollectionDialog` launchable from within the empty state
- [x] Collection list refreshes after creating a collection from within the empty state (React Query invalidation)
- [x] On move success: toast with collection name, dialog closes
- [x] "Move to Collection" added to `DocumentCard` three-dot menu (after Rename/Recategorise, before Archive)
- [x] `FolderInput` icon used for the menu item
- [x] Action works correctly from all three contexts: DocumentsTab, DocumentsPage, CollectionCard
- [x] Existing Phase 1–4 functionality unchanged

### Implementation Notes

- Followed codebase convention: `moveDocumentToCollection` is a plain async function (not a React Query mutation hook). The `useMutation` wrapper lives in `MoveToCollectionDialog`.
- Query key for collections is `['document-collections', clientId]` (not `['collections']` as shown in the spec) — matched to the actual `documentKeys` factory.
- `allCollections` key also invalidated so the global Documents page collection filter stays fresh.
- "Remove from Collection" uses a lightweight inline confirm (two-step: click link → confirm/cancel buttons) — no `AlertDialog` per spec.
- `MoveToCollectionDialog` hides itself (`open={open && !createOpen}`) while `CreateCollectionDialog` is open to avoid nested dialog stacking issues.

**→ Stop here. Show the result and wait for approval.**

---

## Impact on Existing Features

| Existing Feature              | Impact                                              | Action                              |
| ----------------------------- | --------------------------------------------------- | ----------------------------------- |
| Client Detail — Documents tab | Move to Collection on all document cards            | DocumentCard updated                |
| Global Documents page         | Move to Collection on all document cards            | Same DocumentCard — no extra work   |
| CollectionCard expanded view  | Move to Collection on documents inside a collection | Same DocumentCard — no extra work   |
| Billing & Usage storage bar   | No impact — move does not change file size          | None                                |
| `useSubscription()` hook      | No new flags needed                                 | None — subscription gating deferred |

---

## App Architecture Conventions

- **API layer**: All Supabase calls in `src/api/documents.js`. Never query Supabase directly from components.
- **React Query**: `queryClient.invalidateQueries()` after all mutations. Key pattern: `['documents', 'list', filters]`, `['collections', 'list', { clientId }]`.
- **Header**: Every page calls `useHeader({ title, breadcrumbs })` from `src/components/misc/header-context.jsx`.
- **Forms**: React Hook Form + Zod for all form validation.
- **Toasts**: `sonner` for all success and error notifications.
- **Dates**: `formatDate()` from `src/lib/helper.js`.
- **Icons**: Lucide icons only.
- **Skeleton loading**: Skeleton screens while data loads — never spinners for content areas.
- **Destructive actions**: `AlertDialog` confirmation before delete. Move and Remove from Collection are not destructive — lightweight inline confirm is sufficient for Remove from Collection.
- **shadcn components**: `Dialog`, `Tabs`, `Badge`, `Button`, `DropdownMenu`, `AlertDialog`, `Input`, `Select`.
- **Tailwind CSS 4**: Utility classes only — no custom CSS files.
- **`@` alias**: All imports use `@/` → `./src/`.

---

## As-Built Notes (March 2026)

All 5 phases are complete. The following captures actual implementation details that differ from or extend the original spec.

### API Layer (`src/api/documents.js`)

**Query key factory** (actual pattern used — not the one shown in the spec):
```js
documentKeys = {
  list:           (filters) => ['documents', 'list', filters ?? {}],
  detail:         (id)      => ['documents', 'detail', id],
  collections:    (clientId) => ['document-collections', clientId],
  allCollections: ()         => ['document-collections', 'all'],
}
```
Always use this factory when invalidating. The spec showed `['collections', 'list', { clientId }]` in one place — that is wrong, the actual key is `['document-collections', clientId]`.

**Mutation pattern**: All mutations are plain async functions, not React Query hooks. The spec listed hook-style names (`useUploadDocument`, etc.) — the actual exports are `uploadDocument`, `updateDocument`, `deleteDocument`, `archiveDocument`, `unarchiveDocument`, `moveDocumentToCollection`, `createCollection`, `updateCollection`, `deleteCollection`. Components call `useMutation({ mutationFn: ... })` directly.

**Upload pipeline**:
1. Sanitise filename (strip emoji, non-ASCII, unsafe chars → underscores; collapse multiples)
2. Storage path: `${userId}/${clientId}/${documentId}/${safeFilename}`
3. Upload to `client-documents` bucket
4. Insert metadata row in `client_documents`
5. Rollback (delete from storage) if DB insert fails
6. Call `increment_storage_used` RPC on `agency_subscriptions`

**`getDocumentSignedUrl(storagePath)`** — generates a 60-minute signed URL from the `client-documents` bucket.

### Components (`src/components/documents/`)

9 components total:

| File | Purpose |
|------|---------|
| `DocumentCard.jsx` | Row item: icon, name, badge, size, date, actions dropdown (preview, download, edit, move, archive, delete) |
| `DocumentUploadZone.jsx` | Drag-drop + picker; validates against `MAX_DOCUMENT_SIZE_BYTES`; `compact` prop for CollectionCard |
| `UploadMetaDialog.jsx` | Upload form (name + category + optional client selector); progress bar; exports `DOCUMENT_CATEGORIES` array |
| `CreateCollectionDialog.jsx` | Create or rename (edit mode); optional client selector for global page |
| `CollectionCard.jsx` | Radix Accordion; compact upload zone inline; rename + delete actions; delete note warns docs go ungrouped |
| `DocumentsTab.jsx` | Scoped to one clientId — reused in Client Detail page |
| `DocumentCategoryBadge.jsx` | Coloured Badge by category (Contract, NDA, Brand Guidelines, Creative Brief, Brand Assets, Meeting Notes, Invoice/Finance, SOP, Other) |
| `DocumentPreviewModal.jsx` | PDF via iframe, images via img; fetches signed URL on open; "Preview not available" + download for DOCX/XLSX/ZIP/MP4/MOV |
| `MoveToCollectionDialog.jsx` | Lists collections for `document.client_id`; "Current" label on existing; "Remove from collection" (inline confirm, not AlertDialog); hides behind CreateCollectionDialog when empty-state creation is triggered |

**`DOCUMENT_CATEGORIES`** is exported from `UploadMetaDialog.jsx` for consistent use across components.

### Global Documents Page (`src/pages/documents/DocumentsPage.jsx`)

Three-tab layout (URL param `doc_tab`):
- **All** — all documents, collections grouped by client when no client filter active
- **Collections** — collection cards (accordion) scoped to selected client; global all-client grouping when no client selected
- **Ungrouped** — only docs with `collection_id = null`

Filters: search (debounced 300ms), client dropdown, category dropdown, status dropdown (defaults to Active — archived hidden until explicitly selected).

Upload flow: file selected → `UploadMetaDialog` opens → progress (10% → 30% → 100%) → dialog auto-closes 400ms after complete.

### Phase 5 Deviations from Spec

- `useMoveToCollection()` hook in the spec was implemented as `moveDocumentToCollection()` plain async function (per API conventions). Hook-level `useMutation` lives in `MoveToCollectionDialog`.
- `MoveToCollectionDialog` manages its own `open` state gating — hides itself (`open={open && !createOpen}`) while `CreateCollectionDialog` is active to avoid nested dialog stacking.
- "Remove from Collection" uses a two-step inline confirm (click → confirm/cancel) rather than an `AlertDialog`.

---

# Document Feature — Phase 6: Subscription-Based Scoping

**Append this to: `.claude/features/document-feature.md`**
**Status**: Ready to implement
**Last Updated**: March 2026

---

## Phase 6 — Subscription-Based Feature Gating

### Goal

Gate the Collections feature (and all related actions) behind the Velocity/Quantum tier using a single new feature flag: `documents_collections`. Everything renders on all tiers — **nothing is hidden**. On Ignite, collections-related UI is visible but locked (disabled + lock icon), consistent with the `calendar_export` pattern already in the codebase.

The per-client Documents tab (upload, view, preview, download, archive, delete) remains fully functional on all tiers including Ignite.

---

### Decision Log

| Decision | Rationale |
|---|---|
| One flag only (`documents_collections`) | Collections is the only meaningful differentiator. The global `/documents` page itself is accessible on all tiers. |
| Show locked UI, never hide | Consistent with existing Ignite UX (calendar export button visible + disabled). Users see what they're missing — passive upsell. |
| Per-client Documents tab fully open | Basic document storage is a core workflow feature, not a power feature. Crippling it on Ignite would be punishing. |
| Global `/documents` page fully open | Page is accessible on all tiers. Collections section within it is locked on Ignite. |
| Shareable links deferred | Not in scope. Revisit after usage data. If built, gate at Quantum only. |

---

### Feature Flag

**One new column on `agency_subscriptions`:**

| Column | Type | Default | Purpose |
|---|---|---|---|
| `documents_collections` | boolean | `false` | Unlocks collections create/manage/move on Velocity+ |

**Flag values per plan:**

| Flag | Trial | Ignite | Velocity | Quantum |
|---|---|---|---|---|
| `documents_collections` | FALSE | FALSE | TRUE | TRUE |

---

### Pre-Implementation Steps (MANDATORY — do not skip)

Before writing any code, Claude Code must:

1. **Use Supabase MCP** to inspect the live `agency_subscriptions` table:
   - Confirm the exact current column list (the v5 doc lists 27 columns — verify this is accurate)
   - Confirm data types and defaults for existing flag columns (`calendar_export`, `finance_recurring_invoices`, `finance_subscriptions`) to match the exact pattern for the new column
   - Check whether any RLS policies need updating

2. **Read the existing `useSubscription.js`** hook in full before modifying it — do not work from memory or from this doc's description of it

3. **Read `src/components/documents/CollectionCard.jsx`**, `CreateCollectionDialog.jsx`, `MoveToCollectionDialog.jsx`, and `DocumentCard.jsx` in full before modifying any of them

4. **Read the existing locked-state implementation** for calendar export in `src/pages/calendar/ContentCalendar.jsx` to match the exact lock pattern used there (icon, disabled state, tooltip text)

5. **Check `.claude/features/00-index.md`** and confirm the feature index entry for documents

---

### Phase 6 Implementation

#### 6.1 Database Migration

**Via Supabase MCP:**

```sql
-- Add the new flag column
ALTER TABLE agency_subscriptions
  ADD COLUMN IF NOT EXISTS documents_collections boolean DEFAULT false;

-- Set correct values per existing plan
UPDATE agency_subscriptions
  SET documents_collections = TRUE
  WHERE plan_name IN ('velocity', 'quantum');

UPDATE agency_subscriptions
  SET documents_collections = FALSE
  WHERE plan_name IN ('trial', 'ignite');
```

Verify after running:
- Column exists with correct default
- Velocity and Quantum rows have `TRUE`
- Trial and Ignite rows have `FALSE`

Also update the seed SQL in the v5 feature doc (`.claude/features/document-tiers-v5.md` or equivalent) to include `documents_collections` so future plan changes set it correctly.

#### 6.2 `useSubscription.js` Update

**File: `src/api/useSubscription.js`**

Add one new `can` method. Match the exact style of existing methods:

```javascript
documentsCollections: () => sub.documents_collections ?? false,
```

Do not change any existing methods. Do not restructure the hook.

#### 6.3 Locked State — UI Rules

Every collections-related interactive element must follow this locked pattern on Ignite (`can.documentsCollections() === false`):

| Element | Locked behaviour |
|---|---|
| "New Collection" button (DocumentsTab + DocumentsPage) | `disabled`, `Lock` icon prepended, tooltip: "Upgrade to Velocity to use Collections" |
| `CollectionCard` — the entire card | Rendered with `opacity-50`, non-interactive overlay or `pointer-events-none`, lock badge in top-right corner |
| "Move to Collection" in `DocumentCard` three-dot menu | `disabled`, `Lock` icon, no `onSelect` handler fires |
| Collections tab/section on global `/documents` page | Rendered, but with a lock state banner above the content: "Collections are available on Velocity and above." + upgrade CTA link to `/billing` |

Use the `Lock` icon from `lucide-react` consistently. Match the exact disabled button pattern from the calendar export implementation.

Do **not** use `AlertDialog` or any modal for the locked state — the visual disabled state is sufficient.

#### 6.4 Files to Modify

| File | Change |
|---|---|
| `src/api/useSubscription.js` | Add `documentsCollections` to `can` object |
| `src/components/documents/DocumentCard.jsx` | Lock "Move to Collection" menu item when `!can.documentsCollections()` |
| `src/components/documents/DocumentsTab.jsx` | Lock "New Collection" button + CollectionCard rendering |
| `src/pages/documents/DocumentsPage.jsx` | Lock Collections tab/section + "New Collection" button |
| `src/components/documents/CollectionCard.jsx` | Accept/handle locked prop or derive from `useSubscription` internally |
| `src/components/documents/MoveToCollectionDialog.jsx` | Guard: if `!can.documentsCollections()`, do not open (belt-and-suspenders, the menu item should already be disabled) |
| `src/components/documents/CreateCollectionDialog.jsx` | Guard: if `!can.documentsCollections()`, do not open |

**Do not modify:**
- `DocumentUploadZone.jsx` — upload is open to all tiers
- `DocumentPreviewModal.jsx` — preview is open to all tiers
- `DocumentCategoryBadge.jsx` — no gating
- Any finance, meetings, or calendar files

#### 6.5 Upgrade CTA Copy

Consistent copy to use across all locked states:

- Tooltip on disabled buttons: `"Collections are available on Velocity and above"`
- Lock banner on collections section: `"Organise your documents into collections. Available on Velocity and above."` + `<Link to="/billing">Upgrade your plan →</Link>`

Keep it factual and direct — consistent with Tercero's confident, no-fluff voice.

---

### Phase 6 Checklist

- [ ] `documents_collections` column added to `agency_subscriptions` via Supabase MCP
- [ ] Velocity and Quantum rows set to `TRUE`, Trial and Ignite to `FALSE`
- [ ] Column verified live in DB before any frontend work begins
- [ ] `useSubscription.js` — `can.documentsCollections()` added
- [ ] "New Collection" button locked on Ignite (DocumentsTab)
- [ ] "New Collection" button locked on Ignite (DocumentsPage)
- [ ] `CollectionCard` renders in locked/dimmed state on Ignite
- [ ] "Move to Collection" menu item disabled on Ignite (DocumentCard)
- [ ] Collections section on DocumentsPage shows lock banner on Ignite
- [ ] `MoveToCollectionDialog` has belt-and-suspenders guard
- [ ] `CreateCollectionDialog` has belt-and-suspenders guard
- [ ] Lock icon and disabled state match the calendar export pattern exactly
- [ ] Upgrade CTA links to `/billing`
- [ ] Per-client Documents tab (upload, view, download, preview, archive, delete) fully functional on Ignite — no regression
- [ ] Global `/documents` page loads and functions on Ignite (ungrouped docs visible and usable)
- [ ] Velocity account: all collections features fully functional
- [ ] Quantum account: all collections features fully functional
- [ ] No existing Phase 1–5 functionality broken

---

### What Stays Open on All Tiers (Never Gate These)

- Document upload (per-client tab and global page)
- Preview modal
- Download
- Rename
- Change category
- Archive / unarchive
- Delete
- Search and filters
- Storage quota tracking

---

### Out of Scope for This Phase

- Shareable document/collection links — deferred, revisit after usage data
- Per-tier storage enforcement UI (storage bar already exists in Billing page)
- Any new pricing page or billing changes
- Admin-side plan management

---

### Implementation Notes

*(Claude Code fills this in after completing the phase)*

## Out of Scope

- **Bulk move**: Select multiple documents and move them all into a collection at once — future follow-up if usage data justifies it
- **Copy document to collection**: Evaluated and rejected — a document lives in exactly one place
- **Document templates**: Separate future build
- **AI document generation**: Separate future build
- **Document sharing with clients via public link**: Separate future build
- **E-signature**: Separate future build
- **Document version history**: Separate future build
- **Full-text search inside document content**: Separate future build
- **Subscription tier gating**: Deferred — all document features open to all tiers until gating implementation
