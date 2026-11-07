# Tercero — Cross-cutting Cleanup / Maintainability Audit

Scope: dependencies, `src/api/` conventions, `src/lib|utils|hooks`, `src/components/ui`, dead files, large files, tests/lint/build, docs, `supabase/`. No files were edited. No security analysis.
Method: custom import-graph script (resolves `@/` alias + relative, reachability from `src/main.jsx`), export-usage script, greps, and running `npm test`, `npm run lint`, `npm run build` on `main` @ 1d403e7 (clean tree).

Legend: **REMOVE** / **NEEDS IMPROVEMENT** / **CAN STAY**

---

## 0. Test / Lint / Build results

| Command | Result |
|---|---|
| `npm test` (vitest run) | **FAIL** — 5 files: 4 failed / 1 passed. **80 tests: 38 failed / 42 passed** (30.6s) |
| `npm run lint` | **FAIL** — **94 problems: 58 errors, 36 warnings** |
| `npm run build` | **PASS** (34.7s) with chunk-size warning |

### Tests (detail)
- Files: `src/tests/campaigns/phase1.test.jsx` (22 tests, 8 fail), `phase2.test.jsx` (21, 4 fail), `phase3.test.jsx` (25, 21 fail), `src/tests/comments/CommentThread.test.jsx` (5 fail — all), `src/tests/comments/mentions.test.js` (7, all pass).
- Dominant failure causes (stale mocks vs. evolved code, not product bugs per se):
  - 21x `vi.mocked(...).mockReturnValue is not a function` — the module mocked in the test no longer exports the function the component now calls (e.g. phase3 `CampaignReview` now uses different API entry points).
  - 2x `Cannot destructure property 'setHeader' of useHeader(...)` — `vi.mock('@/components/misc/header-context', () => ({ useHeader: vi.fn() }))` (phase1.test.jsx:59) returns undefined.
  - `useLocation() may be used only in the context of a <Router>` — `CommentThread.jsx:346` now calls `useSearchParams()`; test renders without a router.
  - 1 timeout, several assertion mismatches (text `/30%/`, etc.).
- Coverage: only **Campaigns** (phase 1–3) and **Comments** are tested. Nothing for tasks, chat, finance/invoices, proposals, team/RBAC, posts/versioning, permissions (`lib/permissions.js` is pure and trivially testable), `helper.js`, `finance.js`, `post-statuses.js`.
- Config: `vitest.config.js` duplicates the alias from `vite.config.js` (separate file, plugin `react()` only, `globals: true`, jsdom, setup `src/tests/setup.js`). No coverage provider configured. **NEEDS IMPROVEMENT**: either `mergeConfig` with `vite.config.js` or a `test` block inside it; fix or delete stale tests so the suite can gate CI.

### Lint (by rule)
| Rule | Count | Sev |
|---|---|---|
| `no-unused-vars` | 44 | error |
| `react-hooks/set-state-in-effect` ("Calling setState synchronously within an effect") | ~8 | error |
| `react-hooks/purity` / `static-components` ("Cannot call impure function during render", "Cannot create components during render") | ~3 | error |
| `react-refresh/only-export-components` | 17 | warn |
| `react-hooks/exhaustive-deps` | 11 | warn |
| `react-hooks/incompatible-library` (TanStack Table / RHF `watch`) | ~6 | warn |
| `no-undef` | 1 | error — `src/tests/setup.js:4` `global` (tests have no vitest/node globals in eslint config) |
| `no-empty`, `no-control-regex` | 1 each | error |

58 files flagged (list in raw log). `eslint.config.js` has no override for `src/tests/**` (vitest globals / node) and no override for `src/components/ui/**` (shadcn files trip `only-export-components`). **NEEDS IMPROVEMENT**: add those two overrides; 44 unused-vars are cheap removals.

### Build
- Single JS chunk **`index-*.js` 4,916 kB (1,429 kB gzip)**, CSS 271 kB. `(!) Some chunks are larger than 500 kB`.
- Cause: `src/App.jsx` imports every page eagerly — `grep -c "lazy(" src/App.jsx` = 0. `@react-pdf/renderer`, Tiptap, recharts, embla, dnd-kit all land in the entry chunk, including for public routes (`/review/:token`, `/proposal/:token`).
- **NEEDS IMPROVEMENT (high value)**: `React.lazy` per route (at minimum: public review pages, finance, notes editor, reports, proposals, chat) and dynamic `import()` of the PDF utils in `src/utils/download*PDF.jsx`.

