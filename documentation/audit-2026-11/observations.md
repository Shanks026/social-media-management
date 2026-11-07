# Browser walkthrough — raw observations (2026-11-07)

Local dev server (`npm run dev`, port 5174) against the hosted Supabase project, fresh test account ("John Test One", agency "Audit Test Agency"), Trial plan. Viewport 1280×800, dark theme.
Tags: **[UI]** visual, **[UX]** flow/behaviour, **[A11y]** accessibility, **[Struct]** routing/architecture, **[Brand]** brand/colour, **[Polish]** small fit-and-finish.

## Signup / login
- `01-signup.jpg` — "Orchestrate your agency." Clean, dark, minimal. Logo mark only; no product name next to it on the form. **[Brand]**

## Onboarding wizard (5 steps: Identity → Contact → Signatory → Platforms → Team)
- `02-onboarding-identity.jpg`
- **[Struct]** The wizard renders as an overlay on `/dashboard`, with no route of its own (URL stays `/dashboard` for all 5 steps). Refresh/back-button behaviour depends on internal state, and you can't deep-link to a step.
- **[UX]** Copy is localised to India (phone `+91…`, "e.g. Chennai", Anna Salai address, ₹ currency on the dashboard). That's fine if India is the target market, but nothing asks for currency or country, so a non-Indian agency gets ₹ by default.
- **[A11y]** The Industry select, the platform checkboxes (`03-onboarding-platforms.jpg`) and the step-rail buttons have no accessible names. Platform rows are clickable divs, not real checkboxes in the a11y tree, and the step-rail buttons are unlabeled.
- **[UX]** Platforms step: ticking a platform expands a handle + "Profile URL (Auto-generated)" row. "Handle is required" appears only after submit.
- **[UX] Bug** — `04-onboarding-team-stale-error-toast.jpg`: after fixing the handle validation error and saving successfully, the "Please fix the highlighted fields to continue." error toast **stays on screen into the next step** (Team) and is still visible on success. Dismiss validation toasts on a successful submit, or use inline errors only.
- **[UX]** "Finish setup" takes ~3s+ with no loading state on the button, then jumps to `/welcome`.
- **[UX]** Team step offers "Create invite link" (reuses `InviteDialog`) — good reuse.

## Welcome tour (`/welcome`)
- `05-welcome-tour.jpg` — a 5-slide "Everything Tercero does" carousel with product screenshots ("Win the work: first contact to signed deal" …). Good storytelling, but it duplicates the marketing site. The screenshots are static images that will drift from the real UI. **[Polish]**

## Dashboard (`/dashboard`)
- `06-dashboard-empty.jpg`
- **[UX]** Greeting is time/day-aware ("Weekend's close, John. 🌴"). Nice.
- **[UX]** "Finish setting up" checklist (40%, 2 of 5) duplicates onboarding: logos, team and first client again. It's good as a nudge, but the onboarding already asked for logos and team, so the checklist is the second time the user sees these.
- **[UI]** Workflow Health lists **11 statuses** (Draft, Submitted, Changes Requested, Ready, Pending Approval, Approved, Needs Revision, Scheduled, Delivered, Partially Published, Published). That's far more than the docs (5) describe, and too many for a half-donut legend. Status-model sprawl; see code audit.
- **[UI]** On an empty account the dashboard shows ~10 widgets of zeros (₹0 ×6, 11 zero statuses, 7 empty "No activity" days, empty charts). Collapse it into one strong empty state until the first client or deliverable exists.
- **[Struct]** Sidebar: Dashboard, Chat, My Organization ▸, Outreach ▸, Clients, Deliverables, Approvals, Campaigns, Tasks & Todos, Operations ▸, Calendar, Finance ▸, Settings ▸. That's 13 top-level entries with mixed grouping: "Outreach" (prospects/proposals) is grouped, but Deliverables/Approvals/Campaigns/Calendar are flat. "Tasks & Todos" vs "Operations" (notes/meetings) is an unclear split.
- **[A11y]** Sidebar links have no accessible names in the a11y tree.
- **[UI]** Header shows the "Trial · 13 days left · 21 Nov 2026" pill. Good.

## Clients → deliverables → approval
- `07-client-create.jpg`, `08-client-create-logo-required-error.jpg`: the client **logo is required**. Error toast reads "Please fix the errors below to continue." **[UX]**
- `09-clients-list.jpg`: the header count says "Clients 1" but the All chip says 2 (the internal workspace is counted in one only). **[UX]**
- `10-client-overview.jpg`: 10 tabs, and "Calendar" is clipped at 1280 px. The Tasks widget's empty state says "No pending notes". **[UI][Copy bug]**
- Quick Actions → "New Post" while the rest of the app says "Deliverable". **[Copy]**
- `11-create-deliverable-dialog.jpg`: two-pane dialog (media | details) with a "Schedule for a social platform" toggle. Good.
- `12-deliverables-blank-while-loading.jpg`: blank main area for about 3–4 s, no skeleton. The breadcrumb says "Operations › Deliverables" but the sidebar has it top-level. **[UX][IA]**
- `13-deliverable-awaiting-approval.jpg`: Send for Approval → the confirm dialog explains the version lock and the recipient (good). After success the dialog stays open showing "Already Sent". "Resend link" fires **immediately**, with no confirmation, and showed the raw "Edge Function returned a non-2xx status code" toast. There's no "copy review link" anywhere. **[UX bugs]**
- `14-approvals.jpg`: Approvals only covers internal approvals, so the client-pending deliverable isn't listed. `/submissions` silently redirects the owner to the dashboard. **[IA]**

## Other pages
- `15-campaigns-empty`, `16-tasks-empty`, `20-proposals`: empty states use emoji (📣 ✅ 📋 🎯 📝 🎥 📁 🧾) rather than the `<Empty>` + lucide pattern. **[UI consistency]**
- `17-calendar.jpg`: Month/Week, filters, "New Event", "Export Report". The legend lists 11 statuses. **[UI density]**
- `18-chat.jpg`: the sidebar collapses to icons on /chat (good use of space). Workspace "Room" plus DMs.
- `19-prospects-11-tabs.jpg`: 11 status tabs in a horizontally scrolling row. **[UI density]**
- `21-finance-overview.jpg`: Cash/Accrual toggle. On empty data the chart y-axis reads `₹0.001k`. **[UI bug]**
- `22-documents-skeleton.jpg`: a proper skeleton, but other pages don't have one. **[Consistency]**
- `23-reports-fading-in.jpg`: the page fades in rather than using a skeleton. Breadcrumb "Operations › Reports". **[IA]**
- `24-my-organization.jpg`: the internal workspace reuses the client profile layout (good reuse).
- `25-billing.jpg`: Trial shows "200 GB" storage and "∞" clients.
- `/help`: the Guides, Support, Policies and Roadmap tabs are text-heavy but useful. `/policies` is public.
- `/ads`: a reachable "Coming soon" stub (its nav entry is commented out).
- `26-public-review-invalid-token.jpg`: a clean "Link Expired" state, though any bad token is called "expired or already used".
- Unknown route: a 404 page with "Back to Dashboard". Good.

## Brand / theme
- `--primary` is a generic blue `hsl(215.9 100% 40%)` (light) / `50%` (dark). The chart tokens are the stock shadcn palette and **differ between light and dark**.
- 1,054 hard-coded Tailwind palette classes, plus hex such as `#111827` ×32 in JSX. There's no brand token layer for status or phase colours.
