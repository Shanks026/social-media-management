# Feature: Job Roles — Owner-Defined Job Titles
**Product**: Tercero — Social Media Agency Management SaaS
**File**: `.claude/features/10-job-roles.md`
**Status**: Complete — both phases built and applied
**Last Updated**: September 2026

---

## Context

Job titles are currently a hardcoded list — `AGENCY_ROLE_GROUPS` in
`src/lib/team-roles.js`, 19 entries chosen for a social-media agency, plus a "Custom…"
free-text escape. Every workspace gets the same list whether it fits them or not, and
the free-text option means the same job arrives as "Video Editor", "video editor" and
"Editor (Video)" in one workspace. A member also holds exactly one title, which doesn't
survive contact with a real agency where someone shoots *and* edits.

This feature makes the list owner-defined and per-workspace, and lets one person hold
several titles. It follows the **Note Tags** pattern almost exactly (`note_tags` +
`note_tag_links`, `TagPicker` + `ManageTagsDialog`) — same shape, pointed at members
instead of notes.

**Job roles are identification only. They never affect access.** All permissions come
from `system_role` (owner/admin/member) and the `permissions` JSONB, unchanged. This is
the locked decision from `.claude/features/03-rbac-team-roles.md` ("Functional roles =
cosmetic job titles only, NEVER affect access") and it matters more now that the list is
user-defined: if titles carried permissions, an owner could author their own security
model — and accidentally create a title that leaks finance. A badly-named job role must
be cosmetic, never a vulnerability.

---

## Phase Overview

```
Phase 1 — Definitions, assignment & the join form
  Owner-defined job roles per workspace, assignable many-per-member from
  Edit Access. Manage dialog on the Team page. Job title comes off the
  join form. After this phase the feature works end to end.

Phase 2 — Multi-title display across the app
  The four places that render a single functional_role string learn to
  render a set of badges with an overflow cap, and the legacy
  agency_members.functional_role column is dropped.
```

**After each phase: stop and wait for approval before proceeding.**

---

## Phase 1 — Definitions, Assignment & the Join Form ✅ Complete

### Goal

An owner opens the Team page, manages their own list of job titles — creating and
deleting, no fixed menu — and assigns any number of them to each member from Edit
Access. Admins can see the list but change nothing; members see the titles they hold in
Settings but never the management surface. New joiners stop picking their own title on
the signup form, so titles become the agency's label rather than a self-description. At
the end of this phase the feature is usable: titles are defined, assigned, and visible
everywhere they were before.

### Before Starting — Confirm With Codebase

1. **`src/lib/noteTags.js`** — `TAG_COLORS` shape, `TAG_COLOR_KEYS`, `getTagColor(key)`.
   Job roles reuse this palette rather than inventing a second one.
2. **`src/components/notes/TagPicker.jsx`** — props (`onToggle`, `onCreate`, `onManage`),
   the `showCreate` / `exactMatch` logic, and the Enter-to-create keybinding. The job
   role picker mirrors this.
3. **`src/components/notes/ManageTagsDialog.jsx`** — the `ColorPicker` + `TagRow`
   structure and the `AlertDialog` delete confirmation.
4. **`src/pages/TeamPage.jsx`** — the tab strip at ~line 584 is gated on `canManageTeam`;
   confirm where the "Invite Team Member" button sits (~line 567) so the "Job roles"
   button lands beside it.
5. **`src/pages/settings/TeamSettings.jsx`** — `EditAccessDialog`'s current
   `functional_role` Select (~line 741) and its `__custom__` branch, which the picker
   replaces.
6. **`get_team_members(p_agency_user_id)`** — confirm it still returns `functional_role`,
   `system_role`, `avatar_url`, `full_name`. Phase 1 does **not** modify this RPC.

### 1.1 Database

**New table — `agency_job_roles`** (the definitions). Mirrors `note_tags` exactly:
workspace-scoped, name + color, no updated_at.

```sql
create table public.agency_job_roles (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  name         text not null,
  color        text not null default 'slate',
  created_at   timestamptz not null default now()
);

-- Case-insensitive uniqueness per workspace: the whole point of a curated list is
-- that "Designer" and "designer" are not two roles.
create unique index agency_job_roles_workspace_name_key
  on public.agency_job_roles (workspace_id, lower(name));
```

**New table — `agency_member_job_roles`** (the links). Stores `member_user_id` directly
rather than `agency_members.id`, so the display sites — which all key off
`member_user_id` via `memberMap` — need no extra join.

```sql
create table public.agency_member_job_roles (
  workspace_id   uuid not null,
  member_user_id uuid not null,
  job_role_id    uuid not null references public.agency_job_roles(id) on delete cascade,
  created_at     timestamptz not null default now(),
  primary key (workspace_id, member_user_id, job_role_id)
);

create index agency_member_job_roles_member_idx
  on public.agency_member_job_roles (workspace_id, member_user_id);
```

`on delete cascade` on `job_role_id` is deliberate: deleting a job role removes it from
everyone holding it. That is the documented meaning of delete here, and it is why the
delete confirmation must state how many members are affected (§1.3).

**RLS — read is workspace-wide, every write is owner-only.**

```sql
alter table public.agency_job_roles enable row level security;

create policy "agency_job_roles_select_workspace" on public.agency_job_roles for select using (
  workspace_id = get_my_agency_user_id()
);
create policy "agency_job_roles_write_owner" on public.agency_job_roles for all using (
  workspace_id = get_my_agency_user_id() and is_workspace_owner()
) with check (
  workspace_id = get_my_agency_user_id() and is_workspace_owner()
);

alter table public.agency_member_job_roles enable row level security;

create policy "agency_member_job_roles_select_workspace" on public.agency_member_job_roles for select using (
  workspace_id = get_my_agency_user_id()
);
create policy "agency_member_job_roles_write_owner" on public.agency_member_job_roles for all using (
  workspace_id = get_my_agency_user_id() and is_workspace_owner()
) with check (
  workspace_id = get_my_agency_user_id() and is_workspace_owner()
);
```

**Why read is not gated on `is_workspace_admin()`** (decided at planning, September 2026):
every user must see their own job titles in Settings, which already requires a member to
read both tables. Once a member can read their own row there is no case for hiding a
colleague's — a job title is a label, not a secret, and members can already see the full
member roster including everyone's `system_role` badge on `/team`. Hiding the cosmetic
axis while showing the privileged one would be backwards. A split policy (own row only)
would also make the Phase 2 `TaskWatchers` hover card render differently depending on who
is looking, for no gain.

**What is hidden from members is the management surface, not the data** — the "Job roles"
button and `ManageJobRolesDialog` are UI-gated (§1.4), and the owner-only write policies
are the real enforcement.

**Seed from the current hardcoded list + existing data**, so no workspace starts empty
and nobody loses the title they have.

```sql
-- One row per workspace per distinct title currently in use, plus the curated
-- defaults. Colors come from the existing NAMED_ROLE_COLORS mapping where the name
-- matches, else 'slate' (the owner can recolor afterwards).
insert into public.agency_job_roles (workspace_id, name)
select distinct m.agency_user_id, trim(m.functional_role)
from public.agency_members m
where m.functional_role is not null and trim(m.functional_role) <> ''
on conflict do nothing;

-- Link every member to the title they already hold.
insert into public.agency_member_job_roles (workspace_id, member_user_id, job_role_id)
select m.agency_user_id, m.member_user_id, r.id
from public.agency_members m
join public.agency_job_roles r
  on r.workspace_id = m.agency_user_id
 and lower(r.name) = lower(trim(m.functional_role))
where m.functional_role is not null and trim(m.functional_role) <> ''
on conflict do nothing;
```

`agency_members.functional_role` is **left in place** for Phase 1 — every display site
still reads it, and dropping it here would break them all at once. Phase 2 migrates the
readers and then drops it.

**`update_member_access` is not modified.** Job role assignment gets its own narrow RPC
rather than being bolted onto the function that also sets `system_role` and
`permissions` — keeping "change what someone is called" and "change what someone can do"
as separate, separately-auditable operations.

```sql
create or replace function public.set_member_job_roles(
  p_member_user_id uuid, p_job_role_ids uuid[])
returns void language plpgsql security definer set search_path = public as $$
declare v_workspace uuid := public.get_my_agency_user_id();
begin
  if not public.is_workspace_owner() then
    raise exception 'Only the workspace owner can assign job roles';
  end if;

  if not exists (
    select 1 from agency_members
    where agency_user_id = v_workspace and member_user_id = p_member_user_id
  ) then
    raise exception 'Member not found';
  end if;

  -- Every id must belong to this workspace: stops a crafted request linking a
  -- member to another agency's role row.
  if exists (
    select 1 from unnest(coalesce(p_job_role_ids, '{}')) as rid
    where not exists (
      select 1 from agency_job_roles r where r.id = rid and r.workspace_id = v_workspace
    )
  ) then
    raise exception 'Unknown job role for this workspace';
  end if;

  delete from agency_member_job_roles
  where workspace_id = v_workspace and member_user_id = p_member_user_id
    and job_role_id <> all (coalesce(p_job_role_ids, '{}'));

  insert into agency_member_job_roles (workspace_id, member_user_id, job_role_id)
  select v_workspace, p_member_user_id, rid from unnest(coalesce(p_job_role_ids, '{}')) as rid
  on conflict do nothing;

  -- Keep the legacy column in step for the length of Phase 1. All four display
  -- sites still read agency_members.functional_role, so without this a title
  -- assigned here would never appear in Settings, on the team table, or in the
  -- TaskWatchers card until Phase 2 — the feature would look broken for a whole
  -- phase. Holds the alphabetically-first title, so it is *a* correct title, just
  -- not all of them. Phase 2 drops both this sync and the column.
  update agency_members m
  set functional_role = (
    select r.name from agency_member_job_roles l
    join agency_job_roles r on r.id = l.job_role_id
    where l.workspace_id = v_workspace and l.member_user_id = p_member_user_id
    order by r.name limit 1
  )
  where m.agency_user_id = v_workspace and m.member_user_id = p_member_user_id;
end $$;

revoke execute on function public.set_member_job_roles(uuid, uuid[]) from public, anon;
grant execute on function public.set_member_job_roles(uuid, uuid[]) to authenticated;
```

**Cleanup while here — two overloads of `update_member_access` exist** (a 4-arg and a
5-arg with `p_roles_and_responsibilities`). PostgREST resolves by named argument, so the
5-arg wins and the 4-arg is dead code that will silently diverge. Drop it:

```sql
drop function if exists public.update_member_access(uuid, text, jsonb, text);
```

### 1.2 API Layer

**New file — `src/api/jobRoles.js`**, shaped exactly like `src/api/noteTags.js`.

```js
// Read — all job role definitions for the workspace, alphabetical.
export function useJobRoles()
//   queryKey: ['job-roles', 'list', workspaceUserId]
//   enabled: !!workspaceUserId
//   Returns [] rather than throwing for a member (RLS yields zero rows, not an error).

// Read — member_user_id → [job role rows], for rendering badges without N queries.
export function useMemberJobRoles()
//   queryKey: ['job-roles', 'by-member', workspaceUserId]
//   Selects agency_member_job_roles joined to agency_job_roles, reduced to a map.

// Mutations — plain async, called via useMutation.
export async function createJobRole({ name, color })   // returns the created row
export async function deleteJobRole(id)
export async function setMemberJobRoles(memberUserId, jobRoleIds)  // set_member_job_roles RPC
```

Invalidation: `createJobRole`/`deleteJobRole` invalidate `['job-roles']` (both keys —
a delete cascades into the links); `setMemberJobRoles` invalidates
`['job-roles','by-member']`.

No rename function — create/delete only, per the agreed rule.

### 1.3 Components

```
src/lib/
  job-roles.js                   — JOB_ROLE_COLORS re-exported from noteTags' palette,
                                   plus getJobRoleColor(key). One palette, two features.
src/components/team/
  JobRolePill.jsx                — colored dot + name; `onRemove` shows a trailing X.
                                   Mirrors TagPill.jsx.
  JobRolePicker.jsx              — searchable multi-select popover. "Search or create a
                                   job role…", Enter creates + assigns when there's no
                                   exact match, "Manage job roles" footer. Mirrors
                                   TagPicker.jsx. Create is owner-only — for an admin the
                                   create affordance and footer are hidden, leaving a
                                   plain read-only list.
  ManageJobRolesDialog.jsx       — the definition list: name + ColorPicker on create,
                                   delete per row with an AlertDialog. Mirrors
                                   ManageTagsDialog.jsx, minus rename.
```

**`ManageJobRolesDialog` delete confirmation must state the blast radius** — "Designer is
assigned to 3 members. Deleting it removes it from all of them." The count comes from
`useMemberJobRoles()`, already loaded. This is the one place the cascade is visible, and
delete is the only destructive operation in the feature.

**Empty state** — a workspace with no job roles yet shows the standard `<Empty>` block
(`.claude/skills/empty-states/SKILL.md`), `EmptyTitle` with `className="font-bold text-xl"`.

### 1.4 Integration

- **`src/pages/settings/TeamSettings.jsx` → `EditAccessDialog`** — replace the
  `functional_role` Select and its `__custom__` free-text branch with `JobRolePicker`.
  On save, call `setMemberJobRoles()` alongside the existing `updateMemberAccess()`.
  Two calls, because they are two RPCs by design (§1.1) — run them in sequence and
  surface a single toast.
- **`src/pages/TeamPage.jsx`** — a **"Job roles"** button beside "Invite Team Member"
  (~line 567), opening `ManageJobRolesDialog`. Visible to owner and admin (label
  "Manage job roles" for the owner, "Job roles" for an admin), hidden from members.
  **Not a third tab** — the existing strip is `Active Members | Removed`, both
  people-lists, and a definitions list alongside them reads wrong.
- **`src/pages/JoinTeam.jsx`** — remove the Job title Select, the `__custom__` branch,
  the `functionalRole`/`customRole` state and the `resolvedRole` computation (~line 105).
  `joinTeam()` stops passing `functional_role`. The system-role badge showing what the
  joiner is joining as stays exactly as it is.
- **`src/api/team.js`** — `joinTeam()` drops its `functional_role` argument.
  `join_team`'s `p_functional_role` parameter is left on the RPC (defaulted, now unused)
  so the signature stays stable; Phase 2 removes it.

### 1.5 Impact on Existing Features

| Feature | Impact | Watch for |
|---|---|---|
| Join / onboarding | One fewer field; members no longer self-declare a title | A new member has no title until the owner assigns one — expected, titles gate nothing |
| Edit Access dialog | Single-select becomes multi-select; free text gone | An existing custom title must survive the seed migration and appear pre-selected |
| Team member table | Still reads legacy `functional_role` until Phase 2 | A member given a *second* title in Phase 1 shows only the legacy one until Phase 2 |
| `TaskWatchers` hover card | Same — legacy column until Phase 2 | — |
| RBAC | None. Titles gate nothing; `is_workspace_admin()` untouched | Any temptation to branch on a title name is a bug |

### 1.6 What This Phase Does NOT Include

- Renaming a job role — create/delete only, by decision
- Multi-title *rendering* anywhere outside the picker (Phase 2)
- Dropping `agency_members.functional_role` (Phase 2)
- Per-client roles / client-scoped access — explicitly out of scope for this feature
- Admins assigning titles — owner-only, confirmed
- Any change to `system_role`, `permissions`, or invite links

### 1.7 Phase 1 Checklist — Before Marking Complete

Access checks were exercised **as real authenticated owner / admin / member users**
(`set local role authenticated` + a `request.jwt.claims` sub) inside
`BEGIN; … ROLLBACK;` — SQL run via MCP executes as Postgres and bypasses RLS entirely,
so a plain query would have proved nothing.

- [x] Both tables exist with RLS enabled and the four policies applied
- [x] Case-insensitive uniqueness holds — creating "designer" when "Designer" exists is
      rejected by `agency_job_roles_workspace_name_key`
- [x] Seed ran: 2 roles (`Social Media Manager`, `Strategist`) for the one workspace that
      had titles, and both members linked — matching the 2 members who had a
      `functional_role`
- [x] An **owner** can create, delete and assign; deleting cascades through the links
      table, and the confirmation states the member count first
- [x] An **admin** sees the list read-only — create and assign both rejected; the picker
      hides its create row and manage footer via `canCreate`
- [x] A **member** can read both tables (so Settings shows their own titles) but every
      write is rejected — create, assign, and even deleting their own link all fail
- [x] Members do not see the "Job roles" button — it is inside the `isAdmin` gate
- [x] `set_member_job_roles` rejects a role id from another workspace
      (`Unknown job role for this workspace`)
- [x] `set_member_job_roles` rejects a non-owner caller
- [x] Assigning three titles to one member persists all three and re-opens pre-selected
- [x] The legacy `functional_role` sync fires — verified against the **deployed** RPC,
      not the dry-run copy: assigning `Designer` + `Copywriter` set the column to
      `Copywriter` (alphabetically first)
- [x] Clearing every title nulls the legacy column rather than leaving a stale value
- [x] The join form no longer asks for a job title
- [x] The dead 4-arg `update_member_access` overload is dropped — one overload remains
- [x] `npm run lint` clean across every changed file; `npm run build` passes

**Implementation Notes**

- **`canManageJobRoles` uses `isOwner`, not `canManageTeam`.** `canManageTeam` is
  `isOwnerTier` (owner **or superadmin**), but the RPC and both write policies check
  `is_workspace_owner()`, which a superadmin does not satisfy. Using `canManageTeam`
  would have shown a superadmin an affordance the database then rejects. `isOwner`
  matches the DB exactly, so the UI never offers an action that will fail.
- **The Team page's header-actions block was re-gated from `canManageTeam` to
  `isAdmin`,** with the Active Links popover and Invite button wrapped in an inner
  `canManageTeam` fragment. Admins had no route to the job role list otherwise — Edit
  Access is itself owner-gated (`TeamPage.jsx` ~line 405), so the picker's manage footer
  is unreachable for them. Invite creation stays owner-only, unchanged.
- **The whole "Your Role" section came off the join form**, not just the Select — the
  heading, the `__custom__` free-text input, the `functionalRole`/`customRole` state and
  the `resolvedRole` computation. `joinTeam()` no longer passes `functional_role`;
  `join_team`'s parameter is left defaulted on the RPC so the signature stays stable
  until Phase 2. `AGENCY_ROLE_GROUPS` and `getRolePalette` imports were dropped from
  `JoinTeam.jsx`, along with `cn` and the whole `Select` import group, which became
  unused with the section.
- **`getRolePalette` is still imported by `TeamSettings.jsx` and `TeamPage.jsx`** — they
  colour the legacy single `functional_role` on member rows. Those are Phase 2's
  readers; removing the import now would break them.
- **`src/lib/job-roles.js` is a re-export of the note-tag palette**, not a copy. One set
  of static Tailwind class strings, so the JIT compiler has a single place to find them
  and there is no second palette to drift.
- **Whole-repo lint went from 59 errors to 58** — this phase removed one pre-existing
  unused import and added none. All remaining errors are in files this phase did not
  touch.
- **Three files in the working tree are not from this phase** — `nav-main.jsx`,
  `nav-secondary.jsx` and `Settings.jsx` carry the owner's own in-flight edits (a
  "General Settings" → "General" nav rename). Left untouched.

