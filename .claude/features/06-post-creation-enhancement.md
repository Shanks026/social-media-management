# Feature: Per-Platform Scheduling & Publishing Enhancement

**File**: `.claude/features/06-post-creation-enhancement.md`
**Status**: ✅ Phase 1 complete — ✅ Phase 2 complete — ✅ Phase 3 complete — ✅ Phase 4 complete — ✅ Phase 5 complete — ✅ Phase 6 complete (absorbed into Phase 3)
**Priority**: High — core product upgrade
**Last Updated**: March 2026

---

## Overview

Tercero currently supports a single `target_date` for all platforms on a post. This enhancement adds per-platform scheduling — allowing the agency to set independent date/times per platform (e.g. Instagram on Mar 10 9am, LinkedIn on Mar 11 8am). The publishing workflow is upgraded to track per-platform publish state, trigger per-platform client emails, and only mark the post fully `PUBLISHED` once every platform is confirmed live.

**Client involvement:** The client approves **content + proposed schedule**. They never input dates. The agency controls all scheduling. The public review page shows the schedule as informational.

---

## Design Decisions

### JSONB additive approach (not new table)
Per-platform scheduling is stored in a single nullable `platform_schedules` JSONB column on `post_versions`. This is additive — existing posts where `platform_schedules IS NULL` follow the current single-date flow with zero code changes. The JSONB shape per platform is:

```json
{
  "instagram": { "scheduled_at": "2025-03-10T09:00:00Z", "published_at": null },
  "linkedin":  { "scheduled_at": "2025-03-11T08:00:00Z", "published_at": null }
}
```

### `target_date` stays as the primary/canonical date
Used for calendar queries, sorting, and public review display. When per-platform scheduling is active, `target_date` = earliest `scheduled_at` across all platforms (auto-computed). All existing queries remain valid.

### `PUBLISHED` status is not split
No new status enum values. The post stays `SCHEDULED` while platforms are partially published. `PUBLISHED` only when all `published_at` values in the JSONB are set. A UI-only derived state `PARTIALLY_PUBLISHED` is computed in the app layer for display.

### Client approves the whole package
The public review page shows per-platform dates informationally. The "Approve & Schedule" action covers content + schedule in one click. If the client wants different dates → Request Revisions (existing flow).

### Per-platform scheduling is opt-in
The toggle in `DraftPostForm` defaults to off. Off = current single-date behaviour, unchanged for existing posts and workflows.

---

## Affected Files

| File | Change |
|------|--------|
| `post_versions` table | Add `platform_schedules jsonb DEFAULT NULL` |
| `create_post_draft_v3` RPC | Add `p_platform_schedules` param + INSERT |
| `create_revision_version` RPC | Copy `platform_schedules` from parent |
| `get_post_by_token` RPC | Add `platform_schedules` to SELECT |
| `src/api/posts.js` | Update `createDraftPost`, `updatePost`, `fetchAllPostsByClient`, add `markPlatformAsPublished` |
| `src/pages/posts/DraftPostForm.jsx` | Per-platform scheduling toggle + pickers |
| `src/pages/posts/postDetails/PostDetails.jsx` | Per-platform publish mutations |
| `src/pages/posts/postDetails/PostContent.jsx` | Per-platform schedule + publish status display |
| `src/pages/posts/postDetails/PostActionDialogs.jsx` | Per-platform publish confirmation dialog |
| `src/pages/PublicReview.jsx` | Display per-platform schedule |
| `supabase/functions/` | New or extended edge function for per-platform publish email |

---

## Database Schema

### Migration: Add column

```sql
ALTER TABLE post_versions
ADD COLUMN platform_schedules jsonb DEFAULT NULL;

COMMENT ON COLUMN post_versions.platform_schedules IS
'Per-platform scheduling: { platform: { scheduled_at: timestamptz, published_at: timestamptz | null } }. NULL = single target_date mode.';
```

### Update `create_post_draft_v3` RPC

Add parameter and include in INSERT:

