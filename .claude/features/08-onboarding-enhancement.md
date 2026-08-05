# Feature: Onboarding Enhancement
**Product**: Tercero — Social Media Agency Management SaaS
**File**: `.claude/features/08-onboarding-enhancement.md`
**Status**: ✅ Complete (all 4 phases built; runtime click-throughs noted per phase)
**Last Updated**: August 2026

---

## Context

Onboarding used to show a two-card choice ("Full setup" vs "Visual identity") and then hand off to `CreateClientPage` reused with `standalone` — a single long client form wearing agency labels. It collected agency branding, socials and contact details, and nothing else. Several pieces of data the app actively renders (horizontal logo on invoices, invoice signatory block, agency address/website) were never asked for, and the "Visual identity" path silently discarded address/website because those columns didn't exist on `agency_subscriptions`.

This feature replaced the reused form with a purpose-built stepped wizard, added the missing capture, folded in team invites, made onboarding progress resumable from the DB instead of `localStorage`, and replaced the `WelcomeCarousel` dialog with a paged `/welcome` walkthrough.

Follows the wizard/stepper pattern already used by the Documents upload dialog and the multi-step `ProposalDialog`.

---

## Final Shape (as built)

**Onboarding — 5 steps, owner-only.** Identity → Contact → Signatory → Platforms (these four commit the agency record as one atomic write on "Save & continue") → Team. Completion hands off to `/welcome`.

```
src/pages/onboarding/
├── Onboarding.jsx          wizard shell: paging, per-step validation, skip list
├── OnboardingStepper.jsx   vertical rail; lockedBefore seals committed steps
├── uploads.js              shared upload/remove/extract-path helpers
└── steps/
    ├── IdentityStep.jsx    name, industry, square + horizontal logo
    ├── ContactStep.jsx     email, phone, website, city, address, description
    ├── SignatoryStep.jsx   invoice signatory name / designation / signature
    ├── PlatformsStep.jsx   reuses PlatformSelector
    └── InviteTeamStep.jsx  opens Settings' InviteDialog — no second invite form

src/components/onboarding/
└── SetupChecklistCard.jsx  dashboard checklist, radial progress ring

src/pages/welcome/
├── WelcomePage.jsx         persistent header, one feature per section
├── FeatureSection.jsx      content left, visual right
├── WelcomeNav.jsx          footer: exit left, Previous/Next right
├── WelcomeProgress.jsx     dotted position indicator
├── VisualFrame.jsx         screenshot frame + designed placeholder
└── sections.js             5 lifecycle groups, `image: null` insertion points
```

**Roles.** Everything here is owner-only (`canEditWorkspace`), per `03-rbac-team-roles.md`: "Onboarding is owner-only." Admins are view-only on workspace settings; invite creation is owner-only in `agency_invites` RLS. The wizard, its Settings entry points, and the dashboard checklist all gate on it.

**Dashboard checklist.** Five rows — agency (always pre-ticked, so progress never opens at 0%), logos (both square *and* horizontal), invoice signatory, invite team (a *pending* invite counts), first client. Recharts `RadialBarChart` ring via shadcn `ChartContainer`, amber → sky → green by percentage. Completed rows stay visible and ticked. **Dismissal is withheld until 100%.**

**Known residual:** a genuinely solo owner can only reach 100% by generating an invite link they never send, so the card is otherwise permanent for them. Options if it becomes a complaint: a grace-period unlock, or making `invite_team` individually skippable.

### Database columns added

| Column | Phase | Purpose |
|---|---|---|
| `agency_subscriptions.address` | 1 | agency postal address for invoice/proposal PDFs |
| `agency_subscriptions.website` | 1 | agency website for the invoice footer |
| `agency_subscriptions.onboarding_completed_at` | 3 | replaces `localStorage['has_seen_welcome_*']` |
| `agency_subscriptions.onboarding_skipped_steps` | 3 | gates whether the checklist shows at all |

### Fixed along the way

- **Branding-only path discarded address/website** — the columns didn't exist (Phase 1).
- **Onboarding state was per-device** — `localStorage`, so a new browser re-triggered it (Phase 3).
- **The wizard was shown to non-owners** — an invited member joining an unconfigured workspace was handed the agency setup form, and `agency_subscriptions` RLS is `ALL` on the workspace, so they could have written it (Phase 3).
- **First-client step created un-editable clients** — `CreateClientPage` requires `logo_url` and `platforms`; the step supplied neither, so the client couldn't be saved by the edit form. Step removed rather than patched.
- **Invite expiry declared twice** — the dialog and the onboarding step each had their own `DEFAULT_INVITE_EXPIRY_DAYS = 7`; they matched by coincidence. Defaults moved into `useGenerateInvite`.
- **`.claude/CLAUDE.md` said Team was a Settings tab** — it's `/team`; an unknown `?tab=` silently falls back to Profile, so the planned checklist link would have looked functional while going nowhere. Doc corrected.

**Recurring theme worth carrying forward:** every defect above came from *duplicating* something that already existed — a second client form, a second invite form, a second copy of a constant, a second source of truth for onboarding state. The build settled on reuse in each case (`InviteDialog`, `PlatformSelector`, `HorizontalLogoCropDialog`, shared invite defaults, DB-derived done-ness).

---

## Audit Findings (why this feature exists)

Data the app consumes that onboarding never collects:

| Data | Consumed by | Only settable today in |
|---|---|---|
| `logo_horizontal_url` | invoice PDF header (`InvoicePDF.jsx:253-254`), proposal PDF, report PDF | Settings → Agency |
| `signatory_name`, `signatory_designation`, `signature_url` | signature block on every invoice PDF (`InvoicePDF.jsx:347-356`) | Settings → Invoice |
| Team invites | `/join/:token` flow already exists (`src/api/team.js`) | Settings → Team |
| First real client | the actual first-value moment | `/clients/create` |
| Currency / locale | `CURRENCY` hardcoded `INR`/`en-IN` (`src/utils/constants.js:5-9`) | nowhere — see Out of Scope |
| Timezone | scheduling / calendar / reminders use browser local | nowhere — see Out of Scope |

Two defects this feature fixes:

1. **Branding-only path loses address & website.** `setupBrandingOnly()` (`src/api/agency.js:95-122`) writes `website`, `location` and `address` into `agency_subscriptions`, but the live schema has no such columns — the values are dropped. Invoices read `agency_address` / `agency_website` from the **internal client** row (`src/api/useSubscription.js:181-182`), which that path never creates. Net effect: a user types their address and website during onboarding and their invoices still render without either.
2. **Onboarding state is per-device.** The gate is `localStorage['has_seen_welcome_' + user.id]` (`AppShell.jsx:60, 78, 128`). A new browser re-triggers onboarding; and once `agency_name` is set, onboarding never reappears, so anything skipped is only reachable by hunting through Settings.

Decisions taken during planning:
- **The two-path choice is removed.** The internal agency account consumes no client slot (subscription-exempt), so making it optional buys nothing and is the direct cause of defect 1 and of the permanent "Workspace not initialized" nag in `AgencySettings` / `MyOrganization`. One flow, internal account always created.
- **Currency / locale / timezone are out of scope** — `CURRENCY` is a module-level constant imported across ~27 files; making it per-workspace is a cross-cutting refactor, not onboarding work.