---

## 1. Dependencies (`package.json`)

Verified by scanning every `import`/`export from`/dynamic import in `src/`.

### REMOVE (no import anywhere in src)
| Package | Evidence |
|---|---|
| `@dnd-kit/sortable` | 0 imports; only `@dnd-kit/core` used (MeetingsPage.jsx:11, TasksAndReminders.jsx:18) |
| `@dnd-kit/utilities` | 0 imports |
| `@radix-ui/react-dialog` | 0 imports — `ui/dialog.jsx` and `ui/sheet.jsx` use `radix-ui` monopackage |
| `@radix-ui/react-separator` | 0 imports — `ui/separator.jsx` uses `radix-ui` |
| `react-easy-crop` | 0 imports — cropping uses `react-image-crop` (HorizontalLogoCropDialog.jsx) |
| `vaul` | only imported by `ui/drawer.jsx`, which is itself never imported (see §4) |
| `@base-ui/react` | only imported by `ui/combobox.jsx`, which is never imported |

### NEEDS IMPROVEMENT
- **Mixed Radix packaging.** 20 files import from the `radix-ui` monopackage, 13 shadcn files still import individual `@radix-ui/react-*` (avatar, badge, breadcrumb, checkbox, dropdown-menu, form, label, popover, progress, select, sidebar, tabs, tooltip — all in `src/components/ui/`). Two copies of Radix primitives get bundled. Standardise on `radix-ui` (newer shadcn output) and drop the 10 `@radix-ui/react-*` deps. Also `src/components/documents/CollectionCard.jsx` imports `Accordion` straight from `radix-ui` (violates "never import radix directly" rule; use `@/components/ui/accordion`).
- **Undeclared dependency:** `@tiptap/core` imported in 4 files (`components/notes/editor/ImageNode.js`, `VideoNode.js`, `slash-command.js`, `table-with-title.js`) but not in `package.json` — works only as a transitive dep. Add it explicitly.
- `tippy.js` is used directly only in `slash-command.js`; fine but pinned to Tiptap v2 (Tiptap v3 drops tippy). CAN STAY until a Tiptap upgrade.
- `@types/node`, `@types/react`, `@types/react-dom` in a plain-JS project: only for editor IntelliSense via `jsconfig`. CAN STAY.
- `shadcn` (devDep) and `tailwindcss`/`@tailwindcss/vite` in `dependencies` rather than `devDependencies` — cosmetic for an SPA. CAN STAY.
- `package.json` `"name": "social-media-management"`, `version 0.0.0` — cosmetic.

### CAN STAY (single library per job confirmed)
`embla-carousel-react` (ui/carousel → CampaignDetailPage, InstagramPreview), `cmdk` (ui/command), `react-day-picker`, `recharts`, `@tanstack/react-table`, `@vercel/analytics` (main.jsx), `react-image-crop`, `next-themes`, `sonner`.

---

## 2. `src/api/` vs `.claude/rules/api-conventions.md`

29 modules, 6,605 lines. Largest: `posts.js` 830, `invoices.js` 497, `team.js` 482, `clients.js` 400, `proposals.js` 388.

### NEEDS IMPROVEMENT — rule vs reality (mutation hooks)
The rule says "Never wrap mutations in React Query hooks at the API layer". In practice **46 `useMutation` hooks** live in the API layer across 10 modules: `campaigns.js` (8), `invoices.js` (7), `team.js` (5), `proposals.js` (5), `expenses.js` (4), `prospects.js` (4), `transactions.js` (3), `feedback.js` (2), `prospectActivities.js` (2), `posts.js` (1). The root CLAUDE.md even endorses one (`useGenerateInvite()`). The convention has de-facto flipped: hooks centralise invalidation, which is better. **Recommend updating the rule** to "plain async function + optional `useXxxMutation` wrapper that owns invalidation", rather than refactoring code to the old rule.

