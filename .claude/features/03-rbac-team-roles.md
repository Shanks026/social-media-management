# Feature: Role-Based Access Control (RBAC) & Team Roles
**Product**: Tercero — Agency Management SaaS (social media agencies and any client-services agency)
**File**: `.claude/features/03-rbac-team-roles.md`
**Status**: Planned — model locked, ready for Phase 1
**Last Updated**: June 2026

---

## Context

Today every invited teammate gets full workspace access. Anyone with an invite link self-registers, picks their own (cosmetic) job title, and can then do everything the owner can — including Finance, all Documents (contracts, NDAs), Billing, and Team management. This is wrong for an agency: finance and legal documents are confidential, only the owner should manage the team or billing, and members doing delivery work should not reach the agency's commercial surface.

This feature adds a real access-control layer on top of the existing multi-tenant workspace model. The workspace model already isolates **between** agencies (via `workspaceUserId` / `get_my_agency_user_id()`); RBAC adds control **within** a single workspace.

### Two concepts, kept strictly separate

| Concept | Column | Meaning | Drives |
|---|---|---|---|
| **System role** | `agency_members.system_role` | Access tier | **All access decisions (this feature)** |
| **Functional role** | `agency_members.functional_role` | Job title (Designer, Account Manager…) | **Cosmetic badge only — never affects access** |

A person is always **one system role + one (optional) functional role**, e.g. *Admin · Account Manager* or *Member · Designer*. The left word decides what they can do; the right word is just a label. Access logic reads `system_role` (+ the documents flag) and **completely ignores** `functional_role`.

---

## The Locked Role Model

### System roles

`superadmin` (app-level) › **owner** › **admin** › **member**

- **`superadmin`** — the application owner (the Tercero team), used only by the separate admin portal (`admin.tercerospace.com`). **Not** a workspace role we design around. All access helpers treat it as a full-access passthrough so it can never be locked out. Untouched by every migration.

- **`owner`** — the agency account holder (founder / co-founder) who signed up. **Exactly one per workspace.** Runs *the company*: everything Admin can do, **plus** team management, billing, workspace settings, invoice-signatory configuration, and workspace deletion. Cannot be demoted or removed. Stored explicitly as a self-row in `agency_members` (`agency_user_id = member_user_id`), and also derivable at runtime via `auth.uid() = get_my_agency_user_id()` as a safety net so the owner can never be locked out.

- **`admin`** — a trusted operational deputy. Runs *the work*, not *the company*. Full CRUD over all client-facing work (clients, deliverables, campaigns, finance, documents incl. confidential, proposals, prospects, reports). **Cannot**: manage the team, touch billing, edit workspace settings, edit the invoice signatory, or delete the workspace. Many allowed. Granted **only by manual owner promotion** — never assigned at invite time.

- **`member`** — does scoped delivery work. View clients; draft deliverables (needs internal approval before reaching a client); work inside existing campaigns; notes & meetings; assigned tasks. **No** finance, proposals, prospects, reports, billing, team, or workspace settings. Documents access is governed by a per-member flag (below). **This is the default role for everyone who joins.**

### The one-line mental model

> **Owner runs the company. Admin runs the work. Member does assigned work.**

### What Admin specifically *cannot* do (the entire reserved set)

1. **Team management** — cannot invite, onboard, promote, demote, or remove anyone. *(Owner-only.)*
2. **Billing** — cannot view or change the agency's Tercero subscription / payment method.
3. **Workspace settings** — view-only; cannot edit agency identity/branding/config.
4. **Invoice signatory** — cannot change whose name/signature prints on invoices (but can freely *issue* invoices using the owner-configured signatory).
5. **Delete the workspace.**

Everything else — full CRUD on clients, deliverables, finance, documents, campaigns, proposals, prospects, reports — Admin can do, same as Owner.

### Onboarding & promotion flow (owner-only, manual)

```
OWNER creates an invite           ← only the owner can; admins cannot
  ├─ sets functional role (job title, optional)
  └─ sets documents level for the joiner (none / view / manage)
        │
        ▼
  invite link → joiner submits name + password only
        │
        ▼
  joiner becomes  system_role = 'member'   ← ALWAYS member, no exceptions
        │
        ▼
  OWNER may later MANUALLY promote a member → 'admin'   (deliberate, separate action)
```

There is **no path to be born an admin.** Invites always create members; admin is reachable only through an explicit, owner-initiated promotion in Team Settings. Defense in depth: the DB clamps any joining role to `'member'` regardless of what the invite or client says.

### Capability flag (the only per-member tuning)

Members are otherwise a fixed tier. The **only** per-member knob is documents access, stored as a `permissions` JSONB on `agency_members`:

```jsonc
{ "documents": "view" }   // 'none' | 'view' | 'manage'
```

- **Finance is NOT a flag.** Members never get finance under any setting — finance is owner/admin only. If someone needs finance, the owner promotes them to Admin.
- Owner / admin / superadmin **bypass** the documents flag entirely (always `manage`, always see confidential).
- The documents flag governs a **member's** access to the **non-confidential** document set only.

