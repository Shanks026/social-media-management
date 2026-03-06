# Feature: Document Storage
**Product**: Tercero — Social Media Agency Management SaaS
**File**: `.claude/features/document-feature.md`
**Status**: Phase 4 complete — all phases done ✅
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
Phase 1 — Basic Upload & List
  Simple document upload. No collections. Just get files into the system.

Phase 2 — Global Documents Page
  /documents route. Same component reused from client detail tab.

Phase 3 — Collections
  Optional grouping layer. Create a collection, upload documents into it.

Phase 4 — Preview & Enhanced UX
  PDF and image inline preview. Search, filter, empty states.
```

**After each phase: stop and wait for approval before proceeding.**

---

## Phase 1 — Basic Upload & List

### Goal
A working Documents tab on the Client Detail page. Upload a file, see it in the list, download it, delete it. Nothing else.

### Before Starting — Ask Claude Code to Confirm
- What tabs currently exist on the Client Detail page (`src/pages/clients/ClientDetails.jsx`)? List them exactly.
- What is the `client_id` of the Internal Account for the logged-in user? (Check the clients table — `is_internal = true`)
- Is `@react-pdf/renderer` already installed? (It is — used for invoice PDFs and calendar export — but confirm.)
- What is the existing storage bucket name for post media? (`post-media`) — confirm before creating the new one.

### 1.1 Database

**New table: `client_documents`**

```sql
CREATE TABLE client_documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id       UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  display_name    TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  storage_path    TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  mime_type       TEXT NOT NULL,
  category        TEXT NOT NULL DEFAULT 'Other'
                    CHECK (category IN (
                      'Contract',
                      'NDA',
                      'Brand Guidelines',
                      'Creative Brief',
                      'Brand Assets',
                      'Meeting Notes',
                      'Invoice / Finance',
                      'SOP',
                      'Other'
                    )),
  status          TEXT NOT NULL DEFAULT 'Active'
                    CHECK (status IN ('Active', 'Archived')),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE client_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own documents"
  ON client_documents FOR ALL
  USING (user_id = auth.uid());

-- Indexes
CREATE INDEX idx_client_documents_client_id ON client_documents(client_id);
CREATE INDEX idx_client_documents_user_id   ON client_documents(user_id);
CREATE INDEX idx_client_documents_category  ON client_documents(category);
CREATE INDEX idx_client_documents_status    ON client_documents(status);
```

**New Supabase Storage bucket: `client-documents`**

```
Bucket settings:
- Name: client-documents
- Public: false (private — signed URLs only, never public URLs)
- File size limit: 52428800 (50MB per file)
- Allowed MIME types: none (allow all — enforced at application layer)

Storage path structure:
{user_id}/{client_id}/{document_id}/{original_filename}
```

Storage RLS policies:
```sql
-- Authenticated users can upload to their own prefix
CREATE POLICY "Users upload own documents"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'client-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Authenticated users can read their own documents
CREATE POLICY "Users read own documents"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'client-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Authenticated users can delete their own documents
CREATE POLICY "Users delete own documents"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'client-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
```

### 1.2 API Layer

**New file: `src/api/documents.js`**

Exports:
```javascript
// Queries (React Query hooks)
useDocuments({ clientId, category, status })   // list documents, filter optional
useDocument(id)                                 // single document by id

// Mutations
useUploadDocument()     // upload file to storage + insert metadata row
useUpdateDocument()     // rename, change category
useDeleteDocument()     // delete from storage + delete metadata row
useArchiveDocument()    // set status = 'Archived'

// Utility
getDocumentSignedUrl(storagePath)  // generates a short-lived signed URL for download/preview
```

Query key pattern (follow existing conventions in the codebase):
```javascript
['documents', 'list', { clientId, category, status }]
['documents', 'detail', id]
```

Upload flow:
1. Generate a new UUID for `document_id`
2. Build the storage path: `{user_id}/{client_id}/{document_id}/{original_filename}`
3. Upload file to `client-documents` bucket at that path
4. On storage upload success: insert row into `client_documents`
5. On metadata insert failure: delete the uploaded file (rollback)
6. Invalidate `['documents', 'list']` query on success

Delete flow:
1. Fetch the document row to get `storage_path`
2. Delete the storage object from `client-documents`
3. Delete the metadata row from `client_documents`
4. Invalidate `['documents', 'list']` query on success

Signed URL generation:
```javascript
// Use Supabase storage createSignedUrl — 60 minute expiry
const { data } = await supabase.storage
  .from('client-documents')
  .createSignedUrl(storagePath, 3600);
