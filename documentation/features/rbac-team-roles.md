# Feature: Role-Based Access Control (RBAC) & Team Roles

themth### Capability flag (the only per-member tuning)

Members are otherwise a fixed tier. The **only** per-member knob is documents access, stored as a `permissions` JSONB on `agency_members`:

```jsonc
{ "documents": "view" } // 'none' | 'view' | 'manage'
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

| Area                     | Action                                                      |   Owner   |   Admin   |       Member        |
| ------------------------ | ----------------------------------------------------------- | :-------: | :-------: | :-----------------: |
| **Dashboard**            | View (non-finance widgets)                                  |    ✅     |    ✅     |         ✅          |
| **Dashboard**            | Finance widgets / revenue / profit cells                    |    ✅     |    ✅     |         ❌          |
| **Clients**              | View                                                        |    ✅     |    ✅     |      ✅ (all)       |
| **Clients**              | Create / onboard                                            |    ✅     |    ✅     |         ❌          |
| **Clients**              | Edit                                                        |    ✅     |    ✅     |         ❌          |
| **Clients**              | Delete                                                      |    ✅     |    ✅     |         ❌          |
| **Deliverables**         | Create / edit draft                                         |    ✅     |    ✅     |         ✅          |
| **Deliverables**         | Submit for internal approval                                |     —     |     —     |         ✅          |
| **Deliverables**         | Approve internally                                          |    ✅     |    ✅     |         ❌          |
| **Deliverables**         | Send to client for approval                                 |    ✅     |    ✅     |         ❌          |
| **Campaigns**            | View / work within                                          |    ✅     |    ✅     |         ✅          |
| **Campaigns**            | Create campaign                                             |    ✅     |    ✅     |         ❌          |
| **Calendar**             | View                                                        |    ✅     |    ✅     |         ✅          |
| **Meetings**             | View all (workspace)                                        |    ✅     |    ✅     |         ✅          |
| **Meetings**             | Create                                                      |    ✅     |    ✅     |         ✅          |
| **Meetings**             | Edit / delete others'                                       |    ✅     |    ✅     |    ❌ (own only)    |
| **Notes**                | View all (workspace)                                        |    ✅     |    ✅     |         ✅          |
| **Notes**                | Create                                                      |    ✅     |    ✅     |         ✅          |
| **Notes**                | Edit / delete others'                                       |    ✅     |    ✅     |    ❌ (own only)    |
| **Tasks** _(when built)_ | Create / assign                                             |    ✅     |    ✅     |         ❌          |
| **Tasks** _(when built)_ | Complete assigned (not delete)                              |    ✅     |    ✅     |         ✅          |
| **Documents**            | Non-confidential                                            | ✅ manage | ✅ manage | ⚙️ none/view/manage |
| **Documents**            | Confidential (Contract/NDA/Finance)                         |    ✅     |    ✅     |      ❌ never       |
| **Proposals**            | View / create / edit                                        |    ✅     |    ✅     |         ❌          |
| **Prospects**            | View / create / edit / convert                              |    ✅     |    ✅     |         ❌          |
| **Reports**              | View                                                        |    ✅     |    ✅     |         ❌          |
| **Finance**              | Invoices / expenses / transactions / ledger / subscriptions |    ✅     |    ✅     |         ❌          |
| **Finance**              | Issue invoices                                              |    ✅     |    ✅     |         ❌          |
| **Invoice signatory**    | Configure (name / designation / signature)                  |    ✅     |    ❌     |         ❌          |
| **Billing**              | View / manage Tercero subscription                          |    ✅     |    ❌     |         ❌          |
| **Workspace settings**   | Edit agency identity / branding / config                    |    ✅     |    👁️     |         ❌          |
| **Team**                 | Invite / onboard                                            |    ✅     |    ❌     |         ❌          |
| **Team**                 | Promote / demote / remove                                   |    ✅     |    ❌     |         ❌          |
| **Workspace**            | Delete workspace                                            |    ✅     |    ❌     |         ❌          |

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

| Layer                 | Mechanism                                                                                                                | Enforces                                |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------- |
| Postgres RLS          | `can_access_finance()`, `my_documents_level()`, `can_view_confidential_docs()`, `is_workspace_owner()` in table policies | Direct table reads/writes               |
| SECURITY DEFINER RPCs | **In-function** capability checks (RLS is bypassed inside definer functions)                                             | Aggregations, mutations, joins          |
| Storage policies      | Bucket policies on `storage.objects`                                                                                     | Direct file fetches via signed URLs     |
| UI / routes           | `usePermissions()`                                                                                                       | Cosmetic — hide what the user can't use |

### Member-restricted data surfaces (server-side gating required)

Members are denied these at the **database** level, not just the UI:

- **Finance:** `invoices`, `invoice_items`, `expenses`, `transactions`, `recurring_invoices` (base tables); finance-bearing views inherit via `security_invoker=on`; SECURITY DEFINER RPCs (`get_clients_with_pipeline`, `get_campaign_analytics`) must null/omit finance fields for members; finance-mutation RPCs must `RAISE` for non-finance users.
- **Proposals / Prospects:** their tables gated to owner/admin via RLS.
- **Reports:** gated to owner/admin (finance access).
- **Confidential documents:** row RLS **and** storage-path enforcement (see Phase 4 storage gap).

### Team-management & privilege-escalation rules (Phase 2)

- **Onboarding is owner-only.** Invite RLS on `agency_invites` stays **owner-only** (`auth.uid() = get_my_agency_user_id() AND is_workspace_owner()`). Admins **cannot** create invites.
- **System role set at invite time.** `join_team` reads `system_role` from the invite (`'admin'` or `'member'`) and derives permissions from it automatically — admin → `{ documents: 'manage' }`, member → `{ documents: 'view' }`. The joiner's `functional_role` comes from the join form, not the invite.
- **Promotion/demotion is owner-only.** `update_member_access` requires `is_workspace_owner()`, clamps the target role to `('admin','member')`, and rejects `'owner'`/`'superadmin'`.
- **Owner is immutable.** No path may demote/remove the owner or create a second `'owner'`.
- **Members cannot write their own row.** RLS gives members `select_self` only — read, never write. No self-escalation.

### Storage / confidential documents caveat (Phase 4)

The `client-documents` bucket is private, but its read policy (`foldername[1] = get_my_agency_user_id()`) grants **every active member the whole folder** — it ignores `my_documents_level()` and `is_confidential`. Row RLS hides confidential rows, but a member could fetch a confidential file **directly by storage path**. Phase 4 must close this (path-prefix policy or edge-function-mediated signed URLs — decided at the start of Phase 4).

---

## Phase Overview

```
✅ Phase 1 — Permission Foundation (no visible change)
  Schema (permissions JSONB {documents}), backfill migration,
  SECURITY DEFINER access helpers, AuthContext + usePermissions() hook.