### Confidential documents

Confidentiality is a **property of the document**, not a capability level:

- `client_documents.is_confidential` boolean, auto-defaulted `true` for categories **`Contract`**, **`NDA`**, **`Invoice / Finance`**.
- **Members never see confidential documents**, regardless of their documents level.
- Owner / admin always see confidential documents.
- A member's `documents` flag (`none`/`view`/`manage`) governs the **non-confidential** set only.
- It is a **per-document** flag (category sets the default; an owner/admin can toggle it on any doc).

---

## Full Permission Map

Legend: ✅ full · ⚙️ flag-gated · 👁️ view-only · ❌ none · — n/a

| Area | Action | Owner | Admin | Member |
|---|---|:--:|:--:|:--:|
| **Dashboard** | View (non-finance widgets) | ✅ | ✅ | ✅ |
| **Dashboard** | Finance widgets / revenue / profit cells | ✅ | ✅ | ❌ |
| **Clients** | View | ✅ | ✅ | ✅ (all) |
| **Clients** | Create / onboard | ✅ | ✅ | ❌ |
| **Clients** | Edit | ✅ | ✅ | ❌ |
| **Clients** | Delete | ✅ | ✅ | ❌ |
| **Deliverables** | Create / edit draft | ✅ | ✅ | ✅ |
| **Deliverables** | Submit for internal approval | — | — | ✅ |
| **Deliverables** | Approve internally | ✅ | ✅ | ❌ |
| **Deliverables** | Send to client for approval | ✅ | ✅ | ❌ |
| **Campaigns** | View / work within | ✅ | ✅ | ✅ |
| **Campaigns** | Create campaign | ✅ | ✅ | ❌ |
| **Calendar** | View | ✅ | ✅ | ✅ |
| **Meetings** | View all (workspace) | ✅ | ✅ | ✅ |
| **Meetings** | Create | ✅ | ✅ | ✅ |
| **Meetings** | Edit / delete others' | ✅ | ✅ | ❌ (own only) |
| **Notes** | View all (workspace) | ✅ | ✅ | ✅ |
| **Notes** | Create | ✅ | ✅ | ✅ |
| **Notes** | Edit / delete others' | ✅ | ✅ | ❌ (own only) |
| **Tasks** *(when built)* | Create / assign | ✅ | ✅ | ❌ |
| **Tasks** *(when built)* | Complete assigned (not delete) | ✅ | ✅ | ✅ |
| **Documents** | Non-confidential | ✅ manage | ✅ manage | ⚙️ none/view/manage |
| **Documents** | Confidential (Contract/NDA/Finance) | ✅ | ✅ | ❌ never |
| **Proposals** | View / create / edit | ✅ | ✅ | ❌ |
| **Prospects** | View / create / edit / convert | ✅ | ✅ | ❌ |
| **Reports** | View | ✅ | ✅ | ❌ |
| **Finance** | Invoices / expenses / transactions / ledger / subscriptions | ✅ | ✅ | ❌ |
| **Finance** | Issue invoices | ✅ | ✅ | ❌ |
| **Invoice signatory** | Configure (name / designation / signature) | ✅ | ❌ | ❌ |
| **Billing** | View / manage Tercero subscription | ✅ | ❌ | ❌ |
| **Workspace settings** | Edit agency identity / branding / config | ✅ | 👁️ | ❌ |
| **Team** | Invite / onboard | ✅ | ❌ | ❌ |
| **Team** | Promote / demote / remove | ✅ | ❌ | ❌ |
| **Workspace** | Delete workspace | ✅ | ❌ | ❌ |

---

## Functional Role List (cosmetic job titles)

A curated, grouped default list, plus a **Custom…** free-text option so any agency type fits (a law firm can type "Paralegal", a video agency "Editor"). Stored in `src/lib/team-roles.js`; badge colors resolved there. **None of these affect access.**

**Leadership**
- Founder · Co-founder · CEO / Managing Director

**Client & Strategy**
- Account Manager · Project Manager · Strategist · Creative Director

**Content & Creative**
- Social Media Manager · Content Creator · Designer · Copywriter · Video Editor / Producer

**Growth & Specialist**
- Marketing Specialist · Community Manager · SEO / Media Buyer · Developer · Analyst

**Finance & Ops**
- Finance Manager · Operations Manager

**+ Custom…** (free text, fallback badge color)

> The previous 23-entry social-media-only list is replaced by this generalized set so the product fits any client-services agency while keeping the flagship social roles (Social Media Manager, Content Creator, Community Manager) first-class.

---

## Security Model & Threat Mitigations

**The browser is untrusted.** `userRole` / `userPermissions` in `AuthContext`, nav hiding, and route guards are **UX only** — trivially spoofable in devtools. They prevent honest mistakes, not attackers. **Every access decision must also be enforced server-side** by RLS and/or in-function checks. No phase is "done" on UI gating alone.

