# Feature: Document Storage & Organization
**Product**: Tercero — Social Media Agency Management SaaS  
**Feature Folder**: `.claude/features/`  
**Status**: Planned  
**Phase 1**: File attachment and organization per client  
**Phase 2**: Document creation, templates, and AI-assisted generation  

---

## 1. What Is This Feature?

**Document Storage** allows agency owners to attach, organize, and retrieve files against each client record inside Tercero. Currently, all client-related documents (contracts, NDAs, brand guidelines, creative briefs, SOPs) live in external tools — Google Drive, Dropbox, email attachments — entirely disconnected from the client record.

This feature makes Tercero the **system of record** for every client — not just their posts and invoices, but their entire operational file.

### What documents agencies deal with per client:
- Service agreements and contracts
- NDAs
- Brand guidelines (fonts, colors, tone-of-voice docs)
- Creative briefs for campaigns
- Platform access and credential notes
- Onboarding checklists
- Client-provided assets (logos, brand photos)
- Meeting notes and summaries (long-form)
- SOPs for recurring work on that client

### Current State:
```
Client in Tercero:
├── Posts ✓
├── Invoices ✓
├── Meetings ✓
├── Notes ✓
└── Documents ✗ (lives in Google Drive / email / Dropbox)
```

### After This Feature:
```
Client in Tercero:
├── Posts ✓
├── Invoices ✓
├── Meetings ✓
├── Notes ✓
└── Documents ✓ (contracts, briefs, brand assets — all here)
```

---

## 2. Phase 1 — File Attachment & Organization (MVP)

### 2.1 Philosophy

Phase 1 is purely about **storing and organizing files** that already exist. No document creation, no templates, no generation. The goal is to answer a single question for agency owners: *"Where's the contract for Nova Corps?"* — and have the answer be "in Tercero, under Nova Corps, in the Documents tab."

This is low engineering effort relative to its perceived value. The infrastructure (Supabase Storage) is already in the product for post media — documents use the same storage layer with a new bucket and metadata table.

### 2.2 What Gets Built

#### Documents Tab on Client Detail Page
A new **Documents** tab added to the Client Detail page alongside Overview / Workflow / Financials / Calendar / Settings.

The Documents tab contains:
- **Upload zone** — drag and drop or file picker
  - Supported types: PDF, DOCX, DOC, XLSX, XLS, PNG, JPG, JPEG, MP4, MOV, ZIP
  - Max file size: per plan limits (see Storage considerations below)
- **Document list** — table or card grid of uploaded files showing:
  - File name
  - Document type / category badge (see categories below)
  - File size
  - Uploaded date
  - Uploaded by (user name)
  - Actions: Download, Rename, Delete, Change Category
- **Search** — search documents by name within a client
- **Filter by category**

#### Document Categories
Agency-selectable label applied at upload or after:
- `Contract`
- `NDA`
- `Brand Guidelines`
- `Creative Brief`
- `Brand Assets` (logos, photos, fonts)
- `Meeting Notes`
- `Invoice / Finance` (supporting docs)
- `SOP`
- `Other`

#### Upload Flow
1. User clicks "Upload Document" or drags file onto the zone
2. File picker opens (or drag-drop registered)
3. Upload begins with progress indicator
4. On completion: dialog asks for optional document name (defaults to filename) and category
5. File appears in the documents list

#### Document Preview
- PDF files: open in a modal or new tab using browser's native PDF viewer
- Image files (PNG, JPG): open in a lightbox/modal inline
- DOCX, XLSX, other binary: download-only (no inline preview in Phase 1)

#### Storage Bucket
New Supabase Storage bucket: `client-documents`

Path structure: `{user_id}/{client_id}/{document_id}/{filename}`

This isolates document storage from the existing `post-media` bucket (which stores post images/videos).

#### Agency-Level Documents (Internal)
The existing **Internal Account** client (is_internal = true) can also have documents — this is where agency-wide documents live:
- Agency master service agreement template
- Agency NDA template
- Internal SOPs
- Agency brand guidelines

### 2.3 Documents Across Client Detail Tabs

The Documents tab sits in the Client Detail page. Based on the existing tab structure seen in the app screens:

| Client Detail Tab | Existing | Change |
|-------------------|----------|--------|
| Overview | ✓ | No change |
| Workflow | ✓ | No change |
| Financials | ✓ | No change |
| Calendar | ✓ | No change |
| Documents | ✗ | **New tab** |
| Settings | ✓ | No change |

The tab should only display if the client has documents OR if the user hovers/looks for it (progressive disclosure). An empty state with an upload prompt is shown on first visit.

### 2.4 Dashboard Integration (Phase 1)
No dashboard widget in Phase 1. Documents are per-client and accessed from the client record. This keeps the dashboard clean.

### 2.5 Storage Plan Limits
Document storage shares the same storage quota tracked in the existing **Billing & Usage** page. The current storage usage bar must account for both post media AND document storage.

Per-plan limits (from existing plan structure visible in app screens):
| Plan | Storage Limit |
|------|--------------|
| Free | 5 GB |
| Ignite | 20 GB |
| Velocity | 100 GB |
| Quantum | 500 GB |

