-- set_agency_plan() set every other Velocity+ flag (campaigns, finance_*,
-- calendar_export, documents_collections, branding_agency_sidebar) but had
-- no `chat` case at all, so a plan change never touched it. Matches the same
-- (velocity, quantum, trial) precedent as those flags — see
-- documentation/subscription-features-phase2.md's "Trial mirrors Quantum"
-- philosophy, and feature-workspace-chat.md's Implementation Notes (initial
-- backfill missed Trial, corrected to match every other Velocity+ flag).
CREATE OR REPLACE FUNCTION public.set_agency_plan(p_user_id uuid, p_plan text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  UPDATE agency_subscriptions SET
    plan_name = p_plan,
    max_clients = CASE p_plan
      WHEN 'ignite'   THEN 5
      WHEN 'velocity' THEN 15
      WHEN 'quantum'  THEN 30
      WHEN 'trial'    THEN 30
    END,
    max_storage_bytes = CASE p_plan
      WHEN 'ignite'   THEN 21474836480
      WHEN 'velocity' THEN 53687091200
      WHEN 'quantum'  THEN 107374182400
      WHEN 'trial'    THEN 107374182400
    END,
    max_team_members = CASE p_plan
      WHEN 'ignite'   THEN 2
      WHEN 'velocity' THEN 5
      WHEN 'quantum'  THEN NULL
      WHEN 'trial'    THEN NULL
    END,
    proposals_limit = CASE p_plan
      WHEN 'ignite'   THEN 5
      ELSE NULL
    END,
    campaigns             = (p_plan IN ('velocity','quantum','trial')),
    finance_recurring_invoices = (p_plan IN ('velocity','quantum','trial')),
    finance_subscriptions = (p_plan IN ('velocity','quantum','trial')),
    finance_accrual       = (p_plan IN ('velocity','quantum','trial')),
    calendar_export       = (p_plan IN ('velocity','quantum','trial')),
    documents_collections = (p_plan IN ('velocity','quantum','trial')),
    branding_agency_sidebar = (p_plan IN ('velocity','quantum','trial')),
    branding_powered_by   = (p_plan IN ('ignite','velocity','trial')),
    chat                  = (p_plan IN ('velocity','quantum','trial'))
  WHERE user_id = p_user_id;
END;
$function$;

-- admin_update_subscription()'s jsonb_populate_record already resolves
-- r.chat correctly (from the patch, or falling back to the existing row),
-- but the final UPDATE's SET list never included `chat` — so a superadmin
-- patch containing {"chat": true} silently failed to persist.
CREATE OR REPLACE FUNCTION public.admin_update_subscription(target_user_id uuid, patch jsonb)
 RETURNS agency_subscriptions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
    primary_color               = r.primary_color,
    social_links                = r.social_links,
    industry                    = r.industry,
    platforms                   = r.platforms,
    email                       = r.email,
    mobile_number               = r.mobile_number,
    description                 = r.description,
    next_invoice_number         = r.next_invoice_number,
    branding_agency_sidebar     = r.branding_agency_sidebar,
    branding_powered_by         = r.branding_powered_by,
    billing_cycle                = r.billing_cycle,
    trial_ends_at                = r.trial_ends_at,
    extra_client_price_inr       = r.extra_client_price_inr,
    finance_subscriptions        = r.finance_subscriptions,
    calendar_export               = r.calendar_export,
    finance_recurring_invoices    = r.finance_recurring_invoices,
    documents_collections         = r.documents_collections,
    finance_accrual               = r.finance_accrual,
    campaigns                     = r.campaigns,
    logo_horizontal_url           = r.logo_horizontal_url,
    proposals_limit               = r.proposals_limit,
    max_team_members              = r.max_team_members,
    subscription_ends_at          = r.subscription_ends_at,
    signatory_name                = r.signatory_name,
    signatory_designation         = r.signatory_designation,
    signature_url                 = r.signature_url,
    reports                       = r.reports,
    chat                          = r.chat,
    updated_at                    = now()
  where user_id = target_user_id
  returning * into r;

  return r;
end;
$function$;;
