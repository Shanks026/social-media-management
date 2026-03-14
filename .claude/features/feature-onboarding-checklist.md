# Feature: Onboarding Checklist
**Product**: Tercero — Social Media Agency Management SaaS
**File**: `.claude/features/[NN]-onboarding-checklist.md`
**Status**: Planned
**Last Updated**: March 2026

---

## Pre-Implementation Instructions

**Before writing a single line of code, read the following files thoroughly:**

```
src/pages/dashboard/Dashboard.jsx         — Dashboard layout and widget structure
src/api/useSubscription.js                — Hook shape, flat data object pattern
src/api/clients.js                        — useClients hook, query keys, filter patterns
src/api/posts.js                          — useGlobalPosts or equivalent, query keys
src/api/team.js                           — useTeamMembers hook, agency_members queries
src/components/misc/header-context.jsx    — useHeader() hook pattern
src/lib/helper.js                         — formatDate and any utility functions
src/App.jsx                               — Route definitions
src/components/sidebar/app-sidebar.jsx    — Sidebar structure and nav groups
```

Understand the existing dashboard layout completely before placing the checklist widget. Understand all existing query hooks before writing any new data-fetching logic — you may be able to reuse them directly without new queries.

---

## Context

New agency owners who sign up land on the dashboard with an empty workspace. There is no guidance on what to do first. This causes beta testers to bounce or explore randomly rather than experiencing the core value of the product. The onboarding checklist is a dashboard widget that guides new users through 5 key setup steps, auto-detects completion using existing data, and disappears once all steps are done or the user dismisses it. No new backend infrastructure is required — this is built entirely on top of existing queries.

---

## Phase Overview

```
Phase 1 — Checklist Widget
  A dismissible dashboard widget that auto-detects completion of 5 onboarding
  steps using existing data queries and links directly to the relevant page
  for each incomplete step.
```

This is a single-phase feature. There is no Phase 2.

**After Phase 1: stop and wait for approval before considering any extensions.**

---

## Phase 1 — Checklist Widget

### Goal

When a new agency owner logs in for the first time, they see a checklist card at the top of the dashboard showing 5 onboarding steps. Each step is automatically checked off when the relevant data exists. Incomplete steps show a direct navigation link to where the action happens. Once all steps are complete — or the user clicks the dismiss (X) button — the widget disappears and never returns. The owner can now confidently orient themselves and take their first actions without any hand-holding from the Tercero team.

---

### Before Starting — Confirm With Codebase

Read these files and confirm the following before writing any code:

1. **`src/pages/dashboard/Dashboard.jsx`** — Understand the exact layout structure. Where do existing widgets slot in? What is the outermost container class? Where does the first widget render? The checklist should sit at the very top, above the Agency Health Bar.

2. **`src/api/clients.js`** — Find the hook that returns the client list. Confirm the query key pattern. Confirm whether `is_internal` filtering is already handled in the hook or needs a client-side filter. Do not create a new hook if one already exists.

3. **`src/api/posts.js`** — Find the hook or function that returns a global post count or list. Confirm query key. Do not create a new hook if one already exists.

4. **`src/api/team.js`** — Find `useTeamMembers`. Confirm what it returns — specifically whether it includes the owner row or only members. The checklist needs to know if count > 1 (at least one member beyond the owner).

5. **`src/api/useSubscription.js`** — Confirm the exact field names for `agency_name` and `logo_url` on the returned `sub` object. The profile step checks both of these.

---

### 1.1 Database

No database changes in this phase.

All completion detection uses existing tables via existing query hooks. Dismissed state is stored in `localStorage` on the client — no server-side persistence needed.

---

### 1.2 API Layer

No new API file needed.

The checklist component composes existing hooks directly. The only new logic is the completion detection — which is pure JavaScript evaluation of data already returned by existing hooks.

**Hooks to reuse (do not duplicate):**

| Hook | Already exists in | Used for |
|------|------------------|---------|
| `useSubscription()` | `src/api/useSubscription.js` | Agency name + logo check |
| `useClients()` or equivalent | `src/api/clients.js` | Client count (exclude `is_internal`) |
| `useGlobalPosts()` or equivalent | `src/api/posts.js` | Post count > 0 |
| `useTeamMembers()` | `src/api/team.js` | Member count > 1 |

---

### 1.3 Components

**New file: `src/components/dashboard/OnboardingChecklist.jsx`**

This is the only new file in this phase.

**Props:** None. The component is self-contained — it fetches its own data and manages its own dismissed state.

**Dismissed state:**
```js
const DISMISSED_KEY = 'tercero_onboarding_checklist_dismissed'
const [dismissed, setDismissed] = useState(
  () => localStorage.getItem(DISMISSED_KEY) === 'true'
)

const handleDismiss = () => {
  localStorage.setItem(DISMISSED_KEY, 'true')
  setDismissed(true)
}
```

**Completion logic — 4 steps:**