return data.signedUrl;
```

### 1.3 Components

**New files:**

```
src/
├── api/
│   └── documents.js                     ← new
├── components/
│   └── documents/
│       ├── DocumentsTab.jsx             ← main tab content
│       ├── DocumentUploadZone.jsx       ← drag-drop + file picker
│       ├── DocumentCard.jsx             ← single document row
│       ├── DocumentCategoryBadge.jsx    ← category label badge
│       └── UploadMetaDialog.jsx         ← name + category after upload
```

**`DocumentsTab.jsx`** — accepts a `clientId` prop. When `clientId` is the internal account's id, behaviour is identical — no special casing needed.

**`DocumentUploadZone.jsx`**:
- Drag and drop area + "Upload Document" button
- Accepted file types: `.pdf, .doc, .docx, .xls, .xlsx, .png, .jpg, .jpeg, .gif, .zip, .mp4, .mov`
- Max file size: 50MB — validate client-side before upload, show clear error if exceeded
- Shows upload progress (percentage)
- On file selected/dropped → opens `UploadMetaDialog`

**`UploadMetaDialog.jsx`**:
- `display_name` field — pre-filled with filename (without extension), editable
- `category` select — dropdown with all category options, defaults to "Other"
- "Upload" confirm button — triggers the actual upload
- Shows progress during upload, success toast on completion

**`DocumentCard.jsx`**:
- File name (display_name)
- Category badge
- File size (formatted: "2.4 MB")
- Upload date (use existing `formatDate()` from `src/lib/helper.js`)
- File type icon (PDF, image, Word, Excel, etc. — use lucide icons)
- Actions dropdown (three-dot menu): Download, Rename, Change Category, Archive, Delete
- Download triggers `getDocumentSignedUrl()` then opens in new tab or triggers browser download depending on mime type

**`DocumentCategoryBadge.jsx`**:
- Consistent colour per category (follow the existing badge pattern in shadcn)

### 1.4 Client Detail Page Integration

**File to modify: `src/pages/clients/ClientDetails.jsx`**

Add a new "Documents" tab to the existing tab layout. Do not rename, reorder, or remove any existing tabs. Add Documents as the last tab before Settings (or at the end of the existing list — match the existing tab order convention).

```jsx
// Add to tab triggers:
<TabsTrigger value="documents">Documents</TabsTrigger>

// Add to tab content:
<TabsContent value="documents">
  <DocumentsTab clientId={clientId} />
</TabsContent>
```

Import `DocumentsTab` from `src/components/documents/DocumentsTab.jsx`.

### 1.5 Storage Usage Update

**File to check and potentially update: `src/pages/billingAndUsage/BillingUsage.jsx`**

The existing storage usage bar reads from `current_storage_used` on `agency_subscriptions`. When a document is uploaded, update `current_storage_used` by adding the file size. When deleted, subtract it.

Add this to `useUploadDocument()` mutation on success:
```javascript
// After successful upload and metadata insert:
await supabase
  .from('agency_subscriptions')
  .update({ 
    current_storage_used: supabase.raw(`current_storage_used + ${fileSizeBytes}`)
  })
  .eq('user_id', userId);
```

And to `useDeleteDocument()` on success:
```javascript
await supabase
  .from('agency_subscriptions')
  .update({ 
    current_storage_used: supabase.raw(`GREATEST(0, current_storage_used - ${fileSizeBytes})`)
  })
  .eq('user_id', userId);