### The real enforcement boundary

| Layer | Mechanism | Enforces |
|---|---|---|
| Postgres RLS | `can_access_finance()`, `my_documents_level()`, `can_view_confidential_docs()`, `is_workspace_owner()` in table policies | Direct table reads/writes |
| SECURITY DEFINER RPCs | **In-function** capability checks (RLS is bypassed inside definer functions) | Aggregations, mutations, joins |
| Storage policies | Bucket policies on `storage.objects` | Direct file fetches via signed URLs |
| UI / routes | `usePermissions()` | Cosmetic — hide what the user can't use |

### Member-restricted data surfaces (server-side gating required)

Members are denied these at the **database** level, not just the UI:
- **Finance:** `invoices`, `invoice_items`, `expenses`, `transactions`, `recurring_invoices` (base tables); finance-bearing views inherit via `security_invoker=on`; SECURITY DEFINER RPCs (`get_clients_with_pipeline`, `get_campaign_analytics`) must null/omit finance fields for members; finance-mutation RPCs must `RAISE` for non-finance users.
- **Proposals / Prospects:** their tables gated to owner/admin via RLS.
- **Reports:** gated to owner/admin (finance access).
- **Confidential documents:** row RLS **and** storage-path enforcement (see Phase 4 storage gap).

### Team-management & privilege-escalation rules (Phase 2)

- **Onboarding is owner-only.** Invite RLS on `agency_invites` stays **owner-only** (`auth.uid() = get_my_agency_user_id() AND is_workspace_owner()`). Admins **cannot** create invites.
- **Everyone joins as member.** `join_team` **clamps the role to `'member'`** unconditionally — it never reads a system role from the invite. Admin is granted only later, via owner promotion.
- **Promotion is owner-only.** `update_member_access` requires `is_workspace_owner()`, clamps the target role to `('admin','member')`, and rejects `'owner'`/`'superadmin'`.
- **Owner is immutable.** No path may demote/remove the owner or create a second `'owner'`.
- **Members cannot write their own row.** RLS gives members `select_self` only — read, never write. No self-escalation.

### Storage / confidential documents caveat (Phase 4)

The `client-documents` bucket is private, but its read policy (`foldername[1] = get_my_agency_user_id()`) grants **every active member the whole folder** — it ignores `my_documents_level()` and `is_confidential`. Row RLS hides confidential rows, but a member could fetch a confidential file **directly by storage path**. Phase 4 must close this (path-prefix policy or edge-function-mediated signed URLs — decided at the start of Phase 4).

---

## Phase Overview

```
Phase 1 — Permission Foundation (no visible change)
  Schema (permissions JSONB {documents} + is_confidential), backfill migration,
  SECURITY DEFINER access helpers, AuthContext + usePermissions() hook.

Phase 2 — Team Management (owner-only onboarding + manual admin promotion)
  Invite RLS stays owner-only; join_team clamps to member; update_member_access
  (owner-only) promotes/demotes; InviteDialog (owner) sets functional role + docs
  level; JoinTeam drops the role selector; promotion UI in TeamSettings.

Phase 3 — Restricted Sections (Finance, Billing, Proposals, Prospects, Reports)
  RLS on finance/proposals/prospects tables; route guards + nav hide for members;
  Billing & workspace-settings-edit owner-only; dashboard finance widgets hidden.

Phase 4 — Documents Cap & Confidentiality
  is_confidential per document; RLS + storage policy; none/view/manage enforced in
  nav, DocumentsTab (global + client detail), and upload/edit/delete.

Phase 5 — Deliverable Approval Workflow + Campaign-create gating
  Member draft → internal approval by owner/admin before client send; members
  cannot create campaigns. (Adds a workflow state — more than pure gating.)
```

**After each phase: stop and wait for approval before proceeding.**

---

## Phase 1 — Permission Foundation

### Goal
Establish the data model and the single source of truth for "what can the current user do" — with **zero behavioural change**. After this phase, every member has a resolved capability set, the owner/superadmin are provably never lockable, and a `usePermissions()` hook + DB helpers exist for later phases. Nothing is gated yet.

### Before Starting — Confirm With Codebase
1. Read `src/context/AuthContext.jsx` — confirm `resolveWorkspace` sets `userRole` from the member row's `system_role`.
2. Read the `handle_new_user_subscription` trigger — confirm it inserts the owner self-row as `(agency_user_id=NEW.id, member_user_id=NEW.id, system_role='admin')`. This phase changes that to `'owner'`.
3. Read `src/api/team.js` `useMyMemberRecord()` — confirm it selects `system_role, functional_role`.
4. Confirm `get_my_agency_user_id()` exists and returns the owner uid for members / own uid for owners.
5. Confirm there is no existing `permissions` column on `agency_members` and no `can_access_*` functions.

### 1.1 Database — Migration `rbac_phase1_foundation`