The existing `storage_limit_bytes` field on `agency_subscriptions` already enforces this. The document upload flow must check remaining storage before accepting an upload.

### 2.6 Phase 1 Explicitly Out of Scope
- In-app document editing or creation
- Document templates
- E-signature
- Document version history
- Automated document generation from client data
- OCR or text extraction from uploaded documents
- Document sharing with clients (no public link for documents in Phase 1)

---

## 3. Phase 2 — Document Creation, Templates & Generation

### 3.1 Document Templates

Agency-owned reusable document templates stored in Tercero:
- Template library: agency can create and save templates (rich text with variable placeholders)
- Variables: `{{client_name}}`, `{{agency_name}}`, `{{date}}`, `{{retainer_amount}}`, `{{platforms}}`
- "Generate from template" creates a new document for a client with variables auto-filled from client record
- Generated documents saved to the client's Documents tab as a PDF

Use cases:
- Service agreement generated with client name and agreed retainer
- NDA auto-filled with client details
- Creative brief template pre-filled with client's platforms and industry

### 3.2 AI-Assisted Document Generation

Using Claude (via Anthropic API — consistent with the Tercero tech stack approach):
- "Generate a creative brief for [Client Name]" — pulls client industry, platforms, and recent campaign data to draft a brief
- "Draft a service agreement for [Client Name]" — generates a standard agreement with client details filled in
- User reviews and edits before saving as a PDF

This is the most powerful Phase 2 capability — it makes document creation nearly zero-effort.

### 3.3 Document Sharing with Clients (Public Link)
Similar to the Post Review public link:
- Generate a time-limited shareable link for a specific document
- Useful for sending brand guidelines or creative briefs to a client without email attachments
- Client opens link, views document, can optionally sign (e-signature — see below)

### 3.4 E-Signature (Lightweight)
Not a full DocuSign replacement — a simple "I accept" confirmation flow:
- Agency shares document via public link
- Client reads document, enters their name and clicks "Sign & Accept"
- Acceptance recorded (timestamp, IP, name entered)
- Status badge on document: `Signed` with date
- Not legally binding in all jurisdictions — agency responsible for knowing their requirements

### 3.5 Document Version History
Track changes to documents over time (especially for contracts):
- Each "re-upload" of a document with the same name prompts: "Replace or save as new version?"
- Version list visible in document detail
- Download any previous version

---

## 4. Database Analysis

### 4.1 New Table: `client_documents`

```sql
CREATE TABLE client_documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id       UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,               -- display name (editable)
  original_name   TEXT NOT NULL,               -- original filename at upload
  category        TEXT NOT NULL DEFAULT 'Other'
                    CHECK (category IN (
                      'Contract', 'NDA', 'Brand Guidelines', 
                      'Creative Brief', 'Brand Assets', 
                      'Meeting Notes', 'Invoice / Finance', 'SOP', 'Other'
                    )),
  storage_path    TEXT NOT NULL,               -- Supabase storage path
  file_size_bytes BIGINT NOT NULL,
  mime_type       TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'Active'
                    CHECK (status IN ('Active', 'Archived')),
  -- Phase 2 additions
  review_token    UUID DEFAULT gen_random_uuid() UNIQUE,  -- for public sharing
  signed_at       TIMESTAMPTZ,
  signed_by_name  TEXT,
  signed_by_ip    TEXT,
  version_of      UUID REFERENCES client_documents(id),  -- for version chain
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE client_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own documents"
  ON client_documents FOR ALL
  USING (user_id = auth.uid());

-- Phase 2: public access via token
CREATE POLICY "Public read via token"
  ON client_documents FOR SELECT
  USING (true);  -- filtered by token in application layer

-- Indexes
CREATE INDEX idx_client_documents_client_id ON client_documents(client_id);
CREATE INDEX idx_client_documents_user_id ON client_documents(user_id);
CREATE INDEX idx_client_documents_category ON client_documents(category);
```

### 4.2 New Table: `document_templates` (Phase 2)

```sql
CREATE TABLE document_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  category        TEXT NOT NULL DEFAULT 'Other',
  content         TEXT NOT NULL,               -- rich text / markdown with {{variables}}
  variables       JSONB DEFAULT '[]',          -- list of variable names in this template
  is_default      BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE document_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own templates"
  ON document_templates FOR ALL
  USING (user_id = auth.uid());
```

### 4.3 Supabase Storage

```
Bucket: client-documents
├── {user_id}/
│   ├── {client_id}/
│   │   ├── {document_id}/
│   │   │   └── original_filename.pdf
│   │   └── ...
│   └── ...
└── ...
```

Storage bucket policies:
- Authenticated users can read/write only their own `user_id` prefix
- No public access (unlike `post-media` which has public post images)
- Signed URLs used for document downloads (time-limited, generated server-side)

### 4.4 Storage Usage Tracking

The existing Billing & Usage page tracks storage with `storage_limit_bytes` on `agency_subscriptions`. The current implementation likely queries the `post-media` bucket. This needs updating:

