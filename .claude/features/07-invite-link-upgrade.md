# Feature: Invite Link Upgrade — Named, Expiring, Role + Document Access
**Product**: Tercero — Social Media Agency Management SaaS
**File**: `.claude/features/07-invite-link-upgrade.md`
**Status**: 🟡 Built — pending one manual end-to-end verification (see Phase 1 checklist)
**Last Updated**: July 2026

---

## Context

Team invite links (`/settings` → Team → Invite Team Member) currently only let the owner pick a system role (Member/Admin) before generating a link — no name, a fixed 7-day expiry, and no document-access choice for members. Worse: **`agency_invites` already has `permissions` and `expires_at` columns with real defaults, but `join_team` (the RPC that turns an accepted invite into an `agency_members` row) completely ignores the stored `permissions` and hardcodes access by role instead.** So even before touching the UI, there's a real bug: any document-access choice captured on an invite today would be silently discarded. This feature fixes that and brings the invite dialog's role/document-access UI in line with the existing member-edit dialog (`EditAccessDialog` in `TeamSettings.jsx`), which already has this exact pattern for editing an existing member.

This is a natural extension of existing infrastructure — no new page, no new table beyond one column.

**Key facts confirmed against the live database and code before writing this doc:**
- `agency_invites` columns today: `id, agency_user_id, token, created_at, expires_at (default now()+7d), accepted_at, functional_role, permissions (default '{"documents":"view"}'), system_role (default 'member')`. No `label`/name column exists.
- `join_team` RPC (current body, confirmed via `pg_get_functiondef`):
  ```sql
  v_system_role := coalesce(v_invite.system_role, 'member');
  v_permissions := CASE v_system_role
    WHEN 'admin' THEN '{"documents":"manage"}'::jsonb
    ELSE              '{"documents":"view"}'::jsonb END;
  ```
  This never reads `v_invite.permissions` at all — it derives permissions purely from role, every time.