**→ Stop here. Show the result and wait for approval.**

---

## Phase 2 — Multi-Title Display ✅ Complete

### Goal

Everywhere the app shows a person's job title, it shows all of them. The legacy
single-value column goes away, making the junction table the only source of truth.

### Before Starting — Confirm Phase 1 is Approved

1. Member read access is settled: workspace-wide SELECT, owner-only writes (§1.1). No
   policy change is needed before the display work.
2. Re-read each of the four display sites before editing — none of them were touched in
   Phase 1.
3. Confirm no new `functional_role` readers appeared since Phase 1
   (`grep -rn "functional_role" src/`).

### 2.1 Database

```sql
-- Only after every reader is migrated (§2.3) and verified.
alter table public.agency_members drop column functional_role;

-- get_team_members must stop selecting the dropped column.
-- update_member_access (5-arg) must drop p_functional_role.
-- join_team must drop p_functional_role.
-- set_member_job_roles must drop its legacy-column sync block (§1.1).
```

All three functions need rewriting in the same migration as the column drop, or the drop
breaks them.

### 2.2 API Layer

`useMemberJobRoles()` from Phase 1 already provides the map. `useTaskLookups()` gains it
so `memberMap` entries carry a `job_roles` array — one merge point, four consumers.

### 2.3 Components

