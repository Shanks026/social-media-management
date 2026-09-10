
-- ============================================================
-- Update signup trigger: skip subscription creation for team
-- member invites. When a member signs up via /join/:token the
-- frontend passes invite_token in user metadata, so we skip
-- creating an agency_subscriptions row (they don't own a workspace).
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- If this signup is via an invite link, skip subscription creation.
  -- The join_team RPC will wire them up to the correct agency instead.
  IF (NEW.raw_user_meta_data->>'invite_token') IS NOT NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.agency_subscriptions (
    user_id,
    plan_name,
    max_clients,
    max_storage_bytes,
    branding_agency_sidebar,
    branding_powered_by,
    finance_recurring_invoices,
    finance_subscriptions,
    calendar_export,
    extra_client_price_inr,
    billing_cycle
  )
  VALUES (
    NEW.id,
    'trial',
    5,
    21474836480, -- 20GB
    false,
    true,
    false,
    false,
    false,
    500,
    'monthly'
  );

  -- Also register the new user as the admin of their own agency workspace
  INSERT INTO public.agency_members (agency_user_id, member_user_id, system_role)
  VALUES (NEW.id, NEW.id, 'admin')
  ON CONFLICT (agency_user_id, member_user_id) DO NOTHING;

  RETURN NEW;
END;
$function$;

-- ============================================================
-- join_team RPC: called by the newly authenticated team member
-- after signUp. Validates the invite token, inserts the
-- agency_members row, and marks the invite as accepted.
-- SECURITY DEFINER so it can insert despite RLS ownership checks.
-- ============================================================
CREATE OR REPLACE FUNCTION public.join_team(
  p_token        text,
  p_first_name   text,
  p_last_name    text,
  p_functional_role text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_invite        agency_invites%ROWTYPE;
  v_member_uid    uuid := auth.uid();
  v_display_name  text;
BEGIN
  -- Caller must be authenticated (newly signed-up user)
  IF v_member_uid IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  -- Look up the invite
  SELECT * INTO v_invite
  FROM agency_invites
  WHERE token = p_token
    AND accepted_at IS NULL
    AND expires_at > now();

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'This invite link is no longer valid. Ask your agency owner for a new one.');
  END IF;

  -- Insert the agency_members row
  INSERT INTO agency_members (
    agency_user_id,
    member_user_id,
    system_role,
    functional_role
  )
  VALUES (
    v_invite.agency_user_id,
    v_member_uid,
    'member',
    p_functional_role
  )
  ON CONFLICT (agency_user_id, member_user_id) DO NOTHING;

  -- Mark the invite as accepted
  UPDATE agency_invites
  SET accepted_at = now()
  WHERE id = v_invite.id;

  -- Update the new user's display name in auth metadata
  UPDATE auth.users
  SET raw_user_meta_data = raw_user_meta_data
    || jsonb_build_object(
         'first_name', p_first_name,
         'last_name',  p_last_name,
         'full_name',  p_first_name || ' ' || p_last_name
       )
  WHERE id = v_member_uid;

  RETURN jsonb_build_object('success', true, 'agency_user_id', v_invite.agency_user_id);
END;
$function$;

-- Allow unauthenticated / public calls to look up invite info before signup
-- (to show agency name/logo on the join page)
CREATE OR REPLACE FUNCTION public.get_invite_by_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_invite  agency_invites%ROWTYPE;
  v_sub     agency_subscriptions%ROWTYPE;
BEGIN
  SELECT * INTO v_invite
  FROM agency_invites
  WHERE token = p_token
    AND accepted_at IS NULL
    AND expires_at > now();

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'This invite link is no longer valid. Ask your agency owner for a new one.');
  END IF;

  SELECT * INTO v_sub
  FROM agency_subscriptions
  WHERE user_id = v_invite.agency_user_id;

  RETURN jsonb_build_object(
    'valid',        true,
    'agency_name',  v_sub.agency_name,
    'logo_url',     v_sub.logo_url
  );
END;
$function$;
;
