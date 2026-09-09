-- Cross-tenant exposure: this policy made every agency_subscriptions row
-- readable by anyone, including anon — agency_name, email, mobile_number,
-- plan_name, storage usage, signatory_name and every feature flag.
--
-- The only unauthenticated consumer was PublicReview's branding lookup, now
-- served by get_agency_branding_by_token (branding columns only, gated on a
-- live share token). Everything else is either authenticated — and covered by
-- agency_subscriptions_workspace_scoped (ALL, user_id = get_my_agency_user_id())
-- — or an edge function using the service role key, which bypasses RLS.
drop policy if exists "Allow public read access to agency_subscriptions"
  on public.agency_subscriptions;;
