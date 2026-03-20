# Tercero — Expansion Brief: Creative Agency Positioning
> **Purpose**: Strategic context + actionable codebase questions for Claude Code to investigate and answer.
> **Origin**: Planning discussion with founder. This is NOT a feature doc — it is a scoping brief that Claude Code should read, investigate the codebase against, and produce concrete recommendations for.

---

## 1. The Strategic Shift

Tercero is currently positioned as a **social media agency management platform**. The founder wants to expand this positioning to cover **creative agencies broadly** — including:

- Video editing studios
- Content production agencies (reels, shorts, ad content)
- Influencer management agencies
- Web & brand studios
- Freelance creative studios with short-term / one-off clients

The core product does not need a rebuild. The approval flow, campaigns, finance, documents, and client management are already generic enough. The changes are mostly **terminology, configurability, and a few small data model additions**.

**The goal is to make Tercero usable and feel natural for a video editor or content studio — not just a social media agency — without breaking anything for the current target user.**

---

## 2. Areas to Investigate in the Codebase

Claude Code should read the relevant files and answer each question based on actual code, not assumptions.

---

### 2.1 The "Platform" Field on Posts

**Context**: Posts currently have a platform selector (Instagram, Facebook, X/Twitter, LinkedIn, etc.). This is social-media-specific language. A video editor creating a "Reel deliverable" or "Ad cut v2" doesn't relate to this field at all.

**Questions for Claude Code**:
1. Where is the platform list defined? Is it hardcoded in a component, a constant file, or stored in the DB?
2. Is the platform field required on post creation? What happens if it's left empty?
3. How many places in the codebase render platform icons or filter by platform? (Posts list, Campaign detail, Calendar, Post detail, Public review page)
4. How difficult would it be to make this field optional, or to add an alternative "Deliverable Type" selector alongside it?
5. Is there any analytics or reporting that depends on the platform field? (Campaign KPIs, Calendar report PDF, Dashboard)

**What we want to know**: Can a non-social-media user comfortably use the post/deliverable workflow today, or does the platform field create friction that needs to be addressed?

---

### 2.2 Client Status Field

**Context**: A client status field already exists in the codebase, but the founder mentioned it is "not scoped to anything."

**Questions for Claude Code**:
1. What is the current schema for the `clients` table? What values does the status field support?
2. Is the status field surfaced anywhere in the UI — client list filters, client detail header, client card?
3. Is there any filtering on the clients list by status? Can a user hide "Archived" or "Completed" clients?
4. What would need to change to make status meaningful — i.e., Active clients shown by default, Completed/Archived hidden unless filtered in?

**What we want to know**: Is this a quick filter addition, or does it require a more involved UI and data change?

---

### 2.3 Client Type Field (New)

**Context**: The founder wants to distinguish between **Retainer** clients (long-term, recurring invoices, ongoing posts) and **Project / One-Off** clients (short engagements, 1 week to 1 month, then done). This field doesn't exist yet.

**Questions for Claude Code**:
1. What fields currently exist on the client creation / edit form? Where is this form defined?
2. Is there a clean place to add a "Client Type" dropdown (Retainer / Project-Based / One-Off) to the existing form without a layout overhaul?
3. Would this require a DB migration (new column on `clients` table)?
4. Are there any existing components that would benefit from knowing client type — e.g., the invoice tab defaulting to recurring vs one-off, or the campaign view surfacing differently?

**What we want to know**: Exact effort to add this field end-to-end (DB → form → display on client card/detail).

---

### 2.4 Clients List — Filtering and Density for High-Turnover Agencies

**Context**: A creative studio doing short-term work will accumulate many completed clients quickly. The current clients list may feel cluttered if there's no way to separate active from inactive.

**Questions for Claude Code**:
1. What filters currently exist on the clients list? (Search, industry, any status filter?)
2. How is the clients list queried? Is it a direct Supabase query, an RPC, or React Query hook — and where is it defined?
3. Is there a concept of "archived" clients that hides them from the main list?

**What we want to know**: What's the minimum change to make the clients list manageable for someone with 20+ completed one-off clients?

---

### 2.5 Post / Deliverable Terminology

**Context**: For creative studios, calling a unit of work a "Post" is jarring — they create "deliverables," "cuts," "drafts," or "assets." The word "Post" appears everywhere in the UI.

**Questions for Claude Code**:
1. Is the word "Post" hardcoded throughout components, or is there a central place (i18n file, constants) where UI labels are defined?
2. How many distinct UI surfaces use the word "Post" as a label? (Sidebar nav, page titles, button labels, empty states, toasts, form labels)
3. Is there any existing mechanism for per-agency terminology customisation, or would this be net-new?

**What we want to know**: Is a terminology layer (where agency type determines whether the app says "Post" or "Deliverable") feasible, or is it too deeply embedded to change without significant refactoring?

---

### 2.6 Onboarding Flow — Client Creation

**Context**: The current client onboarding form has basic fields (name, industry, social links, email, mobile, notes). The founder wants to eventually add richer onboarding, but for now just wants to add a Client Type field cleanly.

**Questions for Claude Code**:
1. Where is the client creation form defined? Is it a dialog, a page, or a multi-step flow?
2. What fields are currently in the form and which are required vs optional?
3. Is the "Additional Notes" field a plain textarea or a rich text editor?

**What we want to know**: Confirm the exact form location and field list so we can spec the Client Type addition accurately.

---

## 3. What We're NOT Asking Claude Code to Build Yet

The following are confirmed out of scope until Phase 2:

- Client portal / client-facing onboarding questionnaire
- Conditional form fields based on client type
- A new "agency type" onboarding step in the signup flow
- Terminology switching per agency type (full i18n layer)
- Free or micro pricing tier changes
- Auto-publishing or social OAuth

---

## 4. Expected Output from Claude Code

After investigating the codebase, Claude Code should produce a short findings doc covering:

1. **Platform field** — required or optional, how deeply embedded, effort to make it flexible
2. **Client status** — current state, what's needed to make it functional as an Active/Archived filter
3. **Client type field** — exact effort (DB migration + form change + display), recommended placement
4. **Clients list filtering** — current state and minimum change for high-turnover use case
5. **Post terminology** — feasibility of a terminology layer, rough effort estimate

For each finding, give a clear **recommendation**: do it now, do it in Phase 2, or it's already handled.

---

## 5. Context on Current Tech Stack and Conventions

- React 19 / Vite SPA, Supabase (PostgreSQL + RLS + Edge Functions), Tailwind CSS v4, shadcn/ui New York
- All Supabase calls in `src/api/[feature].js` — never in components
- React Query for all reads, `useMutation` for writes
- Feature docs live in `.claude/features/`, index at `.claude/features/00-index.md`
- Conventions are in `.claude/CLAUDE.md`
- When in doubt, read the actual file — do not assume structure