```sql
-- Documents capability flag on members and invites (finance is NOT a flag).
ALTER TABLE public.agency_members
  ADD COLUMN IF NOT EXISTS permissions jsonb NOT NULL
  DEFAULT '{"documents": "view"}'::jsonb;

ALTER TABLE public.agency_invites
  ADD COLUMN IF NOT EXISTS functional_role text,
  ADD COLUMN IF NOT EXISTS permissions jsonb NOT NULL
  DEFAULT '{"documents": "view"}'::jsonb;
-- NOTE: invites do NOT carry system_role — everyone joins as 'member'.

-- Backfill: admins/superadmins → manage docs; members → view.
UPDATE public.agency_members
  SET permissions = '{"documents": "manage"}'::jsonb
  WHERE system_role IN ('admin', 'superadmin');
UPDATE public.agency_members
  SET permissions = '{"documents": "view"}'::jsonb
  WHERE system_role = 'member';

-- Promote existing owner self-rows from 'admin' to explicit 'owner'.
UPDATE public.agency_members
  SET system_role = 'owner'
  WHERE agency_user_id = member_user_id AND system_role = 'admin';

-- New signups become 'owner' of their workspace, not 'admin'.
-- Re-read the live function and reproduce the agency_subscriptions INSERT verbatim;
-- ONLY the final role literal changes.
CREATE OR REPLACE FUNCTION public.handle_new_user_subscription()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $function$
BEGIN
  IF (NEW.raw_user_meta_data->>'invite_token') IS NOT NULL THEN
    RETURN NEW;  -- invited members are wired up by join_team, not here
  END IF;
  -- ... (existing agency_subscriptions INSERT unchanged — keep verbatim) ...
  INSERT INTO public.agency_members (agency_user_id, member_user_id, system_role)
  VALUES (NEW.id, NEW.id, 'owner')   -- was 'admin'
  ON CONFLICT (agency_user_id, member_user_id) DO NOTHING;
  RETURN NEW;
END;
$function$;

-- ── Access helpers (SECURITY DEFINER, reused by RLS in later phases) ──

-- Owner only.
CREATE OR REPLACE FUNCTION public.is_workspace_owner()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() = public.get_my_agency_user_id();
$$;

-- Resolved system role.
CREATE OR REPLACE FUNCTION public.my_system_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN public.is_workspace_owner() THEN 'owner'
    ELSE COALESCE((SELECT system_role FROM public.agency_members
      WHERE member_user_id = auth.uid() AND is_active LIMIT 1), 'member')
  END;
$$;

-- Owner OR admin (used for finance, confidential docs, proposals, prospects, reports).
CREATE OR REPLACE FUNCTION public.is_workspace_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_workspace_owner() OR COALESCE((
    SELECT system_role IN ('admin','superadmin')
    FROM public.agency_members
    WHERE member_user_id = auth.uid() AND is_active LIMIT 1), false);
$$;

-- Finance: owner/admin/superadmin ONLY. Members never. (No flag.)
CREATE OR REPLACE FUNCTION public.can_access_finance()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_workspace_admin();
$$;

-- Documents level: 'manage' for owner/admin/superadmin; else the member's flag.
CREATE OR REPLACE FUNCTION public.my_documents_level()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN public.is_workspace_admin() THEN 'manage'
    ELSE COALESCE((SELECT permissions->>'documents'
      FROM public.agency_members
      WHERE member_user_id = auth.uid() AND is_active LIMIT 1), 'view')
  END;
$$;

-- Confidential docs: owner/admin/superadmin only.
CREATE OR REPLACE FUNCTION public.can_view_confidential_docs()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_workspace_admin();
$$;
```

> No RLS policy changes in Phase 1 — helpers are defined but not yet wired. Keeps Phase 1 non-breaking.

### 1.2 API Layer

**New file `src/lib/permissions.js`** — pure constants + helpers (no Supabase):

```js
export const SYSTEM_ROLES = { OWNER: 'owner', ADMIN: 'admin', MEMBER: 'member', SUPERADMIN: 'superadmin' }

export const DOCUMENT_LEVELS = ['none', 'view', 'manage']

// Member documents default; admin bypasses (always manage).
export const MEMBER_DEFAULT_PERMISSIONS = { documents: 'view' }

// Categories that default to confidential on upload.
export const CONFIDENTIAL_DEFAULT_CATEGORIES = ['Contract', 'NDA', 'Invoice / Finance']

// Resolve a flat capability object from role + stored permissions.
export function resolveCapabilities({ role, permissions }) {
  const full = role === 'owner' || role === 'admin' || role === 'superadmin'
  const isOwnerTier = role === 'owner' || role === 'superadmin'
  return {
    isOwner: role === 'owner',
    isAdmin: full,
    // Owner-only powers
    canManageTeam: isOwnerTier,
    canBilling: isOwnerTier,
    canEditWorkspace: isOwnerTier,
    canEditInvoiceSignatory: isOwnerTier,
    // Owner/admin powers
    finance: full,
    proposals: full,
    prospects: full,
    reports: full,
    canCreateClients: full,
    canCreateCampaigns: full,
    canSendDeliverables: full,        // members draft only
    viewConfidentialDocs: full,
    // Member-tunable
    documents: full ? 'manage' : (permissions?.documents ?? 'view'),
  }
}
```

