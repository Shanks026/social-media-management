# Cleanup / Maintainability Audit — Core Content Pipeline

Scope: clients → deliverables → calendar → approvals/review → campaigns → comments.
Read-only audit (2026-11-07, `main` @ 1d403e7). No security analysis. All "unused" claims were grep-verified across `src/` (tests excluded unless noted).

Legend: **REMOVE** · **CAN STAY** · **NEEDS IMPROVEMENT**

---

## 0. Cross-cutting: the real post status model

### 0.1 Actual status set (vs. docs)

Docs (`.claude/rules/post-versioning.md` L19, L24-37; root `.claude/CLAUDE.md` "Post management") describe `DRAFT | PENDING | REVISIONS | SCHEDULED | ARCHIVED`. **None of `PENDING` / `REVISIONS` is used by deliverable code.** The real DB enum `post_status` (base + `20260320090442_add_approved_delivered_statuses.sql`, `20260701060134_rbac_phase5_deliverable_workflow.sql`) plus one UI-derived value is:

| Status | Meaning / who sets it | Where transitioned |
|---|---|---|
| `DRAFT` | created | `create_post_draft_v3`, `create_revision_version` RPCs |
| `SUBMITTED` | member submits for internal review | `submit_for_internal_approval` RPC (`src/api/posts.js:599`) |
| `CHANGES_REQUESTED` | admin bounces internally | `request_internal_changes` RPC (`posts.js:613`) |
| `READY` | admin approved internally | `approve_internally` RPC (`posts.js:606`) |
| `PENDING_APPROVAL` | sent to client | `send_post_for_approval` RPC — **called inline in `PostDetails.jsx:145`** |
| `APPROVED` | non-social deliverable approved (client or internal) | `update_post_status_by_token` RPC (public) **and raw `.update()` in `PostDetails.jsx:166`** |
| `NEEDS_REVISION` | client requested changes | `update_post_status_by_token` |
| `SCHEDULED` | social deliverable approved with date | `update_post_status_by_token` **and raw `.update()` in `PostDetails.jsx:185-197`** |
| `DELIVERED` | non-social terminal | raw `.update()` in `posts.js:387 markPostDelivered` |
| `PUBLISHED` | social terminal | raw `.update()` in `PostDetails.jsx:229, 261` |
| `ARCHIVED` | superseded versions | `create_revision_version` |
| `PARTIALLY_PUBLISHED` | **UI-only**, derived by `getPublishState()` (`src/lib/helper.js:47`) | never stored |

There are effectively two terminal tracks: social (`… → SCHEDULED → PUBLISHED`) and non-social (`… → APPROVED → DELIVERED`). That split is not written down anywhere.

**NEEDS IMPROVEMENT**
- Rewrite `.claude/rules/post-versioning.md`. Its status list and flow diagram are wrong, and the `create_revision_version` example uses `p_post_id`/`p_title`. The real params are `p_parent_version_id, p_user_id, p_admin_notes` (`posts.js:402-406`). The `create_post_draft_v3` example is also missing 5 params (`posts.js:258-270`).
- Fix the root `.claude/CLAUDE.md` "Post management" paragraph to match.
- Status transitions are split between server RPCs and raw client `.update()`s (PostDetails ×5, `markPostDelivered`). An auto-publisher (roadmap 01) and a client portal (roadmap 04) both need the transitions "schedule", "mark platform published", "mark published", "mark delivered" and "approve non-social" to be server-side RPCs that also fire the emails. Today the published email is sent from a React `onSuccess` (`PostDetails.jsx:248, 278`), so a cron publisher would silently skip it.
- No tests cover `getPublishState` or any status logic (`src/tests/` holds only `campaigns/` and `comments/`).

### 0.2 Canonical config exists but is bypassed

`src/lib/post-statuses.js` is the intended single source (`POST_STATUS_CONFIG`, `DELETABLE_POST_STATUSES`, chart helpers). Its header comment (L2) says it is used by StatusBadge, WorkflowHealth, ContentPipelineBar and OverviewTab. That is true, but **at least 12 other hand-rolled copies** of the status list or style map exist:

