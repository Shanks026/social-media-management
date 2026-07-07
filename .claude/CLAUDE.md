# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev           # Start Vite dev server with HMR
npm run build         # Production build
npm run lint          # Run ESLint
npm run preview       # Preview production build locally
npm test              # Run tests once (vitest run)
npm run test:watch    # Run tests in watch mode
```

Tests use **Vitest** + jsdom. Test files live in `src/tests/` (e.g. `src/tests/campaigns/phase1.test.jsx`). Import test helpers from `src/tests/test-utils.jsx`.

## Architecture Overview

**Tercero** is a React + Supabase SPA for social media agency management (client management, post scheduling, finance, operations).

### Tech Stack

- **React 19** + **React Router 7** (client-side routing)
- **Vite** (build tool, `@` alias → `./src`)
- **Tailwind CSS 4** + **shadcn/ui** (new-york style, neutral base, lucide icons)
- **TanStack React Query** (server state, 30s staleTime, retry: 1, no refetch on focus)
- **React Hook Form** + **Zod** (forms and validation)
- **Supabase** (PostgreSQL, auth, storage, edge functions)
- **date-fns** (date manipulation; used in API layer and components)
- **@react-pdf/renderer** (PDF generation — invoices and calendar reports)
- **Tiptap** (rich text editor — Notes feature, `src/components/notes/editor/`)
- **Recharts** (charts — dashboard/reports/campaign analytics, e.g. `WorkflowHealth.jsx`'s half-donut `PieChart`)

### Data Flow

```
Pages/Components → API functions (src/api/) → Supabase client → PostgreSQL
                                           ↑
                                   React Query cache
