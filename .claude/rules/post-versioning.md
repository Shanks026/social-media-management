# Post Versioning System

How posts and their versions work in Tercero.

## Data Model

```
posts (parent record)
├── id
├── client_id
├── current_version_id → FK to post_versions
└── post_versions[] (child records)
    ├── id
    ├── post_id → FK to posts
    ├── version_number (incremental)
    ├── title
    ├── content
    ├── platform[]
    ├── status: text + CHECK, 11 values (see Status Flow)
    ├── media_urls[]
    ├── target_date
    └── admin_notes
```

`posts.current_version_id` always points to the latest active version. When reading posts, join through `post_versions!fk_current_version` to get the current version's data.

## Status Flow

The stored list lives in `src/lib/domain/deliverableStatus.js` (`STATUSES`), which a drift test keeps equal to the `post_versions_status_check` constraint (ADR 0006). Allowed transitions are enforced by the `enforce_post_status_transition` trigger:

```
DRAFT ──► SUBMITTED ──► READY ──► PENDING_APPROVAL ──► SCHEDULED ──► PUBLISHED
  │          │   ▲         │            │                  (social)
  │          ▼   │         │            ▼
  │   CHANGES_REQUESTED    │      NEEDS_REVISION  (revise → new Version)
  │                        │
  └────────────────────────┴──► APPROVED ──► DELIVERED   (non-social)
Any status except DELIVERED / PUBLISHED / ARCHIVED ──► ARCHIVED
```

- **DRAFT**: work in progress
- **SUBMITTED** / **CHANGES_REQUESTED** / **READY**: internal review of a Member's work by an Owner or Admin
- **PENDING_APPROVAL**: waiting for Client approval through a review link
- **NEEDS_REVISION**: the Client asked for changes; revising creates a new Version
- **APPROVED** → **DELIVERED**: non-social Deliverables; **SCHEDULED** → **PUBLISHED**: Social deliverables
- **ARCHIVED**: no longer active
- **PARTIALLY_PUBLISHED** is a display state, never stored: `displayStatus(version)` derives it from `platform_schedules`.

DRAFT and READY may also skip ahead to PENDING_APPROVAL, SCHEDULED or APPROVED. A Client's approval moves PENDING_APPROVAL to SCHEDULED for a Social deliverable, or to APPROVED for a non-social one.

## Creating a Post

Use the RPC `create_post_draft_v3` to atomically create the `posts` row + first `post_versions` row:
```js
await supabase.rpc('create_post_draft_v3', {
  p_client_id: clientId,
  p_title: title,
  p_content: content,
  p_platform: platforms,
  p_media_urls: mediaUrls,
  p_target_date: targetDate,
})
```

## Creating a Revision

Use `create_revision_version` when a revision is needed. This creates a new `post_versions` row and updates `posts.current_version_id`:
```js
await supabase.rpc('create_revision_version', {
  p_post_id: postId,
  p_title: title,
  // ... other fields
})
```

## Media Deletion Safety

Never delete media files immediately when editing a post. A media URL may be referenced by older versions. Only remove from storage when the file is confirmed unused across all versions of a post.
