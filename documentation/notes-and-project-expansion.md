# Notes & Project Expansion — Ideas on Hold

Captured from planning discussion, June 2026. These ideas are parked pending the `created_by` foundation work.

---

## 1. Private / Public Notes

**The idea:** Each note has a visibility toggle — "personal" (only the creator sees it) or "shared" (the whole workspace sees it). Only the note's creator can flip the toggle.

**Why it needs `created_by` first:**
The current `notes.user_id` always stores the workspace owner's UID (the multi-tenant pattern — `workspaceUserId` is the same for every team member). There's currently no record of *which team member* actually created a note. Without a `created_by uuid` column storing the real `auth.uid()`, there's no way to identify the note's creator or enforce per-creator visibility.

**Proposed model once `created_by` exists:**
- New column: `is_private boolean not null default false`
- New column: `created_by uuid references auth.users(id)` — populated with `auth.uid()` at insert time (not `workspaceUserId`)
- RLS policy change: `user_id = get_my_agency_user_id() AND (is_private = false OR created_by = auth.uid())`
- UI: a lock/globe toggle in the note editor, only rendered when `note.created_by === currentUser.id`
- Naming: call it **"Personal"** vs **"Shared"** (not private/public — this is an internal distinction)

---

## 2. Projects — Shared Team Workspace

**The idea:** A "Project" is a named container that holds multiple notes and a lightweight discussion thread. Used for pre-planning before a campaign or post is created — a shared space for team members to think, discuss, and store context.

**Key decisions already made:**
- Projects are NOT deliverables — no conversion to campaigns or posts
- Discussion is **flat messages** (no threading) to start
- Whole-workspace visibility first (no per-project access control in v1) — see the "Team Invites" section below for why

**Proposed data model:**

```
projects
  id, user_id (workspace owner), name, description, created_at, updated_at

notes.project_id (nullable FK → projects.id, ON DELETE SET NULL)

project_messages
  id, project_id, author_id (real auth.uid()), content (text), created_at
```

**UI surfaces:**
- `/projects` — project list page under Operations sidebar group
- `/projects/:projectId` — project detail: description, linked notes grid, discussion thread
- Note editor: optional "Link to project" selector (alongside the existing "Linked to client")
- Notes list: optional project filter alongside the client filter

**RLS:**
- `projects` and `project_messages` both workspace-scoped via `user_id = get_my_agency_user_id()`
- `project_messages.author_id` is the real `auth.uid()` — needed to display who sent each message

---

## 3. Team Invites to Projects (Future, Post-Permissions-Layer)

**The idea:** A project can be invite-only — only specific team members can see and contribute to it.

**Why this is on hold:**
Per-project access control requires a separate permission layer that doesn't exist yet. The current workspace model gives all team members identical access to everything. Adding project-level visibility means:
- A `project_members` junction table
- RLS exceptions for projects not visible to all members
- The same problem as private notes — both need the same underlying "who is this specific team member" model

**Dependency:** Implement `created_by` on notes + the private/shared visibility model first. That establishes the pattern. Project invites then become a natural extension of the same layer.

---

## Implementation Order (Recommended)

1. ✅ **Note Tags** — shipped
2. 🔜 **`created_by` on notes** — small migration + API change, unblocks everything below
3. **Private / Shared notes** — builds directly on `created_by`
4. **Projects v1** — whole-workspace, no per-member access control; notes linkable to a project; flat discussion thread
5. **Project invites** — per-project access control; requires the visibility layer from step 3 to be solid first
