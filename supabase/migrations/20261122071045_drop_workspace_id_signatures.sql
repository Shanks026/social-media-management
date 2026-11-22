-- #182 (ADR 0008), the contract step: drop the signatures that took a
-- workspace or user id, now that #180 and #181 are on production and the
-- deployed app calls only the caller-resolving ones. Also drop the no-op
-- storage counters (the storage.objects trigger keeps usage).
--
-- Nothing in the database, src/ or the edge functions calls these any more.
-- Kept on purpose (ADR 0008): is_chat_enabled_for_workspace(uuid), which RLS
-- calls with the row's workspace, and the internal helpers users can't call.

DROP FUNCTION public.get_global_calendar(uuid, timestamp with time zone, timestamp with time zone);
DROP FUNCTION public.get_clients_with_pipeline(uuid, text, text, text, text, text);
DROP FUNCTION public.get_campaigns_with_post_summary(uuid, uuid);
DROP FUNCTION public.get_proposals_with_totals(uuid, uuid);
DROP FUNCTION public.get_team_members(uuid);
DROP FUNCTION public.get_removed_members(uuid);
DROP FUNCTION public.generate_invoice_from_template(uuid, uuid);
DROP FUNCTION public.create_post_draft_v3(uuid, text, text, text[], text[], uuid, timestamp with time zone, text, jsonb, uuid, text);
DROP FUNCTION public.create_revision_version(uuid, uuid, text);
DROP FUNCTION public.increment_storage_used(uuid, bigint);
DROP FUNCTION public.decrement_storage_used(uuid, bigint);

-- None of the user-callable functions left takes a workspace or user id,
-- apart from the RLS helper ADR 0008 keeps and the superadmin console
-- (admin_*), whose parameter names the workspace being administered, not
-- the caller's own; each checks is_superadmin() first.
DO $$
DECLARE
  v text;
BEGIN
  SELECT string_agg(p.oid::regprocedure::text, ', ') INTO v
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND (has_function_privilege('anon', p.oid, 'EXECUTE') OR has_function_privilege('authenticated', p.oid, 'EXECUTE'))
    AND p.proargnames && ARRAY['p_user_id', 'p_agency_user_id', 'p_workspace_id']::text[]
    AND p.proname <> 'is_chat_enabled_for_workspace'
    AND p.proname NOT LIKE 'admin\_%';
  IF v IS NOT NULL THEN
    RAISE EXCEPTION 'Still taking a workspace/user id: %', v;
  END IF;
END $$;