### NEEDS IMPROVEMENT — reads not in the API layer
- `posts.js` exposes reads as plain `fetchXxx` (`fetchAllPostsByClient`:8, `fetchAllDeliverables`:68, `fetchPostSummary`:116, `fetchPostDetails`:171, `fetchGlobalCalendar`:562) and components wrap them in their own `useQuery` with ad-hoc keys. `useQuery(` appears directly in **28 page/component files** (e.g. `components/tasks/EditTaskDialog.jsx` 3, `PostDetails.jsx` 2, `DashboardMeetingsNotes.jsx` 2, `OverviewTab.jsx` 2, `ClientWeekTimeline.jsx` 2, `ContentCalendar.jsx` 2, `CreateTaskDialog.jsx` 2, + 21 with 1). Keys like `['calendar']`, `['global-calendar']`, `['draft-posts']`, `['client', id]` are invalidated from `campaigns.js:153-194` / `invoices.js:336` but defined only inside components — key drift risk. Add `usePostsByClient`, `usePostDetails`, `useGlobalCalendar` etc. hooks + a `postKeys` factory.
- `meetings.js`, `agency.js`, `storage.js`, `noteMedia.js` export **zero** hooks — all reads happen in components.

### NEEDS IMPROVEMENT — query-key consistency
Three styles coexist:
1. Key factories (good): `chatKeys`, `commentKeys`, `documentKeys`, `expenseKeys`, `invoiceKeys`, `recurringInvoiceKeys`, `noteShareKeys`, `notificationKeys`, `teamKeys`, `transactionKeys`.
2. Hierarchical inline arrays: `['campaigns','list',…]`, `['proposals','detail',id]`, `['tasks','for-post',id]`, `['agency-notes','list',{userId}]`.
3. Flat legacy (matches the rule doc but not the rest): `['clients-list', id]`, `['clients-pipeline-dashboard']`, `['pending-approvals', id]`, `['global-posts', …]`, `['subscription', id]`, `['prospect-activities', id]`, `['campaign-transactions', id]`.
- `clients.js:46` `['clients-pipeline-dashboard']` is **not scoped by workspace** (every other workspace-scoped key includes the id) — cross-account cache bleed when switching accounts (account switcher exists in `lib/accountSwitcher.js`).
- Some keys scope by `user.id` (chat, notifications, my-tasks) — correct there (per-user data) but the rule doc example `['clients-list', user?.id]` contradicts the workspace model.
Recommend: one `xxxKeys` factory per module; update rule doc.

### NEEDS IMPROVEMENT — enabled guards missing (id-dependent queries)
`campaigns.js:57` `useCampaignAnalytics(campaignId)`, `campaigns.js:260` (review by token), `reports.js:14` `useClientReportData(clientId)`, `chat.js:204` messages(channelId), `comments.js:113` thread, `proposals.js:27`, `team.js:51`, `team.js:312`, `clients.js:45`. Some may guard inside `queryFn` (verify each), but the rule requires `enabled`.

### NEEDS IMPROVEMENT — error handling / logging
- Swallowed errors (log-and-continue): `appConfig.js:18`, `proposals.js:244,260,265`, `prospectActivities.js:111`, `prospects.js:181-183`, `posts.js:325,494,824`, `clients.js:169-171,256,269,308`. Mostly storage cleanup (intentional best-effort) — CAN STAY but should be documented as such. `posts.js:343-344` and `clients.js:321-322` `catch → console.error` — verify they rethrow.
- `console.log` left in `clients.js:258,271,310` — REMOVE.

### REMOVE / NEEDS IMPROVEMENT — small items
- `posts.js:777` — `import { useMutation, useQueryClient }` in the **middle of the file** (after line 776). Move to top.
- `posts.js:418` `createPostRevision` — unused export (no caller); `createRevision`:400 is the live one. **REMOVE** after confirming.
- `campaigns.js` `useUnlinkPostFromCampaign` — unused. `documents.js` `useDocument` — unused. `meetings.js` `fetchUpcomingMeeting` — unused. `notifications.js` `notifyFromMutation` — unused (and `notify()` is documented as intentionally unused). **REMOVE** (or keep `notify` with its comment).
- `useGlobalPosts.js`, `useSubscription.js`, `usePermissions.js` use hook-style filenames while all other modules are domain-named — rename candidates (`globalPosts.js`, `subscription.js`, `permissions.js`) — low priority.
- Module boundaries: `agencyNotes.js` / `noteMedia.js` / `noteShares.js` / `noteTags.js` → could merge into `notes.js` (4 tiny files, 29–100 lines). `reports.js` (27 lines), `storage.js` (31), `appConfig.js` (32) are fine small. `posts.js` (830) should split: `posts.js` (CRUD/media), `approvals.js` (internal approval queue, lines 599–775), `postReview.js` (public token, 790+).