- `useGenerateInvite` (`src/api/team.js`) only ever inserts `{ agency_user_id, system_role }` — `permissions`, `expires_at`, and `label` are never set by the client, so every invite today silently uses the column defaults regardless of what an owner might want.
- `EditAccessDialog` (`TeamSettings.jsx`, used for editing an *existing* member's access) already has the target UI pattern: a role `RadioGroup` (`INVITE_ROLE_OPTIONS`), and — only when role is Member — a document-access `RadioGroup` using `DOCS_LEVEL_CONFIG` (`none`/`view`/`manage`). Its own save logic already encodes the business rule this feature must preserve: **admin always gets `documents: manage`; the document-access choice only applies to members** (`permissions: { documents: systemRole === 'admin' ? 'manage' : docsLevel }`).
- RLS on `agency_invites`: INSERT requires `agency_user_id = get_my_agency_user_id() AND is_workspace_owner()` — only the owner can create invites today (admins cannot). Unrelated to this feature; not being changed.
- The app's existing Popover + `Calendar` date-picker pattern (used throughout `DraftPostForm.jsx` for `target_date`) is the pattern to reuse for the new expiry picker.
- **Backward-compatibility risk identified and designed around**: if `join_team` is changed to blindly trust `v_invite.permissions`, any *already-pending* invite created under the old code (which never explicitly set `permissions`, so it sits at the column default `{"documents":"view"}`) would incorrectly resolve an **admin** invite to `view` instead of `manage` once accepted after this ships. The fix keeps the "admin always gets manage" rule hardcoded in the RPC regardless of what's stored, and only trusts `v_invite.permissions` for the member case — see 1.1 below.

---

## Phase Overview

```
Phase 1 — Named, expiring invites with role + document access
  Add a label column, fix join_team to actually honor stored permissions,
  and upgrade the invite dialog to capture name, expiry, role, and (for
  members) document access — the complete, usable upgrade in one phase.
```

**After this phase: stop and wait for approval before proceeding.**

---

## Phase 1 — Named, expiring invites with role + document access

### Goal
An owner creating an invite link can name it (e.g. "Batch for Sarah"), pick an expiry date up to 30 days out (default stays 7 days), choose Member or Admin, and — only for Member — pick a document-access level exactly as they would when editing an existing member. When that link is accepted, the chosen document-access level is what actually lands on the new `agency_members` row, not a role-derived default. The pending-invites list shows the name instead of a raw token snippet once one is set.

### Before Starting — Confirm With Codebase
1. Re-read `join_team`'s current definition via `pg_get_functiondef` immediately before writing the migration — confirm the hardcoded `CASE v_system_role` block hasn't changed since this doc was written.
2. Re-read `InviteDialog` and `EditAccessDialog` in `src/pages/settings/TeamSettings.jsx` in full — confirm `INVITE_ROLE_OPTIONS` and `DOCS_LEVEL_CONFIG` are still defined exactly as referenced here, and note their exact JSX structure to mirror (not reinvent).
3. Re-read the pending-invites row JSX (`pendingInvites.map(...)`, ~line 880) to confirm the current token-snippet-as-primary-text layout before changing it.
4. Confirm `usePendingInvites()`'s current `.select(...)` column list in `src/api/team.js` before extending it.
5. Confirm the `Calendar`/`Popover` date-picker JSX pattern in `DraftPostForm.jsx` (e.g. around its `target_date` field) to copy the same structure/classes for the new expiry field.

### 1.1 Database

Migration — add the label column:
```sql
ALTER TABLE agency_invites ADD COLUMN label text;
```

Migration — replace `join_team` to honor stored permissions for members while keeping admin's access non-negotiable (preserves current behavior for any invite pending before this ships, since those all sit at the untouched default):
```sql
CREATE OR REPLACE FUNCTION public.join_team(p_token text, p_first_name text, p_last_name text, p_functional_role text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_invite        agency_invites%ROWTYPE;
  v_member_uid    uuid := auth.uid();
  v_system_role   text;
  v_permissions   jsonb;
  v_sub           agency_subscriptions%ROWTYPE;
  v_seat_count    int;
BEGIN
  IF v_member_uid IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  SELECT * INTO v_invite FROM agency_invites
  WHERE token = p_token AND accepted_at IS NULL AND expires_at > now();

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'This invite link is no longer valid. Ask your workspace owner for a new one.');
  END IF;

  v_system_role := coalesce(v_invite.system_role, 'member');
  -- Admin access is never negotiable via the invite's stored permissions —
  -- mirrors EditAccessDialog's own rule. Member access honors whatever the
  -- owner picked when creating the invite, falling back to 'view' for any
  -- invite created before this column was populated.
  v_permissions := CASE v_system_role
    WHEN 'admin' THEN '{"documents":"manage"}'::jsonb
    ELSE              coalesce(v_invite.permissions, '{"documents":"view"}'::jsonb)
  END;

  SELECT * INTO v_sub FROM agency_subscriptions WHERE user_id = v_invite.agency_user_id;
  IF v_sub.max_team_members IS NOT NULL THEN
    SELECT COUNT(*) INTO v_seat_count FROM agency_members
    WHERE agency_user_id = v_invite.agency_user_id AND is_active = true;
    IF v_seat_count >= v_sub.max_team_members THEN
      RETURN jsonb_build_object('error', 'TEAM_SEAT_LIMIT_REACHED');
    END IF;
  END IF;

  INSERT INTO agency_members (agency_user_id, member_user_id, system_role, functional_role, permissions)
  VALUES (v_invite.agency_user_id, v_member_uid, v_system_role, p_functional_role, v_permissions)
  ON CONFLICT (agency_user_id, member_user_id) DO NOTHING;

  UPDATE agency_invites SET accepted_at = now() WHERE id = v_invite.id;

  UPDATE auth.users
  SET raw_user_meta_data = raw_user_meta_data || jsonb_build_object(
    'first_name', p_first_name, 'last_name', p_last_name,
    'full_name', p_first_name || ' ' || p_last_name)
  WHERE id = v_member_uid;

  PERFORM public.emit_notifications(
    v_invite.agency_user_id, v_member_uid,
    public.workspace_admin_uids(v_invite.agency_user_id),
    'team_member_joined', 'New team member joined',
    trim(p_first_name || ' ' || p_last_name) || ' joined your workspace',
    'team', NULL, '/settings');

  RETURN jsonb_build_object('success', true, 'agency_user_id', v_invite.agency_user_id);
END;
$function$;
```
Only the `v_permissions := CASE ...` block changes from the current definition — everything else is copied verbatim so nothing else about the join flow shifts.

No CHECK constraint on `expires_at`'s upper bound — the 30-day cap is enforced client-side only (Zod max-date validation in the dialog). This is a single-tenant, owner-scoped insert (RLS already restricts it to the workspace's own owner acting on their own workspace), so there's no cross-tenant boundary to defend server-side here.

