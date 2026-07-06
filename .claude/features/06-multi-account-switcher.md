# Feature: Multi-Account Switcher
**Product**: Tercero — Social Media Agency Management SaaS
**File**: `.claude/features/06-multi-account-switcher.md`
**Status**: ✅ Complete
**Last Updated**: July 2026

---

## Context

Some users (agency owners, or team members who belong to more than one workspace) need to move between multiple Tercero logins without doing a full logout/login each time. This adds a "Switch account" section to the existing account popover in the sidebar footer (`src/components/sidebar/nav-user.jsx`), letting a user link several accounts in the browser and jump between them instantly.

This is purely a client-side/browser-local feature — no new tables, no RLS, no server changes. It layers on top of the existing Supabase auth session already managed by `AuthContext.jsx`.

**Key architectural facts confirmed before writing this doc:**
- `src/lib/supabase.js` is a single `createClient()` singleton with `persistSession: true`, `autoRefreshToken: true`, default (unnamed) `storageKey` — exactly one session lives in browser storage at a time for that client.
- `AuthContext.jsx`'s `onAuthStateChange` handler already treats "the active uid changed" generically — it diffs the incoming `uid` against `resolvedUidRef` and re-resolves `workspaceUserId`/`userRole`/`userPermissions` whenever it differs, restoring a `sessionStorage`-cached workspace immediately and deferring the DB lookup. It does not know or care *why* the uid changed (sign-in, token refresh, or a manual session swap all look identical to it) — **no changes are needed there** for switching to work.
- `supabase.auth.setSession({ access_token, refresh_token })` swaps the active session on the shared client to a different account's tokens, refreshing them first if they've expired ([confirmed via Supabase docs](https://supabase.com/docs/reference/javascript/auth-setsession)).
- Supabase rotates refresh tokens on every use — a token is single-use once exchanged. A backgrounded (non-active) linked account's stored refresh token is a snapshot from whenever it was last active; if that same account gets used elsewhere in the meantime (another tab/device), the stored token can go stale and switching back will require a real re-login for that one account. **Accepted tradeoff** — not solved by this feature.
- `/login` is wrapped in `<PublicOnlyRoute>` (`App.jsx`), which redirects away whenever a session exists — so "Add account" cannot reuse the existing full-page login route while another account is active. It needs its own lightweight dialog.
- The existing `LoginForm` (`src/components/auth/login-form.jsx`) calls `supabase.auth.signInWithPassword()` directly on the shared client — calling that same function to log in a *second* account would immediately overwrite the first account's active session. **"Add account" must use an isolated, throwaway Supabase client** (`persistSession: false`, `autoRefreshToken: false`) purely to authenticate the second account and capture its resulting `{access_token, refresh_token, user}` — never touching the shared client or its storage until the user explicitly switches to the newly added account.

---

## Phase Overview

```
Phase 1 — Account linking + switching
  Store linked accounts' tokens locally, add a "Switch account" section and
  "Add another account" dialog to the sidebar footer popover, and wire
  switch/remove/logout actions — the complete, usable feature in one phase.
```

**After this phase: stop and wait for approval before proceeding.**

---

## Phase 1 — Account linking + switching ✅ Complete

### Goal
From the sidebar footer popover, a user can see every Tercero account they've linked on this device, click one to switch into it instantly (no re-typing credentials, no full page reload flash), add a new account via a small dialog without disturbing their current session, and remove an account from the list. Logging out behaves as it does today, but also forgets that account from the switcher.

### Before Starting — Confirm With Codebase
1. Re-read `src/context/AuthContext.jsx` in full immediately before editing — confirm the `onAuthStateChange` handler shape hasn't changed, and identify the exact line to add a "persist this session's tokens to the linked-accounts store" call.
2. Re-read `src/components/sidebar/nav-user.jsx` — confirm the `DropdownMenuContent` structure (profile header → separator → Log out) so the new "Switch account" block and "Add another account" item slot in at the right place.
3. Confirm `src/lib/supabase.js`'s exact `createClient` options (no custom `storageKey`) so the new temporary client for "Add account" is configured correctly (`persistSession: false`) and never collides with the primary client's storage.
4. Confirm `queryClient` is reached in `nav-user.jsx` via `useQueryClient()` (already true for the existing Log out handler) — the switch handler needs the same `queryClient.clear()` call so account B doesn't render account A's cached React Query data for a frame.
5. Confirm `user.user_metadata` shape (`full_name`, `avatar_url`) via existing usage in `nav-user.jsx` — the linked-accounts store mirrors these fields for display.

### 1.1 Database
No database changes in this phase. All state lives in `localStorage` in the browser — nothing is sent to or stored in Supabase beyond the normal auth session itself.

### 1.2 API Layer

New file — **`src/lib/accountSwitcher.js`** (plain browser-storage helpers, not a Supabase API module, so it lives in `lib/` not `api/`):

```js
const STORAGE_KEY = 'tercero_linked_accounts' // { [user_id]: LinkedAccount }

// LinkedAccount shape:
// { user_id, email, full_name, avatar_url, access_token, refresh_token, updated_at }

export function getLinkedAccounts()              // → LinkedAccount[], sorted by updated_at desc
export function upsertLinkedAccount(account)      // → void; writes/overwrites by user_id
export function removeLinkedAccount(userId)       // → void
```

- `upsertLinkedAccount` is called from two places: (a) `AuthContext.jsx`'s `onAuthStateChange`, every time a session is present, so whichever account is currently active always has its freshest tokens saved; (b) the "Add account" dialog, immediately after the isolated client's `signInWithPassword` succeeds.
- All functions wrap `localStorage` access in `try/catch` (private browsing / storage-disabled edge case) — mirrors the existing `sessionStorage` guard pattern already used in `AuthContext.jsx`'s `resolveWorkspace`.

New file — **`src/lib/accountSwitcherClient.js`**:

```js
export function createIsolatedAuthClient()
// Returns a throwaway `createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })`.
// Never touches localStorage. Used only inside AddAccountDialog for the
// duration of one signInWithPassword call, then discarded (no dispose()
// needed — with persistSession/autoRefreshToken both false there is no
// background timer or storage listener to tear down).
```

