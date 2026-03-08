# Feature: Campaigns

**Product**: Tercero — Social Media Agency Management SaaS  
**File**: `.claude/features/01-campaigns.md`  
**Status**: Planned — Phase 1 ready to build  
**Last Updated**: March 2026

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
Phase 1 — Campaign CRUD + Post Association
  Campaigns can be created, edited, and archived per client.
  Posts can be linked to a campaign. Campaign progress is visible.
  Subscription scoping: Velocity+ only (Ignite gets locked state).
  → Unit tests written. All must pass before Phase 2 begins.

Phase 2 — Campaign Analytics & Budget Tracking
  Per-campaign analytics: on-time rate, platform mix, approval turnaround.
  Budget field + invoice linking. Campaign PDF report.
  → Unit tests written. All must pass before Phase 3 begins.

Phase 3 — Campaign-Level Client Approval Link
  Single public URL for a client to review all posts in a campaign.
  Client reviews posts sequentially, approves or requests revisions per post.
  → Unit tests written at completion.
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

1. **`src/components/sidebar/app-sidebar.jsx`** — confirm the exact structure of `navMain` and how existing items (especially Documents) are added, to insert Campaigns top-level between Clients and Content using the identical pattern.
2. **`src/pages/clients/ClientDetails.jsx`** — confirm the exact current tab values and how `TabsTrigger` / `TabsContent` pairs are structured.
3. **`src/api/posts.js`** — confirm `createDraftPost()` and `updatePost()` signatures to add `campaign_id` correctly without breaking existing callers.
4. **`src/pages/posts/DraftPostForm.jsx`** — confirm form field layout and where the campaign selector should sit relative to existing fields.
5. **`src/api/useSubscription.js`** — confirm the exact shape of the `can` object before extending it.

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
    COUNT(p.id) FILTER (WHERE pv.status = 'PENDING')                     AS pending_count,
    COUNT(p.id) FILTER (WHERE pv.status = 'REVISIONS')                   AS revision_count,
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

- [ ] `campaigns` table created with all columns, indexes, RLS
- [ ] `posts.campaign_id` nullable FK added (ON DELETE SET NULL)
- [ ] `get_campaigns_with_post_summary` RPC created and returns correct counts
- [ ] `create_post_draft_v3` RPC updated to accept and write `p_campaign_id`
- [ ] `agency_subscriptions.campaigns` column added and seeded per plan

**API**

- [ ] `src/api/campaigns.js` created with all hooks and mutation functions
- [ ] `useCampaigns({ clientId })` works with and without clientId
- [ ] `fetchActiveCampaignsByClient` returns only Active campaigns
- [ ] `createDraftPost` and `updatePost` pass `campaign_id` correctly
- [ ] `useSubscription().can.campaigns()` returns correct value per plan

**Components**

- [ ] `CampaignCard` renders for Active, Completed, Archived states
- [ ] Progress bar shows `published_count / total_posts` (hidden when total = 0)
- [ ] `CampaignDialog` create saves + list refreshes
- [ ] `CampaignDialog` edit pre-populates all fields
- [ ] End date < start date shows validation error
- [ ] Delete fires `AlertDialog` — posts NOT deleted (verify in DB)
- [ ] `CampaignUpgradePrompt` renders for Ignite/Trial
- [ ] Loading: skeleton cards (not spinner)

**Post Integration**

- [ ] Campaign dropdown appears when active campaigns exist for the client
- [ ] Campaign dropdown absent when no active campaigns exist
- [ ] Selecting a campaign saves `campaign_id` correctly
- [ ] Clearing saves `null` correctly
- [ ] Edit mode pre-selects correct campaign
- [ ] Global Posts page shows campaign badge on tagged posts
- [ ] Campaign filter on Posts page narrows the list correctly

**Routing & Nav**

- [ ] `/campaigns` route renders `CampaignsPage`
- [ ] Campaigns nav item appears top-level between Clients and Content
- [ ] Nav item shows lock icon on Ignite
- [ ] Ignite: clicking nav navigates → shows upgrade prompt (no crash)
- [ ] Client Detail Campaigns tab renders and scopes to `clientId`
- [ ] Client Detail Campaigns tab shows upgrade prompt for Ignite

**→ Stop here. Write Phase 1 unit tests (section 1.10). Wait for all tests to pass before Phase 2.**

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

- [ ] `campaigns.budget` column added
- [ ] `invoices.campaign_id` column added
- [ ] `get_campaign_analytics` RPC returns correct values
- [ ] `/campaigns/:campaignId` route renders `CampaignDetailPage`
- [ ] Clicking a `CampaignCard` navigates to detail page
- [ ] KPI bar shows correct values
- [ ] On-time rate handles division by zero (shows "—" not NaN)
- [ ] Platform distribution chart renders
- [ ] Post list renders in `target_date` order
- [ ] Budget section hidden when budget is null
- [ ] Linked invoices shows invoices with matching `campaign_id`
- [ ] Campaign PDF generates and downloads correctly
- [ ] Invoice create/edit: campaign dropdown appears for Velocity+
- [ ] Invoice `campaign_id` saves correctly

**→ Stop. Write Phase 2 unit tests (section 2.5). Wait for all tests to pass before Phase 3.**

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

## Phase 3 — Campaign-Level Client Approval Link

### Goal