```

### Key Layers

**Entry (main.jsx):** Wraps app in `QueryClientProvider`, `ThemeProvider`, `SidebarProvider`, `TooltipProvider`, `Toaster`, `BrowserRouter`.

**Auth (src/context/AuthContext.jsx):** Supabase `onAuthStateChange` listener; session checked in `App.jsx` to protect routes. Resolves `workspaceUserId` and `userRole` on every auth state change — for workspace owners `workspaceUserId === user.id`; for invited members it is the owner's UID. All API hooks use `workspaceUserId` (not `user.id`) to scope DB queries to the correct workspace.

**Layout (AppShell.jsx):** Sidebar nav + header wrapper; feature content renders via React Router `<Outlet>`.

**API layer (src/api/):** Domain-scoped modules (clients, posts, invoices, expenses, transactions, meetings, notes, documents, agency, storage). Each exports plain async functions for mutations and React Query hooks for reads. `useGlobalPosts.js` handles cross-client post queries. Supabase RPC calls are used for complex aggregations:
- `get_clients_with_pipeline()` — client analytics
- `create_post_draft_v3()` — atomic post creation
- `create_revision_version()` — post versioning
- `get_global_calendar()` — date-range post queries

**Pages (src/pages/):** Feature directories — clients, posts, calendar, finance, billingAndUsage, operations (notes/meetings), documents, dashboard, settings, prospects, reports, chat, public review.

**Header context (`src/components/misc/header-context.jsx`):** Pages call `useHeader()` to set the dynamic breadcrumb/title in the shell header via `setHeader({ title, breadcrumbs })`.

**Shared utilities:**
- `src/lib/helper.js` — `formatDate(dateInput)` → "2 Jan, 2026"; `formatFileSize(bytes)` → "2.3 MB"; `getPublishState(version)` → derives display status from `platform_schedules` (returns `'PARTIALLY_PUBLISHED'` when some but not all platforms have `published_at`); `effectivePlatformDate(version, platform)` → falls back to `target_date` when `platform_schedules` is absent; `MAX_DOCUMENT_SIZE_BYTES` constant (50 MB)
- `src/lib/client-helpers.js` — `getUrgencyStatus(nextPostAt)` → urgency color/label for pipeline indicators
- `src/lib/workspace.js` — `resolveWorkspace()` async helper for plain mutation functions that need `workspaceUserId` without React context (calls `auth.getUser()` then checks `agency_members`)
- `src/lib/industries.js` — `INDUSTRY_OPTIONS` array (value/label pairs, e.g. `{ value: 'SaaS', label: 'SaaS & Tech' }`). The DB stores the short `value`; always resolve to `label` for display via `.find(i => i.value === x)?.label`. Also exports `getIndustryColor(value)`.

**Shared UI components:**
- `src/components/ui/stat-bar.jsx` — `<StatBar>` (bordered flex row with dividers) + `<StatCell label value sub icon iconBg>`. Accepts `className` on both; `valueClass`/`labelClass`/`subClass` on `StatCell`. The `sub` prop accepts JSX (renders in a `<div>`). Use for metric rows on Finance, Dashboard, Reports, Campaign, and Prospects pages.
- `src/components/WorkflowHealth.jsx` — Half-donut `PieChart` showing deliverable status distribution. Props: `posts`, `isLoading`, `title`, `description`, `onViewAll`, `excludeStatuses`, `className`. Fully prop-driven — no internal data fetch. Used on dashboard, client detail, and campaign detail.
- `src/components/ui/empty.jsx` — `<Empty>`, `<EmptyContent>`, `<EmptyHeader>`, `<EmptyTitle>`, `<EmptyDescription>`, `<EmptyMedia>`. `EmptyTitle` base class is `bricolage font-bold` — always pass `className="font-bold text-xl"` at usage sites for consistency. See `.claude/skills/empty-states/SKILL.md` for the full section-by-section reference.

### Domain Patterns

**Post management:** Versioning via parent-child post relationships. Statuses: `DRAFT`, `PENDING`, `REVISIONS`, `SCHEDULED`, `ARCHIVED`. In the campaign review flow, posts are set to `PENDING_APPROVAL` when awaiting client review, then transitioned to `SCHEDULED` (approved) or `NEEDS_REVISION` (revisions requested) via the `update_post_status_by_token` RPC. Media stored in Supabase `post-media` bucket; deletions are deferred until media is unused. Shareable public review via token. `DraftPostForm` (`src/pages/posts/DraftPostForm.jsx`) is used both as a standalone page and as a dialog (pass `open`/`onOpenChange` props); it accepts `clientId`, `initialCampaignId`, and `initialCampaignName` to pre-fill context.

Posts support two publishing modes: (1) simple — single `target_date`, marked published in one action; (2) per-platform — `platform_schedules` JSONB column maps each platform to `{ scheduled_at, published_at }`. Use `getPublishState(version)` from `src/lib/helper.js` to derive display status — never read `version.status` directly for display when `platform_schedules` is present. Both publishing paths in `PostDetails.jsx` trigger `send-platform-published-email`.

**Clients:** "Internal Account" vs real clients (`is_internal` flag). `useClients()` returns `{ internalAccount, realClients }` — fetches all non-internal clients with fields `id, name, logo_url, is_internal, email, address, industry, status`. For displaying an ACTIVE-only count (e.g. dashboard), filter `realClients` by `status === 'ACTIVE'`. `useSubscription().client_count` counts all non-internal clients regardless of status (used for billing limits — do not use for display counts). Pipeline analytics via `view_client_profitability` DB view. Tiers and industries for filtering; industry stored as short key (`'SaaS'`), display via `INDUSTRY_OPTIONS`.

**Reusable tab pattern:** Feature tabs like `CampaignTab` and `DocumentsTab` accept an optional `clientId` prop. Without it they show all records (global page); with it they scope to that client (used inside `ClientProfileView`). The "New" button and `showClient` label on cards also toggle based on whether `clientId` is present.

**Campaigns (`/campaigns`):** Group posts into initiatives per client. Subscription-gated (`sub?.campaigns`). Three surfaces: global list (`/campaigns`), detail page (`/campaigns/:campaignId`), and public client review (`/campaign-review/:token`). Detail page shows KPI bar, post list, platform distribution chart, budget tracker, and linked invoices. The "Share Review Link" button appears only when `campaign.review_token` exists and at least one post has `PENDING_APPROVAL` status — opens a dialog to copy the URL or email it via the `send-campaign-review-email` edge function. Review tokens can be regenerated; `last_review_sent_at` is tracked. Key API hooks live in `src/api/campaigns.js`; key RPCs: `get_campaigns_with_post_summary`, `get_campaign_analytics`, `get_campaign_by_review_token` (public, SECURITY DEFINER), `update_post_status_by_token` (public).

**Public campaign review (`/campaign-review/:token`):** Fully unauthenticated two-panel UI — left panel lists all `PENDING_APPROVAL` posts, right panel shows the selected post with Approve / Request Revisions actions. Per-post tokens come from the `share_tokens` table via a LATERAL JOIN in the RPC (not from a column on `post_versions`). Branding flags (`branding_agency_sidebar`, `branding_powered_by`) are read from the RPC response.

**Documents (`/documents`):** File storage per client using a private Supabase `client-documents` bucket (signed URLs). Documents have categories, belong to optional collections (`documents_collections` feature flag), and are scoped by `client_id`. The global page shows all documents with a client filter dropdown; the same `DocumentsTab` component is reused in the Client Detail page, filtering by `clientId` prop. Storage usage is tracked on `agency_subscriptions.current_storage_used` via `increment_storage_used` / `decrement_storage_used` RPCs.

**Finance (`/finance`):** Agency-side financial tracking — invoice generation with PDF export, expense tracking, transaction ledger, client subscription plan management. Nested routes: `overview`, `subscriptions`, `ledger`, `invoices`.

**Billing (`/billing`):** The agency's own subscription to Tercero — plan details, usage stats, and internal invoices. Separate from client Finance.

**Teams (`/settings` → Team tab):** Agency owners invite teammates via a generated link (`/join/:token`). Invited members get full workspace access. The multi-tenant workspace model is the key architectural concept: all DB queries are scoped by `workspaceUserId` (the owner's UID), resolved via `get_my_agency_user_id()` SECURITY DEFINER SQL function. API module: `src/api/team.js`; public join page: `src/pages/JoinTeam.jsx`; team management UI: `src/pages/settings/TeamSettings.jsx`. Both `useTeamMembers()` and `usePendingInvites()` maintain Supabase Realtime subscriptions for live updates.

**Prospects (`/prospects`):** Pre-client lead tracking. Statuses: `new` → `contacted` → `demo_scheduled` → `won` / `lost`; status config (colors, labels) lives in `src/components/prospects/ProspectStatusBadge.jsx` as `PROSPECT_STATUS_CONFIG`. Two views: card (default) and table; selection stored in `localStorage`. Prospect detail has dedicated tabs including `ProspectOutreachTab` — inline outreach log form (channel types: `whatsapp`, `instagram`, `email`, `call`, `inperson`, `others`) + pipeline activity feed. Activity types/icons configured in `src/api/prospectActivities.js` as `ACTIVITY_TYPES`. Prospects can be converted to clients via "Convert to Client" which navigates to `CreateClientPage` with `state.fromProspect` pre-fill and marks `converted_client_id` on success.

**Proposals (`/proposals`):** Statuses: `draft` → `sent` → `viewed` → `accepted` / `declined`; `expired` computed by DB when `valid_until < now()`; `archived` is manual. Three surfaces: global list (`/proposals`), detail page (`/proposals/:proposalId`, full inline-edit with auto-save), and public review (`/proposal/:token`, unauthenticated). Per-client `ProposalTab` reused in Client Detail. Hybrid gating: all surfaces always visible; creation blocked at `proposals_limit` (5 for Trial/Ignite, null = unlimited for Velocity/Quantum) with `ProposalsUpgradePrompt`. API module: `src/api/proposals.js`. PDF export: `src/utils/downloadProposalPDF.jsx` + `src/components/proposals/ProposalPDF.jsx` (canvas-rasterized Tercero SVG logo when no agency branding). Key RPCs: `get_proposals_with_totals`, `generate_proposal_token`, `get_proposal_by_token` (public), `mark_proposal_viewed` (public), `accept_proposal` (public), `decline_proposal` (public).

**Tasks (`/tasks`):** Internal work items with `status` (`TODO` → `IN_PROGRESS` → `COMPLETED` → `ARCHIVED`; transitioned via the `update_task_status` RPC), `priority`, `due_at`, `assigned_to`, `created_by`. Assignment is RBAC-gated by `canAssignTasks` (owner/admin). Tasks optionally link to a **client** (`client_id`, **nullable** — null = "General (no client)", surfaced as its own filter distinct from the internal account), a **campaign** (single `campaign_id`), and **multiple deliverables** (posts) via the `task_posts` join table (`ON DELETE CASCADE` both sides — deleting a post drops its links). `task_posts` isn't constrained to the task's client, so a General task can link deliverables across *any* client. Mutations (`createTask`/`updateTask`) take `post_ids` and diff links via `replaceTaskDeliverables`; `updateTask` only touches links when `post_ids` is passed. Reverse lookup `useTasksForPost(postId)` powers the "Linked tasks" list on the post detail page. UI: reusable `TasksTab` (clientId-scoped or global), `TaskDetailSheet` + `TaskCard` (which also exports `STATUS_CONFIG`/`PRIORITY_CONFIG`), and the `TasksAndReminders` page (kanban / grouped / table views). Feature doc: `documentation/features/feature-task-linking.md`.

**Collaboration layer (notifications + comments):** Key rule — **fan-out lives where the state change lives, in the DB, not client-side.** A `SECURITY DEFINER` SQL helper `emit_notifications(workspace_id, actor, recipients[], type, title, body, entity_type, entity_id, link)` de-dupes recipients and strips the actor; `workspace_admin_uids(workspace_id)` resolves the owner+admin set (both RPC-revoked from public/anon/authenticated). The client-side `notify()` in `src/api/notifications.js` exists but is intentionally **unused** — all triggers are DB-side.
- **In-app notifications** (`NotificationBell`): per-recipient `notifications` table (`recipient_user_id` = RLS key; `actor_user_id` for attribution + self-exclusion). Emitted by table triggers (`tg_notify_task_changes` on `tasks`, `tg_notify_comment_added` on `comments`) and RPCs (`submit_for_internal_approval`, `approve_internally`, `request_internal_changes`, `update_post_status_by_token`, `join_team`) plus the `notify_overdue_invoices` pg_cron job; 30-day retention via pg_cron. Realtime is an **invalidator only** (subscribe → `invalidateQueries`), like `team.js`. The bell resolves `actor_user_id` against `useTeamMembers()` to show avatar + name.
- **Contextual comments** (`CommentThread`, on posts + campaigns): `comments` table (`entity_type` `post|campaign`, `entity_id`, `author_user_id` = real caller, `mentioned_uids[]`, `deleted_at` soft-delete). `useComments({entityType, entityId})` read; `createComment`/`updateComment`/`softDeleteComment` (RPC) mutations. `AFTER INSERT` trigger fans out `comment_added` to thread participants + mentions + post author.
- Feature doc: `documentation/features/feature-collaboration.md`.

**Workspace Chat (`/chat`):** One shared workspace-wide channel plus 1:1 DMs — no group chats. Subscription-gated (`sub?.chat`, Velocity+/Quantum, plus Trial mirroring Quantum — same precedent as every other Velocity+ flag). Also enforced **in the database**, not just the UI — `ensure_workspace_channel()`, `get_or_create_dm_channel()`, and the `chat_messages` INSERT policy all call `is_chat_enabled_for_workspace()`, which checks the `chat` column directly (an independent, override-capable flag, not derived from `plan_name` at read time — see `documentation/subscription-features-phase2.md`). Tables: `chat_channels` (`type`: `workspace` | `dm`), `chat_channel_members`, `chat_messages`, `chat_message_reactions`. `ensure_workspace_channel()` bootstraps the shared channel/membership on first load (so pre-existing members work); `get_or_create_dm_channel()` is deterministic per pair — both sides converge on the same channel id. API: `src/api/chat.js` (`useMyChannels`, `useChannelMessages`, `sendMessage`, `useMemberMap` for the merged teammates+owner+self roster). UI in `src/components/chat/` — `ChatThread.jsx` is the largest file (composer, reactions, mentions, all in one). Mentions support real people (`@Name`) plus two broadcast pseudo-mentions, `@Everyone`/`@Important`, which expand to every workspace member id at send time rather than being real uids (`@Important` renders in red; both get distinct notification titles via body-text sniffing in `tg_notify_chat_message`, since they aren't real `mentioned_uids` entries otherwise). Messages can reference a deliverable or task inline via a `/` slash command — stored as `chat_messages.entity_references` (JSONB array; renamed from `references`, a reserved SQL keyword) and rendered as `[[Title]]` tokens, with a compact preview card below the bubble when exactly one reference is present. Task references respect `tasks_select`'s RLS (creator/assignee/admin only, unlike workspace-wide-visible deliverables) — the `task_reference_exists()` RPC lets the UI say "you don't have access" instead of leaking the task's title to a viewer who isn't allowed to see it. Notification fan-out follows the same DB-trigger pattern as Collaboration above (`tg_notify_chat_message`); Realtime is an invalidator only. Feature doc (the authoritative build history, including deviations and fixes found along the way): `documentation/features/feature-workspace-chat.md`.

**Deliverable (post) deletion authorization:** Enforced in **RLS** (authoritative), mirrored in the UI on all three delete surfaces (`PostContent`, `DraftPostList`, `CalendarPostCard`). `posts.created_by` (backfilled from the v1 version, stamped by a trigger on `post_versions`) is the original creator. Rule: **owner/admin (`is_workspace_admin()`) may delete in any status; a non-admin member may delete only their own deliverable and only while the current version's status is in `DELETABLE_POST_STATUSES` (`DRAFT`/`SUBMITTED`/`ARCHIVED`)** — everything from `READY` onward is a committed action, blocked for members. `deletePost` deletes the row first (the RLS gate) *before* touching storage, so a blocked delete never orphans media. Editing stays open to all workspace members.

**Supabase Edge Functions (supabase/):**
- `send-approval-email` — triggered from `PostDetails.jsx` on status change to `PENDING_APPROVAL`, `SCHEDULED`, `NEEDS_REVISION`, or `PUBLISHED`; requires JWT (`verify_jwt: false`, manually verified inside)
- `send-client-welcome` — triggered from `createClient()` in `src/api/clients.js` after INSERT; sends "Your workspace is live" (internal) or "You're in" (external); requires JWT; skips silently (returns 200) when `record.email` is null
- `send-signup-welcome` — triggered from `signup-form.jsx` after successful `supabase.auth.signUp()`; no JWT required; takes `{ email, name }`
- `send-platform-published-email` — triggered from `PostDetails.jsx` when a platform is marked published; takes `{ post_version_id, platform, all_published }`; skips internal clients
- `send-campaign-review-email` — triggered from campaign detail page when sharing review link
- `send-proposal-email` — triggered from proposals flow
- `send-renewal-request` — triggered from renewal flow
- `send-password-update-email` — triggered from `ForgotPasswordDialog` and `ChangePasswordDialog`; requires JWT
- `send-feedback-notification` — internal feedback notifications
- `delete-team-member` — removes a team member; requires JWT

### Subscription & Feature Gating

**`useSubscription()` (`src/api/useSubscription.js`):** Central hook for all plan/tier checks. Returns a React Query result; access via `const { data } = useSubscription()`. Always use this hook — never query `agency_subscriptions` directly in components.

The `data` object includes:
- `plan_name` — `'trial'` | `'ignite'` | `'velocity'` | `'quantum'`
- `agency_name`, `logo_url` — agency branding
- `client_count`, `max_clients` — for client limit checks
- `storage_display` — pre-calculated storage usage strings (`usage_value`, `usage_unit`, `max_value`, `percent`, `remaining_label`)
- Feature flags (all boolean):
  - `branding_agency_sidebar` — show agency logo+name in sidebar (Velocity+)
  - `branding_powered_by` — show "Powered by Tercero" footer (Ignite + Velocity; Quantum hides it)
  - `finance_recurring_invoices` — recurring invoice templates tab (Velocity+)
  - `finance_subscriptions` — expense subscriptions route (Velocity+)
  - `finance_accrual` — accrual accounting mode (Velocity+)
  - `calendar_export` — calendar PDF export button (Velocity+)
  - `documents_collections` — document collections grouping (Velocity+)
  - `campaigns` — campaigns feature (Velocity+)
  - `reports` — reports page access (Velocity+; also enabled on Trial)
  - `chat` — workspace chat feature (Velocity+; also enabled on Trial). Also DB-enforced, not just UI — see Domain Patterns below.
- `proposals_limit` — integer | null — 5 for Trial/Ignite; null = unlimited (Velocity/Quantum)

**Canonical feature matrix:** `documentation/subscription-features-phase2.md` is the authoritative source for which features are enabled per plan, tier pricing/limits, and DB seed values — it explicitly supersedes the earlier `subscription-features.md` (now deleted) and Phase 2 draft. `.claude/features/feature-tiers-v5.md` is a secondary reference — when they conflict, trust `subscription-features-phase2.md`.

**Gating pattern:** Read flags directly from `data` (e.g. `data?.finance_subscriptions`). For locked features (visible but disabled), show with a disabled state + lock icon + tooltip. For hidden features (like nav items), conditionally render them. See `.claude/features/feature-tiers-v5.md` for the full feature matrix.

**Public review page (`/review/:token`):** This page is unauthenticated. To access branding flags, extend the token query to join through `post_versions → posts → clients → agency_subscriptions`.

### Environment Variables

```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_APP_URL          # Base URL for invite link generation (e.g. https://tercerospace.com)
```