✅ Phase 2 — Team Management (typed invites + role display)
  Invite RLS owner-only; agency_invites.system_role column; join_team reads role
  from invite + joiner sets own functional_role; update_member_access (owner-only)
  promotes/demotes; InviteDialog shows admin/member toggle; two-column role display
  (Access badge + Job Title badge) across TeamPage, TeamSettings, ProfileSettings.

⬜ Phase 3 — Restricted Sections (Finance, Billing, Proposals, Prospects, Reports)
  RLS on finance/proposals/prospects tables; route guards + nav hide for members;
  Billing & workspace-settings-edit owner-only; dashboard finance widgets hidden.

⬜ Phase 4 — Documents Cap & Confidentiality
  is_confidential per document; RLS + storage policy; none/view/manage enforced in
  nav, DocumentsTab (global + client detail), and upload/edit/delete.

✅ Phase 5 — Deliverable Approval Workflow
  SUBMITTED/CHANGES_REQUESTED/READY statuses; submit_for_internal_approval RPC
  (creator-only); approve_deliverable + request_changes RPCs (owner/admin);
  Approvals page (owner/admin queue); Submissions page (member tracker);
  updated_by column + trigger; "My Work" filter; attribution in PostDetails.
  Campaign-create gating deferred.
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
-- NOTE: system_role column is added to agency_invites in Phase 2 (rbac_invite_system_role migration).

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
export const SYSTEM_ROLES = {
  OWNER: 'owner',
  ADMIN: 'admin',
  MEMBER: 'member',
  SUPERADMIN: 'superadmin',
}

