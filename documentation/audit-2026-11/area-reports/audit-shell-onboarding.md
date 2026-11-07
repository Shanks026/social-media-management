# Cleanup audit: app shell, entry, onboarding, account/workspace admin

Scope: `src/main.jsx`, `src/App.jsx`, `AuthContext`, shell/sidebar/header, auth pages, onboarding, welcome, settings/team/billing/help, the expiry and edge pages, `useSubscription` / `usePermissions` / `team.js` / `agency.js` / `workspace.js`, and the related edge functions (read only to understand the flows).
This is a maintainability audit. It does not cover security. No source files were edited.

Method: I read every file, grepped for importers before calling anything unused, ran ESLint on the whole area, and ran a script that finds unused imports. The script ignores comments, which matters because of the ESLint gap described next.

> **ESLint has a blind spot.** `no-unused-vars` uses `varsIgnorePattern: ^[A-Z_]`, so unused imports of components and icons, which are all PascalCase, are never reported. ESLint is clean on this area, but the script found the unused PascalCase imports listed below. Consider narrowing that pattern (for example to `^_`), or adding `eslint-plugin-unused-imports`.

## Biggest files (wc -l)

| Lines | File | Notes |
|---|---|---|
| 1394 | `src/pages/settings/TeamSettings.jsx` | About 530 of these lines are a dead default export (see section 5) |
| 1041 | `src/pages/settings/AgencySettings.jsx` | Inline storage uploads; activation flow duplicated with MyOrganization |
| 952 | `src/pages/TeamPage.jsx` | Real team UI |
| 727 | `src/pages/settings/SupportSettings.jsx` | Only used by Help, but lives under settings/ |
| 600 | `src/pages/settings/ProfileSettings.jsx` | Contains a fake "Delete account" |
| 555 | `src/pages/billingAndUsage/TertiarySubscriptionTab.jsx` | Also exports PlanCard and UpgradeRequestDialog for the expiry pages |
| 484 | `src/components/sidebar/nav-main.jsx` | |
| 482 | `src/api/team.js` | |
| 455 / 442 | `src/components/settings/ChangePasswordDialog.jsx` / `src/components/auth/ForgotPasswordDialog.jsx` | Near-duplicate OTP flows |
| 434 | `src/pages/onboarding/Onboarding.jsx` | |
| 357 | `src/api/agency.js` | About 100 lines of dead legacy setup functions |
| 307 | `src/App.jsx` | |
| 275 | `src/context/AuthContext.jsx` | |

---

## 1. Sign-up and login

**What it does:** `/login` renders `components/auth/login.jsx`, which wraps `login-form.jsx`. `/signup` renders `signup.jsx`, which wraps `signup-form.jsx`. Both are wrapped in `PublicOnlyRoute`, defined in `App.jsx:90-94`. After a successful sign-up, the form calls the `send-signup-welcome` edge function without waiting for it. `ForgotPasswordDialog` handles password reset by OTP. `/policies` is public.

### CAN STAY
- **`login-form.jsx:41-52`.** It deliberately does not call `navigate()` after sign-in and lets `PublicOnlyRoute` redirect, with a clear comment. The injectable `client` prop is reused by `AddAccountDialog` with an isolated auth client, which is a good design.
- **`AppRoutes` loading gate (`App.jsx:195-210`).** It fixes the "refresh lands on /login" race and the comment explains why.