```sql
-- New RPC or edge function to calculate total storage
-- Must sum: post-media bucket usage + client-documents bucket usage
-- Exposed in the same usage bar on Billing & Usage page
```

### 4.5 Impact on Existing Tables

| Table | Change | Risk |
|-------|--------|------|
| `clients` | No structural change | None |
| `post_versions` | No change | None |
| `agency_subscriptions` | Storage calculation must include new bucket | Medium — usage bar could show incorrect values if not updated |
| Supabase Storage | New bucket `client-documents` | Low |

---

## 5. Impact Analysis

### 5.1 Positive Impact

**System of Record Positioning**
Adding document storage transforms Tercero from a workflow tool into the agency's operational file system. Every piece of client information — content, finances, meetings, and now documents — is in one place. This is the single most powerful retention driver of the three features discussed.

**Client Detail Page Completeness**
The Client Detail page (seen in app screens for Sinister Six, Nova Corps, etc.) already has Overview, Workflow, Financials, Calendar, Settings. Documents is the obvious missing tab. Its absence currently makes the client record feel incomplete.

**Storage as Upsell Lever**
Document storage consumes storage quota. Agencies that upload many contracts, brand assets, and briefs will hit lower plan limits faster. This creates a natural, non-pushy upsell path to higher plans — the value is felt before the limit is hit.

**Reduces Context Switching**
An agency owner reviewing a client's posts no longer needs to switch to Google Drive to find the brand guidelines. The brief, the contract, and the guidelines are on the same screen as the content pipeline.

**Differentiator vs. Scheduling Tools**
No pure social media scheduling tool (Buffer, Later, Hootsuite) offers client document storage. This is a category-defining feature for Tercero's "agency management" positioning.

### 5.2 Negative / Risk Considerations

**Storage Cost**
Documents (especially large PDFs, brand asset packages, video files) can be large. If storage is priced incorrectly relative to infrastructure costs, heavy document users could erode margins.
- Mitigation: Enforce file size limits per upload (e.g., 50MB per file in Phase 1). Bulk video uploads should continue going through post-media for post content.

**Security Expectations**
Contracts and NDAs are sensitive documents. Users will expect these to be secure.
- Mitigation: Use Supabase signed URLs (not public URLs) for document access. No documents publicly accessible without explicit sharing token.

**Storage Calculation Complexity**
The existing storage usage bar on the Billing page must now aggregate two buckets. If this is not updated, users will see incorrect usage data, which erodes trust.

**File Type Support**
Users will inevitably try to upload unsupported file types. Clear messaging on supported types and graceful rejection with helpful error messages is critical.

**Search Limitations**
In Phase 1, documents are only searchable by name. Users cannot search document *content* (no full-text search inside PDFs). This is a known limitation and should be disclosed in the UI ("Search by document name").

---

## 6. Correlation with Existing Features

| Existing Feature | Relationship |
|-----------------|--------------|
| Post Media (Supabase Storage `post-media`) | Documents use the same storage infrastructure but a separate bucket and separate metadata table |
| Billing & Usage — Storage Bar | Must be updated to include document storage in total usage calculation |
| Client Detail Page | New Documents tab — 6th tab added to existing 5-tab layout |
| Internal Account | Gets its own Documents tab for agency-level files (contracts templates, SOPs) |
| Settings — Agency tab | Phase 2: agency logo and name used in generated document headers |
| Finance — Invoices | Documents tab can hold invoice-supporting docs (e.g., expense receipts) |
| Public Review link pattern | Phase 2: same token architecture reused for document sharing |
| Meetings | Meeting summary documents (long PDFs) can be stored in client Documents vs. Notes (which is text-only) |

---

## 7. File & Component Structure (Suggested)

```
src/
├── api/
│   └── documents.js                — Upload, CRUD, signed URL generation
├── pages/
│   └── documents/
│       └── (no dedicated route — embedded in Client Detail tabs)
├── components/
│   └── documents/
│       ├── DocumentsTab.jsx        — Full tab content for Client Detail
│       ├── DocumentUploadZone.jsx  — Drag-drop upload area
│       ├── DocumentCard.jsx        — Individual document row/card
│       ├── DocumentCategoryBadge.jsx
│       ├── DocumentPreviewModal.jsx — PDF/image inline preview
│       └── UploadMetaDialog.jsx    — Name + category dialog post-upload
```

---

## 8. Landing Page Relevance

**Hero/Features copy angle:**
> *"Every client's contracts, briefs, and brand assets — organized in one place. Stop digging through Google Drive folders. Everything you need for a client is on their profile."*

**Supporting detail copy:**
> *"Upload contracts, NDAs, brand guidelines, and creative briefs directly to each client's workspace. Tagged, searchable, and always a click away — right next to their posts, invoices, and meetings."*

**Differentiator positioning:**
This is the feature that most clearly separates Tercero from "social media tools" and positions it as "agency management software." Lead with it prominently on the landing page alongside the pipeline dashboard and client approvals features.