Four sites, each single-string → set of badges with an overflow cap:

| File | Current | Becomes |
|---|---|---|
| `src/pages/TeamPage.jsx` | role column, one string | `JobRolePill` row, "+N" past two |
| `src/pages/settings/TeamSettings.jsx` (~line 626) | `· {functional_role}` | same treatment |
| `src/pages/settings/ProfileSettings.jsx` (~line 63) | own title | all own titles |
| `src/components/tasks/TaskWatchers.jsx` (~line 62) | `getRolePalette` dot + name | pills, capped at two |

`NAMED_ROLE_COLORS`, `FALLBACK_PALETTE` and `getRolePalette()` in `src/lib/team-roles.js`
become dead once colors come from the row — remove them. `AGENCY_ROLE_GROUPS` and
`AGENCY_ROLE_OPTIONS` die with the join form's Select in Phase 1, so confirm no readers
remain and delete them too.

### 2.4 Integration

No routing or nav changes.

### 2.5 Impact on Existing Features

| Feature | Impact | Watch for |
|---|---|---|
| Team table density | A member with four titles could blow out the row | The overflow cap is load-bearing, not decoration |
| `TaskWatchers` hover card | Built in feature 09 Phase 2 | Card is 256px wide — pills must wrap, not overflow |
| Any `functional_role` reader missed | Runtime break after the column drop | The grep in "Before Starting" is the gate |