### NEEDS IMPROVEMENT
- **`signup-form.jsx:49-51` repeats the race that login-form fixed.** It calls `navigate('/dashboard')` straight after `signUp()` returns a session. That is the exact race `login-form.jsx:41-50` documents and avoids. Remove the navigate and let `PublicOnlyRoute` react.
- **The auth forms skip the project form convention.** `login-form` and `signup-form` read values with `FormData` and validate by hand. `signup-form.jsx:26-29` only checks that the two passwords match. The hint text says "8 or more characters", but nothing enforces it. `JoinTeam.jsx:16-37` already has a zod schema for the same fields (`password.min(8)` plus confirm) that could be extracted and shared.
- **`login.jsx` (54 lines) and `signup.jsx` (54 lines) are the same layout** (icon, heading, form, policy line). Extract an `AuthLayout`.
- **`ForgotPasswordDialog.jsx` (442) and `settings/ChangePasswordDialog.jsx` (455) share most of their code.** They have the same STEPS state machine, `resetAll`, `handleOpenChange`/`handleForceClose`, close-warning AlertDialog, show/hide password state, the `updateUser` → `getSession` → `send-password-update-email` → `signOut` tail (`Forgot:147-170` vs `Change:161-184`), and identical imports. Extract the shared new-password step and the finalize helper, and move the auth calls into `src/api/auth.js`.
- **Auth pages call `supabase` directly**, against the "everything through `src/api/`" rule: `login-form.jsx:23,31`, `signup-form.jsx:32,45`, `ForgotPasswordDialog.jsx:99,119,147-170`, and `JoinTeam.jsx:80,96,118`. A small `src/api/auth.js` (signIn, signUp, sendWelcome, reset helpers) would centralise this. `JoinTeam` repeats the "signUp, then signIn if there's no session" dance.

---

## 2. Joining a team (`/join/:token`)

**What it does:** `JoinTeam.jsx` (306 lines) validates the token with `fetchInviteByToken`. It then signs the user up, or signs them in when sign-up returns no session, calls the `joinTeam` RPC, sends `send-team-welcome` for new members without waiting, calls `refreshWorkspace()`, and goes to `/dashboard`.

### CAN STAY
- The form uses react-hook-form and zod. The welcome email is non-blocking and only sent when `is_new_member`, and the reason is commented.

### NEEDS IMPROVEMENT
- **The token lookup is a hand-written fetch effect** (`JoinTeam.jsx:50-68`, using a `cancelled` flag and three `useState`s). It should be a `useInviteByToken(token)` React Query hook in `team.js`, matching the read convention.
- **The page only supports new accounts.** There is no "already have an account? sign in and join" branch. If the email already exists, `signUp` fails with a raw Supabase message (`setSubmitError(err.message)`). Not a bug as such, but it will block a future multi-workspace feature.
- **Stray `../src/` import in `App.jsx:5`:** `import { AuthProvider, useAuth } from '../src/context/AuthContext'`. Every other import of this module uses `@/context/AuthContext`.

---

## 3. Entry, routing and guards

**What it does:** `main.jsx` sets up the providers. `App.jsx` holds:
- `MaintenanceGate` (lines 61-88), which polls `app_config` plus a Realtime channel.
- The public token routes, each with its own `PublicNotFound` fallback.
- `TrialGuardedShell` (lines 98-129), which waits for a verified workspace and a subscription, then redirects to `/trial-expired`, `/subscription-expired` or `/no-access` when needed.
- `RequirePermission` (lines 134-140).
- Three plan-gated route wrappers.

`AuthContext` resolves `workspaceUserId`, role and permissions. It caches them in sessionStorage, debounces the transient SIGNED_OUT event, and listens on Realtime for changes to the user's own `agency_members` row.

### CAN STAY
- `AuthContext.jsx` overall. The verified-vs-cached workspace split, the deferred SIGNED_OUT handling and the removed-member detection are subtle, and each is well commented.
- `MaintenanceGate` does not blank the app while its query is pending (`App.jsx:81-87`).
- `RequirePermission` together with `resolveCapabilities` (`src/lib/permissions.js`) is the single source of capabilities. `usePermissions` is a 17-line wrapper over it. Good.
- `LegacyPostRedirect` and `/posts` → `/deliverables` keep old links working.

### REMOVE
- **`src/AppShell.jsx` (21 lines) is dead and broken.** Line 4 imports `./AppHeader`, but `src/AppHeader.jsx` does not exist. Nothing imports this file; `App.jsx:12` uses `./components/misc/AppShell`. It only goes unnoticed because nothing imports it.
- **`/ads` and `/partnerships` routes (`App.jsx:240,265`).** Their nav entries are commented out (`nav-main.jsx:83,112`), so they can only be reached by typing the URL. They render `components/misc/ComingSoon.jsx` (129 lines), which is used nowhere else. Either remove the routes, the two 39-line pages and ComingSoon, or bring the nav entries back on purpose.