```
Step 1 — Set up agency profile
  Complete when: sub?.agency_name is non-empty AND sub?.logo_url is non-null
  Note: branding path only — no internal workspace check. Users who chose
  "skip for now" during onboarding will see this as incomplete until they
  set their agency name and logo in Settings → Agency.
  Incomplete link: navigates to /settings (Agency tab)
  Label: "Set up your agency profile"

Step 2 — Add your first client
  Complete when: clients list has at least 1 entry where is_internal = false
  Incomplete link: navigates to /clients/create
  Label: "Add your first client"

Step 3 — Create your first post
  Complete when: posts count > 0
  Incomplete link: navigates to /posts
  Label: "Create your first post"

Step 4 — Invite a team member
  Complete when: team members count > 1 (more than just the owner row)
  Incomplete link: navigates to /settings (Team tab)
  Label: "Invite a team member"
```

**Visibility logic:**
```
- If dismissed === true → render nothing
- If all 5 steps complete → render nothing (optionally show a brief "You're all set" 
  flash for 3 seconds before hiding, but this is optional)
- Otherwise → render the checklist card
```

**Loading state:**
Show a skeleton card (same height as the rendered checklist) while any of the underlying queries are loading. Use skeleton patterns consistent with the rest of the dashboard.

**UI structure:**
```
┌─────────────────────────────────────────────────────┐
│  Get started with Tercero                        [X] │
│  Complete these steps to set up your workspace       │
│                                                      │
│  [✓] Set up your agency profile                      │
│  [✓] Add your first client                           │
│  [ ] Create your first post              → Do this   │
│  [ ] Invite a team member                → Do this   │
│                                                      │
│  Progress: 2 of 4 complete  █████░░░░░               │
└─────────────────────────────────────────────────────┘
```

- Checked steps: muted text, green check icon (Lucide `CheckCircle2`)
- Unchecked steps: normal text, empty circle icon (Lucide `Circle`), "→ Do this" link aligned right
- Progress bar at bottom using Tailwind width utility (e.g. `w-[40%]`)
- X button top right — triggers `handleDismiss`
- Card uses shadcn `Card` component, consistent with other dashboard widgets

---

### 1.4 Dashboard Integration

**File to modify: `src/pages/dashboard/Dashboard.jsx`**

Add `<OnboardingChecklist />` as the very first element inside the dashboard content area, above the Agency Health Bar / KPI cards.

Read the file first to understand the exact JSX structure before inserting. Do not break existing layout.

```jsx
import { OnboardingChecklist } from '@/components/dashboard/OnboardingChecklist'

// Inside the dashboard render, as the first child:
<OnboardingChecklist />
```

---

### 1.5 Impact on Existing Features

| Existing Feature | Impact | Action Required |
|-----------------|--------|----------------|
| Dashboard layout | Checklist card added above health bar | Verify layout doesn't break on mobile or when card is hidden |
| `useClients` hook | Read-only reuse | None |
| `useGlobalPosts` or equivalent | Read-only reuse | None |
| `useTeamMembers` | Read-only reuse | Confirm whether owner row is included in count |
| `useSubscription` | Read-only reuse | None |

---

### 1.6 What This Phase Does NOT Include

- Server-side persistence of checklist progress or dismissed state — `localStorage` only
- Animated step transitions or confetti on completion
- Step-specific tooltips or explainer modals
- Additional steps beyond the 5 defined above
- Any changes to onboarding flow (`/onboarding` page) — this is dashboard-only
- Per-user dismissed state synced across devices — dismissed on one device, may reappear on another (acceptable for Phase 1)

---

### 1.7 Phase 1 Checklist — Before Marking Complete

- [ ] Checklist widget renders at the top of the dashboard above the health bar
- [ ] Widget does not render when all 4 steps are complete
- [ ] Widget does not render after the user has dismissed it (persists across page refreshes via localStorage)
- [ ] Step 1 (agency profile) auto-checks when `agency_name` is set and `logo_url` is not null
- [ ] Step 2 (first client) auto-checks when at least one non-internal client exists
- [ ] Step 3 (first post) auto-checks when at least one post exists
- [ ] Step 4 (team member) auto-checks when team member count > 1
- [ ] Each incomplete step shows a "→ Do this" link that navigates to the correct location
- [ ] Skeleton loading state shown while queries are loading
- [ ] X dismiss button works and widget does not reappear after refresh
- [ ] Progress bar reflects correct completion count out of 4
- [ ] No layout breakage on desktop or mobile

**→ Stop here. Show the result and wait for approval.**

---

## Data Model Summary

No new tables or storage buckets. This feature reads from:

```
agency_subscriptions    — agency_name, logo_url
clients                 — count where is_internal = false
posts                   — count
agency_members          — count where agency_user_id = workspaceUserId
```

All existing. All read-only.

---

## Impact on Existing Features

| Existing Feature | Impact | Action Required |
|-----------------|--------|----------------|
| Dashboard | One new widget added at top | Minimal — verify layout integrity |
| All other features | None | None |

---

## Out of Scope (All Phases)

- Server-side dismissed state — future build if cross-device sync becomes a request
- Checklist steps beyond the initial 4 — add only when validated by user feedback
- "Send a review link" as a checklist step — this is a workflow action, not a setup step
- Animated completion celebrations — future polish
- Admin ability to reset checklist for a workspace — not needed
- Checklist shown anywhere other than the dashboard — not needed