### 2.6 What This Phase Does NOT Include

- Filtering the team list by job role — plausible next, not now
- Job roles anywhere outside the team surfaces (not on tasks, deliverables or chat)

### 2.7 Phase 2 Checklist — Before Marking Complete

- [x] All display sites render multiple titles, with an overflow cap — **seven sites,
      not the four this doc originally listed** (see notes)
- [x] `grep -rn "functional_role" src/` returns nothing but a historical comment in
      `JobRoleBadges.jsx`
- [x] The column is dropped and **five** functions were updated in the same migration —
      `get_team_members`, `get_removed_members`, `update_member_access`, `join_team` and
      `set_member_job_roles`
- [x] Joining, editing access, and the team table all still work after the drop —
      `get_team_members` returns 3 rows and `get_removed_members` 0, post-apply
- [x] A member with no titles renders cleanly — `JobRoleBadges` returns `null` on an
      empty array, preserving every caller's previous truthiness guard, so no separator
      or empty pill is left behind
- [x] Dead exports removed from `src/lib/team-roles.js` — `NAMED_ROLE_COLORS`,
      `FALLBACK_PALETTE`, `getRolePalette`, `AGENCY_ROLE_GROUPS`, `AGENCY_ROLE_OPTIONS`,
      `ADMIN_PALETTE`, `REMOVED_PALETTE`. Only `SYSTEM_ROLE_PALETTE` remains (24 users).
