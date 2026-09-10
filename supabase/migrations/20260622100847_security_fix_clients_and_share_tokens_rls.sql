-- C2: Drop legacy permissive policies on clients that broke multi-tenant isolation.
-- Keep clients_workspace_scoped (ALL, user_id = get_my_agency_user_id()) and clients_enforce_limit (INSERT).
DROP POLICY IF EXISTS "internal users can view clients"   ON public.clients;
DROP POLICY IF EXISTS "internal users can create clients" ON public.clients;
DROP POLICY IF EXISTS "clients_update_internal"           ON public.clients;
DROP POLICY IF EXISTS "clients_delete_internal"           ON public.clients;

-- C3: Lock down share_tokens. Public review uses SECURITY DEFINER RPCs (which bypass RLS),
-- so anon needs no direct table access. Authenticated users read/write tokens for their own
-- workspace's posts (via post_versions.client_id -> clients.user_id).
ALTER TABLE public.share_tokens ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.share_tokens FROM anon;

DROP POLICY IF EXISTS share_tokens_workspace ON public.share_tokens;
CREATE POLICY share_tokens_workspace ON public.share_tokens
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.post_versions pv
      JOIN public.clients c ON c.id = pv.client_id
      WHERE pv.id = share_tokens.post_version_id
        AND c.user_id = get_my_agency_user_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.post_versions pv
      JOIN public.clients c ON c.id = pv.client_id
      WHERE pv.id = share_tokens.post_version_id
        AND c.user_id = get_my_agency_user_id()
    )
  );;