### 1.2 API Layer

Changes to **`src/api/team.js`**:

- `useGenerateInvite`: `mutationFn` signature becomes `{ system_role = 'member', permissions, expires_at, label }`. Insert becomes:
  ```js
  .insert({
    agency_user_id: workspaceUserId,
    system_role,
    permissions,
    expires_at,
    label: label?.trim() || null,
  })
  ```
  (`permissions` is computed by the caller exactly like `EditAccessDialog` does — `{ documents: system_role === 'admin' ? 'manage' : docsLevel }` — so `useGenerateInvite` itself stays a thin insert, no new business logic duplicated here.)
- `usePendingInvites`: extend `.select(...)` to `'id, token, created_at, expires_at, system_role, label, permissions'` so the list can display the name and (for members) the document-access level.

No changes to `joinTeam()` (the client-side caller of `join_team`) — it already just forwards `token`/`firstName`/`lastName`/`functional_role`; the permissions logic change is entirely inside the RPC.

### 1.3 Components

**`InviteDialog`** (`TeamSettings.jsx`) — new fields added to the existing (pre-generation) step, above the existing role `RadioGroup`:
- **Link name** — `Input`, optional, placeholder `"e.g. Batch for Sarah"`.
- **Expires on** — `Popover` + `Calendar` (same pattern as `DraftPostForm.jsx`'s `target_date` field), default selected date = today + 7 days, `disabled` prop on `Calendar` blocks any date before tomorrow or after today + 30 days.
- Existing role `RadioGroup` (`INVITE_ROLE_OPTIONS`) — unchanged.
- **Document access** — new `RadioGroup` using `DOCS_LEVEL_CONFIG`, rendered only when `systemRole === 'member'` (identical conditional + JSX structure to the one already in `EditAccessDialog`, copied rather than abstracted into a shared component — it's a small block and the two dialogs' surrounding state shapes differ enough that extracting it now would be premature).
- `handleGenerate` computes `permissions = { documents: systemRole === 'admin' ? 'manage' : docsLevel }` and passes `{ system_role: systemRole, permissions, expires_at: expiryDate.toISOString(), label }` to `generateInvite.mutateAsync(...)`.
- Post-generation confirmation copy updates from the hardcoded "Expires in 7 days." to reflect the actual chosen date (`Expires {formatDate(expiryDate)}`).
- `handleClose`'s reset logic gets the two new pieces of state (`label`, `expiryDate`, `docsLevel`) added to what it resets on close.

**Pending invites list** (`TeamSettings.jsx`, the `pendingInvites.map(...)` block):
- Primary line becomes `invite.label || `/join/${invite.token.slice(0, 20)}…`` (label takes over the bold/primary position; when a label is set, the token snippet moves to a small muted secondary line instead of disappearing — still useful for support/debugging).
- When `invite.system_role === 'member'`, add a second `Badge` next to the existing role badge showing `DOCS_LEVEL_CONFIG[invite.permissions?.documents]?.label` (falls back to nothing if `permissions` is somehow null on a pre-migration row).

### 1.4 Team Settings Integration
No route or nav changes — everything lives inside the existing Team tab's `InviteDialog` and the pending-invites list it already renders alongside.

### 1.5 Impact on Existing Features
| Feature | Impact | Watch for |
|---|---|---|
| `join_team` RPC | Permissions logic changes for the member branch only | Confirm an admin invite still always resolves to `documents: manage`, including invites created *before* this ships (they have `permissions` at the old default, admin branch ignores it entirely by design) |
| `EditAccessDialog` | None — untouched. Referenced only as the UI pattern to mirror | Confirm editing an existing member's access still behaves identically after this ships |
| Existing pending invites (created before this ships) | Will show no label (falls back to token snippet) and, if member-role, will now display "View" as their document-access badge (the honest reflection of the default they were always silently given) | Not a behavior change for those invites — `join_team`'s fallback (`coalesce(v_invite.permissions, '{"documents":"view"}')`) matches what they'd have gotten under the old hardcoded logic anyway |

### 1.6 What This Phase Does NOT Include
- No change to who can create invites — still owner-only (`is_workspace_owner()` in RLS), unchanged.
- No `functional_role` (job title) selection at invite-creation time — stays the new member's own choice during signup, per existing design intent ("the new member will set their own job title").
- No server-side (DB CHECK constraint) enforcement of the 30-day expiry cap — client-side validation only, since this is an owner acting within their own workspace, not a cross-tenant boundary.
- No editing of an *already-generated* invite's name/expiry/role after the fact — revoke-and-recreate remains the only path, matching current behavior (invites are only ever revoked today, never edited).
- No bulk/batch invite generation (multiple emails at once) — out of scope, single-link-at-a-time as today.

### 1.7 Phase 1 Checklist — Before Marking Complete
- [x] `agency_invites.label` column exists (text, nullable)
- [x] `join_team` admin branch still always resolves to `documents: manage` regardless of the invite's stored `permissions`
- [x] `join_team` member branch honors the invite's stored `permissions.documents`, falling back to `view` when null
- [x] `useGenerateInvite` inserts `system_role`, `permissions`, `expires_at`, and `label`
- [x] `usePendingInvites` selects `label` and `permissions` in addition to existing columns
- [x] `InviteDialog` has a name field, an expiry date picker (default +7 days, bounded today–+30 days), the existing role selector, and a document-access selector shown only for Member
- [ ] Generating an invite as Member with "View" access, accepting it, and checking the resulting `agency_members.permissions` confirms `{"documents":"view"}` end-to-end — **not yet manually verified end-to-end in a browser**; the RPC logic and insert path were verified at the DB/code level (migration applied, `pg_get_functiondef` confirmed post-migration), but no live invite has actually been generated and accepted through the UI yet
- [x] Generating an invite as Admin confirms the resulting member always has `{"documents":"manage"}` regardless of any document-access UI state (holds by construction — the admin branch in `join_team` never reads `v_invite.permissions`)
- [x] Pending invites list shows the label when set, falling back to the token snippet when not
- [x] Pending invites list shows a document-access badge for member-role invites
- [x] `npx eslint` on all modified files: zero errors; production build passes

**→ Stop here. Show the result and wait for approval.**

### Implementation Notes
- Expiry picker's lower bound is "today," not "tomorrow" as loosely mentioned in this doc's prose — matches `DraftPostForm.jsx`'s own `target_date` picker convention exactly (`date < new Date(new Date().setHours(0,0,0,0))`), so a same-day narrow-window invite is allowed if the owner deliberately picks today.
- No deviations from the planned DB/API changes — the `join_team` replacement and `useGenerateInvite`/`usePendingInvites` changes match the doc exactly.
- The one open item is a real manual/browser verification of the full generate → accept → check-permissions loop, not a code gap — worth doing before considering this fully done, since it's the one thing static review can't fully confirm (e.g. Postgrest jsonb round-tripping, RLS on the insert with the new columns actually populated end-to-end).
- **Post-Phase-1 addition**: `InviteDialog` converted to a two-step stepper (animated sliding panels + `StepDot` indicators), matching `UploadMetaDialog.jsx`'s exact pattern per user request. Step 1 = **Link details** (name, expiry, and access-level/role selection); Step 2 = **Document access** (the member-only picker, or a plain "full access, nothing to choose" note for admin), which swaps in-place to show the generated link result once created — mirroring how `UploadMetaDialog` shows upload progress inside its second panel rather than adding a third step/dot. `StepDot` was duplicated locally in `TeamSettings.jsx` rather than imported, since the original is a non-exported helper scoped to `UploadMetaDialog.jsx`.
- **Post-Phase-1 addition**: dialog height now animates to match whichever panel is actually active, instead of a fixed `min(58vh, 480px)` sized for both. Panels changed from `inset-0` to `top-0 left-0 right-0` (height now comes from content instead of being stretched to fill a fixed-height parent); the outer container's `height` style is set to the active panel's measured height with a CSS transition, capped at `max-h-[65vh]` with `overflow-y-auto` as a safety net. Measurement uses **state-backed callback refs** (`ref={setPanel1El}`), not `useRef` + an effect on `[open]` — the first attempt used the latter and rendered nothing visible at all, because Radix mounts `DialogContent` into the DOM on a tick that isn't guaranteed to line up with the `open` prop change; the effect fired before the refs existed, captured `null` heights, and nothing ever re-triggered it. Callback refs fire exactly when the node actually appears, sidestepping the timing assumption entirely. Also cleaned up a conflicting `overflow-hidden` + `overflow-y-auto` pair on the same element into explicit `overflow-x-hidden overflow-y-auto`.
- **Post-Phase-1 addition**: both option groups (Access level, Document access) converted from hand-rolled fake-radio `<button>`s to real shadcn `RadioGroup`/`RadioGroupItem`, with the radio control moved to the end of each row (`flex items-start gap-3 ... <content /> <RadioGroupItem />`) and the role badge placed inline next to its title (`flex items-center gap-2` wrapping title + `Badge`, not `justify-between`) — both changes match `EditAccessDialog`'s already-established pattern for the exact same two option groups, copied verbatim rather than re-designed.
- **Post-Phase-1 addition**: Pending Invites list rows (`TeamSettings.jsx`) now show a document-access indicator for *every* invite, not just member ones — previously gated on `invite.system_role === 'member'`, silently omitting it for admin invites even though `invite.permissions.documents` is always populated correctly now. Per follow-up user feedback, the indicator is a bare icon placed directly next to the invite's name/label (not a separate `Badge` pill off to the side) — the role badge stays as its own `Badge`, positioned after the icon.
- **Important correction**: there are *two* separate pending-invites UIs that both call `usePendingInvites()` — the full list in `TeamSettings.jsx` (above), and a genuinely separate `Popover` in `TeamPage.jsx` (the "Active Links" button, `PopoverContent` titled "Pending Invites") with its own independent row markup. All of the above changes only touched the `TeamSettings.jsx` list; the `TeamPage.jsx` popover — which is what the user was actually looking at — still showed the raw token with no name or document-access indicator at all. Fixed by exporting `DOCS_LEVEL_CONFIG` from `TeamSettings.jsx` (previously a local, non-exported const) and applying the same name + inline document-access-icon treatment to the popover's row markup in `TeamPage.jsx`.
- **Post-Phase-1 addition**: renamed "Pending Invites" → "Active Links" everywhere for naming uniformity — the `TeamPage.jsx` trigger button already said "Active Links", but the section header in `TeamSettings.jsx`, the popover's own internal header, its empty state ("No pending invites"), and one reference in the help-guide copy (`src/pages/help/guides-data.js`) all still said "Pending Invites"/"pending invites". Also bumped typography across both surfaces (`TeamSettings.jsx` row name `text-sm`→`text-base font-semibold`, meta `text-xs`→`text-sm`, icons 11px→13px; `TeamPage.jsx` popover row name `text-xs`→`text-sm font-semibold`, meta `text-[11px]`→`text-xs`, header `text-sm`→`text-base font-semibold`) per feedback that it read too small.

---

## Data Model Summary (Final State After This Phase)

### `agency_invites` — Schema (changed columns only)
| Column | Type | Notes |
|---|---|---|
| `label` | text (NEW) | Nullable; owner-chosen name for the link, e.g. "Batch for Sarah" |
| `permissions` | jsonb | Unchanged column, but now actually consumed by `join_team` for the member case |
| `expires_at` | timestamptz | Unchanged column, default stays `now() + 7 days`; now settable by the client up to `now() + 30 days` |

No new tables. No storage bucket.

---

## Out of Scope (All Phases)

- Admin-created invites (owner-only stays as-is) — future build if ever requested.
- Editable invites (change name/expiry/role without revoking) — future build.
- Bulk invite generation — future build.
- Server-side (DB-level) expiry cap enforcement — client-side validation is sufficient for this owner-scoped, single-tenant action.