---

## Phase Overview

```
Phase 1 — Stepped agency wizard
  Replace the reused CreateClientPage with a purpose-built 4-step wizard that
  also captures the horizontal logo and invoice signatory, and always creates
  the internal agency account. Fixes the dropped address/website defect.

Phase 2 — Activation steps
  Add two optional steps after agency setup: invite a teammate (generate +
  copy a join link) and add your first client.

Phase 3 — Resumable progress + setup checklist
  Move onboarding state from localStorage into agency_subscriptions, and
  surface skipped steps as a dismissible "Finish setting up" card on the
  dashboard that deep-links to the right settings tab.

Phase 4 — Welcome showcase
  Replace the WelcomeCarousel dialog with a full-page, paged /welcome
  route styled like a landing page — five lifecycle sections with copy and
  framed visual placeholders. Setup hands off to it and stays five steps.
```

**After each phase: stop and wait for approval before proceeding.**

---

## Phase 1 — Stepped Agency Wizard ✅ Complete

### Goal

A new agency owner lands on a 4-step wizard instead of an 8-field wall wearing client labels. Each step asks for one coherent group, validates on its own, and shows progress. By the end, the workspace has: agency branding (square **and** horizontal logo), full contact details including address and website that actually persist, an invoice signatory, the platforms they manage, **and** an internal agency account — all in one atomic write. Invoices generated immediately after onboarding render with the correct address, website, logo and signature, which is not true today.

### Before Starting — Confirm With Codebase

1. Read `src/pages/onboarding/Onboarding.jsx` — current choice screen and the `onComplete` / `onSkip` contract it has with `AppShell`.
2. Read `src/components/misc/AppShell.jsx:63-134` — the `checkAgencyStatus` / `isIncomplete` / `hasSeenWelcomeState` gate, and the `isSetupOpen` fallback that also mounts `CreateClientPage` (lines 186-213). Both call sites must be updated.
3. Read `src/api/agency.js` — `completeFullAgencySetup()` and `setupBrandingOnly()`. Phase 1 replaces both call paths with a single function; do **not** delete `setupBrandingOnly` until every caller (`AppShell`, `MyOrganization`, `AgencySettings`) is migrated.
4. Read `src/pages/clients/PlatformSelector.jsx` — prop contract (`selected`, `onChange`, `register`, `errors`, `watch`, `setValue`) so it can be reused verbatim inside the wizard's platform step.
5. Read `src/components/HorizontalLogoCropDialog.jsx` and its usage in `src/pages/settings/AgencySettings.jsx:198-237` — the crop → blob → upload → `logo_horizontal_url` flow to reuse.
6. Confirm `src/lib/industries.js` `INDUSTRY_OPTIONS` includes the `'Internal'` value and how `CreateClientPage` hides it for external clients.

### 1.1 Database

Two new columns on `agency_subscriptions`, so the agency's own address and website have a home that does not depend on the internal client row existing.

```sql
alter table public.agency_subscriptions
  add column if not exists address text,
  add column if not exists website text;

comment on column public.agency_subscriptions.address is
  'Agency postal address. Rendered on invoice/proposal PDFs.';
comment on column public.agency_subscriptions.website is
  'Agency website. Rendered in the invoice PDF footer.';
```

No new RLS policies — `agency_subscriptions` already has workspace-scoped policies keyed on `user_id` via `get_my_agency_user_id()`.

No new storage bucket. Logo and signature uploads continue to use the existing public `post-media` bucket under `branding/` and `signatures/` prefixes, matching `AgencySettings.jsx` and `InvoiceSettings.jsx`.

**This migration must be applied and confirmed before any component code is written.**

### 1.2 API Layer

Additions to `src/api/agency.js`:

```js
/**
 * Single atomic onboarding write. Replaces completeFullAgencySetup +
 * setupBrandingOnly for the onboarding path. Upserts branding + contact +
 * signatory onto agency_subscriptions, then creates-or-updates the internal
 * client row (is_internal = true, tier = 'INTERNAL', industry = 'Internal').
 */
export async function completeAgencyOnboarding(payload)
```