### Direct `supabase.` usage outside `src/api/` (convention violation)
| File | Count |
|---|---|
| components/settings/ChangePasswordDialog.jsx | 7 |
| pages/settings/AgencySettings.jsx | 6 |
| context/AuthContext.jsx | 6 (acceptable — auth owner) |
| components/auth/ForgotPasswordDialog.jsx | 6 |
| pages/settings/ProfileSettings.jsx | 5 |
| pages/settings/InvoiceSettings.jsx | 4 |
| pages/posts/postDetails/PostDetails.jsx | 4 |
| pages/clients/CreateClientPage.jsx | 4 |
| pages/onboarding/uploads.js | 3 |
| pages/JoinTeam.jsx | 3 (incl. `functions.invoke('send-team-welcome')`) |
| components/auth/signup-form.jsx | 2 |
| utils/downloadInvoicePDF.jsx | 1 |
| pages/posts/postDetails/PostActionDialogs.jsx | 1 |
| pages/dashboard/DashboardScheduledPosts.jsx | 1 (dead file) |
| pages/campaigns/CampaignDetailPage.jsx | 1 (`send-campaign-review-email`) |
| pages/billingAndUsage/TertiarySubscriptionTab.jsx | 1 |
| pages/TrialExpired.jsx, SubscriptionExpired.jsx, PublicReview.jsx, NoWorkspaceAccess.jsx | 1 each |
**Total ≈ 59 call sites in 20 files.** Auth flows (login/signup/password/AuthContext) are defensible; settings pages (AgencySettings/ProfileSettings/InvoiceSettings ≈ 15 calls), PostDetails, CreateClientPage should move into `src/api/agency.js` / `posts.js` / `clients.js`.

---

## 3. `src/lib/`, `src/utils/`, `src/hooks/`

### Dead exports (no reference outside defining file, tests excluded)
| Export | File | Action |
|---|---|---|
| `effectivePlatformDate` | lib/helper.js | **REMOVE** or use — documented in CLAUDE.md as a shared helper but has 0 callers |
| `getIndustryColor` | lib/industries.js | **REMOVE** — documented in CLAUDE.md, 0 callers |
| `SYSTEM_ROLES`, `DOCUMENT_LEVELS`, `MEMBER_DEFAULT_PERMISSIONS` | lib/permissions.js:1-12 | NEEDS IMPROVEMENT — role strings are hardcoded elsewhere instead of using `SYSTEM_ROLES`; either adopt or remove |
| `INVOICE_REQUIRED_CATEGORIES` | utils/constants.js | REMOVE |
| `getLinkedAccount`, `generateInvoicePDFBlob`, `ONBOARDING_STEP_KEYS`, `completeFullAgencySetup`, `setupBrandingOnly`, `replaceTaskDeliverables`, `expenseKeys`, `recurringInvoiceKeys`, `DEFAULT_INVITE_PERMISSIONS`, `defaultInviteExpiry`, `useWorkspaceOwner` | various | CAN STAY — used internally; just drop the `export` if not part of a public surface |

