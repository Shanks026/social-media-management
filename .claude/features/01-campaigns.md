# Feature: Campaigns

**Status**: Phase 1 ✅ · Phase 2 ✅ · Phase 3 ✅ · Gaps ✅
**Last Updated**: March 8, 2026

---

## Phase Overview

```
Phase 1 — Campaign CRUD + Post Association ✅ COMPLETE
  Campaigns created/edited/archived per client. Posts linked to campaigns.
  Subscription gating: Velocity+ (flat sub?.campaigns boolean).

  Deviations from spec:
  - useSubscription uses flat `data?.campaigns` boolean (not `can.campaigns()` object)
  - CampaignDialog gained a client selector for the global /campaigns page
  - client_id added to Zod schema to prevent zodResolver stripping it
  - Campaign tab lives in ClientProfileView.jsx (not ClientDetails.jsx)
  - Nav icon: Megaphone (spec said FolderOpen)
  - AssignCampaignDialog (single post) + LinkPostsToCampaignDialog (bulk) both implemented
  - fetchUnlinkedPostsByClient() added (not in spec) — powers LinkPostsToCampaignDialog

Phase 2 — Campaign Analytics & Budget Tracking ✅ COMPLETE
  Per-campaign analytics: on-time rate, platform mix, approval turnaround.
  Budget field + invoice linking. Campaign PDF report.

  Deviations from spec:
  - Budget is read-only (from analytics RPC) — CampaignDialog has no budget edit field
  - Currency hardcoded to INR in CampaignDetailPage and CampaignReportPDF
  - avg_approval_days always returns NULL from RPC — KPI always shows "—"
  - Header fix (March 8, 2026): was calling useHeader() wrong in both campaign pages;
    corrected to useEffect + setHeader pattern

Phase 3 — Campaign-Level Client Approval Link ✅ COMPLETE
  Single public URL (/campaign-review/:token) for client to review all
  PENDING_APPROVAL posts in a campaign in one session.

  What was built:
  - campaigns.review_token UUID column (DEFAULT gen_random_uuid() UNIQUE)
  - get_campaign_by_review_token RPC (SECURITY DEFINER, LATERAL JOIN on share_tokens)
  - CampaignReview.jsx — fully public, 6 page states, two-panel layout
  - /campaign-review/:token public route in App.jsx
  - Share Review Link button on CampaignDetailPage (canShare guard)
  - Share dialog: always opens; URL with inline Copy button + Send Email to client
  - send-campaign-review-email edge function (deployed, CORS headers included)
  - useCampaign() extended to join clients ( id, name, email ) for email send

  Deviations from spec:
  - post_versions has NO review_token column — tokens live in share_tokens table.
    RPC uses LATERAL JOIN: LEFT JOIN LATERAL (SELECT token FROM share_tokens
    WHERE post_version_id = pv.id AND expires_at > now()
    ORDER BY created_at DESC LIMIT 1) st ON true
    and references st.token instead.
  - Share button always opens dialog (not clipboard-then-fallback).
    Dialog has: readonly URL + Copy button + Send Email section (client name/email + Mail button).
    Email invokes send-campaign-review-email edge function with
    { client_email, client_name, campaign_name, review_url }.
  - useCampaign() select changed from '*' to '*, clients ( id, name, email )'
    so campaign.clients.email / campaign.clients.name are available in the detail page.
```

---

## Known Gaps — All Resolved (March 8, 2026)

### Phase 1 Gaps ✅

- **Post ID inconsistency** ✅ — Simplified `AssignCampaignDialog` to use `post.id` directly. `useGlobalPosts` already normalises `id` and `actual_post_id` to the same value.

### Phase 2 Gaps ✅

- **Budget not editable in UI** ✅ — Added `budget` field (number input) to `CampaignDialog` schema + form. Payload includes `budget` on create/edit.
- **avg_approval_days always "—"** ✅ — Fixed `get_campaign_analytics` RPC: now computes `ROUND(AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 86400.0) FILTER (WHERE status IN ('SCHEDULED','PUBLISHED') AND updated_at > created_at), 1)`.
- **Currency hardcoded to INR** — Deferred; requires multi-currency system not yet in scope.
- **Detail page not gated at route level** ✅ — `CampaignDetailPage` now checks `sub?.campaigns` and renders `CampaignUpgradePrompt` for Trial/Ignite users.

### Phase 3 Gaps ✅

- **Email send not tracked** ✅ — Added `last_review_sent_at TIMESTAMPTZ` column to campaigns. `handleSendEmail` calls `markReviewSent.mutate(campaignId)` on success. Displayed in share dialog as "Last sent [date]".
- **review_token not regeneratable** ✅ — Added `useRegenerateCampaignReviewToken` mutation (updates `review_token` via `crypto.randomUUID()`). "Regenerate link" button in share dialog updates the URL in real time.
- **No shortcut to add client email** ✅ — When `clients.email` is null, share dialog shows an "Add email →" button that closes the dialog and navigates to the client profile page.

---

## Key Files

