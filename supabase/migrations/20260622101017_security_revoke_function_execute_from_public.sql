-- M1 (corrected): EXECUTE defaults to PUBLIC, so revoke from PUBLIC then grant only to
-- authenticated. This removes anon access while the app (authenticated) keeps working.
DO $$
DECLARE
  fn text;
  fns text[] := ARRAY[
    'public.admin_get_clients()',
    'public.admin_get_client_onboarding(uuid)',
    'public.set_agency_plan(uuid, text)',
    'public.generate_invoice_from_template(uuid, uuid)',
    'public.create_new_post_with_version(uuid, text, text, text[], text[], timestamp with time zone)',
    'public.get_campaign_analytics(uuid)',
    'public.get_clients_with_pipeline(uuid, text, text, text, text)',
    'public.get_proposals_with_totals(uuid, uuid)',
    'public.get_removed_members(uuid)',
    'public.get_team_members(uuid)',
    'public.generate_proposal_token(uuid)',
    'public.generate_version_token(uuid)',
    'public.increment_storage_used(uuid, bigint)',
    'public.decrement_storage_used(uuid, bigint)',
    'public.advance_recurring_invoice_date(uuid)'
  ];
BEGIN
  FOREACH fn IN ARRAY fns LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn);
  END LOOP;
END $$;;