### Duplicated helpers — NEEDS IMPROVEMENT
- **Currency formatting:** canonical `formatCurrency` in `utils/finance.js:4`, yet local copies in `components/HTMLInvoicePreview.jsx:5`, `components/InvoicePDF.jsx:209`, `components/proposals/ProposalPDF.jsx:229`, `components/proposals/ProposalPreview.jsx:3`, `components/reports/ClientReportPDF.jsx:127`, `components/campaigns/CampaignReportPDF.jsx:214`, `pages/reports/ReportsPage.jsx:45`, `pages/campaigns/CampaignDetailPage.jsx:242`. 14 files call `Intl.NumberFormat`/`toLocaleString('en-IN')` directly. (PDF files may need a react-pdf-safe variant, e.g. "Rs." instead of "₹" — consolidate into one helper with an option.)
- **Date formatting:** `lib/helper.js:106 formatDate` vs local `fmtDate` in HTMLInvoicePreview:16, InvoicePDF:221, ProposalPDF:237, ProposalPreview:11, ClientReportPDF:135; local `formatDate` in `pages/clients/ClientCard.jsx:114`, `PostContent.jsx:355`; `formatDateRange` defined identically 3x (`CampaignCard.jsx:83`, `CampaignReportPDF.jsx:205`, `CampaignDetailPage.jsx:145`); `timeAgo` in `SubmissionsPage.jsx:43`.
- **Initials:** `getInitials`/`initials` reimplemented in ≥10 places (AppHeader:149, NotificationBell:103, nav-header:55, nav-user:78 `initialsFor`, ApprovalsPage:102, SubmissionsPage:34, ClientCard:127, ClientProfileView:57, PostContent:68, TeamSettings:845, TeamPage:110, ProspectDetailPage:186, DeliverableCard:506). Add `getInitials()` to `lib/helper.js`.
- **Post status maps:** `lib/post-statuses.js` claims "single source of truth", but status styling/labels are re-declared in `pages/calendar/MonthView.jsx:24`, `WeekView.jsx:23`, `CalendarReportPDF.jsx:43`, `ContentCalendar.jsx:73`, `DayDetailDialog.jsx:35`, `components/campaigns/LinkPostsToCampaignDialog.jsx:32`, `CampaignDetailPage.jsx:139`, `components/reports/ClientReportPDF.jsx:116`, `pages/reports/ReportsPage.jsx:34`, `components/StatusBadge.jsx:6` (verify StatusBadge derives from POST_STATUS_CONFIG).
- **Proposal status maps** in 3 places: `components/proposals/ProposalTab.jsx:66`, `pages/proposals/ProposalDetailPage.jsx:81`, `pages/proposals/ProposalsPage.jsx:75`.
- **Prospect status dots** in `components/prospects/ProspectCard.jsx:20` and `pages/prospects/ProspectDetailPage.jsx:53` despite exported `PROSPECT_STATUS_CONFIG`.
- **Task priority:** `PRIORITY_CONFIG` re-declared as an array in `components/tasks/CreateTaskDialog.jsx:37` and `EditTaskDialog.jsx:35`, while `TaskCard.jsx:90` exports the canonical one. Also canonical task configs living in a component file (`TaskCard.jsx`) causes `react-refresh/only-export-components` warnings — move to `lib/task-statuses.js`.
- **Platform maps:** `lib/platforms.js` exists, yet `PLATFORM_*` maps in `components/PlatformIcon.jsx:55`, `ApprovalsPage.jsx:84`, `ContentCalendar.jsx:87`, `MonthView.jsx:17`, `WeekView.jsx:16`, `DraftPostForm.jsx:165`, `PostContent.jsx:121,132`, `Posts.jsx:107`.

### Misplaced / organisation — NEEDS IMPROVEMENT
- `lib/` vs `utils/` split is arbitrary: `utils/finance.js` + `utils/constants.js` are pure helpers like `lib/*`; `utils/download*PDF.jsx` are feature code. Suggest: `lib/` for pure helpers, move PDF downloaders next to their PDF components (or `src/pdf/`).
- `lib/job-roles.js` (12 lines) is just a re-export alias of `lib/noteTags.js` — CAN STAY (documented intent), but naming `noteTags` for a shared palette is misleading; rename to `lib/label-colors.js`.
- `lib/react-query.js` (QueryClient defaults) — CAN STAY.
- `hooks/` has only 2 files; hook-like files elsewhere (`api/useSubscription.js`, `api/usePermissions.js`, `components/misc/header-context.jsx`). CAN STAY.
- 73 files use relative imports (`../`, `./`) contrary to the "always `@/`" rule (excluding `components/ui`). Low priority; an eslint `no-restricted-imports` pattern would enforce it.
- `alert()` still used at `pages/PublicReview.jsx:154` (rule: always sonner) — NEEDS IMPROVEMENT.

---

## 4. `src/components/ui/`

### REMOVE — shadcn components never imported
`button-group.jsx`, `combobox.jsx` (only `@base-ui/react` user), `drawer.jsx` (only `vaul` user), `field.jsx`, `item.jsx`, `pagination.jsx`, `slider.jsx`, `spinner.jsx`, `toggle-group.jsx`, and transitively `toggle.jsx` (only imported by toggle-group). Verified 0 importers each via `grep "ui/<name>['\"]"`. (They can be re-added any time with `npx shadcn add`.)

### CAN STAY — low use but live
`aspect-ratio` (1), `breadcrumb` (1), `command` (1), `sonner` (1), `accordion` (2), `carousel` (2), `collapsible` (2), `hover-card` (2), `radio-group` (2), `progress` (3), `input-group` (3).

