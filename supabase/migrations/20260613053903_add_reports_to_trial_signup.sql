
CREATE OR REPLACE FUNCTION handle_new_user_subscription()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- If this signup is via an invite link, skip subscription creation.
  -- The join_team RPC wires them up to the correct agency workspace instead.
  IF (NEW.raw_user_meta_data->>'invite_token') IS NOT NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.agency_subscriptions (
    user_id,
    plan_name,
    trial_ends_at,
    max_clients,
    max_storage_bytes,
    max_team_members,
    branding_agency_sidebar,
    branding_powered_by,
    finance_recurring_invoices,
    finance_subscriptions,
    finance_accrual,
    calendar_export,
    documents_collections,
    campaigns,
    reports,
    proposals_limit,
    extra_client_price_inr,
    billing_cycle
  )
  VALUES (
    NEW.id,
    'trial',
    NOW() + INTERVAL '14 days',
    30,              -- mirrors Quantum
    107374182400,    -- 100 GB
    NULL,            -- unlimited team seats on trial
    TRUE,
    FALSE,
    TRUE,
    TRUE,
    TRUE,
    TRUE,
    TRUE,
    TRUE,
    TRUE,            -- reports enabled on trial
    NULL,            -- unlimited proposals
    499,
    'monthly'
  );

  -- Register the new user as admin of their own agency workspace
  INSERT INTO public.agency_members (agency_user_id, member_user_id, system_role)
  VALUES (NEW.id, NEW.id, 'admin')
  ON CONFLICT (agency_user_id, member_user_id) DO NOTHING;

  RETURN NEW;
END;
$$;
;
