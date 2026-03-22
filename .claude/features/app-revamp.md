# Tercero — Creative Agency Expansion: Implementation Plan
> **Purpose**: Implementation reference for the creative agency expansion. Each phase must be completed and confirmed before the next begins.
> **Branch**: `feature/creative-agency-expansion`
> **Status**: Planning — not yet started

---

## Overview

Tercero expands from social-media-only to support all creative agencies (video studios, content production, influencer management, brand/web studios). The core product does not change — we are extending terminology, configurability, and two new statuses. Existing social media agency workflows must remain fully intact.

### Non-Breaking Principle
- All new DB fields are **nullable** — no existing records break
- All new statuses are **additive** — existing status flows are unchanged
- The rename is **display-only** — DB columns, query keys, and API function names stay as-is
- Platform selection remains visible and functional — it just becomes optional

---

## Reference: Field Options

### Deliverable Types
Used as values for the `deliverable_type` field on `post_versions`.

| Display Label | DB Value | Used By |
|--------------|----------|---------|
| Reel / Short-form Video | `reel_short_video` | Social media, content agencies, influencer mgmt |
| Long-form Video | `long_form_video` | Video studios, brand agencies |
| Video Edit / Post-Production | `video_editing` | Video studios, freelancers |
| Ad Creative | `ad_creative` | Performance agencies, brand studios |
| Motion Graphic / Animation | `motion_graphic` | Design studios, video agencies |
| Static Graphic | `static_graphic` | Social media agencies, design studios |
| Carousel | `carousel` | Social media agencies |
| Story / Ephemeral | `story` | Social media agencies, influencer mgmt |
| Photography | `photography` | Brand studios, content agencies |
| UGC Content | `ugc` | Influencer agencies, content agencies |
| Brand Identity | `brand_identity` | Brand/web studios |
| Infographic | `infographic` | Content agencies, design studios |
| Presentation / Deck | `presentation` | Strategy agencies, brand studios |
| Website / UI Design | `website_design` | Web/brand studios |
| Blog Post / Copy | `blog_copy` | Content agencies, SEO agencies |
| Email Campaign | `email_campaign` | Content agencies, performance agencies |
| Podcast Production | `podcast` | Content agencies |
| Other | `other` | All |

### Client Engagement Types
Used as values for the `client_type` field on `clients`.

| Display Label | DB Value | Description |
|--------------|----------|-------------|
| Monthly Retainer | `monthly_retainer` | Fixed recurring fee, ongoing scope, long-term partnership. Predictable revenue for the agency. |
| Project-Based | `project_based` | Fixed scope, timeline, and price for a defined set of deliverables. No ongoing commitment. |
| Campaign-Based | `campaign_based` | Time-bound engagement tied to a specific launch, initiative, or seasonal campaign. |
| One-Off / Ad-hoc | `one_off` | Single asset or request with no standing agreement. Often a trial before a larger engagement. |
| Advisory / Consulting | `advisory` | Strategy, guidance, and oversight delivery without execution. Client/internal teams do the work. |

---

## Phase 1 — Platform Optional

**Complexity**: Tiny | **Risk**: Very low | **Independent**: Yes

### What this does
Removes the "must select at least one platform" requirement on the deliverable creation form. Platform remains visible and fully functional — it simply becomes optional. This is the foundation that makes the whole expansion possible.

### Changes

**`src/pages/posts/DraftPostForm.jsx`**
- Change `platforms: z.array(z.string()).min(1, 'Select at least one platform')` → `platforms: z.array(z.string()).optional().default([])`
- Update the platform section label/helper text: add "(optional)" indication
- Ensure the form submit still passes an empty array `[]` (not `undefined`) to the RPC when no platform is selected — the RPC already accepts `p_platform: []`

### No DB changes required
### No RPC changes required
### No other files affected

### Breaking Change Risks
- None. The RPC `create_post_draft_v3` already accepts an empty platform array (`p_platform: []`). Analytics surfaces already handle zero-count platforms by filtering them out silently.

