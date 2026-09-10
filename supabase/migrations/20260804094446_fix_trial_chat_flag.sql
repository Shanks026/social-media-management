-- Trial mirrors Quantum, so every Velocity+ flag is enabled on signup. `chat`
-- was missing from the INSERT column list, so it fell to its column default
-- (false) and new trials saw Chat locked. Added alongside the others.
create or replace function public.handle_new_user_subscription()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
BEGIN
  IF (NEW.raw_user_meta_data->>'invite_token') IS NOT NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.agency_subscriptions (
    user_id, plan_name, trial_ends_at, max_clients, max_storage_bytes,
    max_team_members, branding_agency_sidebar, branding_powered_by,
    finance_recurring_invoices, finance_subscriptions, finance_accrual,
    calendar_export, documents_collections, campaigns, reports, chat,
    proposals_limit, extra_client_price_inr, extra_seat_price_inr, billing_cycle
  )
  VALUES (
    NEW.id, 'trial', NOW() + INTERVAL '14 days', NULL, 214748364800,
    NULL, TRUE, FALSE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE,
    NULL, NULL, NULL, 'monthly'
  );

  INSERT INTO public.agency_members (agency_user_id, member_user_id, system_role, permissions)
  VALUES (NEW.id, NEW.id, 'owner', '{"documents":"manage"}'::jsonb)
  ON CONFLICT (agency_user_id, member_user_id) DO NOTHING;

  RETURN NEW;
END;
$function$;

-- Backfill trials created while the flag was missing.
update public.agency_subscriptions
   set chat = true, updated_at = now()
 where plan_name = 'trial' and chat = false;;