### Custom primitives
- `bubble.jsx`, `message.jsx` (ChatThread), `attachment.jsx` (UploadMetaDialog, DraftPostForm) — registry-style components, not duplicates of shadcn. CAN STAY.
- `stat-bar.jsx`, `empty.jsx` — documented custom primitives. CAN STAY.
- `sidebar.jsx` 689 lines is stock shadcn. CAN STAY.

---

## 5. Dead files (import-graph from `src/main.jsx`, 358 files scanned, 333 reachable)

Script: `scratchpad/dead.mjs`. Each verified by grepping the basename.

| File | Lines | Evidence | Action |
|---|---|---|---|
| `src/AppShell.jsx` | 21 | Imports `./AppHeader` which **does not exist** at `src/` (unresolved import). App.jsx:12 uses `components/misc/AppShell`. Last touched d29f1a6 | **REMOVE** |
| `src/App.css` | 42 | Vite template CSS (`#root { max-width:1280px … }`); not imported | **REMOVE** |
| `src/components/sidebar/nav-secondary.jsx` | 158 | `NavSecondary` referenced only in itself | **REMOVE** |
| `src/pages/billingAndUsage/InvoicesTab.jsx` | 21 | App.jsx:24 imports `pages/finance/InvoicesTab`; no importer | **REMOVE** |
| `src/pages/calendar/PostDetailDialog.jsx` | 101 | 0 references | **REMOVE** |
| `src/pages/clients/clientSections/ComingSoon.jsx` | 11 | Ads/Partnerships import `@/components/misc/ComingSoon` instead | **REMOVE** |
| `src/pages/dashboard/DashboardScheduledPosts.jsx` | 162 | 0 references (also has a direct `supabase.` call) | **REMOVE** |
| `src/pages/posts/postDetails/MediaPreview.jsx` | 50 | Name hits are only `SocialMediaPreview`/`InstagramPreview`; 0 imports | **REMOVE** |
| 9 ui files + `toggle.jsx` | — | see §4 | **REMOVE** |

~566 lines of dead page/shell code + 10 ui files.

---

## 6. Largest files (top 25, `wc -l`)

| Lines | File |
|---|---|
| 1417 | src/pages/posts/DraftPostForm.jsx |
| 1394 | src/pages/settings/TeamSettings.jsx |
| 1257 | src/pages/campaigns/CampaignDetailPage.jsx |
| 1208 | src/pages/proposals/ProposalDetailPage.jsx |
| 1044 | src/pages/TasksAndReminders.jsx |
| 1041 | src/pages/settings/AgencySettings.jsx |
| 1021 | src/components/chat/ChatThread.jsx |
| 985 | src/pages/posts/postDetails/PostContent.jsx |
| 952 | src/pages/TeamPage.jsx |
| 928 | src/pages/clients/clientSections/OverviewTab.jsx |
| 835 | src/pages/finance/InvoicesTab.jsx |
| 830 | src/api/posts.js |
| 796 | src/components/comments/CommentThread.jsx |
| 786 | src/pages/PublicReview.jsx |
| 774 | src/pages/documents/DocumentsPage.jsx |
| 771 | src/pages/clients/CreateClientPage.jsx |
| 756 | src/pages/finance/EditInvoiceDialog.jsx |
| 727 | src/pages/settings/SupportSettings.jsx |
| 710 | src/pages/approvals/ApprovalsPage.jsx |
| 690 | src/pages/Posts.jsx |
| 689 | src/components/ui/sidebar.jsx (stock shadcn — leave) |
| 686 | src/components/proposals/ProposalDialog.jsx |
| 680 | src/pages/MeetingsPage.jsx |
| 658 | src/components/deliverables/DeliverableCard.jsx |
| 645 | src/pages/finance/CreateInvoiceDialog.jsx |

Split candidates (NEEDS IMPROVEMENT): `TeamSettings.jsx` (exports `InviteDialog`/`EditAccessDialog` used by TeamPage + onboarding — move them to `components/team/`); `DraftPostForm.jsx` (page + dialog + platform config); `CreateInvoiceDialog.jsx` vs `EditInvoiceDialog.jsx` (1,401 lines combined — likely one shared `InvoiceForm`); `CampaignDetailPage.jsx` (KPI bar, budget, share dialog, invoices panels); `ChatThread.jsx` (composer/reactions/mentions, as CLAUDE.md admits); `TasksAndReminders.jsx` (3 views).