### NEEDS IMPROVEMENT
- **Two `SidebarProvider`s.** `main.jsx:20` wraps the whole app in one, and `components/misc/AppShell.jsx:152` mounts a second, controlled one that is the one actually used. Every `useSidebar()` consumer is under the inner one. The outer provider is redundant and confusing. Remove it, or document why it is needed.
- **Plan-gated route wrappers are copy-paste.** `SubscriptionsRoute`, `ReportsRoute` and `ChatRoute` (`App.jsx:142-186`) share the same `if (!sub) return null; if (!sub[flag]) return <PlanUpgradePrompt…/>` body. Replace them with a single `<RequireFlag flag="chat" title=… description=…>`, the counterpart to `RequirePermission`. That makes the next gated feature a one-liner.
- **`TrialGuardedShell` calls `setHasShown` during render** (`App.jsx:123`). React tolerates this, but it is fragile. A `useRef` latch does the same job without a re-render.
- **Stray relative imports** (`'../components/misc/header-context'`, `'../../api/agency'`, and others) in `Settings.jsx:3`, `BillingUsage.jsx:3-4`, `components/misc/AppShell.jsx:1-21` and `sidebar-sub-card.jsx:9`, against the `@/` alias rule.

---

## 4. Onboarding, then Welcome

**What it does:** `components/misc/AppShell.jsx:61-148` shows the full-page `OnboardingPage` wizard instead of the shell when the user can edit the workspace (owner only) and the agency has no name and no `onboarding_completed_at`. The wizard (`pages/onboarding/Onboarding.jsx`) has four agency steps (Identity, Contact, Signatory, Platforms), saved in one atomic `completeAgencyOnboarding`, then an optional Team step that reuses `InviteDialog`. Finishing calls `markOnboardingComplete({skippedSteps})` and navigates to `/welcome`, a full-page feature tour outside the shell. The dashboard's `SetupChecklistCard` then offers the skipped steps again.

### CAN STAY
- **The wizard design**: a single react-hook-form/zod form, per-step `trigger`, the atomic agency write, and activation steps that cannot fail the agency write.
- **`InviteTeamStep` reuses `InviteDialog`** instead of having its own form, which is good.
- **`pages/onboarding/uploads.js`** is the cleanest storage helper in the codebase (see the duplication item below).
- **`reconcileLegacyOnboardingFlag`** (`agency.js:173-198`) is a deliberate one-time migration. Mark it with a removal date once the localStorage key has had time to drain.

### REMOVE
- **`agency.js:200-305`: `completeFullAgencySetup` and `setupBrandingOnly`** have no importers. They are the "old fork" that `completeAgencyOnboarding` replaced; its own doc comment at lines 18-22 says so.
- **`useSubscription.js:178-183`: `needs_onboarding`** has no consumers. Its comment says it "gates the wizard in AppShell", but AppShell recomputes the same thing from `fetchAgencySettings` (`AppShell.jsx:121-125`). Either delete the field or make AppShell use it (preferred, see next item).

### NEEDS IMPROVEMENT
- **Two sources of truth for the `agency_subscriptions` row.**
  - **The duplicate fetch.** `AppShell` keeps its own `agencySettings` state. It is fetched with `fetchAgencySettings()` (`select *` on `agency_subscriptions`), cached by hand in `sessionStorage` (`agency_settings_${uid}`, lines 50-59 and 93), and passed down through Outlet context and props. `useSubscription()` already fetches the same row through React Query.
  - **The double fetch.** `checkAgencyStatus` invalidates `['subscription']` and then fetches the row again, so the same row is read twice on every check.
  - **The consumers.** `AppHeader.jsx:157-166` and `nav-header.jsx:20-34` both use `agencySettings?.x || sub?.x` fallbacks. Some of those fallbacks read fields that the table doesn't have (`agencySettings?.name`, `agencySettings?.tier`), so they never apply.
  - **Downstream.** `refreshAgency` from Outlet context is threaded into MyOrganization, AgencySettings and CreateClientPage only so they can refetch.
  - **The fix.** Drop `fetchAgencySettings`, the sessionStorage cache and the Outlet-context plumbing, and read from `useSubscription()` everywhere. React Query's cache already handles fast remounts.