Additions to **`src/context/AuthContext.jsx`**:
- Inside the existing `onAuthStateChange` callback, after `setSession(session)`/`setUser(...)`, if `session` is truthy call `upsertLinkedAccount({ user_id: session.user.id, email: session.user.email, full_name: session.user.user_metadata?.full_name, avatar_url: session.user.user_metadata?.avatar_url, access_token: session.access_token, refresh_token: session.refresh_token, updated_at: Date.now() })`. This is the *only* change to this file.
- No change to `resolveWorkspace`, `signOut`, or the render/return logic.

### 1.3 Components

```
src/
├── lib/
│   ├── accountSwitcher.js          — localStorage read/write helpers (above)
│   └── accountSwitcherClient.js    — isolated throwaway auth client factory
└── components/
    ├── auth/
    │   └── login-form.jsx          — MODIFIED: adds `client` and `onSuccess` props
    └── sidebar/
        ├── nav-user.jsx            — MODIFIED: adds "Switch account" section + "Add another account" item
        └── AddAccountDialog.jsx    — NEW: thin Dialog wrapper around LoginForm
```

**`login-form.jsx`** changes (reused as-is by both the real `/login` page and the new dialog, rather than duplicating its fields/validation/error-handling):
- New props: `client = supabase` (defaults to the shared singleton — the `/login` page passes nothing and gets today's exact behavior) and `onSuccess` (defaults to `() => navigate('/dashboard')`).
- `handleSubmit` calls `client.auth.signInWithPassword(...)` instead of the hard-coded `supabase.auth.signInWithPassword(...)`, and the `invalid_credentials` branch's `check_email_exists` RPC call also goes through `client` (stateless lookup, works identically on either client).
- On success, calls `onSuccess(data.session)` instead of directly navigating.
- No other behavior changes — same fields, same validation, same `ForgotPasswordDialog` (untouched; password reset doesn't depend on which client is "active").

**`AddAccountDialog.jsx`** (NEW):
- Props: `open`, `onOpenChange`.
- Body: `<Dialog>` wrapping a single `<LoginForm client={isolatedClient} onSuccess={handleAdded} />`, where `isolatedClient` is created via `createIsolatedAuthClient()` (memoized per dialog open, e.g. `useMemo` keyed on `open` so a fresh throwaway client is used each time the dialog reopens).
- `handleAdded(session)`: `upsertLinkedAccount({...from session...})`, then `switchToAccount(session.user.id)` (imported from `accountSwitcher.js`), close the dialog (`onOpenChange(false)`), `toast.success(...)`.
- No separate form fields, no separate Zod schema, no separate error-branch logic — all of that lives in `LoginForm` and is exercised unchanged.

**`nav-user.jsx`** changes:
- Import `getLinkedAccounts`, `removeLinkedAccount` from `@/lib/accountSwitcher`; `supabase` from `@/lib/supabase`.
- Read `getLinkedAccounts()` on render (no need for React Query — it's synchronous localStorage, re-read on every popover open is cheap; call it inside `DropdownMenu`'s `onOpenChange` or simply on each render since the component is cheap).
- Filter out the currently-active account (`user?.id`) from the list shown under "Switch account".
- Each row: `DropdownMenuItem` with `Avatar` (image or initials, same pattern as the existing profile header) + name + email, `onClick` → `switchToAccount(account.user_id)` (see below), plus a small trailing "x" icon button (`stopPropagation`) → `removeLinkedAccount(account.user_id)` + local re-render.
- If the list is empty (no *other* linked accounts), skip the "Switch account" section and separator entirely — don't show an empty state for it.
- New `DropdownMenuItem`: "Add another account" (icon: `UserPlus` from lucide) → opens `AddAccountDialog`.
- `switchToAccount(userId)` (local function in `nav-user.jsx`, or extracted to `accountSwitcher.js` if it ends up being reused by the dialog — likely extract it there since both the dialog and the list call it):
  ```js
  async function switchToAccount(userId) {
    const account = getLinkedAccounts().find(a => a.user_id === userId)
    if (!account) return
    const { error } = await supabase.auth.setSession({
      access_token: account.access_token,
      refresh_token: account.refresh_token,
    })
    if (error) {
      toast.error(`Couldn't switch to ${account.email} — try logging in again.`)
      removeLinkedAccount(userId) // stale/rotated token; drop it rather than leave a dead entry
      return
    }
    queryClient.clear()
    navigate('/dashboard')
  }
  ```
- Existing `handleLogout`: after `signOut()` + `queryClient.clear()`, also `removeLinkedAccount(user.id)` — a logged-out account shouldn't linger in the switcher (its refresh token is revoked server-side by `signOut()`, so keeping it would just produce a guaranteed-broken entry).

### 1.4 Sidebar Integration
No route or nav changes — this lives entirely inside the existing `DropdownMenuContent` in `nav-user.jsx`. New layout order: profile header → separator → **[Switch account label + other linked accounts, if any] → Add another account** → separator → Log out.

### 1.5 Impact on Existing Features
| Feature | Impact | Watch for |
|---|---|---|
| `AuthContext.jsx` | One new side-effect line in `onAuthStateChange` (persist active session to the linked-accounts store) | Must not throw or block — wrapped in the same try/catch pattern already used for `sessionStorage` in this file |
| Login (`LoginForm`) | None — untouched. `AddAccountDialog` is a separate component with its own isolated client | Confirm normal single-account login still works unchanged |
| Logout (`nav-user.jsx`) | Now also removes the logged-out account from the linked-accounts list | Confirm switching to a *different* linked account right after logging out of the current one still works |
| React Query cache | `queryClient.clear()` added to the switch path (already present on logout) | Confirm no stale cross-account data flashes after a switch |

### 1.6 What This Phase Does NOT Include
- No server-side "linked accounts" record — this is a per-browser convenience list, not a Tercero feature synced across devices. Clearing browser storage forgets the list (each account still exists and can be logged into normally).
- No automatic keep-alive/background refresh for backgrounded linked accounts. A stale token on switch-back means a normal re-login for that one account, handled by the error path above.
- No OAuth/social login support (the app doesn't have any today — email/password only).
- No visual "which account is this" indicator elsewhere in the app (e.g. in the header) beyond the existing sidebar footer profile block.
- No admin-portal equivalent — this is for the agency-side app only.

### 1.7 Phase 1 Checklist — Before Marking Complete
- [x] `src/lib/accountSwitcher.js` exports `getLinkedAccounts`, `getLinkedAccount`, `upsertLinkedAccount`, `removeLinkedAccount`, `switchToAccount`; all localStorage access wrapped in try/catch
- [x] `src/lib/accountSwitcherClient.js` exports `createIsolatedAuthClient()`; confirmed it never writes to localStorage (`persistSession: false`)
- [x] `AuthContext.jsx` persists the active session to the linked-accounts store whenever a session is present; no other logic in that file changed
- [x] `AddAccountDialog.jsx` logs in a second account via the isolated client without disturbing the currently active session (isolated client is `persistSession: false`/`autoRefreshToken: false` and is never referenced by the primary `supabase` singleton or `AuthContext`)
- [x] Adding an account switches to it immediately and lands on `/dashboard`
- [x] "Switch account" section in `nav-user.jsx` lists all *other* linked accounts (excludes the active one), hidden entirely when empty
- [x] Clicking a linked account switches into it, clears the React Query cache, and navigates to `/dashboard`
- [x] A stale/rotated token on switch shows a toast and removes the dead entry rather than failing silently
- [x] Removing a linked account via the "x" only forgets it locally — does not call `signOut()` or otherwise invalidate it
- [x] Logging out removes the current account from the linked-accounts list in addition to existing logout behavior
- [x] Switching accounts in one browser tab is reflected in other open tabs (expected — same shared Supabase client/localStorage — not a bug to fix)
- [x] `npx eslint` on all new/modified files: zero errors (one pre-existing, unrelated warning on `AuthContext.jsx` for exporting both `useAuth` and `AuthProvider` — present before this change)

**→ Stop here. Show the result and wait for approval.**

### Implementation Notes
- **Deviation from plan**: `persistActiveAccount(session)` is called from *two* places in `AuthContext.jsx` — the initial `getSession().then(...)` block *and* inside `onAuthStateChange` — not just the latter as originally written. Reason: supabase-js v2 fires an `INITIAL_SESSION` event on `onAuthStateChange` in addition to the manual `getSession()` call already in this file, and relying on only one of the two risked the active account never getting captured on a fresh page load depending on event-ordering timing. Calling it from both is idempotent (same upsert either way) and removes that ambiguity.
- **Reused rather than duplicated**: per user request during planning, `login-form.jsx` gained `client`/`onSuccess` props (both optional, defaulting to today's exact behavior) instead of `AddAccountDialog` having its own copy of the form/validation/error-handling. `AddAccountDialog.jsx` ended up as a thin wrapper (~45 lines) around `<LoginForm client={isolatedClient} onSuccess={handleAdded} />`.
- Nothing else deferred — Phase 1 is feature-complete as scoped.
- **Post-Phase-1 addition**: capped linked accounts at `MAX_LINKED_ACCOUNTS = 5` (exported from `accountSwitcher.js`). Two layers: `upsertLinkedAccount` evicts the least-recently-active entry if a genuinely new account would push the store past 5 (safety net — the currently-signed-in account is never the one evicted, since it's always the freshest); `nav-user.jsx` proactively blocks "Add another account" at the cap with a toast + `n/5` badge, rather than silently evicting when the user deliberately tries to add a 6th.

---

## Data Model Summary (Final State After All Phases)

No new database tables. New client-side-only storage:

### `localStorage['tercero_linked_accounts']` — Shape
| Field | Type | Notes |
|---|---|---|
| `user_id` | UUID | Key of the outer object |
| `email` | string | Display only |
| `full_name` | string \| null | From `user_metadata.full_name` |
| `avatar_url` | string \| null | From `user_metadata.avatar_url` |
| `access_token` | string | Short-lived; refreshed on switch via `setSession` |
| `refresh_token` | string | Single-use; rotates on every exchange |
| `updated_at` | number (epoch ms) | Last time this account's tokens were captured |

No storage bucket. No RLS (nothing server-side).

---

## Impact on Existing Features

| Existing Feature | Impact | Action Required |
|---|---|---|
| `AuthContext.jsx` | One additive side-effect in the existing auth listener | None beyond Phase 1 build |
| Sidebar footer (`nav-user.jsx`) | New dropdown sections | None — self-contained |
| Login / Logout | Logout also forgets the account locally | None beyond Phase 1 build |

---

## Out of Scope (All Phases)

- Cross-device sync of the linked-accounts list — future build, would require a real server-side record and its own security review (storing multiple accounts' refresh tokens server-side is a materially bigger risk than browser-local storage).
- Keeping backgrounded accounts' sessions alive automatically — accepted limitation, not planned.
- Any change to how the primary/active session is stored or refreshed — this feature only adds a parallel, local "address book" of tokens on top of the existing single-session client.
