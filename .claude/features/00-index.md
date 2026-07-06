# Feature Index

Tracks planned and built features. Each entry links to its full planning doc.

## Feature Files

| # | Feature | Doc | Status |
|---|---------|-----|--------|
| 01 | Notes & Tasks Split | [01-notes-and-tasks-split.md](01-notes-and-tasks-split.md) | ✅ Complete |
| 02 | Note Tags | [02-note-tags.md](02-note-tags.md) | ✅ Complete |
| 04 | Team Task Management | [04-team-task-management.md](04-team-task-management.md) | 🔵 Planned |
| 06 | Multi-Account Switcher | [06-multi-account-switcher.md](06-multi-account-switcher.md) | ✅ Complete |

## Key Database Changes

| Table | Feature | Notes |
|-------|---------|-------|
| `notes` (new) | 01 | Freeform agency notes; `client_id` nullable (NULL = global) |
| `note_tags` (new) | 02 | Dynamic, workspace-scoped tag definitions (name + color key) |
| `note_tag_links` (new) | 02 | Note↔tag junction; both FKs `ON DELETE CASCADE` |
| `tasks` (new) | 04 | Replaces `client_notes`; team task management with assignment + priority + RBAC |
| `client_notes` (dropped) | 04 | Replaced by `tasks`; data migrated in Phase 1 |

## Shared Infrastructure Notes

- No new storage buckets introduced yet.
