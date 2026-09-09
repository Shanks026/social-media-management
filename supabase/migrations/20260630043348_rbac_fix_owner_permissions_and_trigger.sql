
-- Fix existing owner row: should have manage, not view
UPDATE public.agency_members
  SET permissions = '{"documents":"manage"}'::jsonb
  WHERE system_role = 'owner';

-- Fix trigger: owner rows get manage permissions
CREATE OR REPLACE FUNCTION public.handle_new_user_subscription()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $function$
BEGIN
  IF (NEW.raw_user_meta_data->>'invite_token') IS NOT NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.agency_subscriptions (
    user_id, plan_name, trial_ends_at, max_clients, max_storage_bytes,
    max_team_members, branding_agency_sidebar, branding_powered_by,
    finance_recurring_invoices, finance_subscriptions, finance_accrual,
    calendar_export, documents_collections, campaigns, reports,
    proposals_limit, extra_client_price_inr, billing_cycle
  )
  VALUES (
    NEW.id, 'trial', NOW() + INTERVAL '14 days', 30, 107374182400,
    NULL, TRUE, FALSE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE,
    NULL, 499, 'monthly'
  );

  INSERT INTO public.agency_members (agency_user_id, member_user_id, system_role, permissions)
  VALUES (NEW.id, NEW.id, 'owner', '{"documents":"manage"}'::jsonb)
  ON CONFLICT (agency_user_id, member_user_id) DO NOTHING;

  RETURN NEW;
END;
$function$;
;