```sql
-- Add to function signature:
p_platform_schedules jsonb DEFAULT NULL

-- Add to INSERT column list:
platform_schedules

-- Add to VALUES:
p_platform_schedules
```

Full updated INSERT in the RPC:
```sql
INSERT INTO public.post_versions (
    post_id, client_id, version_number, status, content,
    media_urls, platform, created_by, title,
    target_date, admin_notes, platform_schedules
)
VALUES (
    v_post_id, p_client_id, 1, 'DRAFT', p_content,
    p_media_urls, p_platform, p_user_id, p_title,
    p_target_date, p_admin_notes, p_platform_schedules
)
```

### Update `create_revision_version` RPC

Add `platform_schedules` to the explicit INSERT so it copies forward from the parent version:

```sql
-- In INSERT column list, add:
platform_schedules

-- In VALUES, add:
v_old_version_record.platform_schedules
```

### Update `get_post_by_token` RPC

Add `platform_schedules` to the SELECT so the public review page can display per-platform dates.
> Check actual RPC source before applying — add `pv.platform_schedules` to the SELECT list.

---

## App-Layer Helpers

Add to `src/lib/helper.js`:

```js
/**
 * Derives a display-level publish state from a post version.
 * Returns the DB status for single-date posts.
 * Returns 'PARTIALLY_PUBLISHED' (UI-only) when some but not all platforms are published.
 */
export function getPublishState(version) {
  if (!version?.platform_schedules) return version?.status
  const entries = Object.values(version.platform_schedules)
  if (!entries.length) return version.status
  const publishedCount = entries.filter((e) => e.published_at).length
  if (publishedCount === 0) return version.status
  if (publishedCount === entries.length) return 'PUBLISHED'
  return 'PARTIALLY_PUBLISHED'
}

/**
 * Returns the effective scheduled_at for a given platform.
 * Falls back to target_date when platform_schedules is absent.
 */
export function effectivePlatformDate(version, platform) {
  return version?.platform_schedules?.[platform]?.scheduled_at ?? version?.target_date
}
```

---

## Phase Breakdown

---

## ✅ Phase 1 — DB Migration & API Foundation

**Goal**: Add the JSONB column and update RPCs + API functions. Zero UI changes. All existing posts and workflows work identically after this phase.

### DB changes
- [x] Run migration: `ALTER TABLE post_versions ADD COLUMN platform_schedules jsonb DEFAULT NULL`
- [x] Update `create_post_draft_v3` RPC: add `p_platform_schedules jsonb DEFAULT NULL` parameter, include in INSERT column list and VALUES
- [x] Update `create_revision_version` RPC (newer version — uses `SELECT * INTO v_old_version_record`): add `platform_schedules` to INSERT column list + `v_old_version_record.platform_schedules` to VALUES
- [x] Update `get_post_by_token` RPC: add `platform_schedules` to SELECT

### API layer (`src/api/posts.js`)
- [x] `createDraftPost()`: add optional `platformSchedules` param; pass as `p_platform_schedules: platformSchedules ?? null` to RPC
- [x] `updatePost()`: add optional `platformSchedules` param; include `platform_schedules` in the Supabase `.update({})` call
- [x] `fetchAllPostsByClient()`: add `platform_schedules` to the PostgREST select inside `post_versions!fk_current_version (...)`
- [x] Add `getPublishState` and `effectivePlatformDate` helpers to `src/lib/helper.js`

### Verification
- [x] Existing post creation works (no regression — `p_platform_schedules` defaults to null)
- [x] Existing post edit works (platform_schedules not touched if not passed)
- [x] Revision creation copies `platform_schedules` (confirmed by reading new version row)
- [x] `fetchAllPostsByClient` returns `platform_schedules` field (null for existing posts)

### Implementation Notes
- All DB changes applied directly via Supabase MCP
- `createDraftPost` and `updatePost` both default `platformSchedules` to `null` when not passed — zero regression for existing callers
- `getPublishState` and `effectivePlatformDate` added to `src/lib/helper.js` as named exports