| File:line | What | Drift |
|---|---|---|
| `src/pages/calendar/MonthView.jsx:24` | `STATUS_STYLES` border classes | identical to WeekView copy |
| `src/pages/calendar/WeekView.jsx:23` | `STATUS_STYLES` | identical to MonthView |
| `src/pages/calendar/ContentCalendar.jsx:73` | `STATUS_LEGEND` (label + color) | "Pending Approval" vs canonical "Awaiting Approval"; omits ARCHIVED |
| `src/pages/calendar/CalendarReportPDF.jsx:43` | `STATUS_LABELS` | only 6 of 12 statuses (no SUBMITTED/READY/APPROVED/DELIVERED…) |
| `src/pages/Posts.jsx:116` | `STATUS_TABS` | |
| `src/pages/Posts.jsx:95` | `TERMINAL_STATUSES` | |
| `src/pages/clients/clientSections/WorkflowTab.jsx:19` | `ALL_STATUS_TABS` + hard-coded zero-count object L61 | |
| `src/pages/clients/clientSections/WorkflowTab.jsx:34` / `OverviewTab.jsx:228` | `INTERNAL_EXCLUDED` (two formats: underscore vs space) | |
| `src/api/useGlobalPosts.js:180-194` | hard-coded zero-count object | |
| `src/components/campaigns/CampaignCard.jsx:24` | `PIPELINE_COLORS` | |
| `src/components/campaigns/LinkPostsToCampaignDialog.jsx:32` | `POST_STATUS_STYLES` | **dead** (see §5) |
| `src/components/reports/ClientReportPDF.jsx:116` + `src/pages/reports/ReportsPage.jsx:34` | identical `STATUS_LABELS` ("PUBLISHED: 'Delivered'") | outside this area, same problem |
| `src/pages/submissions/SubmissionsPage.jsx:133` | `TAB_STATUS` | `approved` maps to `READY`, which collides with the `APPROVED` enum |

**NEEDS IMPROVEMENT**
- Extend `post-statuses.js` with: `borderClass`, `dotClass`, `pdfLabel`, an ordered `POST_STATUSES` array, `INTERNAL_EXCLUDED_STATUSES`, `TERMINAL_STATUSES`, `emptyStatusCounts()`, and a `canDeletePost(post, userId, isAdmin)` helper. The delete rule is currently copied in `DeliverableCard.jsx:322` and `PostContent.jsx:320`.
- Then delete every local copy listed above.
- Chart display names use spaces (`STATUS_DISPLAY_MAP`), and a `normalizeStatus` wrapper is copy-pasted in `WorkflowHealth.jsx:26`, `OverviewTab.jsx:83` and `ContentPipelineBar.jsx:28`. Key charts by the enum instead.

**REMOVE**
- `src/pages/dashboard/ContentPipelineBar.jsx:65-66`: legacy `'PENDING'` → `PENDING APPROVAL` and `'REVISIONS'` → `NEEDS REVISION` remaps. These values no longer exist.

