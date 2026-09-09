-- Generic superadmin-gated patch for agency_subscriptions. Replaces the
-- admin portal's client-side service-role updates (upgradePlan, renewSubscription,
-- toggleActive, manualOverride) with a single gated RPC. The caller passes the
-- same update object they used before as `patch`; absent keys keep current values.
create or replace function public.admin_update_subscription(target_user_id uuid, patch jsonb)
returns public.agency_subscriptions
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_existing public.agency_subscriptions;
  r public.agency_subscriptions;
begin
  if not public.is_superadmin() then
    raise exception 'Only a superadmin can update subscriptions';
  end if;

  select * into v_existing
    from public.agency_subscriptions
   where user_id = target_user_id;
  if not found then
    raise exception 'Workspace not found';
  end if;

  -- Overlay patch onto the existing row. Identity/system columns are stripped so
  -- a patch can never repoint the row, rewrite the storage counter, forge the
  -- created timestamp, or touch the deletion schedule (managed by its own RPCs).
  r := jsonb_populate_record(
        v_existing,
        (patch - 'user_id' - 'created_at' - 'current_storage_used' - 'scheduled_for_deletion_at')
      );

  update public.agency_subscriptions set
    plan_name                  = r.plan_name,
    max_clients                = r.max_clients,
    max_storage_bytes          = r.max_storage_bytes,
    is_active                  = r.is_active,
    agency_name                = r.agency_name,
    logo_url                   = r.logo_url,
    primary_color              = r.primary_color,
    social_links               = r.social_links,
    industry                   = r.industry,
    platforms                  = r.platforms,
    email                      = r.email,
    mobile_number              = r.mobile_number,
    description                = r.description,
    next_invoice_number        = r.next_invoice_number,
    branding_agency_sidebar    = r.branding_agency_sidebar,
    branding_powered_by        = r.branding_powered_by,
    billing_cycle              = r.billing_cycle,
    trial_ends_at              = r.trial_ends_at,
    extra_client_price_inr     = r.extra_client_price_inr,
    finance_subscriptions      = r.finance_subscriptions,
    calendar_export            = r.calendar_export,
    finance_recurring_invoices = r.finance_recurring_invoices,
    documents_collections      = r.documents_collections,
    finance_accrual            = r.finance_accrual,
    campaigns                  = r.campaigns,
    logo_horizontal_url        = r.logo_horizontal_url,
    proposals_limit            = r.proposals_limit,
    max_team_members           = r.max_team_members,
    subscription_ends_at       = r.subscription_ends_at,
    signatory_name             = r.signatory_name,
    signatory_designation      = r.signatory_designation,
    signature_url              = r.signature_url,
    reports                    = r.reports,
    updated_at                 = now()
  where user_id = target_user_id
  returning * into r;

  return r;
end;
$$;

-- Superadmin-gated read of auth.users for the admin portal's client-detail view.
-- Replaces the client-side auth.admin.getUserById() (which required the service key).
create or replace function public.admin_get_user_auth_info(target_user_id uuid)
returns table (
  id                 uuid,
  email              text,
  phone              text,
  created_at         timestamptz,
  last_sign_in_at    timestamptz,
  email_confirmed_at timestamptz,
  banned_until       timestamptz
)
language plpgsql
security definer
set search_path to 'public', 'pg_temp', 'auth'
as $$
begin
  if not public.is_superadmin() then
    raise exception 'Only a superadmin can read user auth info';
  end if;
  return query
    select u.id,
           u.email::text,
           u.phone::text,
           u.created_at,
           u.last_sign_in_at,
           u.email_confirmed_at,
           u.banned_until
    from auth.users u
    where u.id = target_user_id;
end;
$$;

-- Lock execution to authenticated callers (gate enforced inside).
revoke execute on function public.admin_update_subscription(uuid, jsonb) from public, anon;
revoke execute on function public.admin_get_user_auth_info(uuid) from public, anon;
grant execute on function public.admin_update_subscription(uuid, jsonb) to authenticated;
grant execute on function public.admin_get_user_auth_info(uuid) to authenticated;;