```

> `GREATEST(0, ...)` prevents the value going negative if there's any inconsistency.

### 1.6 What Phase 1 Does NOT Include
- Global `/documents` page (Phase 2)
- Collections (Phase 3)
- PDF/image inline preview modal (Phase 4)
- Search and filter bar (Phase 4)
- Empty state illustrations (Phase 4)

### 1.7 Phase 1 Checklist — ✅ COMPLETE
- [x] `client_documents` table created with RLS
- [x] `client-documents` Supabase Storage bucket created (private)
- [x] Storage RLS policies applied
- [x] `src/api/documents.js` created with all hooks
- [x] `DocumentsTab`, `DocumentUploadZone`, `DocumentCard`, `DocumentCategoryBadge`, `UploadMetaDialog` components created
- [x] Documents tab added to Client Detail page without breaking existing tabs
- [x] File upload works (drag-drop and file picker)
- [x] File size validation (50MB limit) works client-side — constant `MAX_DOCUMENT_SIZE_BYTES` in `src/lib/helper.js`
- [x] `UploadMetaDialog` opens after file selection
- [x] Document appears in list after upload
- [x] Download works via signed URL
- [x] Delete removes from storage and metadata table
- [x] `current_storage_used` updates on upload and delete (via `increment_storage_used` / `decrement_storage_used` RPCs)
- [x] Internal Account client gets the same Documents tab — no special casing
- [x] Toast notifications on success and error
- [x] All existing Client Detail tabs remain unchanged

### 1.8 Phase 1 Implementation Notes
- **Archive behaviour (temporary)**: Archived documents are shown dimmed (50% opacity) with an "Archived" label and a "Restore" menu item, instead of being hidden. This is a temporary UX until Phase 4 adds the status filter bar. When Phase 4 is implemented, archived documents will be hidden by default with a status filter to reveal them.
- **`unarchiveDocument()`** added to API to support restore from the card menu.

---

## Phase 2 — Global Documents Page

### Goal
A `/documents` route in the Operations section of the sidebar (alongside Meetings and Notes). Shows all documents across all clients. The `DocumentsTab` component built in Phase 1 is reused here with no `clientId` filter — or with a `clientId` filter applied from a dropdown.

### Before Starting — Confirm Phase 1 is Approved

### 2.1 Route

**File to modify: `src/App.jsx`**

Add the documents route inside the authenticated route group, alongside the existing operations routes:

```jsx
<Route path="/documents" element={<DocumentsPage />} />
```

### 2.2 Sidebar Navigation

**File to modify: `src/components/sidebar/app-sidebar.jsx`** (or wherever the Operations nav group is defined)

Add Documents to the Operations nav group, between or alongside Meetings and Notes:

```
Operations
├── Meetings    (/operations/meetings)
├── Notes       (/operations/notes)
└── Documents   (/documents)            ← new
```

Use `FileText` from lucide-react as the icon (consistent with the existing icon style).

### 2.3 Global Documents Page

**New file: `src/pages/documents/DocumentsPage.jsx`**

```jsx
// Sets the page header via useHeader()
useHeader({ title: 'Documents', breadcrumbs: [{ label: 'Documents' }] });

// Layout:
// - Top bar: client filter dropdown + category filter dropdown + "Upload Document" button
// - When a client is selected from the filter → passes clientId to the list
// - When no client selected → shows all documents across all clients
// - Reuses DocumentCard component from Phase 1
// - Upload from this page defaults client to Internal Account,
//   but the UploadMetaDialog adds a client selector field when opened from the global page
```

### 2.4 UploadMetaDialog — Global Page Addition

When `DocumentsPage` triggers an upload (not from within a specific client's tab), the `UploadMetaDialog` needs one additional field:

- **Client selector** — dropdown of all clients including Internal Account
  - Default: Internal Account
  - Required field
  - Only shown when the dialog is opened from the global page, not from a client's tab

Pass a prop to `UploadMetaDialog` to control this:
```jsx
<UploadMetaDialog 
  showClientSelector={true}   // global page
  defaultClientId={internalAccountId}
/>

<UploadMetaDialog 
  showClientSelector={false}  // client detail tab — client already known
  defaultClientId={clientId}
