# Feature: Campaigns

**Product**: Tercero — Social Media Agency Management SaaS  
**File**: `.claude/features/01-campaigns.md`  
**Status**: Phase 1 Complete ✓ · Phase 2 Complete ✓ · MVP Post Linking ✓ · Phase 3 NOT STARTED
**Last Updated**: March 8, 2026 (audit pass — correlating doc against live implementation)

---

## Why This Feature Exists

Social media agencies don't think in posts — they think in campaigns. A product launch, a seasonal promotion, a brand awareness push — these are the units of work agencies pitch, staff, and invoice around. Without campaigns, Tercero shows a flat post list per client, which means agencies must mentally group and track related work themselves.

This feature adds a **campaign layer** between Client and Posts, making Tercero match how agencies actually operate. It also creates the foundation for Phase 2 analytics, budgets, and campaign-level approval workflows.

---

## Real-World Agency Problems This Solves

### 1. "Which posts belong to which initiative?"

An agency running an e-commerce client may simultaneously execute a Summer Sale campaign, a Brand Awareness push, and their ongoing Organic Content calendar. In Tercero today, all of these appear in a single flat post list. The agency has no structural way to separate them.

**Real scenario**: Agency owner opens a client with 40 posts. Some are for Back to School, some are for the regular cadence, some are one-offs. They have to scan titles to mentally filter — there is no structural grouping.

### 2. "Is this campaign on track?"

An agency commits to a client: "We'll deliver 12 posts for your product launch across Instagram and LinkedIn in March." There is currently no way to track progress against that commitment inside Tercero.

**Real scenario**: Client asks "how are we doing on the launch campaign?" The account manager has to count posts manually and check statuses one by one — and still can't give a clean percentage-complete answer. They end up doing this in a spreadsheet.

### 3. "What did we deliver last quarter for this client?"

Agencies regularly need to report what was delivered per client per quarter. Currently this is a manual exercise — there is no concept of a bounded, named deliverable set.

**Real scenario**: A client asks for a Q1 recap before a quarterly review. The agency spends 30–45 minutes compiling it from Tercero's post list. A campaign with a date range makes this a one-click summary.

### 4. "What are we working on right now across all clients?"

The agency principal wants a Monday morning overview: which active campaigns are running, which clients have things launching this week. The dashboard shows individual posts — not the campaigns they belong to.

**Real scenario**: Scrolling through individual posts across 8–15 clients to get a picture. A campaign view gives the right level of abstraction.

### 5. "When do we start the next campaign?"

The agency's planning cycle is: brief → post creation → approval → scheduling. Without campaigns, there's no container for the brief, and no way to mark a campaign as "in planning" before posts exist.

**Real scenario**: A new client onboards and the agency starts a "Brand Foundation" campaign. For the first week, they're in briefing — no posts exist yet. Currently Tercero has no way to represent this state. The campaign record itself (without any posts) is a meaningful entity.

---

## Phase Overview

```
Phase 1 — Campaign CRUD + Post Association ✅ COMPLETE
  Campaigns can be created, edited, and archived per client.
  Posts can be linked to a campaign. Campaign progress is visible.
  Subscription scoping: Velocity+ only (Ignite gets locked state).
  → Unit tests written (phase1.test.jsx). All pass.

  Implementation notes (deviations from spec):
  - useSubscription() uses flat `data?.campaigns` boolean, not `can.campaigns()` object pattern.
    Gating reads as `sub?.campaigns ?? false` everywhere (not `can.campaigns()`).
  - CampaignDialog gained a client selector for global /campaigns page (clientId not provided)
  - client_id added to Zod schema to prevent zodResolver stripping it from submit values
  - isError test uses { timeout: 5000 } due to retry:1 in useCampaigns overriding test wrapper default
  - Campaign tab lives in ClientProfileView.jsx (not ClientDetails.jsx — file was renamed/restructured)
  - Posts page campaign filter implemented via useGlobalPosts({ campaignId }) filter
  - AssignCampaignDialog (single post) and LinkPostsToCampaignDialog (bulk) both implemented
  - useAssignPostsToCampaign(), useUnlinkPostFromCampaign(), useAssignPostCampaign() all in campaigns.js
  - fetchUnlinkedPostsByClient() added (not in spec) — powers LinkPostsToCampaignDialog
  - Nav icon: Megaphone (spec said FolderOpen)

  PREVIOUSLY NOTED AS GAPS — NOW RESOLVED:
  - ✅ Client Detail Campaigns tab — in ClientProfileView.jsx with CampaignTab clientId scoping
  - ✅ Posts page campaign filter — useGlobalPosts accepts campaignId; Posts.jsx uses useCampaigns
  - ✅ Campaign badge on post cards — campaign_id / campaign_name returned from useGlobalPosts

Phase 2 — Campaign Analytics & Budget Tracking ✅ COMPLETE
  Per-campaign analytics: on-time rate, platform mix, approval turnaround.
  Budget field + invoice linking. Campaign PDF report.
  → Unit tests written (phase2.test.jsx).

  Implementation notes (deviations from spec):
  - Linked invoices section IS shown on CampaignDetailPage (§2.3 item 7) — was incorrectly marked as missing
  - CampaignCard click-to-navigate confirmed working (CampaignCard onClick → navigate(`/campaigns/${id}`))
  - Budget is read-only in CampaignDetailPage (from analytics RPC); CampaignDialog has no budget edit field
    → Budget can only be set at DB level or via future form enhancement
  - Currency is hardcoded to INR in both CampaignDetailPage and CampaignReportPDF — not configurable
  - Platform distribution uses Recharts BarChart with custom SVG tick (platform icon images)
  - avg_approval_days returned as NULL from RPC (spec noted this as deferred — still deferred)
  - Header not displayed in CampaignsPage and CampaignDetailPage — FIXED March 8, 2026
    Both were calling useHeader({ ... }) directly (wrong); corrected to useEffect + setHeader pattern

  PREVIOUSLY NOTED AS GAPS — NOW RESOLVED:
  - ✅ Linked invoices section shown on CampaignDetailPage
  - ✅ CampaignCard navigates to detail page

  REMAINING KNOWN GAPS:
  - Budget field missing from CampaignDialog (can't edit budget via UI — DB only)
  - avg_approval_days always shows "—" (RPC returns NULL; no timestamp diff logic implemented)
  - Currency hardcoded to INR (not agency-configurable)

### MVP Core: Post Linking 🟢 IMPLEMENTED
  - [x] Link existing posts to a campaign (LinkPostsToCampaignDialog — bulk)
  - [x] View linked posts on the campaign detail page
  - [x] Create a new post directly from a campaign (DraftPostForm pre-filled with campaignId + clientId)
  - [x] Remove posts from a campaign (useUnlinkPostFromCampaign — per post)
  - [x] Assign a single post to a campaign from post list (AssignCampaignDialog)

Phase 3 — Campaign-Level Client Approval Link (NOT STARTED)
  Single public URL for a client to review all posts in a campaign.
  Client reviews posts sequentially, approves or requests revisions per post.
  → Not built. No review_token column, no route, no component.
```

**After each phase: Claude Code writes unit tests. All tests must pass and be confirmed by the developer before the next phase begins.**

---

## Navigation Placement

**Campaigns is a top-level nav item, placed between Clients and Content.**

Rationale: Campaigns is a weekly-use planning feature for Velocity+ users managing 8–15 clients. It sits above posts in the conceptual hierarchy (campaigns group posts), so it belongs above Content in the nav. The Operations group (Meetings, Notes, Documents) handles day-to-day task management — campaigns is a higher-level planning layer that deserves its own position.

```
Sidebar nav order:
  Dashboard
  Clients
  Campaigns          ← NEW — top level, between Clients and Content
  Content
    Posts
    Calendar
  Operations
    Meetings
    Notes
    Documents
  Finance
    Overview
    Invoices
    Subscriptions
    Ledger
```

**On Ignite**: Campaigns nav item is always visible, with a lock icon appended to the label. Clicking it navigates to the page normally — the page shows the upgrade prompt. Never hidden — its locked presence is a deliberate upsell signal.

---

## Subscription Scoping

| Tier     | Access                             |
| -------- | ---------------------------------- |
| Trial    | Locked — upgrade prompt            |
| Ignite   | Locked — upgrade prompt everywhere |
| Velocity | Full access                        |
| Quantum  | Full access                        |

### New DB flag

```sql
ALTER TABLE agency_subscriptions
ADD COLUMN campaigns BOOLEAN DEFAULT FALSE;

UPDATE agency_subscriptions SET campaigns = FALSE WHERE plan_name IN ('trial', 'ignite');
UPDATE agency_subscriptions SET campaigns = TRUE  WHERE plan_name IN ('velocity', 'quantum');
```

### `useSubscription()` extension

```javascript
// Add to the can object in src/api/useSubscription.js:
campaigns: () => sub.campaigns ?? false,
```

### Locked UX (Ignite / Trial)