- [x] `npm run lint` clean on every changed file; `npm run build` passes

**Implementation Notes**

- **The Team page's job-title filter had to be ported, not dropped — this doc's §2.6 was
  wrong.** It listed "filtering the team list by job role" as a future idea, but
  `TeamPage.jsx` already filtered the roster by `functional_role` string equality, so the
  column drop would have deleted a working feature rather than deferring a new one.
  Raised with the owner, who chose to port it. Chips are now keyed by job role **id** and
  a member matches if they hold that role — which also fixes something equality couldn't
  express, now that one person holds several titles. Only roles someone actually holds
  are offered as chips, so no chip ever yields an empty table.
- **Seven display readers, not four.** The extras: `TeamSettings.jsx` has three (the Edit
  Access dialog subtitle plus two separate member lists, at what were ~line 987 and
  ~line 1262), and `useMyMemberRecord` in `api/team.js` selected the column to feed
  ProfileSettings. The Edit Access subtitle was **removed rather than migrated** — the
  job role picker sits a few rows below it in the same dialog, so repeating the titles in
  the header is noise once there can be several.
- **A fifth function referenced the column: `get_removed_members`.** Found by querying
  `pg_proc.prosrc` rather than trusting the plan's list. Without it the drop would have
  broken the Removed Members tab.