/>
```

### 2.5 Phase 2 Checklist — ✅ COMPLETE (Approved)
- [x] `/documents` route exists and renders correctly
- [x] Documents nav item added to Operations group in sidebar
- [x] Page title set correctly via `useHeader()`
- [x] All documents across all clients shown by default
- [x] Client filter dropdown works — filters list to selected client
- [x] Category filter dropdown works (client-side)
- [x] Upload via drag-drop/file picker opens `UploadMetaDialog` with client selector
- [x] Client selector defaults to Internal Account
- [x] Upload from global page correctly tags document to selected client
- [x] Phase 1 Client Detail tab still works unchanged

### 2.6 Phase 2 Implementation Notes
- Category filter applied client-side against the fetched list
- Document count shown in the filter bar
- `UploadMetaDialog` extended with optional `showClientSelector` + `defaultClientId` props — backward-compatible (Phase 1 tab passes neither)

**→ Stop here. Show the result and wait for approval.**

---

## Phase 3 — Collections

### Goal
An optional grouping layer. Agency can create a named collection under a client, then upload documents into it. Documents without a collection remain ungrouped. Collections are client-scoped.

### Before Starting — Confirm Phase 2 is Approved

### 3.1 Database

**New table: `document_collections`**

```sql
CREATE TABLE document_collections (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id   UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE document_collections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own collections"
  ON document_collections FOR ALL
  USING (user_id = auth.uid());

CREATE INDEX idx_document_collections_client_id ON document_collections(client_id);
CREATE INDEX idx_document_collections_user_id   ON document_collections(user_id);
```

**Modify `client_documents` table — add collection FK:**

```sql
ALTER TABLE client_documents
  ADD COLUMN collection_id UUID REFERENCES document_collections(id) ON DELETE SET NULL;

CREATE INDEX idx_client_documents_collection_id ON client_documents(collection_id);
```

`ON DELETE SET NULL` — if a collection is deleted, documents in it become ungrouped (not deleted). This is intentional and safe.

### 3.2 API Layer Additions

**Add to `src/api/documents.js`:**

```javascript
// Collections
useCollections({ clientId })       // list collections for a client
useCreateCollection()              // create new collection
useUpdateCollection()              // rename or update description
useDeleteCollection()              // delete collection (documents become ungrouped)

// Update existing useUploadDocument to accept optional collectionId
// Update existing useUpdateDocument to support moving to/from a collection
```

### 3.3 New Components

```
src/components/documents/
├── CollectionCard.jsx          ← collection row showing name + document count
├── CreateCollectionDialog.jsx  ← name + optional description, client pre-set
└── DocumentsTab.jsx            ← update to show grouped + ungrouped sections
```

### 3.4 Updated DocumentsTab Layout

```
DocumentsTab (clientId)
├── "New Collection" button (top right, alongside "Upload Document")
├── Collections section (only shown if client has ≥1 collection)
│   ├── CollectionCard — "Brand Refresh 2025" (4 documents)
│   ├── CollectionCard — "Onboarding Pack" (2 documents)
│   └── ...
└── Ungrouped Documents section
    ├── DocumentCard
    ├── DocumentCard
    └── ...
```

If a client has no collections, the Collections section is not shown — just the flat document list from Phase 1.

**CollectionCard behaviour:**
- Click to expand inline (accordion) — shows documents inside that collection
- Or click to navigate to a filtered view — decide which feels better in context
- Shows: collection name, document count, created date, actions (Rename, Delete)
- "Upload into this collection" button inside the expanded view — opens `UploadMetaDialog` with `collection_id` pre-set

### 3.5 Upload Flow with Collections

**From a collection's expanded view:**
- `collection_id` is pre-set automatically — user does not need to select it
- `client_id` is already known from the tab context

**From the top-level "Upload Document" button (no collection):**
- `collection_id` is null — document is ungrouped
- User can optionally assign a collection in `UploadMetaDialog` via a dropdown of available collections for that client

**Moving a document between collections (or to/from ungrouped):**
- Available in the document card's actions dropdown: "Move to Collection"
- Opens a small popover or dialog with collection options + "Remove from collection"

### 3.6 Global Documents Page — Collections Filter

Add a Collections filter dropdown to the global `/documents` page (only shown after a client is selected, since collections are client-scoped).

### 3.7 Phase 3 Checklist — ✅ COMPLETE
- [x] `document_collections` table created with RLS
- [x] `collection_id` column added to `client_documents`
- [x] Collections API hooks created (`useCollections`, `createCollection`, `updateCollection`, `deleteCollection`)
- [x] Collections section visible in DocumentsTab when collections exist
- [x] "New Collection" button and `CreateCollectionDialog` work (create + rename)
- [x] CollectionCard shows name, document count, and date
- [x] Uploading into a collection (via CollectionCard compact upload zone) pre-sets `collection_id`
- [x] Uploading from top-level upload zone sets `collection_id = null` (ungrouped)
- [x] Deleting a collection sets `collection_id = null` on its documents (ON DELETE SET NULL in DB)
- [x] Collections filter on global page appears when a client is selected and they have collections
- [x] Ungrouped documents shown separately from collection documents in DocumentsTab
- [x] Phase 1 and 2 behaviour unchanged for documents without collections

### 3.8 Phase 3 Implementation Notes
- **"Move to Collection" action**: Not implemented in this phase — the feature spec listed it but it was deprioritised. Documents uploaded from the top-level zone are ungrouped; documents uploaded via a CollectionCard zone go into that collection. Moving between collections can be added in Phase 4 or as a follow-up.
- **CollectionCard expand**: Click header to expand/collapse inline — shows a compact upload zone + document list for that collection.
- **Compact upload zone**: `DocumentUploadZone` extended with `compact` prop — flat row layout for use inside CollectionCard.
- **Global page collections filter**: Only shown when a specific client is selected (collections are client-scoped). Includes "Ungrouped" option to filter for documents with no collection.

**→ Stop here. Show the result and wait for approval.**

---

## Phase 4 — Preview & Enhanced UX

### Goal
Inline preview for PDFs and images. Search by document name. Polished empty states. Full filter bar.

### Before Starting — Confirm Phase 3 is Approved

### 4.1 Document Preview Modal

**New component: `src/components/documents/DocumentPreviewModal.jsx`**

Triggered by clicking the document name or a "Preview" action in the card menu.

| File type | Preview behaviour |
|---|---|
| PDF | Render in `<iframe src={signedUrl}>` or use `<embed>` — browser native PDF viewer |
| PNG, JPG, JPEG, GIF | Render in `<img>` inside a modal |
| DOCX, XLSX, ZIP, MP4, MOV | No inline preview — show "Preview not available" with a prominent Download button |

Signed URL is generated on modal open (not pre-fetched). Show a skeleton while the URL is being generated.

Modal includes:
- Document name and category badge
- File size and upload date
- Download button (always present)
- Close button / ESC to close

### 4.2 Search

Add a search input to `DocumentsTab` and `DocumentsPage`.

- Searches `display_name` client-side (filter the already-fetched list — no extra DB query needed for Phase 4)
- Debounced input (300ms)
- Placeholder: "Search documents..."
- Clears on client change

### 4.3 Filter Bar

Full filter bar on both `DocumentsTab` and `DocumentsPage`:

```
[ Search input ] [ Category ▾ ] [ Status ▾ (Active / Archived) ] [ Collection ▾ ] [ Upload Document ]
```

- Filters apply client-side against the fetched list
- "Status" filter defaults to "Active" — archived documents hidden by default
- "Show archived" toggle or status filter to reveal archived documents
- Filters reset when client changes (on global page)

### 4.4 Empty States

Three empty state variants for `DocumentsTab`:

1. **No documents at all** — "No documents yet. Upload a contract, brief, or brand asset to get started." + Upload button
2. **No documents in a collection** — "This collection is empty. Upload a document to add it here." + Upload button
3. **No results from search/filter** — "No documents match your search." + "Clear filters" link

### 4.5 Phase 4 Checklist — ✅ COMPLETE
- [x] `DocumentPreviewModal` opens for PDF and image files
- [x] PDF renders in browser native viewer via signed URL (`<iframe>`)
- [x] Images render inline in modal (`<img>`)
- [x] Non-previewable files show "Preview not available" + Download button
- [x] Signed URL generated on modal open, skeleton shown during generation
- [x] Search input (debounced 300ms) filters document list by name — both tab and global page
- [x] Category filter works — both tab and global page
- [x] Status filter works (defaults to Active) — both tab and global page
- [x] Archived documents hidden by default, revealed by "Archived" status filter
- [x] Collection filter works (client-scoped) — both tab and global page
- [x] All three empty state variants shown correctly
- [x] All Phase 1–3 functionality unchanged

### 4.6 Phase 4 Implementation Notes
- **Preview trigger**: Document name is now a clickable button (underline on hover). "Preview" also added to the three-dot menu as the first action.
- **Non-previewable types**: DOCX, XLSX, ZIP, MP4, MOV show an emoji placeholder + "Preview not available" + Download button.
- **Status filter default**: Both `DocumentsTab` and `DocumentsPage` default to "Active" — archived docs are hidden until "Archived" or "All statuses" is selected. This replaces the Phase 1–3 temporary behavior of showing archived docs dimmed.
- **Archived docs still show dimmed**: When status filter is "Archived" or "All statuses", archived docs continue to show with `opacity-50` styling.
- **`EmptyMedia` import**: The global page uses inline icon div rather than `EmptyMedia` for the large empty state to match the Clients.jsx aesthetic.

**→ All 4 phases complete.**

---

## Data Model Summary (Final State After All Phases)

```
Agency (user_id)
├── Internal Account (is_internal = true)
│   └── Documents
│       ├── Ungrouped documents
│       └── Collections
│           └── Documents in collection
└── Real Clients
    └── Documents
        ├── Ungrouped documents
        └── Collections
            └── Documents in collection
```

### `client_documents` — Final Schema
| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `user_id` | UUID | RLS, FK → auth.users |
| `client_id` | UUID | FK → clients (default: internal account) |
| `collection_id` | UUID | FK → document_collections, nullable (Phase 3) |
| `display_name` | TEXT | User-facing name |
| `original_filename` | TEXT | Actual filename at upload |
| `storage_path` | TEXT | Supabase storage path |
| `file_size_bytes` | BIGINT | Used for storage quota tracking |
| `mime_type` | TEXT | e.g. `application/pdf`, `image/png` |
| `category` | TEXT | Enum — Contract / NDA / Brand Guidelines etc. |
| `status` | TEXT | Active / Archived |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

### `document_collections` — Final Schema (Phase 3)
| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `user_id` | UUID | RLS, FK → auth.users |
| `client_id` | UUID | FK → clients — collections are client-scoped |
| `name` | TEXT | e.g. "Brand Refresh 2025" |
| `description` | TEXT | Optional |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

### Storage Bucket
| Bucket | Access | Path |
|---|---|---|
| `client-documents` | Private — signed URLs only | `{user_id}/{client_id}/{document_id}/{filename}` |

---

## Impact on Existing Features

| Existing Feature | Impact | Action |
|---|---|---|
| Client Detail page tabs | New Documents tab added | Add tab — do not touch existing tabs |
| Billing & Usage storage bar | Must include document storage | Update `current_storage_used` on upload/delete |
| Internal Account | Gets Documents tab — same as real clients | No special casing needed |
| `post-media` bucket | Separate bucket — no impact | None |
| `useSubscription()` hook | No new flags needed in Phase 1–4 | None — subscription gating deferred |
| Sidebar nav | New Documents item in Operations | Add alongside Meetings and Notes |

---

## App Architecture Conventions to Follow

These are pulled from `CLAUDE.md` — follow them exactly:

- **API layer**: All Supabase calls go in `src/api/documents.js`. Never query Supabase directly from components.
- **React Query**: Use `queryClient.invalidateQueries()` after mutations. Query keys follow the `['documents', 'list', filters]` pattern.
- **Header**: Every page calls `useHeader({ title, breadcrumbs })` from `src/components/misc/header-context.jsx`.
- **Forms**: React Hook Form + Zod for all form validation.
- **Toasts**: Use `sonner` for success and error notifications (already configured in `main.jsx`).
- **Dates**: Use `formatDate()` from `src/lib/helper.js` for all date display.
- **Icons**: Lucide icons only — `FileText`, `Upload`, `Download`, `Trash2`, `FolderOpen`, `MoreHorizontal`.
- **Skeleton loading**: Show skeleton screens (not spinners) while data is loading.
- **Destructive actions**: Always show `AlertDialog` confirmation before delete.
- **shadcn components**: Use existing shadcn/ui components — `Dialog`, `Tabs`, `Badge`, `Button`, `DropdownMenu`, `AlertDialog`, `Input`, `Select`.
- **Tailwind CSS 4**: Use utility classes only — no custom CSS files.
- **`@` alias**: All imports use `@/` → `./src/`.

---

## Questions Claude Code Should Ask Before Starting

Before writing any code, Claude Code should confirm:

1. What are the exact tab values and labels currently on `ClientDetails.jsx`? (To know where to insert the Documents tab without breaking the existing tab state.)
2. Is there a utility function for formatting file sizes (e.g. bytes → "2.4 MB") already in the codebase? If not, add one to `src/lib/helper.js`.
3. What is the exact query key pattern used in the existing API files (e.g. `src/api/meetings.js`) — confirm before adopting the same pattern.
4. Is there a shared `EmptyState` component in the codebase, or should one be created?
5. Confirm the Supabase client import path used across the codebase (likely `@/lib/supabase` or `@/lib/supabaseClient`).

---

## Out of Scope (All Phases)

The following are intentionally excluded from this feature build:

- Document templates (Phase 2 of the original feature spec — separate future build)
- AI document generation (future build)
- Document sharing with clients via public link (future build)
- E-signature (future build)
- Document version history (future build)
- Full-text search inside document content (future build)
- Subscription tier gating (deferred — all features open to all tiers until gating implementation)