- **Sidebar nav**: visible, lock icon on label, clicks navigate normally
- **`/campaigns` page**: renders `<CampaignUpgradePrompt />` instead of content
- **Client Detail Campaigns tab**: tab always visible, renders `<CampaignUpgradePrompt />` inside
- **DraftPostForm**: campaign dropdown never appears (no campaigns can be created)
- No hard blocks or redirects — always show the upgrade path

---

## Phase 1 — Campaign CRUD + Post Association

### Goal

By the end of Phase 1, an agency on Velocity or Quantum can create named campaigns for any client, associate posts with a campaign at create or edit time, view campaign post counts and progress, and access all campaigns from a top-level nav item. Ignite agencies see all entry points but get a clean upgrade prompt everywhere.

### Before Starting — Confirm With Codebase

Before writing any code, Claude Code must read and confirm:

1.  **`src/components/sidebar/app-sidebar.jsx`** — confirm the exact structure of `navMain` and how existing items (especially Documents) are added, to insert Campaigns top-level between Clients and Content using the identical pattern.
2.  **`src/pages/clients/ClientDetails.jsx`** — confirm the exact current tab values and how `TabsTrigger` / `TabsContent` pairs are structured.
3.  **`src/api/posts.js`** — confirm `createDraftPost()` and `updatePost()` signatures to add `campaign_id` correctly without breaking existing callers.
4.  **`src/pages/posts/DraftPostForm.jsx`** — confirm form field layout and where the campaign selector should sit relative to existing fields.
5.  **`src/api/useSubscription.js`** — confirm the exact shape of the `can` object before extending it.

---

### 1.1 Database

#### New table: `campaigns`

```sql
CREATE TABLE campaigns (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id   UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  goal        TEXT,
  description TEXT,
  status      TEXT NOT NULL DEFAULT 'Active'
                CHECK (status IN ('Active', 'Completed', 'Archived')),
  start_date  DATE,
  end_date    DATE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_campaigns_user_id   ON campaigns(user_id);
CREATE INDEX idx_campaigns_client_id ON campaigns(client_id);
CREATE INDEX idx_campaigns_status    ON campaigns(status);

ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own campaigns"
  ON campaigns FOR ALL
  USING (user_id = auth.uid());
```

#### Modify `posts` — add campaign FK

```sql
-- campaign_id lives on posts (the parent record), NOT post_versions
-- ON DELETE SET NULL: deleting a campaign never deletes posts
ALTER TABLE posts
ADD COLUMN campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL;

CREATE INDEX idx_posts_campaign_id ON posts(campaign_id);
```

#### New RPC: `get_campaigns_with_post_summary`

Mirrors the `get_clients_with_pipeline` pattern — campaigns + post counts per status in a single query.

```sql
CREATE OR REPLACE FUNCTION get_campaigns_with_post_summary(
  p_user_id   UUID,
  p_client_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id               UUID,
  client_id        UUID,
  name             TEXT,
  goal             TEXT,
  description      TEXT,
  status           TEXT,
  start_date       DATE,
  end_date         DATE,
  created_at       TIMESTAMPTZ,
  updated_at       TIMESTAMPTZ,
  total_posts      BIGINT,
  draft_count      BIGINT,
  pending_count    BIGINT,
  revision_count   BIGINT,
  scheduled_count  BIGINT,
  published_count  BIGINT,
  archived_count   BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    c.id,
    c.client_id,
    c.name,
    c.goal,
    c.description,
    c.status,
    c.start_date,
    c.end_date,
    c.created_at,
    c.updated_at,
    COUNT(p.id)                                                          AS total_posts,
    COUNT(p.id) FILTER (WHERE pv.status = 'DRAFT')                       AS draft_count,
    COUNT(p.id) FILTER (WHERE pv.status = 'PENDING_APPROVAL')             AS pending_count,
    COUNT(p.id) FILTER (WHERE pv.status = 'NEEDS_REVISION')              AS revision_count,
    COUNT(p.id) FILTER (WHERE pv.status = 'SCHEDULED')                   AS scheduled_count,
    COUNT(p.id) FILTER (WHERE pv.status = 'PUBLISHED')                   AS published_count,
    COUNT(p.id) FILTER (WHERE pv.status = 'ARCHIVED')                    AS archived_count
  FROM campaigns c
  LEFT JOIN posts p
    ON p.campaign_id = c.id
  LEFT JOIN post_versions pv
    ON pv.id = p.current_version_id
  WHERE c.user_id = p_user_id
    AND (p_client_id IS NULL OR c.client_id = p_client_id)
  GROUP BY c.id
  ORDER BY c.created_at DESC;
$$;
```

#### Update `create_post_draft_v3` RPC

```sql
-- Add to function signature:
p_campaign_id UUID DEFAULT NULL

-- Add campaign_id to the INSERT into posts (not post_versions):
-- In the INSERT INTO posts (...) VALUES (...) block:
campaign_id  →  p_campaign_id
```

#### Add subscription flag

```sql
ALTER TABLE agency_subscriptions
ADD COLUMN campaigns BOOLEAN DEFAULT FALSE;

UPDATE agency_subscriptions SET campaigns = FALSE WHERE plan_name IN ('trial', 'ignite');
UPDATE agency_subscriptions SET campaigns = TRUE  WHERE plan_name IN ('velocity', 'quantum');
```

---

### 1.2 API Layer

**New file**: `src/api/campaigns.js`

```javascript
import { supabase } from '@/lib/supabase'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

// ─── Read ────────────────────────────────────────────────────────────────────

export function useCampaigns({ clientId } = {}) {
  return useQuery({
    queryKey: ['campaigns', 'list', { clientId: clientId ?? null }],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      const { data, error } = await supabase.rpc(
        'get_campaigns_with_post_summary',
        { p_user_id: user.id, p_client_id: clientId ?? null },
      )
      if (error) throw error
      return data ?? []
    },
    staleTime: 30000,
    retry: 1,
  })
}

export function useCampaign(campaignId) {
  return useQuery({
    queryKey: ['campaigns', 'detail', campaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .eq('id', campaignId)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!campaignId,
    staleTime: 30000,
    retry: 1,
  })
}

// Plain async — called inside useEffect in DraftPostForm on client change
export async function fetchActiveCampaignsByClient(clientId) {
  const { data, error } = await supabase
    .from('campaigns')
    .select('id, name')
    .eq('client_id', clientId)
    .eq('status', 'Active')
    .order('name')
  if (error) throw error
  return data ?? []
}

// ─── Mutations ───────────────────────────────────────────────────────────────

export function useCreateCampaign() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload) => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      const { data, error } = await supabase
        .from('campaigns')
        .insert({ ...payload, user_id: user.id })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns', 'list'] })
    },
  })
}

export function useUpdateCampaign() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }) => {
      const { data, error } = await supabase
        .from('campaigns')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['campaigns', 'list'] })
      queryClient.invalidateQueries({
        queryKey: ['campaigns', 'detail', data.id],
      })
    },
  })
}

export function useDeleteCampaign() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id) => {
      // ON DELETE SET NULL — posts are safely orphaned, never deleted
      const { error } = await supabase.from('campaigns').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns', 'list'] })
    },
  })
}
```

**Extend `src/api/posts.js`**:

- Add optional `campaignId` param to `createDraftPost()` — pass as `p_campaign_id: campaignId ?? null`
- Add `campaign_id` to the `.update({})` payload in `updatePost()` when provided
- In the global posts select, add: `campaign_id, campaigns!campaign_id ( id, name )`

**Extend `src/api/useSubscription.js`**:

```javascript
campaigns: () => sub.campaigns ?? false,
```

---

### 1.3 Components

```
src/
├── api/
│   └── campaigns.js
├── pages/
│   └── campaigns/
│       └── CampaignsPage.jsx
└── components/
    └── campaigns/
        ├── CampaignTab.jsx
        ├── CampaignCard.jsx
        ├── CampaignDialog.jsx
        └── CampaignUpgradePrompt.jsx
```

#### `CampaignUpgradePrompt.jsx`

```jsx
import { Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useNavigate } from 'react-router-dom'

export function CampaignUpgradePrompt() {
  const navigate = useNavigate()
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
      <div className="p-3 rounded-full bg-muted">
        <Lock className="h-6 w-6 text-muted-foreground" />
      </div>
      <div>
        <p className="font-semibold text-foreground">
          Campaigns are a Velocity feature
        </p>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          Group posts into named campaigns, track progress, and manage client
          deliverables — available on Velocity and above.
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={() => navigate('/billing')}>
        View Plans
      </Button>
    </div>
  )
}
```

#### `CampaignCard.jsx`

**Props**: `campaign` (RPC object), `onEdit`, `onDelete`

**Renders**:

- Name + status badge (`Active` = green, `Completed` = blue, `Archived` = muted)
- Goal text — 1 line truncated, full text in `title` attribute
- Date range — "Mar 1 – Mar 31, 2026" / single date / "No dates set"
- Pipeline mini-bar — shows only non-zero counts: Drafts · Pending · Revisions · Scheduled · Published
- Progress bar — `published_count / total_posts` as percentage fill; add `data-testid="progress-bar"` for tests; hidden when `total_posts === 0`
- Three-dot `DropdownMenu`: Edit, Mark Complete (Active only), Archive (Active/Completed only), Delete