---

## ✅ Phase 2 — DraftPostForm: Per-Platform Scheduling UI

**Goal**: Agency can optionally set independent schedule dates per platform inside the create/edit draft dialog.

### UI design

The current date/time picker area (`grid grid-cols-2 gap-4`) is extended:

**Mode off (default — single date):**
```
[Proposed Schedule Date *]   [Time *]
                                             [☐ Schedule each platform separately]
```

**Mode on — after checking the toggle:**
```
[☐ Schedule each platform separately] ← active

Per-platform schedule:
  Instagram    [Mar 10, 2025]  [09:00]
  Facebook     [Mar 10, 2025]  [14:00]
  LinkedIn     [Mar 11, 2025]  [08:30]

Target date auto-set to: Mar 10, 2025 (earliest)
```

Rules:
- Only platforms currently selected in the platform picker appear in the per-platform list
- When a platform is added/removed from the platform selector, the per-platform rows update live
- `target_date` is the minimum of all per-platform `scheduled_at` values — auto-computed, not user-editable when per-platform mode is on
- Per-platform mode requires all rows to have a date+time before submit (Zod validation)
- When toggling off: `platform_schedules` is cleared, `target_date` returns to manual input

### Form schema extension

```js
// Add to formSchema in DraftPostForm:
platform_schedules: z.record(
  z.object({
    scheduled_at: z.date(),
  })
).optional().nullable(),
per_platform_mode: z.boolean().default(false),
```

### State / logic
- `perPlatformMode` boolean state (not part of form values — UI toggle only)
- `platformSchedules` state: `{ [platformId]: { date: Date | null, time: string } }`
- On `perPlatformMode` toggle ON: pre-fill each selected platform with current `target_date` value
- On `perPlatformMode` toggle OFF: clear `platform_schedules`, restore manual `target_date` picker

### Payload changes
```js
// In mutation mutationFn, pass to createDraftPost/updatePost:
platformSchedules: perPlatformMode
  ? buildPlatformSchedulesPayload(platformSchedulesState)
  : null

// Helper:
function buildPlatformSchedulesPayload(state) {
  return Object.fromEntries(
    Object.entries(state).map(([platform, { date, time }]) => {
      const [hours, minutes] = time.split(':').map(Number)
      const dt = setMinutes(setHours(date, hours), minutes)
      return [platform, { scheduled_at: dt.toISOString(), published_at: null }]
    })
  )
}
```

