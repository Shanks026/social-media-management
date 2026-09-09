-- Corrects the trial seed to mirror Quantum (unlimited clients/seats, full
-- feature access, whitelabel) with only storage capped at 200 GB — per
-- documentation/subscription-features-phase2.md. Previously this hardcoded
-- 30 clients / 100 GB / extra_client_price_inr=499, none of which matched
-- any documented plan and left trial accounts under-provisioned relative to
-- the "mirrors Quantum" intent.
CREATE OR REPLACE FUNCTION public.handle_new_user_subscription()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF (NEW.raw_user_meta_data->>'invite_token') IS NOT NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.agency_subscriptions (
    user_id, plan_name, trial_ends_at, max_clients, max_storage_bytes,
    max_team_members, branding_agency_sidebar, branding_powered_by,
    finance_recurring_invoices, finance_subscriptions, finance_accrual,
    calendar_export, documents_collections, campaigns, reports,
    proposals_limit, extra_client_price_inr, extra_seat_price_inr, billing_cycle
  )
  VALUES (
    NEW.id, 'trial', NOW() + INTERVAL '14 days', NULL, 214748364800,
    NULL, TRUE, FALSE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE,
    NULL, NULL, NULL, 'monthly'
  );

  INSERT INTO public.agency_members (agency_user_id, member_user_id, system_role, permissions)
  VALUES (NEW.id, NEW.id, 'owner', '{"documents":"manage"}'::jsonb)
  ON CONFLICT (agency_user_id, member_user_id) DO NOTHING;

  RETURN NEW;
END;
$function$;
;
