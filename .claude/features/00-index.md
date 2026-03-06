# Tercero — Feature Development Index
**Location**: `.claude/features/`  
**Last Updated**: March 2026  
**Purpose**: Reference index for all planned features, their phases, and build priority order.

---

## Feature Files in This Folder

| File | Feature | Phase 1 | Phase 2 | Priority |
|------|---------|---------|---------|----------|
| `01-campaigns.md` | Campaigns — Content grouping layer | Post grouping, campaign CRUD, filter integration | Analytics, budgets, campaign-level approval links | High |
| `02-proposals.md` | Proposals & Client Pipeline | Prospect status, pipeline kanban, convert flow | Full proposal builder, shareable link, e-signature | High |
| `03-document-storage.md` | Document Storage | File upload per client, categories, preview | Templates, AI generation, document sharing, e-sign | High |

---

## Recommended Build Order

Based on impact-to-effort ratio and inter-feature dependencies:

### Phase 1 Build Sequence

```
1. Document Storage (Phase 1)
   → Lowest effort, highest perceived value, zero dependency on other new features
   → Reuses existing Supabase Storage infrastructure
   → Immediate "wow" factor for landing page and early adopters

2. Campaigns (Phase 1)
   → Medium effort, high conceptual value
   → Requires posts table migration (add campaign_id column)
   → Should be built before Proposals since campaigns are referenced in proposals

3. Proposals — Prospect Pipeline (Phase 1)
   → Medium effort
   → Requires client status enum update
   → CRITICAL: Must update plan limit enforcement to exclude Prospects
   → Dependent on client architecture being stable
```

### Phase 2 Build Sequence

```
4. Campaigns (Phase 2)
   → Analytics and budget tracking
   → Depends on real usage data from Phase 1 campaigns

5. Document Storage (Phase 2)
   → Templates and AI generation
   → Depends on Anthropic API integration decision

6. Proposals (Phase 2)
   → Full proposal builder
   → Highest effort of all Phase 2 work
   → Should be informed by user feedback from Phase 1 prospect tracking
```

---

## Shared Infrastructure Notes

### Supabase Storage Buckets
| Bucket | Purpose | Access |
|--------|---------|--------|
| `post-media` | Post images/videos (existing) | Public URLs |
| `client-documents` | Client contracts, briefs, assets (new) | Signed URLs only |

### Public Token Pattern (Reused Across Features)
The existing `/review/:token` pattern is reused for:
- Document sharing links (`/document/:token`) — Phase 2
- Proposal preview links (`/proposal/:token`) — Phase 2

All three use the same architectural pattern: UUID token stored on the record, public Supabase RLS policy, application-layer token matching. This is a strength — one UX paradigm, three use cases.

### Plan Limit Enforcement Points
Features that affect plan limit calculations:

| Feature | Limit Affected | Action Required |
|---------|---------------|-----------------|
| Campaigns | None — campaigns are unlimited | No change |
| Prospect status | `max_clients` count must EXCLUDE Prospects | Update all client count queries |
| Document Storage | `storage_limit_bytes` must include new bucket | Update storage calculation RPC |

---

## Key Database Changes Summary

### New Tables
- `campaigns` — phase 1
- `client_documents` — phase 1
- `document_templates` — phase 2
- `proposals` — phase 2

### Modified Tables
- `posts` — add nullable `campaign_id` FK (phase 1)
- `clients` — add prospect fields + new status value (phase 1)
- `invoices` — add optional `campaign_id` and `proposal_id` FKs (phase 2)

### New Supabase Edge Functions
- `send-proposal-email` — triggered when proposal sent to client (phase 2)

### New RPCs
- `get_campaign_with_post_summary` — campaign detail + post counts (phase 1)
- `get_prospect_pipeline_summary` — pipeline stage counts + total estimated value (phase 1)
- `calculate_total_storage_usage` — sum of post-media + client-documents (phase 1)

---

## Landing Page Feature Hooks

Each feature has a clear landing page section angle:

| Feature | Copy Hook |
|---------|-----------|
| Campaigns | *"Run campaigns, not just posts."* |
| Proposals | *"From first pitch to final invoice — without leaving Tercero."* |
| Document Storage | *"Every client's contracts, briefs, and brand assets — in one place."* |

Together these three features support the master positioning:
> **Tercero is the command center for social media agencies — from first pitch to published content, with every client's file at your fingertips.**
