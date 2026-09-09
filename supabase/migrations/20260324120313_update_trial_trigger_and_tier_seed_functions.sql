
-- 1. Update the new-user trigger to use current trial values (mirrors Quantum)
CREATE OR REPLACE FUNCTION handle_new_user_subscription()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
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

-- 2. Helper: set_plan(user_id, plan) — call this when upgrading/downgrading a workspace
CREATE OR REPLACE FUNCTION set_agency_plan(p_user_id uuid, p_plan text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  CASE p_plan

    WHEN 'ignite' THEN
      UPDATE public.agency_subscriptions SET
        plan_name                  = 'ignite',
        trial_ends_at              = NULL,
        max_clients                = 5,
        max_storage_bytes          = 21474836480,   -- 20 GB
        max_team_members           = 2,
        branding_agency_sidebar    = FALSE,
        branding_powered_by        = TRUE,
        finance_recurring_invoices = FALSE,
        finance_subscriptions      = FALSE,
        finance_accrual            = TRUE,
        calendar_export            = FALSE,
        documents_collections      = FALSE,
        campaigns                  = FALSE,
        proposals_limit            = 5,
        extra_client_price_inr     = 499
      WHERE user_id = p_user_id;

    WHEN 'velocity' THEN
      UPDATE public.agency_subscriptions SET
        plan_name                  = 'velocity',
        trial_ends_at              = NULL,
        max_clients                = 15,
        max_storage_bytes          = 53687091200,   -- 50 GB
        max_team_members           = 5,
        branding_agency_sidebar    = TRUE,
        branding_powered_by        = TRUE,
        finance_recurring_invoices = TRUE,
        finance_subscriptions      = TRUE,
        finance_accrual            = TRUE,
        calendar_export            = TRUE,
        documents_collections      = TRUE,
        campaigns                  = TRUE,
        proposals_limit            = NULL,
        extra_client_price_inr     = 499
      WHERE user_id = p_user_id;

    WHEN 'quantum' THEN
      UPDATE public.agency_subscriptions SET
        plan_name                  = 'quantum',
        trial_ends_at              = NULL,
        max_clients                = 30,
        max_storage_bytes          = 107374182400,  -- 100 GB
        max_team_members           = NULL,
        branding_agency_sidebar    = TRUE,
        branding_powered_by        = FALSE,
        finance_recurring_invoices = TRUE,
        finance_subscriptions      = TRUE,
        finance_accrual            = TRUE,
        calendar_export            = TRUE,
        documents_collections      = TRUE,
        campaigns                  = TRUE,
        proposals_limit            = NULL,
        extra_client_price_inr     = 499
      WHERE user_id = p_user_id;

    ELSE
      RAISE EXCEPTION 'Unknown plan: %', p_plan;
  END CASE;
END;
$$;
;