### Verification
- [ ] Create a deliverable with NO platform selected — form submits successfully
- [ ] Create a deliverable WITH platform(s) selected — still works exactly as before
- [ ] Platform distribution charts on Campaign and Dashboard show nothing for the platform-less deliverable (expected — not a bug)
- [ ] Posts list renders the card with no platform badges — no crash

### ⛔ STOP — confirm before Phase 2

---

## Phase 2 — Client Type Field

**Complexity**: Small | **Risk**: Very low | **Independent**: Yes (can be done before/after any other phase)

### What this does
Adds a `client_type` dropdown to the client create/edit form so agencies can categorise their clients as Retainer, Project-Based, Campaign-Based, One-Off, or Advisory. Optional field — no existing clients are affected.

### DB Migration
```sql
ALTER TABLE clients
ADD COLUMN client_type TEXT CHECK (
  client_type IN ('monthly_retainer', 'project_based', 'campaign_based', 'one_off', 'advisory')
);
-- nullable, no default — existing clients unaffected
```

### Changes

**`src/pages/clients/CreateClientPage.jsx`**
- Add `client_type` to Zod schema: `client_type: z.enum(['monthly_retainer', 'project_based', 'campaign_based', 'one_off', 'advisory']).optional()`
- Add a Select field in the "Branding & Identity" section, positioned between the Status and Tier fields
- Display labels mapped from DB values (see Reference table above)
- Field is optional — no `required` indicator

**`src/api/clients.js`**
- Pass `client_type: data.client_type ?? null` in both `createClient()` and `updateClient()` functions

