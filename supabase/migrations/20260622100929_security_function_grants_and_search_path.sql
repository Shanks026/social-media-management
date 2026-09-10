-- M1: Revoke anon EXECUTE on internal/authenticated-only SECURITY DEFINER functions.
-- Public review/signup RPCs stay anon-callable: get_post_by_token, update_post_status_by_token,
-- get_campaign_by_review_token, get_proposal_by_token, mark_proposal_viewed, accept_proposal,
-- decline_proposal, get_invite_by_token, join_team, check_email_exists, get_my_agency_user_id
-- (the last is referenced inside RLS policies), plus trigger functions.
REVOKE EXECUTE ON FUNCTION public.admin_get_clients()                                            FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_get_client_onboarding(uuid)                              FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_agency_plan(uuid, text)                                    FROM anon;
REVOKE EXECUTE ON FUNCTION public.generate_invoice_from_template(uuid, uuid)                      FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_new_post_with_version(uuid, text, text, text[], text[], timestamp with time zone) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_campaign_analytics(uuid)                                    FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_clients_with_pipeline(uuid, text, text, text, text)         FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_proposals_with_totals(uuid, uuid)                           FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_removed_members(uuid)                                       FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_team_members(uuid)                                          FROM anon;
REVOKE EXECUTE ON FUNCTION public.generate_proposal_token(uuid)                                   FROM anon;
REVOKE EXECUTE ON FUNCTION public.generate_version_token(uuid)                                    FROM anon;
REVOKE EXECUTE ON FUNCTION public.increment_storage_used(uuid, bigint)                            FROM anon;
REVOKE EXECUTE ON FUNCTION public.decrement_storage_used(uuid, bigint)                            FROM anon;
REVOKE EXECUTE ON FUNCTION public.advance_recurring_invoice_date(uuid)                            FROM anon;

-- M2: Pin a fixed search_path on every SECURITY DEFINER function in public (prevents
-- search_path-based privilege escalation). Applied to all so none are missed.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS func
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', r.func);
  END LOOP;
END $$;;