**Extend `src/api/team.js`:** `useMyMemberRecord()` — add `permissions` to the select.

**Extend `src/context/AuthContext.jsx`:** add `userPermissions` to context state from the `agency_members` row (`permissions`), or the full preset when the user is the owner. Expose it in the context value.

**New hook `usePermissions()`** (in `src/api/usePermissions.js`): returns `resolveCapabilities()` output for the current user — the single source of truth for nav, routes, dashboard, and feature pages.

### 1.3 / 1.4 Components & Integration
No component changes; no gating yet. `usePermissions()` exists, unused.

### 1.5 Phase 1 Checklist
- [ ] `permissions` column on `agency_members` + `agency_invites`, default `{"documents":"view"}`
- [ ] `agency_invites` has `functional_role` (no `system_role` column — joiners are always members)
- [ ] Backfill: admin/superadmin → `manage`; member → `view`
- [ ] Owner self-rows promoted `'admin'` → `'owner'`; `superadmin` untouched
- [ ] `handle_new_user_subscription` inserts owner self-rows as `'owner'` (subscription INSERT verbatim)
- [ ] Helpers created & tested: `is_workspace_owner`, `is_workspace_admin`, `my_system_role`, `can_access_finance`, `my_documents_level`, `can_view_confidential_docs`
- [ ] `src/lib/permissions.js` with `resolveCapabilities`
- [ ] `AuthContext` exposes `userPermissions`; `useMyMemberRecord` selects `permissions`
- [ ] `usePermissions()` returns correct caps for owner / admin / member
- [ ] App builds and behaves identically (no gating active)

🧪 **Test checkpoint:** Log in as owner and member. Nothing changed in the UI; `usePermissions()` (temp-logged) returns full caps for owner, restricted for member.

**→ Stop. Show result, wait for approval.**

---

## Phase 2 — Team Management (owner-only onboarding + manual admin promotion)

### Goal
The **owner** is the only person who can onboard teammates and assign roles. Invites collect the joiner's functional role + documents level; the joiner always lands as **Member**. The owner manually promotes a member to **Admin** afterward in Team Settings. Admins and members see **no** team-management controls.

### Before Starting
1. Re-read `src/pages/JoinTeam.jsx` — the functional-role selector + `functionalRole` field (to remove).
2. Re-read `src/api/team.js` — `useGenerateInvite`, `joinTeam`, `fetchInviteByToken`, `usePendingInvites`.
3. Re-read `src/pages/settings/TeamSettings.jsx` — `InviteDialog`, member list, the `isAdmin` gate.
4. Inspect `join_team` and `get_invite_by_token` RPC bodies before editing.
5. Confirm `usePermissions()` from Phase 1.

### 2.1 Database — Migration `rbac_phase2_team_management`
- **Invite RLS stays owner-only.** Insert/select/update/delete on `agency_invites`: `is_workspace_owner() AND agency_user_id = get_my_agency_user_id()`. Admins cannot create invites.
- **`join_team(p_token, p_first_name, p_last_name)`** — drop `p_functional_role`. Read `functional_role`, `permissions` from the invite; **force `system_role = 'member'`** (never read a role from the invite). Validate: unexpired, `accepted_at IS NULL`, set `accepted_at = now()` atomically; force `member_user_id = auth.uid()` and `agency_user_id` from the invite; re-check seat limit; validate `permissions` shape (`documents ∈ none/view/manage`), fall back to `{documents:'view'}` on mismatch.
- **`get_invite_by_token(p_token)`** — return the invite's `functional_role` (display "You're joining as Designer"). No system role to show — always member.
- **`update_member_access(p_member_id, p_system_role, p_permissions, p_functional_role)`** (SECURITY DEFINER) — owner-only promote/demote/edit. Guards (in-function):
  - Caller must be `is_workspace_owner()` **and** target's `agency_user_id = get_my_agency_user_id()`.
  - **Clamp `p_system_role` to `('admin','member')`**; reject `'owner'`/`'superadmin'` with `RAISE EXCEPTION`.
  - **Owner row immutable** — reject if target `system_role = 'owner'` or target = `agency_user_id`.
  - Validate `p_permissions` shape; functional role updatable.
- **`agency_members` direct writes stay owner-only at RLS;** members have `select_self` (read-only).

### 2.2 API Layer (`src/api/team.js`)
- `useGenerateInvite()` → accept `{ functional_role, permissions }` (no system role). Seed `permissions` from `MEMBER_DEFAULT_PERMISSIONS` if absent.
- `joinTeam({ token, firstName, lastName })` → drop `functionalRole`.
- New `updateMemberAccess(memberId, { system_role, permissions, functional_role })` → calls the RPC; invalidate `teamKeys.members`.
- `usePendingInvites()` → add `functional_role` to the select.

