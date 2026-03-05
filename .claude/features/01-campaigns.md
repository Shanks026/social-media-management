# Feature: Campaigns
**Product**: Tercero — Social Media Agency Management SaaS  
**Feature Folder**: `.claude/features/`  
**Status**: Planned  
**Phase 1**: Campaign grouping layer (MVP)  
**Phase 2**: Campaign analytics, budgets, approvals  

---

## 1. What Is This Feature?

A **Campaign** is a named, time-bounded, goal-driven container that groups multiple posts under a single strategic initiative. It sits one level above individual posts in the content hierarchy.

### Current Hierarchy (without campaigns):
```
Client
└── Posts (flat list)
```

### Proposed Hierarchy (with campaigns):
```
Client
└── Campaign (e.g., "Q2 Product Launch")
    └── Posts (grouped under this campaign)
```

Campaigns are how agencies actually think about their work. An agency doesn't say "we have 12 posts for Nova Corps this month" — they say "we're running a recruitment drive campaign for Nova Corps in March." The feature makes Tercero's language match the agency's language.

---

## 2. Phase 1 — Campaign Grouping Layer (MVP)

### 2.1 Scope

Phase 1 is intentionally minimal. The goal is to introduce the campaign concept without a full rebuild of the posts system. A campaign in Phase 1 is a **grouping record** that posts can optionally be associated with.

### 2.2 What Gets Built

#### Campaign Record
A new database table `campaigns` with the following fields:
- Campaign name (required)
- Client (required — FK to `clients`)
- Goal / objective (short text — e.g., "Drive 500 sign-ups", "Launch new product line")
- Status: `Active`, `Completed`, `Archived`
- Start date
- End date
- Description / brief (optional long text)
- Created at / Updated at

#### Post Association
- Add a nullable `campaign_id` FK column to `posts` table
- Posts without a campaign_id remain unaffected (backward compatible)
- When creating or editing a post, a "Campaign" dropdown appears — optional, shows active campaigns for that client

#### Campaign List View (`/clients/:clientId/campaigns`)
- Listed under each client's detail page as a new tab: **Campaigns**
- Card layout per campaign showing:
  - Campaign name and status badge
  - Date range
  - Goal text
  - Post count breakdown by status (Drafts · Pending · Revisions · Scheduled · Published)
  - Progress indicator (% of posts published vs total)
- "New Campaign" button

#### Campaign Detail View (`/clients/:clientId/campaigns/:campaignId`)
- Campaign header: name, goal, date range, status, description
- Filtered posts list — shows only posts associated with this campaign
- Same post card/table view as global posts page but scoped to this campaign
- "Add Existing Post to Campaign" action
- "Create New Post for this Campaign" shortcut (pre-fills campaign_id)

#### Dashboard Integration
- On the main Dashboard's **Workflow Health** widget — add a secondary row showing active campaigns count per client
- On **Client Health Grid** — show campaign name if a client has an active campaign

#### Global Posts Page Integration
- Add a "Campaign" column/filter to the global Posts page
- Filter by campaign across all clients

### 2.3 UI Placement

Based on the existing app screens:

| Location | Change |
|----------|--------|
| Client Detail page | New "Campaigns" tab alongside Overview / Workflow / Financials / Calendar / Settings |
| Post creation/edit form | New optional "Campaign" dropdown field |
| Global Posts page (`/posts`) | New campaign filter in filter bar |
| Dashboard Workflow Health widget | Campaign count row per client |
| Sidebar under each client | Optional: campaign quick-link |

### 2.4 Phase 1 Explicitly Out of Scope
- Campaign-level budgets
- Campaign analytics / reporting
- Campaign-level approval workflows (separate from post-level)
- Campaign templates
- Cross-client campaigns
- Campaign calendar view (handled by existing calendar with campaign filter)

---

## 3. Phase 2 — Campaign Analytics & Advanced Features

### 3.1 Campaign Analytics Dashboard
Per-campaign reporting view:
- Total posts published vs planned
- On-time delivery rate (posts published on/before target date)
- Platform distribution of posts in this campaign
- Timeline visualization (Gantt-style — posts plotted across campaign date range)
- Client approval turnaround time (avg days from PENDING to SCHEDULED per campaign)

### 3.2 Campaign Budget Tracking
- Add `budget` (numeric) field to campaigns table
- Add `campaign_id` linkage to invoices — optionally tag an invoice as belonging to a campaign
- Campaign detail shows: Budgeted vs Invoiced vs Collected
- Finance overview can filter by campaign

### 3.3 Campaign Templates
- Save a campaign structure as a template (name, goal, post count, platform mix)
- "Start from template" when creating a new campaign
- Useful for recurring campaign types (monthly newsletter push, quarterly product launch)

### 3.4 Campaign-Level Approval / Review Link
- Generate a single Public Review link for an entire campaign (all posts in one page)
- Client can review all campaign posts sequentially without separate links per post
- Batch approve or request revisions per post from one page

### 3.5 Campaign Status Automation
- Auto-set campaign status to `Completed` when end date passes and all posts are Published or Archived
- Alert on Dashboard if a campaign has posts stuck in DRAFT/PENDING past the campaign end date

---

## 4. Database Analysis

### 4.1 New Table: `campaigns`

