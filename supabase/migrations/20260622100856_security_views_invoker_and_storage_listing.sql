-- H1: Make SECURITY DEFINER views respect the querying user's RLS (Postgres 15+).
ALTER VIEW public.view_monthly_burn_rate    SET (security_invoker = on);
ALTER VIEW public.subscription_usage_stats  SET (security_invoker = on);
ALTER VIEW public.client_pipeline_analytics SET (security_invoker = on);
ALTER VIEW public.view_finance_overview     SET (security_invoker = on);

-- H2: Stop anonymous enumeration/listing of public buckets. Public URL rendering of
-- public buckets does NOT depend on these SELECT policies, so review pages keep working;
-- this only removes the anon `list()`/select capability. Authenticated owners retain it.
ALTER POLICY "post_media_read"            ON storage.objects TO authenticated;
ALTER POLICY "proposal_files_public_read" ON storage.objects TO authenticated;;