A single public URL lets a client review all posts in a campaign without logging in. The client steps through each post and approves or requests revisions in one session. This eliminates the need for multiple individual `/review/:token` links per campaign.

### Before Starting — Confirm Phase 2 Tests Passed

Read `src/pages/PublicReview.jsx` thoroughly. The campaign review page reuses the same unauthenticated token pattern and the existing `update_post_status_by_token` RPC per post.

### 3.1 Database

```sql
ALTER TABLE campaigns
ADD COLUMN review_token UUID DEFAULT gen_random_uuid() UNIQUE;

UPDATE campaigns SET review_token = gen_random_uuid() WHERE review_token IS NULL;
```

#### New RPC: `get_campaign_by_review_token`

```sql
CREATE OR REPLACE FUNCTION get_campaign_by_review_token(p_token UUID)
RETURNS TABLE (
  campaign_id         UUID,
  campaign_name       TEXT,
  goal                TEXT,
  agency_name         TEXT,
  logo_url            TEXT,
  branding_powered_by BOOLEAN,
  posts               JSONB
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT
    c.id,
    c.name,
    c.goal,
    ags.agency_name,
    ags.logo_url,
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
      ) FILTER (WHERE pv.status IN ('PENDING', 'REVISIONS')),
      '[]'::jsonb
    )
  FROM campaigns c
  JOIN agency_subscriptions ags ON ags.user_id = c.user_id
  LEFT JOIN posts p ON p.campaign_id = c.id
  LEFT JOIN post_versions pv ON pv.id = p.current_version_id
  WHERE c.review_token = p_token
  GROUP BY c.id, ags.agency_name, ags.logo_url, ags.branding_powered_by;
$$;
```

### 3.2 New Public Route

```jsx
<Route path="/campaign-review/:token" element={<CampaignReview />} />
```

**`CampaignReview.jsx`** — fully unauthenticated:

```
Header: [Agency logo or Tercero logo per branding tier]
Campaign name + goal
Progress: "2 of 6 posts reviewed"
─────────────────────────────────────────────────────
Left panel (scrollable):
  Post rows — title, platform badges, status dot (pending/approved/revised)

Main panel:
  Selected post — title, content, media gallery, platform preview
  Feedback textarea (optional for Approve, required for Request Revisions)
  [Request Revisions]   [Approve This Post ✓]

Footer: "Powered by Tercero" (hidden on Quantum)
```

**States**:

- Normal: post list + review panel
- No reviewable posts: "Nothing to review right now. Check back once new content is submitted for approval."
- All actioned (completion): "All posts reviewed — your agency has been notified."
- Invalid token: "This link is not valid or has expired." (404-style)

Per-post actions fire `update_post_status_by_token` (existing RPC, unchanged). Local state tracks which posts were actioned this session.

### 3.3 Campaign Detail — Share Review Link

On `CampaignDetailPage.jsx`, add "Share Review Link" button in the header actions:

- Copies `${window.location.origin}/campaign-review/${campaign.review_token}` to clipboard
- Toast: "Campaign review link copied"
- Only shown when campaign has posts in PENDING or REVISIONS status (otherwise the link leads to "Nothing to review")

### 3.4 Phase 3 Checklist

- [ ] `campaigns.review_token` column added, existing rows populated
- [ ] `get_campaign_by_review_token` RPC returns PENDING + REVISIONS posts only
- [ ] `/campaign-review/:token` route renders without auth
- [ ] Agency branding follows same tier rules as `/review/:token`
- [ ] "Powered by Tercero" footer follows `branding_powered_by` flag
- [ ] Post list sidebar renders; selecting a row shows post in main panel
- [ ] Approve fires `update_post_status_by_token` → SCHEDULED
- [ ] Request Revisions fires with feedback text → REVISIONS
- [ ] Feedback required for Request Revisions (validation error if empty)
- [ ] Progress indicator updates after each action
- [ ] Completion screen shows when all posts actioned
- [ ] "Nothing to review" state when no PENDING/REVISIONS posts
- [ ] Invalid token shows error screen (no crash)
- [ ] "Share Review Link" button on Campaign Detail copies correct URL
- [ ] Share button absent when no PENDING/REVISIONS posts exist

**→ Stop. Write Phase 3 unit tests (section 3.5). Wait for all tests to pass — feature complete.**

### 3.5 Phase 3 Unit Tests

**Test file**: `src/tests/campaigns/phase3.test.js`

**Group A — Token lookup RPC**: mock returns correct data shape; returns empty posts array when no reviewable posts; returns null for invalid token.

**Group B — CampaignReview page states**: renders campaign name and goal; renders "Nothing to review" when posts array is empty; renders completion screen when all posts are locally marked actioned.

**Group C — Per-post actions**: Approve calls `update_post_status_by_token` with `SCHEDULED`; Request Revisions calls it with `REVISIONS` and feedback text; Request Revisions shows validation error when feedback is empty.

**Group D — Progress indicator**: shows "1 of 3 posts reviewed" after one action; shows "3 of 3" before completion screen triggers.

**Group E — Branding**: renders agency logo when `logo_url` set and `branding_agency_sidebar = true`; falls back to Tercero logo when `logo_url` is null; hides "Powered by Tercero" when `branding_powered_by = false`.

**Group F — Share review link**: copies correct URL to clipboard; button absent when no PENDING/REVISIONS posts.

```bash
npx vitest run src/tests/campaigns/phase3.test.js
```

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