```sql
CREATE TABLE campaigns (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id       UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  goal            TEXT,
  description     TEXT,
  status          TEXT NOT NULL DEFAULT 'Active' 
                    CHECK (status IN ('Active', 'Completed', 'Archived')),
  start_date      DATE,
  end_date        DATE,
  budget          NUMERIC(12, 2),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own campaigns"
  ON campaigns FOR ALL
  USING (user_id = auth.uid());
```

### 4.2 Modified Table: `posts`

```sql
-- Add campaign association (nullable — backward compatible)
ALTER TABLE posts 
ADD COLUMN campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL;

CREATE INDEX idx_posts_campaign_id ON posts(campaign_id);
```

### 4.3 New RPC: `get_campaign_with_post_summary`

```sql
-- Returns campaign record + post counts by status for the campaign detail view
-- Similar pattern to existing get_clients_with_pipeline RPC
```

### 4.4 Relationship Map

```
auth.users
└── campaigns (user_id FK)
    └── posts.campaign_id FK (nullable)

clients
└── campaigns (client_id FK)
    └── posts (client_id FK, campaign_id FK nullable)
```

### 4.5 Impact on Existing Tables

| Table | Change | Risk |
|-------|--------|------|
| `posts` | Add nullable `campaign_id` column | Zero — all existing posts have NULL campaign_id, no existing queries break |
| `post_versions` | No change needed | None |
| `clients` | No change | None |
| `invoices` | Phase 2: add nullable `campaign_id` | Low |

---

## 5. Impact Analysis

### 5.1 Positive Impact on Existing Features

**Posts Page (`/posts`)**
- Gains a new filter dimension — users can now slice their content by campaign
- Post cards can display a campaign badge — makes the purpose of each post clearer at a glance

**Client Detail Page**
- The Workflow tab becomes more organized — posts can be viewed flat (current behavior) or grouped by campaign
- Client health becomes richer — "4 posts across 2 active campaigns" vs "4 posts"

**Calendar (`/calendar`)**
- Campaign filter added to the filter bar — show only posts for a specific campaign
- Color-coding by campaign (instead of or in addition to status) is a Phase 2 option

**Dashboard**
- Workflow Health widget gains meaningful context — not just post count but campaign count and health
- "2 posts require immediate revision" becomes "Campaign: Q2 Launch — 2 posts require revision"

**Public Review Link**
- In Phase 2, campaign-level review links make client approvals dramatically faster for multi-post campaigns

**Finance**
- In Phase 2, campaign-budget linkage allows per-campaign profitability tracking — a genuinely powerful feature for agencies that scope work per campaign

### 5.2 Negative / Risk Considerations

**Added complexity for small agencies**
- Agencies with 1-2 clients and simple workflows may find campaigns to be overhead
- Mitigation: Campaigns are fully optional — posts without a campaign work exactly as before

**Data model dependency**
- If campaigns are built without careful CASCADE rules, deleting a campaign could affect post history
- Mitigation: `ON DELETE SET NULL` on posts.campaign_id — deleting a campaign orphans posts safely back to uncampaigned state, not deleted

**UI surface area**
- Adding a Campaigns tab to the Client Detail page (which already has 5 tabs) increases cognitive load
- Mitigation: Only show the Campaigns tab if the client has at least one campaign created

**Filter proliferation on Posts page**
- The global posts page already has 6 filter dimensions — adding campaign adds a 7th
- Mitigation: Campaign filter can be collapsed or placed in an "Advanced Filters" section

---

## 6. Correlation with Existing Features

| Existing Feature | Relationship to Campaigns |
|-----------------|--------------------------|
| Posts & Post Versioning | Posts are the children of campaigns. Version history is unaffected. |
| Content Calendar | Calendar gains campaign filter. Posts display campaign tag on hover/detail. |
| Public Review Link | Phase 2: campaign-level review link wraps multiple post review links |
| Client Detail — Workflow Tab | Campaigns tab sits alongside Workflow. Workflow can optionally group by campaign. |
| Finance — Invoices | Phase 2: invoices can be tagged to a campaign for budget tracking |
| Dashboard — Workflow Health | Shows active campaign count and health per client |
| Client Health Grid | Urgency indicators remain post-level; campaign adds context label |

---

## 7. File & Component Structure (Suggested)

```
src/
├── api/
│   └── campaigns.js              — CRUD + get_campaign_with_post_summary RPC
├── pages/
│   └── campaigns/
│       ├── CampaignList.jsx      — Tab content inside Client Detail
│       └── CampaignDetail.jsx    — Campaign header + filtered posts list
├── components/
│   └── campaigns/
│       ├── CampaignCard.jsx      — Card used in CampaignList
│       ├── CampaignForm.jsx      — Create/Edit dialog
│       └── CampaignBadge.jsx     — Small badge shown on post cards
```

---

## 8. Landing Page Relevance

**Hero/Features copy angle:**
> *"Run campaigns, not just posts. Group every piece of content under a named initiative — see what's on track, what's stuck, and what's due — per campaign, per client."*

**Differentiator vs. competitors:**
Most social scheduling tools (Buffer, Later, Hootsuite) don't have a campaign grouping concept. Agency-specific tools that do (like Sprout Social) are priced at enterprise level. This positions Tercero as the agency-grade tool at a boutique price point.