export const DOCUMENT_LEVELS = ['none', 'view', 'manage']

// Member documents default; admin bypasses (always manage).
export const MEMBER_DEFAULT_PERMISSIONS = { documents: 'view' }

// Categories that default to confidential on upload.
export const CONFIDENTIAL_DEFAULT_CATEGORIES = [
  'Contract',
  'NDA',
  'Invoice / Finance',
]

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
    canSendDeliverables: full, // members draft only
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

- [x] `permissions` column on `agency_members` + `agency_invites`, default `{"documents":"view"}`
- [x] `agency_invites` has `functional_role` and `permissions` columns (Phase 2 later adds `system_role`)
- [x] Backfill: admin/superadmin → `manage`; member → `view`
- [x] Owner self-rows promoted `'admin'` → `'owner'`; `superadmin` untouched
- [x] `handle_new_user_subscription` inserts owner self-rows as `'owner'` (subscription INSERT verbatim)
- [x] Helpers created & tested: `is_workspace_owner`, `is_workspace_admin`, `my_system_role`, `can_access_finance`, `my_documents_level`, `can_view_confidential_docs`
- [x] `src/lib/permissions.js` with `resolveCapabilities`
- [x] `AuthContext` exposes `userPermissions`; `useMyMemberRecord` selects `permissions`
- [x] `usePermissions()` returns correct caps for owner / admin / member
- [x] App builds and behaves identically (no gating active)

✅ **Phase 1 complete.**

---

## Phase 2 — Team Management (typed invites + role display) ✅

### Goal

The **owner** is the only person who can onboard teammates and set access tiers. The owner picks **system role** (Admin or Member) on the invite link; the joiner picks their own **functional role** (cosmetic job title) at join time. Admins and members see **no** team-management controls.

### What Was Built

#### 2.1 Database

**Migration `rbac_invite_system_role`:**

- Added `system_role text NOT NULL DEFAULT 'member' CHECK (system_role IN ('admin', 'member'))` to `agency_invites`
- Dropped the old 3-param `join_team` overloads, recreated as `join_team(p_token, p_first_name, p_last_name, p_functional_role DEFAULT NULL)`:
  - Reads `system_role` from the invite row (no clamping — admin or member per the link)
  - Derives permissions: `admin → { documents: 'manage' }`, `member → { documents: 'view' }`
  - Validates: unexpired, `accepted_at IS NULL`, sets `accepted_at = now()` atomically
  - Forces `member_user_id = auth.uid()`, `agency_user_id` from invite; re-checks seat limit
- Updated `get_invite_by_token` to return `system_role` (not `functional_role`)
- `update_member_access(p_member_id, p_system_role, p_permissions, p_functional_role)` — owner-only promote/demote/edit; clamps to `('admin','member')`; owner row immutable
- Invite RLS stays owner-only; `agency_members` direct writes owner-only; members have `select_self` only

#### 2.2 API Layer (`src/api/team.js`)

- `useGenerateInvite({ system_role })` — inserts `{ agency_user_id, system_role }` only (no functional_role or permissions at invite time)
- `joinTeam({ token, firstName, lastName, functional_role })` — passes `p_functional_role` to RPC
- `usePendingInvites()` — selects `id, token, created_at, expires_at, system_role`

