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

The stored list lives in `src/lib/domain/deliverableStatus.js` (`STATUSES`), which a drift test keeps equal to the `post_versions_status_check` constraint (ADR 0006).

**Statuses change only through database functions (ADR 0004).** The `enforce_post_status_transition` trigger refuses a change to `status`, `published_at` or a platform's `published_at` in `platform_schedules` unless a transition function set the transaction-local flag `tercero.deliverable_transition`, for every caller (browser, service role, cron, SQL editor). A new Version must start as an unpublished DRAFT. Dates, content and other fields stay editable with a plain update. The trigger also checks the transition table. Never write a status from `src/api`: call the function, or add one (a new event in `deliverable_event`).

```
DRAFT ─submit─► SUBMITTED ─approve_internally─► READY ─send_post_for_approval─► PENDING_APPROVAL
  ▲               │    ▲                                                          │
  │   request_internal_changes   submit                       submit_review_decision (review link)
  │               ▼    │                                       │ APPROVE           │ REQUEST_REVISIONS
  │        CHANGES_REQUESTED                                    ▼                   ▼
  │                                     social:  SCHEDULED ─mark_published / ─► PUBLISHED
  │                                              ▲          mark_platform_published
  │                                  non-social: APPROVED ─mark_delivered─► DELIVERED
  │                                              ▲
  └ DRAFT / READY ─schedule_deliverable (social) / approve_deliverable (non-social)┘
NEEDS_REVISION ─create_revision_version─► ARCHIVED, plus a new DRAFT Version
Any status except DELIVERED / PUBLISHED / ARCHIVED ─archive_deliverable─► ARCHIVED
```

| Function | Caller |
|---|---|
| `submit_for_internal_approval` | the Version's creator |
| `approve_internally`, `request_internal_changes`, `send_post_for_approval`, `schedule_deliverable`, `approve_deliverable`, `mark_published`, `mark_platform_published`, `mark_delivered` | Owner/Admin of the workspace |
| `submit_review_decision(token, APPROVE \| REQUEST_REVISIONS, feedback)` | the Client (anonymous), once per review link |
| `create_revision_version` | any workspace user, on the current NEEDS_REVISION Version |
| `archive_deliverable` | Owner/Admin; a Member only their own DRAFT/SUBMITTED Deliverable |

In SQL tests, a fixture that needs a status sets the flag itself (`SELECT set_config('tercero.deliverable_transition', 'on', true)`) and clears it after. `supabase/seed.sql` does the same.

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

Use `create_revision_version` when the Client asked for revisions. It archives the current NEEDS_REVISION Version, copies it into a new DRAFT Version created by the caller, and updates `posts.current_version_id` (`createRevision` in `src/api/posts.js`):
```js
await supabase.rpc('create_revision_version', {
  p_parent_version_id: versionId,
  p_admin_notes: adminNotes, // created_by is auth.uid() (ADR 0008)
})
```

## Media Deletion Safety

Never delete media files immediately when editing a post. A media URL may be referenced by older versions. Only remove from storage when the file is confirmed unused across all versions of a post.