- **The storage-upload helpers are duplicated five times.** `extractStoragePath` exists in `onboarding/uploads.js:10` (whose own comment admits the duplication), `settings/AgencySettings.jsx:55`, `settings/InvoiceSettings.jsx:15`, `settings/ProfileSettings.jsx:53` and `clients/CreateClientPage.jsx:84`. Each of those settings pages also inlines `supabase.storage.from('post-media').upload/getPublicUrl/remove` (`AgencySettings.jsx:135-255`, `InvoiceSettings.jsx:54-82`, `ProfileSettings.jsx:136-172`). Move `uploads.js` into `src/api/storage.js` as `uploadBrandingAsset` / `removeBrandingAsset` (covering the `branding/`, `signatures/` and `avatars/` prefixes) and use it from all four pages.
- **Stale comment in `Onboarding.jsx:104-108`.** The JSDoc says `includeActivation` appends "the invite-team and first-client steps", but there is no first-client step (`ACTIVATION_STEPS` at lines 55-62 holds only `invite_team`).
- **The wizard is embedded three ways.** It runs as the first-run gate (AppShell), and as the "set up workspace" flow in both `MyOrganization.jsx:100-118` and `AgencySettings.jsx`, each with `includeActivation={false}` and copy-pasted `onComplete` handlers. See also the duplicated activation flow in section 6.
- **`/welcome` sits outside `TrialGuardedShell`** (`App.jsx:234`). This is deliberate, for full-page chrome, but it means a trial-locked or removed user can still reach it. It shows no data, so this is low risk; it's just inconsistent with how the other gated pages behave.

---

## 5. Shell, header and navigation

**What it does:** `components/misc/AppShell.jsx` (188 lines) does the onboarding gate. It also:
- locks the sidebar in its collapsed state while on `/chat`,
- scrolls back to the top on navigation,
- mounts `ChatSidebar`, `AppHeader`, `DeletionBanner` and `SubscriptionReminder`,
- runs `useMeetingReminders`.

`app-sidebar.jsx` composes `nav-header`, `nav-main`, `sidebar-sub-card` and `nav-user`. `nav-main.jsx` holds the config-driven nav, using `requiresPermission` (hide) and `requiresFlag` (lock). `nav-user.jsx` adds the multi-account switcher (`lib/accountSwitcher.js` plus `accountSwitcherClient.js`).

### CAN STAY
- **`nav-main` `BASE_NAV_ITEMS`**: a declarative config with clear hide-vs-lock semantics.
- **`header-context.jsx`**: tiny and fine.
- **`nav-user.jsx:44-53`**: it uses the coordinated `signOut()` from context and clears the cache afterwards.
- **The account switcher's isolated auth client** is a well-scoped design.

### REMOVE
- **`components/sidebar/nav-secondary.jsx` (158 lines)** has no importers. Its Settings/Team/Billing/Help items now live in nav-main's "Settings" group (`nav-main.jsx:150-158`).
- **`components/sidebar/nav-clients.jsx` (152 lines)** is imported by `app-sidebar.jsx:4`, but only appears in a commented-out `{/* <NavClients /> */}` (line 41). It is effectively dead, and the import is dead.
- **`app-sidebar.jsx`:**
  - The `sub` and `isCollapsed` variables (lines 18-19) are unused, and so is the `useSubscription` import. ESLint flags these.
  - The commented-out "powered by" footer (lines 49-55) and the empty `flex-1` placeholder div (lines 39-42) are leftovers.
- **Unused icon imports** that ESLint misses: `nav-main.jsx` (`TrendingUp`, `Handshake`, `BadgeDollarSign`, `ShieldCheck`), `nav-header.jsx` (`Layout`) and `nav-clients.jsx` (`TierBadge`).
- **Commented-out nav entries** at `nav-main.jsx:83` (Partnerships) and `:112` (Ads). Delete them together with the routes, or restore them.