#### 2.3 Components

**`TeamSettings.jsx` — `InviteDialog` (owner-only):**

- Admin/Member two-option radio picker (`SYSTEM_ROLE_PALETTE` palette per option)
- "Generate Link" button; copies link to clipboard; no functional role or docs level at invite time
- Pending invite list shows `system_role` badge per invite

**`JoinTeam.jsx`:**

- Shows the invite's `system_role` as a read-only badge ("You're joining as Admin / Member")
- Optional grouped functional role selector (`AGENCY_ROLE_GROUPS`) with Custom free-text
- `joinTeam` called with `functional_role: resolvedRole`

**Role display (two separate axes, never merged):**

- `TeamPage.jsx` — two columns: **Access** (system role `Badge`) + **Job Title** (outline `Badge` + filled dot)
- `TeamSettings.jsx` member rows — same two-column display
- `ProfileSettings.jsx` — two separate `InfoRow`s: System Role (ShieldCheck icon + `Badge`) and Job Title (Briefcase icon + filled dot + text)
- All `isAdmin` usages replaced with `canManageTeam` from `usePermissions()`
- `isOwner` correctly checks `system_role === 'owner'` (not `=== 'admin'`)

**Badge styling (`src/lib/team-roles.js`):**

- `SYSTEM_ROLE_PALETTE`: `border-0 bg-{color}-100 text-{color}-700 dark:bg-{color}-900/30 dark:text-{color}-300` pattern
  - owner → violet · admin → blue · member → emerald · superadmin → amber
- Functional role: shadcn `<Badge variant="outline">` + `<span className="size-1.5 rounded-full shrink-0 {dot}">` inline

### 2.4 Phase 2 Checklist

- [x] Invite RLS owner-only; admins cannot invite
- [x] `agency_invites` has `system_role` column (`'admin'` or `'member'`)
- [x] `join_team` reads `system_role` from invite, derives permissions, accepts `p_functional_role` from joiner
- [x] `get_invite_by_token` returns `system_role`
- [x] `update_member_access` owner-only; clamps to admin/member; owner immutable; functional role updatable
- [x] Adversarial guard: a member/admin cannot invite, cannot escalate via `join_team` or `update_member_access`
- [x] InviteDialog shows Admin/Member toggle only; generates typed invite link
- [x] JoinTeam shows system_role badge + optional functional role selector
- [x] TeamPage: two-column display (Access + Job Title); `isOwner` checks `system_role === 'owner'`
- [x] ProfileSettings: two separate InfoRows for System Role + Job Title
- [x] All `isAdmin` → `canManageTeam`; admins and members see no team-management controls

✅ **Phase 2 complete.**

**→ Phase 3 is next** (Restricted Sections — Finance, Billing, Proposals, Prospects, Reports).

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
- [ ] Subscription locks still compose for owner/admin who _have_ role access

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

## Phase 5 — Internal Approval Workflow ✅

> ⚠️ This phase adds a workflow state to deliverables — it is more than pure gating.

### Goal

Member-created deliverables require **internal review by an owner/admin** before they can be sent to a client or marked ready. A dedicated approval queue lets owners/admins triage submissions; a submissions tracker lets members follow progress on their own work.

> **Campaign-create gating** (originally scoped to this phase) is deferred — no gating on campaign creation for members yet.

### What Was Built

#### 5.1 Database

**Migration `add_updated_by_to_post_versions`:**
- Added `updated_by uuid REFERENCES auth.users(id)` to `post_versions`
- Trigger `set_post_version_updated_by` fires on UPDATE when any content field changes (`title`, `content`, `platform`, `media_urls`, `target_date`) — auto-fills `updated_by = auth.uid()`

**Migration `scope_submit_to_creator`:**
- Updated `submit_for_internal_approval(p_version_id)` RPC to enforce `created_by = auth.uid()` — only the creator of the draft may submit it; anyone else gets an exception

