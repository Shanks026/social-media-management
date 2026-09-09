
-- 1. Update the new-user trigger to set Quantum-level features + trial_ends_at
CREATE OR REPLACE FUNCTION handle_new_user_subscription()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- If this signup is via an invite link, skip subscription creation.
  -- The join_team RPC will wire them up to the correct agency instead.
  IF (NEW.raw_user_meta_data->>'invite_token') IS NOT NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.agency_subscriptions (
    user_id,
    plan_name,
    trial_ends_at,
    max_clients,
    max_storage_bytes,
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
    35,
    536870912000, -- 500 GB
    true,
    false,
    true,
    true,
    true,
    true,
    true,
    true,
    NULL,
    500,
    'monthly'
  );

  -- Also register the new user as the admin of their own agency workspace
  INSERT INTO public.agency_members (agency_user_id, member_user_id, system_role)
  VALUES (NEW.id, NEW.id, 'admin')
  ON CONFLICT (agency_user_id, member_user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- 2. Update any existing trial rows to Quantum features (backfill)
UPDATE public.agency_subscriptions
SET
  finance_recurring_invoices = true,
  finance_subscriptions      = true,
  finance_accrual            = true,
  calendar_export            = true,
  documents_collections      = true,
  campaigns                  = true,
  branding_agency_sidebar    = true,
  branding_powered_by        = false,
  max_clients                = 35,
  max_storage_bytes          = 536870912000,
  proposals_limit            = NULL
WHERE plan_name = 'trial';

-- 3. Backfill trial_ends_at for any trial rows where it is null
UPDATE public.agency_subscriptions
SET trial_ends_at = created_at + INTERVAL '14 days'
WHERE plan_name = 'trial'
  AND trial_ends_at IS NULL;
;
