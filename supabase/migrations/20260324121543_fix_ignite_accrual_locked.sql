
CREATE OR REPLACE FUNCTION set_agency_plan(p_user_id uuid, p_plan text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  CASE p_plan

    WHEN 'ignite' THEN
      UPDATE public.agency_subscriptions SET
        plan_name                  = 'ignite',
        trial_ends_at              = NULL,
        max_clients                = 5,
        max_storage_bytes          = 21474836480,
        max_team_members           = 2,
        branding_agency_sidebar    = FALSE,
        branding_powered_by        = TRUE,
        finance_recurring_invoices = FALSE,
        finance_subscriptions      = FALSE,
        finance_accrual            = FALSE,
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
        max_storage_bytes          = 53687091200,
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
        max_storage_bytes          = 107374182400,
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