### 2.3 Components
- **`InviteDialog` (owner-only)** — form before generating the link: **Functional role** select (`AGENCY_ROLE_OPTIONS` + Custom) and **Documents level** (none/view/manage). **No system-role selector** — everyone joins as Member.
- **`JoinTeam.jsx`** — remove the role selector + `functionalRole` field/schema; show a read-only "You're joining as {functional role}". `onSubmit` drops `functionalRole`.
- **Member list rows** — show **system-role badge** (Owner/Admin/Member) + functional-role badge + documents chip. **Owner-only** controls: "Promote to Admin" / "Demote to Member", "Edit access" (documents + functional role), Remove/Revoke/Restore. Owner row shows no controls to anyone.
- **Gate:** all team-management controls render only for `canManageTeam` (owner). Replace local `isAdmin = userRole === 'admin'` with `usePermissions().canManageTeam`.

### 2.4 Phase 2 Checklist
- [ ] Invite RLS owner-only; admins cannot invite
- [ ] `join_team` forces `system_role='member'`, reads functional role + docs from invite, validates invite, sets `accepted_at`, forces `member_user_id=auth.uid()`, re-checks seat limit, validates permissions
- [ ] `get_invite_by_token` returns functional role for display
- [ ] `update_member_access` owner-only; clamps to admin/member; owner immutable; validates permissions; functional role updatable
- [ ] **Adversarial test:** a member/admin calling `update_member_access` or inserting an invite, or a `join_team` carrying `system_role='admin'/'owner'`, is rejected/clamped — no escalation
- [ ] InviteDialog (owner) collects functional role + docs level; no role selector
- [ ] JoinTeam has no role selector; shows assigned functional role read-only
- [ ] Member rows show system-role badge + promote/demote (owner only)
- [ ] Admins and members see **no** team-management controls

🧪 **Test checkpoint:** As owner, invite someone (Designer, docs=view). Join incognito → lands as Member with the right functional role + docs. Promote to Admin → access expands. Confirm an admin account sees no invite/promote controls.

**→ Stop. Show result, wait for approval.**

---

## Phase 3 — Restricted Sections (Finance, Billing, Proposals, Prospects, Reports)

### Goal
Members can't see or reach Finance, Proposals, Prospects, or Reports — nav items vanish, routes redirect, and the DB refuses their rows. Billing and workspace-settings **editing** become owner-only (admins view workspace settings, never billing).

### 3.1 Database — Migration `rbac_phase3_restricted_rls`
- **Finance** — replace the workspace-scoped `ALL` policy with a finance-gated one on **all five** base tables (`invoices`, `invoice_items`, `expenses`, `transactions`, `recurring_invoices`):
  ```sql
  DROP POLICY IF EXISTS invoices_workspace_scoped ON public.invoices;
  CREATE POLICY invoices_workspace_scoped ON public.invoices
    FOR ALL USING (user_id = public.get_my_agency_user_id() AND public.can_access_finance())
    WITH CHECK (user_id = public.get_my_agency_user_id() AND public.can_access_finance());
  -- repeat for expenses, transactions, recurring_invoices.
  -- invoice_items: gate via parent invoice (confirm its columns first).
  ```
- **Proposals / Prospects** — gate their tables (and child tables) to `is_workspace_admin()` alongside the workspace scope. Confirm exact table names + child relations before writing.
- **Views** (`view_finance_overview`, `view_monthly_burn_rate`, `subscription_usage_stats`, `client_pipeline_analytics`) are `security_invoker=on` → inherit RLS automatically. No change.
- **SECURITY DEFINER RPCs** — guard inside:
  - `get_clients_with_pipeline`, `get_campaign_analytics` (member-facing reads): when `NOT can_access_finance()`, null/omit finance fields (revenue, budget, profit, MRR) — pages still load.
  - `generate_invoice_from_template`, `advance_recurring_invoice_date`, `set_agency_plan`, `admin_update_subscription`: `RAISE EXCEPTION` unless `can_access_finance()` / owner. Re-read each body; add guard at top, preserve logic.

### 3.2 Components — `requiresPermission` nav pattern (hide vs lock)
Add `requiresPermission` to nav items, resolved via `usePermissions()`. Apply in order:
1. `requiresPermission` and user lacks it → **render nothing** (RBAC hide).
2. Else `requiresFlag` and subscription lacks it → **render locked** 🔒 (existing).

Apply: `finance` → Finance group; `proposals` → Proposals; `prospects` → Prospects; `reports` → Reports; `billing` (owner-only) → Billing & Usage.