```
src/
├── api/
│   ├── campaigns.js
│   │   useCampaigns()             — list (RPC get_campaigns_with_post_summary)
│   │   useCampaign(id)            — detail (select *, clients(id,name,email))
│   │   useCampaignAnalytics(id)   — RPC get_campaign_analytics
│   │   useCampaignInvoices(id)    — invoices.campaign_id filter
│   │   useCampaignReview(token)   — public, staleTime:0, RPC get_campaign_by_review_token
│   │   submitCampaignPostReview() — calls update_post_status_by_token RPC
│   │   fetchActiveCampaignsByClient()  — plain async, for DraftPostForm
│   │   fetchUnlinkedPostsByClient()    — plain async, for LinkPostsToCampaignDialog
│   │   useCreateCampaign / useUpdateCampaign / useDeleteCampaign
│   │   useAssignPostsToCampaign / useUnlinkPostFromCampaign / useAssignPostCampaign
│   │   useRegenerateCampaignReviewToken() — updates review_token (crypto.randomUUID())
│   │   useMarkReviewSent()               — sets last_review_sent_at on campaigns
│   └── useGlobalPosts.js          — campaignId filter; status: v.status from post_versions
├── pages/
│   └── campaigns/
│       ├── CampaignsPage.jsx      — global list; sub?.campaigns gate
│       ├── CampaignDetailPage.jsx — analytics, posts, invoices, PDF, Share dialog
│       └── CampaignReview.jsx     — fully public; 6 states; two-panel review UX
├── components/
│   └── campaigns/
│       ├── CampaignTab.jsx            — reusable (global + client-scoped)
│       ├── CampaignCard.jsx           — status, progress, dropdown actions
│       ├── CampaignDialog.jsx         — create/edit (Zod validated)
│       ├── CampaignUpgradePrompt.jsx  — Ignite/Trial locked state
│       ├── AssignCampaignDialog.jsx   — single post → campaign
│       ├── LinkPostsToCampaignDialog.jsx — bulk unlinked posts → campaign
│       └── CampaignReportPDF.jsx      — @react-pdf/renderer report
└── tests/campaigns/
    ├── phase1.test.jsx
    ├── phase2.test.jsx
    └── phase3.test.jsx

supabase/functions/
└── send-campaign-review-email/index.ts  — Resend, CORS headers, verify_jwt: false
```

---

## Subscription Gating Matrix

| Entry Point | Ignite/Trial | Velocity/Quantum |
|---|---|---|
| Sidebar nav | Visible, lock icon | Clickable |
| `/campaigns` | `CampaignUpgradePrompt` | Full list |
| Client detail Campaigns tab | `CampaignUpgradePrompt` | Scoped list |
| Campaign dropdown in DraftPostForm | Not rendered | Shown when campaigns exist |
| Invoice campaign field | Not rendered | Shown in create/edit dialogs |
| `/campaigns/:campaignId` | **Not gated** (known gap) | Full analytics + PDF |

> Uses `sub?.campaigns` flat boolean everywhere — not `can.campaigns()` method pattern.

---

## Data Model (Final State)

### campaigns table

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `user_id` | UUID | RLS, FK → auth.users |
| `client_id` | UUID | FK → clients (CASCADE) |
| `name` | TEXT | Required |
| `goal` | TEXT | Optional |
| `description` | TEXT | Optional |
| `status` | TEXT | Active / Completed / Archived |
| `start_date` | DATE | Optional |
| `end_date` | DATE | Optional |
| `budget` | NUMERIC(12,2) | Optional — Phase 2; no UI edit yet |
| `review_token` | UUID | Unique, auto-generated — Phase 3 |
| `last_review_sent_at` | TIMESTAMPTZ | Set on each email send — Gaps fix |
| `created_at` | TIMESTAMPTZ | Auto |
| `updated_at` | TIMESTAMPTZ | Auto |

### RPCs

| RPC | Auth | Purpose |
|---|---|---|
| `get_campaigns_with_post_summary` | Authenticated | List with post counts per status |
| `get_campaign_analytics` | Authenticated | Detail analytics + budget |
| `get_campaign_by_review_token` | SECURITY DEFINER (public) | Client review page data; LATERAL JOIN on share_tokens for per-post token |
| `update_post_status_by_token` | SECURITY DEFINER (public) | Approve / request revisions per post |

### Related columns

- `posts.campaign_id` — nullable FK → campaigns (ON DELETE SET NULL)
- `invoices.campaign_id` — nullable FK → campaigns (ON DELETE SET NULL)
- `share_tokens` — per-post review tokens resolved via LATERAL JOIN in `get_campaign_by_review_token`

---

## Phase 3 — Share Review Link Flow (As-Built)

```
canShare = postsData.some(p => p.status === 'PENDING_APPROVAL') && !!campaign.review_token

Click "Share Review Link" → always opens dialog:
  ┌────────────────────────────────────────────┐
  │ Share Review Link                          │
  │ [https://.../campaign-review/token    ] [⎘]│
  │ ─────────────────────────────────────────  │
  │  Client Name          [✉ Send Email]        │  ← only if clients.email exists
  │  client@email.com                          │
  └────────────────────────────────────────────┘

Copy → navigator.clipboard.writeText → toast.success
       on failure → toast.error (URL already visible to copy manually)

Send Email → supabase.functions.invoke('send-campaign-review-email', {
               body: { client_email, client_name, campaign_name, review_url }
             }) → toast.success + dialog closes
             on error → toast.error (link still copyable)

Edge function:
  verify_jwt: false | CORS on all responses + OPTIONS preflight
  Resend from: notifications@tercerospace.com
  Subject: "Action Required: Review posts for [campaign_name]"
```