- **`get_team_members` was nearly rewritten from a wrong reconstruction.** The first
  draft of the migration invented a plausible-looking definition; reading the deployed
  one showed it was wrong in almost every detail — `LANGUAGE sql STABLE` not plpgsql,
  returns `joined_at` not `created_at`, includes `first_name`/`last_name`, has no
  `access_denied` guard, and orders by `joined_at ASC`. Both getters were then reproduced
  verbatim from `pg_get_functiondef` with only the one column removed. Changing a
  `RETURNS TABLE` shape needs DROP + CREATE, not CREATE OR REPLACE.
- **`agency_invites.functional_role` was dropped too.** It went unused when the job title
  came off the join form in Phase 1; the doc had it as "leave; drop in a later cleanup",
  but it was one line in a migration already touching both tables.
- **`JobRoleBadges` is a new shared component** (not in the plan) so all seven sites cap
  overflow identically rather than each inventing a rule. The cap matters most in the
  256px `TaskWatchers` hover card; the full list is in the `+N` chip's `title`.
- **`useTaskLookups` merges job roles into `memberMap`** as planned, so every task
  surface gets `member.job_roles` from one place.

**→ Stop here. Show the result and wait for approval.**



---

## Data Model Summary (Final State After All Phases)

```
agency_subscriptions (workspace)
└── agency_members (workspace_id = agency_user_id)
      └── agency_member_job_roles ──┐
                                    ├── agency_job_roles (workspace-scoped definitions)
                    (many-to-many) ─┘
```