**New statuses added to `post_versions.status` enum:**

| Status | Who triggers | Meaning |
|---|---|---|
| `SUBMITTED` | Member calls `submit_for_internal_approval` | In the owner/admin review queue |
| `CHANGES_REQUESTED` | Owner/admin calls `request_changes` | Member must revise and resubmit |
| `READY` | Owner/admin calls `approve_deliverable` | Cleared for client send or publish |

**Full internal approval flow:**
```
DRAFT → SUBMITTED (member submits)
           → READY (owner/admin approves) → PENDING_APPROVAL (client send) or published
           → CHANGES_REQUESTED (owner/admin requests changes)
              → SUBMITTED (member resubmits)
```

**New RPCs:**
- `submit_for_internal_approval(p_version_id)` — sets status SUBMITTED; creator-only guard (DB exception on mismatch)
- `approve_deliverable(p_version_id)` — sets status READY; owner/admin enforced in RPC
- `request_changes(p_version_id, p_note)` — sets status CHANGES_REQUESTED; owner/admin enforced in RPC

#### 5.2 API & Shared Config

**`src/lib/post-statuses.js`** (new — single source of truth for all status display):
- `POST_STATUS_CONFIG` keyed by DB enum (underscores) — each entry: `{ label, icon, color (hex), className (Tailwind badge classes) }`; covers all 12 statuses including the three new ones
- `POST_CHART_CONFIG` keyed by display name (spaces, e.g. `'PENDING APPROVAL'`) for Recharts charts; hex colors match `POST_STATUS_CONFIG`
- `STATUS_DISPLAY_MAP` — converts DB enum key → chart display key
- `ALLOWED_CHART_STATUSES` — ordered list of statuses to render on donut/bar charts
- Replaces local status definitions previously duplicated in `WorkflowHealth`, `ContentPipelineBar`, `OverviewTab`, and `StatusBadge`

**`src/api/posts.js`** additions:
- `submitForApproval(versionId)` — calls `submit_for_internal_approval`
- `approveDeliverable(versionId)` — calls `approve_deliverable`
- `requestChanges(versionId, note)` — calls `request_changes`

#### 5.3 Components

**Approvals page (`src/pages/approvals/ApprovalsPage.jsx`):**
- Owner/admin-only; sidebar nav entry hidden for members
- Three tabs: Submitted (pending queue), Ready, Changes Requested
- Sortable table with inline thumbnail (video camcorder-icon overlay), client badge, creator chip, status badge, due date
- `ApprovalDetailDialog` — full post preview with approve / request-changes actions

**Submissions page (`src/pages/submissions/SubmissionsPage.jsx`):**
- Member-facing tracker; nav entry hidden for owners/admins
- Three tabs: Submitted, Ready, Changes Requested
- Shows the current user's submitted deliverables only

**PostDetails.jsx attribution strip:**
- Created by / Updated by / Submitted by rows with avatar + name
- Uses `created_by` (author), `updated_by` (last editor from trigger), and submission timestamp

**DraftPostList + CalendarPostCard:** Creator avatar/name chip shown on each card row.

**"My Work" toggle:**
- Filter button on global Posts page (`Posts.jsx`) and client WorkflowTab
- Filters the list to posts where `created_by = user.id`

**Status additions across charts and tab lists:**
- `SUBMITTED`, `CHANGES_REQUESTED`, `READY` added to `WorkflowHealth` donut, `ContentPipelineBar` dashboard chart, `OverviewTab` chart, `Posts.jsx` tab list, `WorkflowTab.jsx` tab list, `StatusBadge.jsx`
- Bottleneck alert priority (4-tier): CHANGES_REQUESTED → SUBMITTED → PENDING_APPROVAL → all-clear

**`nav-user.jsx` (sidebar footer):**
- Displays user's system role label (`SYSTEM_ROLE_PALETTE`) instead of email in the collapsed footer tile
- Email still shown in the expanded dropdown menu

