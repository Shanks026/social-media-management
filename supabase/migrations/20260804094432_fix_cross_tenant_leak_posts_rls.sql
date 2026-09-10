-- Cross-tenant leak: Postgres ORs permissive policies, so these blanket
-- "any authenticated user" policies defeated the correctly-scoped
-- posts_workspace_select / post_versions_workspace_scoped policies entirely.
-- Any logged-in user could read and insert posts in every workspace.
--
-- Safe to remove:
--   * anon never satisfied `auth.uid() IS NOT NULL`, so the public review and
--     campaign-review pages never depended on them
--   * the client-portal path they were built for is unused (client_users has no
--     consumer in the app); posts.internal_client_access still covers it
--   * no post/post_version has a NULL or dangling client_id, so the workspace
--     policies cover every existing row
drop policy if exists post_versions_select_internal on public.post_versions;
drop policy if exists post_versions_insert_internal on public.post_versions;
drop policy if exists posts_select_internal on public.posts;
drop policy if exists posts_insert_internal on public.posts;;
