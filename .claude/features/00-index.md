# Feature Index

Tracks planned and built features. Each entry links to its full planning doc.

## Feature Files

| # | Feature | Doc | Status |
|---|---------|-----|--------|
| 01 | Notes & Tasks Split | [01-notes-and-tasks-split.md](01-notes-and-tasks-split.md) | ✅ Complete |
| 02 | Note Tags | [02-note-tags.md](02-note-tags.md) | ✅ Complete |

## Key Database Changes

| Table | Feature | Notes |
|-------|---------|-------|
| `notes` (new) | 01 | Freeform agency notes; `client_id` nullable (NULL = global) |
| `note_tags` (new) | 02 | Dynamic, workspace-scoped tag definitions (name + color key) |
| `note_tag_links` (new) | 02 | Note↔tag junction; both FKs `ON DELETE CASCADE` |

## Shared Infrastructure Notes

- No new storage buckets introduced yet.
