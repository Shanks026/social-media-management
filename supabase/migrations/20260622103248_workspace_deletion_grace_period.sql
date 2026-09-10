-- Grace-period column: when set, the workspace is scheduled for permanent purge at that time.
ALTER TABLE public.agency_subscriptions
  ADD COLUMN IF NOT EXISTS scheduled_for_deletion_at timestamptz;

-- Owner-only: schedule deletion 14 days out. auth.uid() = get_my_agency_user_id() is true
-- only for the workspace owner (members resolve to the owner's id but their uid differs).
CREATE OR REPLACE FUNCTION public.request_workspace_deletion()
RETURNS timestamptz
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_when timestamptz;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> get_my_agency_user_id() THEN
    RAISE EXCEPTION 'Only the workspace owner can schedule deletion';
  END IF;
  v_when := now() + interval '14 days';
  UPDATE public.agency_subscriptions
     SET scheduled_for_deletion_at = v_when, updated_at = now()
   WHERE user_id = auth.uid();
  RETURN v_when;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_workspace_deletion()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> get_my_agency_user_id() THEN
    RAISE EXCEPTION 'Only the workspace owner can cancel deletion';
  END IF;
  UPDATE public.agency_subscriptions
     SET scheduled_for_deletion_at = NULL, updated_at = now()
   WHERE user_id = auth.uid();
END;
$$;

-- Lock down EXECUTE to authenticated only (default PUBLIC grant removed).
REVOKE EXECUTE ON FUNCTION public.request_workspace_deletion() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cancel_workspace_deletion()  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_workspace_deletion() TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_workspace_deletion()  TO authenticated;;
