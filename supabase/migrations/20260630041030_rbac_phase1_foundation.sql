
-- ── Phase 1: Permission Foundation ──────────────────────────────────────────

-- 1. Add permissions JSONB to agency_members
ALTER TABLE public.agency_members
  ADD COLUMN IF NOT EXISTS permissions jsonb NOT NULL
  DEFAULT '{"documents": "view"}'::jsonb;

-- 2. Add functional_role + permissions to agency_invites
--    NOTE: invites carry NO system_role — everyone joins as 'member'
ALTER TABLE public.agency_invites
  ADD COLUMN IF NOT EXISTS functional_role text,
  ADD COLUMN IF NOT EXISTS permissions jsonb NOT NULL
  DEFAULT '{"documents": "view"}'::jsonb;

-- 3. Backfill existing rows
UPDATE public.agency_members
  SET permissions = '{"documents": "manage"}'::jsonb
  WHERE system_role IN ('admin', 'superadmin');

UPDATE public.agency_members
  SET permissions = '{"documents": "view"}'::jsonb
  WHERE system_role = 'member';

-- 4. Promote existing owner self-rows from 'admin' → 'owner'
UPDATE public.agency_members
  SET system_role = 'owner'
  WHERE agency_user_id = member_user_id AND system_role = 'admin';

-- 5. Fix signup trigger: new users become 'owner' of their workspace
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

  INSERT INTO public.agency_members (agency_user_id, member_user_id, system_role)
  VALUES (NEW.id, NEW.id, 'owner')
  ON CONFLICT (agency_user_id, member_user_id) DO NOTHING;

  RETURN NEW;
END;
$function$;

-- 6. SECURITY DEFINER access helpers

-- Owner check: derived purely from the workspace model
CREATE OR REPLACE FUNCTION public.is_workspace_owner()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() = public.get_my_agency_user_id();
$$;

-- Resolved system role for the calling user
CREATE OR REPLACE FUNCTION public.my_system_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN public.is_workspace_owner() THEN 'owner'
    ELSE COALESCE(
      (SELECT system_role FROM public.agency_members
       WHERE member_user_id = auth.uid() AND is_active LIMIT 1),
      'member'
    )
  END;
$$;

-- Owner OR admin (used for finance, confidential docs, proposals, prospects, reports)
CREATE OR REPLACE FUNCTION public.is_workspace_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_workspace_owner() OR COALESCE((
    SELECT system_role IN ('admin', 'superadmin')
    FROM public.agency_members
    WHERE member_user_id = auth.uid() AND is_active LIMIT 1
  ), false);
$$;

-- Finance: owner/admin/superadmin only — members never, no flag
CREATE OR REPLACE FUNCTION public.can_access_finance()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_workspace_admin();
$$;

-- Documents level: 'manage' for owner/admin; else the member's stored flag
CREATE OR REPLACE FUNCTION public.my_documents_level()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN public.is_workspace_admin() THEN 'manage'
    ELSE COALESCE(
      (SELECT permissions->>'documents'
       FROM public.agency_members
       WHERE member_user_id = auth.uid() AND is_active LIMIT 1),
      'view'
    )
  END;
$$;

-- Confidential docs: owner/admin/superadmin only
CREATE OR REPLACE FUNCTION public.can_view_confidential_docs()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_workspace_admin();
$$;
;