---

## 7. Docs vs code

### `.claude/rules/post-versioning.md` — STALE (NEEDS IMPROVEMENT)
- Status list `DRAFT | PENDING | REVISIONS | SCHEDULED | ARCHIVED` and the flow diagram are wrong. Real statuses (`src/lib/post-statuses.js`): `DRAFT, SUBMITTED, CHANGES_REQUESTED, READY, PENDING_APPROVAL, APPROVED, NEEDS_REVISION, SCHEDULED, DELIVERED, PARTIALLY_PUBLISHED (derived), PUBLISHED, ARCHIVED`.
- `create_post_draft_v3` example omits real params `p_user_id`, `p_admin_notes`, `p_platform_schedules`, `p_campaign_id`, `p_deliverable_type` (`api/posts.js:258-270`).
- Missing `platform_schedules`, `created_by`, deletion RLS rule, deliverable type.
- Same stale status list repeated in `.claude/CLAUDE.md:74` ("Statuses: DRAFT, PENDING, REVISIONS, SCHEDULED, ARCHIVED") — contradicts the same file's deletion section (`DRAFT/SUBMITTED/ARCHIVED`, `READY`).

### `.claude/rules/routing.md` — STALE
- Missing routes present in `src/App.jsx:214-290`: `/policies`, `/proposal/:token`, `/join/:token`, `/*/` PublicNotFound fallbacks, `/trial-expired`, `/subscription-expired`, `/no-access`, `/welcome`, `/chat`, `/partnerships`, `/prospects`, `/prospects/:id`, `/proposals`, `/proposals/:id`, `/submissions`, `/approvals`, `/ads`, `/tasks`, `/tasks/:taskId`, `/operations/notes/:noteId`, `/documents`, `/reports`, `/team`, `/help`.
- `/operations/notes → NotesAndReminders` — component is `Notes` (`src/pages/Notes.jsx`); `/calendar → ContentCalendar` — route element is `SocialCalendar`.
- "`* (catch-all) → redirect to /dashboard`" — actual is `<NotFound />` (App.jsx:290) for authed and `/login` redirect (App.jsx:293) for anon.
- ClientDetails tabs list (Overview, Management, Workflow, Campaigns, Documents) out of date (Tasks, Proposals, Billing etc. exist per CLAUDE.md).
- Does not mention `RequirePermission cap=...` wrappers, which is now the main route-gating pattern.

### `.claude/rules/supabase-patterns.md` — STALE
- "Current functions: send-approval-email, send-client-welcome, send-password-update-email" — 15 functions exist.
- Recommends `.eq('user_id', user.id)` as secondary guard — contradicts the workspace model (`workspaceUserId`) in both CLAUDE.md files.
- Storage section lists only `post-media`; code also uses `client-documents`, `note-media`, `proposal-files` (`api/clients.js:308`).
- Migrations section claims the folder "is the only way the schema can be rebuilt" — false, see §8 (no baseline).

### `.claude/rules/api-conventions.md` — STALE
- Mutation-hook ban contradicted by 46 hooks (see §2).
- Examples use `user.id`/`useAuth().user` for list keys and `createClient(userId, data)` — contradicts `workspaceUserId` rule and actual `resolveWorkspace()` usage.

### `.claude/CLAUDE.md` — partially stale
- Edge function list misses `send-invoice-email`, `send-task-assignment-email`, `send-team-welcome`, `delete-workspace`, `toggle-maintenance`.
- Prospects: "Statuses: new → contacted → demo_scheduled → won / lost" — actual 10 statuses (`api/prospects.js:9-20`: + `follow_up`, `proposal_sent`, `changes_requested`, `proposal_accepted`, `contract_sent`; `demo_scheduled` label is "Discovery Call").
- Documents `effectivePlatformDate` and `getIndustryColor` as shared helpers — both unused.
- "`send-approval-email` … requires JWT (`verify_jwt: false`, manually verified inside)" — self-contradictory wording.
- Root `CLAUDE.md` and `.claude/CLAUDE.md` duplicate the Commands section and several paragraphs — consolidate.

