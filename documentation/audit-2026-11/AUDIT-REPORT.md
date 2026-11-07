# Tercero — Full Application Audit (2026-11-07)

**Scope:** cleanup and maintainability, so future features (Phase 2: auto-publishing, client portal, WhatsApp, AI…) are easy to add. **No security or vulnerability review** (that's a separate pass).
**Method:**
1. Five parallel code-audit subagents, one per area. Their full reports, with every file:line citation, are in [`area-reports/`](area-reports/).
2. A hands-on browser walkthrough on the local dev server (`npm run dev`) with a **freshly created account** (signed up by Chris; "Audit Test Agency", Trial plan). I seeded one client, one deliverable (sent for approval), and one prospect.
3. Screenshots are in [`screenshots/`](screenshots/); raw notes from the walkthrough are in [`observations.md`](observations.md).
4. Baseline: `main` @ `1d403e7`.

**Legend.** 🗑 **Remove** · ✅ **Can stay** · 🔧 **Needs improvement/change** · 🐞 = behaviour bug found along the way (a cleanup side-effect, not a security finding). Items marked *(verified)* were confirmed by me in the code or the browser. The others are grep-verified subagent findings; see the area reports.

---

## 0. Executive summary

**The product is broad and mostly solid.** The core architecture is sound: React Query, the workspace-scoped multi-tenant model, RLS-backed rules, DB-side notification fan-out, and a good onboarding wizard. The drag on future work comes from four systemic problems:

1. **There's no single source of truth for domain vocabulary.** Post statuses (12 real values against 5 in the docs) are re-declared in about 12 files. Prospect, proposal, task and platform maps are each copied 3–9 times, and the copies have drifted.
2. **State transitions are written from the browser.** `PostDetails.jsx` writes `SCHEDULED`/`APPROVED`/`PUBLISHED` with raw updates, and emails fire from React success handlers. Auto-publishing, the client portal and WhatsApp (roadmap items 1, 2 and 4) all need these transitions on the server.
3. **There are parallel implementations of the same screen:**
   - global vs client-scoped deliverables, invoices, documents and proposals
   - two public review UIs
   - two comment/reaction composers
   - three meeting cards
   - five PDF pipelines

   This contradicts the "reusable tab with `clientId`" pattern documented in CLAUDE.md.
4. **The safety net is broken:**
   - 38 of 80 tests fail.
   - Lint has 58 errors, and its `varsIgnorePattern` hides unused components.
   - The whole app builds into a single 4.9 MB JS chunk with no route-level code splitting.
   - The docs (`routing.md`, `post-versioning.md`, `supabase-patterns.md`, parts of CLAUDE.md) no longer describe the code, and agents read them as truth.

**Recommended order:**
1. Get green: fix the tests and lint, add lazy routes.
2. Delete dead code (a cheap, safe win).
3. Centralise the domain constants and helpers.
4. Collapse the duplicate screens.
5. Move the post state machine into RPCs, which unblocks Phase 2.

Section 25 maps this onto the mattpocock workflow.

### Behaviour bugs found during the audit (fix first, they're small)
| # | Bug | Where | Status |
|---|---|---|---|
| B1 | "Mark meeting done" **deletes** the meeting (dashboard, client overview, calendar day dialog, meeting card); only MeetingsPage uses `markMeetingCompleted` | `src/pages/dashboard/DashboardMeetingsNotes.jsx:71-80` (+3 more) | verified |
| B2 | Calendar is scoped by `user.id`, not `workspaceUserId`; the RPC filters `c.user_id = p_user_id`, so **invited members likely see an empty calendar** | `src/pages/calendar/ContentCalendar.jsx:110-124`, `get_global_calendar` | verified in code |
| B3 | Profile "Delete Account" only **signs out**, but its dialog promises permanent deletion, and every role sees it | `src/pages/settings/ProfileSettings.jsx:183-192` | verified |
| B4 | Onboarding: the validation error toast persists after a successful save, into the next step | onboarding wizard | verified (screenshot 04) |
| B5 | "Resend approval link" fires immediately with no confirmation, and on failure shows the raw `Edge Function returned a non-2xx status code` | deliverable detail | verified (browser) |
| B6 | The approval-confirm dialog stays open showing "Already Sent" after success | deliverable detail | verified (browser) |
| B7 | Client overview Tasks widget empty state says "No pending **notes**" | `OverviewTab` / `DashboardMeetingsNotes` | verified (browser) |
| B8 | Finance chart y-axis labels read `₹0.001k` on empty data | `FinancialOverviewTab` | verified (browser) |
| B9 | "Partially Published" calendar filter never matches (it compares the raw status; cells use `getPublishState`) | `ContentCalendar.jsx:185` | code-read |
| B10 | Approval email can be sent before the status change completes (`await mutate` instead of `mutateAsync`) | `PostActionDialogs.jsx:80` | code-read |
| B11 | Editing a task shifts its due time by the UTC offset on every save | `EditTaskDialog` | code-read |
| B12 | Changing the assignee in the Edit dialog sends no assignment email (only create and reassign do) | `api/tasks.js:72,159` | code-read |
| B13 | Notification badge realtime likely unsubscribes when the bell popover closes (duplicate channel name) | `NotificationBell.jsx:234,386` | code-read |
| B14 | Notifications from the owner show no name or avatar (`useTeamMembers` excludes the owner); team notifications link to `/settings` instead of `/team` | `NotificationBell`, `routes.js:18` | code-read |
| B15 | Client Billing tab shows Recurring Templates with no `finance_recurring_invoices` gate (the Finance page gates it) | `ClientBillingTab.jsx:430,503` | code-read |
| B16 | Storage counter drifts: document delete decrements `user.id` instead of the workspace owner, and proposal-file delete never decrements | `DocumentCard.jsx:126`, `proposals.js:263` | code-read |
| B17 | `resolveWorkspace()` ignores the `agency_members` query error, so a network blip makes an invited member resolve to their own workspace | `lib/workspace.js:19-24` | code-read |
| D1 | **Storage usage is counted 2–3×.** Two identical `storage.objects` triggers both run, plus the client-side `increment_storage_used` calls. Live data: test account 2.00×, largest workspace 2.98× | DB, see [DATABASE-AUDIT §5](DATABASE-AUDIT.md) | verified (live DB) |
| D2 | `send-approval-email` returned 500 twice with **nothing logged**, and the UI reported the first send as success | edge fn + `PostActionDialogs` | verified (logs) |
| D4 | Recurring invoices: there's no cron job to generate due templates, and `advance_recurring_invoice_date` is never called. Possibly a missing feature | DB / finance | verified (live DB) |

> **Database:** the live Supabase project was audited separately. See [`DATABASE-AUDIT.md`](DATABASE-AUDIT.md) for dead tables, functions and views, triggers, advisors, edge-function observability, the single-environment risk and database tickets.

---

## 1. Signup / Login
Screenshot `01-signup.jpg`.
- ✅ Clean dark auth pages, and `login-form.jsx` handles the session-race correctly.
- 🔧 `signup-form.jsx:49-51` calls `navigate('/dashboard')` straight after `signUp`, the exact race `login-form` documents and avoids.
- 🔧 `ForgotPasswordDialog` and `ChangePasswordDialog` are near-identical (442/455 lines), and both call `supabase` directly. Extract one `PasswordResetForm` plus an `api/auth.js`.
- 🔧 [Brand] The auth screen shows the logo mark only. Consider a wordmark and one line of product positioning.

## 2. Onboarding wizard → Welcome tour
Screenshots `02`–`05`.
- ✅ The 5-step wizard (Identity → Contact → Signatory → Platforms → Team) is well built. It reuses `InviteDialog` and has clear copy.
- 🐞 B4: the stale error toast.
- 🔧 [UX] "Finish setup" has no loading state (about 3 s of dead button), then jumps to `/welcome`.
- 🔧 [Struct] The wizard is an overlay on `/dashboard` with no route or step in the URL, so refresh and back behaviour depend on state.
- 🔧 [UX] Defaults are India-only (+91, Chennai, ₹) and nothing asks for currency or country. Add a currency/locale field now, before invoices multiply.
- 🔧 [A11y] Platform rows are clickable divs, not checkboxes. The select and the step-rail buttons have no accessible names.
- 🔧 [UX] The client logo is **required** on Create Client (screenshot 08), but the agency logo is optional in onboarding. Make the client logo optional and fall back to initials, as the cards already do.
- 🗑 `useSubscription.needs_onboarding` (no consumers), and `agency.js:200-305` `completeFullAgencySetup` / `setupBrandingOnly` (an old setup fork).
- 🔧 `/welcome` (screenshot 05) is a 5-slide carousel of static product screenshots. It's nice, but it will drift from the real UI. Keep it short, or link it to the marketing site.

## 3. App shell, navigation, routing
- ✅ AuthContext, the route guards and `resolveCapabilities` are well structured and well commented.
- 🗑 `src/AppShell.jsx` is dead and broken: it imports the missing `./AppHeader`. The live one is `components/misc/AppShell`.
- 🗑 `components/sidebar/nav-secondary.jsx`, `nav-clients.jsx` (only referenced in commented-out JSX), and `src/App.css` (Vite template leftover).
- 🔧 **No code splitting.** `App.jsx` imports every page eagerly, so the 4.9 MB bundle includes react-pdf, Tiptap and recharts even on the public review pages. Use `React.lazy` per route; this is the single biggest perf win.
- 🔧 The agency settings row is fetched twice. AppShell hand-fetches `agency_subscriptions` into sessionStorage plus Outlet context, while `useSubscription()` fetches the same row. It also reads fields that don't exist (`agencySettings?.name`, `?.tier`). Use one source: `useSubscription()`.
- 🔧 There are two `SidebarProvider`s (`main.jsx:20` and AppShell); drop the outer one.
- 🔧 `SubscriptionsRoute`, `ReportsRoute` and `ChatRoute` in App.jsx should become one `<RequireFlag flag="…">`.
- 🔧 [IA] The sidebar has 13 top-level entries with inconsistent grouping:
  - "Outreach" is grouped, but Deliverables, Approvals, Campaigns and Calendar are flat.
  - Breadcrumbs say "Operations › Deliverables / Documents / Reports" while the sidebar puts them elsewhere.
  - "Tasks & Todos" vs "Operations" (notes/meetings) is an unclear split.

  Suggested IA: **Work** (Clients, Deliverables, Calendar, Campaigns, Approvals) · **Sales** (Prospects, Proposals) · **Team** (Tasks, Meetings, Notes, Chat) · **Money** (Finance, Reports) · **Workspace** (Documents, Team, Settings, Billing).
- 🔧 [A11y] Sidebar links and icon buttons have no accessible names.
- 🔧 Legacy redirect `/clients/:id/posts/:postId` has to **stay** until two DB triggers stop generating `/posts/` links (`20260909122643_task_comments.sql:81` and `20260910095516…:60`). Fix those triggers, then remove the redirect.

## 4. Dashboard
Screenshot `06`.
- ✅ The time-aware greeting and the setup checklist are good touches.
- 🔧 [UX] An empty workspace shows about 10 widgets of zeros: ₹0 ×6, 11 zero statuses, 7 "No activity" days. Show one focused empty state until the first client or deliverable exists.
- 🔧 [UX] The setup checklist repeats onboarding (logos, team).
- 🔧 Workflow Health legend: 11 statuses is too many for a half-donut. Group them into 4–5 phases (In progress / With client / Ready / Live / Archived).
- 🔧 `WorkflowHealth.jsx` is documented as shared but is only used on the campaign page. The dashboard and client `OverviewTab` re-implement it, and `DashboardWeekTimeline` duplicates `ClientWeekTimeline`.
- 🔧 Four widgets query Supabase directly, two of those queries ignore errors, and none of the 11 widgets has an error state.
- 🔧 Rename `DashboardMeetingsNotes`: it shows tasks and meetings, and "notes" is a different feature.
- 🗑 `DashboardScheduledPosts.jsx` (162 lines, never imported).

## 5. Clients
Screenshots `07`–`10`.
- ✅ The client cards, urgency filters and Internal Workspace concept work well.
- 🐞 B7: wrong empty-state copy.
- 🔧 [UI] The client profile has 10 tabs, and Calendar is clipped at 1280 px. Consider an overflow menu, or merging Billing/Proposals/Documents under a "Business" tab.
- 🔧 [UX] The header count says "Clients 1" while the "All" chip says 2 (the internal workspace is counted in one and not the other).
- 🔧 `CreateClientPage.jsx` (771 lines) uploads client logos into the **`post-media`** bucket and calls `supabase` 4 times. Move uploads into `api/storage.js` (the onboarding `uploads.js` is already the right helper).
- 🔧 Inconsistent client query keys; `Clients.jsx` keys by `user.id`.
- ✅ Welcome email: I checked the live database, and no trigger on `clients` sends it anymore (only `enforce_client_limit` is attached), so the `createClient` call is the only path. The old trigger survives only as a historical migration file.
- 🗑 `clientSections/ComingSoon.jsx`, `getIndustryColor` (unused, though documented in CLAUDE.md), and the `console.log`s at `api/clients.js:258,271,310`.
- 🔧 [Copy] "Quick Actions → **New Post**" vs "Deliverable" everywhere else. Pick one noun ("Deliverable") throughout the UI.

## 6. Deliverables (posts) & versioning
Screenshots `11`–`13`.
- ✅ `post-statuses.js` itself, `StatusBadge`, the social-media previews, `deletePost` (deletes the row before storage), and the internal-approval RPC wrappers.
- 🔧 **Status model:**
  - The real enum is `DRAFT, SUBMITTED, CHANGES_REQUESTED, READY, PENDING_APPROVAL, APPROVED, NEEDS_REVISION, SCHEDULED, DELIVERED, PUBLISHED, ARCHIVED`, plus the derived `PARTIALLY_PUBLISHED`.
  - There are two undocumented finishing tracks: social `SCHEDULED → PUBLISHED`, and non-social `APPROVED → DELIVERED`.
  - About 12 files bypass `lib/post-statuses.js`: `MonthView`/`WeekView` `STATUS_STYLES`, `ContentCalendar` `STATUS_LEGEND`, `CalendarReportPDF` (covers only 6 statuses), `Posts.jsx` `STATUS_TABS`, `WorkflowTab`, the `useGlobalPosts` zero-counts, and others.
  - Make `post-statuses.js` the only place that lists statuses, with labels, colours, the phase grouping and allowed transitions.
- 🔧 **Transitions belong on the server.**
  - `PostDetails.jsx` (580 lines, 13 mutations, 11 direct `supabase` calls) and `markPostDelivered` (`posts.js:387`) write statuses with raw updates.
  - The "published" email fires from a React handler.
  - The approve→`SCHEDULED`/`APPROVED` rule is duplicated in both public review pages.

  Move all of this into RPCs (`transition_post(...)`). This is the prerequisite for auto-publishing (roadmap 01) and the client portal (04).
- 🔧 **Identity confusion:**
  - `id` is the post id in list fetchers but the version id in `fetchPostDetails`.
  - The route's `:postId` actually carries a version id.
  - Five overlapping post-list fetchers return different shapes.
- 🔧 **Two implementations of the list:** global `Posts.jsx` vs client `WorkflowTab` + `DraftPostList`. Use one `DeliverablesTab clientId?`.
- 🔧 `DraftPostForm.jsx` is 1,417 lines, the largest file. Split it into media, details, scheduling and submit hooks.
- 🔧 There are 7 copies of the platform-icon map (each with the same `google_busines` filename workaround), 3 copies of deliverable-type labels, about 11 video-detection helpers and about 7 storage-path extractors. Move them to `lib/platforms.js` and `lib/media.js`.
- 🔧 The delete-permission rule is duplicated in `DeliverableCard.jsx:322` and `PostContent.jsx:320`. Export `canDeletePost()`.
- 🔧 [UX] The deliverables list renders a **blank page** (no skeleton) for about 3–4 s while loading (screenshot 12).
- 🔧 [UX] There's no "Copy review link" anywhere on the deliverable, so the link only exists in the email. The Campaign page has one; add it here too.
- 🗑 `createPostRevision` (`posts.js:414`), `MediaPreview.jsx`, `calendar/PostDetailDialog.jsx`, `isVideoContent` (`DraftPostForm.jsx:204`), `effectivePlatformDate`, the dead `POST_STATUS_STYLES` in `LinkPostsToCampaignDialog.jsx:32`, the legacy `PENDING`/`REVISIONS` remap in `ContentPipelineBar.jsx:65`, and probably the `PUBLISHED` branch of `send-approval-email`.

## 7. Approvals & public review (end of the content flow)
Screenshots `14`, `26`.
- ✅ The invalid-token page is clean ("Link Expired").
- 🔧 [UX] `/approvals` only covers **internal** (member-submitted) approvals. A deliverable awaiting the **client** doesn't appear there, so the owner has no single "waiting on someone" view. Add a "With client" tab.
- 🔧 [Struct] `/submissions` silently redirects owners to `/dashboard`. Either show an explanation or hide the route by role.
- 🔧 `PublicReview` (786 lines) and `CampaignReview` are two review UIs. Build one `ReviewExperience` that takes a list of posts, since a single-post review is a list of one. This is also the seed of the client portal.
- 🔧 `PublicReview` uses `alert()` and calls the RPC directly.
- 🔧 The invalid-token copy says "expired or already used" for any bad token. Distinguish "not found" from "expired".
- Not exercised: the approve/request-changes UI as a client, because the token lives only in the email and there's no copy-link in the UI (see §6).

## 8. Calendar
Screenshot `17`.
- 🐞 B2 (workspace scoping) and B9 (the partially-published filter).
- 🔧 `MonthView`/`WeekView` keep their own status styles, and the `CalendarReportPDF` legend covers only 6 statuses.
- ✅ The Month/Week toggle, filters and Export Report gating.

## 9. Campaigns
Screenshot `15`.
- ✅ The campaign read hooks and campaign tests (once fixed), and the KPI/analytics RPCs.
- 🔧 `CampaignDetailPage.jsx` is 1,257 lines; split it into KPI, posts, budget, invoices and share sections. Remove the unused `MeetingRow` import (`:56`).
- 🔧 `campaigns.js` exports 8 mutation hooks, against the API rule (see §23).
- 🔧 Docs say campaigns are Velocity-gated, but the code hard-codes `true` and caps only the count. Decide which is right and fix the other.
- 🗑 `useUnlinkPostFromCampaign` (`campaigns.js:161`).

## 10. Comments (posts and campaigns)
- ✅ The `comments` API, DB-side fan-out, and the soft-delete design.
- 🔧 `CommentThread` and chat's `ChatThread` duplicate the reaction picker and mention composer. Extract `<MentionComposer>` and `<ReactionBar>`.
- 🔧 Hover-only actions don't work on touch, and there's no pagination (known gaps).

## 11. Tasks & Todos
Screenshot `16`.
- ✅ The data model (nullable client, `task_posts` join) and the `update_task_status` RPC.
- 🐞 B11, B12.
- 🔧 `TasksAndReminders.jsx` is 1,044 lines with three views in one file, and its kanban pieces are near-copies of MeetingsPage's.
- 🔧 `CreateTaskDialog` and `EditTaskDialog` are about 85% identical, don't use RHF + zod, and each has its own priority colours. Build one `TaskForm`.
- 🔧 `STATUS_CONFIG`/`PRIORITY_CONFIG` live in `TaskCard.jsx`; move them to `lib/task-statuses.js`.
- 🔧 Member/client/campaign lookups are re-implemented in 3 places despite `useTaskLookups()`.
- 🔧 N+1: each card fetches its own linked deliverables, plus one fetch per linked post.
- 🔧 [Copy] "Tasks & Todos" vs "TasksAndReminders" vs "Notes" in widgets. "Reminders" isn't a feature, just toasts. Rename everything to **Tasks**.
- 🔧 `.claude/CLAUDE.md` references a `TaskDetailSheet` that no longer exists.

## 12. Notes
- ✅ The Tiptap editor and visibility filter.
- 🗑 `shareNote()` (no callers).
- 🔧 `documentation/notes-and-project-expansion.md` says private notes are blocked on `created_by`, but that pattern now exists, so the doc is stale.

## 13. Meetings
- 🐞 B1 (marking done deletes the meeting).
- 🔧 There are 3 different meeting card components.
- 🔧 `api/meetings.js` has no hooks, which leads to 7 different cache keys and lists that don't refresh consistently. Add `useMeetings()` with one key family.
- 🗑 `fetchUpcomingMeeting`.

## 14. Chat
Screenshot `18`.
- ✅ DB-enforced gating, deterministic DMs, the entity references and `useMemberMap`.
- 🔧 `ChatThread.jsx` is 1,021 lines, with 15 state variables and 8 effects. Split it into `MessageList`, `Composer` (shared with comments), `ReactionBar` and `ReferencePicker`.
- 🔧 `feature-workspace-chat.md` links to the deleted `subscription-features.md`.

## 15. Notifications
- ✅ DB-side fan-out with realtime used as an invalidator only, which is the right architecture.
- 🐞 B13, B14.
- 🗑 `notify()` and `notifyFromMutation()` (`api/notifications.js:38-81`), and the `chat_dm` type config entry.
- 🔧 Realtime subscription code is copied in about 8 places (`comments.js`, `team.js`, `chat.js`, notifications). Build one `useRealtimeInvalidate({table, filter, keys})` hook; `chat.js:96-104` already documents the channel-name trap.

## 16. Prospects (Outreach)
Screenshot `19`.
- ✅ CSV import, the outreach log and Convert-to-Client.
- 🔧 [UI] 11 status tabs scroll horizontally. Group them into pipeline stages, or use a status dropdown plus a kanban view.
- 🔧 Prospect statuses are defined in 4 places, and `ProspectCard`'s dot map is missing 3 of the 10. CLAUDE.md lists 5.
- 🔧 `prospects.js` and `prospectActivities.js` import each other, which is a circular import.

## 17. Proposals
Screenshot `20`.
- ✅ The public proposal flow and its RPCs, and the PDF export.
- 🔧 `ProposalDetailPage.jsx` is 1,208 lines. `ProposalsPage` doesn't reuse `ProposalTab`. `STATUS_CONFIG` is copied 3 times.
- 🔧 The proposal limit fallback is 5, and both CLAUDE.md files say "5 for Trial/Ignite", but the canonical matrix says Ignite 10 and Trial unlimited. Fix code or docs.
- 🗑 The paused "Build in Tercero" builder: commented-out JSX plus eslint-disabled handlers in both lists.

## 18. Finance
Screenshot `21`.
- ✅ Subscription gating (except B15), and the shared invoice PDF generator behind both download and email.
- 🐞 B8, B15.
- 🔧 `ClientBillingTab.jsx` (626 lines) is a drifted fork of `finance/InvoicesTab.jsx` (835 lines), which already accepts `clientId`. Merge them.
- 🔧 The Create and Edit invoice dialogs total 1,401 lines; build one `InvoiceForm`.
- 🔧 `PAYMENT_TERMS` appears 5 times and a local `fmtCurrency` 6 times (currency formatting is copied about 8 times app-wide) while `utils/finance.js` exists. The same `invoice_items` fetch appears 3 times. `SubscriptionsTab.jsx:62` runs its own unscoped clients query under `['clients-list']`.
- 🗑 The never-passed `clientId`/`subTabs` props on all 4 finance tabs, and unused `supabase`/`useQuery` imports in `AddSubscriptionDialog` and `FinancialOverviewTab`.
- 🔧 [Brand] Invoices use legacy `*_whitelabel_enabled` flags while proposals use `branding_*`. Unify them.

## 19. Documents
Screenshot `22`.
- ✅ Collections gating and signed-URL storage.
- 🐞 B16.
- 🔧 There are three implementations: `DocumentsPage` (774), `DocumentsTab` (510, client-only) and `ProspectDocumentsTab` (223, never passes `canManage`). CLAUDE.md wrongly says `DocumentsTab` is reused globally. Build one `DocumentsTab scope={client|prospect|all}`.

## 20. Reports
Screenshot `23`.
- ✅ The module is focused and works.
- 🔧 Five PDF pipelines (invoice, proposal, campaign, calendar, report) copy font registration, palette, download boilerplate and the SVG-logo rasteriser. Three of them don't rasterise SVG logos at all. Build one `src/utils/pdf/` kit: `registerFonts`, `theme`, `rasterizeLogo`, `downloadPdf`.

## 21. Team, Settings, Billing, Help
Screenshots `24`, `25`.
- ✅ Invite-link flow, role editing, and the Billing usage cards.
- 🐞 B3, B17.
- 🗑 The default export of `TeamSettings.jsx` (lines 862-1394, about 530 dead lines). Move `InviteDialog`, `EditAccessDialog` and `DOCS_LEVEL_CONFIG` to `components/team/`. Also remove `pages/billingAndUsage/InvoicesTab.jsx`.
- 🔧 Components live in page files:
  - `PlanCard` and `UpgradeRequestDialog` sit in a billing tab file that the expiry pages import.
  - `SupportSettings` is only used by Help.

  Move them under `components/`.
- 🔧 The settings pages call `supabase` directly: AgencySettings 6×, ProfileSettings 5×, InvoiceSettings 4×. `AgencySettings.jsx` is 1,041 lines; `TeamPage.jsx` is 952.
- 🔧 Three files compute `isOwner` by hand instead of using `usePermissions().isOwner`.
- 🔧 `SubscriptionReminder` is about *expense* subscriptions but reads like the plan subscription, and it fetches expenses for every role.
- 🔧 [Copy] The Settings page shows a "Delete Account" (fake) **and** a Danger Zone tab. Remove the fake one.
- 🔧 [Copy] Billing says "200 GB storage" on Trial, and the Help copy says "full Quantum-level access". Make sure the copy and the matrix agree.

## 22. Expiry and edge pages, stubs
- ✅ NotFound, PublicNotFound and NoWorkspaceAccess.
- 🔧 `TrialExpired` and `SubscriptionExpired` are near-duplicates, and both call `supabase.auth.signOut()` directly. That causes the redirect bounce `NoWorkspaceAccess.jsx:30-35` warns about.
- 🗑/decide: `/ads` and `/partnerships` are routed with no guard, render only a ComingSoon card, and have their nav entries commented out. There's no schema or flag behind them. Either remove the routes or keep them deliberately, and mark `feature-ads*.md` and `feature-partnerships.md` "Not started".
- 🔧 `toggle-maintenance` isn't invoked anywhere and has no `config.toml` entry. Confirm whether it's used manually, otherwise remove it.

## 23. Cross-cutting (code health, tooling, docs)
**Test / lint / build** (on `1d403e7`):
- `npm test`: **38 of 80 failing**. The causes are stale mocks (`mockReturnValue is not a function`), a `useHeader` mock returning undefined, and `CommentThread` now needing a router.
- Only campaigns and comments have tests. Nothing tests the status logic, `getPublishState`, `resolveCapabilities`, the trial-phase logic, tasks, chat or finance.
- `npm run lint`: **58 errors, 36 warnings**. The biggest rules are `no-unused-vars` (44), `only-export-components` (17) and `exhaustive-deps` (11), plus about 11 new react-hooks rule errors. `varsIgnorePattern: ^[A-Z_]` hides about 15 or more unused component and icon imports.
- `npm run build`: passes, but produces **one 4,916 kB chunk** (1,429 kB gzip).
- `vitest.config.js` copies the alias instead of sharing `vite.config.js`, and has no coverage set up.

🗑 **Remove**
- Unused dependencies: `@dnd-kit/sortable`, `@dnd-kit/utilities`, `@radix-ui/react-dialog`, `@radix-ui/react-separator`, `react-easy-crop`, plus `vaul` and `@base-ui/react`, which only unused ui files import.
- Unused `components/ui/*`: button-group, combobox, drawer, field, item, pagination, slider, spinner, toggle-group, toggle.
- Unused exports: `useDocument`, `INVOICE_REQUIRED_CATEGORIES`, and the ones listed per area above.
- The placeholder `@acme` registry in `components.json`.

🔧 **Improve**
- **Radix is installed two ways:** 20 files use `radix-ui`, 13 use `@radix-ui/react-*`. `@tiptap/core` is imported but missing from `package.json`.
- **The API rules don't match reality.** `api-conventions.md` forbids mutation hooks, but 46 `useMutation` hooks exist across 10 modules. Update the rule to allow `useXxxMutation` hooks that own invalidation; that's the pattern already winning, and it centralises query-key knowledge. Also:
  - `useQuery` is called directly in 28 page/component files.
  - Some keys are invalidated in the API layer but defined in components.
  - `['clients-pipeline-dashboard']` isn't workspace-scoped.
  - 9 queries depend on an id but have no `enabled` guard.
- **About 59 direct `supabase.` calls in 20 component/page files.**
- **Duplicated helpers:**
  - currency formatting about 8×, date formatting about 10×, initials 13×
  - status maps: post ~10, proposal 3, task priority 3, platform 9
  - `MemberAvatar` about 6×, and an underline-tab className copied into 14 pages

  Create `lib/format.js`, `lib/platforms.js`, `components/ui/member-avatar.jsx` and `components/ui/underline-tabs.jsx`.
- **Largest files:** DraftPostForm 1417, TeamSettings 1394, CampaignDetailPage 1257, ProposalDetailPage 1208, TasksAndReminders 1044, AgencySettings 1041, ChatThread 1021, PostContent 985, TeamPage 952, OverviewTab 928.
- **Edge functions:** six of them copy branding helpers; add `supabase/functions/_shared/`. `config.toml` still has the old `project_id`.
- **Migrations:** 242 well-named files, but **no baseline**. `clients`, `posts`, `post_versions`, `agency_subscriptions`, `expenses`, `transactions` and `share_tokens` are never created, so the folder can't rebuild the database. Generate a baseline schema dump (`supabase db dump`) so a local stack and branch databases become possible. `supabase-patterns.md` currently claims the folder can rebuild the schema, which is false.
- **Stale docs** (agents trust these, so they cause real bugs):
  - `.claude/rules/post-versioning.md`: the status list and RPC params are wrong.
  - `.claude/rules/routing.md`: about 25 routes are missing, component names are wrong, and the catch-all doesn't redirect (it renders NotFound).
  - `.claude/rules/supabase-patterns.md`: lists 3 of 15 edge functions, recommends `.eq('user_id', user.id)` (which contradicts the workspace model), and makes the false rebuild claim.
  - `.claude/CLAUDE.md`: the status list, prospect statuses (5 vs 10), `proposals_limit`, the campaign gating, `WorkflowHealth` reuse, `TaskDetailSheet`, `DocumentsTab` reuse, missing edge functions, and the `proposal-files` bucket.
  - `rbac-team-roles.md` describes dead TeamSettings rows.
  - `.gitignore` is missing `coverage/` and `supabase/.temp`.

## 24. UI / UX / brand polish (from the walkthrough)
- **Brand colour:**
  - `--primary` is a generic `hsl(215.9 100% 40/50%)` blue.
  - `--chart-1…5` are the **stock shadcn palette**, and they differ between light and dark mode, so the same data changes colour when you switch theme.
  - There are **1,054 hard-coded Tailwind palette classes** (`bg-blue-500`, `text-emerald-600`…) and hex values such as `#111827` ×32.

  Define a brand token set (primary, accent, status-phase colours, a chart palette identical across themes) and use it for status badges and charts. That one change makes the product look intentional and makes a white-label or client portal theming possible (roadmap 04).
- **Empty states are inconsistent.** Campaigns, Tasks, Proposals, Prospects, Notes, Meetings, Documents and Invoices use emoji (📣 ✅ 📋 🎯 📝 🎥 📁 🧾) in a custom block, while the documented `<Empty>` component uses lucide icons. Pick one; the `empty-states` skill already describes the target.
- **Loading is inconsistent.** Deliverables shows a blank page, Documents a skeleton, and Reports fades in. Add one `PageSkeleton` per layout.
- **Density.** Dashboard and client overview show many zero widgets; Prospects has 11 tabs; the client profile has 10 tabs; there are 11 workflow statuses.
- **Naming.** Post/Deliverable, Tasks/Todos/Notes/Reminders, Approvals/Submissions, Operations. Write a glossary (see §25) and align the UI copy to it.
- **Accessibility:**
  - many unlabeled icon buttons and links
  - clickable divs instead of checkboxes
  - toasts used for form validation instead of inline errors
- **Localisation:** ₹ and India-specific placeholders are hard-coded. Add a workspace currency/locale setting.

---

## 25. Suggested mattpocock-skills workflow for this cleanup

The plugin (v1.3.1) is installed globally. The repo has **not** been set up yet: there's no `CONTEXT.md` or `GLOSSARY.md`, and no issue labels.

**Step 0 — once:** `/setup-matt-pocock-skills`. This sets the issue tracker (GitHub `Shanks026/…`), the triage labels and the domain-doc layout.

**Step 1 — make the domain explicit (the root cause of the drift).** Run `/domain-modeling` to write `GLOSSARY.md`, using this report's §6/§11/§16/§24 vocabulary findings. It should settle:
- Deliverable vs Post
- the 12 post statuses and the two finishing tracks
- prospect stages
- Tasks vs Reminders
- Internal vs client approval

Record ADRs for the decisions:
- "status transitions happen in RPCs"
- "mutation hooks live in `src/api/`" (and update `api-conventions.md` to match)
- "one list component per entity with an optional scope"

**Step 2 — plan the big refactor as a map, not a mega-PR.** Use `/wayfinder`. The work is larger than one session, so it should become a set of decision tickets. Suggested epics, in order:
1. **Green baseline:** fix the 38 tests, fix lint and tighten `varsIgnorePattern`, add `React.lazy` routes, add `.gitignore` entries. Low risk, no design needed. Go straight to `/to-tickets` → `/implement`.
2. **Dead-code sweep:** everything marked 🗑 here plus the unused dependencies. One ticket per area; each is a quick `/implement` with `npm run build` as the check.
3. **Bug fixes B1–B17:** use `/diagnosing-bugs` for each code-read item (B9–B17) before fixing, and `/tdd` for B1, B2, B11 and B16 so they get regression tests.
4. **Domain constants module:** statuses, platforms, formatters, `MemberAvatar`, underline tabs. Run `/codebase-design` first to agree the module interfaces, then `/tdd` (the status helpers are pure and easy to test).
5. **Collapse duplicate screens:** deliverables, invoices, documents, proposals, review UI, task and invoice forms, the comment/chat composer. Run `/improve-codebase-architecture` to rank the "deepening opportunities" (it produces an HTML report), then one `/grill-with-docs` → `/to-spec` → `/to-tickets` → `/implement` loop per screen family.
6. **Server-side post state machine:** `/grill-with-docs` (this is a real design decision), then `/to-spec`, `/tdd` against RPCs, and `/implement`. This unblocks roadmap 01/04/02.
7. **Docs and agent context refresh:** `/writing-for-agents` to rewrite `.claude/CLAUDE.md` and `.claude/rules/*` from the glossary and ADRs, and to prune the claims flagged stale in §23.
8. **UI/brand pass:** `/prototype` for the dashboard empty state, the sidebar IA and the brand token palette (throwaway, to decide the look), then spec and implement. Load the `frontend-design` and `empty-states` skills during implementation.

**Per ticket, every time:** `/implement` (or `/tdd`) → `/code-review` (Standards + Spec axes, against the ticket) → `/pr` for the body → `/retro` at the end of each epic, to feed lessons back into CLAUDE.md. Use `/ask-matt` when unsure which skill fits.

**Guardrails for this codebase:**
- Never start epic 5 or 6 until epic 1 is green; otherwise refactors land without a safety net.
- The migrations folder can't rebuild the database. Before epic 6, generate a baseline schema (`supabase db dump`) so RPC changes can be tested on a branch or local database.
- Keep the security review separate, as planned. Several items here (RLS-adjacent scoping B2/B17, `resolveWorkspace`) should be re-checked in it.

---

## Appendix — files in this audit
- `AUDIT-REPORT.md` — this file
- `DATABASE-AUDIT.md` — the live Supabase audit, on its own and cross-checked against the app
- `observations.md` — raw walkthrough notes (onboarding and dashboard detail)
- `screenshots/01…26-*.jpg` — walkthrough captures (the browser pane was short, so most show the top of each page)
- `area-reports/audit-shell-onboarding.md`, `audit-content-pipeline.md`, `audit-business.md`, `audit-ops.md`, `audit-crosscutting.md` — full per-area findings with file:line citations

**Test data created on the hosted Supabase project** (delete when done):
- account `<test-account-email>` / "Audit Test Agency"
- client "Acme Coffee Co" (`acme-coffee@example.com`)
- deliverable "Autumn latte launch reel" (sent for approval)
- prospect "Bloom Bakery"