#### `CampaignDialog.jsx`

**Props**: `open`, `onOpenChange`, `clientId`, `initialData` (null = create, object = edit)

**Fields + Zod schema**:

```javascript
const schema = z
  .object({
    name: z.string().min(1, 'Campaign name is required'),
    goal: z.string().optional().nullable(),
    description: z.string().optional().nullable(),
    start_date: z.date().optional().nullable(),
    end_date: z.date().optional().nullable(),
    status: z.enum(['Active', 'Completed', 'Archived']).default('Active'),
  })
  .refine(
    ({ start_date, end_date }) =>
      !(start_date && end_date) || end_date >= start_date,
    { message: 'End date must be on or after start date', path: ['end_date'] },
  )
```

`status` field is hidden on create (defaults to Active), shown on edit.

#### `CampaignTab.jsx`

**Props**: `clientId` (optional)

- If `!can.campaigns()` → render `<CampaignUpgradePrompt />` immediately, no data fetch
- Search (on `name` and `goal`) + status filter (All / Active / Completed / Archived) — client-side filtering
- Loading: 3× skeleton cards
- Empty state (no campaigns): "No campaigns yet" + centred New Campaign button
- Empty state (filtered, no results): "No campaigns match your filters."
- New Campaign → `CampaignDialog` create mode
- Card Edit → `CampaignDialog` edit mode
- Card Delete → `AlertDialog` confirm → `useDeleteCampaign`

#### `CampaignsPage.jsx`

```jsx
export default function CampaignsPage() {
  useHeader({ title: 'Campaigns', breadcrumbs: [{ label: 'Campaigns' }] })
  const { can } = useSubscription()
  return (
    <div className="p-6">
      {can.campaigns() ? <CampaignTab /> : <CampaignUpgradePrompt />}
    </div>
  )
}
```

---

### 1.4 Routing & Navigation

**Route** (`src/App.jsx`):

```jsx
<Route path="/campaigns" element={<CampaignsPage />} />
```

**Sidebar** (`src/components/sidebar/app-sidebar.jsx`):

- Insert into `navMain` between the Clients item and the Content group
- Icon: `FolderOpen` from lucide-react
- Show lock icon on label when `!can.campaigns()` — follow the existing locked nav item pattern
- Never conditionally hide — always visible

**Client Detail tab** (`src/pages/clients/ClientDetails.jsx`):

```jsx
<TabsTrigger value="campaigns">Campaigns</TabsTrigger>
// ...
<TabsContent value="campaigns">
  <CampaignTab clientId={clientId} />
</TabsContent>
```

Tab is always visible. `CampaignTab` handles the locked state internally.

---

### 1.5 DraftPostForm — Campaign Dropdown

In `src/pages/posts/DraftPostForm.jsx`, below the client selector:

```jsx
const [availableCampaigns, setAvailableCampaigns] = useState([]);

useEffect(() => {
  if (!watchedClientId || !can.campaigns()) {
    setAvailableCampaigns([]);
    return;
  }
  fetchActiveCampaignsByClient(watchedClientId)
    .then(setAvailableCampaigns)
    .catch(() => setAvailableCampaigns([]));
}, [watchedClientId]);

// Only render when campaigns exist for this client:
{availableCampaigns.length > 0 && (
  <FormField name="campaign_id" ... />
)}
```

- Value `""` (empty string) = "No Campaign" = saves `null` to DB
- On client change → reset campaign selection
- Edit mode → pre-populate from `post.campaign_id`

---

### 1.6 Posts Page — Campaign Filter & Badge

In `src/pages/Posts.jsx`:

- Add campaign filter dropdown using a flat `useCampaigns()` (no clientId)
- Pass selected `campaignId` into the post query
- Show a `FolderOpen` icon + campaign name badge on post cards that have a `campaign_id`
- Requires extending the global posts select to include `campaign_id, campaigns!campaign_id ( id, name )`

---

### 1.7 Impact on Existing Features

| Feature                    | Impact                             | Action                                       |
| -------------------------- | ---------------------------------- | -------------------------------------------- |
| `posts` table              | New nullable `campaign_id` column  | Migration — zero regression                  |
| `create_post_draft_v3` RPC | New optional `p_campaign_id` param | Update RPC + `createDraftPost()`             |
| `DraftPostForm`            | New optional campaign dropdown     | Additive — only appears when campaigns exist |
| Client Detail              | New Campaigns tab                  | Add tab — existing tabs unaffected           |
| Global Posts page          | Campaign filter + badge            | Additive                                     |
| `useSubscription()`        | New `can.campaigns()`              | Extend hook + DB column                      |
| Sidebar nav                | New top-level item                 | Insert between Clients and Content           |

---

### 1.8 What Phase 1 Does NOT Include

- Campaign analytics — Phase 2
- Budget field and invoice linking — Phase 2
- Campaign PDF reports — Phase 2
- Campaign-level public approval link — Phase 3
- Campaign filter on Calendar page — deferred
- Campaign count on Dashboard — deferred
- Campaign ordering / templates / duplication — future

---

### 1.9 Phase 1 Checklist

**Database**

- [x] `campaigns` table created with all columns, indexes, RLS
- [x] `posts.campaign_id` nullable FK added (ON DELETE SET NULL)
- [x] `get_campaigns_with_post_summary` RPC created and returns correct counts
- [x] `create_post_draft_v3` RPC updated to accept and write `p_campaign_id`
- [x] `agency_subscriptions.campaigns` column added and seeded per plan

**API**