### NEEDS IMPROVEMENT
- **`AppHeader.jsx` `TrialStatusPill` and `SubStatusPill`** (lines 19-107) are about 90 lines of near-identical code (color map, text branching, button). Merge them into one `PlanStatusPill kind="trial|sub"`.
- **`SubscriptionReminder.jsx` is misnamed and ungated.**
  - **The name.** It sits at the components root, but it concerns *expense* subscriptions (vendor tools), not the Tercero plan, which is confusing next to `useSubscription`, `SubscriptionExpired` and so on.
  - **The gating.** It runs `useExpenses()` for every user and role, without checking `finance` permission or the `finance_subscriptions` flag (mounted at `AppShell.jsx:183`).
  - **The cooldown.** It uses bare `localStorage` without try/catch.
  - **The fix.** Rename it to something like `ExpenseDueReminder`, move it under `components/finance/`, and gate it on `perms.finance && sub.finance_subscriptions`.
- **`DeletionBanner.jsx:23`, `DangerZone.jsx:29` and `Settings.jsx:20` each compute `isOwner` as `user.id === workspaceUserId`** instead of `usePermissions().isOwner`. That gives two definitions of "owner" that could diverge (for example `superadmin`). Use the capability.
- **`AuthContext.persistActiveAccount` (lines 8-19) and `AddAccountDialog.handleAdded` (lines 20-30) build the same linked-account object from a session.** Export a `sessionToLinkedAccount(session)` from `lib/accountSwitcher.js`.
- **`AppShell.jsx:93`** has an empty `catch {}` (ESLint `no-empty`) and a `useCallback` with a missing `settingsKey` dependency (line 101). Both go away if the agency-settings duplication above is removed.

---

## 6. Settings (`/settings`), Workspace (`/myorganization`) and Team (`/team`)

**What it does:**
- **`Settings.jsx`** has URL-driven tabs: Profile, plus Agency (admin, view-only unless owner, enforced through a disabled `fieldset`), plus Invoice and Danger Zone (owner only).
- **`MyOrganization.jsx`** shows the internal agency client through `ClientProfileView`, or offers activation or setup when there isn't one.
- **`TeamPage.jsx`** has the members, invites and removed tables (TanStack Table), and pulls `InviteDialog` and `EditAccessDialog` from `settings/TeamSettings.jsx`.
- **`DangerZone`** schedules or cancels workspace deletion through RPCs. The actual purge is done by the `delete-workspace` edge function, called from pg_cron or the admin portal, never from the SPA.

### CAN STAY
- **`Settings.jsx`** tab gating with `canSeeTab` and its fallback.
- **`DangerZone.jsx`**: it uses `useMutation` over plain `team.js` functions, which is the correct convention.
- **`team.js`**: invite defaults and `endOfDay` semantics are well documented (lines 163-196), and Realtime is used only to invalidate queries.
- **`components/team/*`** (JobRolePill, JobRoleBadges, JobRolePicker, ManageJobRolesDialog) are small and focused.

### REMOVE
- **`TeamSettings.jsx:862-1394`: `export default function TeamSettings`** (about 530 lines, the old Settings → Team tab) has no importers. Only the named `InviteDialog`, `EditAccessDialog` and `DOCS_LEVEL_CONFIG` are used (`TeamPage.jsx:79`, `InviteTeamStep.jsx:8`). `/team` replaced it, and CLAUDE.md confirms Team is no longer a Settings tab. Delete the default export and its now-unused imports and hooks (`useRemoveMember`, `useRevokeInvite` and the others used only there).
- **The fake "Delete Account" in `ProfileSettings.jsx`.** `handleDeleteAccount` (lines 183-192) only calls `supabase.auth.signOut()` and navigates away. The dialog (lines 465-575) promises "Your account, agency data, clients, posts… permanently removed." It is shown to every role, including members. The real flow is the owner-only `DangerZone` tab. Remove this section, or replace it with a link to Danger Zone for owners and a "leave workspace / contact owner" message for members.
- **Unused icon imports**: `AgencySettings.jsx` (`Building2`, `CheckCircle2`, `HardDrive`) and `MyOrganization.jsx` (`Plus`, `Building2`).

