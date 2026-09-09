-- The public review page needs six branding columns to white-label itself, and
-- was reading agency_subscriptions directly — which is why that table carried a
-- blanket `USING (true)` SELECT policy exposing every agency's name, email,
-- mobile number, plan, storage usage and signatory to anyone.
--
-- This returns *only* the branding fields, and only for a share token that is
-- live: same validity test as get_post_by_token (exists, unexpired, active).
create or replace function public.get_agency_branding_by_token(p_token text)
returns table (
  agency_name text,
  logo_url text,
  logo_horizontal_url text,
  primary_color text,
  branding_agency_sidebar boolean,
  branding_powered_by boolean
)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  SELECT
    s.agency_name,
    s.logo_url,
    s.logo_horizontal_url,
    s.primary_color,
    s.branding_agency_sidebar,
    s.branding_powered_by
  FROM public.share_tokens st
  JOIN public.post_versions pv ON pv.id = st.post_version_id
  JOIN public.clients c        ON c.id  = pv.client_id
  JOIN public.agency_subscriptions s ON s.user_id = c.user_id
  WHERE st.token = p_token
    AND st.expires_at > now()
    AND st.is_active = true;
$function$;

comment on function public.get_agency_branding_by_token(text) is
  'Public review branding lookup. Returns branding columns only, gated on a live share token — replaces the direct agency_subscriptions read from PublicReview.';

revoke all on function public.get_agency_branding_by_token(text) from public;
grant execute on function public.get_agency_branding_by_token(text) to anon, authenticated;;
