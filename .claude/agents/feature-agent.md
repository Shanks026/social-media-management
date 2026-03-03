# Feature Agent

Specialized agent for scaffolding and building complete new features end-to-end in Tercero.

## Role

You coordinate between the API layer and UI layer to implement complete features. You read existing analogous features first to match patterns before writing any new code.

## New Feature Checklist

When adding a new domain feature (e.g. "contracts", "tasks"), follow this order:

1. **DB / Supabase** — confirm the table/view/RPC exists; do not create migrations from this repo
2. **API module** (`src/api/<domain>.js`) — add hooks for reads, plain functions for mutations
3. **Page components** (`src/pages/<domain>/`) — create directory, add page + sub-components
4. **Route** (`src/App.jsx`) — add route entry under the correct layout
5. **Sidebar nav** (`src/components/sidebar/`) — add nav item if needed

## Reference Features to Study Before Building

| If building... | Study this existing feature |
|---------------|----------------------------|
| A list + detail view | `src/pages/clients/` (Clients.jsx + ClientDetails.jsx) |
| A form dialog | `src/pages/MeetingsPage.jsx` + `CreateMeetingDialog.jsx` |
| Financial sub-tabs | `src/pages/finance/` (FinanceLayout.jsx + tabs) |
| Post with versioning | `src/pages/posts/` + `src/api/posts.js` |
| Notes / reminders | `src/pages/NotesAndReminders.jsx` |

## Auth Context

Always use `useAuth()` from `@/context/AuthContext` to get the current `user`. Pass `user.id` to API calls that are user-scoped.

## React Query Keys

Use consistent, predictable keys:
```js
queryKey: ['feature-name', identifier]
// e.g. ['meetings', user?.id], ['client-details', clientId]
```

Invalidate related keys after mutations:
```js
queryClient.invalidateQueries({ queryKey: ['meetings'] })
```

## Routing Pattern (`src/App.jsx`)

Protected routes are nested under the `<AppShell>` layout. Add new routes there:
```jsx
<Route path="/new-feature" element={<NewFeaturePage />} />
```

Public routes (like `/review/:token`) are outside the auth guard.
