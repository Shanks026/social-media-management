# Feature: Note Visibility & Sharing
**Product**: Tercero — Social Media Agency Management SaaS
**File**: `.claude/features/05-note-visibility-sharing.md`
**Status**: Phase 1 Complete ✅ — Phase 2 Complete ✅
**Last Updated**: July 2026

---

## Context

Every note today is visible and editable by the entire workspace — the `notes` RLS policy (`"Workspace manages own notes"`) only scopes by `user_id = get_my_agency_user_id()`, with no author or visibility check at all. There is no way to keep a personal note (a scratch thought, a draft idea, a sensitive observation about a client) private, and no way to loop in just one or two specific teammates without exposing it to everyone.

This feature adds three visibility states to a note — **Private** (author only, no exceptions), **Shared** (author + specifically invited members, each with `read` or `write` access), and **Workspace** (everyone, today's existing behavior) — while leaving all current workspace-wide notes and their edit permissions untouched. `notes.created_by`/`created_by_name`/`created_by_avatar` already exist and are populated correctly on every note (built in an earlier phase), so the one prerequisite a prior planning doc called out is already satisfied — this feature has no blockers and can start immediately. There are currently **zero rows in the live `notes` table**, so no backfill/migration-safety concerns apply.

Locked design decisions (confirmed with the user before writing this doc):
- **Private is truly private — no owner/admin override.** Unlike Tasks and Documents (which give owners/admins an oversight override), Notes are personal/scratch content, not business records, and the user explicitly wants an airtight guarantee: `created_by = auth.uid()` is the only path to a Private note.
- **Sharing has no role gate.** Any team member can share their own note with any other team member, regardless of either party's system role (owner/admin/member).
- **Existing workspace-note editing behavior is preserved exactly.** Today, any workspace member can edit or delete any note. This feature does not tighten that for the Workspace visibility state — it only adds meaningfully stronger protection for the new Private and Shared states.
  - **Superseded post-Phase-2** (see "Post-Phase-2 Fixes" below): after live testing, the user asked to tighten Workspace-note *deletion* specifically — editing remains open to all workspace members, but delete is now author-or-admin/owner only, matching the existing Post-deletion pattern.

---

## Phase Overview

```
Phase 1 — Visibility Core (Private / Workspace)
  Notes gain a visibility field (defaults to Private for new notes); the author
  can toggle between Private and Workspace; RLS enforces it authoritatively.

Phase 2 — Shared Notes (invite specific members, read/write permission)
  Author can share a note with specific teammates at read or write access,
  introducing the third visibility state and a notification on invite.
```

**After each phase: stop and wait for approval before proceeding.**

---

## Phase 1 — Visibility Core (Private / Workspace) ✅ Complete

### Goal

After Phase 1, every note has a visibility state. New notes default to **Private** — visible and editable only by their author, enforced in RLS (not just hidden in the UI). The author can flip a note to **Workspace** visibility at any time, restoring today's behavior (everyone in the agency can see and edit it). Non-author users cannot see a Private note under any circumstances, including the workspace owner. A visibility badge shows on note cards so the state is visible at a glance.

### Before Starting — Confirm With Codebase

1. Read `src/api/agencyNotes.js` in full (already read during planning — confirm `NOTE_SELECT`, `normalizeNote`, and all four exports still match what's described below before editing).
2. Read `src/pages/NoteEditorPage.jsx` — confirm where `created_by_name` currently renders (around the note metadata area) to find the right spot for the visibility control, and confirm how the page identifies "am I the author" (compare `note.created_by` to the current user id from `useAuth()`).
3. Read `src/pages/Notes.jsx` and `src/components/notes/AgencyNoteCard.jsx` in full — confirm the card's current props/layout before adding a visibility badge, and confirm how the list page currently filters/renders so a visibility filter chip can be added consistently with existing filter UI (client filter, tag filter, etc. if present).
4. Confirm live RLS state before altering it — run a query against `pg_policies` for `notes` and `note_tag_links` and diff against what's documented here; the policies may have changed since this doc was written.
5. Confirm `note_tag_links` policy scope — it currently checks only `notes.user_id = get_my_agency_user_id()` with **no** author/visibility awareness. This is a real gap: today, anyone who knows or enumerates a note's tag-link rows can see which tags are attached to a note they otherwise can't read once it's Private. Must be fixed in this phase (see 1.1).

### 1.1 Database

```sql
-- Add visibility to notes. Only 'private' and 'workspace' are valid until
-- Phase 2 adds 'shared' (kept as a separate migration so Phase 1 never
-- references the not-yet-existing note_shares table).
ALTER TABLE public.notes
  ADD COLUMN visibility text NOT NULL DEFAULT 'private'
    CHECK (visibility IN ('private', 'workspace'));

-- Replace the single blanket policy with per-command policies so visibility
-- can be enforced precisely on SELECT/UPDATE/DELETE while INSERT stays simple.
DROP POLICY "Workspace manages own notes" ON public.notes;

-- SELECT: workspace-scoped, and either you're the author or it's shared with
-- the whole workspace. This is the entire privacy guarantee — no admin
-- override, by design.
CREATE POLICY "notes_select" ON public.notes
  FOR SELECT USING (
    user_id = get_my_agency_user_id()
    AND (created_by = auth.uid() OR visibility = 'workspace')
  );

-- INSERT: unchanged in spirit from today — any workspace member can create a
-- note — but now requires created_by to be the real caller (already the
-- convention in createAgencyNote()).
CREATE POLICY "notes_insert" ON public.notes
  FOR INSERT WITH CHECK (
    user_id = get_my_agency_user_id() AND created_by = auth.uid()
  );

-- UPDATE: Workspace-visibility notes stay editable by any workspace member
-- (today's exact behavior, unchanged). Private notes are author-only.
CREATE POLICY "notes_update" ON public.notes
  FOR UPDATE USING (
    user_id = get_my_agency_user_id()
    AND (created_by = auth.uid() OR visibility = 'workspace')
  ) WITH CHECK (
    user_id = get_my_agency_user_id()
    AND (created_by = auth.uid() OR visibility = 'workspace')
  );

-- DELETE: same rule as UPDATE — preserves today's "anyone can delete a
-- workspace note" behavior; private notes only deletable by their author.
CREATE POLICY "notes_delete" ON public.notes
  FOR DELETE USING (
    user_id = get_my_agency_user_id()
    AND (created_by = auth.uid() OR visibility = 'workspace')
  );

-- Authoritative guard: only the author may ever change a note's visibility,
-- even though workspace-visibility notes are otherwise editable by anyone.
-- Without this, a teammate editing a shared workspace note's title could
-- also flip it to Private — which would immediately lock out everyone
-- including the people who could see it a second ago.
CREATE OR REPLACE FUNCTION public.enforce_note_visibility_author_only()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.visibility IS DISTINCT FROM OLD.visibility
     AND OLD.created_by IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'only_the_author_can_change_note_visibility';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tr_notes_visibility_author_only
  BEFORE UPDATE ON public.notes
  FOR EACH ROW EXECUTE FUNCTION public.enforce_note_visibility_author_only();

-- Fix the tag-link leak: note_tag_links today only checks workspace
-- membership, not note visibility, so a Private note's tags are queryable
-- by anyone who knows/enumerates the note_id even though the note itself is
-- now hidden. Mirror the same visibility check used on notes.
DROP POLICY "note_tag_links_workspace_scoped" ON public.note_tag_links;

CREATE POLICY "note_tag_links_visibility_scoped" ON public.note_tag_links
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM notes n
      WHERE n.id = note_tag_links.note_id
        AND n.user_id = get_my_agency_user_id()
        AND (n.created_by = auth.uid() OR n.visibility = 'workspace')
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM notes n
      WHERE n.id = note_tag_links.note_id
        AND n.user_id = get_my_agency_user_id()
        AND (n.created_by = auth.uid() OR n.visibility = 'workspace')
    )
  );
```

No index changes needed — `notes` queries are already scoped by `user_id`; `visibility` is a low-cardinality filter applied after that scope.

### 1.2 API Layer

**`src/api/agencyNotes.js`** — no new exports, extend two existing ones:

```js
export async function createAgencyNote({ title, body, client_id = null, visibility = 'private' }) {
  // ...unchanged... add `visibility` to the insert payload.
}

export async function updateAgencyNote(noteId, updates) {
  // unchanged signature — `updates` may now include `{ visibility: 'private' | 'workspace' }`.
  // RLS + the trigger enforce who is allowed to change it; no client-side gate needed
  // beyond hiding the control in the UI for non-authors (defense in depth, not authoritative).
}
```

`useAgencyNotes()` and `useAgencyNoteById()` need **no changes** — they already `select('*')`, so `visibility` comes back for free, and RLS now transparently returns fewer rows to non-authors for Private notes without any query change.

### 1.3 Components

```
src/components/notes/
├── AgencyNoteCard.jsx        — existing, modified: add visibility badge
└── NoteVisibilityToggle.jsx  — new: small pill control, Private/Workspace
```

**`NoteVisibilityToggle.jsx`** (new)
- Props: `visibility` (`'private' | 'workspace'`), `onChange(newVisibility)`, `disabled` (boolean — pass `true` when the current user isn't the author).
- Two-segment pill, matching the visual weight of other inline pill controls in the app (e.g. priority dots on `TaskCard`): 🔒 **Private** / 🌐 **Workspace**.
- When `disabled`, renders as a plain read-only badge (icon + label, no interaction) rather than hiding entirely — so non-authors can still see a note's visibility state, they just can't change it.

**`AgencyNoteCard.jsx`** (modify)
- Render the same lock/globe icon (read-only) next to the existing metadata (title/date/author) so visibility is visible without opening the note.

### 1.4 Notes Integration

**`src/pages/NoteEditorPage.jsx`** (modify)
- Import `NoteVisibilityToggle`. Render it near the existing `created_by_name` metadata display.
- `disabled={note.created_by !== user.id}` (compare against `useAuth()`'s `user.id` — the real caller id, not `workspaceUserId`, matching how `created_by` itself is populated).
- `onChange` calls `updateAgencyNote(note.id, { visibility: newValue })` via the existing update mutation, then invalidates `['agency-notes', 'detail', noteId]` and `['agency-notes', 'list', ...]`.

**`src/pages/Notes.jsx`** (modify)
- Add a lightweight visibility filter alongside any existing filters: **All / Private / Workspace** (client-side filter over the already-fetched list — no new query needed, since RLS has already scoped the fetched rows to what this user is allowed to see).
- Empty state copy when the Private filter has zero results: "No private notes yet — mark a note Private to keep it to yourself."

### 1.5 Impact on Existing Features

| Existing Feature | Impact | Action Required |
|---|---|---|
| Notes list / editor (all current usages) | New notes default to Private instead of implicitly-workspace-visible | None — this is the intended behavior change; zero existing rows means no surprise for current data |
| `note_tag_links` RLS | Tightened to respect visibility (previously leaked tag associations for any note regardless of privacy) | Covered in 1.1 — verify tag chips don't appear/error for a Private note viewed by a non-author (they shouldn't be able to load the note at all) |
| Client Detail → Workflow tab (notes shown there) | Same visibility rules apply — a client-scoped Private note only shows to its author, even inside the client's tab | None — `NotesTab`-equivalent reuses the same `useAgencyNotes`/`useAgencyNoteById` hooks, so this is automatic |

### 1.6 What This Phase Does NOT Include

- The **Shared** visibility state, invite UI, or `read`/`write` permission levels — Phase 2.
- Any change to who can edit/delete a **Workspace**-visibility note — deliberately left exactly as it is today.
- Any admin/owner override for Private notes — deliberately excluded per the locked design decision.
- Notifications of any kind (nothing to notify on yet — Private is a solo state, Workspace is unchanged).

### 1.7 Phase 1 Checklist — Before Marking Complete

- [x] `notes.visibility` column exists, `NOT NULL DEFAULT 'private'`, `CHECK` restricts to `('private','workspace')` — verified directly against `information_schema.columns`
- [x] Old blanket `"Workspace manages own notes"` policy is dropped; four new per-command policies (`notes_select`/`notes_insert`/`notes_update`/`notes_delete`) exist and match section 1.1 exactly — verified directly against `pg_policies`, byte-for-byte match
- [x] `tr_notes_visibility_author_only` trigger exists and is enabled — verified against `pg_trigger`. **Not** verified end-to-end as two distinct authenticated sessions (no second live user account available in this session) — logically identical to the already-proven `tasks_select`/`tasks_update` author-check pattern elsewhere in this codebase, but flagging this as a live smoke-test item before relying on it in production
- [x] `note_tag_links` policy replaced — verified directly against `pg_policies`
- [ ] A new note defaults to Private; creating one as User A and fetching as User B returns zero rows — **needs a live smoke test** (create a note as one team member, confirm a second member doesn't see it in `/operations/notes`)
- [ ] Flipping a note to Workspace restores full visibility/edit/delete for everyone — **needs a live smoke test**, same reason as above
- [x] `NoteVisibilityToggle` renders interactively only for the note's author; read-only badge for everyone else — implemented (`disabled={note.created_by !== user?.id}`), code-reviewed
- [x] `AgencyNoteCard` shows the correct lock/globe icon per note
- [x] `Notes.jsx` All/Private/Workspace filter works and the empty-state copy shows correctly
- [x] `npm run build` passes with no errors

**→ Stop here. Show the result and wait for approval.**

### Implementation Notes

- No deviations from the plan — DB, API, and all three UI touchpoints match section 1.1–1.4 exactly.
- **Live smoke test still needed** (flagged above): the RLS/trigger logic was verified structurally (columns, policies, and trigger all confirmed to exist with the exact expected definitions) and mirrors an already-proven pattern from Tasks, but was not exercised end-to-end as two real authenticated users in this session, since there's no second team-member login available to test with. Recommend a quick manual pass before considering this fully production-verified: create a note as one user, confirm it's invisible to a teammate, flip it to Workspace, confirm it becomes visible with full edit rights restored.
- `updateAgencyNote()` required no code change — it already spreads an arbitrary `updates` object, so `{ visibility: ... }` flows through for free.
- Visibility changes go through the same auto-save-style `updateAgencyNote()` call used for title/body edits, so they bump `updated_at` like any other edit — consistent with existing behavior, not specially exempted the way tag changes are.

---

## Phase 2 — Shared Notes (invite specific members, read/write permission) ✅ Complete

### Goal

After Phase 2, an author can share any of their notes with specific teammates, granting each one `read` (view only) or `write` (can edit content) access — without making the note fully Workspace-visible. Invited members get an in-app notification and can find notes shared with them via a "Shared with me" filter. Only the author can manage the share list (add, change permission, or revoke) — a `write` collaborator can edit the note's content but cannot re-share it or change its visibility.

### Before Starting — Confirm Phase 1 is Approved

1. Re-read the final `notes` RLS policies as actually applied (not just this doc) — Phase 2 alters all three read/write policies again and must build on the real current state.
2. Read `src/api/team.js`'s `useTeamMembers()` return shape — needed for the member picker (same pattern already used by `TaskCard`'s assignee picker and `CommentThread`'s @mention picker).
3. Read the `emit_notifications()` and `workspace_admin_uids()` SQL helpers (or their call sites in the `tasks`/`comments` triggers) to confirm the exact signature before writing `tg_notify_note_shared`.
4. Confirm `src/components/tasks/AssigneeFilterPopover.jsx` or the `CommentThread` mention-picker component's structure — reuse that UI shape for the share dialog's member picker rather than building a new pattern from scratch.

### 2.1 Database

```sql
-- Allow the third visibility state now that note_shares will exist to back it.
ALTER TABLE public.notes DROP CONSTRAINT notes_visibility_check;
ALTER TABLE public.notes ADD CONSTRAINT notes_visibility_check
  CHECK (visibility IN ('private', 'shared', 'workspace'));

CREATE TABLE public.note_shares (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id        uuid NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
  member_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission     text NOT NULL DEFAULT 'read' CHECK (permission IN ('read', 'write')),
  invited_by     uuid NOT NULL REFERENCES auth.users(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (note_id, member_user_id)
);

ALTER TABLE public.note_shares ENABLE ROW LEVEL SECURITY;

-- Only the note's author manages its share list (add/remove/change permission).
-- A write-collaborator editing the note's content does NOT get to re-share it.
CREATE POLICY "note_shares_author_manages" ON public.note_shares
  FOR ALL USING (
    EXISTS (SELECT 1 FROM notes n WHERE n.id = note_shares.note_id AND n.created_by = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM notes n WHERE n.id = note_shares.note_id AND n.created_by = auth.uid())
  );

-- An invited member can see their own share row (to know their permission level
-- and to power the "Shared with me" filter).
CREATE POLICY "note_shares_invitee_reads_own" ON public.note_shares
  FOR SELECT USING (member_user_id = auth.uid());

-- Extend notes SELECT: add the shared branch.
DROP POLICY "notes_select" ON public.notes;
CREATE POLICY "notes_select" ON public.notes
  FOR SELECT USING (
    user_id = get_my_agency_user_id()
    AND (
      created_by = auth.uid()
      OR visibility = 'workspace'
      OR (visibility = 'shared' AND EXISTS (
        SELECT 1 FROM note_shares ns WHERE ns.note_id = notes.id AND ns.member_user_id = auth.uid()
      ))
    )
  );

-- Extend notes UPDATE: shared + write permission can edit content, but the
-- visibility-change trigger from Phase 1 still blocks them from touching
-- `visibility` itself — only the author can do that.
DROP POLICY "notes_update" ON public.notes;
CREATE POLICY "notes_update" ON public.notes
  FOR UPDATE USING (
    user_id = get_my_agency_user_id()
    AND (
      created_by = auth.uid()
      OR visibility = 'workspace'
      OR (visibility = 'shared' AND EXISTS (
        SELECT 1 FROM note_shares ns
        WHERE ns.note_id = notes.id AND ns.member_user_id = auth.uid() AND ns.permission = 'write'
      ))
    )
  ) WITH CHECK (
    user_id = get_my_agency_user_id()
    AND (
      created_by = auth.uid()
      OR visibility = 'workspace'
      OR (visibility = 'shared' AND EXISTS (
        SELECT 1 FROM note_shares ns
        WHERE ns.note_id = notes.id AND ns.member_user_id = auth.uid() AND ns.permission = 'write'
      ))
    )
  );

-- DELETE is intentionally NOT extended to shared write-access — deleting a
-- note stays author-only-or-workspace-visibility, same as Phase 1. A
-- write-collaborator can edit content but can't destroy someone else's note.

-- Extend the tag-link visibility policy the same way.
DROP POLICY "note_tag_links_visibility_scoped" ON public.note_tag_links;
CREATE POLICY "note_tag_links_visibility_scoped" ON public.note_tag_links
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM notes n
      WHERE n.id = note_tag_links.note_id
        AND n.user_id = get_my_agency_user_id()
        AND (
          n.created_by = auth.uid()
          OR n.visibility = 'workspace'
          OR (n.visibility = 'shared' AND EXISTS (
            SELECT 1 FROM note_shares ns WHERE ns.note_id = n.id AND ns.member_user_id = auth.uid()
          ))
        )
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM notes n
      WHERE n.id = note_tag_links.note_id
        AND n.user_id = get_my_agency_user_id()
        AND n.created_by = auth.uid()
    )
  );

-- Notify an invited member when they're added to a note's share list.
-- Mirrors tg_notify_task_changes / tg_notify_comment_added — fan-out lives in
-- the DB, at the point the state actually changes.
CREATE OR REPLACE FUNCTION public.tg_notify_note_shared()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_workspace_id uuid;
  v_note_title text;
BEGIN
  SELECT user_id, title INTO v_workspace_id, v_note_title
  FROM notes WHERE id = NEW.note_id;

  PERFORM emit_notifications(
    v_workspace_id,
    NEW.invited_by,
    ARRAY[NEW.member_user_id],
    'note_shared',
    'Note shared with you',
    COALESCE(v_note_title, 'A note') || ' was shared with you (' || NEW.permission || ' access)',
    'note',
    NEW.note_id,
    '/operations/notes/' || NEW.note_id
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER tr_notify_note_shared
  AFTER INSERT ON public.note_shares
  FOR EACH ROW EXECUTE FUNCTION public.tg_notify_note_shared();
```

> **Verify the exact `emit_notifications()` signature and grant/revoke state against the live DB before applying** — this doc infers it from `documentation/features/feature-collaboration.md`; confirm with `pg_get_functiondef` first, matching the pattern used for every prior migration in this project.

### 2.2 API Layer

**New file: `src/api/noteShares.js`**

```js
// Read
export function useNoteShares(noteId)
// SELECT * FROM note_shares WHERE note_id = noteId, joined with team member
// display info (reuse the memberMap pattern from useTeamMembers()).
// queryKey: ['note-shares', 'list', noteId]

// Mutations
export async function shareNote({ noteId, memberUserId, permission })
// INSERT into note_shares. invited_by = auth.uid() (via resolveWorkspace()-style
// caller lookup, not workspaceUserId). Also flips the parent note's
// visibility to 'shared' if it isn't already (single updateAgencyNote call).

export async function updateNoteSharePermission(shareId, permission)
// UPDATE note_shares SET permission = ...

export async function removeNoteShare(shareId)
// DELETE FROM note_shares. If this was the last share row for a note, the
// author is left to decide the note's fate manually (do NOT auto-revert
// visibility to 'private' — that's a surprising side effect. Show a prompt
// instead: "No one else has access anymore — switch back to Private?")
```

**`src/api/agencyNotes.js`** — no changes needed beyond Phase 1; `visibility: 'shared'` is just another string value already covered by the existing update path.

### 2.3 Components

```
src/components/notes/
├── NoteVisibilityToggle.jsx  — modified: third segment, "Shared"
└── ShareNoteDialog.jsx       — new
```

**`NoteVisibilityToggle.jsx`** (modify)
- Add the third option. Selecting **Shared** for the first time (when no shares exist yet) opens `ShareNoteDialog` directly rather than just flipping a flag with nobody invited.

**`ShareNoteDialog.jsx`** (new)
- Member picker (reuse the `useTeamMembers()` + avatar-list pattern already established by `AssigneeFilterPopover`/`CommentThread`'s mention picker) to add a new person; each added row gets a Read/Write segmented toggle.
- Lists current `note_shares` rows (from `useNoteShares(noteId)`) with a permission toggle and a remove ("×") action per row.
- Footer note: "Only you can manage who has access to this note."

### 2.4 Notes Integration

**`src/pages/Notes.jsx`** (modify)
- Add a **"Shared with me"** filter tab — notes where `visibility = 'shared'` and the current user is not the author (i.e., they're here via a `note_shares` row, not because they created it). This requires each fetched note to carry enough info to distinguish "I'm the author" vs "I'm an invitee" — already possible client-side via `note.created_by === user.id`.

**`AgencyNoteCard.jsx`** (modify)
- "Shared" badge (distinct icon from lock/globe — e.g. a small people/share icon) plus a compact avatar stack of who it's shared with, capped at 3 + "+N".

### 2.5 Impact on Existing Features

| Existing Feature | Impact | Action Required |
|---|---|---|
| Notifications (`NotificationBell`) | New `note_shared` type added to the existing fan-out system | None beyond the trigger — the bell already renders any notification type generically |
| Phase 1's visibility toggle/badge | Extended, not replaced | Verify Phase 1's Private/Workspace states still behave identically after this phase ships |

### 2.6 What This Phase Does NOT Include

- Re-sharing by a `write` collaborator (share management stays author-exclusive).
- Bulk-sharing a note with an entire role/group at once — invites are per-individual only.
- Any change to Delete permissions — remains author-or-workspace-visibility only, per Phase 1.
- Email notification on share (in-app only, matching the existing collaboration layer's precedent of deciding email-parity separately, per notification type, later).

### 2.7 Phase 2 Checklist — Before Marking Complete

- [x] `notes.visibility` CHECK constraint allows `'shared'` — verified against `information_schema`
- [x] `note_shares` table + RLS policies exist; author-only management verified — live-tested: an invited (non-author) member cannot manage shares, only reads their own row
- [x] `notes_select`/`notes_update` policies extended; a `write`-permission invitee can view and edit content — live-tested end-to-end (see Implementation Notes). `read`-permission viewing verified structurally (identical predicate, `IS NOT NULL` branch); not editing is guaranteed by the `= 'write'` check on `notes_update`, not separately re-tested with a live `read` invitee edit attempt
- [x] Deleting a shared note remains impossible for a write-collaborator — `notes_delete` was not touched by this phase; unaffected structurally
- [x] `tg_notify_note_shared` fires exactly once per share invite and the invited member receives a bell notification linking to the note — live-tested, notification row confirmed with correct recipient/title/body/link
- [x] `ShareNoteDialog` correctly lists/edits/removes shares and only renders its management controls for the author — the entire `NoteVisibilityToggle` (including the Shared segment that opens the dialog) is non-interactive for non-authors, so a non-author never reaches the dialog at all
- [x] `Notes.jsx` "Shared with me" filter correctly distinguishes authored-and-shared vs invited-into — code-reviewed (`visibility === 'shared' && created_by !== user.id`)
- [x] `npm run build` passes with no errors

**→ Phase 2 complete.**

### Implementation Notes

- **Deviation from plan — RLS infinite recursion, found and fixed live.** The 2.1 SQL as originally written (inline `EXISTS` subqueries: `notes_select`/`notes_update` querying `note_shares`, and `note_shares_author_manages` querying `notes`) caused `ERROR 42P17: infinite recursion detected in policy for relation "note_shares"` the moment a real user exercised the flow in the browser. Root cause: both `notes` and `note_shares` have RLS enabled and each one's policy queries the other table inline — every cross-table reference re-triggered the other table's RLS evaluation, forming an unbounded loop. This silently broke note creation entirely (the `INSERT ... RETURNING` from `createAgencyNote()` requires an implicit `SELECT` under the `notes_select` policy, so even the first insert rolled back).
  - **Fix**: added two `SECURITY DEFINER` helper functions — `is_note_author(p_note_id)` and `my_note_share_permission(p_note_id)` — following the exact existing pattern of `get_my_agency_user_id()`/`is_workspace_admin()`. Both tables are owned by `postgres`, so a definer function executing as the table owner bypasses RLS on the table it queries internally, breaking the cycle. `notes_select`/`notes_update`/`note_tag_links_visibility_scoped` now call `my_note_share_permission(id)` instead of an inline `note_shares` subquery; `note_shares_author_manages` now calls `is_note_author(note_id)` instead of an inline `notes` subquery. This is a real migration on top of the one in 2.1 (`fix_notes_note_shares_rls_recursion`), applied and verified before this phase was marked complete.
  - Both new functions show the same "executable by anon/authenticated" security-advisor notice as `get_my_agency_user_id()` already does — expected and unavoidable, since functions referenced directly inside an RLS predicate must remain executable by the querying role. Confirmed this is pre-existing/accepted for `get_my_agency_user_id()` too, not a new regression.
- **Live end-to-end smoke test performed** (not just structural verification, given the recursion bug this phase surfaced): created a real note, flipped it to `shared`, inserted a `note_shares` row for a real teammate at `write` permission, and confirmed — as that teammate's session (via `SET LOCAL request.jwt.claims`) — they could see the note, edit its title, and saw only their own `note_shares` row (not the full list). Also confirmed `tg_notify_note_shared` inserts exactly one `notifications` row with the correct `recipient_user_id`, `title`, `body`, and deep link. All test rows were rolled back or deleted afterward; the one real note ("shared Notes Test") created by the user during their own manual testing was left untouched.
- `shareNote()` always sets the parent note's `visibility` to `'shared'` after inserting the share row (not conditionally) — idempotent and harmless if already `'shared'`, avoids an extra read before write.
- Clicking the "Shared" segment in `NoteVisibilityToggle` always opens `ShareNoteDialog` (whether visibility is currently private/workspace, or already shared) rather than flipping the flag directly — matches the plan's intent that visibility only becomes `'shared'` once someone is actually invited, and lets the author reopen the dialog to manage an existing share list.
- `AgencyNoteCard`'s avatar stack (`SharedIndicator`) only queries `note_shares` for cards whose `visibility === 'shared'`, keeping the extra per-card query scoped to notes that actually need it.

### Post-Phase-2 Fixes (from live testing with a real read-only invitee)

The user tested Phase 2 end-to-end with a real `read`-permission teammate and found the editor UI never actually enforced the permission level — it only gated the RLS layer, so a read-only viewer could type into every field and only discover they had no access when autosave 406'd (`PGRST116`). Fixed:

- **`NoteEditorPage.jsx` now computes `canEdit`** (`isAuthor || visibility === 'workspace' || (visibility === 'shared' && myPermission === 'write')`) via `useNoteShares(noteId)`, and gates every field: title `Input` (`readOnly`), `RichTextEditor` (`editable` prop — already existed, just was never wired up), the "Linked to" client `Select` (`disabled`), and tags (remove button hidden, `TagPicker` not rendered at all) when `!canEdit`.
- **Deeper leak found and fixed**: `ImageNodeView`/`VideoNodeView` are custom React node views with their own click handlers (upload dropzone, delete button, resize handles) — Tiptap's `editable: false` only sets `contentEditable` on the document root and does **not** propagate into custom node views. A read-only viewer could still upload/delete/resize media even with the editor itself non-editable. Both node views now read `editor.isEditable` and hide all interactive controls (upload dropzone becomes a static "No image"/"No video" placeholder; delete button and resize handles/width presets don't render) when not editable.
- **Delete button gated** (`canDelete`) to match `notes_delete` exactly, so a viewer without delete rights never sees a button that would just 406.
- **RLS regression fixed**: the Phase 2 migration's `note_tag_links` policy `WITH CHECK` accidentally dropped the `workspace`/`shared-write` branch (left only `created_by = auth.uid()`), silently blocking any non-author workspace member from tagging even a plain Workspace note. Restored parity with the `USING` clause via a follow-up migration (`fix_note_tag_links_with_check_parity`).
- **Delete permission tightened for Workspace notes** (explicit user decision, see locked-decisions update above): `notes_delete` changed from `created_by = auth.uid() OR visibility = 'workspace'` to `created_by = auth.uid() OR (visibility = 'workspace' AND is_workspace_admin())` — mirrors the existing Post-deletion pattern exactly. Live-verified: a regular member's delete attempt on another member's Workspace note is blocked (0 rows); an admin's delete succeeds; the author can always delete their own. Migration: `notes_workspace_delete_author_or_admin`.
- Also fixed, unrelated to this feature: two Dashboard/Client "Week Ahead" timeline widgets were querying a nonexistent `client_notes` table (404) for a due-date reminders row — this table was renamed to `tasks` in an earlier, unrelated migration and these two widgets were never updated. Per user request, removed the reminders row from both widgets entirely rather than repointing the query, since it wasn't considered necessary.

### Editor/Card Layout Rework + Collaborator Avatars

Per user request, `NoteEditorPage.jsx` was reordered into: Row 1 (Back · `SaveIndicator`, `NoteCollaboratorAvatars`, Print, Delete), Row 2 (Title + Tags directly beneath it), Row 3 (Created by · Updated by), Row 4 (Linked-to client · `NoteVisibilityToggle`). This required adding `notes.updated_by`/`updated_by_name` columns (migration `notes_add_updated_by`) since nothing previously tracked the last editor of a collaboratively-editable note; `updateAgencyNote()` now stamps both on every save via `supabase.auth.getUser()` (the sanctioned pattern for plain mutation functions per CLAUDE.md).

**`NoteCollaboratorAvatars.jsx`** (new, `src/components/notes/`) — shadcn ships no dedicated "avatar group" primitive; their own official example is just `<Avatar>` children in a `-space-x-2` flex container with a background ring, which this reuses. Shows the author + any Shared collaborators (max 3 visible, `+N` overflow), each labeled "Author"/"Read access"/"Write access". Hovering the stack opens a `HoverCard` (not `Popover` — user specifically wanted hover, not click) listing everyone at once, replacing an earlier per-avatar-tooltip design. Renders nothing for `visibility === 'private'` (definitionally single-user). Used in both `NoteEditorPage.jsx` (Row 1) and `AgencyNoteCard.jsx` (below tags, above the client/date footer).

**Real bug found via live testing and fixed**: `note_shares_invitee_reads_own` (`FOR SELECT USING (member_user_id = auth.uid())`) only ever let an invited collaborator see their *own* share row — so a Shared note with two invitees meant neither could see the other's avatar in the group, only their own. Widened to let any collaborator on a note see every share row for that note (migration `note_shares_visible_to_all_collaborators`), using the same `my_note_share_permission()` `SECURITY DEFINER` helper (not an inline self-referencing subquery) to avoid the same class of RLS recursion bug fixed earlier in Phase 2. Live-verified with two real member accounts sharing one note — each now sees both share rows. No client-code change was needed; `useNoteShares()` already fetched all rows for the note, RLS alone was hiding them.

---

## Data Model Summary (Final State After All Phases)

```
auth.users (member)
└── notes
    ├── user_id      → get_my_agency_user_id() — workspace scope (unchanged)
    ├── created_by   → auth.uid() of the actual author (already existed)
    ├── visibility   → 'private' | 'shared' | 'workspace'  (NEW)
    └── note_shares  (NEW — only present when visibility = 'shared')
        ├── note_id         → notes.id
        ├── member_user_id  → auth.uid() of the invited teammate
        ├── permission      → 'read' | 'write'
        └── invited_by      → auth.uid() of whoever added them (always the author, enforced in RLS)
```

### `notes` — New/Changed Columns
| Column | Type | Notes |
|---|---|---|
| `visibility` | TEXT NOT NULL DEFAULT `'private'` | `CHECK IN ('private','shared','workspace')`; author-only to change (enforced by trigger, not just RLS) |

### `note_shares` — Schema (Phase 2)
| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `note_id` | UUID | FK → `notes.id` ON DELETE CASCADE |
| `member_user_id` | UUID | FK → `auth.users.id` ON DELETE CASCADE; the invitee |
| `permission` | TEXT | `CHECK IN ('read','write')`, default `'read'` |
| `invited_by` | UUID | FK → `auth.users.id`; always the note's author (RLS-enforced) |
| `created_at` | TIMESTAMPTZ | default `now()` |

No new storage buckets — this feature touches no file storage.

---

## Impact on Existing Features

| Existing Feature | Impact | Action Required |
|---|---|---|
| Notes (global page + Client Detail Workflow tab) | Adds visibility filtering/controls; existing workspace-visible notes and their open edit/delete rights are unchanged | Covered phase-by-phase above |
| Note Tags (`note_tags`/`note_tag_links`) | `note_tag_links` RLS tightened to respect visibility (was previously leaking tag associations for any note) | Covered in Phase 1, section 1.1 |
| Notifications (`NotificationBell`) | New `note_shared` notification type | Covered in Phase 2 |
| RBAC (`usePermissions()`) | **Not touched** — sharing/visibility has no role gate, by design | None |
| Subscription gating (`useSubscription()`) | **Not touched** — this feature is not gated by plan tier | None |

---

## Out of Scope (All Phases)

- **Owner/admin override for Private notes** — deliberately excluded; Private means private from everyone, including the workspace owner.
- **Role-gating who can share or be shared with** — any member can share with any member.
- **Re-sharing by a write-collaborator** — only the original author manages a note's share list.
- **Sharing with an entire role/group in one action** — per-individual invites only; future idea, not this feature.
- **Email notifications on share** — in-app bell only for now, matching the collaboration layer's existing pattern of deferring email-parity decisions.
- **Changing Workspace-visibility edit/delete permissions** — intentionally left exactly as today (anyone in the workspace can edit/delete a Workspace note); this feature only adds stronger protection for Private/Shared.
- **The parked "Projects" shared-workspace idea** (`documentation/notes-and-project-expansion.md`) — a separate, larger feature; not part of this doc.