### NEEDS IMPROVEMENT
- **Move the invite and access dialogs out of `TeamSettings.jsx`.** Once the dead default export is gone, the file still holds `InviteDialog` (lines 164-528, about 365 lines) and `EditAccessDialog` (lines 564-833, about 270 lines). Put them in `components/team/InviteDialog.jsx` and `components/team/EditAccessDialog.jsx`, and move `DOCS_LEVEL_CONFIG` to `lib/team-roles.js`. Onboarding currently imports a component from a page file (`@/pages/settings/TeamSettings`). ESLint `react-refresh/only-export-components` also flags line 104.
- **`MemberAvatar` is defined twice**, in `TeamPage.jsx:100` and `TeamSettings.jsx:835`, at different sizes. It also exists as `components/chat/MemberAvatar.jsx`, `CommentThread.jsx:47`, `ShareNoteDialog.jsx:31` and `ApprovalsPage.jsx:109` (`UserAvatar`). Make one shared avatar with a size prop.
- **Internal-workspace activation is duplicated** between `MyOrganization.jsx:66-118` and `AgencySettings.jsx:93-125` (`handleOneClickActivation`, `isSetupModalOpen`, the OnboardingPage embed). The benefit/activation dialog markup is probably duplicated as well (`AgencySettings.jsx:959-1041` has `CompactBenefit`, `ActivationDialog` and `BenefitDetail`). Extract a `useActivateInternalWorkspace()` hook and a shared `ActivationDialog`.
- **`AgencySettings.jsx` (1041 lines)** does logo upload, horizontal logo crop and upload, profile editing, activation, and info display all in one component. Split it into sections (Identity, Logos, Contact, Social), each using the shared upload helper.
- **`team.js` mixes conventions.** Mutation hooks (`useGenerateInvite`, `useRevokeInvite`, `useRemoveMember`, `useRestoreMember`, `useDeleteMemberPermanently` at lines 209-380) sit next to plain mutation functions (`requestWorkspaceDeletion`, `updateMemberAccess`, `joinTeam`). `.claude/rules/api-conventions.md` says "Never wrap mutations in React Query hooks at the API layer". `api/feedback.js` (used by SupportSettings) does the same. Either update the rule to allow the hook pattern, or convert these. As things stand, the docs and the code disagree.
- **`team.js:182-186` `endOfDay` shadows date-fns `endOfDay`**, which `meetings.js` imports from date-fns. They behave the same; reuse the date-fns one.
- **The seat-limit check differs between the UI and the mutation.** `InviteTeamStep.jsx:24-27` counts `members.length` from `get_team_members`. `useGenerateInvite` (`team.js:220-236`) counts active `agency_members` rows. If the RPC result includes the owner, the two disagree by one. Share a single `seatsUsed` derivation, for example as a field on `useSubscription`.
- **`ProfileSettings.jsx:186` and the password dialogs call `supabase.auth.signOut()` directly** instead of the context `signOut` (see section 8 for why this matters).
- **`TeamPage.jsx` handles loading but not errors** for `useTeamMembers`, `usePendingInvites` and `useRemovedMembers` (`membersLoading` only, line 159). A failed RPC shows an empty table.
- **The same tab-trigger class block is copy-pasted in 14 files**: the 15-line `data-[state=active]:border-black…` className (`Settings.jsx:76-90`, `BillingUsage.jsx:61-75`, `HelpPage.jsx`, `TeamPage.jsx` and 10 more pages). Add an `UnderlineTabsTrigger` variant to `components/ui/tabs.jsx`, or a shared `PageTabs`.

---

## 7. Billing (`/billing`) and Help (`/help`)

**What it does:**
- **`BillingUsage.jsx`** has Usage and Subscription tabs. `TertiarySubscriptionTab` shows plan cards plus an "upgrade request" dialog that calls the `send-renewal-request` edge function.
- **`HelpPage`** has the tabs Guides (which links to `/welcome`), Contact & Support (`SupportSettings`: bug and suggestion forms), Policies, and What's Coming. `/policies` reuses `PoliciesTab` as a public page.

### CAN STAY
- `UsageTab`, `UsageCard`, `utils.js` and `PlanOverview` are small and prop-driven.
- `PoliciesPage` and `PoliciesTab` share data (`policies-data.js`), and `GuidesTab` is driven by `guides-data.js`. Good separation of content from UI.

### REMOVE
- **`billingAndUsage/InvoicesTab.jsx` (21 lines)**, an empty-state placeholder, has no importers. `App.jsx` imports the *finance* `InvoicesTab`, and `BillingUsage` has no invoices tab.
- **Unused icon imports**: `TertiarySubscriptionTab.jsx` (`Zap`, `Rocket`, `Atom`, `Sparkles`, already provided by `planMeta.js`) and `PlanOverview.jsx` (`ArrowDownCircle`).