**`src/pages/clients/clientSections/ManagementTab.jsx`**
- Add a new `InfoRow` for "Client Type" below "Account Status"
- Only render the row if `client.client_type` is set (don't show an empty row)
- Display the human-readable label (e.g. "Monthly Retainer"), not the DB value

**Client card (wherever the tier badge is rendered)**
- Add a small client_type badge alongside the tier badge — only when `client_type` is set
- Use a neutral/secondary style so it doesn't compete with tier

### Breaking Change Risks
- None. Nullable column, optional form field. All existing clients have `null` for this field and render unchanged.

### Verification
- [ ] Create a new client with Client Type = "Monthly Retainer" — saves and shows badge on card
- [ ] Create a new client with no Client Type — card renders normally, no empty badge
- [ ] Edit an existing client — Client Type field shows (blank by default), can be set or left blank
- [ ] Management tab shows "Client Type: Monthly Retainer" when set, no row when unset

### ⛔ STOP — confirm before Phase 3

---

## Phase 3 — Client ARCHIVED Status + Filter

**Complexity**: Small-Medium | **Risk**: Low | **Independent**: Yes

### What this does
Adds an `ARCHIVED` status to clients and makes the clients list default to showing only Active clients. Studios with many completed one-off clients can archive them and keep the main list clean.

### DB Migration
```sql
-- If clients.status uses a CHECK constraint, update it:
ALTER TABLE clients
DROP CONSTRAINT IF EXISTS clients_status_check;

ALTER TABLE clients
ADD CONSTRAINT clients_status_check
CHECK (status IN ('ACTIVE', 'PAUSED', 'ARCHIVED'));
```

**Supabase RPC — `get_clients_with_pipeline`**
Add `p_status TEXT DEFAULT 'ACTIVE'` parameter. When `p_status = 'all'`, apply no status filter. When a specific status is passed, filter `WHERE clients.status = p_status`. When `p_status = 'active_and_paused'`, filter `WHERE clients.status IN ('ACTIVE', 'PAUSED')`.

### Changes

**`src/api/clients.js`**
- Add `status = 'ACTIVE'` to the `fetchClients()` params destructure
- Pass `p_status: status` to the RPC call

**`src/pages/clients/Clients.jsx`**
- Add `status` URL param (follows existing pattern for `industry`, `tier`, `urgency`)
- Add a filter control: segmented tabs or dropdown — "Active" | "Paused" | "Archived" | "All"
- Default: `status = 'ACTIVE'` — only active clients shown on load
- Include the active filter in the reset-filters logic

**`src/pages/clients/CreateClientPage.jsx`**
- Update Zod enum to include ARCHIVED: `z.enum(['ACTIVE', 'PAUSED', 'ARCHIVED'])`
- Keep only `ACTIVE` and `PAUSED` in the status dropdown — `ARCHIVED` is set via a dedicated action, not at creation time

**`src/pages/clients/clientSections/ManagementTab.jsx`**
- Add an "Archive Client" button (destructive, secondary style) in the management actions area
- On click: confirm dialog ("Archive this client? They will be hidden from the main clients list.") → set status to `ARCHIVED`
- Add "Restore Client" button that appears only when client is already `ARCHIVED` → sets status back to `ACTIVE`

### Breaking Change Risks
- Existing clients already have `status = 'ACTIVE'` — they will continue to appear in the default view
- The new default filter (Active only) changes the default list view. If the agency has PAUSED clients, those will be hidden by default now. Mitigate: use "Active" as default but consider "Active + Paused" as the default instead. **Decision: default to `ACTIVE` only — PAUSED clients are intentionally de-emphasised.**

### Verification
- [ ] Clients list defaults to showing only ACTIVE clients on page load
- [ ] Selecting "All" in the filter shows all clients including PAUSED ones
- [ ] Archive a client via Management tab → client disappears from Active list
- [ ] Switch filter to "Archived" → archived client appears
- [ ] Restore an archived client → moves back to Active list
- [ ] Existing ACTIVE clients are all visible and unchanged
- [ ] Client count in header/subscription accurately reflects active clients only (check `useSubscription` — client_count is already computed server-side, verify it excludes ARCHIVED)

### ⛔ STOP — confirm before Phase 4

---

## Phase 4 — Deliverable Type Field

**Complexity**: Medium | **Risk**: Low-Medium | **Independent**: No (requires Phase 1 complete)

### What this does
Adds an optional "Deliverable Type" field to the post/deliverable creation form. Agencies can tag each deliverable as a Reel, Ad Creative, Brand Video, etc. Existing posts without a type continue to work normally. A type badge appears on post cards.

### DB Migration
```sql
ALTER TABLE post_versions
ADD COLUMN deliverable_type TEXT CHECK (
  deliverable_type IN (
    'reel_short_video', 'long_form_video', 'video_editing', 'ad_creative',
    'motion_graphic', 'static_graphic', 'carousel', 'story', 'photography',
    'ugc', 'brand_identity', 'infographic', 'presentation', 'website_design',
    'blog_copy', 'email_campaign', 'podcast', 'other'
  )
);
-- nullable, no default — all existing post_versions unaffected
```

**Supabase RPC — `create_post_draft_v3`**
Add `p_deliverable_type TEXT DEFAULT NULL` parameter. Pass through to the new `deliverable_type` column on `post_versions`.

**Supabase RPC — `create_revision_version`**
Add `p_deliverable_type TEXT DEFAULT NULL` parameter. Carry the value forward when creating revision versions (pre-fill with the parent version's `deliverable_type`).

### Changes

**`src/pages/posts/DraftPostForm.jsx`**
- Add `deliverable_type` to Zod schema: `deliverable_type: z.string().optional()`
- Add a Select field labelled "Deliverable Type (optional)" positioned **above** the Platforms selector
- Options: all 18 values from the Reference table above, grouped logically:
  - **Video**: Reel / Short-form Video, Long-form Video, Video Edit / Post-Production, Ad Creative, Motion Graphic / Animation
  - **Graphics & Design**: Static Graphic, Carousel, Story / Ephemeral, Photography, Brand Identity, Infographic, Website / UI Design
  - **Content**: Blog Post / Copy, Email Campaign, Podcast Production, UGC Content, Presentation / Deck
  - **Other**: Other
- Pass `deliverable_type` to the create/edit API function

**`src/api/posts.js`**
- Pass `p_deliverable_type: deliverableType ?? null` in the `createPost()` function (which calls `create_post_draft_v3`)
- Pass `p_deliverable_type: deliverableType ?? null` in any revision creation function (which calls `create_revision_version`)
- Ensure `deliverable_type` is selected in the post fetch queries so it comes back with the post data

**Post cards** (wherever the platform badges render on list/workflow views)
- Add a `DeliverableTypeBadge` component: small pill badge showing the human-readable label (e.g. "Reel")
- Render it above or alongside platform badges — only when `deliverable_type` is set
- Style: neutral/secondary, compact. Does not compete with status badge.

**`src/pages/posts/postDetails/PostContent.jsx`**
- Show the deliverable type as a small info row in the post detail metadata section
- Only render when `deliverable_type` is set

### Breaking Change Risks
- Nullable column — all existing posts have `deliverable_type = null`, render unchanged
- RPC param is `DEFAULT NULL` — existing callers that don't pass it are unaffected
- The Select field in the form is optional — form still submits without it

### Verification
- [ ] Create a deliverable with type "Brand Video" — badge appears on the post card and in post detail
- [ ] Create a deliverable with no type — card and detail render exactly as before (no empty badge)
- [ ] Edit an existing post — Deliverable Type shows blank by default, can be set
- [ ] Create a revision — deliverable type carries forward to the new version
- [ ] All existing posts without a type display normally in list, calendar, and campaign detail

### ⛔ STOP — confirm before Phase 5

---

## Phase 5 — APPROVED + DELIVERED Statuses

**Complexity**: High | **Risk**: Medium (most files touched) | **Depends on**: Phase 1 and 4 complete

### What this does
Adds two new status values for deliverables that go through the approval flow without being published to a social platform:
- **APPROVED** — client has reviewed and approved the deliverable (replaces SCHEDULED for platform-less items)
- **DELIVERED** — the agency has formally delivered the work to the client (replaces the PUBLISHED end-state for platform-less items)

Social media posts (with platform selected) continue using **SCHEDULED → PUBLISHED** exactly as today. Nothing in the existing social post flow changes.

### Status Flows
```
Social post (platform selected):
  DRAFT → PENDING_APPROVAL → NEEDS_REVISION ↩ → SCHEDULED → PUBLISHED*

Deliverable (no platform):
  DRAFT → PENDING_APPROVAL → NEEDS_REVISION ↩ → APPROVED → DELIVERED

* PUBLISHED and PARTIALLY_PUBLISHED are UI-only derived states via getPublishState() — not DB values
```

### DB Migration
```sql
-- If post_versions.status uses a CHECK constraint, update it:
ALTER TABLE post_versions
DROP CONSTRAINT IF EXISTS post_versions_status_check;

ALTER TABLE post_versions
ADD CONSTRAINT post_versions_status_check
CHECK (status IN (
  'DRAFT', 'PENDING_APPROVAL', 'NEEDS_REVISION', 'SCHEDULED', 'ARCHIVED',
  'APPROVED', 'DELIVERED'
));
```

### Changes

**`src/components/StatusBadge.jsx`** ← Do this first, it unblocks everything else
Add to `STATUS_CONFIG`:
```js
APPROVED: {
  label: 'Approved',
  icon: CheckCircle2,
  className: 'bg-green-100 text-green-800 border-green-200',
},
DELIVERED: {
  label: 'Delivered',
  icon: PackageCheck,
  className: 'bg-teal-100 text-teal-800 border-teal-200',
},
```

**`src/pages/campaigns/CampaignReview.jsx`** (line ~403)
The campaign review approval currently always transitions to `SCHEDULED`. Make it conditional:
```js
// When client taps "Approve":
const approvalStatus = selectedPost.platforms?.length > 0 ? 'SCHEDULED' : 'APPROVED'
await submitCampaignPostReview(selectedPost.review_token, approvalStatus, '')
```

**`src/pages/PublicReview.jsx`** (line ~126)
Same conditional logic as above — when the public review client approves, check if platforms exist before deciding the target status.

**`src/api/posts.js`**
Add new plain async function:
```js
export async function markPostDelivered(postId, deliveryNote = '') {
  const { workspaceUserId } = await resolveWorkspace()
  const { error } = await supabase
    .from('post_versions')
    .update({
      status: 'DELIVERED',
      admin_notes: deliveryNote || null,
    })
    .eq('post_id', postId)
    .eq('id', /* current_version_id — join through posts table */)
  if (error) throw error
}
```
Alternatively: use an RPC if a direct update isn't feasible through RLS.

**`src/pages/posts/postDetails/PostContent.jsx`**
- Add handling for `APPROVED` status:
  - Show "Mark as Delivered" button (no "Publish Now" — that is for social posts only)
  - `canEdit = false` for APPROVED (lock it like SCHEDULED — client already approved, don't allow edits without a new version)
- Add handling for `DELIVERED` status:
  - Treat as terminal — disable delete button, show read-only state
  - No action buttons — work is complete
- "Mark as Delivered" button opens a dialog (see `PostActionDialogs.jsx` for the pattern):
  - Title: "Mark as Delivered"
  - Body: optional `<Textarea>` labelled "Delivery note (optional)" with placeholder "e.g. Final files sent via Google Drive on 18 Mar"
  - Buttons: "Cancel" | "Mark as Delivered"
  - On confirm: call `markPostDelivered(postId, deliveryNote)`, toast success, invalidate post query

**`src/pages/Posts.jsx`**
- Add `APPROVED` and `DELIVERED` to `STATUS_TABS` array
- Add `DELIVERED` to `TERMINAL_STATUSES` array (alongside `PUBLISHED` and `ARCHIVED`)
- Update `usePostCounts` call to include the new statuses

**`src/api/useGlobalPosts.js`**
- Add `APPROVED: 0` and `DELIVERED: 0` to the `counts` object in `usePostCounts()`

**`src/pages/calendar/ContentCalendar.jsx`**
- Add `APPROVED` and `DELIVERED` to `STATUS_LEGEND`:
  ```js
  { id: 'APPROVED', label: 'Approved', color: 'bg-green-600' },
  { id: 'DELIVERED', label: 'Delivered', color: 'bg-teal-600' },
  ```

**`src/components/posts/ContentPipelineBar.jsx`**
- Add `APPROVED` and `DELIVERED` to the `chartConfig` with appropriate display names and colors

**`src/pages/dashboard/DashboardScheduledPosts.jsx`** (line ~97)
- Extend the filter to include APPROVED alongside SCHEDULED:
  ```js
  .filter(p => (p.status === 'SCHEDULED' || p.status === 'APPROVED') && p.target_date)
  ```

**`src/pages/dashboard/DashboardWeekTimeline.jsx`** (line ~85)
- Same extension — show APPROVED deliverables in the week timeline alongside SCHEDULED posts

### Breaking Change Risks
- The campaign review approval logic change is the highest-risk item. The conditional `platforms?.length > 0` check must be rock-solid. If `platforms` is undefined (older data), it should default to the SCHEDULED path.
- Safe guard: `const approvalStatus = (selectedPost.platforms && selectedPost.platforms.length > 0) ? 'SCHEDULED' : 'APPROVED'`
- All existing SCHEDULED posts are unaffected — APPROVED is only ever set on new approvals of platform-less deliverables
- DELIVERED only appears via the explicit "Mark as Delivered" action — cannot be set accidentally

### Verification
- [ ] Social post with platform → approved in campaign review → status = SCHEDULED (unchanged)
- [ ] Deliverable with no platform → approved in campaign review → status = APPROVED (green badge)
- [ ] APPROVED deliverable → post detail shows "Mark as Delivered" button (no "Publish Now")
- [ ] Click "Mark as Delivered" → dialog opens → add note → confirm → status = DELIVERED (teal badge)
- [ ] DELIVERED deliverable → post detail is read-only, delete disabled
- [ ] APPROVED and DELIVERED appear in Posts page tab counts
- [ ] Calendar STATUS_LEGEND shows new statuses
- [ ] Dashboard "upcoming work" widget shows APPROVED deliverables alongside SCHEDULED posts
- [ ] ContentPipelineBar shows APPROVED and DELIVERED in the chart
- [ ] All existing posts at SCHEDULED, PENDING_APPROVAL, etc. are completely unaffected

### ⛔ STOP — confirm before Phase 6

---

## Phase 6 — Universal Rename: Posts → Deliverables

**Complexity**: Medium (mechanical) | **Risk**: Low (display-only) | **Depends on**: Phases 1–5 complete

### What this does
Changes all user-facing labels from "Post/Posts" to "Deliverable/Deliverables". This is purely cosmetic — no DB changes, no API changes, no logic changes. Done last to avoid confusion during active development.

**Rule**: DB column names, query keys, API function names, and React component names stay as-is (e.g. `useGlobalPosts`, `fetchPosts`, `post_versions` table). Only the text that users read changes.

### Files to Update

| File | Changes |
|------|---------|
| `src/components/sidebar/nav-main.jsx` | "Posts" → "Deliverables" in nav item title |
| `src/pages/Posts.jsx` | Page `<h1>`, subtitle text, "New Post" → "New Deliverable", empty state copy, tab label copy ("All Posts" → "All"), STATUS_TABS display labels |
| `src/pages/posts/DraftPostForm.jsx` | Form heading context, toast messages ("Post updated" → "Deliverable updated", "Draft created" → "Draft saved"), validation messages ("Post content is required" → "Content is required") |
| `src/pages/campaigns/CampaignDetailPage.jsx` | Tab label "Posts" → "Deliverables", "Link Posts" button text |
| `src/components/campaigns/LinkPostsToCampaignDialog.jsx` | Dialog title "Link Posts" → "Link Deliverables", button "Link N Post(s)" → "Link N Deliverable(s)" |
| `src/components/campaigns/CampaignReportPDF.jsx` | "Total Posts" → "Total Deliverables", any "Posts" section headers |
| `src/pages/calendar/CalendarReportPDF.jsx` | "Total Posts" → "Total Deliverables", "Days & Posts" → "Days & Deliverables" |
| `src/pages/campaigns/CampaignReview.jsx` | "{n} of {n} posts reviewed" → "deliverables reviewed" |
| `src/pages/dashboard/DashboardSocialMediaUsage.jsx` | Card description "Post distribution across platforms" → "Deliverable distribution across platforms" |
| Header breadcrumbs (wherever "Posts" appears as a breadcrumb) | Update via `useHeader()` calls in page components |

### What Does NOT Change
- Sidebar section is called "Deliverables" — but the Workflow tab inside ClientProfileView keeps its name "Workflow"
- The word "post" in technical/internal contexts (variable names, function names, query keys, DB columns) stays unchanged
- The word "draft" in "Save as Draft" / "Draft" status stays — it's already a universal creative term

### Breaking Change Risks
- None. Pure string replacement. No logic changes.

### Verification
- [ ] Sidebar shows "Deliverables"
- [ ] Deliverables page title and subtitle updated
- [ ] "New Deliverable" button creates a post normally
- [ ] Toast messages say "Deliverable updated", "Draft saved"
- [ ] Campaign detail tab says "Deliverables"
- [ ] PDF reports say "Total Deliverables"
- [ ] Campaign review says "N of N deliverables reviewed"
- [ ] No instance of the word "Post" (capitalised, user-facing) remains in the UI

### ✅ Phase 6 complete — implementation done

---

## Implementation Notes

### DB Migration Strategy
Run all DB migrations (Phases 1–5) together at the start using Supabase MCP. This avoids multiple migration windows and ensures the schema is ready before any UI changes.

### Safety Checklist Before Each Phase
- [ ] All existing tests pass before starting
- [ ] No uncommitted changes from previous phase
- [ ] Supabase types regenerated after any DB migration

### What Is Out of Scope (Phase 2)
- Terminology switching per agency type (full i18n / `useTerminology()` hook)
- Client portal or client-facing onboarding questionnaire
- Conditional form fields based on client type
- Agency type selection in the signup/onboarding flow
- Auto-publishing or social OAuth
- Free or micro pricing tier changes