### Edit mode population
When `initialData.platform_schedules` is set:
- Auto-enable `perPlatformMode = true`
- Populate `platformSchedulesState` from the JSONB
- Disable the toggle (can't switch back to single-date without clearing)

### Checklist
- [x] Per-platform toggle renders below the date/time row
- [x] Per-platform rows appear only for selected platforms
- [x] Rows update when platforms are added/removed
- [x] `target_date` auto-computes to min of all platform dates in per-platform mode
- [x] Per-platform mode: all rows required before submit (onSubmit guard + toast)
- [x] Edit mode: existing `platform_schedules` populates the rows correctly
- [x] Payload `platformSchedules` passes through `createDraftPost` → RPC correctly
- [x] Payload `platformSchedules` passes through `updatePost` → Supabase update correctly
- [x] Single-date mode: existing behaviour completely unchanged

### Implementation Notes
- Per-platform state managed outside react-hook-form (`perPlatformMode` + `platformSchedulesState`) — keeps Zod schema clean
- `target_date` field auto-computed via `useEffect` watching `platformSchedulesState`; platform sync uses `.join(',')` string dep to avoid stale array reference re-runs
- Toggle only visible when ≥1 platform is selected
- Edit mode: `platform_schedules` presence auto-enables perPlatformMode and pre-fills rows; absence resets state cleanly

---

## ✅ Phase 3 — PostContent & PostDetails: Schedule Display + Per-Platform Publish

**Goal**: When a post has `platform_schedules`, show per-platform dates in PostContent and replace the single "Publish Now" button with per-platform publish actions.

### PostContent — schedule display

In the header meta row (current: single `target_date` badge), extend to show platform breakdown:

**Single-date post (platform_schedules = null):** unchanged

**Per-platform post (platform_schedules set):**
```
Scheduled:
  Instagram   Mar 10, 9:00am   [✓ Published]
  Facebook    Mar 10, 2:00pm   [Publish]
  LinkedIn    Mar 11, 8:30am   [Publish]
```

Each platform row shows:
- Platform icon + name
- `scheduled_at` date/time formatted via `format(date, 'dd MMM, p')`
- If `published_at` is set: green `✓ Published` badge + `published_at` timestamp
- If `published_at` is null: "Publish" button (triggers `markPlatformAsPublished`)

### PostContent — "Publish Now" button replacement

- Single-date post: "Publish Now" button unchanged → opens existing `isPublishConfirmOpen` dialog
- Per-platform post: "Publish Now" button replaced by "Publish [Platform]" buttons inline in the schedule grid, OR a "Publish Next" button that targets the earliest unpublished platform

### PostDetails — per-platform publish mutation

New mutation `markPlatformAsPublishedMutation`:

```js
const markPlatformAsPublishedMutation = useMutation({
  mutationFn: async ({ versionId, platform }) => {
    // 1. Get current platform_schedules
    const current = post.platform_schedules
    const updated = {
      ...current,
      [platform]: { ...current[platform], published_at: new Date().toISOString() }
    }

    // 2. Check if ALL platforms now published
    const allPublished = Object.values(updated).every(v => v.published_at)

    // 3. Build update payload
    const patch = {
      platform_schedules: updated,
      ...(allPublished && {
        status: 'PUBLISHED',
        published_at: new Date().toISOString(),
      })
    }

    const { error } = await supabase
      .from('post_versions')
      .update(patch)
      .eq('id', versionId)
    if (error) throw error

    return { platform, allPublished }
  },
  onSuccess: ({ platform, allPublished }) => {
    queryClient.invalidateQueries({ queryKey: ['post-version', postId] })
    if (allPublished) {
      toast.success('All platforms published — post marked as Published')
    } else {
      toast.success(`${PLATFORM_CONFIG[platform]?.label ?? platform} marked as published`)
    }
  },
  onError: (err) => toast.error(err.message),
})
```

Wire `markPlatformAsPublishedMutation` into `PostContent` as a new `onPublishPlatform(platform)` prop.

### PostActionDialogs — per-platform publish confirmation

Add a new dialog `isPlatformPublishConfirmOpen` that:
- Shows which platform is being confirmed
- Shows the `scheduled_at` date as a reminder
- Confirms the irreversible action

For single-platform publishes inside a per-platform post (not yet all done), use a lighter confirmation toast-style instead of a heavy dialog.

### Checklist
- [x] `PostContent` displays per-platform schedule grid when `platform_schedules` is set
- [x] Per-platform schedule grid shows publish state per platform (published ✓ or Publish button)
- [x] Clicking Publish on a platform triggers `markPlatformAsPublishedMutation`
- [x] When all platforms published: status → PUBLISHED, `published_at` set
- [x] Single-date posts: "Publish Now" button and flow completely unchanged
- [x] `getPublishState()` helper used for derived display state in PostContent
- [x] `PARTIALLY_PUBLISHED` display state shows correctly (some done, some pending)
- [x] Published_at shown correctly in PostContent header when status = PUBLISHED

### Implementation Notes
- `PARTIALLY_PUBLISHED` added to `StatusBadge.jsx` with emerald colour scheme
- `PostActionDialogs` Approve & Schedule dialog updated for Phase 6 scope (per-platform summary) — done here since it's a prerequisite for the mutation branch
- Per-platform Publish buttons fire directly without a confirm dialog (toast-style per feature doc); single-date "Publish Now" still uses the existing heavy dialog
- `markPlatformAsPublishedMutation` in PostDetails builds the full updated JSONB client-side and writes it atomically

---

## Phase 4 — PublicReview: Display Per-Platform Schedule

**Goal**: When a post has per-platform schedules, the public review page shows them clearly. Approval action unchanged.

### Changes to `PublicReview.jsx`

The existing schedule display (line ~247):
```jsx
{post.target_date && (
  <div className="flex items-center gap-2 font-semibold text-primary">
    <Clock size={14} />
    <span>Schedule: {format(new Date(post.target_date), 'MMM dd @ p')}</span>
  </div>
)}
```

Extend to show per-platform breakdown when `post.platform_schedules` is set:

```jsx
{post.platform_schedules ? (
  <div className="space-y-1.5">
    <p className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider">
      Planned Schedule
    </p>
    {Object.entries(post.platform_schedules).map(([platform, { scheduled_at }]) => (
      <div key={platform} className="flex items-center gap-2 text-sm font-semibold text-primary">
        <Clock size={13} />
        <span className="capitalize">{platform.replace('_', ' ')}:</span>
        <span>{format(new Date(scheduled_at), 'MMM dd @ p')}</span>
      </div>
    ))}
  </div>
) : post.target_date ? (
  // existing single-date display
) : null}
```

The approval summary dialog (post summary box, lines ~304–316) should also show per-platform dates when set, instead of a single date.

The confirmation screen (after approve, line ~168) should show "All scheduled" with the earliest date.

### Approval action — no change
`handleStatusUpdate('APPROVED')` → `update_post_status_by_token` RPC → `SCHEDULED`. No change needed. The JSONB is already set from DraftPostForm.

### Checklist
- [x] `get_post_by_token` RPC returns `platform_schedules` field (Phase 1 prerequisite)
- [x] Single-date posts: public review page unchanged
- [x] Per-platform posts: platform schedule grid displayed in meta row
- [x] Approval confirm dialog shows per-platform dates in post summary box
- [x] Post-approval confirmation screen shows platform count instead of single date
- [x] Approval action itself unchanged — no new logic needed

### Implementation Notes
- Per-platform schedule replaces the single `target_date` badge in the meta row using `Object.entries(post.platform_schedules)`
- Approval dialog summary conditionally renders per-platform rows vs single-date line
- Confirmation screen shows "across N platform(s)" for per-platform posts; falls back to `target_date` for single-date posts

---

## Phase 5 — Email Notifications: Per-Platform Publish Emails

**Goal**: When a platform is marked published, send the client a "Your [Platform] post is live" email. When all platforms are published, send "All your posts are now live."

### New edge function (or extend existing)

Create `supabase/functions/send-platform-published-email/`:

Called from the app layer in `markPlatformAsPublishedMutation.onSuccess`:

```js
// Per-platform publish email
await supabase.functions.invoke('send-platform-published-email', {
  body: {
    post_version_id: versionId,
    platform,
    all_published: allPublished,
  },
})
```

Function fetches post + client + agency branding, then sends:
- **Per-platform**: "Your [ClientName] [Instagram] post is now live — [PostTitle]"
- **All published**: "All [ClientName] posts for [PostTitle] are now live"

For single-date posts: existing email flow unchanged — do not call this function.

### When called
Only called from `markPlatformAsPublishedMutation`. The existing "Publish Now" flow for single-date posts uses the existing email mechanism (if any) — do not change it.

### Checklist
- [x] Edge function created and deployed (`send-platform-published-email`, function ID `560b80f4`)
- [x] Per-platform publish email sent on each platform publish
- [x] All-published email sent when `allPublished = true` (not both — guard against double-email)
- [x] Single-date post publish: existing email behaviour unchanged (separate flow)
- [x] Internal clients skipped (no self-notification)

### Implementation Notes
- Edge function guards against double-send: `all_published = true` path checks DB `status === 'PUBLISHED'` before sending
- Called fire-and-forget from `markPlatformAsPublishedMutation.onSuccess` — email failure doesn't affect UI
- `versionId` added to mutation return value to pass to the edge function invocation
- Internal clients (`is_internal = true`) are skipped in the function body

---

## Phase 6 — PostDetails: "Approve & Schedule" Dialog — Per-Platform Awareness

**Goal**: When approving+scheduling an internal post that has `platform_schedules`, show the per-platform dates for confirmation rather than a single date picker.

### Current flow (internal posts)
Agency clicks "Approve & Schedule" → dialog asks to pick or confirm a single publish date → `status = SCHEDULED, target_date = chosen date`.

### Updated flow for per-platform posts
If `post.platform_schedules` is set:
- Skip the date picker UI
- Show a read-only per-platform schedule summary
- "Confirm Schedule" just transitions `status = SCHEDULED` (dates already stored in JSONB)

If `post.platform_schedules` is null:
- Existing single-date picker behaviour completely unchanged

### Changes
In `PostActionDialogs.jsx` — the "Approve & Schedule" dialog:
```jsx
{post.platform_schedules ? (
  // Read-only per-platform date summary
  <div className="space-y-2 py-2">
    {Object.entries(post.platform_schedules).map(([platform, { scheduled_at }]) => (
      <div key={platform} className="flex justify-between text-sm">
        <span className="capitalize font-medium">{platform.replace('_', ' ')}</span>
        <span className="text-muted-foreground">{format(new Date(scheduled_at), 'PPP @ p')}</span>
      </div>
    ))}
  </div>
) : (
  // Existing date picker
)}
```

In `PostDetails.jsx` — `approveAndScheduleMutation`:
```js
mutationFn: async (versionId) => {
  if (post.platform_schedules) {
    // No date needed — just transition status
    const { error } = await supabase
      .from('post_versions')
      .update({ status: 'SCHEDULED' })
      .eq('id', versionId)
    if (error) throw error
  } else {
    // Existing single-date flow
    if (!approveDate) throw new Error('Please select a publish date.')
    const { error } = await supabase
      .from('post_versions')
      .update({ status: 'SCHEDULED', target_date: approveDate.toISOString() })
      .eq('id', versionId)
    if (error) throw error
  }
}
```

### Checklist
- [ ] Internal single-date approve & schedule: completely unchanged
- [ ] Internal per-platform post: date picker replaced by read-only schedule summary
- [ ] "Confirm Schedule" on per-platform post transitions status to SCHEDULED only
- [ ] Dialog text updated to reflect "schedule is already set per-platform"

---

## Implementation Notes

_To be filled in as each phase is completed._

---

## Build Order & Dependencies

```
Phase 1 (DB + API)          ← Start here. Zero UI changes. Verified by DB query.
    ↓
Phase 2 (DraftPostForm UI)  ← Requires Phase 1 (API functions updated)
    ↓
Phase 3 (PostDetails)       ← Requires Phase 1 (platform_schedules in post data)
    ↓
Phase 4 (PublicReview)      ← Requires Phase 1 (RPC updated to return field)
    ↓
Phase 5 (Emails)            ← Requires Phase 3 (markPlatformAsPublished mutation exists)
    ↓
Phase 6 (Approve dialog)    ← Requires Phase 3 (per-platform data flow established)
```

Phases 3 and 4 can run in parallel after Phase 2. Phase 5 and 6 can run in parallel after Phase 3.

---

## Risk Register

| Risk | Mitigation |
|------|-----------|
| `create_revision_version` has two versions in DB (old + new overload) | Confirm live function signature before updating. The newer one uses `SELECT * INTO record` — target that one. |
| `get_post_by_token` RPC not checked — may have explicit column list | Read actual RPC source before Phase 4 — add `platform_schedules` to its SELECT |
| Per-platform dates and `target_date` drift | `target_date` = min of platform dates — enforced in DraftPostForm at save time, not DB-level |
| All-published check runs client-side | Acceptable for Phase 3/5 MVP. Could move to Postgres trigger in future if needed. |
| Double "all published" email if mutation fires twice | Guard in edge function: check if `post_versions.status` is already `PUBLISHED` before sending all-done email |