### NEEDS IMPROVEMENT
- **Move the shared plan components out of the tab file.** `TertiarySubscriptionTab.jsx` exports `PlanCard` and `UpgradeRequestDialog`, and `TrialExpired.jsx:10-13` and `SubscriptionExpired.jsx:8-11` import them from a page tab file. Put them in `components/billing/` together with `planMeta.js`. `UpgradeRequestDialog` (lines 35-168) also calls `supabase.functions.invoke('send-renewal-request')` inline (line 62); move that call to an api function.
- **Plan marketing copy in `planMeta.js` is hand-maintained.** It duplicates the DB feature matrix: prices, seat counts, "10 active proposals", "Up to 8 campaigns". Ignite's "Invoicing, ledger & reports" is ambiguous, because the `reports` flag is FALSE on Ignite (`documentation/subscription-features-phase2.md:224`). Add a comment pointing at the canonical doc, or derive the numeric limits from one constants module.
- **`SupportSettings.jsx` (727 lines) lives in `pages/settings/`** but is only used by `HelpPage.jsx:6`. Move it to `pages/help/` and split it into `BugReportForm` (line 305), `SuggestionForm` (line 483) and `SubmissionHistory` (line 270).
- **The upcoming-features list is hard-coded in `HelpPage.jsx:10-48`.** Move it into `guides-data.js` or a `roadmap-data.js` file, like the other Help content.

---

## 8. Expiry and edge pages

**What it does:**
- **`/trial-expired`, `/subscription-expired`** (`TrialExpired.jsx` 178 lines, `SubscriptionExpired.jsx` 166 lines) show full-page plan pickers and redirect back to the dashboard if the user isn't actually locked.
- **`/no-access`** (`NoWorkspaceAccess.jsx`) is for removed members. It auto-leaves when access is restored.
- **`NotFound`** is shown when signed in. **`PublicNotFound`** covers malformed token URLs.
- **`MaintenanceScreen`** is driven by `app_config`. The external `toggle-maintenance` edge function, protected by an admin secret and not called from the SPA, flips it.

### CAN STAY
- `NoWorkspaceAccess.jsx`: its comments explain why it must use the context `signOut` (lines 29-37).
- `NotFound` and `PublicNotFound` are simple.
- `MaintenanceScreen` and `toggle-maintenance` are intentionally external tooling, but they are undocumented.

### NEEDS IMPROVEMENT
- **`TrialExpired.jsx:50` and `SubscriptionExpired.jsx:37` call `supabase.auth.signOut()` and then `navigate('/login')`.** `NoWorkspaceAccess.jsx:30-35` documents this exact pattern as causing a bounce: `session` stays truthy for about 300ms, `PublicOnlyRoute` sends the user to `/dashboard`, and `TrialGuardedShell` sends them back to the expired page. Switch both pages to `useAuth().signOut`.
- **`TrialExpired.jsx` and `SubscriptionExpired.jsx` are near-duplicates**: same `APP_NAME`/`LANDSCAPE_LOGO` constants, `plansRef` and `scrollToPlans`, logo header, logout, and PlanCard grid plus `UpgradeRequestDialog`. Extract a `PlanLockedLayout` and keep only the copy that differs.
- **`TrialExpired.jsx:31-41` runs an inline `supabase.from('posts')` query** inside `useQuery`, in the page, and ignores its `error`. Move it to `api/posts.js` and throw on error.
- **`SubscriptionExpired.jsx` has an unused `ArrowRight` import.**

---

## 9. Cross-cutting: `useSubscription`, `workspace.js`, docs and tests

