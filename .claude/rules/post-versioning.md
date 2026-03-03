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
    ├── status: DRAFT | PENDING | REVISIONS | SCHEDULED | ARCHIVED
    ├── media_urls[]
    ├── target_date
    └── admin_notes
```

`posts.current_version_id` always points to the latest active version. When reading posts, join through `post_versions!fk_current_version` to get the current version's data.

## Status Flow

```
DRAFT → PENDING → REVISIONS → SCHEDULED → ARCHIVED
                ↑___________|
```

- **DRAFT**: Work in progress, not submitted
- **PENDING**: Submitted for client/admin review
- **REVISIONS**: Client requested changes; a new version is created
- **SCHEDULED**: Approved and ready to publish
- **ARCHIVED**: No longer active

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