- [x] `src/api/campaigns.js` created with all hooks and mutation functions
- [x] `useCampaigns({ clientId })` works with and without clientId
- [x] `fetchActiveCampaignsByClient` returns only Active campaigns
- [x] `createDraftPost` and `updatePost` pass `campaign_id` correctly
- [x] `useSubscription()` — uses flat `data?.campaigns` boolean (deviation from spec's `can.campaigns()` pattern)

**Components**

- [x] `CampaignCard` renders for Active, Completed, Archived states
- [x] Progress bar shows `published_count / total_posts` (hidden when total = 0)
- [x] `CampaignDialog` create saves + list refreshes
- [x] `CampaignDialog` edit pre-populates all fields
- [x] End date < start date shows validation error
- [x] Delete fires `AlertDialog` — posts NOT deleted (verify in DB)
- [x] `CampaignUpgradePrompt` renders for Ignite/Trial
- [x] Loading: skeleton cards (not spinner)

**Post Integration**

- [x] Campaign dropdown appears when active campaigns exist for the client
- [x] Campaign dropdown absent when no active campaigns exist
- [x] Selecting a campaign saves `campaign_id` correctly
- [x] Clearing saves `null` correctly
- [x] Edit mode pre-selects correct campaign
- [x] Global Posts page shows campaign badge on tagged posts
- [x] Campaign filter on Posts page narrows the list correctly

**Routing & Nav**

- [x] `/campaigns` route renders `CampaignsPage`
- [x] `/campaigns/:campaignId` route renders `CampaignDetailPage`
- [x] Campaigns nav item appears top-level between Clients and Content
- [x] Nav icon is Megaphone (spec said FolderOpen — intentional deviation)
- [x] Nav item shows lock icon + tooltip "Available on Velocity & Quantum" for locked tiers
- [x] Ignite: clicking nav navigates → shows upgrade prompt (no crash)
- [x] Client Detail Campaigns tab in ClientProfileView.jsx renders and scopes to `clientId`
- [x] Client Detail Campaigns tab shows upgrade prompt for Ignite
- [x] CampaignTab subscription check uses `sub?.campaigns` flat boolean (not `can.campaigns()`)

**→ Phase 1 complete.**

---

### 1.10 Phase 1 Unit Tests

**Test file**: `src/tests/campaigns/phase1.test.js`

Stack: **Vitest** + `@testing-library/react`. Supabase mocked via `vi.mock('@/lib/supabase')`.

---

#### Group A — API / Data Layer

```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { createWrapper } from '../test-utils'
import { useCampaigns, fetchActiveCampaignsByClient } from '@/api/campaigns'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi
        .fn()
        .mockResolvedValue({ data: { user: { id: 'user-123' } } }),
    },
    rpc: vi.fn(),
    from: vi.fn(),
  },
}))

import { supabase } from '@/lib/supabase'

describe('Group A — API Layer', () => {
  describe('useCampaigns', () => {
    it('calls RPC with user_id and null client_id when no clientId passed', async () => {
      supabase.rpc.mockResolvedValue({ data: [], error: null })
      const { result } = renderHook(() => useCampaigns(), {
        wrapper: createWrapper(),
      })
      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(supabase.rpc).toHaveBeenCalledWith(
        'get_campaigns_with_post_summary',
        { p_user_id: 'user-123', p_client_id: null },
      )
    })

    it('passes clientId to RPC when provided', async () => {
      supabase.rpc.mockResolvedValue({ data: [], error: null })
      renderHook(() => useCampaigns({ clientId: 'client-abc' }), {
        wrapper: createWrapper(),
      })
      await waitFor(() =>
        expect(supabase.rpc).toHaveBeenCalledWith(
          'get_campaigns_with_post_summary',
          { p_user_id: 'user-123', p_client_id: 'client-abc' },
        ),
      )
    })

    it('returns empty array when RPC returns null', async () => {
      supabase.rpc.mockResolvedValue({ data: null, error: null })
      const { result } = renderHook(() => useCampaigns(), {
        wrapper: createWrapper(),
      })
      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(result.current.data).toEqual([])
    })

    it('sets isError when RPC returns an error', async () => {
      supabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'DB error' },
      })
      const { result } = renderHook(() => useCampaigns(), {
        wrapper: createWrapper(),
      })
      await waitFor(() => expect(result.current.isError).toBe(true))
    })
  })

  describe('fetchActiveCampaignsByClient', () => {
    it('filters by client_id and status = Active', async () => {
      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi
          .fn()
          .mockResolvedValue({
            data: [{ id: 'c1', name: 'Launch' }],
            error: null,
          }),
      }
      supabase.from.mockReturnValue(mockChain)

      const result = await fetchActiveCampaignsByClient('client-abc')

      expect(supabase.from).toHaveBeenCalledWith('campaigns')
      expect(mockChain.eq).toHaveBeenCalledWith('client_id', 'client-abc')
      expect(mockChain.eq).toHaveBeenCalledWith('status', 'Active')
      expect(result).toEqual([{ id: 'c1', name: 'Launch' }])
    })

    it('returns empty array when data is null', async () => {
      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: null, error: null }),
      }
      supabase.from.mockReturnValue(mockChain)
      const result = await fetchActiveCampaignsByClient('client-abc')
      expect(result).toEqual([])
    })
  })
})
```

---

#### Group B — Subscription Gating Logic

```javascript
describe('Group B — Subscription Gating', () => {
  it('can.campaigns() returns false for ignite (campaigns = false)', () => {
    const sub = { campaigns: false }
    const can = { campaigns: () => sub.campaigns ?? false }
    expect(can.campaigns()).toBe(false)
  })

  it('can.campaigns() returns true for velocity (campaigns = true)', () => {
    const sub = { campaigns: true }
    const can = { campaigns: () => sub.campaigns ?? false }
    expect(can.campaigns()).toBe(true)
  })

  it('can.campaigns() defaults to false when flag is absent from subscription row', () => {
    const sub = {} // missing column — simulates DB migration not yet applied
    const can = { campaigns: () => sub.campaigns ?? false }
    expect(can.campaigns()).toBe(false)
  })
})
```

---

#### Group C — CampaignDialog Validation

```javascript
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CampaignDialog } from '@/components/campaigns/CampaignDialog'

vi.mock('@/api/campaigns', () => ({
  useCreateCampaign: () => ({
    mutateAsync: vi.fn().mockResolvedValue({}),
    isPending: false,
  }),
  useUpdateCampaign: () => ({
    mutateAsync: vi.fn().mockResolvedValue({}),
    isPending: false,
  }),
}))

describe('Group C — CampaignDialog', () => {
  it('shows "Campaign name is required" when form submitted with empty name', async () => {
    render(
      <CampaignDialog
        open
        onOpenChange={vi.fn()}
        clientId="c1"
        initialData={null}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /create campaign/i }))
    await waitFor(() =>
      expect(screen.getByText('Campaign name is required')).toBeInTheDocument(),
    )
  })

  it('pre-populates name and goal fields in edit mode', () => {
    const initial = {
      id: 'camp-1',
      name: 'Summer Launch',
      goal: 'Drive 500 sign-ups',
      description: '',
      status: 'Active',
      start_date: null,
      end_date: null,
    }
    render(
      <CampaignDialog
        open
        onOpenChange={vi.fn()}
        clientId="c1"
        initialData={initial}
      />,
    )
    expect(screen.getByDisplayValue('Summer Launch')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Drive 500 sign-ups')).toBeInTheDocument()
  })

  it('calls createCampaign mutation with correct payload on valid submit', async () => {
    const mockCreate = vi.fn().mockResolvedValue({})
    vi.mocked(require('@/api/campaigns').useCreateCampaign).mockReturnValue({
      mutateAsync: mockCreate,
      isPending: false,
    })
    render(
      <CampaignDialog
        open
        onOpenChange={vi.fn()}
        clientId="c1"
        initialData={null}
      />,
    )
    await userEvent.type(
      screen.getByPlaceholderText(/campaign name/i),
      'Brand Launch',
    )
    fireEvent.click(screen.getByRole('button', { name: /create campaign/i }))
    await waitFor(() =>
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Brand Launch', client_id: 'c1' }),
      ),
    )
  })
})
```

---

#### Group D — CampaignCard Rendering

```javascript
import { render, screen } from '@testing-library/react'
import { CampaignCard } from '@/components/campaigns/CampaignCard'

const base = {
  id: 'c1',
  name: 'Q2 Launch',
  goal: 'Drive 500 sign-ups',
  status: 'Active',
  start_date: '2026-03-01',
  end_date: '2026-03-31',
  total_posts: 10,
  draft_count: 2,
  pending_count: 1,
  revision_count: 0,
  scheduled_count: 4,
  published_count: 3,
  archived_count: 0,
}

describe('Group D — CampaignCard', () => {
  it('renders campaign name and Active status badge', () => {
    render(<CampaignCard campaign={base} onEdit={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByText('Q2 Launch')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
  })

  it('renders goal text', () => {
    render(<CampaignCard campaign={base} onEdit={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByText('Drive 500 sign-ups')).toBeInTheDocument()
  })

  it('hides progress bar when total_posts is 0', () => {
    const { container } = render(
      <CampaignCard
        campaign={{ ...base, total_posts: 0, published_count: 0 }}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    )
    expect(container.querySelector('[data-testid="progress-bar"]')).toBeNull()
  })

  it('shows progress bar when total_posts > 0', () => {
    const { container } = render(
      <CampaignCard campaign={base} onEdit={vi.fn()} onDelete={vi.fn()} />,
    )
    expect(
      container.querySelector('[data-testid="progress-bar"]'),
    ).not.toBeNull()
  })

  it('calculates 30% progress for 3 published out of 10', () => {
    render(<CampaignCard campaign={base} onEdit={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByText(/30%/i)).toBeInTheDocument()
  })

  it('renders Archived status badge for archived campaigns', () => {
    render(
      <CampaignCard
        campaign={{ ...base, status: 'Archived' }}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    )
    expect(screen.getByText('Archived')).toBeInTheDocument()
  })
})
```

---

#### Group E — CampaignUpgradePrompt

```javascript
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { CampaignUpgradePrompt } from '@/components/campaigns/CampaignUpgradePrompt'

describe('Group E — CampaignUpgradePrompt', () => {
  it('renders the upgrade message', () => {
    render(
      <MemoryRouter>
        <CampaignUpgradePrompt />
      </MemoryRouter>,
    )
    expect(
      screen.getByText(/Campaigns are a Velocity feature/i),
    ).toBeInTheDocument()
  })

  it('renders the View Plans button', () => {
    render(
      <MemoryRouter>
        <CampaignUpgradePrompt />
      </MemoryRouter>,
    )
    expect(
      screen.getByRole('button', { name: /view plans/i }),
    ).toBeInTheDocument()
  })
})
```

---

#### Group F — CampaignsPage Subscription Gate

```javascript
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import CampaignsPage from '@/pages/campaigns/CampaignsPage'

vi.mock('@/api/useSubscription', () => ({ useSubscription: vi.fn() }))
vi.mock('@/components/campaigns/CampaignTab', () => ({
  CampaignTab: () => <div data-testid="campaign-tab" />,
}))
vi.mock('@/components/campaigns/CampaignUpgradePrompt', () => ({
  CampaignUpgradePrompt: () => <div data-testid="upgrade-prompt" />,
}))
vi.mock('@/components/misc/header-context', () => ({ useHeader: vi.fn() }))

import { useSubscription } from '@/api/useSubscription'

describe('Group F — CampaignsPage', () => {
  it('renders CampaignTab when can.campaigns() is true', () => {
    useSubscription.mockReturnValue({ can: { campaigns: () => true } })
    render(
      <MemoryRouter>
        <CampaignsPage />
      </MemoryRouter>,
    )
    expect(screen.getByTestId('campaign-tab')).toBeInTheDocument()
    expect(screen.queryByTestId('upgrade-prompt')).toBeNull()
  })

  it('renders CampaignUpgradePrompt when can.campaigns() is false', () => {
    useSubscription.mockReturnValue({ can: { campaigns: () => false } })
    render(
      <MemoryRouter>
        <CampaignsPage />
      </MemoryRouter>,
    )
    expect(screen.getByTestId('upgrade-prompt')).toBeInTheDocument()
    expect(screen.queryByTestId('campaign-tab')).toBeNull()
  })
})
```

---

#### Running Phase 1 Tests

```bash
# Run all Phase 1 campaign tests
npx vitest run src/tests/campaigns/phase1.test.js

# Watch mode during development
npx vitest src/tests/campaigns/phase1.test.js
```

**Gate criteria — all of the following before Phase 2 begins**:

- All 6 test groups pass with zero failures
- No unresolved TODO placeholders
- The date validation test in Group C (end_date < start_date) verified manually if the date picker interaction is complex — documented in implementation notes

---

## Phase 2 — Campaign Analytics & Budget Tracking

### Goal

Each campaign gets a dedicated detail page showing analytics: on-time delivery rate, client approval turnaround, and platform distribution. A budget field is added to campaigns. Invoices can be tagged to a campaign. A campaign PDF report follows the `CalendarReportPDF` pattern.

### Before Starting — Confirm Phase 1 Tests Passed

All Phase 1 tests must have passed and been confirmed. Then verify:

- `get_campaigns_with_post_summary` RPC is live and returning data
- `posts.campaign_id` is being written correctly (check via Supabase table viewer)
- Invoice table column names (read `src/api/invoices.js`) before adding the FK

### 2.1 Database

```sql
ALTER TABLE campaigns ADD COLUMN budget NUMERIC(12, 2);

ALTER TABLE invoices
ADD COLUMN campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL;

CREATE INDEX idx_invoices_campaign_id ON invoices(campaign_id);
```

#### New RPC: `get_campaign_analytics`

```sql
CREATE OR REPLACE FUNCTION get_campaign_analytics(p_campaign_id UUID)
RETURNS TABLE (
  total_posts           BIGINT,
  published_posts       BIGINT,
  on_time_posts         BIGINT,
  avg_approval_days     NUMERIC,
  platform_distribution JSONB,
  budget                NUMERIC,
  total_invoiced        NUMERIC,
  total_collected       NUMERIC
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
DECLARE v_campaign campaigns%ROWTYPE;
BEGIN
  SELECT * INTO v_campaign FROM campaigns WHERE id = p_campaign_id;
  RETURN QUERY
  SELECT
    COUNT(p.id)::BIGINT,
    COUNT(p.id) FILTER (WHERE pv.status = 'PUBLISHED')::BIGINT,
    COUNT(p.id) FILTER (
      WHERE pv.status = 'PUBLISHED'
        AND pv.published_at IS NOT NULL
        AND pv.target_date  IS NOT NULL
        AND pv.published_at <= pv.target_date::TIMESTAMPTZ
    )::BIGINT,
    NULL::NUMERIC,  -- avg_approval_days: implement after confirming timestamp availability
    COALESCE(
      (SELECT jsonb_object_agg(plat, cnt) FROM (
        SELECT unnest(pv2.platform) AS plat, COUNT(*) AS cnt
        FROM posts p2
        JOIN post_versions pv2 ON pv2.id = p2.current_version_id
        WHERE p2.campaign_id = p_campaign_id
        GROUP BY plat
      ) sub),
      '{}'::jsonb
    ),
    v_campaign.budget,
    COALESCE(SUM(i.total_amount) FILTER (WHERE i.status IN ('SENT','OVERDUE','PAID')), 0),
    COALESCE(SUM(i.total_amount) FILTER (WHERE i.status = 'PAID'), 0)
  FROM campaigns c
  LEFT JOIN posts p ON p.campaign_id = c.id
  LEFT JOIN post_versions pv ON pv.id = p.current_version_id
  LEFT JOIN invoices i ON i.campaign_id = p_campaign_id
  WHERE c.id = p_campaign_id
  GROUP BY v_campaign.budget;
END;
$$;
```

### 2.2 New Route

```jsx
<Route path="/campaigns/:campaignId" element={<CampaignDetailPage />} />
```

### 2.3 Components

**`CampaignDetailPage.jsx`** sections:

1. Header — name, goal, date range, status badge, Edit, Export PDF
2. KPI bar — Total Posts · Published · On-Time Rate · Avg Approval Time
3. Progress bar
4. Platform distribution — recharts `BarChart`
5. Post list — `target_date` order, same card style as Posts page
6. Budget section — shown only when `budget` is set: Budget / Invoiced / Collected / Remaining
7. Linked invoices — filtered to `campaign_id`

**`CampaignReportPDF.jsx`** — follows `CalendarReportPDF.jsx` pattern exactly (`@react-pdf/renderer`). Contains: agency logo + name, campaign name/goal/date range, KPI summary, platform breakdown table, post list, budget summary if set.

**Invoice integration**: Add optional Campaign selector to `EditInvoiceDialog` and `CreateInvoiceDialog`, using the same `fetchActiveCampaignsByClient` pattern. Gated behind `can.campaigns()`.

### 2.4 Phase 2 Checklist

- [x] `campaigns.budget` column added
- [x] `invoices.campaign_id` column added
- [x] `get_campaign_analytics` RPC returns correct values
- [x] `/campaigns/:campaignId` route renders `CampaignDetailPage`
- [x] Clicking a `CampaignCard` navigates to detail page
- [x] KPI bar shows correct values
- [x] On-time rate handles division by zero (shows "—" not NaN)
- [x] Platform distribution chart renders (Recharts BarChart, custom icon ticks)
- [x] Post list renders with media thumbnail, status badge, platform icons
- [x] Budget section hidden when budget is null
- [x] Linked invoices shows invoices with matching `campaign_id`
- [x] Campaign PDF generates and downloads correctly (`CampaignReportPDF.jsx`)
- [x] Invoice create/edit: campaign dropdown appears for Velocity+
- [x] Invoice `campaign_id` saves correctly
- [x] Header displays correctly in CampaignsPage (fixed March 8, 2026 — was calling `useHeader()` wrong)
- [x] Header displays correctly in CampaignDetailPage (same fix; updates when campaign name loads)
- [ ] Budget editable in CampaignDialog — NOT IMPLEMENTED (read-only in analytics display only)
- [ ] avg_approval_days — RPC returns NULL; KPI always shows "—"
- [ ] Currency configurable — hardcoded INR in both CampaignDetailPage and CampaignReportPDF

**→ Phase 2 functionally complete. Three known gaps remain (budget edit UI, approval days metric, currency config) — deferred to future iteration.**

### 2.5 Phase 2 Unit Tests

**Test file**: `src/tests/campaigns/phase2.test.js`

**Group A — Analytics RPC shape**: mock `get_campaign_analytics`, verify hook returns all expected fields with correct types; verify `total_invoiced` and `total_collected` are numbers (not strings).

**Group B — On-time rate display logic**: unit test the calculation function directly — `(on_time_posts / published_posts) * 100`; returns `"—"` when `published_posts === 0`; returns `"100%"` when all published posts are on time.

**Group C — Budget section visibility**: renders Budget section when `budget` is a number; hidden when `budget` is null; shows correct Remaining = budget − total_invoiced.

**Group D — CampaignDetailPage render**: with mocked analytics, all KPI cards render with their values; platform chart renders without throwing; post list renders in order.

**Group E — PDF generation**: `CampaignReportPDF` renders without throwing when passed valid `reportData` and `agencyName`; renders without budget section when budget is null.

**Group F — Invoice campaign field**: campaign dropdown appears in invoice dialog for Velocity+ (`can.campaigns() = true`); absent for Ignite (`can.campaigns() = false`).

```bash
npx vitest run src/tests/campaigns/phase2.test.js
```

**Gate criteria**: all 6 groups pass with zero failures before Phase 3 begins.

---

---

## Implementation Reality (As-Built — March 2026 Audit)

This section documents the actual architecture for future developers and Claude Code sessions.

### Flows by Context

#### Global `/campaigns` page
- `CampaignsPage` → `CampaignTab` (no `clientId` prop)
- `CampaignTab` checks `sub?.campaigns`; if false → `CampaignUpgradePrompt`
- `useCampaigns()` calls RPC `get_campaigns_with_post_summary(user_id, null)` — all clients
- `CampaignCard` shows optional `showClient` prop (client name) when used globally
- Clicking a card → `/campaigns/:campaignId`
- "New Campaign" in page header → `CampaignDialog` with client selector (no `clientId` pre-set)

#### Client detail `/clients/:clientId` → Campaigns tab
- `ClientProfileView` → `CampaignTab clientId={client.id}`
- `CampaignTab` checks subscription; if locked → `CampaignUpgradePrompt`
- `useCampaigns({ clientId })` calls RPC with `p_client_id` — only that client's campaigns
- `CampaignDialog` skips client selector (clientId already known)
- Clicking a card → `/campaigns/:campaignId` (detail page is always global)

#### Campaign detail `/campaigns/:campaignId`
- Loads `useCampaign`, `useCampaignAnalytics`, `useGlobalPosts({ campaignId })`, `useCampaignInvoices`
- Posts list from `useGlobalPosts` — posts can belong to different clients in same campaign
- "New Post" → `DraftPostForm` pre-filled with `initialCampaignId` + `campaign.client_id`
- "Link Posts" → `LinkPostsToCampaignDialog` — fetches unlinked posts via `fetchUnlinkedPostsByClient`
- Export PDF → `CampaignReportPDF` rendered server-side via `@react-pdf/renderer` pdf()

#### Post list → Assign campaign
- `DraftPostList` → per-post dropdown → "Assign Campaign" → `AssignCampaignDialog`
- `AssignCampaignDialog` uses `fetchActiveCampaignsByClient(clientId)` to populate options
- Saves via `useAssignPostCampaign()` mutation (single post, supports null to clear)
- `Posts.jsx` (global) includes campaign filter dropdown using `useCampaigns()` (no clientId)
- Posts filtered via `useGlobalPosts({ campaignId })` when a campaign is selected

#### DraftPostForm campaign dropdown
- `DraftPostForm` receives optional `initialCampaignId` + `initialCampaignName` props
- When a client is selected, fetches active campaigns via `fetchActiveCampaignsByClient`
- Dropdown only appears when active campaigns exist for the selected client
- Controlled by `sub?.campaigns` gating — absent entirely for Ignite/Trial

### Subscription Gating Matrix (Verified Against Live Code)

| Entry Point | Ignite/Trial behaviour | Velocity/Quantum behaviour |
|---|---|---|
| Sidebar nav item | Visible, lock icon, disabled tooltip | Fully clickable |
| `/campaigns` page | `CampaignUpgradePrompt` rendered | Full campaign list |
| Client detail Campaigns tab | `CampaignUpgradePrompt` in tab body | Full scoped list |
| Campaign dropdown in DraftPostForm | Dropdown not rendered | Shown when campaigns exist |
| Invoice campaign field | Dropdown not rendered | Shown in create/edit dialogs |
| `/campaigns/:campaignId` | Not blocked at route level (direct URL works) | Full analytics + PDF |

> **Note:** The detail page at `/campaigns/:campaignId` is not gated at the route level — a Trial/Ignite user who navigates directly would see the campaign detail. In practice this is low risk (they can't create campaigns), but worth hardening with a redirect if needed.

### Key Files (Campaigns Feature)

```
src/
├── api/
│   ├── campaigns.js              — all hooks + mutations + plain async fns
│   └── useGlobalPosts.js         — campaignId filter added
├── pages/
│   └── campaigns/
│       ├── CampaignsPage.jsx     — global list page (top-level nav)
│       └── CampaignDetailPage.jsx — detail + analytics + posts + invoices + PDF
├── components/
│   └── campaigns/
│       ├── CampaignTab.jsx           — reusable tab (global + client-scoped)
│       ├── CampaignCard.jsx          — card with status, progress, dropdown actions
│       ├── CampaignDialog.jsx        — create/edit form (zod validated)
│       ├── CampaignUpgradePrompt.jsx — locked state for Ignite/Trial
│       ├── AssignCampaignDialog.jsx  — single post → campaign assignment
│       ├── LinkPostsToCampaignDialog.jsx — bulk unlinked posts → campaign
│       └── CampaignReportPDF.jsx     — @react-pdf/renderer PDF report
```

### Known Technical Debt

1. **Budget not editable in UI** — `campaigns.budget` is a DB column but `CampaignDialog` has no budget field. Users cannot set budget without direct DB access.
2. **avg_approval_days always "—"** — RPC `get_campaign_analytics` returns NULL for this field; the timestamp diff logic is not implemented.
3. **Currency hardcoded to INR** — Both `CampaignDetailPage` and `CampaignReportPDF` use `currency: 'INR'` in `Intl.NumberFormat`. Must be updated if multi-currency support is added.
4. **Detail page not gated at route level** — A locked-tier user with a direct URL can access campaign detail without restriction.
5. **Post ID inconsistency** — `AssignCampaignDialog` uses `post.actual_post_id || post.id` fallback, indicating posts from different API contexts have different ID field shapes. Should be normalized.

---

## Phase 3 — Campaign-Level Client Approval Link

### Goal

A single public URL lets a client review all posts in a campaign without logging in. The client steps through each post and approves or requests revisions in one session. This eliminates the need for multiple individual `/review/:token` links per campaign.

The campaign review page is a **grouped UX wrapper** around the existing per-post approval mechanism — no new approval logic. It shows only `PENDING_APPROVAL` posts (those awaiting client input). Posts in `NEEDS_REVISION`, `DRAFT`, `SCHEDULED`, `PUBLISHED`, or `ARCHIVED` are excluded — there is nothing for the client to do with them.

### Before Starting — Confirm Phase 2 Tests Passed

Read `src/pages/PublicReview.jsx` thoroughly. `CampaignReview.jsx` follows the same patterns exactly:
- Branding: `branding_agency_sidebar` flag controls agency logo vs Tercero fallback
- Footer: `branding_powered_by` flag, defaults `true`
- Status update RPC: `update_post_status_by_token(p_token, p_status, p_feedback)`
- Approve → `'SCHEDULED'`; Request Revisions → `'NEEDS_REVISION'`

### 3.1 Database

```sql
ALTER TABLE campaigns
ADD COLUMN review_token UUID DEFAULT gen_random_uuid() UNIQUE;

-- Populate existing rows (DEFAULT only applies to new inserts)
UPDATE campaigns SET review_token = gen_random_uuid() WHERE review_token IS NULL;
```

#### New RPC: `get_campaign_by_review_token`

Returns campaign metadata + branding + all `PENDING_APPROVAL` posts in one unauthenticated call (SECURITY DEFINER). Returns no rows for an invalid token — the component treats an empty/null result as invalid.

```sql
CREATE OR REPLACE FUNCTION get_campaign_by_review_token(p_token UUID)
RETURNS TABLE (
  campaign_id             UUID,
  campaign_name           TEXT,
  goal                    TEXT,
  agency_name             TEXT,
  logo_url                TEXT,
  branding_agency_sidebar BOOLEAN,
  branding_powered_by     BOOLEAN,
  posts                   JSONB
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT
    c.id,
    c.name,
    c.goal,
    ags.agency_name,
    ags.logo_url,
    ags.branding_agency_sidebar,
    ags.branding_powered_by,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'post_id',        p.id,
          'title',          pv.title,
          'content',        pv.content,
          'platform',       pv.platform,
          'target_date',    pv.target_date,
          'media_urls',     pv.media_urls,
          'status',         pv.status,
          'version_number', pv.version_number,
          'review_token',   pv.review_token
        ) ORDER BY pv.target_date NULLS LAST
      ) FILTER (WHERE pv.status = 'PENDING_APPROVAL'),
      '[]'::jsonb
    )
  FROM campaigns c
  JOIN agency_subscriptions ags ON ags.user_id = c.user_id
  LEFT JOIN posts p ON p.campaign_id = c.id
  LEFT JOIN post_versions pv ON pv.id = p.current_version_id
  WHERE c.review_token = p_token
  GROUP BY c.id, ags.agency_name, ags.logo_url, ags.branding_agency_sidebar, ags.branding_powered_by;
$$;
```

> `NEEDS_REVISION` posts are intentionally excluded. Once a client requests revisions, the post is back with the agency. The client has nothing further to do until the agency creates a new version and re-submits to `PENDING_APPROVAL`.

### 3.2 API Layer (`src/api/campaigns.js`)

Add to existing `campaigns.js`:

```javascript
// Read hook — unauthenticated, token from URL param
export function useCampaignReview(token) {
  return useQuery({
    queryKey: ['campaigns', 'review', token],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_campaign_by_review_token', {
        p_token: token,
      })
      if (error) throw error
      return data?.[0] ?? null  // null = invalid token
    },
    enabled: !!token,
    staleTime: 0,  // always fresh — client reviews in real time
    retry: 1,
  })
}

// Plain async — called per post in CampaignReview action handlers
// postReviewToken = post_versions.review_token (from RPC posts array, NOT campaign.review_token)
export async function submitCampaignPostReview(postReviewToken, status, feedback) {
  const { error } = await supabase.rpc('update_post_status_by_token', {
    p_token: postReviewToken,
    p_status: status,
    p_feedback: feedback,
  })
  if (error) throw error
}
```

### 3.3 New Public Route (`src/App.jsx`)

```jsx
// Add alongside /review/:token — both are outside the session guard
<Route path="/campaign-review/:token" element={<CampaignReview />} />
```

Import: `import CampaignReview from '@/pages/campaigns/CampaignReview'`

### 3.4 `CampaignReview.jsx` — Full Spec

**File**: `src/pages/campaigns/CampaignReview.jsx`
**Auth**: None — fully public, no session required

#### Local state

```javascript
const [selectedPostId, setSelectedPostId] = useState(null)  // post shown in main panel
const [approvedIds, setApprovedIds] = useState(new Set())   // posts actioned as SCHEDULED
const [revisedIds, setRevisedIds] = useState(new Set())     // posts actioned as NEEDS_REVISION
const [feedback, setFeedback] = useState('')                 // revision textarea value
const [isSubmitting, setIsSubmitting] = useState(false)      // blocks double-submit

const actionedIds = useMemo(
  () => new Set([...approvedIds, ...revisedIds]),
  [approvedIds, revisedIds]
)
```

On data load: `useEffect` → set `selectedPostId` to `posts[0]?.post_id`.
After each action: clear `feedback`, advance `selectedPostId` to next un-actioned post (or null if all done → triggers completion screen).

#### Branding (exact PublicReview.jsx pattern — lines 141–144)

```javascript
const showAgencyBranding = data?.branding_agency_sidebar ?? false
const showPoweredBy = data?.branding_powered_by ?? true
```

- `showAgencyBranding` true + `logo_url` set → agency logo `<img>` + `agency_name` text
- `showAgencyBranding` true + no `logo_url` → `agency_name` text only, no image
- `showAgencyBranding` false → Tercero logo (SVG mask with `/TerceroLand.svg`, same as PublicReview)

#### Page states — all must be handled

| State | Trigger | UI |
|---|---|---|
| **Loading** | `isLoading` true | Full-page skeleton: header bar + two-column layout skeleton |
| **Fetch error** | `isError` true (network/RPC failure) | Centred: alert triangle icon + "Something went wrong. Please try refreshing." + Refresh button (`window.location.reload()`) |
| **Invalid token** | `!isLoading && !isError && !data` | Centred: lock icon + "This link is not valid or has expired." No retry |
| **No reviewable posts** | `data && posts.length === 0` | Centred: clock icon + "Nothing to review right now." + "Check back once your agency submits content for approval." |
| **Review active** | `posts.length > 0 && actionedIds.size < posts.length` | Two-panel layout |
| **All actioned** | `posts.length > 0 && actionedIds.size === posts.length` | Completion screen |

#### Layout structure

```
┌──────────────────────────────────────────────────────────────────┐
│  [Logo]  Campaign Name  ·  goal (if set)  ·  "X of Y reviewed"  │  ← header
├─────────────────────────┬────────────────────────────────────────┤
│  LEFT PANEL (w-72)      │  MAIN PANEL (flex-1)                   │
│  border-r, scrollable   │  scrollable                            │
│                         │                                        │
│  Post row × N           │  Title (or "Untitled")                 │
│  ─ thumbnail            │  Platform badges                       │
│  ─ title (truncated)    │  Target date (hidden if null)          │
│  ─ target date (small)  │  Content text (hidden if empty)        │
│  ─ status dot           │  Media gallery (hidden if empty)       │
│                         │  ─────────────────────────────         │
│                         │  Feedback textarea                     │
│                         │  [Request Revisions] [Approve ✓]       │
├─────────────────────────┴────────────────────────────────────────┤
│  Powered by Tercero  (hidden when branding_powered_by = false)   │
└──────────────────────────────────────────────────────────────────┘
```

#### Left panel — post row spec

Each row renders:
- **Thumbnail** (40×40 rounded): `media_urls[0]` present + image → `<img>`; video extension → dark bg + `Play` icon; no media → muted grey square
- **Title**: truncated single line, `text-sm font-medium`
- **Target date**: `format(parseISO(target_date), 'MMM d')` in `text-xs text-muted-foreground`; hidden if `null`
- **Status dot** (right-aligned):
  - `approvedIds.has(post_id)` → `CheckCircle2` filled emerald
  - `revisedIds.has(post_id)` → `RefreshCw` filled amber
  - Neither → `Circle` muted-foreground ring (pending)
- **Selected state**: `bg-muted/60` background + left accent border

#### Main panel — content spec

- **Title**: `post.title?.trim() || 'Untitled'`
- **Platforms**: icon image per platform; if `platform` array empty → `<span className="text-xs text-muted-foreground">No platforms specified</span>`
- **Target date**: `Calendar` icon + `format(parseISO(target_date), 'MMM d, yyyy')` — **entire section hidden if `target_date` is null**
- **Content**: pre-wrap text block — **entire section hidden if `content` is null or empty after trim**
- **Media gallery** — **entire section hidden if `media_urls` is empty or null**:
  - 1 item → full width
  - 2–4 items → 2-column grid
  - >4 items → first 4 shown, 4th has `"+ N more"` overlay
  - Video (`.mp4`, `.mov`, `.webm`) → dark `bg-black/90` container with centred `Play` icon (no autoplay)
  - Broken image → `onError` hides `<img>`, shows grey `bg-muted` placeholder of same dimensions
- **Post with `review_token: null`**: entire action area replaced with muted message "This post cannot be actioned — contact your agency." Both buttons hidden.

#### Main panel — action area

```
┌──────────────────────────────────────────────────────────┐
│  Textarea                                                │
│  placeholder: "Describe what needs to change…"          │
│  rows=3                                                  │
└──────────────────────────────────────────────────────────┘
[Request Revisions]                    [Approve This Post ✓]
 variant="outline"                      variant="default"
 disabled when:                         disabled when:
   feedback.trim() === ''                 isSubmitting
   isSubmitting
```

- Feedback is **required** for Request Revisions (button disabled when empty — no separate error message needed)
- Feedback is **optional** for Approve (empty string `''` sent to RPC — matches PublicReview)
- Clear feedback after every successful action

#### Action handlers

```javascript
async function handleApprove() {
  if (isSubmitting || !selectedPost?.review_token) return
  setIsSubmitting(true)
  try {
    await submitCampaignPostReview(selectedPost.review_token, 'SCHEDULED', '')
    setApprovedIds(prev => new Set([...prev, selectedPost.post_id]))
    setFeedback('')
    advanceSelection()
  } catch {
    toast.error('Failed to submit — please try again')
  } finally {
    setIsSubmitting(false)
  }
}

async function handleRequestRevisions() {
  const trimmed = feedback.trim()
  if (isSubmitting || !trimmed || !selectedPost?.review_token) return
  setIsSubmitting(true)
  try {
    await submitCampaignPostReview(selectedPost.review_token, 'NEEDS_REVISION', trimmed)
    setRevisedIds(prev => new Set([...prev, selectedPost.post_id]))
    setFeedback('')
    advanceSelection()
  } catch {
    toast.error('Failed to submit — please try again')
  } finally {
    setIsSubmitting(false)
  }
}

function advanceSelection() {
  const currentId = selectedPostId
  const next = posts.find(p =>
    p.post_id !== currentId &&
    !approvedIds.has(p.post_id) &&
    !revisedIds.has(p.post_id)
  )
  setSelectedPostId(next?.post_id ?? null)
  // null → actionedIds.size === posts.length on next render → completion screen
}
```

#### Completion screen

```
[Large CheckCircle2 icon, emerald]
"All posts reviewed"
"Your feedback has been sent to the agency."
```

No navigation button. If client refreshes: RPC returns `posts = []` (posts are now `SCHEDULED`/`NEEDS_REVISION`) → "Nothing to review" state renders — this is correct and expected.

#### Progress indicator

```javascript
const total = posts.length          // fixed at page load
const reviewed = actionedIds.size   // grows with each action
// Displays: "2 of 6 posts reviewed"
```

`total` does not refetch during the session — keeps the indicator stable as the client works through the list.

### 3.5 Campaign Detail — Share Review Link

On `CampaignDetailPage.jsx`, add "Share Review Link" button in the header actions (between Export PDF and Edit).

```javascript
// postsData already loaded via useGlobalPosts({ campaignId })
const hasPendingPosts = postsData?.some(p => p.status === 'PENDING_APPROVAL') ?? false
const canShare = hasPendingPosts && !!campaign?.review_token
// campaign.review_token is included in useCampaign() (selects * from campaigns)

const [shareDialogOpen, setShareDialogOpen] = useState(false)
const [shareDialogUrl, setShareDialogUrl] = useState('')

async function handleShareLink() {
  const url = `${window.location.origin}/campaign-review/${campaign.review_token}`
  try {
    await navigator.clipboard.writeText(url)
    toast.success('Review link copied to clipboard')
  } catch {
    // Clipboard API unavailable (non-HTTPS, permission denied by browser)
    setShareDialogUrl(url)
    setShareDialogOpen(true)
  }
}
```

**Clipboard fallback Dialog** (renders only on clipboard failure):
```jsx
<Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Campaign Review Link</DialogTitle>
      <DialogDescription>Copy this link and share it with your client.</DialogDescription>
    </DialogHeader>
    <Input value={shareDialogUrl} readOnly onClick={e => e.target.select()} />
  </DialogContent>
</Dialog>
```

Button only rendered when `canShare` is true — hidden when:
- No `PENDING_APPROVAL` posts in campaign
- `campaign.review_token` is null (pre-migration row safety)

### 3.6 Error Handling Reference

| Scenario | Location | Handling |
|---|---|---|
| Invalid / expired token | CampaignReview | Lock icon + "This link is not valid or has expired." — no retry button |
| Network failure on page load | CampaignReview | Alert icon + "Something went wrong. Please try refreshing." + `window.location.reload()` button |
| RPC returns unexpected shape / no rows | CampaignReview | Treat same as invalid token (`!data` → invalid state) |
| `update_post_status_by_token` fails | CampaignReview | `toast.error('Failed to submit — please try again')` + post stays in list + `isSubmitting` cleared to false |
| Post has `review_token: null` | CampaignReview main panel | Action area replaced with muted message "This post cannot be actioned — contact your agency." |
| Clipboard write fails | CampaignDetailPage | Open Dialog with read-only Input containing the URL |
| `campaign.review_token` null | CampaignDetailPage | Share button not rendered (`canShare` guard) |
| Empty `campaign_name` from RPC | CampaignReview header | Fallback to "Campaign Review" |
| `goal` null or empty | CampaignReview header | Goal line hidden entirely |
| Post `title` null or empty | CampaignReview main panel | Show "Untitled" |
| Post `content` null or empty | CampaignReview main panel | Content section hidden |
| Post `target_date` null | CampaignReview list row + main panel | Date hidden in both locations |
| Post `platform[]` empty | CampaignReview main panel | Show "No platforms specified" in muted text |
| Post `media_urls` empty | CampaignReview main panel | Media section hidden entirely |
| Broken image URL | CampaignReview media gallery | `onError` → hide `<img>`, show grey `bg-muted` placeholder square |
| Video media | CampaignReview media gallery | Dark bg + centred `Play` icon — no autoplay, no controls |
| Client refreshes mid-session | CampaignReview | Actioned posts now SCHEDULED/NEEDS_REVISION → excluded from RPC → "Nothing to review" — correct behaviour |

### 3.7 Phase 3 Checklist

**Database**

- [ ] `campaigns.review_token` UUID column added (`DEFAULT gen_random_uuid() UNIQUE`)
- [ ] Existing rows populated: `UPDATE campaigns SET review_token = gen_random_uuid() WHERE review_token IS NULL`
- [ ] `get_campaign_by_review_token` RPC created — returns `branding_agency_sidebar` + `branding_powered_by` + `PENDING_APPROVAL` posts only

**API (`src/api/campaigns.js`)**

- [ ] `useCampaignReview(token)` hook — query key `['campaigns', 'review', token]`, `staleTime: 0`, `enabled: !!token`, returns `null` for invalid token
- [ ] `submitCampaignPostReview(postReviewToken, status, feedback)` plain async function — calls `update_post_status_by_token`

**`App.jsx`**

- [ ] `/campaign-review/:token` public route added alongside `/review/:token` (outside session guard)

**`CampaignReview.jsx` (`src/pages/campaigns/CampaignReview.jsx`)**

- [ ] Loading state: full-page skeleton (header bar + two-column)
- [ ] Fetch error state: alert icon + message + Refresh button
- [ ] Invalid token state: lock icon + "This link is not valid or has expired"
- [ ] No reviewable posts state: clock icon + "Nothing to review right now"
- [ ] Completion screen: emerald `CheckCircle2` + "All posts reviewed"
- [ ] Two-panel layout when `posts.length > 0 && actionedIds.size < posts.length`
- [ ] Branding: `branding_agency_sidebar` → agency logo+name or Tercero SVG fallback
- [ ] `branding_powered_by` → "Powered by Tercero" footer (defaults `true`)
- [ ] Header: campaign name (fallback "Campaign Review"), goal (hidden if empty), progress
- [ ] Progress: "X of Y posts reviewed" — Y fixed at load time
- [ ] Left panel: post rows with thumbnail, title, date (hidden if null), status dot
- [ ] Status dot: emerald check (approved) / amber refresh (revised) / grey ring (pending)
- [ ] First post auto-selected on data load
- [ ] Clicking a left panel row updates main panel selection
- [ ] Main panel: title fallback "Untitled"
- [ ] Main panel: content section hidden when null/empty
- [ ] Main panel: target date hidden when null
- [ ] Main panel: `platform[]` empty → "No platforms specified"
- [ ] Main panel: media hidden when empty; images in grid; video shows `Play` icon
- [ ] Main panel: broken image `onError` → grey `bg-muted` placeholder
- [ ] Main panel: `review_token: null` post → action area replaced with message
- [ ] Feedback textarea clears after each action
- [ ] "Request Revisions" disabled when `feedback.trim() === ''` or `isSubmitting`
- [ ] "Approve" disabled when `isSubmitting`
- [ ] Approve → `submitCampaignPostReview(post.review_token, 'SCHEDULED', '')`
- [ ] Request Revisions → `submitCampaignPostReview(post.review_token, 'NEEDS_REVISION', trimmedFeedback)`
- [ ] RPC failure → `toast.error` + post stays in list + `isSubmitting` reset
- [ ] After action: auto-advance to next un-actioned post
- [ ] After all actioned: completion screen

**`CampaignDetailPage.jsx` — Share Review Link**

- [ ] "Share Review Link" button in header actions
- [ ] Button hidden when no `PENDING_APPROVAL` posts (via `postsData` filter)
- [ ] Button hidden when `campaign.review_token` is null
- [ ] Clipboard success → `toast.success('Review link copied to clipboard')`
- [ ] Clipboard failure → Dialog with read-only Input + click-to-select behaviour

**Phase 3 Unit Tests (`src/tests/campaigns/phase3.test.jsx`)**

- [ ] Group A — Token RPC: hook returns correct shape; returns `null` for bad token; posts array contains only `PENDING_APPROVAL` posts
- [ ] Group B — Page states: loading skeleton renders; fetch error shows refresh button; invalid token message shown; "nothing to review" when `posts = []`; two-panel when posts present; completion screen when `actionedIds.size === posts.length`
- [ ] Group C — Per-post actions: approve sends `'SCHEDULED'` with empty feedback; revisions sends `'NEEDS_REVISION'` with trimmed feedback; revisions button disabled when feedback empty; both disabled while `isSubmitting`; RPC failure → `toast.error` + post kept in list
- [ ] Group D — Progress + auto-advance: progress "1 of N" after first action; auto-advances to next un-actioned post; completion screen triggers after last action
- [ ] Group E — Branding: agency logo shown when `branding_agency_sidebar=true` + `logo_url` set; name-only when no `logo_url`; Tercero SVG when `branding_agency_sidebar=false`; footer hidden when `branding_powered_by=false`
- [ ] Group F — Share button: shown when `PENDING_APPROVAL` posts exist; hidden when none; hidden when `review_token` null; copies correct URL; clipboard failure opens Dialog with URL

```bash
npx vitest run src/tests/campaigns/phase3.test.jsx
```

**→ Stop. Write Phase 3 unit tests (groups A–F above). All tests must pass before the feature is declared complete.**

---

## Data Model Summary (Final State)

```
Agency (user_id)
├── agency_subscriptions
│   └── campaigns: boolean   ← Velocity+
└── Clients
    ├── Campaigns
    │   ├── name, goal, description, status
    │   ├── start_date, end_date
    │   ├── budget               (Phase 2)
    │   ├── review_token         (Phase 3)
    │   └── Posts (via posts.campaign_id)
    │       └── Post Versions
    ├── Posts (campaign_id = null — existing behaviour unchanged)
    └── Invoices (campaign_id optional — Phase 2)
```

### `campaigns` — Final Schema

| Column         | Type          | Phase | Notes                         |
| -------------- | ------------- | ----- | ----------------------------- |
| `id`           | UUID          | 1     | PK                            |
| `user_id`      | UUID          | 1     | RLS, FK → auth.users          |
| `client_id`    | UUID          | 1     | FK → clients (CASCADE)        |
| `name`         | TEXT          | 1     | Required                      |
| `goal`         | TEXT          | 1     | Optional                      |
| `description`  | TEXT          | 1     | Optional                      |
| `status`       | TEXT          | 1     | Active / Completed / Archived |
| `start_date`   | DATE          | 1     | Optional                      |
| `end_date`     | DATE          | 1     | Optional                      |
| `budget`       | NUMERIC(12,2) | 2     | Optional                      |
| `review_token` | UUID          | 3     | Unique, auto-generated        |
| `created_at`   | TIMESTAMPTZ   | 1     | Auto                          |
| `updated_at`   | TIMESTAMPTZ   | 1     | Auto                          |

---

## Test-Driven Development Summary

| Phase   | File                                 | Groups                                                                  | Gate                        |
| ------- | ------------------------------------ | ----------------------------------------------------------------------- | --------------------------- |
| Phase 1 | `src/tests/campaigns/phase1.test.js` | A API, B Gating, C Dialog, D Card, E Prompt, F Page                     | All pass → Phase 2 unlocked |
| Phase 2 | `src/tests/campaigns/phase2.test.js` | A RPC shape, B On-time calc, C Budget, D Detail page, E PDF, F Invoice  | All pass → Phase 3 unlocked |
| Phase 3 | `src/tests/campaigns/phase3.test.js` | A Token, B Page states, C Actions, D Progress, E Branding, F Share link | All pass → feature complete |

---

## Out of Scope (All Phases)

- Cross-client campaigns — always client-scoped
- Campaign templates — deferred; needs real usage data
- Gantt / timeline visualisation — significant new component; future
- Multi-user team assignment — requires multi-user feature first
- Automated status transitions (auto-complete on end date) — requires background job
- Campaign ordering / drag reorder — future
- Campaign duplication — future
- Campaign-level comment threads — future
- Campaign filter on Calendar page — deferred