### NEEDS IMPROVEMENT
- **`lib/workspace.js:19-24` ignores the `agency_members` query error.** On a transient failure, `data` is null, so an invited member is treated as their own workspace (`workspaceUserId: user.id`). That is the mis-resolution `AuthContext.jsx:105-112` explicitly guards against, and it breaks the "always throw" rule. Every plain mutation that uses `resolveWorkspace()` (all of `agency.js`, `feedback.js` and others) inherits the problem. Throw on error.
- **`resolveWorkspace()` runs on every mutation.** It does two network round trips (`auth.getUser` plus `agency_members`) each time. That is acceptable, but it is the reason the API conventions doc says mutations should receive `userId` as a parameter. The two patterns now coexist.
- **`useSubscription.js` mixes concerns.**
  - **Side effect in the query.** It calls `supabase.auth.signOut()` inside the `queryFn` (lines 33-35).
  - **Sequential round trips.** It runs three queries one after another (sub, client count, internal client) that could run in parallel with `Promise.all`.
  - **Testing toggles in production code.** It holds `TRIAL_DAY_OVERRIDE` and `SUB_DAY_OVERRIDE` (lines 5-13).
  - **Untestable pure logic.** The storage formatting and trial/sub phase logic are inline. Extract `deriveTrialPhase`, `deriveSubPhase` and `formatStorage` as pure functions, which also gives them a test target.
- **Hardcoded campaign values.** `campaigns: true` (line 153) and `campaigns_limit` derived from `plan_name` (line 155) are intentional (see the phase-2 doc). As a result, `CampaignsPage.jsx:30`'s `if (!sub?.campaigns)` branch and nav-main's `requiresFlag: 'campaigns'` are dead branches.
- **No tests cover this area.** `src/tests/` only covers campaigns and comments. Cheap high-value targets: `resolveCapabilities` (pure), the trial/sub phase derivation, `Onboarding` step validation, and the `TrialGuardedShell` redirects.

### Stale documentation
- **`.claude/CLAUDE.md` campaigns flag.** It lists the `campaigns` flag as "campaigns feature (Velocity+)" and says Campaigns is "Subscription-gated (`sub?.campaigns`)". In fact it is hardcoded `true`, and only the count is capped (phase-2 doc, lines 18 and 225).
- **`.claude/CLAUDE.md` proposals limit.** It says "`proposals_limit` — 5 for Trial/Ignite". The canonical values are Ignite 10 and Trial null (phase-2 doc, lines 76 and 237). The Proposals section says the same wrong thing.
- **`.claude/CLAUDE.md` edge function list** omits `send-team-welcome`, `send-invoice-email`, `send-task-assignment-email`, `delete-workspace` and `toggle-maintenance`. `.claude/rules/supabase-patterns.md` claims the current functions are only three.
- **`.claude/rules/routing.md` is badly out of date.** It is missing `/team`, `/chat`, `/tasks`, `/prospects`, `/proposals`, `/approvals`, `/submissions`, `/help`, `/welcome`, `/join/:token`, `/no-access`, `/trial-expired`, `/subscription-expired`, `/policies` and `/proposal/:token`. It says `/operations/notes → NotesAndReminders` (the page is `Notes`) and that the catch-all redirects to `/dashboard` (it renders `NotFound`). It also lists ClientDetails tabs that no longer match.
- **`documentation/features/rbac-team-roles.md:147,403`** still describes `TeamSettings.jsx` member rows, which is the dead default export.
- **`.claude/rules/api-conventions.md`** forbids mutation hooks, but `team.js` and `feedback.js` use them, and CLAUDE.md itself documents `useGenerateInvite()`. Reconcile the two.

---

## Quick-win removal list (verified to have no live importers)

| Item | Lines saved (approx.) |
|---|---|
| `src/AppShell.jsx` | 21 |
| `src/components/sidebar/nav-secondary.jsx` | 158 |
| `src/components/sidebar/nav-clients.jsx` (plus its import in app-sidebar) | 152 |
| `src/pages/billingAndUsage/InvoicesTab.jsx` | 21 |
| `TeamSettings.jsx` default export (lines 862-1394) | about 530 |
| `agency.js` `completeFullAgencySetup` and `setupBrandingOnly` | about 105 |
| `useSubscription.needs_onboarding` | 2 |
| ProfileSettings fake delete-account section | about 120 |
| `/ads`, `/partnerships`, `ComingSoon.jsx` (if not planned soon) | about 210 |
| Unused icon imports, dead variables and commented-out JSX | (several files) |
| Outside this area, but found along the way: `src/pages/clients/clientSections/ComingSoon.jsx` has no importers | |