### 5.4 Phase 5 Checklist

- [x] `updated_by` column on `post_versions` + trigger on content-change UPDATE
- [x] SUBMITTED, CHANGES_REQUESTED, READY statuses added to enum
- [x] `submit_for_internal_approval` scoped to post creator (DB exception + UI guard)
- [x] `approve_deliverable` and `request_changes` RPCs (owner/admin enforced in RPC)
- [x] Approvals page — owner/admin queue with approve / request-changes actions
- [x] Submissions page — member tracker for own submitted deliverables
- [x] Attribution (created by / updated by / submitted by) displayed in PostDetails
- [x] Creator chips on DraftPostList and CalendarPostCard
- [x] "My Work" filter on global Posts page and WorkflowTab
- [x] New statuses visible in charts, tabs, and badges across all surfaces
- [x] `src/lib/post-statuses.js` — shared source of truth for status colors/config
- [x] Sidebar footer shows role label instead of email
- [ ] Members cannot create campaigns (deferred)
- [ ] Adversarial test: member calling `approve_deliverable` / `request_changes` RPC directly is rejected

✅ **Phase 5 complete (campaign-create gating deferred).**

---

## Data Model Summary (Final State)

```
auth.users (owner)
└── agency_subscriptions   (workspace billing + invoice signatory — owner only)
└── agency_members         (system_role + functional_role + permissions JSONB)
│     ├── system_role: superadmin | owner | admin | member
│     └── permissions: { documents: 'none'|'view'|'manage' }   (finance is NOT a flag)
└── agency_invites         (system_role set by owner at invite; functional_role set by joiner at join)
└── client_documents       (+ is_confidential — Phase 4)
└── invoices / expenses / transactions / proposals / prospects   (role-gated RLS — Phase 3)
```

### Schema additions

| Table              | Column            | Type    | Notes                                                                          |
| ------------------ | ----------------- | ------- | ------------------------------------------------------------------------------ |
| `agency_members`   | `permissions`     | jsonb   | `{ documents }`; default `{ "documents": "view" }`                             |
| `agency_invites`   | `system_role`     | text    | `'admin'` or `'member'`; drives joiner's access tier                           |
| `agency_invites`   | `functional_role` | text    | nullable; set by joiner at join (not by owner at invite)                       |
| `agency_invites`   | `permissions`     | jsonb   | nullable; auto-derived from `system_role` by `join_team`, not stored on invite |
| `client_documents` | `is_confidential` | boolean | Phase 4 — default false; backfilled true for Contract/NDA/Invoice-Finance      |
| `post_versions`    | `updated_by`      | uuid    | Phase 5 — FK to `auth.users`; set by trigger on content-field UPDATE          |

### DB Helper Functions (SECURITY DEFINER)

| Function                       | Returns | Use                                                                        |
| ------------------------------ | ------- | -------------------------------------------------------------------------- |
| `is_workspace_owner()`         | boolean | owner check (team mgmt, billing, workspace, signatory)                     |
| `is_workspace_admin()`         | boolean | owner-or-admin (finance, proposals, prospects, reports, confidential docs) |
| `my_system_role()`             | text    | resolved role                                                              |
| `can_access_finance()`         | boolean | = `is_workspace_admin()` — members never                                   |
| `my_documents_level()`         | text    | documents RLS + UI                                                         |
| `can_view_confidential_docs()` | boolean | confidential doc RLS                                                       |
| `update_member_access(...)`    | void    | **owner-only** promote/demote/edit member                                  |
| `submit_for_internal_approval(p_version_id)` | void | sets SUBMITTED; raises if caller ≠ creator |
| `approve_deliverable(p_version_id)`          | void | sets READY; owner/admin only               |
| `request_changes(p_version_id, p_note)`      | void | sets CHANGES_REQUESTED; owner/admin only   |

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