`payload` shape (flat, matching the wizard's single RHF form):

| Key | Target |
|---|---|
| `agency_name` | `agency_subscriptions.agency_name` + `clients.name` |
| `logo_url` | both |
| `logo_horizontal_url` | `agency_subscriptions` only |
| `industry` | both |
| `email`, `mobile_number`, `description` | both |
| `address`, `website` | `agency_subscriptions` (new columns) + `clients` |
| `location` | `clients` only |
| `platforms`, `social_links` | both |
| `signatory_name`, `signatory_designation`, `signature_url` | `agency_subscriptions` only |

Behaviour:
- Resolve the workspace with `resolveWorkspace()` (no hooks — it's a plain mutation function, per `.claude/rules/api-conventions.md`).
- Upsert `agency_subscriptions` on `user_id`, explicitly **omitting** every plan/subscription column (`plan_name`, `max_clients`, feature flags) — same guard `completeFullAgencySetup` already documents.
- Look up the existing internal client by `user_id` + `is_internal = true` before writing, to avoid the 42P10 partial-index error — reuse the existing pattern at `agency.js:43-48`.
- `created_by` on the internal client is the caller's real UID from `(await supabase.auth.getUser()).data.user.id`, **not** `workspaceUserId`.
- Throw on every Supabase error; never swallow.
- Return the internal client row (callers invalidate `['internal-client']`, `['clients']`, `['subscription']`).

Also extend `src/api/useSubscription.js` so address and website fall back to the new columns:

```js
agency_address: internalClient?.address ?? sub.address ?? null,
agency_website: internalClient?.website ?? sub.website ?? null,
```

Internal client first preserves today's behaviour for existing workspaces; the new columns cover any workspace without an internal client row.

### 1.3 Components

```
src/pages/onboarding/
├── Onboarding.jsx                  (rewritten — wizard shell, was the choice screen)
├── OnboardingStepper.jsx           (new — progress indicator)
└── steps/
    ├── IdentityStep.jsx            (new)
    ├── ContactStep.jsx             (new)
    ├── SignatoryStep.jsx           (new)
    └── PlatformsStep.jsx           (new)
```

**`Onboarding.jsx`** — props unchanged (`user`, `onComplete`, `onSkip`) so `AppShell`'s contract holds. Owns:
- One `useForm` instance (RHF + Zod) for all four steps, `mode: 'onSubmit'`. A single form, not four — so a Back navigation never loses input.
- `step` state (0-3). "Continue" runs `form.trigger([...fieldsForThisStep])` and only advances when that subset passes, so step 3 errors don't block step 1.
- Keeps the existing greeting header (`Hey, {firstName} 👋` derived from `user_metadata.full_name` → email local part) above the stepper.
- Final "Finish setup" submits via `useMutation` → `completeAgencyOnboarding`, invalidates `['internal-client']`, `['clients']`, `['subscription']`, then calls `onComplete()`.
- `toast.error()` on failure via `sonner`; the wizard stays on the last step with values intact.

Zod schema, per step:

| Step | Fields | Required |
|---|---|---|
| 1 — Identity | `agency_name`, `logo_url`, `logo_horizontal_url`, `industry` | `agency_name` (min 2), `industry` |
| 2 — Contact | `email`, `mobile_number`, `website`, `location`, `address`, `description` | `email` (valid email) |
| 3 — Signatory | `signatory_name`, `signatory_designation`, `signature_url` | none |
| 4 — Platforms | `platforms`, `social_links` | `platforms` min 1 |

Deliberate change from today: **the logo is no longer required.** `CreateClientPage`'s `logo_url: z.string().min(1)` makes an image upload mandatory on the very first screen of the product. Branding degrades gracefully everywhere (`InvoicePDF` falls back through horizontal → square → Tercero logo), so this is friction with no payoff.

**`OnboardingStepper.jsx`** — props `{ steps, current }`. Renders numbered pills with labels, completed steps as checks, connector lines between. `cn()` for conditional classes. Past steps are clickable, future steps are not — same rule as `WelcomeCarousel`'s progress dots.

**`IdentityStep.jsx`** — agency name, industry `Select` (from `INDUSTRY_OPTIONS`, `'Internal'` filtered out — the internal *client* row is stamped `industry: 'Internal'` by the API function, the user picks their real industry for display), and two logo uploaders side by side:
- Square logo — circular dashed dropzone, `Camera` hover overlay, remove button. Lift the `handleFileUpload` / `removeLogo` / `extractStoragePath` logic from `CreateClientPage.jsx:299-352` (uploads to `post-media` under `branding/`, deletes the superseded file).
- Horizontal logo — reuses `HorizontalLogoCropDialog`, upload happens on crop-apply exactly as in `AgencySettings.handleCropApplied`. Caption "For invoices, proposals & reports."

**`ContactStep.jsx`** — email (prefilled `user.email`), mobile, website, location, address `Textarea`, description `Textarea`. Drops `CreateClientPage`'s `status` / `tier` / `client_type` / `contact_name` fields — all meaningless for the agency's own record (`status` and `tier` are hardcoded `ACTIVE` / `INTERNAL` by the API function).

**`SignatoryStep.jsx`** — signatory name (prefilled from `user_metadata.full_name`), designation, signature image upload. Reuses the upload/remove flow from `InvoiceSettings.jsx:46-86` (`post-media` under `signatures/`). Copy explains the payoff: "This appears on the invoices you send." An explicit "Skip for now" advances without values.

**`PlatformsStep.jsx`** — wraps the existing `PlatformSelector` via `Controller`, passing `register` / `errors` / `watch` / `setValue` from the shared form. Copy frames it as "Platforms your agency manages" — these seed the agency's own account, not a client's.

### 1.4 AppShell Integration

`src/components/misc/AppShell.jsx`:
- The `isIncomplete && !hasSeenWelcomeState` branch (lines 122-134) still renders `<OnboardingPage>`; no signature change.
- **Remove the `isSetupOpen` block (lines 186-213)** and the `setupMode` state, and drop the `CreateClientPage` / `setupBrandingOnly` / `completeFullAgencySetup` imports. The `openAgencySetup` callback exposed through `<Outlet context>` (lines 163-166) must now route to `/settings?tab=agency` instead — grep for `openAgencySetup` consumers before changing it.

`src/pages/MyOrganization.jsx` and `src/pages/settings/AgencySettings.jsx`:
- Both render a "Path C" two-card choice (`Identity Branding` vs `Operational Workspace`) mounting `CreateClientPage standalone`. With one onboarding flow these choices are dead ends. Replace each with a single "Set up your agency" button that mounts the new wizard in-place (it accepts `onComplete` / `onSkip` already), and delete the now-unreachable `setupMode` branching.
- Leave the **"Path B"** activation banner ("Workspace not initialized" → `activateInternalWorkspace`) intact for now — existing workspaces that took the old branding-only path still need it. It becomes unreachable for new signups.

### 1.5 Impact on Existing Features

| Existing Feature | Impact | What to watch for |
|---|---|---|
| Invoices (PDF + HTML preview) | Address, website, horizontal logo and signature are now populated from day one | `useSubscription` fallback order must keep internal-client values winning, or existing workspaces' invoices change |
| Settings → Agency | "Path C" choice cards replaced by a single wizard entry point | `agencySettings` comes from `useOutletContext()`; the wizard must call `refreshAgency()` on success or the sidebar keeps the stale name |
| Settings → Invoice | Signatory may already be filled when the user first opens it | `hasInitialized` ref guard at `InvoiceSettings.jsx:37-44` already handles prefilled values |
| My Organization | Same choice-card replacement | Page returns `<ClientProfileView>` as soon as an internal client exists — after the wizard it will, immediately |
| `WelcomeCarousel` | Unchanged. Still fires post-onboarding off the same `localStorage` flag | Phase 3 migrates that flag; leave it alone in Phase 1 |
| Client creation | `CreateClientPage`'s `standalone` prop and `customSubmit` / `defaultValues` props lose all callers | Keep the props — removing them is unrelated cleanup. Note it for a later pass |

### 1.6 What This Phase Does NOT Include

- Invite-a-teammate and add-a-first-client steps (Phase 2)
- Any change to `localStorage['has_seen_welcome_*']` (Phase 3)
- The dashboard setup checklist (Phase 3)
- Currency, locale or timezone (out of scope entirely)
- Removing `setupBrandingOnly()` / `activateInternalWorkspace()` — existing workspaces still depend on the activation path
- Any change to `WelcomeCarousel` slides
- Deleting `CreateClientPage`'s `standalone` / `customSubmit` / `defaultValues` props

### 1.7 Phase 1 Checklist — Before Marking Complete

- [x] `agency_subscriptions.address` and `.website` exist in the live schema and are commented
- [x] `completeAgencyOnboarding()` exists in `src/api/agency.js` and omits every plan/feature-flag column — **`created_by` dropped, see Implementation Notes**
- [x] The internal client row is created on every onboarding completion — no path leaves a workspace without one
- [x] `useSubscription` returns `agency_address` / `agency_website` falling back to the new columns, internal client winning
- [x] Onboarding renders four steps with a visible stepper; Back preserves entered values (single shared `useForm` instance)
- [x] Per-step validation: a blank signatory never blocks advancing past step 1 (`STEP_FIELDS` + `form.trigger`)
- [x] Logo is optional; agency name, industry, email and ≥1 platform are required
- [x] `AppShell`'s `isSetupOpen` / `CreateClientPage` block is gone; `openAgencySetup` had **no** consumers outside `AppShell`, so it was deleted rather than repointed
- [x] `MyOrganization` and `AgencySettings` no longer show the two-card choice
- [x] `npm run lint` introduces no new errors in touched files; `npm run build` passes

Not yet verified — needs a browser click-through, not reachable from static analysis:

- [ ] Both square and horizontal logos upload to `post-media` and persist; the horizontal one goes through `HorizontalLogoCropDialog`
- [ ] Signature uploads to `post-media/signatures/` and appears in Settings → Invoice afterwards
- [ ] An invoice generated straight after onboarding renders agency name, address, website, horizontal logo and signature

### Implementation Notes

- **`created_by` dropped from the plan.** The `clients` table has no `created_by` column (verified against the live schema), so the planned `auth.uid()` stamp has nowhere to go. `completeAgencyOnboarding()` writes no `created_by`, matching what `completeFullAgencySetup()` already did. Adding the column is a separate change and would need a backfill.
- **`agency_subscriptions` upsert always takes the UPDATE path.** The `tr_on_auth_user_created` trigger on `auth.users` runs `handle_new_user_subscription()`, which creates the subscription row at signup with plan defaults. So the onboarding upsert never inserts a fresh row and cannot reset plan columns. RLS is `agency_subscriptions_workspace_scoped` (`ALL`, `user_id = get_my_agency_user_id()`) — satisfied because the write uses `workspaceUserId` from `resolveWorkspace()`.
- **A "Finish later" escape hatch was kept.** With the choice screen gone, the wizard would otherwise hard-lock a new user with no way out. Step 1 shows a subtle "Finish later" that calls the existing `onSkip` prop, so `AppShell`'s contract is unchanged. Phase 3 replaces the localStorage flag behind it.
- **Shared upload helper extracted.** `src/pages/onboarding/uploads.js` holds `uploadBrandingAsset` / `removeBrandingAsset` / `extractStoragePath`, rather than copying the same three functions a fourth time (they're currently duplicated in `CreateClientPage`, `AgencySettings` and `InvoiceSettings`). Removal is best-effort and never throws, so an orphaned file can't fail a submit. The existing duplicates were left alone — consolidating them is unrelated cleanup.
- **Dead code removed as a consequence:** the `ChoiceCard` helper in both `AgencySettings` and `MyOrganization`, the `Palette` / `Rocket` icon imports in `AgencySettings`, and the now-unused `cn` import in `MyOrganization`.
- **Deliberately left in place:** `setupBrandingOnly()`, `completeFullAgencySetup()` and `activateInternalWorkspace()` in `src/api/agency.js`, plus the "Workspace not initialized" activation banner. Workspaces created through the old branding-only path still depend on them. They are now unreachable for new signups.
- **Known warning:** `Onboarding.jsx` trips `react-hooks/incompatible-library` on `form.watch('platforms')`. Same pattern and same warning as `CreateClientPage` and `DraftPostForm`; it is the documented RHF + React Compiler interaction, not a defect.

**→ Stop here. Show the result and wait for approval.**

---

## Phase 2 — Activation Steps ✅ Complete

### Before Starting — Confirm Phase 1 is Approved

### Goal

After the agency is configured, the wizard offers the two actions that actually make the workspace useful: bringing a teammate in and adding a real client. Both are explicitly skippable — the user reaches the dashboard either way. Today neither is surfaced during onboarding at all, and a new owner lands on an empty dashboard with no idea what to do next.

### 2.1 Database

No database changes in this phase.

### 2.2 API Layer

No new functions. Reuses:
- `useGenerateInvite()` from `src/api/team.js:124-170` — takes `{ system_role, permissions, expires_at, label }`, returns a full `/join/:token` URL, and already throws `TEAM_SEAT_LIMIT_REACHED` when `max_team_members` is hit.
- `createClient()` from `src/api/clients.js` — unchanged; it already fires `send-client-welcome`.

### 2.3 Components

> ⚠️ **This subsection is the original plan and was superseded during the build.**
> `FirstClientStep` was removed entirely and `InviteTeamStep` now opens Settings'
> `InviteDialog` instead of rendering its own reduced form. See the Phase 2
> Implementation Notes for why. Kept for history — do not build from it.

```
src/pages/onboarding/steps/
├── InviteTeamStep.jsx        (new — shipped, but reworked; see notes)
└── FirstClientStep.jsx       (planned, never shipped — removed)
```

**~~`InviteTeamStep.jsx`~~** *(superseded)* — a "Generate invite link" button → `useGenerateInvite({ system_role: 'member', permissions: { documents: 'view' } })` → the URL in a read-only `Input` with a copy button. On `TEAM_SEAT_LIMIT_REACHED`, show the plan's seat limit and a link to `/billing` rather than an error toast.

**~~`FirstClientStep.jsx`~~** *(never shipped)* — a deliberately minimal client form: name, email, industry, tier. Not the full `CreateClientPage`; four fields is enough to create a usable client and the rest is editable later.

Both steps must respect the client/seat limits already enforced in the API layer; the wizard should never present an action that will fail.

**`Onboarding.jsx`** changes: steps 5 and 6 appended, and these two sit **outside** the shared agency form — each owns its own submit and its own success state, because they write to different tables and neither should be able to fail the agency write. Reaching step 5 means the agency is already saved, so from here on the primary action is "Go to dashboard", not "Finish setup".

### 2.4 Impact on Existing Features

| Existing Feature | Impact | What to watch for |
|---|---|---|
| Team settings | Invites created during onboarding appear in `usePendingInvites()` | Realtime subscription already invalidates; nothing to do |
| Client list | A client may exist before the user first opens `/clients` | Empty state must not be assumed |
| Billing / usage | First client counts against `max_clients` | `useGenerateInvite` and `createClient` already enforce limits — don't duplicate the check in the UI |

### 2.5 What This Phase Does NOT Include

- Email-based invites (the existing flow is copy-a-link; don't add an email send here)
- Role or permission pickers on the invite step — default `member`, editable later in Settings → Team
- Bulk client import
- Prospect → client conversion from onboarding

### 2.6 Phase 2 Checklist — Before Marking Complete

- [x] Seat-limit state shows the limit and a `/billing` link, not a raw error — and the generate button is withheld entirely when seats are exhausted
- [x] ~~Client-limit state shows `max_clients` and a `/billing` link~~ — n/a, the first-client step was removed (see Implementation Notes)
- [x] The invite step is skippable; its primary action doubles as the skip, since nothing on it is required
- [x] A failure in either step cannot lose or corrupt the Phase 1 agency write — the agency is committed before step 5 renders, and each activation step owns an isolated mutation
- [x] `npm run lint` introduces no new errors; `npm run build` passes

Not yet verified — needs a browser click-through:

- [ ] Step 5 generates a working `/join/:token` link that a second account can actually redeem

### Implementation Notes

- **Revised after review: the first-client step was dropped entirely.** `FirstClientStep` collected name / email / industry / tier, but `CreateClientPage` requires `logo_url` and `platforms` (≥1) — so a client created during onboarding **could not be saved by the edit form** until the user supplied both. "Editable later" was actually "blocked later", on fields they never knowingly skipped. Rather than patch field parity, the step was removed: onboarding now covers the user's *own* company only (agency + team). Adding a client is real work, not setup, and `/clients/create` already does it with every field. The activation nudge survives as the dashboard checklist's `first_client` row, which deep-links to the full form. This also deletes a second form writing the `clients` table — the drift between those two forms is precisely what produced the defect.
- **The invite step reuses Settings' `InviteDialog` rather than implementing its own form.** It first had a single "Generate invite link" button issuing a fixed member/7-day invite — a reduced version of the real flow. It now opens the actual dialog, so the owner gets the full option set (link name, expiry up to 30 days, Team Member vs Team Admin, document access). `TeamPage` already imported that dialog, so the cross-page import has precedent. `InviteDialog` gained one optional `onGenerated` callback so onboarding can record that an invite was created; its existing usage is unaffected. This leaves **one** invite UI in the codebase.
- **Invite defaults moved into the API layer.** `DEFAULT_INVITE_EXPIRY_DAYS` / `MAX_INVITE_EXPIRY_DAYS` / `DEFAULT_INVITE_PERMISSIONS` now live in `src/api/team.js`, and `useGenerateInvite()` applies them itself — so a caller wanting "the standard invite" passes no arguments and cannot drift.
- **New prop: `includeActivation` (default `true`).** Not in the plan, but necessary. `AgencySettings` and `MyOrganization` reuse the wizard to *reconfigure* an existing agency — showing "invite your team" and "add your first client" as steps 5–6 of an edit flow is wrong for a workspace that already has both. Both call sites pass `includeActivation={false}`; first-run onboarding via `AppShell` gets the default.
- **The agency write moved off the final step.** The last agency step (Platforms) now reads "Save & continue" and commits the agency record, then advances to step 5. This is what makes the activation steps unable to endanger the agency data — by the time they render, it's already persisted.
- **Back-navigation into saved steps is sealed.** `OnboardingStepper` gained a `lockedBefore` prop; once the agency is committed, steps 0–3 stop being clickable and the Back button on step 5 clamps to `AGENCY_STEP_COUNT`. Without this a user could walk back and re-submit the agency write.
- **Activation steps render outside the `<form>` element.** `FirstClientStep` carries its own `useForm` — nested `<form>` tags are invalid HTML and the inner submit would not fire. The step body and the action row are shared between the two branches via local variables rather than duplicated JSX.
- **Seat pre-check verified against the server.** `InviteTeamStep` gates on `useTeamMembers().length >= max_team_members`. Confirmed the `get_team_members` RPC selects `agency_members WHERE agency_user_id = X AND is_active = true` — the identical set `useGenerateInvite` counts — so the client-side check can't disable the button a seat early. `null` max means unlimited and is short-circuited before the comparison.
- **Invite defaults, not pickers.** The generated invite is `system_role: 'member'`, `permissions: { documents: 'view' }`, 7-day expiry — matching `InviteDialog`'s own defaults. Role and permission pickers stay in Settings → Team, per the phase's stated scope.
- **`FirstClientStep` allows more than one client.** After a successful create it shows a confirmation and relabels the button "Add another client", rather than locking after the first. Costs nothing and matches how agencies actually onboard.

**→ Stop here. Show the result and wait for approval.**

---

## Phase 3 — Resumable Progress + Setup Checklist ✅ Complete

### Before Starting — Confirm Phase 2 is Approved

### Goal

Onboarding state moves out of `localStorage` and into the workspace record, so it survives a browser change and is consistent for every member of the workspace. Anything the user skipped stops being invisible: a dismissible "Finish setting up" card on the dashboard lists what's still missing and links straight to the screen that fixes it.

### 3.1 Database

```sql
alter table public.agency_subscriptions
  add column if not exists onboarding_completed_at timestamptz,
  add column if not exists onboarding_skipped_steps text[] default '{}';

comment on column public.agency_subscriptions.onboarding_completed_at is
  'Set when the owner finishes or dismisses the onboarding wizard. Replaces the
   per-device localStorage has_seen_welcome_* flag.';
comment on column public.agency_subscriptions.onboarding_skipped_steps is
  'Step keys the owner skipped (signatory | horizontal_logo | invite_team |
   first_client). Drives the dashboard setup checklist.';

-- Backfill: any workspace that already has a name has effectively onboarded,
-- so the wizard must not reappear for them.
update public.agency_subscriptions
   set onboarding_completed_at = coalesce(onboarding_completed_at, updated_at, now())
 where agency_name is not null
   and trim(agency_name) <> ''
   and onboarding_completed_at is null;
```

The backfill is the important part — without it, every existing workspace gets shown the wizard again on next load.

### 3.2 API Layer

In `src/api/agency.js`:

```js
export async function markOnboardingComplete({ skippedSteps = [] })
export async function dismissSetupChecklist()   // clears onboarding_skipped_steps
```

In `src/api/useSubscription.js`, expose:
- `onboarding_completed_at`
- `onboarding_skipped_steps` (default `[]`)
- `needs_onboarding` — derived: no `agency_name` **and** no `onboarding_completed_at`

### 3.3 Components

**`src/components/onboarding/SetupChecklistCard.jsx`** (new) — shows only when `onboarding_skipped_steps` is non-empty, then lists **all** of the steps below with live done-ness (as shipped; the plan originally listed only outstanding rows). Each row has a label, a one-line rationale and a deep link:

| Step key | Label | Links to |
|---|---|---|
| `agency` | Set up your agency (always pre-ticked) | `/settings?tab=agency` |
| `logos` | Add your logos — square **and** horizontal | `/settings?tab=agency` |
| `signatory` | Add your invoice signatory | `/settings?tab=invoice` |
| `invite_team` | Invite your team | `/team` |
| `first_client` | Add your first client | `/clients/create` |

Dismiss (`X`) calls `dismissSetupChecklist()` and is **only rendered at 100%**. Uses `lucide-react` icons only, plus a Recharts radial ring for progress.

Mounted in `src/pages/dashboard/Dashboard.jsx` directly under `DashboardWelcomeMessage`.

### 3.4 AppShell Integration

`src/components/misc/AppShell.jsx`:
- Replace the `hasSeenWelcomeState` / `localStorage` gate (lines 59-61, 78-87, 122-134, 176-179) with the DB-derived `needs_onboarding`.
- Keep a one-time localStorage→DB reconciliation: if `has_seen_welcome_${user.id}` is `'true'` and `onboarding_completed_at` is null, write it through once, then stop reading the key. Delete the key afterwards so it can't resurrect.
- `WelcomeCarousel`'s open/close still writes the same flag today — repoint it at `onboarding_completed_at` so the carousel doesn't reappear on a new device either.

The wizard's final submit calls `markOnboardingComplete({ skippedSteps })` with the keys the user skipped.

### 3.5 Impact on Existing Features

| Existing Feature | Impact | What to watch for |
|---|---|---|
| `AppShell` gate | Now DB-driven; one extra field on an already-fetched row | `fetchAgencySettings()` uses `select('*')`, so no query change needed |
| `WelcomeCarousel` | Trigger moves to the DB flag | Must not re-show for users who already dismissed it — that's what the reconciliation step protects |
| Dashboard | New card between the welcome message and the stat rows | Renders nothing when nothing was skipped; don't let it shift layout for established workspaces |
| Invited members | They see the owner's workspace record | The checklist card is **owner/admin only** — gate on `usePermissions()`, a member can't fix any of these |

### 3.6 What This Phase Does NOT Include

- Re-running the wizard on demand from Settings
- Per-member onboarding (a separate first-run experience for invited teammates)
- Progress analytics or drop-off tracking
- Removing `WelcomeCarousel`

### 3.7 Phase 3 Checklist — Before Marking Complete

- [x] `onboarding_completed_at` and `onboarding_skipped_steps` exist and the backfill has run — verified: all 5 workspaces are named, all 5 have `onboarding_completed_at` set, all 5 have empty skip lists
- [x] An existing workspace with an `agency_name` is **not** shown the wizard after deploy (backfill guarantees it)
- [x] Completing onboarding in one browser means no wizard in a different browser — the gate is `agency_subscriptions.onboarding_completed_at`, not `localStorage`
- [x] `has_seen_welcome_*` is read at most once (`reconcileLegacyOnboardingFlag`) and then `removeItem`'d
- [x] Each checklist row lands on a screen where the item can actually be completed — **`invite_team` corrected to `/team`**, see Implementation Notes
- [x] Dismissing the card is permanent across reloads (`dismissSetupChecklist` clears the array)
- [x] The card is scoped to `canEditWorkspace` — hidden for admins **and** members
- [x] `WelcomeCarousel` does not reappear on a second device — it's now session-driven, shown once straight after setup, with no persisted flag at all
- [x] `npm run lint` introduces no new errors; `npm run build` passes

Not yet verified — needs a browser click-through:

- [ ] Skipping the signatory step makes exactly that row appear in the dashboard checklist
- [ ] Completing a listed item elsewhere in the app makes its row disappear on next dashboard load

### Implementation Notes

- **Done-ness is derived from live data; the stored list only gates eligibility.** The plan had the checklist read purely from `onboarding_skipped_steps`, which drifts: complete an item in Settings and the row would linger until something re-synced it. Instead the stored list decides which rows are *ever* eligible (empty for every backfilled workspace, so established users are never nagged), and each row is filtered by a live check — `logo_horizontal_url`, `signatory_name`/`signature_url`, teammates present, `client_count > 0`. Rows self-heal with no sync code and no reconcile-on-edit path. This is also why the Settings reconfigure flow deliberately writes nothing to the onboarding columns.
- **Onboarding is now owner-only — this was a real bug.** `AppShell` previously showed the wizard to *anyone* whose workspace lacked an `agency_name`, so an invited member joining an unconfigured workspace would have been handed the agency setup form — and `agency_subscriptions`' RLS policy is `ALL` on the workspace, so they could have written it. Gated on `canEditWorkspace`, matching the RBAC doc's own line: "**Onboarding is owner-only.**"
- **`canEditWorkspace` rather than a hand-rolled `user.id === workspaceUserId`.** It's the canonical flag for "Edit agency identity / branding / config" in `permissions.js`, and it correctly includes `superadmin`. Verified no first-render flash: `AuthProvider` renders `{!loading && children}` and awaits `resolveWorkspace()` before clearing `loading`, so the role is known before `AppShell` mounts.
- **Checklist is owner-only, not owner+admin as planned.** Three of the four rows are owner-exclusive per the capability matrix (workspace settings = admin 👁️ view-only; invoice signatory = owner ✅ / admin ❌; team invite = owner ✅ / admin ❌ — the last one enforced in `agency_invites` RLS). Only `first_client` is admin-capable, and that's already on `/clients`. Showing admins a card of three dead links would be worse than not showing it.
- **`invite_team` links to `/team`, not `/settings?tab=team`.** The plan (and `.claude/CLAUDE.md`) say Team is a Settings tab; it isn't — `Settings.jsx`'s `VALID_TABS` is `['profile','agency','invoice','danger']` and Team is its own route at `/team` (`TeamPage`). An unknown `tab` value silently falls back to Profile, so the planned link would have looked like it worked while going nowhere.
- **`WelcomeCarousel` became session-driven instead of flag-driven.** The plan said "repoint it at `onboarding_completed_at`", but one timestamp can't serve as both "show the tour" and "don't show it again" — it would loop on every load. The wizard's `onComplete` now sets `showWelcome` directly, so the tour fires exactly once right after setup and needs no persisted marker. Side effect, and arguably an improvement: someone who taps "Finish later" no longer gets a feature tour they didn't ask for.
- **The wizard's `onSkip` writes `markOnboardingComplete({ skippedSteps: [] })`.** "Finish later" has to persist something or the wizard reappears on next load — same semantics as the old localStorage flag, just workspace-wide. An empty skip list means no checklist; `AgencySettings` already carries its own "Set up your agency" prompt for that case.
- **Wizard entry points in `AgencySettings` and `MyOrganization` are gated on `canEditWorkspace`** (hidden, plus a no-op guard in `handleOpenSetup`), with substitute copy pointing non-owners at the owner. Broader admin view-only enforcement on those pages (e.g. the inline logo uploaders) is pre-existing and belongs to RBAC Phase 2 — deliberately not touched here.
- **`markOnboardingComplete` failures are non-blocking.** If the write fails the user still reaches the app: the agency is already saved and `needs_onboarding` is already false, so the only loss is the checklist. Logged, not toasted — there's nothing the user could do about it.

#### Checklist card — revisions after review

- **Rows are a fixed canonical list, not the stored skip keys.** The two concerns were separated: `onboarding_skipped_steps` being non-empty decides *whether the card shows* (so backfilled workspaces are never nagged and dismissal is permanent), while the rows themselves are the five steps below with live done-ness. Before this, a step completed during onboarding vanished from the list instead of showing ticked — which is why the signatory row looked absent.
- **An always-done `agency` row leads the list** so progress opens at 20%, never 0%. Onboarding writes `agency_name`, so it's ticked by definition on the dashboard.
- **The logo row checks both logos.** Renamed `horizontal_logo` → `logos`; ticks only once `logo_url` *and* `logo_horizontal_url` exist. `horizontal_logo` stays in `ONBOARDING_STEP_KEYS` so already-written rows still validate — the show/hide gate only tests array length, so nothing breaks either way.
- **`invite_team` counts a pending invite,** not just an accepted one. Since dismissal is locked until 100%, requiring acceptance would hold the card hostage to a third party.
- **Progress is a radial ring, not a bar.** Recharts `RadialBarChart` inside shadcn's `ChartContainer` (which already styles `.recharts-radial-bar-background-sector`). Colour carries the same signal as the number — amber < 50%, sky 50–99%, green at 100%. The percentage is an absolutely-positioned overlay because Recharts label placement is unreliable at this size.
- **Completed rows stay visible, ticked and struck through,** and are not links — there's nowhere useful to send someone for a finished step.
- **Dismissal is withheld until 100%** — the X is *hidden*, not disabled, since a greyed-out control that looks interactive is worse than none.
- **Plan limits checked before locking dismissal:** minimum seats are Ignite 4 / Velocity 10 / Quantum unlimited, clients 8 / 20 / unlimited — so no plan makes a step unreachable.

**→ Stop here. Show the result and wait for approval.**

---

## Phase 4 — Welcome Showcase (replaces the carousel modal) ✅ Complete

### Goal

The `WelcomeCarousel` dialog is replaced by a full-page `/welcome` route — one section per stage of the agency lifecycle, each with copy and a framed visual. Setup stays five steps; the showcase runs *after* it and is skippable at any point. Because it's a real route it can be linked from Help and revisited, which a modal never could.

### Why the modal goes

- **It has already rotted.** Its 8 slides cover prospects, clients, posts, approvals, campaigns, proposals/finance and team/docs — **Chat and Tasks are both shipped and neither appears.** A hand-maintained slide list drifts every time a feature lands and nothing forces anyone to notice.
- A `max-w-4xl` dialog is the wrong canvas for feature storytelling with imagery.
- It can only ever be seen once, by accident of timing. There is no way back to it.

### Decisions taken

- **Not merged into the wizard.** Appending 8 feature screens to a 6-step setup means 14 screens before the dashboard. The user has already signed up — putting marketing in front of the task they came to do risks abandoning the part that actually matters. The wizard hands off instead.
- **Scrolling, not paged.** "Like a landing page" means the reader controls the pace and can skim. Pagination would reintroduce the click-count problem the modal already had.
- **8 sections compressed to 5**, grouped by the lifecycle the old slide 1 already named ("first contact to final invoice"). The grouping gives future features an obvious home, so it rots more slowly.
- **Placeholders are designed, not broken.** No "image here" boxes in front of brand-new users. Each visual frame degrades to a deliberate composition (large emoji + a caption naming what will sit there), so swapping in a screenshot later is a one-line change per section.

### Before Starting — Confirm With Codebase

1. Read `src/App.jsx:186-255` — protected routes sit inside `<Route element={<TrialGuardedShell user={user} />}>`, which renders `AppShell` (sidebar + header). `/welcome` must be a **sibling** of `/no-access` and `/trial-expired` — inside `session ? (...)` but *outside* `TrialGuardedShell` — or it inherits the sidebar chrome.
2. Read `src/components/misc/AppShell.jsx` — the `showWelcome` state and the `WelcomeCarousel` mount both go; `onComplete` navigates instead.
3. Confirm `WelcomeCarousel` has no other consumer (grep: only `AppShell`).
4. Read `src/components/WelcomeCarousel.jsx` before deleting — its slide copy is the starting point for the new section content.

### 4.1 Database

No database changes in this phase. The showcase is stateless — it's reached by navigation, not by a flag, so nothing needs persisting.

### 4.2 API Layer

No API changes.

### 4.3 Components

```
src/pages/welcome/
├── WelcomePage.jsx        (new — route shell: persistent header, paging state)
├── FeatureSection.jsx     (new — one section: content left, visual right)
├── WelcomeNav.jsx         (new — footer: exit left, Previous/Next right)
├── WelcomeProgress.jsx    (new — dotted position indicator)
├── VisualFrame.jsx        (new — screenshot frame + placeholder fallback)
└── sections.js            (new — section content data)
```

**`sections.js`** — as shipped, an array of `{ key, label, summary, details[{title, body}], image, emoji, visualCaption }`. Content data separated from layout so adding a feature is a data edit, not a JSX edit.

Five sections:

| Key | Section | Covers |
|---|---|---|
| `win` | Win the work | Prospects pipeline, proposals, public proposal links |
| `deliver` | Deliver it | Deliverables + versioning, campaigns, content calendar |
| `approve` | Get it approved | Per-post review links, campaign batch review, internal approvals |
| `paid` | Get paid | Invoices + PDF export, expenses, ledger, reports |
| `team` | Run the team | Chat, tasks, documents, notes, meetings |

**`WelcomePage.jsx`** — *as shipped:* a constant header (title, subtitle, Tercero mark at the far right of the same row), a dotted position indicator row beneath it, then one feature section at a time, then the footer nav. Nothing sticky. The original plan called for a scrolling page with a sticky bar and hero — see the Phase 4 Implementation Notes for the shapes tried and why this one won.

### 4.4 Integration

- `src/App.jsx` — add `<Route path="/welcome" element={<WelcomePage />} />` beside `/no-access`.
- `src/components/misc/AppShell.jsx` — drop the `WelcomeCarousel` import, its mount, and the `showWelcome` state; the wizard's `onComplete` calls `navigate('/welcome')` after `checkAgencyStatus()`.
- **Delete `src/components/WelcomeCarousel.jsx`.**

### 4.5 Impact on Existing Features

| Existing Feature | Impact | What to watch for |
|---|---|---|
| `WelcomeCarousel` | Deleted | Only `AppShell` imported it — confirm before removing |
| `AppShell` | Loses `showWelcome`; gains `useNavigate` | The Phase 3 session-driven-tour workaround disappears with it |
| Onboarding wizard | `onComplete` navigates instead of opening a dialog | The Settings reuse path (`includeActivation={false}`) must **not** redirect — it passes its own `onComplete` and stays in Settings |
| Trial guarding | `/welcome` sits outside `TrialGuardedShell` | Intentional, for the full-page canvas. New signups always have a live trial, so this is not a bypass in practice |

### 4.6 What This Phase Does NOT Include

- Real screenshots or illustrations — placeholders only, by agreement. Each section has an `image: null` slot ready.
- Analytics on whether the showcase is read
- Per-plan content variation (showing only features the plan includes)
- Any change to the setup steps

Delivered beyond the original plan: a Help → Guides entry card linking to `/welcome`, added when the post-setup redirect was temporarily removed and kept afterwards so the page stays revisitable.

### 4.7 Phase 4 Checklist — Before Marking Complete

- [x] `/welcome` renders full-page with no sidebar or app header — routed outside `TrialGuardedShell`, beside `/no-access`
- [x] The Settings reconfigure path does **not** redirect to `/welcome` — correct by construction: both Settings hosts pass their own `onComplete` that closes the modal, and only `AppShell`'s navigates
- [x] All five sections render, and Chat and Tasks are both represented (both were missing from the old carousel)
- [x] Visual placeholders look deliberate — framed gradient surface with a faint grid, large emoji and a caption naming the future screenshot; no "image here" text
- [x] `WelcomeCarousel.jsx` is deleted and nothing imports it (the one remaining mention was a stale comment in `OnboardingStepper`, now removed)
- [x] `npm run lint` introduces no new errors; `npm run build` passes

Not yet verified — needs a browser click-through:

- [ ] Finishing onboarding lands on `/welcome`, and its exit reaches `/dashboard`
- [ ] Help → Guides shows the overview entry card and it reaches `/welcome`

### Implementation Notes

- **The post-setup handoff was removed, then restored once the layout was fixed.** The original build redirected to `/welcome` on completion and it read as a wall — "the layout and UI hold the user back when I think the onboarding is done." The redirect was dropped while the page was reworked, then reinstated once the paged layout landed: the objection was to the *page*, not to the handoff. Completion navigates to `/welcome`; the Help → Guides entry card stays, so it remains revisitable.
- **Final layout: paged, one feature per section, with a persistent header.** Five shapes were tried before this one landed: full-page alternating scroll (too heavy — read as a wall), uniform card grid (too compressed, lost per-feature focus), vertical tabs (better, but detail had nowhere roomy to live), a detailed accordion (all stages visible, but bulky). The shipped version keeps a header that never changes — title, subtitle, Tercero mark at the far right of the same row — with only the section body below it swapping.
- **Structure:** dotted position indicator as its own row under the header (visited dots clickable, upcoming not — same rule as the onboarding stepper); section body with title and detail on the left, visual on the right; footer with the dashboard exit on the left and `Previous` / `Next` on the right. On the last section the exit disappears and "Go to dashboard" becomes the primary action, so the same action never appears twice. Arrow keys page through.
- **Content model carries detail.** `features: string[]` became `details: { title, body }[]` — each capability has a sentence on what it actually does. Twenty entries across the five stages, written from the architecture docs.
- **No sticky chrome.** An earlier sticky header was removed on review; the brand mark sits in normal document flow.
- **Wide container, image-weighted split.** `max-w-352` with a fixed `26rem` text column and the remainder for the visual, so the image grows with the container instead of both halves inflating and the prose stretching past a readable measure.
- **Screenshots have an explicit insertion point.** Each section carries `image: null`; setting it to a path makes `VisualFrame` render an `<img>` in the same frame at the same aspect ratio, so adding artwork can't shift the layout.
- **Components:** `WelcomePage.jsx` (shell + persistent header), `FeatureSection.jsx` (content/visual split), `WelcomeNav.jsx` (footer), `WelcomeProgress.jsx` (dotted indicator), `VisualFrame.jsx`, `sections.js`. The accordion, tab-list and card-grid variants were deleted rather than left dormant.
- **Screenshots have an explicit insertion point.** Each section carries `image: null`; setting it to a path makes `VisualFrame` render an `<img>` inside the same frame at the same aspect ratio, so adding artwork later cannot shift the layout.
- **Hero removed.** The agency-name headline, the "first contact to final invoice" paragraph and the "Go to dashboard / or keep scrolling" pair are gone. One short title, one line pointing at Help → Guides, and a single persistent action in the sticky header.
- **`/welcome` would otherwise have been orphaned**, so `GuidesTab` gained an entry card at the top of Help → Guides. Help is where users already look for this, and it puts the overview beside the detailed guides rather than competing with them.
- **Content lives in `sections.js`, separate from layout.** Adding or re-grouping a feature is a data edit. This is the structural answer to why the old carousel rotted — its copy was interleaved with JSX across 170 lines, so updating it meant touching the component.
- **`VisualFrame` is one component, swapped per section by data.** Replacing a placeholder with a real screenshot later means rendering an `<img>` inside the existing frame — the aspect ratio, border and rounding stay, so the layout can't shift when imagery lands.
- **`/welcome` sits outside `TrialGuardedShell`** to get the full-page canvas. Noted as intentional: a trial-locked user reaching `/welcome` directly would see the showcase rather than the expiry screen, but the only path there is finishing onboarding, which only new signups with live trials do.
- **`onComplete` awaits `checkAgencyStatus()` before navigating**, so the sidebar has the agency name resolved by the time the user clicks through to the dashboard.
- **Phase 3's session-driven `showWelcome` workaround is gone.** It existed only because one timestamp couldn't serve as both "show the tour" and "don't show it again". A route needs no flag at all, which is the cleaner resolution of that problem.

---

## Data Model Summary (Final State After All Phases)

```
auth.users (owner)
└── agency_subscriptions (1:1, user_id)
    ├── agency_name, logo_url, logo_horizontal_url, industry
    ├── email, mobile_number, description
    ├── address                      ← NEW (Phase 1)
    ├── website                      ← NEW (Phase 1)
    ├── signatory_name, signatory_designation, signature_url   (existing, now captured at onboarding)
    ├── onboarding_completed_at      ← NEW (Phase 3)
    ├── onboarding_skipped_steps[]   ← NEW (Phase 3)
    └── plan/feature columns          (never written by onboarding)

clients
├── internal account (is_internal = true, tier = 'INTERNAL', industry = 'Internal')
│     └── always created by onboarding (Phase 1)
└── first real client (optional, Phase 2)

agency_invites
└── invite generated during onboarding (optional, Phase 2)
```

### `agency_subscriptions` — New Columns

| Column | Type | Notes |
|---|---|---|
| `address` | `text` | Agency postal address; invoice/proposal PDFs |
| `website` | `text` | Agency website; invoice PDF footer |
| `onboarding_completed_at` | `timestamptz` | Replaces `localStorage['has_seen_welcome_*']` |
| `onboarding_skipped_steps` | `text[]` default `'{}'` | `signatory` \| `horizontal_logo` \| `invite_team` \| `first_client` |

### Storage

No new buckets. Existing public `post-media` bucket:

| Path | Written by |
|---|---|
| `branding/{timestamp}.{ext}` | square + horizontal logo (existing convention) |
| `signatures/{timestamp}.{ext}` | signature image (existing convention) |

---

## Impact on Existing Features

| Existing Feature | Impact | Action Required |
|---|---|---|
| Invoices (PDF + HTML preview) | Address, website, horizontal logo, signature populated from day one | Verify `useSubscription` fallback order keeps internal-client values winning for existing workspaces |
| Settings → Agency | Two-card choice removed; single wizard entry point | Wizard must call `refreshAgency()` on success |
| Settings → Invoice | Signatory may arrive pre-filled | None — existing `hasInitialized` guard handles it |
| Settings → Team | Onboarding-generated invites appear in the pending list | None — Realtime invalidation already covers it |
| My Organization | Two-card choice removed | Same wizard entry point |
| Dashboard | New (conditional) setup checklist card | Must render nothing for established workspaces |
| `CreateClientPage` | Loses its `standalone` / `customSubmit` / `defaultValues` callers | Leave the props; note for a later cleanup pass |
| `WelcomeCarousel` | Trigger moves from localStorage to DB | Phase 3 only; must not re-show for users who dismissed it |
| `AppShell` | `isSetupOpen` block deleted; gate becomes DB-driven | Repoint `openAgencySetup` consumers at `/settings?tab=agency` |

---

## Out of Scope (All Phases)

- **Per-workspace currency and locale** — `CURRENCY` in `src/utils/constants.js` is a module-level constant imported across ~27 files. Making it configurable is a cross-cutting refactor of `formatCurrency()` and every PDF renderer, not an onboarding change. Worth its own feature doc.
- **Timezone** — nothing in the app stores one; scheduling, calendar and reminders all use browser local time. Same reasoning as currency: a separate, larger piece of work.
- **Deleting `setupBrandingOnly()` / `activateInternalWorkspace()`** — existing workspaces created through the old branding-only path still need the activation banner. Removal is a later cleanup once those workspaces are migrated.
- **A first-run experience for invited teammates** — they inherit a configured workspace; a separate member-side tour is a different feature.
- **Email-based team invites from onboarding** — the existing flow is copy-a-link; adding an email send here duplicates `InviteDialog`'s scope.
- **Onboarding analytics / drop-off tracking** — no analytics layer exists to hook into.
- **Re-running the wizard on demand from Settings** — every field it captures is already individually editable in Settings.
- **Bulk client import** — unrelated to onboarding.