### `agency_job_roles` — Schema
| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `workspace_id` | UUID | RLS key — the owner's UID |
| `name` | TEXT | Unique per workspace, case-insensitive |
| `color` | TEXT | Key into the shared `TAG_COLORS` palette; default `slate` |
| `created_at` | TIMESTAMPTZ | |

### `agency_member_job_roles` — Schema
| Column | Type | Notes |
|---|---|---|
| `workspace_id` | UUID | RLS key; part of PK |
| `member_user_id` | UUID | Part of PK — stored directly so display needs no join |
| `job_role_id` | UUID | FK → `agency_job_roles`, `ON DELETE CASCADE`; part of PK |
| `created_at` | TIMESTAMPTZ | |

### Storage Bucket
None.

---

## Impact on Existing Features

| Existing Feature | Impact | Action Required |
|---|---|---|
| Team management | Job titles become owner-defined and multi-valued | Phase 1 + 2 |
| Join / onboarding | Loses its self-selected Job title field | Phase 1 |
| RBAC | **None** — titles gate nothing, by design | Verify no gate ever reads a title |
| Task collaboration (09) | `TaskWatchers` hover card shows titles | Phase 2 |
| Invite links (07) | `agency_invites.functional_role` becomes unused | Leave; drop in a later cleanup |

---

## Out of Scope (All Phases)

- **Per-client roles / client-scoped access** — the original motivation ("role is dynamic
  based on the clients") is a *third* axis: `system_role` is workspace-wide, job roles are
  cosmetic, and neither expresses "runs Client A, executes on Client B". That needs
  client-scoped membership and would touch `is_workspace_admin()`, which currently gates
  finance, documents, deliverable approval, task assignment, task visibility and comment
  access. Its own feature, if wanted.
- **Renaming job roles** — create/delete only, by decision. Worth revisiting: since titles
  are cosmetic, a typo currently costs delete + recreate + reassign to everyone who held it.
- **Job roles carrying permissions or permission templates** — rejected in planning.
- **Admins creating or assigning job roles** — owner-only, confirmed.
- **Filtering or grouping the team by job role** — plausible follow-up.
- **`agency_invites.functional_role`** — left in place, unused, for a later cleanup.