### 3.3 Integration
- **Dashboard:** wrap finance widgets/StatBar finance cells in `usePermissions().finance`; hide (don't disable) when false.
- **Routing (`App.jsx`):** `<RequirePermission cap="finance">` around `/finance/*`; `cap="proposals"` around `/proposals*`; `cap="prospects"` around `/prospects*`; `cap="reports"` around `/reports`; `cap="billing"` (owner-only) around `/billing` → redirect to `/dashboard`.
- **Client/Campaign detail:** hide finance/invoice + profitability sections when `!finance`; hide proposals tab when `!proposals`.
- **Workspace settings:** owner edits; admin view-only (disable inputs + save).

### 3.4 Phase 3 Checklist
- [ ] Finance RLS requires `can_access_finance()` on all five tables
- [ ] Proposals & Prospects RLS gated to owner/admin
- [ ] `get_clients_with_pipeline` + `get_campaign_analytics` null finance fields for members; finance-mutation RPCs raise
- [ ] **Adversarial test:** a member queries each finance/proposals/prospects table + calls each finance RPC — no leak
- [ ] Finance/Proposals/Prospects/Reports nav hidden for members
- [ ] Billing nav owner-only; workspace settings edit owner-only (admin view-only)
- [ ] Dashboard finance widgets hidden for members; layout intact
- [ ] `/finance/*`, `/proposals*`, `/prospects*`, `/reports`, `/billing` redirect appropriately
- [ ] Subscription locks still compose for owner/admin who *have* role access

🧪 **Test checkpoint:** Member: no Finance/Proposals/Prospects/Reports in sidebar; dashboard has no finance cells; those routes redirect; DB rejects the queries. Admin: sees all of them but no Billing and no workspace-settings edit.

**→ Stop. Show result, wait for approval.**

---

## Phase 4 — Documents Cap & Confidentiality

### Goal
Documents respect a per-member level (`none`/`view`/`manage`) and per-document confidentiality. Members never see confidential docs (Contract/NDA/Finance); their level governs the non-confidential set.

### 4.1 Database — Migration `rbac_phase4_documents`
```sql
ALTER TABLE public.client_documents
  ADD COLUMN IF NOT EXISTS is_confidential boolean NOT NULL DEFAULT false;

UPDATE public.client_documents
  SET is_confidential = true
  WHERE category IN ('Contract', 'NDA', 'Invoice / Finance');

DROP POLICY IF EXISTS client_documents_workspace_scoped ON public.client_documents;

CREATE POLICY client_documents_select ON public.client_documents
  FOR SELECT USING (
    user_id = public.get_my_agency_user_id()
    AND public.my_documents_level() <> 'none'
    AND (is_confidential = false OR public.can_view_confidential_docs()));

CREATE POLICY client_documents_write ON public.client_documents
  FOR ALL USING (
    user_id = public.get_my_agency_user_id() AND public.my_documents_level() = 'manage')
  WITH CHECK (
    user_id = public.get_my_agency_user_id() AND public.my_documents_level() = 'manage');
```

> **Storage gap (must close):** the bucket read policy grants every member the whole folder. **Mitigation (decide at Phase 4 start, flag for confirmation):** confidential path prefix (`{agency}/_confidential/...`) + a storage SELECT policy requiring `can_view_confidential_docs()`, **or** route all confidential downloads through an edge function that verifies `can_view_confidential_docs()` + the row before issuing a short-lived signed URL. Existing confidential files must migrate into the chosen scheme.

### 4.2 API Layer (`src/api/documents.js`)
- `uploadDocument(...)` → accept `isConfidential`; default from `CONFIDENTIAL_DEFAULT_CATEGORIES.includes(category)`.
- `updateDocument(...)` → allow toggling `is_confidential`.
- `useDocuments(...)` → expose `is_confidential` for the badge (RLS enforces visibility).

### 4.3 Components
- **`UploadMetaDialog.jsx`** — "Confidential" switch (auto-checks for Contract/NDA/Finance), managers only.
- **`DocumentCard.jsx`** — confidential indicator when `is_confidential`.
- **`DocumentsTab.jsx`** — hide upload + edit/delete when level ≠ `manage`; gate both global + client-detail contexts.

### 4.4 Integration
- **Nav** — Documents sub-item hidden when level is `none`.
- **Prospect documents** (`ProspectDocumentsTab.jsx`) — members can't see Prospects at all (Phase 3), so this is moot for members; verify owner/admin behaviour unchanged.

### 4.5 Phase 4 Checklist
- [ ] `is_confidential` column; Contract/NDA/Finance backfilled true
- [ ] SELECT RLS hides confidential from members, respects `none`
- [ ] Write RLS requires `manage`
- [ ] Upload dialog confidential switch (managers only), category default
- [ ] DocumentCard confidential indicator
- [ ] DocumentsTab hides upload/edit/delete for `view`; nav + tab hidden for `none`
- [ ] Member `view` sees only non-confidential; cannot upload
- [ ] **Storage gap closed** — verified by a member's direct signed-URL fetch of a confidential file failing
- [ ] Owner/admin manage everything incl. confidential

🧪 **Test checkpoint:** Member docs=`view` → only non-confidential, no upload/edit/delete, no contracts/NDAs. docs=`none` → section gone. docs=`manage` → full non-confidential management, still no confidential. Owner sees everything.

**→ Stop. Show result, wait for approval.**

---

## Phase 5 — Deliverable Approval Workflow + Campaign-create gating

> ⚠️ This phase is **more than gating** — it adds a workflow state to deliverables. Scope it deliberately.

### Goal
Member-created deliverables require **internal approval by an owner/admin** before they can be sent to a client (or published, for the internal account). Members cannot create campaigns.

### 5.1 Concept
```
MEMBER creates/edits deliverable (DRAFT)
   │  submit for internal approval
   ▼
INTERNAL APPROVAL  ← owner/admin reviews
   ├─ internal-account deliverable → approved = ready/published
   └─ client deliverable → enters EXISTING client review flow (public token)
                              → client approves → scheduled
OWNER/ADMIN-created deliverables skip internal approval (self-approve).
```
The internal-approval UI is **uniform** regardless of deliverable type; only the post-approval path differs. Client deliverables additionally pass through the existing client-review flow.

### 5.2 Work
- Add an internal-approval state/transition to the post/version workflow (a `PENDING_INTERNAL` style status or an `approved_by`/`approved_at` gate) — confirm against current statuses (`DRAFT`, `PENDING`, `REVISIONS`, `SCHEDULED`, `PENDING_APPROVAL`, `ARCHIVED`) before adding.
- Gate "send to client" / "publish" actions behind `usePermissions().canSendDeliverables` (owner/admin). Members get "Submit for approval" instead.
- Owner/admin get an approval action (approve / request changes) on member-submitted deliverables.
- Enforce server-side: the status transition RPC must reject a member attempting to move a deliverable past internal approval.
- **Campaigns:** hide "New campaign" for members (`!canCreateCampaigns`); block campaign-create mutation server-side for non-admins.

### 5.3 Phase 5 Checklist
- [ ] Internal-approval state added; member submit → owner/admin approve
- [ ] Members cannot send to client / publish (UI + server)
- [ ] Owner/admin self-approve; approval UI uniform for internal + client deliverables
- [ ] Client deliverables still flow into the existing client-review process after internal approval
- [ ] Members cannot create campaigns (UI + server)
- [ ] **Adversarial test:** a member calling the status-transition / campaign-create RPC directly is rejected

🧪 **Test checkpoint:** Member drafts a deliverable → only "Submit for approval"; cannot send to client or create a campaign. Owner/admin approves → client flow proceeds. Owner/admin drafting skips the internal gate.

**→ Stop. Show result, wait for approval.**

---

## Data Model Summary (Final State)

```
auth.users (owner)
└── agency_subscriptions   (workspace billing + invoice signatory — owner only)
└── agency_members         (system_role + functional_role + permissions JSONB)
│     ├── system_role: superadmin | owner | admin | member
│     └── permissions: { documents: 'none'|'view'|'manage' }   (finance is NOT a flag)
└── agency_invites         (functional_role + permissions; NO system_role — joiners are members)
└── client_documents       (+ is_confidential)
└── invoices / expenses / transactions / proposals / prospects   (role-gated RLS)
```

### Schema additions
| Table | Column | Type | Notes |
|---|---|---|---|
| `agency_members` | `permissions` | jsonb | `{ documents }`; default `{'view'}` |
| `agency_invites` | `functional_role` | text | nullable |
| `agency_invites` | `permissions` | jsonb | `{ documents }`; **no** system_role column |
| `client_documents` | `is_confidential` | boolean | default false; backfilled true for Contract/NDA/Invoice-Finance |

### DB Helper Functions (SECURITY DEFINER)
| Function | Returns | Use |
|---|---|---|
| `is_workspace_owner()` | boolean | owner check (team mgmt, billing, workspace, signatory) |
| `is_workspace_admin()` | boolean | owner-or-admin (finance, proposals, prospects, reports, confidential docs) |
| `my_system_role()` | text | resolved role |
| `can_access_finance()` | boolean | = `is_workspace_admin()` — members never |
| `my_documents_level()` | text | documents RLS + UI |
| `can_view_confidential_docs()` | boolean | confidential doc RLS |
| `update_member_access(...)` | void | **owner-only** promote/demote/edit member |

---

## Out of Scope (All Phases)

- **Email-based invites** (sending the link via edge function) — link-copy stays; future.
- **Admin team management** — onboarding/promotion is owner-only by design.
- **Finance capability for members** — finance is owner/admin only; need it → promote to Admin.
- **Custom system roles / full permission matrix** — fixed tiers + one documents flag.
- **Per-resource ACLs** — confidential = owner/admin only.
- **Granular finance sub-permissions** (view-only finance) — finance is all-or-nothing.
- **Per-client member assignment** — members see all clients; scoping is a separate future feature.
- **Audit log** of permission changes — future.
- **Superadmin / admin-portal changes** — preserved as full-access passthrough only.