### 0.3 Other copy-paste helpers across the pipeline (NEEDS IMPROVEMENT)
- **Platform icon component re-declared 7×** with the same `google_business → 'google_busines'` filename hack: `LinkPostsToCampaignDialog.jsx:43`, `DeliverableCard.jsx:155`, `CampaignDetailPage.jsx:100`, `CampaignReview.jsx:30`, `PostContent.jsx:151/170`, `PublicReview.jsx:53`, `Posts.jsx:131`, plus `TaskCard.jsx:29`. The same hack also appears inline in `ManagementTab.jsx:272` and `PlatformSelector.jsx:88`. A shared `src/components/PlatformIcon.jsx` already exists. Rename `public/platformIcons/google_busines.png` and consolidate.
- **Platform lists**: `Posts.jsx:107 PLATFORMS`, `ContentCalendar.jsx:87 PLATFORMS`, `MonthView.jsx:17`/`WeekView.jsx:16 PLATFORM_ICONS`, `DraftPostForm.jsx:165 PLATFORM_CONFIG`, `PostContent.jsx:121/132`, `ApprovalsPage.jsx:84 PLATFORM_LABELS`. All duplicate `src/lib/platforms.js SUPPORTED_PLATFORMS`, which itself has `google_business` commented out (L17-22) while 6 other places still support it.
- **Deliverable type labels** in 3 places: `DraftPostForm.jsx:83 DELIVERABLE_TYPE_GROUPS`, `Posts.jsx:73` and `DeliverableCard.jsx:65 DELIVERABLE_TYPE_LABELS`. Move them to `src/lib/deliverable-types.js`.
- **`isVideo*` detectors re-implemented about 11×**, with differing regexes: `DeliverableCard.jsx:86`, `PostContent.jsx:111`, `ApprovalsPage.jsx:98`, `CampaignReview.jsx:26`, `PublicReview.jsx:68`, `DraftPostForm.jsx:122`, `SubmissionsPage.jsx:99`, `Facebook/Instagram/TwitterPreview`, `ChatEntityCard.jsx:57`.
- **`MediaItem`** is duplicated between `DeliverableCard.jsx:96` and `PostContent.jsx:191`.
- **`DOCUMENT_EXTENSIONS`** is duplicated between `DraftPostForm.jsx:143` and `src/lib/helper.js:79`.
- **Storage-path extractors**: `getPathFromUrl` in `src/api/posts.js:148` and `src/api/clients.js:33`, plus `extractStoragePath` in `CreateClientPage.jsx:84`, onboarding and 3 settings files.
- **`UserAvatar` / `ClientAvatar` / `initials`** are re-declared in both `ApprovalsPage.jsx:102-137` and `SubmissionsPage.jsx:34-88`, while `src/components/tasks/ClientAvatar.jsx` already exists.

---

## 1. Clients