### `documentation/`
- `documentation/features/feature-workspace-chat.md:114,140` still say to update `documentation/subscription-features.md` (deleted).
- `.claude/app-research.md` (1,220 lines) / `app-research-landing.md` (349) — last touched 2026-04-29, "Phase 1 complete" status; product-marketing docs, stale vs Phase 2. CAN STAY but mark as historical or move into `documentation/`.
- `documentation/revenue-projection-*.md`, `phase2-roadmap.md`, `rbac-roles-permissions.html` — business docs; fine.
- Memory notes the `tercero-feature` workflow was retired 2026-11-07; repo no longer has it (good), but skill still offered via the `anthropic-skills:tercero-feature` plugin — outside repo.

### Repo hygiene
- `dist/` exists locally but is **not tracked** (`git ls-files dist` empty; `.gitignore` has `dist/`). OK.
- `.gitignore`: covers node_modules, dist, build, .env variants, .mcp.json, `.claude/settings.local.json`. Missing: `coverage/`, `*.log`, `.vscode/*` (but `.vscode/mcp.json` is intentionally tracked — only shadcn MCP, harmless), `supabase/.temp/`, `supabase/.branches/` (CLI creates these on `link`). NEEDS IMPROVEMENT (minor).
- `components.json` `"registries": { "@acme": "https://acme.com/r/{name}.json" }` — placeholder left from shadcn template. REMOVE.

---

## 8. `supabase/`

- **242 migrations**, all well-formed `YYYYMMDDHHMMSS_snake_case.sql`, no duplicate version prefixes, no duplicate names, sorted range `20260215144136` → `20260910110316`. Largest is 17 KB (`20260706102956_workspace_chat_phase1.sql`) — nothing huge.
- **NEEDS IMPROVEMENT — no baseline schema.** The earliest migration is `20260215144136_cleanup_redundant_client_indexes.sql`. Core tables `clients`, `posts`, `post_versions`, `agency_subscriptions`, `expenses`, `transactions`, `share_tokens` are **never created** in any migration (grep `create table` across the folder lists 38 tables, none of these). The folder cannot rebuild the DB from scratch — contradicts `supabase-patterns.md`. Recommend a `supabase db dump --schema-only` baseline (squash) migration.
- Debug-leftover history: `20260706114408_debug_chat_dm_notify_temp.sql`, `20260706114441_debug_chat_dm_notify_temp2.sql` (create `chat_debug_log`), cleaned up by `20260706114546_restore_clean_chat_notify_trigger.sql:43`. CAN STAY (history must mirror remote), but a future squash would drop them.
- `config.toml` (437 lines): `project_id = "social-media-management"` (old name); stock commented Firebase/third-party blocks. `[functions.toggle-maintenance]` has **no entry** (all 14 others do), and **`toggle-maintenance` is not referenced anywhere** in src, migrations or config — it's an admin-secret-driven endpoint presumably called from the separate admin portal. Document or remove.

### Edge functions vs invocation from `src`
| Function | Invoked from src? | Where |
|---|---|---|
| delete-team-member | yes | api/team.js |
| delete-workspace | no (DB cron) | migrations `20260622103627_schedule_workspace_purge_cron.sql` |
| send-approval-email | yes (2) | PostDetails flow |
| send-campaign-review-email | yes | pages/campaigns/CampaignDetailPage.jsx:303 (direct, not via api) |
| send-client-welcome | yes | api/clients.js |
| send-feedback-notification | yes | api/feedback.js:56 |
| send-invoice-email | yes | finance |
| send-password-update-email | yes (2) | auth dialogs |
| send-platform-published-email | yes (2) | PostDetails |
| send-proposal-email | yes | proposals |
| send-renewal-request | yes | billing |
| send-signup-welcome | yes | signup-form.jsx |
| send-task-assignment-email | yes | api/tasks.js:174 |
| send-team-welcome | yes | pages/JoinTeam.jsx:119 (direct, not via api) |
| toggle-maintenance | **no** | nowhere; not in config.toml |

---

## Priority summary
1. Fix/trim stale tests (38/80 failing) and add eslint overrides; clear 44 unused-vars → green CI.
2. Route-level code splitting (4.9 MB single chunk).
3. Delete 8 dead files + 10 unused ui files + 7 unused deps; normalise Radix to `radix-ui`; declare `@tiptap/core`.
4. Rewrite `post-versioning.md`, `routing.md`, `supabase-patterns.md`, `api-conventions.md` to match code.
5. Consolidate currency/date/initials/status/platform helpers.
6. Move posts reads + settings-page Supabase calls into `src/api/` with key factories; workspace-scope `clients-pipeline-dashboard`.
7. Add a baseline schema migration.
