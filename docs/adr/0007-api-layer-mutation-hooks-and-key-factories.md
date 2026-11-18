# `src/api` owns every query, mutation and cache key; components only call its hooks

Each mutation is a plain exported async function (`createCampaign(payload)`), wrapped by a `useCreateCampaign()` hook in the same `src/api` module. The hook owns the `onSuccess` cache invalidation. Reads are `useXxx()` hooks in `src/api`. Each module exports a query-key factory (`campaignKeys.all / list(workspaceId, filters) / detail(id)`) that its hooks and every invalidation use, never inline arrays. Workspace-scoped keys take `workspaceUserId`, never `user.id`.

This supersedes the old rule that forbade mutation hooks in `src/api`. That rule had already been abandoned in practice: 40 hooks existed, and 45 caller files called `invalidateQueries` themselves, so knowing what to refresh after a change was spread across the UI. We kept the plain function underneath rather than inlining `mutationFn` in the hook. That way it stays the test surface and can be called outside React (realtime handlers, scripts). Key factories are per module, not in one central file, because the invalidations that use them now live in the same module.

## Consequences

- Components, pages and `src/hooks` never call `useQuery`/`useMutation` directly or import `@/lib/supabase`. An ESLint `no-restricted-imports` rule enforces this. It starts as a warning and becomes an error once the existing call sites have moved.
- Cross-domain invalidation imports the other module's key factory (e.g. creating an invoice invalidates `financeKeys.all`).
- `useMemberMap()` (owner + members + self) moves to `team.js` as the single member-lookup hook. `useTeamMembers()` stays for the Team page's list.
- `.claude/rules/api-conventions.md` is rewritten to match.