| Finding | Class |
|---|---|
| `src/pages/clients/clientSections/ComingSoon.jsx` (11 lines). No importer; the only `ComingSoon` imports go to `components/misc/ComingSoon`. | **REMOVE** |
| `getIndustryColor` (`src/lib/industries.js:32`) has 0 references. `IndustryBadge.jsx:52` does its own lookup. | **REMOVE** (or make IndustryBadge use it) |
| `src/lib/client-helpers.js:1` header says `// src/lib/utils/client-helpers.js`, which is the wrong path. | trivial fix |
| Industry label lookup `INDUSTRY_OPTIONS.find(...)?.label` is open-coded in `ManagementTab.jsx:81`, `ReportsPage.jsx:233`, `ProspectOverviewTab.jsx:45` and `IndustryBadge.jsx:52`. Add a `getIndustryLabel(value)` export. | NEEDS IMPROVEMENT |
| `CreateClientPage.jsx` (771 lines) calls `supabase.storage` directly at L311-347 to upload, read and remove logos. It puts them in the **`post-media`** bucket under `branding/`, so client logos share the post-media bucket and quota. This should be an API function in `src/api/storage.js`, which currently only exports `uploadPostImage`. | NEEDS IMPROVEMENT |
| `ClientWeekTimeline.jsx:49, 87` queries `posts` and `meetings` directly. It overlaps with `DashboardWeekTimeline.jsx` (304 lines, uses `useGlobalPosts`). The posts query fetches **every** post of the client and filters by date and status on the client. Extract one shared `WeekTimeline` that takes a `clientId`, following the reusable-tab pattern. | NEEDS IMPROVEMENT |
| `ClientBillingTab.jsx:153` fetches `invoice_items` directly for the PDF. The same query is repeated in `finance/InvoicesTab.jsx:178, 209`, and `src/api/invoices.js` already has it. | NEEDS IMPROVEMENT |
| Client query keys are inconsistent: `['clients-list', ws]` (`useClients`), `['clients']` (`nav-clients.jsx:31`), `['clients', user.id, {...}]` (`Clients.jsx:94`, using `user.id`, not `workspaceUserId`), `['clients-pipeline-dashboard']` (`ClientHealthGrid`, `useUrgentClients`) and `['client', id]`. The same `fetchClients()` RPC is cached under 3 keys, and invalidation of `['clients']` misses the dashboard key. | NEEDS IMPROVEMENT |
| `deleteClient` (`src/api/clients.js:210-330`, about 120 lines) orchestrates storage cleanup across 3 buckets plus counters on the client. It is acceptable in the API layer but is a candidate for an edge function or RPC. | CAN STAY (note) |
| Client welcome email is triggered twice by design: once by the DB trigger `trigger_client_welcome_email` (`supabase/migrations/20260228163108_…sql`, using a hard-coded, now-rotated bearer per the file's own note, so it likely fails) and once by `createClient()` → `functions.invoke('send-client-welcome')` (`clients.js:166`). No migration drops the trigger. Verify on the remote, then drop the trigger and keep the client call, or the reverse. | NEEDS IMPROVEMENT / likely REMOVE trigger |
| `ClientProfileView.jsx` has URL-driven tabs. The docs in `.claude/rules/routing.md` list 5 tabs; the actual tabs are overview, workflow, tasks, billing, campaigns, proposals, documents, calendar and management (L200-262). | stale doc |
| `ClientCard`, `ClientFilters`, `ClientMetricsRow`, `IndustryBadge`, `PlatformSelector`, `ClientCardSkeleton`, `ClientDetails`, `useClients`, `getUrgencyStatus` | CAN STAY |
| `OverviewTab.jsx` (928 lines) bundles a workflow-health pie that re-implements `WorkflowHealth.jsx` (L228-260, L497-530), a platform bar chart duplicating `CampaignDetailPage`'s (`CustomPlatformTick` + `platformChartConfig` copied at L66/L89 vs CDP L116/L128), plus transactions and notes. Use `<WorkflowHealth excludeStatuses=…>` and extract a `PlatformDistributionChart`. | NEEDS IMPROVEMENT |

---

## 2. Deliverables (posts)

### 2.1 Data layer (`src/api/posts.js` 830 lines, `src/api/useGlobalPosts.js` 208 lines)

| Finding | Class |
|---|---|
| `createPostRevision` (`posts.js:414-452`) has 0 references. It is a manual client-side revision implementation superseded by the `create_revision_version` RPC (`createRevision`, L400). | **REMOVE** |
| `useUnlinkPostFromCampaign` (`src/api/campaigns.js:161`) has 0 references. | **REMOVE** |
| `effectivePlatformDate` (`src/lib/helper.js:60`) has 0 references, although it is documented in CLAUDE.md. | **REMOVE** (or use it in the calendar) |
| `isVideoContent` in `DraftPostForm.jsx:204-217` is dead (`eslint-disable no-unused-vars`). | **REMOVE** |
| Stray `// api/posts.js` comments (L278, L454) and an orphan JSDoc for `deletePost` (L275). A mid-file `import` block (L621-622) should be hoisted. | REMOVE (noise) |
| **Five overlapping list fetchers** with inconsistent shapes: `fetchAllPostsByClient` (L8), `fetchAllDeliverables` (L68), `useGlobalPosts → buildPostsQuery` (`useGlobalPosts.js:9`), `fetchUnlinkedPostsByClient` (`campaigns.js:289`), the `ClientWeekTimeline` inline query and `usePostCounts`. Each re-declares the `post_versions!fk_current_version(...)` select and its own normalizer (e.g. `published_at`/`admin_notes` present in some and missing in others). Consolidate into one select constant plus one `normalizePostRow()`, and parameterize by scope. | NEEDS IMPROVEMENT |
| **`id` means different things.** List fetchers return `id = posts.id` (plus `version_id`). `fetchPostDetails` spreads the version, so `id = post_versions.id`, and `actual_post_id` = post id. The route param `:postId` actually carries a version id (`DeliverableCard.jsx:230`, `PostDetails.jsx:132`). `fetchPostDetails` (L171-243) tries a posts lookup and then falls back to a versions lookup, costing 2 round trips. Standardize on `postId`/`versionId` fields and route by post id. This is required for a client portal or deep links. | NEEDS IMPROVEMENT |
| `useGlobalPosts.js` lives outside `posts.js` and is the only `use*`-named API *file*. Fold it into `posts.js` or a `deliverables.js` module. | NEEDS IMPROVEMENT |
| Mutation hooks inside the API layer violate `.claude/rules/api-conventions.md` ("Never wrap mutations in React Query hooks at the API layer"): `useRegeneratePostShareToken` (`posts.js:778`) and 8 in `campaigns.js` (`useCreateCampaign` L84, `useUpdateCampaign`, `useDeleteCampaign`, `useAssignPostsToCampaign`, `useUnlinkPostFromCampaign`, `useAssignPostCampaign`, `useRegenerateCampaignReviewToken`, `useMarkReviewSent`). Either convert them or update the rule; the codebase has de facto moved on. | NEEDS IMPROVEMENT |
| There are two share-token paths. `regeneratePostShareToken` (`posts.js:578`) mints a token client-side, and the "resend" path (`PostDetails.jsx:318-325`) deactivates tokens inline and relies on the edge function's `generate_version_token`. Pick one server-side path. | NEEDS IMPROVEMENT |
| `deletePost`, `updatePost`, `cleanupRemovedMedia`, `deleteIndividualMedia`, `createDraftPost`, the internal-approval RPC wrappers, `usePendingApprovals`, `useApprovalLog`, `useMySubmissions` | CAN STAY |

### 2.2 UI

| Finding | Class |
|---|---|
| `src/pages/posts/postDetails/MediaPreview.jsx` (50 lines) has no importer. | **REMOVE** |
| `PostDetails.jsx` (580 lines) has **13 `useMutation`s and 16 `useState`s**, including 11 direct `supabase` calls (L97 versions list, L145 RPC, L166/185/192/229/261 raw status updates, L248/278/323 edge functions, L318 share_tokens). Move all of them to `src/api/posts.js` (e.g. `scheduleDeliverable`, `markPlatformPublished`, `markPublished`, `approveDeliverable`, `useVersionHistory`), ideally as RPCs (see §0.1), then extract a `usePostActions(post)` hook. | NEEDS IMPROVEMENT |
| `PostActionDialogs.jsx:80` does `await onConfirmApproval({ silent: true })`, but `onConfirmApproval` is `mutation.mutate` (`PostDetails.jsx:497`), which returns `undefined`. The email at L85 therefore fires **before** the status RPC resolves, and RPC errors are not caught by this try/catch. Use `mutateAsync` and move the email call out of the component. | NEEDS IMPROVEMENT (bug-ish) |
| `PostContent.jsx` (985 lines) and `DeliverableCard.jsx` (658 lines) duplicate `MediaItem`, `PlatformIcon`, the video check and the delete-permission rule, and each runs its own `createRevision`/`deletePost` mutation (`DeliverableCard.jsx:195, 209`). | NEEDS IMPROVEMENT |
| `DraftPostForm.jsx` (1417 lines) is the largest file in scope. It holds constants (L81-217), file and media handling, platform scheduling and the form. Split the media uploader, the per-platform schedule editor and the deliverable-type picker into sub-components, and move constants to `lib/`. | NEEDS IMPROVEMENT |
| The **two deliverable list implementations** don't follow the documented "reusable tab with `clientId`" pattern. The global page is `Posts.jsx` (690 lines: filters, card and table views, health filter, campaign filter). The client page is `WorkflowTab.jsx` + `DraftPostList.jsx` (status tabs and "my work" only, card view only). Status tabs and counts are re-implemented in each. Convert to one `DeliverablesTab({ clientId })`. `DraftPostList` is also misnamed: it lists all statuses, under query key `['draft-posts', id]`. | NEEDS IMPROVEMENT |
| `Posts.jsx:60` imports `CalendarPostCard` from `pages/calendar`, but it never renders meetings, so it should import `DeliverableCard` directly. `CalendarPostCard.jsx` (15 lines) is a shim used only by `DayDetailDialog.jsx:204`. Move it next to `DayDetailDialog` or inline it. `MeetingCard.jsx` sits under `components/deliverables/` but is not a deliverable. | NEEDS IMPROVEMENT |
| `Posts.jsx:70` imports `UrgencyFilter` from `pages/clients/ClientFilters`, which couples two pages. Move it to `components/`. | NEEDS IMPROVEMENT |
| `socialMediaPreview/*` (5 platform previews + dispatcher) is solid. However, `PublicReview.jsx:47-51, 179-185` re-implements the dispatcher instead of reusing `SocialMediaPreview`'s switch. Export the switch as `<PlatformPreview platform=…>`. | CAN STAY / minor consolidation |
| `VersionSidebar.jsx`, `ClientNotes.jsx` | CAN STAY |

---

## 3. Calendar

| Finding | Class |
|---|---|
| `src/pages/calendar/PostDetailDialog.jsx` (101 lines) has no importer. | **REMOVE** |
| **Workspace scoping:** `ContentCalendar.jsx:113-124` passes `user?.id` to `fetchGlobalCalendar`. The RPC `get_global_calendar` filters `WHERE c.user_id = p_user_id` (`supabase/migrations/20260705083546_get_global_calendar_add_created_by.sql:32`). By the CLAUDE.md workspace model, invited members (whose `user.id` ≠ the owner's) would get an empty calendar. Use `workspaceUserId`. Verify in the app. | NEEDS IMPROVEMENT (likely bug) |
| `fetchGlobalCalendar` is passed `clientId` (`ContentCalendar.jsx:122`) but ignores it (`posts.js:562`). Filtering happens client-side. | NEEDS IMPROVEMENT |
| The status filter compares raw `post.status` (`ContentCalendar.jsx:185`), while the cells colour by `getPublishState()` (`MonthView.jsx:109`, `WeekView.jsx:177`). The "Partially Published" legend chip (L83, L537-541) therefore never matches anything. `useCalendarReport.js:42` also groups by raw status. | NEEDS IMPROVEMENT (bug) |
| `useCalendarReport.js` exports pure functions; it is not a hook. Rename it, e.g. `calendarReport.js`. | NEEDS IMPROVEMENT (naming) |
| `MonthView` / `WeekView` duplicate `STATUS_STYLES` and `PLATFORM_ICONS` (§0.2, §0.3). | NEEDS IMPROVEMENT |
| `CalendarReportPDF.jsx` `STATUS_LABELS` covers only half the statuses (§0.2). | NEEDS IMPROVEMENT |
| `DayDetailDialog.jsx`, `MonthView`/`WeekView` layout logic (`assignColumns`) | CAN STAY |
| For a client portal (roadmap 04, read-only calendar), the calendar is tightly bound to agency-auth `useAuth()`, `useClients()`, meetings and `DraftPostForm` creation. Separate a presentational `CalendarGrid` from the agency container. | NEEDS IMPROVEMENT (roadmap blocker) |

---

## 4. Approvals, submissions & public review

| Finding | Class |
|---|---|
| `ApprovalsPage.jsx` (710) and `SubmissionsPage.jsx` (518) duplicate avatar, initials, thumbnail, `ColHeader` and tab class helpers (§0.3). The structure (TanStack table + paging) is otherwise sound. | NEEDS IMPROVEMENT (extract shared pieces) / CAN STAY overall |
| Naming collision: the Submissions "approved" tab maps to `READY` (`SubmissionsPage.jsx:133-137`), while the enum also has `APPROVED` with a different meaning (client-approved non-social). Rename the tab "Ready" or "Internally approved". | NEEDS IMPROVEMENT |
| **The "client approves" business rule is duplicated client-side** in both public pages: approve → `SCHEDULED` when it has platforms, else `APPROVED` (`PublicReview.jsx:139-143`, `CampaignReview.jsx:438`). It belongs inside `update_post_status_by_token`, so a client portal or mobile app can't diverge. | NEEDS IMPROVEMENT (roadmap blocker) |
| `PublicReview.jsx:145` calls `supabase.rpc('update_post_status_by_token')` directly. That duplicates `submitCampaignPostReview` (`campaigns.js:277`), which is the same RPC and should become a shared `submitPostReview` in `posts.js`. `PublicReview.jsx:154` uses **`alert()`**, which violates the sonner convention. | NEEDS IMPROVEMENT |
| `PublicReview.jsx` (786) and `CampaignReview.jsx` (568) are two separate review UIs (branding header, media gallery, approve/revise panel). The single-post page has platform previews; the campaign page doesn't. Extract a shared `ReviewPanel` + `MediaGallery` + `BrandingHeader`. This is also the natural seed for the client-portal approval flow. | NEEDS IMPROVEMENT |
| Edge function `send-approval-email` "Scenario 3" (`supabase/functions/send-approval-email/index.ts:265`, `record.status === 'PUBLISHED'`) has no caller. Client code sends only `PENDING_APPROVAL` (`PostActionDialogs.jsx:85`, `PostDetails.jsx:323`). DB triggers send only `SCHEDULED`/`NEEDS_REVISION`. Published notifications go through `send-platform-published-email`. It is likely a dead branch. | **REMOVE** (after confirming no DB webhook) |
| CLAUDE.md claims `send-approval-email` is "triggered from PostDetails.jsx on status change to PENDING_APPROVAL, SCHEDULED, NEEDS_REVISION, or PUBLISHED". In reality: PENDING_APPROVAL comes from the client, and SCHEDULED/NEEDS_REVISION come from the DB (`update_post_status_by_token` via `net.http_post`). `.claude/rules/supabase-patterns.md` "Current functions" lists 3 of 15. | stale doc |

---

## 5. Campaigns

| Finding | Class |
|---|---|
| `POST_STATUS_STYLES` in `LinkPostsToCampaignDialog.jsx:32-41` is dead: the file renders `<StatusBadge>` at L251. | **REMOVE** |
| `useUnlinkPostFromCampaign` is unused (§2.1). | **REMOVE** |
| `CampaignDetailPage.jsx` (1257 lines) is the second-largest file. It has 5 tabs inline: posts L510, finance L754-1095 (about 340 lines including invoice/transaction dialogs), tasks, meetings and discussion. It calls `supabase.functions.invoke('send-campaign-review-email')` directly (L302). Split it into `CampaignPostsTab`, `CampaignFinanceTab` and so on, and move the email to `src/api/campaigns.js`. | NEEDS IMPROVEMENT |
| The campaign status style map (`Active`/`Completed`/`Archived`) is duplicated with **different colours** in `CampaignCard.jsx:17` and `CampaignDetailPage.jsx:139`. Add a `CAMPAIGN_STATUS_CONFIG`. | NEEDS IMPROVEMENT |
| `CampaignCard.jsx:24 PIPELINE_COLORS` hard-codes post-status colours that duplicate `POST_STATUS_CONFIG`. It also only knows draft/pending/revision/approved/scheduled, matching the RPC `get_campaigns_with_post_summary` counts, which ignore SUBMITTED/READY/DELIVERED/PUBLISHED. | NEEDS IMPROVEMENT |
| The review URL is built from `window.location.origin` (`CampaignDetailPage.jsx:323`) rather than `VITE_APP_URL`, which is used for invite links. Centralize it in a `buildReviewUrl()` helper. | NEEDS IMPROVEMENT |
| `WorkflowHealth.jsx` is well factored (prop-driven). However, it is **used only by `CampaignDetailPage.jsx:681`**; CLAUDE.md says "dashboard, client detail, and campaign detail". The dashboard (`ContentPipelineBar.jsx`) and the client page (`OverviewTab.jsx`) re-implement it. | CAN STAY (component) / NEEDS IMPROVEMENT (adopt it, fix doc) |
| `CampaignsPage` → `CampaignTab` reuse, `AssignCampaignDialog`, `CampaignDialog`, `CampaignReportPDF`, `useCampaign*` read hooks, `src/tests/campaigns/phase1-3` | CAN STAY |

---

## 6. Comments

| Finding | Class |
|---|---|
| `CommentThread.jsx` (796 lines) is used by posts, campaigns and tasks, and has tests (`src/tests/comments/`). It is functionally solid. | CAN STAY |
| It duplicates chat: `groupReactions` (`CommentThread.jsx:67` vs `ChatThread.jsx:154`, near-identical), `ReactionTriggerButton`, the mention autocomplete state machine (`CommentThread.jsx:353, 421-425` vs `ChatThread.jsx:597-601, 770-780`) and the emoji list (`comments.js:176 REACTION_EMOJIS` vs `chat.js:18 CHAT_REACTION_EMOJIS`, which are identical; `chat.js:15-17` justifies keeping them separate). Extract `useMentionAutocomplete`, `ReactionPicker`/`ReactionPills` and `groupReactions` into `src/components/collab/`. | NEEDS IMPROVEMENT |
| `src/api/comments.js` (`commentKeys`, `useComments`, `useCommentCount`, CRUD and `toggleReaction`) follows conventions. | CAN STAY |

---

## 7. Routes & legacy

| Finding | Class |
|---|---|
| `/posts` → `/deliverables` redirect (`App.jsx:267`) has no in-app callers. Keep it for bookmarks for now. | CAN STAY (time-box) |
| `/clients/:clientId/posts/:postId` → `LegacyPostRedirect` (`App.jsx:189-193, 253-256`). It **cannot be removed yet**: DB triggers still mint the legacy path, at `supabase/migrations/20260909122643_task_comments.sql:81` and `20260910095516_notify_newly_added_task_participants.sql:60` (`'/clients/' || … || '/posts/' || …`). Fix those trigger functions to emit `/deliverables/`, then remove the redirect after the 30-day notification retention passes. | NEEDS IMPROVEMENT → later REMOVE |
| `.claude/rules/routing.md` is stale. It is missing `/approvals`, `/submissions`, `/tasks/:id`, `/chat`, `/proposals*`, `/prospects*`, `/team`, `/ads`, `/partnerships` and the legacy post redirect, and it lists `NotesAndReminders` and the 5-tab client page. | stale doc |
| `App.jsx:5` imports `'../src/context/AuthContext'`. That odd path should be `@/context/AuthContext`. | trivial fix |

---

## 8. Roadmap blockers summary (auto-publishing #01, client portal #04)

1. **Server-owned state machine.** `SCHEDULED`/`PUBLISHED`/`DELIVERED`/`APPROVED` and per-platform `published_at` are written by raw client updates (`PostDetails.jsx:166-275`, `posts.js:387`). The published email is fired from React `onSuccess`. A cron publisher needs a `mark_platform_published(version_id, platform)` RPC that sets `platform_schedules`, rolls up to `PUBLISHED` and enqueues the email.
2. **The approval rule lives in the browser** (`PublicReview.jsx:141`, `CampaignReview.jsx:438`). Move it into `update_post_status_by_token`, or into a new authenticated `client_review_post` RPC for the portal.
3. **Post identity.** The route `:postId` is ambiguous (version vs post), and `id` means different things per fetcher. The portal and publish queue need stable `post_id` + `version_id`.
4. **Calendar coupling** to agency auth and agency-only data (§3).
5. **Two review UIs** to merge before building a third (the portal).
6. **No tests** around statuses or `getPublishState`; add them before changing the state machine.

## 9. Quick-win REMOVE list (all grep-verified)
- `src/pages/clients/clientSections/ComingSoon.jsx`
- `src/pages/posts/postDetails/MediaPreview.jsx`
- `src/pages/calendar/PostDetailDialog.jsx`
- `createPostRevision` — `src/api/posts.js:414-452`
- `useUnlinkPostFromCampaign` — `src/api/campaigns.js:161`
- `POST_STATUS_STYLES` — `src/components/campaigns/LinkPostsToCampaignDialog.jsx:32-41`
- `isVideoContent` — `src/pages/posts/DraftPostForm.jsx:204-217`
- `getIndustryColor` — `src/lib/industries.js:32` (or adopt)
- `effectivePlatformDate` — `src/lib/helper.js:60` (or adopt)
- Legacy `PENDING`/`REVISIONS` remap — `src/pages/dashboard/ContentPipelineBar.jsx:65-66`
- `send-approval-email` PUBLISHED branch (after verifying no webhook)
- `trigger_client_welcome_email` DB trigger (after verifying on remote; it duplicates `createClient`'s invoke)
