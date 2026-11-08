-- Squashed baseline, part 1 (#90, ADR 0005): production's schema as dumped by
-- `supabase db dump` on 2026-11-08, replacing the 244 earlier migrations (they
-- remain in git history). Part 2 adds what this dump cannot see.




SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."client_tier" AS ENUM (
    'BASIC',
    'PRO',
    'VIP',
    'INTERNAL'
);


ALTER TYPE "public"."client_tier" OWNER TO "postgres";


CREATE TYPE "public"."post_status" AS ENUM (
    'DRAFT',
    'PENDING_APPROVAL',
    'APPROVED',
    'SCHEDULED',
    'NEEDS_REVISION',
    'PUBLISHED',
    'ARCHIVED',
    'DELIVERED',
    'SUBMITTED',
    'CHANGES_REQUESTED',
    'READY'
);


ALTER TYPE "public"."post_status" OWNER TO "postgres";


CREATE TYPE "public"."transaction_status" AS ENUM (
    'PAID',
    'PENDING',
    'OVERDUE'
);


ALTER TYPE "public"."transaction_status" OWNER TO "postgres";


CREATE TYPE "public"."transaction_type" AS ENUM (
    'INCOME',
    'EXPENSE'
);


ALTER TYPE "public"."transaction_type" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."accept_proposal"("p_token" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_prospect_id uuid;
  v_prospect_status text;
  v_workspace_user_id uuid;
BEGIN
  UPDATE proposals
  SET
    status      = 'accepted',
    accepted_at = now(),
    updated_at  = now()
  WHERE share_token = p_token
    AND status NOT IN ('accepted', 'declined', 'archived')
  RETURNING prospect_id INTO v_prospect_id;

  IF v_prospect_id IS NOT NULL THEN
    SELECT status, user_id INTO v_prospect_status, v_workspace_user_id
    FROM prospects WHERE id = v_prospect_id;

    IF v_prospect_status IS NOT NULL
       AND v_prospect_status NOT IN ('proposal_accepted', 'contract_sent', 'won', 'lost') THEN
      UPDATE prospects
      SET status = 'proposal_accepted', updated_at = now()
      WHERE id = v_prospect_id;

      INSERT INTO prospect_activities (prospect_id, user_id, type, body, occurred_at, metadata)
      VALUES (
        v_prospect_id,
        v_workspace_user_id,
        'status_change',
        'Status changed from ' || public.prospect_status_label(v_prospect_status) ||
          ' to Proposal Accepted (client accepted the proposal)',
        now(),
        jsonb_build_object(
          'from_status', v_prospect_status,
          'to_status', 'proposal_accepted',
          'trigger', 'accept_proposal'
        )
      );
    END IF;
  END IF;
END;
$$;


ALTER FUNCTION "public"."accept_proposal"("p_token" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_cancel_workspace_deletion"("target_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
begin
  if not public.is_superadmin() then
    raise exception 'Only a superadmin can cancel workspace deletion';
  end if;
  update agency_subscriptions
     set scheduled_for_deletion_at = null, updated_at = now()
   where user_id = target_user_id;
end;
$$;


ALTER FUNCTION "public"."admin_cancel_workspace_deletion"("target_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_get_client_detail"("target_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
begin
  if not is_superadmin() then
    raise exception 'Access denied';
  end if;

  return (
    select to_jsonb(s) from agency_subscriptions s where s.user_id = target_user_id
  );
end;
$$;


ALTER FUNCTION "public"."admin_get_client_detail"("target_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_get_client_onboarding"("p_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
begin
  if not exists (
    select 1 from agency_members
    where member_user_id = auth.uid()
      and system_role = 'superadmin'
  ) then
    raise exception 'Access denied';
  end if;

  return (
    select jsonb_build_object(
      'profile_complete',
        coalesce(
          (select agency_name is not null and logo_url is not null
           from agency_subscriptions where user_id = p_user_id),
          false
        ),
      'first_client_added',
        exists (select 1 from clients where user_id = p_user_id),
      'first_prospect_added',
        exists (select 1 from prospects where user_id = p_user_id),
      'first_team_member_added',
        exists (
          select 1 from agency_members
          where agency_user_id = p_user_id
            and member_user_id != p_user_id
        ),
      'first_proposal_created',
        exists (select 1 from proposals where agency_user_id = p_user_id),
      'first_post_created',
        exists (
          select 1 from posts p
          join clients c on c.id = p.client_id
          where c.user_id = p_user_id
        )
    )
  );
end;
$$;


ALTER FUNCTION "public"."admin_get_client_onboarding"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_get_clients"() RETURNS TABLE("user_id" "uuid", "agency_name" "text", "email" "text", "auth_email" "text", "auth_full_name" "text", "plan_name" "text", "is_active" boolean, "trial_ends_at" timestamp with time zone, "subscription_ends_at" timestamp with time zone, "current_storage_used" bigint, "max_storage_bytes" bigint, "created_at" timestamp with time zone, "logo_url" "text")
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT
    s.user_id,
    s.agency_name,
    s.email,
    u.email                              AS auth_email,
    u.raw_user_meta_data->>'full_name'   AS auth_full_name,
    s.plan_name,
    s.is_active,
    s.trial_ends_at,
    s.subscription_ends_at,
    s.current_storage_used,
    s.max_storage_bytes,
    s.created_at,
    s.logo_url
  FROM agency_subscriptions s
  JOIN auth.users u ON u.id = s.user_id;
$$;


ALTER FUNCTION "public"."admin_get_clients"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_get_user_auth_info"("target_user_id" "uuid") RETURNS TABLE("id" "uuid", "email" "text", "full_name" "text", "phone" "text", "created_at" timestamp with time zone, "last_sign_in_at" timestamp with time zone, "email_confirmed_at" timestamp with time zone, "banned_until" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp', 'auth'
    AS $$
begin
  if not public.is_superadmin() then
    raise exception 'Only a superadmin can read user auth info';
  end if;
  return query
    select u.id,
           u.email::text,
           (u.raw_user_meta_data ->> 'full_name')::text,
           u.phone::text,
           u.created_at,
           u.last_sign_in_at,
           u.email_confirmed_at,
           u.banned_until
    from auth.users u
    where u.id = target_user_id;
end;
$$;


ALTER FUNCTION "public"."admin_get_user_auth_info"("target_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_link_prospect_on_signup"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  matched_prospect_id uuid;
begin
  -- Skip team member invites — they join an existing agency, not their own
  if (NEW.raw_user_meta_data->>'invite_token') is not null then
    return NEW;
  end if;

  -- Try to match by email to an existing prospect record
  select id into matched_prospect_id
  from admin_prospects
  where email = NEW.email
  limit 1;

  if matched_prospect_id is not null then
    update admin_prospects
    set
      tercero_user_id = NEW.id,
      status = 'trial_started',
      updated_at = now()
    where id = matched_prospect_id;
  else
    insert into admin_prospects (name, agency_name, email, source, status, tercero_user_id)
    values (
      coalesce(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
      coalesce(NEW.raw_user_meta_data->>'agency_name', 'Unknown'),
      NEW.email,
      'direct_signup',
      'trial_started',
      NEW.id
    );
  end if;

  return NEW;
end;
$$;


ALTER FUNCTION "public"."admin_link_prospect_on_signup"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_schedule_workspace_deletion"("target_user_id" "uuid", "days" integer DEFAULT 14) RETURNS timestamp with time zone
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare v_when timestamptz;
begin
  if not public.is_superadmin() then
    raise exception 'Only a superadmin can schedule workspace deletion';
  end if;
  if days is null or days < 1 then
    raise exception 'days must be a positive integer';
  end if;
  if not exists (select 1 from agency_subscriptions where user_id = target_user_id) then
    raise exception 'Workspace not found';
  end if;
  v_when := now() + make_interval(days => days);
  update agency_subscriptions
     set scheduled_for_deletion_at = v_when, updated_at = now()
   where user_id = target_user_id;
  return v_when;
end;
$$;


ALTER FUNCTION "public"."admin_schedule_workspace_deletion"("target_user_id" "uuid", "days" integer) OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."agency_subscriptions" (
    "user_id" "uuid" NOT NULL,
    "plan_name" "text" DEFAULT 'ignite'::"text",
    "max_clients" integer,
    "max_storage_bytes" bigint,
    "current_storage_used" bigint DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "agency_name" "text",
    "logo_url" "text",
    "primary_color" "text" DEFAULT '#6366f1'::"text",
    "social_links" "jsonb" DEFAULT '{}'::"jsonb",
    "industry" "text",
    "platforms" "jsonb" DEFAULT '[]'::"jsonb",
    "email" "text",
    "mobile_number" "text",
    "description" "text",
    "next_invoice_number" integer DEFAULT 1 NOT NULL,
    "branding_agency_sidebar" boolean DEFAULT false,
    "branding_powered_by" boolean DEFAULT true,
    "billing_cycle" "text" DEFAULT 'monthly'::"text",
    "trial_ends_at" timestamp with time zone,
    "extra_client_price_inr" integer DEFAULT 500,
    "finance_subscriptions" boolean DEFAULT false,
    "calendar_export" boolean DEFAULT false,
    "finance_recurring_invoices" boolean DEFAULT false,
    "documents_collections" boolean DEFAULT false,
    "finance_accrual" boolean DEFAULT false,
    "campaigns" boolean DEFAULT false,
    "logo_horizontal_url" "text",
    "proposals_limit" integer DEFAULT 5,
    "max_team_members" integer,
    "subscription_ends_at" timestamp with time zone,
    "signatory_name" "text",
    "signatory_designation" "text",
    "signature_url" "text",
    "reports" boolean DEFAULT false NOT NULL,
    "scheduled_for_deletion_at" timestamp with time zone,
    "extra_seat_price_inr" integer,
    "chat" boolean DEFAULT false NOT NULL,
    "address" "text",
    "website" "text",
    "onboarding_completed_at" timestamp with time zone,
    "onboarding_skipped_steps" "text"[] DEFAULT '{}'::"text"[],
    CONSTRAINT "agency_subscriptions_billing_cycle_check" CHECK (("billing_cycle" = ANY (ARRAY['monthly'::"text", 'annual'::"text"])))
);


ALTER TABLE "public"."agency_subscriptions" OWNER TO "postgres";


COMMENT ON COLUMN "public"."agency_subscriptions"."address" IS 'Agency postal address. Rendered on invoice/proposal PDFs.';



COMMENT ON COLUMN "public"."agency_subscriptions"."website" IS 'Agency website. Rendered in the invoice PDF footer.';



COMMENT ON COLUMN "public"."agency_subscriptions"."onboarding_completed_at" IS 'Set when the owner finishes or dismisses the onboarding wizard. Replaces the per-device localStorage has_seen_welcome_* flag.';



COMMENT ON COLUMN "public"."agency_subscriptions"."onboarding_skipped_steps" IS 'Step keys the owner skipped (signatory | horizontal_logo | invite_team | first_client). Gates which rows the dashboard setup checklist may show; done-ness itself is derived from live data.';



CREATE OR REPLACE FUNCTION "public"."admin_update_subscription"("target_user_id" "uuid", "patch" "jsonb") RETURNS "public"."agency_subscriptions"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_existing public.agency_subscriptions;
  r public.agency_subscriptions;
begin
  if not public.is_superadmin() then
    raise exception 'Only a superadmin can update subscriptions';
  end if;

  select * into v_existing
    from public.agency_subscriptions
   where user_id = target_user_id;
  if not found then
    raise exception 'Workspace not found';
  end if;

  r := jsonb_populate_record(
        v_existing,
        (patch - 'user_id' - 'created_at' - 'current_storage_used' - 'scheduled_for_deletion_at')
      );

  update public.agency_subscriptions set
    plan_name                  = r.plan_name,
    max_clients                = r.max_clients,
    max_storage_bytes          = r.max_storage_bytes,
    is_active                  = r.is_active,
    agency_name                = r.agency_name,
    logo_url                   = r.logo_url,
    primary_color               = r.primary_color,
    social_links                = r.social_links,
    industry                    = r.industry,
    platforms                   = r.platforms,
    email                       = r.email,
    mobile_number               = r.mobile_number,
    description                 = r.description,
    next_invoice_number         = r.next_invoice_number,
    branding_agency_sidebar     = r.branding_agency_sidebar,
    branding_powered_by         = r.branding_powered_by,
    billing_cycle                = r.billing_cycle,
    trial_ends_at                = r.trial_ends_at,
    extra_client_price_inr       = r.extra_client_price_inr,
    finance_subscriptions        = r.finance_subscriptions,
    calendar_export               = r.calendar_export,
    finance_recurring_invoices    = r.finance_recurring_invoices,
    documents_collections         = r.documents_collections,
    finance_accrual               = r.finance_accrual,
    campaigns                     = r.campaigns,
    logo_horizontal_url           = r.logo_horizontal_url,
    proposals_limit               = r.proposals_limit,
    max_team_members              = r.max_team_members,
    subscription_ends_at          = r.subscription_ends_at,
    signatory_name                = r.signatory_name,
    signatory_designation         = r.signatory_designation,
    signature_url                 = r.signature_url,
    reports                       = r.reports,
    chat                          = r.chat,
    updated_at                    = now()
  where user_id = target_user_id
  returning * into r;

  return r;
end;
$$;


ALTER FUNCTION "public"."admin_update_subscription"("target_user_id" "uuid", "patch" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."advance_expense_billing_date"("expense_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE expenses
  SET next_billing_date = 
    CASE 
      WHEN billing_cycle = 'MONTHLY' THEN next_billing_date + INTERVAL '1 month'
      WHEN billing_cycle = 'QUARTERLY' THEN next_billing_date + INTERVAL '3 months'
      WHEN billing_cycle = 'YEARLY' THEN next_billing_date + INTERVAL '1 year'
      ELSE next_billing_date
    END,
    updated_at = NOW()
  WHERE id = expense_id;
END;
$$;


ALTER FUNCTION "public"."advance_expense_billing_date"("expense_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."advance_recurring_invoice_date"("p_recurring_invoice_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  rec recurring_invoices%ROWTYPE;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.can_access_finance() THEN
    RAISE EXCEPTION 'Insufficient permissions: finance access required';
  END IF;

  SELECT * INTO rec FROM recurring_invoices WHERE id = p_recurring_invoice_id;

  UPDATE recurring_invoices
  SET next_invoice_date = CASE rec.billing_cycle
    WHEN 'MONTHLY'    THEN rec.next_invoice_date + INTERVAL '1 month'
    WHEN 'QUARTERLY'  THEN rec.next_invoice_date + INTERVAL '3 months'
    WHEN 'YEARLY'     THEN rec.next_invoice_date + INTERVAL '1 year'
  END
  WHERE id = p_recurring_invoice_id;
END;
$$;


ALTER FUNCTION "public"."advance_recurring_invoice_date"("p_recurring_invoice_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."approve_internally"("p_post_version_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_post_id uuid; v_workspace_id uuid; v_created_by uuid; v_client_id uuid; v_title text;
BEGIN
  IF NOT public.is_workspace_admin() THEN
    RAISE EXCEPTION 'Only owner or admin can approve posts internally';
  END IF;

  SELECT post_id, created_by, client_id, title
    INTO v_post_id, v_created_by, v_client_id, v_title
  FROM post_versions WHERE id = p_post_version_id;

  v_workspace_id := public.get_my_agency_user_id();

  UPDATE post_versions SET status = 'READY'
  WHERE id = p_post_version_id AND status = 'SUBMITTED';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Can only approve SUBMITTED posts';
  END IF;

  INSERT INTO approval_events (post_version_id, post_id, actor_id, workspace_user_id, action)
  VALUES (p_post_version_id, v_post_id, auth.uid(), v_workspace_id, 'approved');

  PERFORM public.emit_notifications(
    v_workspace_id, auth.uid(), array[v_created_by],
    'post_status_changed', 'Your deliverable was approved', v_title,
    'post', v_post_id, '/clients/' || v_client_id || '/posts/' || v_post_id);
END;
$$;


ALTER FUNCTION "public"."approve_internally"("p_post_version_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_access_finance"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT public.is_workspace_admin();
$$;


ALTER FUNCTION "public"."can_access_finance"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_view_confidential_docs"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT public.is_workspace_admin();
$$;


ALTER FUNCTION "public"."can_view_confidential_docs"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cancel_workspace_deletion"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
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


ALTER FUNCTION "public"."cancel_workspace_deletion"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_client_limit"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  current_plan_limit INTEGER;
  has_subscription BOOLEAN;
  current_client_count INTEGER;
BEGIN
  -- CASE 1: If it's an INTERNAL client, just let it pass.
  IF NEW.is_internal = true THEN
    RETURN NEW;
  END IF;

  -- CASE 2: It's a PAYING CLIENT. Check the limit.

  -- A. Get the user's limit from their subscription, and whether a row exists at all
  -- (distinct from max_clients being NULL, which means "unlimited" on Trial/Quantum).
  SELECT true, max_clients INTO has_subscription, current_plan_limit
  FROM public.agency_subscriptions
  WHERE user_id = NEW.user_id;

  -- B. If no subscription row at all, block everything (Safety Net)
  IF has_subscription IS NULL THEN
    RAISE EXCEPTION 'No active subscription found for this user.';
  END IF;

  -- C. NULL max_clients means unlimited (Trial/Quantum) — skip the count check entirely.
  IF current_plan_limit IS NOT NULL THEN
    SELECT count(*) INTO current_client_count
    FROM public.clients
    WHERE user_id = NEW.user_id
    AND is_internal = false; -- crucial: ignores their internal agency

    IF current_client_count >= current_plan_limit THEN
      RAISE EXCEPTION 'Upgrade Required: You have reached the limit of % clients for your plan.', current_plan_limit;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."check_client_limit"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_email_exists"("p_email" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM auth.users WHERE email = lower(trim(p_email))
  );
END;
$$;


ALTER FUNCTION "public"."check_email_exists"("p_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_old_notifications"() RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  delete from public.notifications
  where created_at < now() - interval '30 days';
$$;


ALTER FUNCTION "public"."cleanup_old_notifications"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_new_post_with_version"("p_client_id" "uuid", "p_title" "text", "p_content" "text", "p_media_urls" "text"[], "p_platform" "text"[], "p_target_date" timestamp with time zone) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_post_id uuid;
  v_version_id uuid;
BEGIN
  -- 1. Create the base Post record
  INSERT INTO public.posts (client_id, title)
  VALUES (p_client_id, p_title)
  RETURNING id INTO v_post_id;

  -- 2. Create the first Version (v1.0)
  INSERT INTO public.post_versions (
    post_id, 
    client_id,
    title, 
    content, 
    media_urls, 
    platform, 
    version_number, 
    status,
    target_date -- Saving the intent here
  )
  VALUES (
    v_post_id, 
    p_client_id,
    p_title, 
    p_content, 
    p_media_urls, 
    p_platform, 
    1, 
    'DRAFT'::post_status,
    p_target_date
  )
  RETURNING id INTO v_version_id;

  RETURN v_post_id;
END;
$$;


ALTER FUNCTION "public"."create_new_post_with_version"("p_client_id" "uuid", "p_title" "text", "p_content" "text", "p_media_urls" "text"[], "p_platform" "text"[], "p_target_date" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_new_version"("p_post_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_old post_versions;
  v_new_id uuid;
  v_next_version int;
begin
  select pv.*
  into v_old
  from post_versions pv
  join posts p on p.current_version_id = pv.id
  where p.id = p_post_id;

  if v_old.status != 'APPROVED' then
    raise exception 'Only approved versions can be revised';
  end if;

  select max(version_number) + 1
  into v_next_version
  from post_versions
  where post_id = p_post_id;

  insert into post_versions (
    post_id,
    client_id,
    version_number,
    status,
    content,
    media_urls,
    platform,
    created_by
  )
  values (
    v_old.post_id,
    v_old.client_id,
    v_next_version,
    'DRAFT',
    v_old.content,
    v_old.media_urls,
    v_old.platform,
    auth.uid()
  )
  returning id into v_new_id;

  update posts
  set current_version_id = v_new_id
  where id = p_post_id;

  return v_new_id;
end;
$$;


ALTER FUNCTION "public"."create_new_version"("p_post_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_post_draft_v3"("p_client_id" "uuid", "p_title" "text", "p_content" "text", "p_media_urls" "text"[], "p_platform" "text"[], "p_user_id" "uuid", "p_target_date" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_admin_notes" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_post_id uuid;
    v_version_id uuid;
BEGIN
    -- Insert into 'posts' (Parent table)
    INSERT INTO public.posts (client_id)
    VALUES (p_client_id)
    RETURNING id INTO v_post_id;

    -- Insert into 'post_versions' (Content table)
    INSERT INTO public.post_versions (
        post_id, 
        client_id, 
        version_number, 
        status, 
        content, 
        media_urls, 
        platform, 
        created_by, 
        title, 
        target_date, 
        admin_notes
    )
    VALUES (
        v_post_id, 
        p_client_id, 
        1,          -- version_number
        'DRAFT',    -- status (cast automatically to post_status)
        p_content, 
        p_media_urls, 
        p_platform, 
        p_user_id, 
        p_title, 
        p_target_date, 
        p_admin_notes
    )
    RETURNING id INTO v_version_id;

    -- CRITICAL FIX: Update the 'current_version_id' column
    -- DO NOT use 'fk_current_version' here
    UPDATE public.posts 
    SET current_version_id = v_version_id 
    WHERE id = v_post_id;

    RETURN v_version_id;
END;
$$;


ALTER FUNCTION "public"."create_post_draft_v3"("p_client_id" "uuid", "p_title" "text", "p_content" "text", "p_media_urls" "text"[], "p_platform" "text"[], "p_user_id" "uuid", "p_target_date" timestamp with time zone, "p_admin_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_post_draft_v3"("p_client_id" "uuid", "p_title" "text", "p_content" "text", "p_media_urls" "text"[], "p_platform" "text"[], "p_user_id" "uuid", "p_target_date" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_admin_notes" "text" DEFAULT NULL::"text", "p_platform_schedules" "jsonb" DEFAULT NULL::"jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_post_id uuid;
    v_version_id uuid;
BEGIN
    INSERT INTO public.posts (client_id)
    VALUES (p_client_id)
    RETURNING id INTO v_post_id;

    INSERT INTO public.post_versions (
        post_id,
        client_id,
        version_number,
        status,
        content,
        media_urls,
        platform,
        created_by,
        title,
        target_date,
        admin_notes,
        platform_schedules
    )
    VALUES (
        v_post_id,
        p_client_id,
        1,
        'DRAFT',
        p_content,
        p_media_urls,
        p_platform,
        p_user_id,
        p_title,
        p_target_date,
        p_admin_notes,
        p_platform_schedules
    )
    RETURNING id INTO v_version_id;

    UPDATE public.posts
    SET current_version_id = v_version_id
    WHERE id = v_post_id;

    RETURN v_version_id;
END;
$$;


ALTER FUNCTION "public"."create_post_draft_v3"("p_client_id" "uuid", "p_title" "text", "p_content" "text", "p_media_urls" "text"[], "p_platform" "text"[], "p_user_id" "uuid", "p_target_date" timestamp with time zone, "p_admin_notes" "text", "p_platform_schedules" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_post_draft_v3"("p_client_id" "uuid", "p_title" "text", "p_content" "text", "p_media_urls" "text"[], "p_platform" "text"[], "p_user_id" "uuid", "p_target_date" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_admin_notes" "text" DEFAULT NULL::"text", "p_platform_schedules" "jsonb" DEFAULT NULL::"jsonb", "p_campaign_id" "uuid" DEFAULT NULL::"uuid") RETURNS "uuid"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_post_id    UUID;
    v_version_id UUID;
BEGIN
    INSERT INTO public.posts (client_id, campaign_id)
    VALUES (p_client_id, p_campaign_id)
    RETURNING id INTO v_post_id;

    INSERT INTO public.post_versions (
        post_id,
        client_id,
        version_number,
        status,
        content,
        media_urls,
        platform,
        created_by,
        title,
        target_date,
        admin_notes,
        platform_schedules
    )
    VALUES (
        v_post_id,
        p_client_id,
        1,
        'DRAFT',
        p_content,
        p_media_urls,
        p_platform,
        p_user_id,
        p_title,
        p_target_date,
        p_admin_notes,
        p_platform_schedules
    )
    RETURNING id INTO v_version_id;

    UPDATE public.posts
    SET current_version_id = v_version_id
    WHERE id = v_post_id;

    RETURN v_version_id;
END;
$$;


ALTER FUNCTION "public"."create_post_draft_v3"("p_client_id" "uuid", "p_title" "text", "p_content" "text", "p_media_urls" "text"[], "p_platform" "text"[], "p_user_id" "uuid", "p_target_date" timestamp with time zone, "p_admin_notes" "text", "p_platform_schedules" "jsonb", "p_campaign_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_post_draft_v3"("p_client_id" "uuid", "p_title" "text", "p_content" "text", "p_media_urls" "text"[], "p_platform" "text"[], "p_user_id" "uuid", "p_target_date" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_admin_notes" "text" DEFAULT NULL::"text", "p_platform_schedules" "jsonb" DEFAULT NULL::"jsonb", "p_campaign_id" "uuid" DEFAULT NULL::"uuid", "p_deliverable_type" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_post_id    UUID;
    v_version_id UUID;
BEGIN
    INSERT INTO public.posts (client_id, campaign_id)
    VALUES (p_client_id, p_campaign_id)
    RETURNING id INTO v_post_id;

    INSERT INTO public.post_versions (
        post_id,
        client_id,
        version_number,
        status,
        content,
        media_urls,
        platform,
        created_by,
        title,
        target_date,
        admin_notes,
        platform_schedules,
        deliverable_type
    )
    VALUES (
        v_post_id,
        p_client_id,
        1,
        'DRAFT',
        p_content,
        p_media_urls,
        p_platform,
        p_user_id,
        p_title,
        p_target_date,
        p_admin_notes,
        p_platform_schedules,
        p_deliverable_type
    )
    RETURNING id INTO v_version_id;

    UPDATE public.posts
    SET current_version_id = v_version_id
    WHERE id = v_post_id;

    RETURN v_version_id;
END;
$$;


ALTER FUNCTION "public"."create_post_draft_v3"("p_client_id" "uuid", "p_title" "text", "p_content" "text", "p_media_urls" "text"[], "p_platform" "text"[], "p_user_id" "uuid", "p_target_date" timestamp with time zone, "p_admin_notes" "text", "p_platform_schedules" "jsonb", "p_campaign_id" "uuid", "p_deliverable_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_revision_version"("p_parent_version_id" "uuid", "p_user_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_new_version_id UUID;
    v_post_id UUID;
BEGIN
    -- 1. Get the post_id from the parent so we know which post we are versioning
    SELECT post_id INTO v_post_id 
    FROM post_versions 
    WHERE id = p_parent_version_id;

    -- 2. ARCHIVE THE PARENT (Your specific requirement)
    -- This moves the old version to ARCHIVED status immediately
    UPDATE post_versions 
    SET status = 'ARCHIVED', 
        updated_at = now()
    WHERE id = p_parent_version_id;

    -- 3. Create the new DRAFT version (cloning data from the parent)
    INSERT INTO post_versions (
        post_id, 
        client_id, 
        version_number, 
        status, 
        content, 
        media_urls, 
        platform, 
        title, 
        target_date, 
        created_by
    )
    SELECT 
        post_id, 
        client_id, 
        version_number + 1, -- Increment version
        'DRAFT',            -- New version starts as Draft
        content, 
        media_urls, 
        platform, 
        title, 
        target_date, 
        p_user_id
    FROM post_versions
    WHERE id = p_parent_version_id
    RETURNING id INTO v_new_version_id;

    -- 4. Point the main "posts" pointer to the new version
    UPDATE posts 
    SET current_version_id = v_new_version_id 
    WHERE id = v_post_id;

    RETURN v_new_version_id;
END;
$$;


ALTER FUNCTION "public"."create_revision_version"("p_parent_version_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_revision_version"("p_parent_version_id" "uuid", "p_user_id" "uuid", "p_admin_notes" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_post_id uuid;
    v_new_version_id uuid;
    v_old_version_record RECORD;
BEGIN
    SELECT * INTO v_old_version_record
    FROM public.post_versions
    WHERE id = p_parent_version_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Parent version not found';
    END IF;

    v_post_id := v_old_version_record.post_id;

    INSERT INTO public.post_versions (
        post_id, client_id, title, content, media_urls,
        platform, status, version_number, created_by,
        target_date, admin_notes, platform_schedules, deliverable_type
    )
    VALUES (
        v_post_id,
        v_old_version_record.client_id,
        v_old_version_record.title,
        v_old_version_record.content,
        v_old_version_record.media_urls,
        v_old_version_record.platform,
        'DRAFT',
        v_old_version_record.version_number + 1,
        p_user_id,
        v_old_version_record.target_date,
        p_admin_notes,
        v_old_version_record.platform_schedules,
        v_old_version_record.deliverable_type
    )
    RETURNING id INTO v_new_version_id;

    UPDATE public.post_versions
    SET status = 'ARCHIVED'
    WHERE id = p_parent_version_id;

    UPDATE public.posts
    SET current_version_id = v_new_version_id
    WHERE id = v_post_id;

    RETURN v_new_version_id;
END;
$$;


ALTER FUNCTION "public"."create_revision_version"("p_parent_version_id" "uuid", "p_user_id" "uuid", "p_admin_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."decline_proposal"("p_token" "text", "p_reason" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_prospect_id uuid;
  v_prospect_status text;
  v_workspace_user_id uuid;
BEGIN
  UPDATE proposals
  SET
    status         = 'declined',
    declined_at    = now(),
    decline_reason = p_reason,
    updated_at     = now()
  WHERE share_token = p_token
    AND status NOT IN ('accepted', 'declined', 'archived')
  RETURNING prospect_id INTO v_prospect_id;

  IF v_prospect_id IS NOT NULL THEN
    SELECT status, user_id INTO v_prospect_status, v_workspace_user_id
    FROM prospects WHERE id = v_prospect_id;

    IF v_prospect_status IS NOT NULL
       AND v_prospect_status NOT IN ('won', 'lost') THEN
      UPDATE prospects
      SET status = 'lost', updated_at = now()
      WHERE id = v_prospect_id;

      INSERT INTO prospect_activities (prospect_id, user_id, type, body, occurred_at, metadata)
      VALUES (
        v_prospect_id,
        v_workspace_user_id,
        'status_change',
        'Status changed from ' || public.prospect_status_label(v_prospect_status) ||
          ' to Lost (client declined the proposal' ||
          CASE WHEN p_reason IS NOT NULL AND p_reason <> '' THEN ': ' || p_reason ELSE '' END ||
          ')',
        now(),
        jsonb_build_object(
          'from_status', v_prospect_status,
          'to_status', 'lost',
          'trigger', 'decline_proposal',
          'reason', p_reason
        )
      );
    END IF;
  END IF;
END;
$$;


ALTER FUNCTION "public"."decline_proposal"("p_token" "text", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."decrement_storage_used"("p_user_id" "uuid", "p_bytes" bigint) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
begin
  -- Deprecated no-op: storage usage is tracked by the storage.objects trigger.
  null;
end;
$$;


ALTER FUNCTION "public"."decrement_storage_used"("p_user_id" "uuid", "p_bytes" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_approval_events"("p_ids" "uuid"[]) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NOT public.is_workspace_admin() THEN
    RAISE EXCEPTION 'Only owner or admin can delete approval log entries';
  END IF;

  DELETE FROM approval_events
  WHERE id = ANY(p_ids)
    AND workspace_user_id = public.get_my_agency_user_id();
END;
$$;


ALTER FUNCTION "public"."delete_approval_events"("p_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_draft_post"("p_post_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Ensure ALL versions are DRAFT
  IF EXISTS (
    SELECT 1
    FROM post_versions
    WHERE post_id = p_post_id
      AND status <> 'DRAFT'
  ) THEN
    RAISE EXCEPTION
      'Only posts with DRAFT versions can be deleted';
  END IF;

  -- Delete versions first
  DELETE FROM post_versions WHERE post_id = p_post_id;

  -- Delete post container
  DELETE FROM posts WHERE id = p_post_id;
END;
$$;


ALTER FUNCTION "public"."delete_draft_post"("p_post_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."edit_draft"("p_version_id" "uuid", "p_content" "text", "p_media_urls" "text"[]) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
begin
  update post_versions
  set
    content = p_content,
    media_urls = coalesce(p_media_urls, media_urls)
  where id = p_version_id
    and status = 'DRAFT';

  if not found then
    raise exception 'Only DRAFT versions can be edited';
  end if;
end;
$$;


ALTER FUNCTION "public"."edit_draft"("p_version_id" "uuid", "p_content" "text", "p_media_urls" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."emit_notifications"("p_workspace_id" "uuid", "p_actor" "uuid", "p_recipients" "uuid"[], "p_type" "text", "p_title" "text", "p_body" "text" DEFAULT NULL::"text", "p_entity_type" "text" DEFAULT NULL::"text", "p_entity_id" "uuid" DEFAULT NULL::"uuid", "p_link" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.notifications
    (workspace_id, recipient_user_id, actor_user_id, type, title, body,
     entity_type, entity_id, link)
  select distinct
    p_workspace_id, r, p_actor, p_type, p_title, p_body,
    p_entity_type, p_entity_id, p_link
  from unnest(p_recipients) as r
  where r is not null
    and r is distinct from p_actor;
end;
$$;


ALTER FUNCTION "public"."emit_notifications"("p_workspace_id" "uuid", "p_actor" "uuid", "p_recipients" "uuid"[], "p_type" "text", "p_title" "text", "p_body" "text", "p_entity_type" "text", "p_entity_id" "uuid", "p_link" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_note_visibility_author_only"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF NEW.visibility IS DISTINCT FROM OLD.visibility
     AND OLD.created_by IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'only_the_author_can_change_note_visibility';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."enforce_note_visibility_author_only"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_owner_only_signatory"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF (
        NEW.signatory_name        IS DISTINCT FROM OLD.signatory_name
     OR NEW.signatory_designation IS DISTINCT FROM OLD.signatory_designation
     OR NEW.signature_url         IS DISTINCT FROM OLD.signature_url
     )
     AND auth.uid() IS NOT NULL
     AND NOT public.is_workspace_owner()
     AND NOT public.is_superadmin()
  THEN
    RAISE EXCEPTION 'Only the workspace owner can change the invoice signatory';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."enforce_owner_only_signatory"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_post_status_transition"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  allowed text[] := CASE OLD.status::text
    WHEN 'DRAFT'             THEN ARRAY['SUBMITTED','PENDING_APPROVAL','SCHEDULED','APPROVED','ARCHIVED']
    WHEN 'SUBMITTED'         THEN ARRAY['READY','CHANGES_REQUESTED','ARCHIVED']
    WHEN 'CHANGES_REQUESTED' THEN ARRAY['SUBMITTED','ARCHIVED']
    WHEN 'READY'             THEN ARRAY['PENDING_APPROVAL','SCHEDULED','APPROVED','ARCHIVED']
    WHEN 'PENDING_APPROVAL'  THEN ARRAY['SCHEDULED','NEEDS_REVISION','ARCHIVED']
    WHEN 'NEEDS_REVISION'    THEN ARRAY['ARCHIVED']
    WHEN 'SCHEDULED'         THEN ARRAY['PUBLISHED','ARCHIVED']
    WHEN 'APPROVED'          THEN ARRAY['DELIVERED','ARCHIVED']
    WHEN 'DELIVERED'         THEN ARRAY[]::text[]
    WHEN 'PUBLISHED'         THEN ARRAY[]::text[]
    WHEN 'ARCHIVED'          THEN ARRAY[]::text[]
    ELSE                          ARRAY[]::text[]
  END;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    IF NOT (NEW.status::text = ANY(allowed)) THEN
      RAISE EXCEPTION 'Invalid post status transition: % → %', OLD.status, NEW.status;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."enforce_post_status_transition"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_task_assignment"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare target_role text;
begin
  if new.assigned_to is null
     or (tg_op = 'UPDATE' and new.assigned_to is not distinct from old.assigned_to) then
    return new;
  end if;

  -- Self-assignment is always allowed. auth.uid() is the real authenticated
  -- caller regardless of this function's SECURITY DEFINER context, so this
  -- cannot be spoofed by setting assigned_to to someone else's id.
  if new.assigned_to = auth.uid() then
    return new;
  end if;

  select system_role into target_role
  from agency_members
  where agency_user_id = new.workspace_id
    and member_user_id = new.assigned_to
    and is_active = true;

  if target_role is null then
    raise exception 'Assignee is not an active member of this workspace';
  end if;

  if target_role in ('owner','superadmin') then
    raise exception 'Tasks cannot be assigned to the workspace owner';
  end if;

  return new;
end $$;


ALTER FUNCTION "public"."enforce_task_assignment"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_workspace_channel"() RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_workspace_id uuid := public.get_my_agency_user_id();
  v_channel_id uuid;
begin
  if v_workspace_id is null then
    raise exception 'not_a_workspace_member';
  end if;

  if not public.is_chat_enabled_for_workspace(v_workspace_id) then
    raise exception 'chat_not_available_on_plan';
  end if;

  select id into v_channel_id
  from public.chat_channels
  where workspace_id = v_workspace_id and type = 'workspace';

  if v_channel_id is null then
    insert into public.chat_channels (workspace_id, type)
    values (v_workspace_id, 'workspace')
    returning id into v_channel_id;
  end if;

  insert into public.chat_channel_members (channel_id, user_id)
  values (v_channel_id, auth.uid())
  on conflict (channel_id, user_id) do nothing;

  return v_channel_id;
end;
$$;


ALTER FUNCTION "public"."ensure_workspace_channel"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_invoice_from_template"("p_template_id" "uuid", "p_user_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    v_template record;
    v_next_num integer;
    v_invoice_number text;
    v_issue_date date := CURRENT_DATE;
    v_due_date date;
    v_next_billing_date date;
    v_invoice_id UUID;
BEGIN
    IF auth.uid() IS NOT NULL AND NOT public.can_access_finance() THEN
        RAISE EXCEPTION 'Insufficient permissions: finance access required';
    END IF;

    -- 1. Fetch and Lock template
    SELECT * INTO v_template
    FROM recurring_invoices
    WHERE id = p_template_id AND user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Template not found or access denied';
    END IF;

    -- 2. Get and Increment Invoice Counter (atomic)
    UPDATE agency_subscriptions
    SET next_invoice_number = next_invoice_number + 1
    WHERE user_id = p_user_id
    RETURNING (next_invoice_number - 1) INTO v_next_num;

    -- 3. Generate Invoice Number
    v_invoice_number := 'INV-' || TO_CHAR(v_issue_date, 'YYYY') || '-' || LPAD(COALESCE(v_next_num, 1)::text, 3, '0');

    -- 4. Calculate Due Date
    v_due_date := v_issue_date;
    IF v_template.payment_terms = 'Net 15' THEN
        v_due_date := v_issue_date + INTERVAL '15 days';
    ELSIF v_template.payment_terms = 'Net 30' THEN
        v_due_date := v_issue_date + INTERVAL '30 days';
    ELSIF v_template.payment_terms = 'Net 60' THEN
        v_due_date := v_issue_date + INTERVAL '60 days';
    END IF;

    -- 5. Calculate Next Billing Date
    v_next_billing_date := COALESCE(v_template.next_invoice_date, CURRENT_DATE);
    IF v_template.billing_cycle = 'MONTHLY' THEN
        v_next_billing_date := v_next_billing_date + INTERVAL '1 month';
    ELSIF v_template.billing_cycle = 'QUARTERLY' THEN
        v_next_billing_date := v_next_billing_date + INTERVAL '3 months';
    ELSIF v_template.billing_cycle = 'YEARLY' THEN
        v_next_billing_date := v_next_billing_date + INTERVAL '1 year';
    END IF;

    -- 6. Insert Invoice
    INSERT INTO invoices (
        user_id, client_id, invoice_number, status, issue_date, due_date,
        category, subtotal, total, notes, payment_terms
    ) VALUES (
        p_user_id, v_template.client_id, v_invoice_number, 'DRAFT', v_issue_date, v_due_date,
        v_template.category, v_template.amount, v_template.amount, v_template.notes, v_template.payment_terms
    ) RETURNING id INTO v_invoice_id;

    -- 7. Insert Invoice Item
    INSERT INTO invoice_items (
        invoice_id, description, quantity, unit_price, total
    ) VALUES (
        v_invoice_id, COALESCE(v_template.description, v_template.category), 1, v_template.amount, v_template.amount
    );

    -- 8. Update Template
    UPDATE recurring_invoices
    SET next_invoice_date = v_next_billing_date,
        last_generated_at = NOW()
    WHERE id = p_template_id;

    RETURN v_invoice_id;
END;
$$;


ALTER FUNCTION "public"."generate_invoice_from_template"("p_template_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_proposal_token"("p_proposal_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_token            text;
  v_agency_user_id   uuid;
BEGIN
  -- Verify proposal exists and caller owns it
  SELECT agency_user_id INTO v_agency_user_id
  FROM proposals
  WHERE id = p_proposal_id;

  IF v_agency_user_id IS NULL THEN
    RAISE EXCEPTION 'Proposal not found';
  END IF;

  IF get_my_agency_user_id() IS DISTINCT FROM v_agency_user_id THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  v_token := gen_random_uuid()::text;

  UPDATE proposals
  SET share_token = v_token,
      updated_at  = now()
  WHERE id = p_proposal_id;

  RETURN v_token;
END;
$$;


ALTER FUNCTION "public"."generate_proposal_token"("p_proposal_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_version_token"("p_version_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
    v_token text;
BEGIN
    INSERT INTO public.share_tokens (post_version_id)
    VALUES (p_version_id)
    RETURNING token INTO v_token;
    RETURN v_token;
END;
$$;


ALTER FUNCTION "public"."generate_version_token"("p_version_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_agency_branding_by_token"("p_token" "text") RETURNS TABLE("agency_name" "text", "logo_url" "text", "logo_horizontal_url" "text", "primary_color" "text", "branding_agency_sidebar" boolean, "branding_powered_by" boolean)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT
    s.agency_name,
    s.logo_url,
    s.logo_horizontal_url,
    s.primary_color,
    s.branding_agency_sidebar,
    s.branding_powered_by
  FROM public.share_tokens st
  JOIN public.post_versions pv ON pv.id = st.post_version_id
  JOIN public.clients c        ON c.id  = pv.client_id
  JOIN public.agency_subscriptions s ON s.user_id = c.user_id
  WHERE st.token = p_token
    AND st.expires_at > now()
    AND st.is_active = true;
$$;


ALTER FUNCTION "public"."get_agency_branding_by_token"("p_token" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_agency_branding_by_token"("p_token" "text") IS 'Public review branding lookup. Returns branding columns only, gated on a live share token — replaces the direct agency_subscriptions read from PublicReview.';



CREATE OR REPLACE FUNCTION "public"."get_approval_log"("p_action" "text" DEFAULT NULL::"text", "p_limit" integer DEFAULT 25, "p_offset" integer DEFAULT 0) RETURNS TABLE("id" "uuid", "post_version_id" "uuid", "post_id" "uuid", "action" "text", "notes" "text", "created_at" timestamp with time zone, "post_title" "text", "post_content" "text", "post_media_urls" "text"[], "client_id" "uuid", "client_name" "text", "client_logo_url" "text", "actor_name" "text", "actor_email" "text", "actor_avatar_url" "text", "submitter_name" "text", "submitter_email" "text", "submitter_avatar_url" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    ae.id,
    ae.post_version_id,
    ae.post_id,
    ae.action,
    ae.notes,
    ae.created_at,
    pv.title                                                        AS post_title,
    pv.content                                                      AS post_content,
    pv.media_urls                                                   AS post_media_urls,
    c.id                                                            AS client_id,
    c.name                                                          AS client_name,
    c.logo_url                                                      AS client_logo_url,
    COALESCE(
      (actor.raw_user_meta_data->>'full_name')::text,
      actor.email::text
    )                                                               AS actor_name,
    actor.email::text                                               AS actor_email,
    (actor.raw_user_meta_data->>'avatar_url')::text                 AS actor_avatar_url,
    COALESCE(
      (submitter.raw_user_meta_data->>'full_name')::text,
      submitter.email::text
    )                                                               AS submitter_name,
    submitter.email::text                                           AS submitter_email,
    (submitter.raw_user_meta_data->>'avatar_url')::text             AS submitter_avatar_url
  FROM   approval_events ae
  JOIN   post_versions pv   ON pv.id  = ae.post_version_id
  JOIN   posts         p    ON p.id   = ae.post_id
  JOIN   clients       c    ON c.id   = p.client_id
  JOIN   auth.users    actor      ON actor.id = ae.actor_id
  LEFT JOIN auth.users submitter  ON submitter.id = pv.submitted_by
  WHERE  ae.workspace_user_id = public.get_my_agency_user_id()
    AND (p_action IS NULL OR ae.action = p_action)
  ORDER BY ae.created_at DESC
  LIMIT  p_limit
  OFFSET p_offset;
$$;


ALTER FUNCTION "public"."get_approval_log"("p_action" "text", "p_limit" integer, "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_approval_log_count"("p_action" "text" DEFAULT NULL::"text") RETURNS bigint
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT COUNT(*)
  FROM approval_events
  WHERE workspace_user_id = public.get_my_agency_user_id()
    AND (p_action IS NULL OR action = p_action);
$$;


ALTER FUNCTION "public"."get_approval_log_count"("p_action" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_campaign_analytics"("p_campaign_id" "uuid") RETURNS TABLE("total_posts" bigint, "published_posts" bigint, "on_time_posts" bigint, "avg_approval_days" numeric, "platform_distribution" "jsonb", "budget" numeric, "total_invoiced" numeric, "total_collected" numeric)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_campaign campaigns%ROWTYPE;
  v_fin boolean := public.can_access_finance();
BEGIN
  SELECT * INTO v_campaign FROM campaigns WHERE id = p_campaign_id;
  RETURN QUERY
  SELECT
    COUNT(p.id)::BIGINT,
    COUNT(p.id) FILTER (WHERE pv.status = 'PUBLISHED')::BIGINT,
    COUNT(p.id) FILTER (
      WHERE pv.status = 'PUBLISHED'
        AND pv.published_at IS NOT NULL
        AND pv.target_date  IS NOT NULL
        AND pv.published_at <= pv.target_date::TIMESTAMPTZ
    )::BIGINT,
    ROUND(
      AVG(
        EXTRACT(EPOCH FROM (pv.updated_at - pv.created_at)) / 86400.0
      ) FILTER (
        WHERE pv.status IN ('SCHEDULED', 'PUBLISHED')
          AND pv.updated_at > pv.created_at
      ),
      1
    ),
    COALESCE(
      (SELECT jsonb_object_agg(plat, cnt) FROM (
        SELECT unnest(pv2.platform) AS plat, COUNT(*) AS cnt
        FROM posts p2
        JOIN post_versions pv2 ON pv2.id = p2.current_version_id
        WHERE p2.campaign_id = p_campaign_id
        GROUP BY plat
      ) sub),
      '{}'::jsonb
    ),
    CASE WHEN v_fin THEN v_campaign.budget ELSE NULL END,
    CASE WHEN v_fin THEN COALESCE(SUM(i.total) FILTER (WHERE i.status IN ('SENT','OVERDUE','PAID')), 0) ELSE NULL END,
    CASE WHEN v_fin THEN COALESCE(SUM(i.total) FILTER (WHERE i.status = 'PAID'), 0) ELSE NULL END
  FROM campaigns c
  LEFT JOIN posts p ON p.campaign_id = c.id
  LEFT JOIN post_versions pv ON pv.id = p.current_version_id
  LEFT JOIN invoices i ON i.campaign_id = p_campaign_id
  WHERE c.id = p_campaign_id
  GROUP BY v_campaign.budget;
END;
$$;


ALTER FUNCTION "public"."get_campaign_analytics"("p_campaign_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_campaign_by_review_token"("p_token" "uuid") RETURNS TABLE("campaign_id" "uuid", "campaign_name" "text", "goal" "text", "agency_name" "text", "logo_url" "text", "branding_agency_sidebar" boolean, "branding_powered_by" boolean, "posts" "jsonb")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT
    c.id,
    c.name,
    c.goal,
    ags.agency_name,
    ags.logo_url,
    ags.branding_agency_sidebar,
    ags.branding_powered_by,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'post_id',        p.id,
          'title',          pv.title,
          'content',        pv.content,
          'platform',       pv.platform,
          'target_date',    pv.target_date,
          'media_urls',     pv.media_urls,
          'status',         pv.status,
          'version_number', pv.version_number,
          'review_token',   st.token
        ) ORDER BY pv.target_date NULLS LAST
      ) FILTER (WHERE pv.status = 'PENDING_APPROVAL'),
      '[]'::jsonb
    )
  FROM campaigns c
  JOIN agency_subscriptions ags ON ags.user_id = c.user_id
  LEFT JOIN posts p ON p.campaign_id = c.id
  LEFT JOIN post_versions pv ON pv.id = p.current_version_id
  LEFT JOIN LATERAL (
    SELECT token FROM share_tokens
    WHERE post_version_id = pv.id
      AND expires_at > now()
      AND is_active = true
    ORDER BY created_at DESC
    LIMIT 1
  ) st ON true
  WHERE c.review_token = p_token
    AND c.review_token_active = true
  GROUP BY c.id, ags.agency_name, ags.logo_url, ags.branding_agency_sidebar, ags.branding_powered_by;
$$;


ALTER FUNCTION "public"."get_campaign_by_review_token"("p_token" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_campaigns_with_post_summary"("p_user_id" "uuid", "p_client_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("id" "uuid", "client_id" "uuid", "client_name" "text", "client_avatar" "text", "name" "text", "goal" "text", "description" "text", "status" "text", "start_date" "date", "end_date" "date", "created_at" timestamp with time zone, "updated_at" timestamp with time zone, "total_posts" bigint, "draft_count" bigint, "pending_count" bigint, "revision_count" bigint, "approved_count" bigint, "scheduled_count" bigint, "published_count" bigint, "archived_count" bigint)
    LANGUAGE "sql" STABLE
    AS $$
  SELECT
    c.id, c.client_id,
    cl.name        AS client_name,
    cl.logo_url    AS client_avatar,
    c.name, c.goal, c.description, c.status,
    c.start_date, c.end_date, c.created_at, c.updated_at,
    COUNT(p.id)                                                                        AS total_posts,
    COUNT(p.id) FILTER (WHERE pv.status = 'DRAFT'::post_status)                       AS draft_count,
    COUNT(p.id) FILTER (WHERE pv.status = 'PENDING_APPROVAL'::post_status)             AS pending_count,
    COUNT(p.id) FILTER (WHERE pv.status = 'NEEDS_REVISION'::post_status)               AS revision_count,
    COUNT(p.id) FILTER (WHERE pv.status = 'APPROVED'::post_status)                     AS approved_count,
    COUNT(p.id) FILTER (WHERE pv.status = 'SCHEDULED'::post_status)                    AS scheduled_count,
    COUNT(p.id) FILTER (WHERE pv.status = 'PUBLISHED'::post_status)                    AS published_count,
    COUNT(p.id) FILTER (WHERE pv.status = 'ARCHIVED'::post_status)                     AS archived_count
  FROM campaigns c
  LEFT JOIN clients cl ON cl.id = c.client_id
  LEFT JOIN posts p ON p.campaign_id = c.id
  LEFT JOIN post_versions pv ON pv.id = p.current_version_id
  WHERE c.user_id = p_user_id
    AND (p_client_id IS NULL OR c.client_id = p_client_id)
  GROUP BY c.id, cl.name, cl.logo_url
  ORDER BY c.created_at DESC;
$$;


ALTER FUNCTION "public"."get_campaigns_with_post_summary"("p_user_id" "uuid", "p_client_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_client_report"("p_client_id" "uuid") RETURNS "jsonb"
    LANGUAGE "sql" STABLE
    AS $$
  SELECT jsonb_build_object(
    'client', (
      SELECT jsonb_build_object(
        'id', c.id, 'name', c.name, 'logo_url', c.logo_url,
        'industry', c.industry, 'email', c.email, 'website', c.website,
        'created_at', c.created_at
      )
      FROM clients c WHERE c.id = p_client_id
    ),
    'deliverables', (
      SELECT jsonb_build_object(
        'total', COALESCE(SUM(cnt), 0),
        'by_status', COALESCE(jsonb_object_agg(status, cnt) FILTER (WHERE status IS NOT NULL), '{}'::jsonb)
      )
      FROM (
        SELECT pv.status::text AS status, COUNT(*) AS cnt
        FROM posts p
        JOIN post_versions pv ON pv.id = p.current_version_id
        WHERE p.client_id = p_client_id
        GROUP BY pv.status
      ) s
    ),
    'campaigns', (
      SELECT jsonb_build_object(
        'total', COALESCE(COUNT(*), 0),
        'budget_allocated', COALESCE(SUM(budget), 0)
      )
      FROM campaigns WHERE client_id = p_client_id
    ),
    'finance', (
      SELECT jsonb_build_object(
        'billed',      COALESCE(SUM(total) FILTER (WHERE status IN ('SENT','PAID','OVERDUE')), 0),
        'collected',   COALESCE(SUM(total) FILTER (WHERE status = 'PAID'), 0),
        'outstanding', COALESCE(SUM(total) FILTER (WHERE status IN ('SENT','OVERDUE')), 0),
        'overdue',     COALESCE(SUM(total) FILTER (WHERE status = 'OVERDUE'), 0),
        'invoice_count', COALESCE(COUNT(*), 0)
      )
      FROM invoices WHERE client_id = p_client_id
    ),
    'proposals', (
      SELECT jsonb_build_object(
        'sent',      COALESCE(COUNT(*) FILTER (WHERE status <> 'draft'), 0),
        'accepted',  COALESCE(COUNT(*) FILTER (WHERE status = 'accepted'), 0),
        'value_won', COALESCE(SUM(total_value) FILTER (WHERE status = 'accepted'), 0)
      )
      FROM proposals WHERE client_id = p_client_id
    ),
    'documents', (
      SELECT jsonb_build_object(
        'count', COALESCE(COUNT(*), 0),
        'total_bytes', COALESCE(SUM(file_size_bytes), 0)
      )
      FROM client_documents WHERE client_id = p_client_id
    ),
    'pipeline', (
      SELECT jsonb_build_object('next_deliverable_at', next_post_at)
      FROM client_pipeline_analytics WHERE client_id = p_client_id
    )
  );
$$;


ALTER FUNCTION "public"."get_client_report"("p_client_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_clients_with_pipeline"("p_user_id" "uuid", "p_search" "text" DEFAULT ''::"text", "p_industry" "text" DEFAULT 'all'::"text", "p_tier" "text" DEFAULT 'all'::"text", "p_urgency" "text" DEFAULT 'all'::"text", "p_status" "text" DEFAULT 'ACTIVE'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE
    AS $$
DECLARE
  v_result JSONB;
BEGIN
  WITH all_stats AS (
    SELECT
      c.id as client_id,
      c.is_internal,
      MIN(COALESCE(s.scheduled_for, pv.target_date))
        FILTER (WHERE pv.status IN ('DRAFT', 'PENDING_APPROVAL', 'NEEDS_REVISION', 'SCHEDULED', 'APPROVED')
                AND COALESCE(s.scheduled_for, pv.target_date) > (now() - interval '1 year')) as next_scheduled
    FROM clients c
    LEFT JOIN post_versions pv ON c.id = pv.client_id
    LEFT JOIN schedules s ON pv.id = s.post_version_id
    WHERE c.user_id = p_user_id
      AND (p_status = 'all' OR c.status = p_status)
    GROUP BY c.id, c.is_internal
  ),
  global_counts AS (
    SELECT
      jsonb_build_object(
        'all', COUNT(*) FILTER (WHERE is_internal = false),
        'urgent', COUNT(*) FILTER (WHERE is_internal = false AND next_scheduled < (now() + interval '24 hours')),
        'upcoming', COUNT(*) FILTER (WHERE is_internal = false AND next_scheduled >= (now() + interval '24 hours') AND next_scheduled < (now() + interval '48 hours')),
        'idle', COUNT(*) FILTER (WHERE is_internal = false AND next_scheduled IS NULL)
      ) as counts
    FROM all_stats
  ),
  filtered_list AS (
    SELECT
      c.id, c.name, c.status, c.client_type, c.logo_url, c.tier, c.industry,
      c.platforms, c.created_at, c.is_internal,
      COALESCE(COUNT(pv.id) FILTER (WHERE pv.status = 'DRAFT'), 0) as drafts,
      COALESCE(COUNT(pv.id) FILTER (WHERE pv.status = 'PENDING_APPROVAL'), 0) as pending,
      COALESCE(COUNT(pv.id) FILTER (WHERE pv.status = 'NEEDS_REVISION'), 0) as revisions,
      COALESCE(COUNT(pv.id) FILTER (WHERE pv.status = 'APPROVED'), 0) as approved,
      COALESCE(COUNT(pv.id) FILTER (WHERE pv.status = 'SCHEDULED'), 0) as scheduled,
      MIN(COALESCE(s.scheduled_for, pv.target_date)) FILTER (WHERE pv.status IN ('DRAFT', 'PENDING_APPROVAL', 'NEEDS_REVISION', 'SCHEDULED', 'APPROVED')) as next_scheduled,
      (SELECT COUNT(*) FROM campaigns WHERE client_id = c.id AND status = 'Active') as active_campaigns,
      ROUND(
        COALESCE(
          (SELECT SUM(t.amount) FROM transactions t
           WHERE t.client_id = c.id AND t.type = 'INCOME' AND t.status = 'PAID' AND t.category ILIKE '%retainer%'
          ) / NULLIF(GREATEST(EXTRACT(EPOCH FROM (NOW() - c.created_at)) / (30.44 * 86400), 1), 0),
          0
        )
      , 2) AS avg_monthly_retainer,
      ROUND(
        CASE
          WHEN COALESCE((SELECT SUM(t.amount) FROM transactions t WHERE t.client_id = c.id AND t.type = 'INCOME' AND t.status = 'PAID'), 0) > 0
          THEN (
            COALESCE((SELECT SUM(t.amount) FROM transactions t WHERE t.client_id = c.id AND t.type = 'INCOME' AND t.status = 'PAID'), 0)
            - COALESCE((SELECT SUM(t.amount) FROM transactions t WHERE t.client_id = c.id AND t.type = 'EXPENSE' AND t.status = 'PAID'), 0)
          ) / (SELECT SUM(t.amount) FROM transactions t WHERE t.client_id = c.id AND t.type = 'INCOME' AND t.status = 'PAID') * 100
          ELSE NULL
        END
      , 1) AS profit_margin
    FROM clients c
    LEFT JOIN post_versions pv ON c.id = pv.client_id
    LEFT JOIN schedules s ON pv.id = s.post_version_id
    WHERE c.user_id = p_user_id
      AND (p_status = 'all' OR c.status = p_status)
    GROUP BY c.id
    HAVING
      (p_search = '' OR c.name ILIKE '%' || p_search || '%')
      AND (p_industry = 'all' OR c.industry = p_industry)
      AND (p_tier = 'all' OR c.tier::text = p_tier)
      AND (
        p_urgency = 'all' OR
        (p_urgency = 'urgent' AND MIN(COALESCE(s.scheduled_for, pv.target_date)) FILTER (WHERE pv.status IN ('DRAFT', 'PENDING_APPROVAL', 'NEEDS_REVISION', 'SCHEDULED', 'APPROVED')) < (now() + interval '24 hours')) OR
        (p_urgency = 'upcoming' AND MIN(COALESCE(s.scheduled_for, pv.target_date)) FILTER (WHERE pv.status IN ('DRAFT', 'PENDING_APPROVAL', 'NEEDS_REVISION', 'SCHEDULED', 'APPROVED')) >= (now() + interval '24 hours') AND MIN(COALESCE(s.scheduled_for, pv.target_date)) FILTER (WHERE pv.status IN ('DRAFT', 'PENDING_APPROVAL', 'NEEDS_REVISION', 'SCHEDULED', 'APPROVED')) < (now() + interval '48 hours')) OR
        (p_urgency = 'idle' AND MIN(COALESCE(s.scheduled_for, pv.target_date)) FILTER (WHERE pv.status IN ('DRAFT', 'PENDING_APPROVAL', 'NEEDS_REVISION', 'SCHEDULED', 'APPROVED')) IS NULL)
      )
  )
  SELECT jsonb_build_object(
    'clients', COALESCE((SELECT jsonb_agg(filtered_list) FROM filtered_list), '[]'::jsonb),
    'counts', (SELECT counts FROM global_counts)
  ) INTO v_result;

  RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."get_clients_with_pipeline"("p_user_id" "uuid", "p_search" "text", "p_industry" "text", "p_tier" "text", "p_urgency" "text", "p_status" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_global_calendar"("p_user_id" "uuid", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone) RETURNS TABLE("post_id" "uuid", "version_id" "uuid", "version_number" integer, "title" "text", "content" "text", "status" "public"."post_status", "platforms" "text"[], "media_urls" "text"[], "target_date" timestamp with time zone, "client_id" "uuid", "client_name" "text", "client_logo" "text", "created_by" "uuid")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id AS post_id,
        pv.id AS version_id,
        pv.version_number,
        pv.title,
        pv.content,
        pv.status,
        pv.platform AS platforms,
        pv.media_urls,
        pv.target_date,
        p.client_id,
        c.name AS client_name,
        c.logo_url AS client_logo,
        p.created_by
    FROM public.posts p
    JOIN public.post_versions pv ON p.id = pv.post_id
    JOIN public.clients c ON p.client_id = c.id
    WHERE c.user_id = p_user_id
      AND pv.target_date >= p_start_date
      AND pv.target_date <= p_end_date
      AND pv.id = p.current_version_id;
END;
$$;


ALTER FUNCTION "public"."get_global_calendar"("p_user_id" "uuid", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_global_calendar_posts"("user_id" "uuid", "start_date" timestamp without time zone, "end_date" timestamp without time zone) RETURNS TABLE("post_id" "uuid", "version_id" "uuid", "version_number" integer, "title" "text", "content" "text", "status" "public"."post_status", "platforms" "text"[], "media_urls" "text"[], "target_date" timestamp with time zone, "client_id" "uuid", "client_name" "text", "client_logo" "text")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id AS post_id,
    pv.id AS version_id,
    pv.version_number, -- Ensure this is mapping to the integer, not the UUID
    pv.title,
    pv.content,
    pv.status,
    pv.platform as platforms,
    pv.media_urls, -- Fetching the array of media URLs
    pv.target_date,
    c.id AS client_id,
    c.name AS client_name,
    c.logo_url AS client_logo
  FROM posts p
  JOIN post_versions pv ON p.id = pv.post_id
  JOIN clients c ON p.client_id = c.id
  WHERE p.created_by = user_id 
    AND pv.target_date BETWEEN start_date AND end_date
    AND pv.id = p.current_version_id; -- Typically you only want current versions on the calendar
END;
$$;


ALTER FUNCTION "public"."get_global_calendar_posts"("user_id" "uuid", "start_date" timestamp without time zone, "end_date" timestamp without time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_invite_by_token"("p_token" "text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_invite              agency_invites%rowtype;
  v_agency_name         text;
  v_logo_url            text;
  v_logo_horizontal_url text;
begin
  select * into v_invite
  from agency_invites
  where token = p_token
    and expires_at > now();

  if not found then
    return json_build_object('valid', false, 'error', 'This invite link is invalid or has expired.');
  end if;

  select agency_name, logo_url, logo_horizontal_url
  into v_agency_name, v_logo_url, v_logo_horizontal_url
  from agency_subscriptions where user_id = v_invite.agency_user_id;

  return json_build_object(
    'valid',               true,
    'agency_name',         v_agency_name,
    'logo_url',            v_logo_url,
    'logo_horizontal_url', v_logo_horizontal_url,
    'system_role',         coalesce(v_invite.system_role, 'member')
  );
end;
$$;


ALTER FUNCTION "public"."get_invite_by_token"("p_token" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_agency_user_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT COALESCE(
    (SELECT user_id FROM agency_subscriptions WHERE user_id = auth.uid()),
    (SELECT agency_user_id FROM agency_members
     WHERE member_user_id = auth.uid() AND is_active = true
     LIMIT 1)
  )
$$;


ALTER FUNCTION "public"."get_my_agency_user_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_chat_channels"() RETURNS TABLE("channel_id" "uuid", "type" "text", "last_read_at" timestamp with time zone, "other_user_id" "uuid", "other_user_name" "text", "last_message_at" timestamp with time zone, "last_message_body" "text", "last_message_author_id" "uuid", "last_message_author_name" "text", "unread_count" bigint, "has_unread_mention" boolean)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  select
    cm.channel_id,
    c.type,
    cm.last_read_at,
    (
      select cm2.user_id from public.chat_channel_members cm2
      where cm2.channel_id = cm.channel_id and cm2.user_id <> auth.uid()
      limit 1
    ) as other_user_id,
    (
      select msg.author_name from public.chat_messages msg
      where msg.channel_id = cm.channel_id
        and msg.author_user_id is distinct from auth.uid()
      order by msg.created_at desc
      limit 1
    ) as other_user_name,
    lm.created_at as last_message_at,
    lm.body as last_message_body,
    lm.author_user_id as last_message_author_id,
    lm.author_name as last_message_author_name,
    (
      select count(*) from public.chat_messages msg
      where msg.channel_id = cm.channel_id
        and msg.deleted_at is null
        -- `is distinct from` not `<>`: author_user_id is nullable now, and
        -- `null <> uuid` is null, which would drop a deleted author's
        -- messages out of the unread count entirely.
        and msg.author_user_id is distinct from auth.uid()
        and msg.created_at > coalesce(cm.last_read_at, 'epoch'::timestamptz)
    ) as unread_count,
    exists (
      select 1 from public.chat_messages msg
      where msg.channel_id = cm.channel_id
        and msg.deleted_at is null
        and msg.author_user_id is distinct from auth.uid()
        and msg.created_at > coalesce(cm.last_read_at, 'epoch'::timestamptz)
        and auth.uid() = any(msg.mentioned_uids)
    ) as has_unread_mention
  from public.chat_channel_members cm
  join public.chat_channels c on c.id = cm.channel_id
  left join lateral (
    select body, created_at, author_user_id, author_name
    from public.chat_messages
    where channel_id = cm.channel_id and deleted_at is null
    order by created_at desc
    limit 1
  ) lm on true
  where cm.user_id = auth.uid()
  order by coalesce(lm.created_at, cm.created_at) desc;
$$;


ALTER FUNCTION "public"."get_my_chat_channels"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_submissions"("p_status" "text" DEFAULT NULL::"text", "p_page" integer DEFAULT 0, "p_page_size" integer DEFAULT 25) RETURNS TABLE("submission_event_id" "uuid", "submitted_at" timestamp with time zone, "post_version_id" "uuid", "post_id" "uuid", "post_title" "text", "post_content" "text", "post_media_urls" "text"[], "post_platform" "text"[], "current_status" "text", "client_id" "uuid", "client_name" "text", "client_logo_url" "text", "decision_action" "text", "decision_at" timestamp with time zone, "decision_notes" "text", "actor_name" "text", "actor_email" "text", "actor_avatar_url" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    ae.id                                                         AS submission_event_id,
    ae.created_at                                                 AS submitted_at,
    pv.id                                                         AS post_version_id,
    p.id                                                          AS post_id,
    pv.title                                                      AS post_title,
    pv.content                                                    AS post_content,
    pv.media_urls                                                 AS post_media_urls,
    pv.platform                                                   AS post_platform,
    pv.status::text                                               AS current_status,
    c.id                                                          AS client_id,
    c.name                                                        AS client_name,
    c.logo_url                                                    AS client_logo_url,
    da.action                                                     AS decision_action,
    da.created_at                                                 AS decision_at,
    da.notes                                                      AS decision_notes,
    COALESCE(du.raw_user_meta_data->>'full_name', du.email)::text AS actor_name,
    du.email::text                                                AS actor_email,
    (du.raw_user_meta_data->>'avatar_url')::text                  AS actor_avatar_url
  FROM public.approval_events ae
  JOIN public.post_versions pv ON pv.id = ae.post_version_id
  JOIN public.posts p          ON p.id  = ae.post_id
  JOIN public.clients c        ON c.id  = p.client_id
  LEFT JOIN LATERAL (
    SELECT ae2.action, ae2.created_at, ae2.notes, ae2.actor_id
    FROM public.approval_events ae2
    WHERE ae2.post_version_id = ae.post_version_id
      AND ae2.action <> 'submitted'
    ORDER BY ae2.created_at DESC
    LIMIT 1
  ) da ON true
  LEFT JOIN auth.users du ON du.id = da.actor_id
  WHERE ae.action = 'submitted'
    AND ae.actor_id = auth.uid()
    AND ae.workspace_user_id = public.get_my_agency_user_id()
    AND (p_status IS NULL OR pv.status::text = p_status)
  ORDER BY ae.created_at DESC
  LIMIT  p_page_size
  OFFSET p_page * p_page_size;
END;
$$;


ALTER FUNCTION "public"."get_my_submissions"("p_status" "text", "p_page" integer, "p_page_size" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_submissions_count"("p_status" "text" DEFAULT NULL::"text") RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_count bigint;
BEGIN
  SELECT COUNT(*)
  INTO v_count
  FROM public.approval_events ae
  JOIN public.post_versions pv ON pv.id = ae.post_version_id
  WHERE ae.action = 'submitted'
    AND ae.actor_id = auth.uid()
    AND ae.workspace_user_id = public.get_my_agency_user_id()
    AND (p_status IS NULL OR pv.status::text = p_status);
  RETURN v_count;
END;
$$;


ALTER FUNCTION "public"."get_my_submissions_count"("p_status" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_workspace_owner"() RETURNS TABLE("user_id" "uuid", "email" "text", "first_name" "text", "last_name" "text", "full_name" "text", "avatar_url" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  select
    au.id,
    au.email::text,
    (au.raw_user_meta_data->>'first_name')::text,
    (au.raw_user_meta_data->>'last_name')::text,
    coalesce((au.raw_user_meta_data->>'full_name')::text, au.email::text),
    (au.raw_user_meta_data->>'avatar_url')::text
  from auth.users au
  where au.id = public.get_my_agency_user_id();
$$;


ALTER FUNCTION "public"."get_my_workspace_owner"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_or_create_dm_channel"("p_other_user_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_workspace_id uuid := public.get_my_agency_user_id();
  v_caller uuid := auth.uid();
  v_channel_id uuid;
  v_is_valid_participant boolean;
begin
  if v_workspace_id is null then
    raise exception 'not_a_workspace_member';
  end if;

  if not public.is_chat_enabled_for_workspace(v_workspace_id) then
    raise exception 'chat_not_available_on_plan';
  end if;

  if p_other_user_id is null or p_other_user_id = v_caller then
    raise exception 'invalid_dm_participant';
  end if;

  select
    p_other_user_id = v_workspace_id
    or exists (
      select 1 from public.agency_members
      where agency_user_id = v_workspace_id
        and member_user_id = p_other_user_id
        and is_active = true
    )
  into v_is_valid_participant;

  if not v_is_valid_participant then
    raise exception 'invalid_dm_participant';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(v_workspace_id::text || least(v_caller, p_other_user_id)::text || greatest(v_caller, p_other_user_id)::text, 0)
  );

  select cm1.channel_id into v_channel_id
  from public.chat_channel_members cm1
  join public.chat_channel_members cm2
    on cm2.channel_id = cm1.channel_id and cm2.user_id = p_other_user_id
  join public.chat_channels c on c.id = cm1.channel_id
  where cm1.user_id = v_caller
    and c.type = 'dm'
    and c.workspace_id = v_workspace_id;

  if v_channel_id is null then
    insert into public.chat_channels (workspace_id, type)
    values (v_workspace_id, 'dm')
    returning id into v_channel_id;

    insert into public.chat_channel_members (channel_id, user_id)
    values (v_channel_id, v_caller), (v_channel_id, p_other_user_id);
  end if;

  return v_channel_id;
end;
$$;


ALTER FUNCTION "public"."get_or_create_dm_channel"("p_other_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_post_by_token"("p_token" "text") RETURNS TABLE("id" "uuid", "title" "text", "content" "text", "media_urls" "text"[], "platform" "text"[], "version_number" integer, "created_at" timestamp with time zone, "client_name" "text", "client_id" "uuid", "user_id" "uuid", "target_date" timestamp with time zone, "platform_schedules" "jsonb", "client_logo_url" "text", "client_industry" "text", "client_social_links" "jsonb")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    pv.id,
    pv.title,
    pv.content,
    pv.media_urls,
    pv.platform,
    pv.version_number,
    pv.created_at,
    c.name          AS client_name,
    c.id            AS client_id,
    c.user_id       AS user_id,
    pv.target_date,
    pv.platform_schedules,
    c.logo_url      AS client_logo_url,
    c.industry      AS client_industry,
    c.social_links  AS client_social_links
  FROM public.share_tokens st
  JOIN public.post_versions pv ON st.post_version_id = pv.id
  JOIN public.clients c ON pv.client_id = c.id
  WHERE st.token = p_token
    AND st.expires_at > now()
    AND st.is_active = true;
END;
$$;


ALTER FUNCTION "public"."get_post_by_token"("p_token" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_proposal_by_token"("p_token" "text") RETURNS TABLE("id" "uuid", "agency_user_id" "uuid", "client_id" "uuid", "prospect_name" "text", "prospect_email" "text", "title" "text", "status" "text", "introduction" "text", "scope_notes" "text", "notes" "text", "payment_terms" "text", "contract_duration" "text", "valid_until" "date", "share_token" "text", "first_viewed_at" timestamp with time zone, "sent_at" timestamp with time zone, "accepted_at" timestamp with time zone, "declined_at" timestamp with time zone, "decline_reason" "text", "created_at" timestamp with time zone, "updated_at" timestamp with time zone, "agency_name" "text", "logo_url" "text", "logo_horizontal_url" "text", "branding_agency_sidebar" boolean, "branding_powered_by" boolean, "client_name" "text", "line_items" "jsonb", "proposal_type" "text", "file_url" "text", "total_value" numeric)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT
    p.id,
    p.agency_user_id,
    p.client_id,
    p.prospect_name,
    p.prospect_email,
    p.title,
    CASE
      WHEN p.status NOT IN ('accepted', 'declined', 'archived')
        AND p.valid_until IS NOT NULL
        AND p.valid_until < CURRENT_DATE
      THEN 'expired'
      ELSE p.status
    END AS status,
    p.introduction,
    p.scope_notes,
    p.notes,
    p.payment_terms,
    p.contract_duration,
    p.valid_until,
    p.share_token,
    p.first_viewed_at,
    p.sent_at,
    p.accepted_at,
    p.declined_at,
    p.decline_reason,
    p.created_at,
    p.updated_at,
    sub.agency_name,
    sub.logo_url,
    sub.logo_horizontal_url,
    sub.branding_agency_sidebar,
    sub.branding_powered_by,
    c.name AS client_name,
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id',          li.id,
            'description', li.description,
            'amount',      li.amount,
            'sort_order',  li.sort_order
          )
          ORDER BY li.sort_order, li.id
        )
        FROM proposal_line_items li
        WHERE li.proposal_id = p.id
      ),
      '[]'::jsonb
    ) AS line_items,
    p.proposal_type,
    p.file_url,
    COALESCE(
      p.total_value,
      (SELECT SUM(li.amount) FROM proposal_line_items li WHERE li.proposal_id = p.id),
      0
    ) AS total_value
  FROM proposals p
  JOIN  agency_subscriptions sub ON sub.user_id = p.agency_user_id
  LEFT JOIN clients c            ON c.id = p.client_id
  WHERE p.share_token = p_token;
$$;


ALTER FUNCTION "public"."get_proposal_by_token"("p_token" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_proposals_with_totals"("p_user_id" "uuid", "p_client_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("id" "uuid", "agency_user_id" "uuid", "client_id" "uuid", "prospect_id" "uuid", "prospect_name" "text", "prospect_email" "text", "title" "text", "status" "text", "introduction" "text", "scope_notes" "text", "payment_terms" "text", "contract_duration" "text", "valid_until" "date", "share_token" "text", "first_viewed_at" timestamp with time zone, "sent_at" timestamp with time zone, "accepted_at" timestamp with time zone, "declined_at" timestamp with time zone, "decline_reason" "text", "created_at" timestamp with time zone, "updated_at" timestamp with time zone, "total_value" numeric, "client_name" "text", "client_logo_url" "text", "proposal_type" "text", "file_url" "text")
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT
    p.id,
    p.agency_user_id,
    p.client_id,
    p.prospect_id,
    p.prospect_name,
    p.prospect_email,
    p.title,
    CASE
      WHEN p.status NOT IN ('draft', 'accepted', 'declined', 'archived')
        AND p.valid_until IS NOT NULL
        AND p.valid_until < CURRENT_DATE
      THEN 'expired'
      ELSE p.status
    END AS status,
    p.introduction,
    p.scope_notes,
    p.payment_terms,
    p.contract_duration,
    p.valid_until,
    p.share_token,
    p.first_viewed_at,
    p.sent_at,
    p.accepted_at,
    p.declined_at,
    p.decline_reason,
    p.created_at,
    p.updated_at,
    COALESCE(
      p.total_value,
      (SELECT SUM(li.amount) FROM proposal_line_items li WHERE li.proposal_id = p.id),
      0
    ) AS total_value,
    c.name       AS client_name,
    c.logo_url   AS client_logo_url,
    p.proposal_type,
    p.file_url
  FROM proposals p
  LEFT JOIN clients c ON c.id = p.client_id
  WHERE p.agency_user_id = p_user_id
    AND (p_client_id IS NULL OR p.client_id = p_client_id)
  ORDER BY p.created_at DESC;
$$;


ALTER FUNCTION "public"."get_proposals_with_totals"("p_user_id" "uuid", "p_client_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_removed_members"("p_agency_user_id" "uuid") RETURNS TABLE("id" "uuid", "member_user_id" "uuid", "system_role" "text", "permissions" "jsonb", "joined_at" timestamp with time zone, "email" "text", "first_name" "text", "last_name" "text", "full_name" "text", "avatar_url" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  select
    am.id, am.member_user_id, am.system_role,
    am.permissions, am.joined_at,
    au.email::text,
    (au.raw_user_meta_data->>'first_name')::text,
    (au.raw_user_meta_data->>'last_name')::text,
    coalesce((au.raw_user_meta_data->>'full_name')::text, au.email::text),
    (au.raw_user_meta_data->>'avatar_url')::text
  from agency_members am
  join auth.users au on au.id = am.member_user_id
  where am.agency_user_id = p_agency_user_id
    and p_agency_user_id = public.get_my_agency_user_id()
    and am.is_active = false
  order by am.joined_at asc;
$$;


ALTER FUNCTION "public"."get_removed_members"("p_agency_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_team_members"("p_agency_user_id" "uuid") RETURNS TABLE("id" "uuid", "member_user_id" "uuid", "system_role" "text", "permissions" "jsonb", "joined_at" timestamp with time zone, "email" "text", "first_name" "text", "last_name" "text", "full_name" "text", "avatar_url" "text", "roles_and_responsibilities" "text", "mobile_number" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  select
    am.id, am.member_user_id, am.system_role,
    am.permissions, am.joined_at,
    au.email::text,
    (au.raw_user_meta_data->>'first_name')::text,
    (au.raw_user_meta_data->>'last_name')::text,
    coalesce((au.raw_user_meta_data->>'full_name')::text, au.email::text),
    (au.raw_user_meta_data->>'avatar_url')::text,
    am.roles_and_responsibilities,
    case
      when public.is_workspace_admin() or am.member_user_id = auth.uid()
        then (au.raw_user_meta_data->>'mobile_number')::text
      else null
    end
  from agency_members am
  join auth.users au on au.id = am.member_user_id
  where am.agency_user_id = p_agency_user_id
    and p_agency_user_id = public.get_my_agency_user_id()
    and am.is_active = true
  order by am.joined_at asc;
$$;


ALTER FUNCTION "public"."get_team_members"("p_agency_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user_subscription"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
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
$$;


ALTER FUNCTION "public"."handle_new_user_subscription"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."hard_delete_team_member"("p_member_id" "uuid") RETURNS TABLE("member_user_id" "uuid", "other_workspaces" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_target agency_members%ROWTYPE;
  v_agency_user_id uuid;
  v_member_user_id uuid;
  v_other_count int;
BEGIN
  IF NOT public.is_workspace_owner() THEN
    RAISE EXCEPTION 'Only the workspace owner can permanently delete a member';
  END IF;

  SELECT * INTO v_target
  FROM agency_members
  WHERE id = p_member_id AND agency_user_id = public.get_my_agency_user_id();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Member not found';
  END IF;

  IF v_target.system_role = 'owner' OR v_target.member_user_id = v_target.agency_user_id THEN
    RAISE EXCEPTION 'The owner row cannot be deleted';
  END IF;

  v_agency_user_id := v_target.agency_user_id;
  v_member_user_id := v_target.member_user_id;

  SELECT count(*) INTO v_other_count
  FROM agency_members
  WHERE agency_members.member_user_id = v_member_user_id AND id <> p_member_id;

  UPDATE post_versions pv SET created_by = v_agency_user_id
    FROM posts p, clients c
    WHERE pv.post_id = p.id AND p.client_id = c.id AND c.user_id = v_agency_user_id
      AND pv.created_by = v_member_user_id;

  UPDATE post_versions pv SET submitted_by = v_agency_user_id
    FROM posts p, clients c
    WHERE pv.post_id = p.id AND p.client_id = c.id AND c.user_id = v_agency_user_id
      AND pv.submitted_by = v_member_user_id;

  UPDATE post_versions pv SET updated_by = v_agency_user_id
    FROM posts p, clients c
    WHERE pv.post_id = p.id AND p.client_id = c.id AND c.user_id = v_agency_user_id
      AND pv.updated_by = v_member_user_id;

  UPDATE posts p SET created_by = v_agency_user_id
    FROM clients c
    WHERE p.client_id = c.id AND c.user_id = v_agency_user_id
      AND p.created_by = v_member_user_id;

  UPDATE tasks SET created_by = v_agency_user_id
    WHERE workspace_id = v_agency_user_id AND created_by = v_member_user_id;

  UPDATE tasks SET assigned_to = NULL
    WHERE workspace_id = v_agency_user_id AND assigned_to = v_member_user_id;

  -- chat_messages deliberately NOT reassigned — see the header comment.

  UPDATE approval_events SET actor_id = v_agency_user_id
    WHERE workspace_user_id = v_agency_user_id AND actor_id = v_member_user_id;

  UPDATE note_shares ns SET invited_by = v_agency_user_id
    FROM notes n
    WHERE ns.note_id = n.id AND n.user_id = v_agency_user_id
      AND ns.invited_by = v_member_user_id;

  UPDATE user_feedback SET submitter_user_id = v_agency_user_id
    WHERE workspace_user_id = v_agency_user_id AND submitter_user_id = v_member_user_id;

  -- notes.created_by auto-nulls (ON DELETE SET NULL) but notes.updated_by has
  -- a plain FK with no cascade rule, so it blocks auth.users deletion outright
  -- the moment this member has ever edited a note.
  UPDATE notes SET updated_by = v_agency_user_id
    WHERE user_id = v_agency_user_id AND updated_by = v_member_user_id;

  DELETE FROM agency_members WHERE id = p_member_id;

  RETURN QUERY SELECT v_member_user_id, (v_other_count > 0);
END;
$$;


ALTER FUNCTION "public"."hard_delete_team_member"("p_member_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_storage_used"("p_user_id" "uuid", "p_bytes" bigint) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
begin
  -- Deprecated no-op: storage usage is tracked by the storage.objects trigger.
  null;
end;
$$;


ALTER FUNCTION "public"."increment_storage_used"("p_user_id" "uuid", "p_bytes" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_chat_channel_member"("p_channel_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1 from public.chat_channel_members
    where channel_id = p_channel_id and user_id = auth.uid()
  );
$$;


ALTER FUNCTION "public"."is_chat_channel_member"("p_channel_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_chat_enabled_for_workspace"("p_workspace_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select coalesce(chat, false)
  from public.agency_subscriptions
  where user_id = p_workspace_id;
$$;


ALTER FUNCTION "public"."is_chat_enabled_for_workspace"("p_workspace_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_chat_message_channel_member"("p_message_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1 from public.chat_messages m
    where m.id = p_message_id
      and public.is_chat_channel_member(m.channel_id)
  );
$$;


ALTER FUNCTION "public"."is_chat_message_channel_member"("p_message_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_note_author"("p_note_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM notes WHERE id = p_note_id AND created_by = auth.uid()
  );
$$;


ALTER FUNCTION "public"."is_note_author"("p_note_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_superadmin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  select exists (
    select 1 from agency_members
    where member_user_id = auth.uid()
      and system_role = 'superadmin'
      and is_active = true
  )
$$;


ALTER FUNCTION "public"."is_superadmin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_task_participant"("p_task_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1 from task_activity ta
    where ta.task_id = p_task_id
      and ta.type in ('assigned', 'participant_added')
      and ta.to_user_id = auth.uid()
  );
$$;


ALTER FUNCTION "public"."is_task_participant"("p_task_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_workspace_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT public.is_workspace_owner() OR COALESCE((
    SELECT system_role IN ('admin', 'superadmin')
    FROM public.agency_members
    WHERE member_user_id = auth.uid() AND is_active LIMIT 1
  ), false);
$$;


ALTER FUNCTION "public"."is_workspace_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_workspace_owner"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT auth.uid() = public.get_my_agency_user_id();
$$;


ALTER FUNCTION "public"."is_workspace_owner"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."join_team"("p_token" "text", "p_first_name" "text", "p_last_name" "text", "p_mobile_number" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_invite      agency_invites%rowtype;
  v_member_uid  uuid := auth.uid();
  v_system_role text;
  v_permissions jsonb;
  v_sub         agency_subscriptions%rowtype;
  v_seat_count  int;
  v_inserted    int;
  v_first_name  text := trim(p_first_name);
  v_last_name   text := trim(p_last_name);
  v_mobile      text := nullif(trim(coalesce(p_mobile_number, '')), '');
begin
  if v_member_uid is null then
    return jsonb_build_object('error', 'Not authenticated');
  end if;

  select * into v_invite from agency_invites
  where token = p_token and expires_at > now();

  if not found then
    return jsonb_build_object('error', 'This invite link is no longer valid. Ask your workspace owner for a new one.');
  end if;

  v_system_role := coalesce(v_invite.system_role, 'member');
  v_permissions := case v_system_role
    when 'admin' then '{"documents":"manage"}'::jsonb
    else              coalesce(v_invite.permissions, '{"documents":"view"}'::jsonb)
  end;

  select * into v_sub from agency_subscriptions where user_id = v_invite.agency_user_id;
  if v_sub.max_team_members is not null then
    select count(*) into v_seat_count from agency_members
    where agency_user_id = v_invite.agency_user_id and is_active = true;
    if v_seat_count >= v_sub.max_team_members then
      return jsonb_build_object('error', 'TEAM_SEAT_LIMIT_REACHED');
    end if;
  end if;

  insert into agency_members (agency_user_id, member_user_id, system_role, permissions)
  values (v_invite.agency_user_id, v_member_uid, v_system_role, v_permissions)
  on conflict (agency_user_id, member_user_id) do nothing;

  get diagnostics v_inserted = row_count;

  -- Best-effort: never let chat block someone joining the team.
  if coalesce(v_sub.chat, false) then
    begin
      perform public.ensure_workspace_channel();
    exception when others then
      null;  -- self-heals on the member's first visit to /chat
    end;
  end if;

  update auth.users
  set raw_user_meta_data = raw_user_meta_data || jsonb_build_object(
    'first_name', v_first_name, 'last_name', v_last_name,
    'full_name', v_first_name || ' ' || v_last_name)
    -- Only written when supplied: the field is optional, and a blank retry
    -- must not wipe a number the person already has.
    || case when v_mobile is null then '{}'::jsonb
            else jsonb_build_object('mobile_number', v_mobile) end
  where id = v_member_uid;

  if v_inserted = 1 then
    update agency_invites
    set use_count   = use_count + 1,
        accepted_at = coalesce(accepted_at, now())
    where id = v_invite.id;

    perform public.emit_notifications(
      v_invite.agency_user_id, v_member_uid,
      public.workspace_admin_uids(v_invite.agency_user_id),
      'team_member_joined', 'New team member joined',
      trim(v_first_name || ' ' || v_last_name) || ' joined your workspace',
      'team', null, '/team');
  end if;

  return jsonb_build_object(
    'success', true,
    'agency_user_id', v_invite.agency_user_id,
    -- false when the person had already joined on this link before, so the
    -- caller can skip the welcome email.
    'is_new_member', v_inserted = 1
  );
end $$;


ALTER FUNCTION "public"."join_team"("p_token" "text", "p_first_name" "text", "p_last_name" "text", "p_mobile_number" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_channel_read"("p_channel_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  update public.chat_channel_members
  set last_read_at = now()
  where channel_id = p_channel_id and user_id = auth.uid();

  if not found then
    raise exception 'access_denied';
  end if;
end;
$$;


ALTER FUNCTION "public"."mark_channel_read"("p_channel_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_proposal_viewed"("p_token" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  UPDATE proposals
  SET
    first_viewed_at = CASE WHEN first_viewed_at IS NULL THEN now() ELSE first_viewed_at END,
    status          = CASE WHEN status = 'sent' THEN 'viewed' ELSE status END,
    updated_at      = now()
  WHERE share_token = p_token
    AND status NOT IN ('accepted', 'declined', 'archived');
END;
$$;


ALTER FUNCTION "public"."mark_proposal_viewed"("p_token" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."my_documents_level"() RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."my_documents_level"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."my_note_share_permission"("p_note_id" "uuid") RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT permission FROM note_shares
  WHERE note_id = p_note_id AND member_user_id = auth.uid()
  LIMIT 1;
$$;


ALTER FUNCTION "public"."my_note_share_permission"("p_note_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."my_system_role"() RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT CASE
    WHEN public.is_workspace_owner() THEN 'owner'
    ELSE COALESCE(
      (SELECT system_role FROM public.agency_members
       WHERE member_user_id = auth.uid() AND is_active LIMIT 1),
      'member'
    )
  END;
$$;


ALTER FUNCTION "public"."my_system_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."my_workspace_client_ids"() RETURNS SETOF "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  select c.id::text
  from public.clients c
  where c.user_id = public.get_my_agency_user_id()
$$;


ALTER FUNCTION "public"."my_workspace_client_ids"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_overdue_invoices"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  r record;
begin
  for r in
    select i.id, i.user_id, i.client_id, i.invoice_number
    from public.invoices i
    where i.due_date < now()
      and i.status not in ('PAID', 'CANCELLED', 'DRAFT')
      and not exists (
        select 1 from public.notifications n
        where n.entity_id = i.id
          and n.type = 'invoice_overdue'
      )
  loop
    perform public.emit_notifications(
      r.user_id,
      null,
      public.workspace_admin_uids(r.user_id),
      'invoice_overdue',
      'Invoice overdue',
      'Invoice ' || r.invoice_number || ' is past its due date',
      'invoice',
      r.id,
      '/finance/invoices'
    );
  end loop;
end;
$$;


ALTER FUNCTION "public"."notify_overdue_invoices"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_illegal_updates"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if old.status != 'DRAFT' and
     (old.content != new.content or old.media_urls != new.media_urls) then
    raise exception 'Only DRAFT versions can be edited';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."prevent_illegal_updates"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prospect_status_label"("p_status" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT CASE p_status
    WHEN 'new'               THEN 'New'
    WHEN 'contacted'         THEN 'Contacted'
    WHEN 'follow_up'         THEN 'Follow-Up'
    WHEN 'demo_scheduled'    THEN 'Discovery Call'
    WHEN 'proposal_sent'     THEN 'Proposal Sent'
    WHEN 'changes_requested' THEN 'Changes Requested'
    WHEN 'proposal_accepted' THEN 'Proposal Accepted'
    WHEN 'contract_sent'     THEN 'Contract Sent'
    WHEN 'won'               THEN 'Won'
    WHEN 'lost'              THEN 'Lost'
    ELSE p_status
  END;
$$;


ALTER FUNCTION "public"."prospect_status_label"("p_status" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reassign_task"("p_task_id" "uuid", "p_assigned_to" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_task public.tasks;
begin
  select * into v_task from public.tasks where id = p_task_id;

  if not found then
    raise exception 'task_not_found';
  end if;

  if v_task.workspace_id <> public.get_my_agency_user_id() then
    raise exception 'access_denied';
  end if;

  -- Caller must already be a participant: creator, current assignee, a past
  -- assignee, or an admin. Mirrors tasks_select exactly — you can only hand off
  -- work you already have a hand in.
  if v_task.created_by <> auth.uid()
     and (v_task.assigned_to is null or v_task.assigned_to <> auth.uid())
     and not public.is_task_participant(p_task_id)
     and not public.is_workspace_admin()
  then
    raise exception 'access_denied';
  end if;

  -- Target-side validity (active member, not owner/superadmin) is enforced by
  -- trg_enforce_task_assignment below — it fires on this UPDATE regardless of
  -- SECURITY DEFINER, since only RLS (not triggers) is bypassed.
  update public.tasks set assigned_to = p_assigned_to, updated_at = now()
  where id = p_task_id;
end $$;


ALTER FUNCTION "public"."reassign_task"("p_task_id" "uuid", "p_assigned_to" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."remove_team_member"("p_member_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_target agency_members%ROWTYPE;
BEGIN
  IF NOT public.is_workspace_owner() THEN
    RAISE EXCEPTION 'Only the workspace owner can remove a member';
  END IF;

  SELECT * INTO v_target
  FROM agency_members
  WHERE id = p_member_id AND agency_user_id = public.get_my_agency_user_id();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Member not found';
  END IF;

  IF v_target.system_role = 'owner' OR v_target.member_user_id = v_target.agency_user_id THEN
    RAISE EXCEPTION 'The owner row cannot be removed';
  END IF;

  UPDATE agency_members SET is_active = false WHERE id = p_member_id;

  -- Force sign-out everywhere: an open session's access token stays valid
  -- until it naturally expires/refreshes, so the client-side realtime
  -- redirect (AuthContext -> /no-access) only catches devices that are
  -- actively subscribed right now. Deleting their session rows invalidates
  -- every refresh token immediately, so every other device is forced to
  -- re-authenticate on its very next request instead of just eventually.
  DELETE FROM auth.sessions WHERE user_id = v_target.member_user_id;
END;
$$;


ALTER FUNCTION "public"."remove_team_member"("p_member_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."request_internal_changes"("p_post_version_id" "uuid", "p_notes" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_post_id uuid; v_workspace_id uuid; v_created_by uuid; v_client_id uuid; v_title text;
BEGIN
  IF NOT public.is_workspace_admin() THEN
    RAISE EXCEPTION 'Only owner or admin can request changes';
  END IF;

  SELECT post_id, created_by, client_id, title
    INTO v_post_id, v_created_by, v_client_id, v_title
  FROM post_versions WHERE id = p_post_version_id;

  v_workspace_id := public.get_my_agency_user_id();

  UPDATE post_versions SET status = 'CHANGES_REQUESTED', admin_notes = p_notes
  WHERE id = p_post_version_id AND status = 'SUBMITTED';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Can only request changes on SUBMITTED posts';
  END IF;

  INSERT INTO approval_events (post_version_id, post_id, actor_id, workspace_user_id, action, notes)
  VALUES (p_post_version_id, v_post_id, auth.uid(), v_workspace_id, 'changes_requested', p_notes);

  PERFORM public.emit_notifications(
    v_workspace_id, auth.uid(), array[v_created_by],
    'post_status_changed', 'Changes requested on your deliverable', coalesce(p_notes, v_title),
    'post', v_post_id, '/clients/' || v_client_id || '/posts/' || v_post_id);
END;
$$;


ALTER FUNCTION "public"."request_internal_changes"("p_post_version_id" "uuid", "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."request_proposal_changes"("p_token" "text", "p_notes" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_prospect_id uuid;
  v_prospect_status text;
  v_workspace_user_id uuid;
BEGIN
  UPDATE proposals
  SET
    status                  = 'changes_requested',
    changes_requested_at    = now(),
    changes_requested_notes = p_notes,
    updated_at               = now()
  WHERE share_token = p_token
    AND status NOT IN ('accepted', 'declined', 'archived')
  RETURNING prospect_id INTO v_prospect_id;

  IF v_prospect_id IS NOT NULL THEN
    SELECT status, user_id INTO v_prospect_status, v_workspace_user_id
    FROM prospects WHERE id = v_prospect_id;

    IF v_prospect_status IS NOT NULL
       AND v_prospect_status NOT IN ('changes_requested', 'proposal_accepted', 'contract_sent', 'won', 'lost') THEN
      UPDATE prospects
      SET status = 'changes_requested', updated_at = now()
      WHERE id = v_prospect_id;

      INSERT INTO prospect_activities (prospect_id, user_id, type, body, occurred_at, metadata)
      VALUES (
        v_prospect_id,
        v_workspace_user_id,
        'status_change',
        'Status changed from ' || public.prospect_status_label(v_prospect_status) ||
          ' to Changes Requested (client requested changes to the proposal)',
        now(),
        jsonb_build_object(
          'from_status', v_prospect_status,
          'to_status', 'changes_requested',
          'trigger', 'request_proposal_changes'
        )
      );
    END IF;
  END IF;
END;
$$;


ALTER FUNCTION "public"."request_proposal_changes"("p_token" "text", "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."request_workspace_deletion"() RETURNS timestamp with time zone
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
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


ALTER FUNCTION "public"."request_workspace_deletion"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."schedule_post"("p_version_id" "uuid", "p_client_id" "uuid", "p_datetime" timestamp with time zone) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
begin
  if not exists (
    select 1 from post_versions
    where id = p_version_id
      and status = 'APPROVED'
  ) then
    raise exception 'Only approved versions can be scheduled';
  end if;

  insert into schedules (
    post_version_id,
    client_id,
    scheduled_for
  )
  values (
    p_version_id,
    p_client_id,
    p_datetime
  );

  update post_versions
  set status = 'SCHEDULED'
  where id = p_version_id;
end;
$$;


ALTER FUNCTION "public"."schedule_post"("p_version_id" "uuid", "p_client_id" "uuid", "p_datetime" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."send_for_approval"("p_version_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
begin
  update post_versions
  set status = 'PENDING_APPROVAL'
  where id = p_version_id
    and status = 'DRAFT';

  if not found then
    raise exception 'Only DRAFT versions can be sent for approval';
  end if;
end;
$$;


ALTER FUNCTION "public"."send_for_approval"("p_version_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."send_post_for_approval"("p_post_version_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_post_id uuid;
BEGIN
  -- Owner/admin-authored posts come from DRAFT; member-submitted posts come from READY
  SELECT post_id INTO v_post_id
  FROM post_versions
  WHERE id = p_post_version_id AND status IN ('DRAFT', 'READY');

  IF v_post_id IS NULL THEN
    RAISE EXCEPTION 'Only DRAFT or READY versions can be sent for client approval';
  END IF;

  IF EXISTS (
    SELECT 1 FROM post_versions
    WHERE id = p_post_version_id AND (content IS NULL OR content = '')
  ) THEN
    RAISE EXCEPTION 'Post must have content before sending for approval';
  END IF;

  IF EXISTS (
    SELECT 1 FROM post_versions
    WHERE post_id = v_post_id AND status IN ('PENDING_APPROVAL', 'APPROVED', 'SCHEDULED')
  ) THEN
    RAISE EXCEPTION 'Post already has an active approval lifecycle';
  END IF;

  UPDATE post_versions SET status = 'PENDING_APPROVAL' WHERE id = p_post_version_id;
END;
$$;


ALTER FUNCTION "public"."send_post_for_approval"("p_post_version_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_agency_plan"("p_user_id" "uuid", "p_plan" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  UPDATE agency_subscriptions SET
    plan_name = p_plan,
    max_clients = CASE p_plan
      WHEN 'ignite'   THEN 5
      WHEN 'velocity' THEN 15
      WHEN 'quantum'  THEN 30
      WHEN 'trial'    THEN 30
    END,
    max_storage_bytes = CASE p_plan
      WHEN 'ignite'   THEN 21474836480
      WHEN 'velocity' THEN 53687091200
      WHEN 'quantum'  THEN 107374182400
      WHEN 'trial'    THEN 107374182400
    END,
    max_team_members = CASE p_plan
      WHEN 'ignite'   THEN 2
      WHEN 'velocity' THEN 5
      WHEN 'quantum'  THEN NULL
      WHEN 'trial'    THEN NULL
    END,
    proposals_limit = CASE p_plan
      WHEN 'ignite'   THEN 5
      ELSE NULL
    END,
    campaigns             = (p_plan IN ('velocity','quantum','trial')),
    finance_recurring_invoices = (p_plan IN ('velocity','quantum','trial')),
    finance_subscriptions = (p_plan IN ('velocity','quantum','trial')),
    finance_accrual       = (p_plan IN ('velocity','quantum','trial')),
    calendar_export       = (p_plan IN ('velocity','quantum','trial')),
    documents_collections = (p_plan IN ('velocity','quantum','trial')),
    branding_agency_sidebar = (p_plan IN ('velocity','quantum','trial')),
    branding_powered_by   = (p_plan IN ('ignite','velocity','trial')),
    chat                  = (p_plan IN ('velocity','quantum','trial'))
  WHERE user_id = p_user_id;
END;
$$;


ALTER FUNCTION "public"."set_agency_plan"("p_user_id" "uuid", "p_plan" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_meeting_creator_id"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  NEW.creator_id := auth.uid();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_meeting_creator_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_member_job_roles"("p_member_user_id" "uuid", "p_job_role_ids" "uuid"[]) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_workspace uuid := public.get_my_agency_user_id();
begin
  if not public.is_workspace_owner() then
    raise exception 'Only the workspace owner can assign job roles';
  end if;

  if not exists (
    select 1 from agency_members
    where agency_user_id = v_workspace and member_user_id = p_member_user_id
  ) then
    raise exception 'Member not found';
  end if;

  -- Every id must belong to this workspace: stops a crafted request linking a
  -- member to another agency's role row.
  if exists (
    select 1 from unnest(coalesce(p_job_role_ids, '{}'::uuid[])) as rid
    where not exists (
      select 1 from agency_job_roles r where r.id = rid and r.workspace_id = v_workspace
    )
  ) then
    raise exception 'Unknown job role for this workspace';
  end if;

  delete from agency_member_job_roles
  where workspace_id = v_workspace and member_user_id = p_member_user_id
    and job_role_id <> all (coalesce(p_job_role_ids, '{}'::uuid[]));

  insert into agency_member_job_roles (workspace_id, member_user_id, job_role_id)
  select v_workspace, p_member_user_id, rid
  from unnest(coalesce(p_job_role_ids, '{}'::uuid[])) as rid
  on conflict do nothing;
end $$;


ALTER FUNCTION "public"."set_member_job_roles"("p_member_user_id" "uuid", "p_job_role_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_member_responsibilities"("p_member_user_id" "uuid", "p_text" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_workspace uuid := public.get_my_agency_user_id();
begin
  if not public.is_workspace_owner() then
    raise exception 'Only the workspace owner can edit responsibilities';
  end if;

  if not exists (
    select 1 from agency_members
    where agency_user_id = v_workspace and member_user_id = p_member_user_id
  ) then
    raise exception 'Member not found';
  end if;

  update agency_members
  set roles_and_responsibilities = nullif(trim(coalesce(p_text, '')), '')
  where agency_user_id = v_workspace and member_user_id = p_member_user_id;
end $$;


ALTER FUNCTION "public"."set_member_responsibilities"("p_member_user_id" "uuid", "p_text" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_my_email_task_assignments"("p_enabled" boolean) RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  update public.agency_members
  set email_task_assignments = coalesce(p_enabled, true)
  where member_user_id = auth.uid()
    and agency_user_id = public.get_my_agency_user_id();
$$;


ALTER FUNCTION "public"."set_my_email_task_assignments"("p_enabled" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_post_version_updated_by"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Only track edits to actual content/schedule columns.
  -- Ignores status transitions and the post-insert bookkeeping update from create_post_draft_v3.
  IF (
    OLD.title       IS DISTINCT FROM NEW.title       OR
    OLD.content     IS DISTINCT FROM NEW.content     OR
    OLD.platform    IS DISTINCT FROM NEW.platform    OR
    OLD.media_urls  IS DISTINCT FROM NEW.media_urls  OR
    OLD.target_date IS DISTINCT FROM NEW.target_date OR
    OLD.admin_notes IS DISTINCT FROM NEW.admin_notes
  ) THEN
    NEW.updated_by := auth.uid();
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_post_version_updated_by"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_subscription_ends_at_on_plan_change"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.plan_name IS DISTINCT FROM OLD.plan_name THEN
    NEW.subscription_ends_at := now() + interval '30 days';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_subscription_ends_at_on_plan_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."soft_delete_chat_message"("p_message_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_message public.chat_messages;
  v_channel_type text;
begin
  select * into v_message from public.chat_messages where id = p_message_id;

  if not found then
    raise exception 'message_not_found';
  end if;

  if v_message.workspace_id <> public.get_my_agency_user_id() then
    raise exception 'access_denied';
  end if;

  select type into v_channel_type from public.chat_channels where id = v_message.channel_id;

  if v_message.author_user_id <> auth.uid()
     and not (v_channel_type = 'workspace' and public.is_workspace_admin()) then
    raise exception 'access_denied';
  end if;

  update public.chat_messages
  set deleted_at = now()
  where id = p_message_id;
end;
$$;


ALTER FUNCTION "public"."soft_delete_chat_message"("p_message_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."soft_delete_comment"("p_comment_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_comment public.comments;
begin
  select * into v_comment from public.comments where id = p_comment_id;

  if not found then
    raise exception 'comment_not_found';
  end if;

  if v_comment.workspace_id <> public.get_my_agency_user_id() then
    raise exception 'access_denied';
  end if;

  if v_comment.author_user_id <> auth.uid() and not public.is_workspace_admin() then
    raise exception 'access_denied';
  end if;

  update public.comments
  set deleted_at = now()
  where id = p_comment_id;
end;
$$;


ALTER FUNCTION "public"."soft_delete_comment"("p_comment_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."storage_workspace_for"("p_owner" "uuid") RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  select coalesce(
    (select s.user_id from public.agency_subscriptions s where s.user_id = p_owner),
    (select m.agency_user_id from public.agency_members m
      where m.member_user_id = p_owner
      order by m.is_active desc, m.joined_at desc
      limit 1)
  )
$$;


ALTER FUNCTION "public"."storage_workspace_for"("p_owner" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."submit_approval"("p_version_id" "uuid", "p_client_id" "uuid", "p_approved" boolean, "p_comment" "text") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
begin
  -- ensure pending approval
  if not exists (
    select 1 from post_versions
    where id = p_version_id
      and status = 'PENDING_APPROVAL'
  ) then
    raise exception 'Version is not pending approval';
  end if;

  -- write approval
  insert into approvals (
    post_version_id,
    client_id,
    approved,
    comment,
    approved_by
  )
  values (
    p_version_id,
    p_client_id,
    p_approved,
    p_comment,
    'client'
  );

  -- update status
  if p_approved then
    update post_versions
    set status = 'APPROVED'
    where id = p_version_id;
  end if;
end;
$$;


ALTER FUNCTION "public"."submit_approval"("p_version_id" "uuid", "p_client_id" "uuid", "p_approved" boolean, "p_comment" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."submit_for_internal_approval"("p_post_version_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_post_id uuid; v_workspace_id uuid; v_created_by uuid; v_client_id uuid; v_title text;
BEGIN
  SELECT post_id, created_by, client_id, title
    INTO v_post_id, v_created_by, v_client_id, v_title
  FROM post_versions WHERE id = p_post_version_id;

  IF v_created_by IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'You can only submit your own deliverables';
  END IF;

  v_workspace_id := public.get_my_agency_user_id();

  UPDATE post_versions SET status = 'SUBMITTED', submitted_by = auth.uid()
  WHERE id = p_post_version_id AND status IN ('DRAFT', 'CHANGES_REQUESTED');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Can only submit DRAFT or CHANGES_REQUESTED posts';
  END IF;

  INSERT INTO approval_events (post_version_id, post_id, actor_id, workspace_user_id, action)
  VALUES (p_post_version_id, v_post_id, auth.uid(), v_workspace_id, 'submitted');

  PERFORM public.emit_notifications(
    v_workspace_id, auth.uid(), public.workspace_admin_uids(v_workspace_id),
    'post_status_changed', 'New deliverable submitted for review', v_title,
    'post', v_post_id, '/clients/' || v_client_id || '/posts/' || v_post_id);
END;
$$;


ALTER FUNCTION "public"."submit_for_internal_approval"("p_post_version_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."task_reference_exists"("p_task_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1 from public.tasks
    where id = p_task_id
      and workspace_id = get_my_agency_user_id()
  );
$$;


ALTER FUNCTION "public"."task_reference_exists"("p_task_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."tg_autocomplete_tasks_on_publish"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  t          record;
  v_watchers uuid[];
begin
  -- Forward only, and only into a terminal state. ARCHIVED is deliberately
  -- absent: create_revision_version stamps it on superseded versions, so it is
  -- a versioning artifact, not "done".
  if new.status not in ('PUBLISHED', 'DELIVERED')
     or new.status is not distinct from old.status then
    return new;
  end if;

  for t in
    select tk.id, tk.workspace_id, tk.title, tk.created_by, tk.assigned_to
    from task_posts tp
    join posts p  on p.id = tp.post_id
    join tasks tk on tk.id = tp.task_id
    where p.current_version_id = new.id
      and tk.status in ('TODO', 'IN_PROGRESS')   -- never reopen or re-complete
  loop
    -- All-or-nothing. Phrased as "no linked deliverable is still outstanding"
    -- rather than bool_and(...) so a linked post with no current version
    -- counts as outstanding instead of being dropped by the join and silently
    -- completing the task.
    if not exists (
      select 1
      from task_posts tp2
      join posts p2 on p2.id = tp2.post_id
      left join post_versions pv on pv.id = p2.current_version_id
      where tp2.task_id = t.id
        and (pv.status is null or pv.status not in ('PUBLISHED', 'DELIVERED'))
    ) then
      perform set_config('app.task_system_update', 'on', true);

      update tasks
      set status = 'COMPLETED', completed_at = now(), updated_at = now()
      where id = t.id;

      perform set_config('app.task_system_update', 'off', true);

      v_watchers := array(
        select distinct to_user_id from task_activity
        where task_id = t.id and type = 'assigned' and to_user_id is not null
      ) || t.created_by || t.assigned_to;

      -- NULL actor: nobody moved this task, the work shipping did. Follows the
      -- invoice_overdue precedent NotificationBell already renders via
      -- SYSTEM_ACTOR_LABEL. A NULL actor also means nobody is stripped from
      -- the recipient list — including the person who published.
      perform public.emit_notifications(
        t.workspace_id, null, v_watchers,
        'task_autocompleted',
        'Task auto-completed — all linked deliverables published',
        t.title, 'task', t.id, '/tasks/' || t.id);
    end if;
  end loop;

  return new;
end $$;


ALTER FUNCTION "public"."tg_autocomplete_tasks_on_publish"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."tg_chat_message_author_name"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
begin
  -- SECURITY DEFINER because auth.users is not readable by the sender.
  if new.author_name is null and new.author_user_id is not null then
    select coalesce(u.raw_user_meta_data->>'full_name', u.email)
      into new.author_name
    from auth.users u
    where u.id = new.author_user_id;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."tg_chat_message_author_name"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."tg_comment_adds_task_participants"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_uid uuid;
begin
  if new.entity_type <> 'task' then
    return new;
  end if;
  -- array_length is null (not 0) for an empty array.
  if new.mentioned_uids is null or array_length(new.mentioned_uids, 1) is null then
    return new;
  end if;

  foreach v_uid in array new.mentioned_uids loop
    -- Skip anyone who already has access by any route, so the feed does not
    -- fill up with redundant "added as participant" lines for the assignee.
    if exists (
         select 1 from public.agency_members am
         where am.agency_user_id = new.workspace_id
           and am.member_user_id = v_uid
           and am.is_active
       )
       and not exists (
         select 1 from public.task_activity ta
         where ta.task_id = new.entity_id
           and ta.type in ('assigned', 'participant_added')
           and ta.to_user_id = v_uid
       )
       and not exists (
         select 1 from public.tasks t
         where t.id = new.entity_id
           and (t.created_by = v_uid or t.assigned_to = v_uid)
       )
    then
      insert into public.task_activity (workspace_id, task_id, type, actor_user_id, to_user_id)
      values (new.workspace_id, new.entity_id, 'participant_added', new.author_user_id, v_uid);
    end if;
  end loop;

  return new;
end;
$$;


ALTER FUNCTION "public"."tg_comment_adds_task_participants"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."tg_delete_orphaned_comments"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  delete from public.comments
  where entity_type = TG_ARGV[0]
    and entity_id = OLD.id;
  return OLD;
end;
$$;


ALTER FUNCTION "public"."tg_delete_orphaned_comments"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."tg_log_task_activity"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_actor uuid := case
    when coalesce(current_setting('app.task_system_update', true), '') = 'on' then null
    else auth.uid()
  end;
begin
  if tg_op = 'INSERT' then
    if new.assigned_to is not null then
      insert into task_activity (workspace_id, task_id, type, actor_user_id, to_user_id)
      values (new.workspace_id, new.id, 'assigned', v_actor, new.assigned_to);
    end if;
    insert into task_activity (workspace_id, task_id, type, actor_user_id, to_status)
    values (new.workspace_id, new.id, 'status_changed', v_actor, new.status);
    return new;
  end if;

  if new.assigned_to is distinct from old.assigned_to then
    insert into task_activity (workspace_id, task_id, type, actor_user_id, from_user_id, to_user_id)
    values (new.workspace_id, new.id, 'assigned', v_actor, old.assigned_to, new.assigned_to);
  end if;

  if new.status is distinct from old.status then
    insert into task_activity (workspace_id, task_id, type, actor_user_id, from_status, to_status)
    values (new.workspace_id, new.id, 'status_changed', v_actor, old.status, new.status);
  end if;

  return new;
end $$;


ALTER FUNCTION "public"."tg_log_task_activity"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."tg_notify_chat_message"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_channel_type text;
  v_link text;
  v_type text;
  v_title text;
begin
  select type into v_channel_type from public.chat_channels where id = new.channel_id;
  v_link := '/chat?channel=' || new.channel_id || '&message=' || new.id;

  -- array_length returns null (not 0) for an empty array, so test for null.
  if new.mentioned_uids is null or array_length(new.mentioned_uids, 1) is null then
    return new;
  end if;

  if v_channel_type = 'dm' then
    v_type := 'chat_mention';
    v_title := 'You were mentioned in a direct message';
  elsif new.body ilike '%@Important%' then
    -- @Important / @Everyone are broadcast pseudo-mentions (see ChatThread's
    -- SPECIAL_MENTIONS) that expand to every workspace member id client-side
    -- rather than being individually-picked mentions. The trigger cannot
    -- otherwise tell a broadcast from a coincidental "everyone mentioned",
    -- so sniffing the literal token gives each an honest title.
    v_type := 'chat_important';
    v_title := 'Important message in team chat';
  elsif new.body ilike '%@Everyone%' then
    v_type := 'chat_everyone';
    v_title := 'Everyone was mentioned in team chat';
  else
    v_type := 'chat_mention';
    v_title := 'You were mentioned in team chat';
  end if;

  perform public.emit_notifications(
    new.workspace_id, new.author_user_id, new.mentioned_uids,
    v_type, v_title, left(new.body, 140),
    'chat_channel', new.channel_id, v_link
  );

  return new;
end;
$$;


ALTER FUNCTION "public"."tg_notify_chat_message"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."tg_notify_comment_added"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_recipients       uuid[];
  v_new_participants uuid[];
  v_owner            uuid;
  v_assignee         uuid;
  v_client_id        uuid;
  v_link             text;
  v_title            text;
begin
  v_recipients := array(
    select distinct c.author_user_id
    from public.comments c
    where c.entity_type = new.entity_type
      and c.entity_id = new.entity_id
      and c.deleted_at is null
  );

  v_recipients := v_recipients || coalesce(new.mentioned_uids, '{}');

  if new.entity_type = 'post' then
    select pv.created_by, p.client_id
      into v_owner, v_client_id
    from public.posts p
    join public.post_versions pv on pv.id = p.current_version_id
    where p.id = new.entity_id;

    if v_owner is not null then
      v_recipients := v_recipients || array[v_owner];
    end if;

    v_link  := '/clients/' || v_client_id || '/posts/' || new.entity_id
               || '?comment=' || new.id;
    v_title := 'New comment on a deliverable';

  elsif new.entity_type = 'task' then
    -- Creator + current assignee + everyone ever assigned OR added as a
    -- participant: the same watcher set tg_notify_task_changes fans out to.
    -- SECURITY DEFINER, so these reads see the whole set rather than the
    -- commenter's RLS-visible slice. emit_notifications drops nulls, de-dupes
    -- and strips the actor, so overlap is harmless.
    select t.created_by, t.assigned_to
      into v_owner, v_assignee
    from public.tasks t
    where t.id = new.entity_id;

    v_recipients := v_recipients
      || array[v_owner, v_assignee]
      || array(
           select distinct ta.to_user_id
           from public.task_activity ta
           where ta.task_id = new.entity_id
             and ta.type in ('assigned', 'participant_added')
             and ta.to_user_id is not null
         );

    v_link  := '/tasks/' || new.entity_id || '?comment=' || new.id;
    v_title := 'New comment on a task';

    v_new_participants := array(
      select ta.to_user_id
      from public.task_activity ta
      where ta.task_id = new.entity_id
        and ta.type = 'participant_added'
        and ta.actor_user_id = new.author_user_id
        and ta.created_at >= new.created_at
        and ta.to_user_id = any(coalesce(new.mentioned_uids, '{}'))
    );

    if array_length(v_new_participants, 1) is not null then
      v_recipients := array(
        select unnest(v_recipients)
        except
        select unnest(v_new_participants)
      );

      perform public.emit_notifications(
        new.workspace_id,
        new.author_user_id,
        v_new_participants,
        'task_participant_added',
        'You were added to a task',
        left(new.body, 140),
        new.entity_type,
        new.entity_id,
        v_link
      );
    end if;

  else
    v_link  := '/campaigns/' || new.entity_id || '?comment=' || new.id;
    v_title := 'New comment on a campaign';
  end if;

  perform public.emit_notifications(
    new.workspace_id,
    new.author_user_id,
    v_recipients,
    'comment_added',
    v_title,
    left(new.body, 140),
    new.entity_type,
    new.entity_id,
    v_link
  );

  return new;
end;
$$;


ALTER FUNCTION "public"."tg_notify_comment_added"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."tg_notify_note_shared"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_workspace_id uuid;
  v_note_title text;
BEGIN
  SELECT user_id, title INTO v_workspace_id, v_note_title
  FROM notes WHERE id = NEW.note_id;

  PERFORM emit_notifications(
    v_workspace_id,
    NEW.invited_by,
    ARRAY[NEW.member_user_id],
    'note_shared',
    'Note shared with you',
    COALESCE(v_note_title, 'A note') || ' was shared with you (' || NEW.permission || ' access)',
    'note',
    NEW.note_id,
    '/operations/notes/' || NEW.note_id
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."tg_notify_note_shared"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."tg_notify_task_changes"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_actor    uuid := auth.uid();
  v_watchers uuid[];
  v_link     text := '/tasks/' || new.id;
  v_system   boolean := coalesce(current_setting('app.task_system_update', true), '') = 'on';
begin
  if (tg_op = 'INSERT') then
    if new.assigned_to is not null then
      perform public.emit_notifications(
        new.workspace_id, v_actor, array[new.assigned_to],
        'task_assigned', 'You were assigned a task', new.title,
        'task', new.id, v_link);
    end if;
    return new;
  end if;

  v_watchers := array(
    select distinct to_user_id from task_activity
    where task_id = new.id and type = 'assigned' and to_user_id is not null
  ) || new.created_by;

  if new.assigned_to is distinct from old.assigned_to then
    if new.assigned_to is not null then
      perform public.emit_notifications(
        new.workspace_id, v_actor, array[new.assigned_to],
        'task_assigned', 'You were assigned a task', new.title,
        'task', new.id, v_link);
    end if;
    if old.assigned_to is not null then
      perform public.emit_notifications(
        new.workspace_id, v_actor, array[old.assigned_to],
        'task_reassigned', 'A task you held was reassigned', new.title,
        'task', new.id, v_link);
    end if;
    perform public.emit_notifications(
      new.workspace_id, v_actor,
      array(
        select w from unnest(v_watchers) as w
        where w is distinct from old.assigned_to and w is distinct from new.assigned_to
      ),
      'task_reassigned', 'A task you''re watching was reassigned', new.title,
      'task', new.id, v_link);
  end if;

  if new.status is distinct from old.status and not v_system then
    perform public.emit_notifications(
      new.workspace_id, v_actor, array[new.assigned_to, new.created_by] || v_watchers,
      'task_updated', 'Task status updated to ' || new.status, new.title,
      'task', new.id, v_link);
  end if;

  return new;
end $$;


ALTER FUNCTION "public"."tg_notify_task_changes"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."tg_set_post_creator"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.version_number = 1 THEN
    UPDATE public.posts
    SET created_by = NEW.created_by
    WHERE id = NEW.post_id AND created_by IS NULL;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."tg_set_post_creator"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."toggle_chat_reaction"("p_message_id" "uuid", "p_emoji" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_channel_id uuid;
  v_existing uuid;
begin
  select channel_id into v_channel_id
  from public.chat_messages
  where id = p_message_id and deleted_at is null;

  if v_channel_id is null then
    raise exception 'message_not_found';
  end if;

  if not public.is_chat_channel_member(v_channel_id) then
    raise exception 'access_denied';
  end if;

  select id into v_existing
  from public.chat_message_reactions
  where message_id = p_message_id and user_id = auth.uid() and emoji = p_emoji;

  if v_existing is not null then
    delete from public.chat_message_reactions where id = v_existing;
    return false;
  else
    insert into public.chat_message_reactions (message_id, user_id, emoji)
    values (p_message_id, auth.uid(), p_emoji);
    return true;
  end if;
end;
$$;


ALTER FUNCTION "public"."toggle_chat_reaction"("p_message_id" "uuid", "p_emoji" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."toggle_comment_reaction"("p_comment_id" "uuid", "p_emoji" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_workspace_id uuid;
  v_existing uuid;
begin
  select workspace_id into v_workspace_id from public.comments where id = p_comment_id;

  if v_workspace_id is null then
    raise exception 'comment_not_found';
  end if;

  if v_workspace_id <> public.get_my_agency_user_id() then
    raise exception 'access_denied';
  end if;

  select id into v_existing
  from public.comment_reactions
  where comment_id = p_comment_id and user_id = auth.uid() and emoji = p_emoji;

  if v_existing is not null then
    delete from public.comment_reactions where id = v_existing;
    return false;
  else
    insert into public.comment_reactions (comment_id, user_id, emoji)
    values (p_comment_id, auth.uid(), p_emoji);
    return true;
  end if;
end;
$$;


ALTER FUNCTION "public"."toggle_comment_reaction"("p_comment_id" "uuid", "p_emoji" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_app_config_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;


ALTER FUNCTION "public"."update_app_config_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_member_access"("p_member_id" "uuid", "p_system_role" "text", "p_permissions" "jsonb", "p_roles_and_responsibilities" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare v_target agency_members%rowtype;
begin
  if not public.is_workspace_owner() then
    raise exception 'Only the workspace owner can manage team access';
  end if;

  select * into v_target
  from agency_members
  where id = p_member_id and agency_user_id = public.get_my_agency_user_id();

  if not found then
    raise exception 'Member not found';
  end if;

  if v_target.system_role = 'owner' or v_target.member_user_id = v_target.agency_user_id then
    raise exception 'The owner row cannot be modified';
  end if;

  if p_system_role not in ('admin', 'member') then
    raise exception 'Role must be admin or member';
  end if;

  if p_permissions is null or p_permissions->>'documents' not in ('none', 'view', 'manage') then
    raise exception 'permissions.documents must be none, view, or manage';
  end if;

  update agency_members
  set
    system_role                = p_system_role,
    permissions                = p_permissions,
    roles_and_responsibilities = coalesce(p_roles_and_responsibilities, roles_and_responsibilities)
  where id = p_member_id;
end $$;


ALTER FUNCTION "public"."update_member_access"("p_member_id" "uuid", "p_system_role" "text", "p_permissions" "jsonb", "p_roles_and_responsibilities" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_post_current_version"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- This is the exact line that was causing your error
    UPDATE public.posts 
    SET current_version_id = NEW.id 
    WHERE id = NEW.post_id;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_post_current_version"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_post_status_by_token"("p_token" "text", "p_status" "text", "p_feedback" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_version_id uuid;
  v_rec record;
  v_service_key text;
  v_project_url text;
  v_workspace_id uuid;
BEGIN
  SELECT post_version_id INTO v_version_id
  FROM public.share_tokens
  WHERE token = p_token AND expires_at > now() AND is_active = true;

  IF v_version_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired token';
  END IF;

  UPDATE public.post_versions
  SET status = p_status::post_status, client_notes = p_feedback
  WHERE id = v_version_id
  RETURNING id, post_id, client_id, created_by, title, status, target_date, client_notes
  INTO v_rec;

  UPDATE public.share_tokens SET is_active = false WHERE token = p_token;

  IF p_status IN ('SCHEDULED', 'NEEDS_REVISION') THEN
    BEGIN
      SELECT decrypted_secret INTO v_service_key
      FROM vault.decrypted_secrets WHERE name = 'service_role_key';
      SELECT decrypted_secret INTO v_project_url
      FROM vault.decrypted_secrets WHERE name = 'project_url';

      IF v_service_key IS NOT NULL AND v_project_url IS NOT NULL THEN
        PERFORM net.http_post(
          url := rtrim(v_project_url, '/') || '/functions/v1/send-approval-email',
          headers := jsonb_build_object('Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_service_key),
          body := jsonb_build_object('record', jsonb_build_object(
            'id', v_rec.id, 'client_id', v_rec.client_id, 'created_by', v_rec.created_by,
            'title', v_rec.title, 'status', v_rec.status, 'target_date', v_rec.target_date,
            'client_notes', v_rec.client_notes)));
      ELSE
        RAISE WARNING 'agency review-decision email skipped: vault secret % missing',
          CASE WHEN v_project_url IS NULL THEN 'project_url' ELSE 'service_role_key' END;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'agency review-decision email failed: %', SQLERRM;
    END;

    BEGIN
      SELECT user_id INTO v_workspace_id FROM public.clients WHERE id = v_rec.client_id;
      PERFORM public.emit_notifications(
        v_workspace_id, NULL, array[v_rec.created_by, v_workspace_id],
        'campaign_reviewed',
        CASE WHEN p_status = 'SCHEDULED' THEN 'Client approved a deliverable'
             ELSE 'Client requested revisions' END,
        v_rec.title, 'post', v_rec.post_id,
        '/clients/' || v_rec.client_id || '/posts/' || v_rec.post_id);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'in-app review notification failed: %', SQLERRM;
    END;
  END IF;
END;
$$;


ALTER FUNCTION "public"."update_post_status_by_token"("p_token" "text", "p_status" "text", "p_feedback" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_storage_usage"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_ws uuid;
begin
  if TG_OP in ('DELETE', 'UPDATE') and OLD.owner is not null then
    v_ws := public.storage_workspace_for(OLD.owner);
    if v_ws is not null then
      update public.agency_subscriptions
      set current_storage_used = greatest(0, coalesce(current_storage_used, 0)
                                 - coalesce((OLD.metadata->>'size')::bigint, 0))
      where user_id = v_ws;
    end if;
  end if;

  if TG_OP in ('INSERT', 'UPDATE') and NEW.owner is not null then
    v_ws := public.storage_workspace_for(NEW.owner);
    if v_ws is not null then
      update public.agency_subscriptions
      set current_storage_used = coalesce(current_storage_used, 0)
                                 + coalesce((NEW.metadata->>'size')::bigint, 0)
      where user_id = v_ws;
    end if;
  end if;

  return null;
end;
$$;


ALTER FUNCTION "public"."update_storage_usage"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_task_status"("p_task_id" "uuid", "p_new_status" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_task public.tasks;
BEGIN
  SELECT * INTO v_task FROM public.tasks WHERE id = p_task_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'task_not_found';
  END IF;

  IF v_task.workspace_id <> public.get_my_agency_user_id() THEN
    RAISE EXCEPTION 'access_denied';
  END IF;

  IF v_task.created_by <> auth.uid()
     AND (v_task.assigned_to IS NULL OR v_task.assigned_to <> auth.uid())
     AND NOT public.is_workspace_admin()
  THEN
    RAISE EXCEPTION 'access_denied';
  END IF;

  IF p_new_status NOT IN ('TODO', 'IN_PROGRESS', 'COMPLETED', 'ARCHIVED') THEN
    RAISE EXCEPTION 'invalid_status: %', p_new_status;
  END IF;

  UPDATE public.tasks SET
    status       = p_new_status,
    completed_at = CASE
                     WHEN p_new_status = 'COMPLETED' THEN now()
                     ELSE NULL
                   END,
    updated_at   = now()
  WHERE id = p_task_id;
END;
$$;


ALTER FUNCTION "public"."update_task_status"("p_task_id" "uuid", "p_new_status" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_user_feedback_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;


ALTER FUNCTION "public"."update_user_feedback_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."workspace_admin_uids"("p_workspace_id" "uuid") RETURNS "uuid"[]
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select coalesce(array_agg(distinct member_user_id), '{}'::uuid[]) || p_workspace_id
  from public.agency_members
  where agency_user_id = p_workspace_id
    and is_active = true
    and system_role in ('owner', 'admin', 'superadmin');
$$;


ALTER FUNCTION "public"."workspace_admin_uids"("p_workspace_id" "uuid") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_feedback" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "email" "text",
    "agency_name" "text",
    "submitted_by_role" "text",
    "type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" NOT NULL,
    "severity" "text",
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."admin_feedback" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_outreach_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "prospect_id" "uuid" NOT NULL,
    "channel" "text" NOT NULL,
    "note" "text",
    "contacted_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."admin_outreach_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_outreach_notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "body" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."admin_outreach_notes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_prospect_activity" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "prospect_id" "uuid" NOT NULL,
    "type" "text" DEFAULT 'status_change'::"text" NOT NULL,
    "from_status" "text",
    "to_status" "text",
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."admin_prospect_activity" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_prospects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "agency_name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "phone" "text",
    "source" "text" DEFAULT 'manual'::"text" NOT NULL,
    "status" "text" DEFAULT 'new'::"text" NOT NULL,
    "notes" "text",
    "next_action" "text",
    "next_action_date" timestamp with time zone,
    "tercero_user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "website" "text",
    "location" "text",
    "agency_size" "text",
    "years_in_business" "text",
    "contact_title" "text",
    "linkedin_url" "text",
    "services_offered" "text",
    "estimated_client_count" "text",
    "industries_served" "text",
    "lead_score" integer,
    "fit_reason" "text"
);


ALTER TABLE "public"."admin_prospects" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agency_invites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agency_user_id" "uuid" NOT NULL,
    "token" "text" DEFAULT "encode"("extensions"."gen_random_bytes"(32), 'hex'::"text") NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone DEFAULT ("now"() + '7 days'::interval) NOT NULL,
    "accepted_at" timestamp with time zone,
    "permissions" "jsonb" DEFAULT '{"documents": "view"}'::"jsonb" NOT NULL,
    "system_role" "text" DEFAULT 'member'::"text" NOT NULL,
    "label" "text",
    "use_count" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "agency_invites_system_role_check" CHECK (("system_role" = ANY (ARRAY['admin'::"text", 'member'::"text"])))
);


ALTER TABLE "public"."agency_invites" OWNER TO "postgres";


COMMENT ON COLUMN "public"."agency_invites"."accepted_at" IS 'First time anyone joined on this link. NOT a spent flag - links are multi-use until expires_at.';



COMMENT ON COLUMN "public"."agency_invites"."use_count" IS 'How many members have joined on this link.';



CREATE TABLE IF NOT EXISTS "public"."agency_job_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "color" "text" DEFAULT 'slate'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."agency_job_roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agency_member_job_roles" (
    "workspace_id" "uuid" NOT NULL,
    "member_user_id" "uuid" NOT NULL,
    "job_role_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."agency_member_job_roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agency_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agency_user_id" "uuid" NOT NULL,
    "member_user_id" "uuid" NOT NULL,
    "system_role" "text" DEFAULT 'member'::"text" NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"(),
    "is_active" boolean DEFAULT true NOT NULL,
    "permissions" "jsonb" DEFAULT '{"documents": "view"}'::"jsonb" NOT NULL,
    "roles_and_responsibilities" "text",
    "email_task_assignments" boolean DEFAULT true NOT NULL,
    CONSTRAINT "agency_members_system_role_check" CHECK (("system_role" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'member'::"text", 'superadmin'::"text"])))
);


ALTER TABLE "public"."agency_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."app_config" (
    "key" "text" NOT NULL,
    "value" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."app_config" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."approval_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_version_id" "uuid" NOT NULL,
    "post_id" "uuid" NOT NULL,
    "actor_id" "uuid" NOT NULL,
    "workspace_user_id" "uuid" NOT NULL,
    "action" "text" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "approval_events_action_check" CHECK (("action" = ANY (ARRAY['submitted'::"text", 'approved'::"text", 'changes_requested'::"text"])))
);


ALTER TABLE "public"."approval_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."approvals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_version_id" "uuid" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "approved" boolean NOT NULL,
    "comment" "text",
    "approved_by" "text" NOT NULL,
    "approved_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."approvals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."campaigns" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "goal" "text",
    "description" "text",
    "status" "text" DEFAULT 'Active'::"text" NOT NULL,
    "start_date" "date",
    "end_date" "date",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "budget" numeric(12,2),
    "review_token" "uuid" DEFAULT "gen_random_uuid"(),
    "last_review_sent_at" timestamp with time zone,
    "review_token_active" boolean DEFAULT true,
    CONSTRAINT "campaigns_status_check" CHECK (("status" = ANY (ARRAY['Active'::"text", 'Completed'::"text", 'Archived'::"text"])))
);


ALTER TABLE "public"."campaigns" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chat_channel_members" (
    "channel_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "last_read_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."chat_channel_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chat_channels" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "chat_channels_type_check" CHECK (("type" = ANY (ARRAY['workspace'::"text", 'dm'::"text"])))
);


ALTER TABLE "public"."chat_channels" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chat_message_reactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "message_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "emoji" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "chat_message_reactions_emoji_check" CHECK (("emoji" = ANY (ARRAY['👍'::"text", '👎'::"text", '❤️'::"text", '😂'::"text", '😮'::"text", '😢'::"text", '🎉'::"text", '🙌'::"text", '🔥'::"text", '👀'::"text", '✅'::"text", '🤔'::"text", '➕'::"text", '➖'::"text"])))
);


ALTER TABLE "public"."chat_message_reactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chat_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "channel_id" "uuid" NOT NULL,
    "author_user_id" "uuid",
    "body" "text" NOT NULL,
    "mentioned_uids" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone,
    "deleted_at" timestamp with time zone,
    "entity_references" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "author_name" "text"
);


ALTER TABLE "public"."chat_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."client_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "client_id" "uuid",
    "display_name" "text" NOT NULL,
    "original_filename" "text" NOT NULL,
    "storage_path" "text" NOT NULL,
    "file_size_bytes" bigint NOT NULL,
    "mime_type" "text" NOT NULL,
    "category" "text" DEFAULT 'Other'::"text" NOT NULL,
    "status" "text" DEFAULT 'Active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "collection_id" "uuid",
    "notes" "text",
    "prospect_id" "uuid",
    "is_confidential" boolean DEFAULT false NOT NULL,
    CONSTRAINT "client_documents_category_check" CHECK (("category" = ANY (ARRAY['Contract'::"text", 'NDA'::"text", 'Brand Guidelines'::"text", 'Creative Brief'::"text", 'Brand Assets'::"text", 'Meeting Notes'::"text", 'Invoice / Finance'::"text", 'SOP'::"text", 'Pitch Deck'::"text", 'Case Study'::"text", 'Discovery Notes'::"text", 'Other'::"text"]))),
    CONSTRAINT "client_documents_status_check" CHECK (("status" = ANY (ARRAY['Active'::"text", 'Archived'::"text"])))
);


ALTER TABLE "public"."client_documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."clients" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "status" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "user_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "mobile_number" "text",
    "description" "text",
    "logo_url" "text",
    "tier" "public"."client_tier" DEFAULT 'BASIC'::"public"."client_tier" NOT NULL,
    "industry" "text" DEFAULT 'General'::"text",
    "platforms" "text"[] DEFAULT '{}'::"text"[],
    "is_internal" boolean DEFAULT false,
    "social_links" "jsonb" DEFAULT '{}'::"jsonb",
    "client_type" "text",
    "contact_name" "text",
    "website" "text",
    "location" "text",
    "address" "text",
    CONSTRAINT "clients_client_type_check" CHECK (("client_type" = ANY (ARRAY['monthly_retainer'::"text", 'project_based'::"text", 'campaign_based'::"text", 'one_off'::"text", 'advisory'::"text"]))),
    CONSTRAINT "clients_status_check" CHECK (("status" = ANY (ARRAY['ACTIVE'::"text", 'PAUSED'::"text", 'ARCHIVED'::"text"]))),
    CONSTRAINT "social_links_is_object" CHECK (("jsonb_typeof"("social_links") = 'object'::"text"))
);


ALTER TABLE "public"."clients" OWNER TO "postgres";


COMMENT ON COLUMN "public"."clients"."tier" IS 'Business priority level for the Agency CRM';



CREATE TABLE IF NOT EXISTS "public"."post_versions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "version_number" integer NOT NULL,
    "status" "public"."post_status" NOT NULL,
    "content" "text" NOT NULL,
    "media_urls" "text"[] DEFAULT '{}'::"text"[],
    "platform" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "title" "text",
    "client_notes" "text",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "target_date" timestamp with time zone,
    "admin_notes" "text",
    "published_at" timestamp with time zone,
    "platform_schedules" "jsonb",
    "deliverable_type" "text",
    "submitted_by" "uuid",
    "updated_by" "uuid"
);


ALTER TABLE "public"."post_versions" OWNER TO "postgres";


COMMENT ON COLUMN "public"."post_versions"."platform_schedules" IS 'Per-platform scheduling: { platform: { scheduled_at: timestamptz, published_at: timestamptz | null } }. NULL = single target_date mode.';



CREATE TABLE IF NOT EXISTS "public"."posts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "current_version_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "campaign_id" "uuid",
    "created_by" "uuid"
);


ALTER TABLE "public"."posts" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."client_pipeline_analytics" WITH ("security_invoker"='on') AS
 SELECT "c"."id" AS "client_id",
    "count"("pv"."id") FILTER (WHERE ("pv"."status" = 'DRAFT'::"public"."post_status")) AS "drafts",
    "count"("pv"."id") FILTER (WHERE ("pv"."status" = 'PENDING_APPROVAL'::"public"."post_status")) AS "pending",
    "count"("pv"."id") FILTER (WHERE ("pv"."status" = 'NEEDS_REVISION'::"public"."post_status")) AS "revisions",
    "count"("pv"."id") FILTER (WHERE ("pv"."status" = 'SCHEDULED'::"public"."post_status")) AS "scheduled",
    "min"("pv"."target_date") FILTER (WHERE (("pv"."status" = 'SCHEDULED'::"public"."post_status") AND ("pv"."target_date" > "now"()))) AS "next_post_at"
   FROM (("public"."clients" "c"
     LEFT JOIN "public"."posts" "p" ON (("c"."id" = "p"."client_id")))
     LEFT JOIN "public"."post_versions" "pv" ON (("p"."current_version_id" = "pv"."id")))
  GROUP BY "c"."id";


ALTER VIEW "public"."client_pipeline_analytics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."client_users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    CONSTRAINT "client_users_role_check" CHECK (("role" = ANY (ARRAY['ADMIN'::"text", 'INTERNAL'::"text"])))
);


ALTER TABLE "public"."client_users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."comment_reactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "comment_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "emoji" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "comment_reactions_emoji_check" CHECK (("emoji" = ANY (ARRAY['👍'::"text", '👎'::"text", '❤️'::"text", '😂'::"text", '😮'::"text", '😢'::"text", '🎉'::"text", '🙌'::"text", '🔥'::"text", '👀'::"text", '✅'::"text", '🤔'::"text", '➕'::"text", '➖'::"text"])))
);


ALTER TABLE "public"."comment_reactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "author_user_id" "uuid" NOT NULL,
    "body" "text" NOT NULL,
    "mentioned_uids" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone,
    "deleted_at" timestamp with time zone,
    CONSTRAINT "comments_entity_type_check" CHECK (("entity_type" = ANY (ARRAY['post'::"text", 'campaign'::"text", 'task'::"text"])))
);


ALTER TABLE "public"."comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."document_collections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."document_collections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."expenses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "assigned_client_id" "uuid",
    "name" "text" NOT NULL,
    "cost" numeric(10,2) DEFAULT 0 NOT NULL,
    "billing_cycle" "text" NOT NULL,
    "next_billing_date" "date" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "category" "text" DEFAULT 'Software'::"text",
    "is_active" boolean DEFAULT true,
    CONSTRAINT "expenses_billing_cycle_check" CHECK (("billing_cycle" = ANY (ARRAY['MONTHLY'::"text", 'QUARTERLY'::"text", 'YEARLY'::"text"])))
);


ALTER TABLE "public"."expenses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invoice_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "invoice_id" "uuid" NOT NULL,
    "transaction_id" "uuid",
    "description" "text" NOT NULL,
    "quantity" numeric DEFAULT 1 NOT NULL,
    "unit_price" numeric NOT NULL,
    "total" numeric NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."invoice_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invoices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "invoice_number" "text" NOT NULL,
    "status" "text" DEFAULT 'DRAFT'::"text" NOT NULL,
    "issue_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "due_date" "date" NOT NULL,
    "subtotal" numeric DEFAULT 0 NOT NULL,
    "total" numeric DEFAULT 0 NOT NULL,
    "notes" "text",
    "payment_terms" "text",
    "pdf_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "category" "text",
    "campaign_id" "uuid",
    CONSTRAINT "invoices_category_check" CHECK (("category" = ANY (ARRAY['Retainer'::"text", 'Project Fee'::"text", 'Ad Management'::"text", 'Other'::"text"]))),
    CONSTRAINT "invoices_status_check" CHECK (("status" = ANY (ARRAY['DRAFT'::"text", 'SENT'::"text", 'PAID'::"text", 'OVERDUE'::"text", 'VOID'::"text"])))
);


ALTER TABLE "public"."invoices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."meetings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "datetime" timestamp with time zone NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "meeting_link" "text",
    "campaign_id" "uuid",
    "completed_at" timestamp with time zone,
    "creator_id" "uuid",
    "visibility" "text" DEFAULT 'public'::"text" NOT NULL,
    CONSTRAINT "meetings_visibility_check" CHECK (("visibility" = ANY (ARRAY['private'::"text", 'public'::"text"])))
);


ALTER TABLE "public"."meetings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."note_shares" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "note_id" "uuid" NOT NULL,
    "member_user_id" "uuid" NOT NULL,
    "permission" "text" DEFAULT 'read'::"text" NOT NULL,
    "invited_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "note_shares_permission_check" CHECK (("permission" = ANY (ARRAY['read'::"text", 'write'::"text"])))
);


ALTER TABLE "public"."note_shares" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."note_tag_links" (
    "note_id" "uuid" NOT NULL,
    "tag_id" "uuid" NOT NULL
);


ALTER TABLE "public"."note_tag_links" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."note_tags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "color" "text" DEFAULT 'slate'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."note_tags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "client_id" "uuid",
    "title" "text" NOT NULL,
    "body" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "created_by_name" "text",
    "created_by_avatar" "text",
    "visibility" "text" DEFAULT 'private'::"text" NOT NULL,
    "updated_by" "uuid",
    "updated_by_name" "text",
    CONSTRAINT "notes_visibility_check" CHECK (("visibility" = ANY (ARRAY['private'::"text", 'shared'::"text", 'workspace'::"text"])))
);


ALTER TABLE "public"."notes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "recipient_user_id" "uuid" NOT NULL,
    "actor_user_id" "uuid",
    "type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "body" "text",
    "entity_type" "text",
    "entity_id" "uuid",
    "link" "text",
    "read_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."proposal_line_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "proposal_id" "uuid" NOT NULL,
    "description" "text" NOT NULL,
    "amount" numeric NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."proposal_line_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."proposals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agency_user_id" "uuid" NOT NULL,
    "client_id" "uuid",
    "prospect_name" "text",
    "prospect_email" "text",
    "title" "text" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "introduction" "text",
    "scope_notes" "text",
    "payment_terms" "text",
    "contract_duration" "text",
    "valid_until" "date",
    "share_token" "text",
    "first_viewed_at" timestamp with time zone,
    "sent_at" timestamp with time zone,
    "accepted_at" timestamp with time zone,
    "declined_at" timestamp with time zone,
    "decline_reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "notes" "text",
    "proposal_type" "text" DEFAULT 'built'::"text" NOT NULL,
    "file_url" "text",
    "total_value" numeric,
    "prospect_id" "uuid",
    "changes_requested_at" timestamp with time zone,
    "changes_requested_notes" "text",
    CONSTRAINT "proposals_proposal_type_check" CHECK (("proposal_type" = ANY (ARRAY['built'::"text", 'uploaded'::"text"])))
);


ALTER TABLE "public"."proposals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."prospect_activities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "prospect_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "type" "text" DEFAULT 'note'::"text" NOT NULL,
    "body" "text",
    "metadata" "jsonb",
    "occurred_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."prospect_activities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."prospects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "business_name" "text" NOT NULL,
    "contact_name" "text",
    "email" "text",
    "phone" "text",
    "website" "text",
    "location" "text",
    "address" "text",
    "instagram" "text",
    "linkedin" "text",
    "industry" "text",
    "source" "text" DEFAULT 'manual'::"text" NOT NULL,
    "status" "text" DEFAULT 'new'::"text" NOT NULL,
    "last_contacted_at" timestamp with time zone,
    "next_followup_at" timestamp with time zone,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "converted_client_id" "uuid"
);


ALTER TABLE "public"."prospects" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recurring_invoices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "category" "text" DEFAULT 'Retainer'::"text" NOT NULL,
    "description" "text",
    "billing_cycle" "text" DEFAULT 'MONTHLY'::"text" NOT NULL,
    "next_invoice_date" "date" NOT NULL,
    "payment_terms" "text",
    "notes" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "last_generated_at" timestamp with time zone,
    CONSTRAINT "recurring_invoices_billing_cycle_check" CHECK (("billing_cycle" = ANY (ARRAY['MONTHLY'::"text", 'QUARTERLY'::"text", 'YEARLY'::"text"]))),
    CONSTRAINT "recurring_invoices_category_check" CHECK (("category" = ANY (ARRAY['Retainer'::"text", 'Project Fee'::"text", 'Ad Management'::"text", 'Other'::"text"])))
);


ALTER TABLE "public"."recurring_invoices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."schedules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_version_id" "uuid" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "scheduled_for" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."schedules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."share_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_version_id" "uuid",
    "token" "text" DEFAULT "encode"("extensions"."gen_random_bytes"(32), 'hex'::"text") NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '14 days'::interval),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "is_active" boolean DEFAULT true
);


ALTER TABLE "public"."share_tokens" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."subscription_usage_stats" WITH ("security_invoker"='on') AS
 SELECT "user_id",
    "plan_name",
    "max_clients",
    ( SELECT ("count"(*))::integer AS "count"
           FROM "public"."clients"
          WHERE (("clients"."user_id" = "asub"."user_id") AND ("clients"."is_internal" = false))) AS "client_count",
    "max_storage_bytes",
    "current_storage_used"
   FROM "public"."agency_subscriptions" "asub";


ALTER VIEW "public"."subscription_usage_stats" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."task_activity" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "task_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "actor_user_id" "uuid",
    "from_user_id" "uuid",
    "to_user_id" "uuid",
    "from_status" "text",
    "to_status" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "task_activity_type_check" CHECK (("type" = ANY (ARRAY['assigned'::"text", 'status_changed'::"text", 'participant_added'::"text"])))
);


ALTER TABLE "public"."task_activity" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."task_posts" (
    "task_id" "uuid" NOT NULL,
    "post_id" "uuid" NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."task_posts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "assigned_to" "uuid",
    "title" "text" NOT NULL,
    "description" "text",
    "status" "text" DEFAULT 'TODO'::"text" NOT NULL,
    "priority" "text" DEFAULT 'NORMAL'::"text" NOT NULL,
    "due_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "client_id" "uuid",
    "campaign_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "tasks_priority_check" CHECK (("priority" = ANY (ARRAY['LOW'::"text", 'NORMAL'::"text", 'HIGH'::"text", 'URGENT'::"text"]))),
    CONSTRAINT "tasks_status_check" CHECK (("status" = ANY (ARRAY['TODO'::"text", 'IN_PROGRESS'::"text", 'COMPLETED'::"text", 'ARCHIVED'::"text"])))
);


ALTER TABLE "public"."tasks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "client_id" "uuid",
    "type" "public"."transaction_type" NOT NULL,
    "amount" numeric(10,2) DEFAULT 0 NOT NULL,
    "date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "category" "text" NOT NULL,
    "description" "text",
    "status" "public"."transaction_status" DEFAULT 'PAID'::"public"."transaction_status",
    "invoice_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "invoice_id" "uuid",
    "campaign_id" "uuid"
);


ALTER TABLE "public"."transactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_feedback" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_user_id" "uuid" NOT NULL,
    "submitter_user_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" NOT NULL,
    "severity" "text",
    "feature_area" "text",
    "steps_to_reproduce" "text",
    "category" "text",
    "expected_benefit" "text",
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "plan_name" "text",
    "admin_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "dismissed_by_user" boolean DEFAULT false NOT NULL,
    CONSTRAINT "user_feedback_category_check" CHECK (("category" = ANY (ARRAY['feature_request'::"text", 'ux_improvement'::"text", 'performance'::"text", 'general'::"text"]))),
    CONSTRAINT "user_feedback_severity_check" CHECK (("severity" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text", 'critical'::"text"]))),
    CONSTRAINT "user_feedback_type_check" CHECK (("type" = ANY (ARRAY['bug_report'::"text", 'suggestion'::"text"])))
);


ALTER TABLE "public"."user_feedback" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."view_finance_overview" WITH ("security_invoker"='on') AS
 SELECT "user_id",
    COALESCE("sum"(
        CASE
            WHEN ("type" = 'INCOME'::"public"."transaction_type") THEN "amount"
            ELSE (0)::numeric
        END), (0)::numeric) AS "total_income",
    COALESCE("sum"(
        CASE
            WHEN ("type" = 'EXPENSE'::"public"."transaction_type") THEN "amount"
            ELSE (0)::numeric
        END), (0)::numeric) AS "total_one_off_expenses",
    ( SELECT COALESCE("sum"(
                CASE
                    WHEN ("expenses"."billing_cycle" = 'MONTHLY'::"text") THEN "expenses"."cost"
                    WHEN ("expenses"."billing_cycle" = 'QUARTERLY'::"text") THEN ("expenses"."cost" / (3)::numeric)
                    WHEN ("expenses"."billing_cycle" = 'YEARLY'::"text") THEN ("expenses"."cost" / (12)::numeric)
                    ELSE (0)::numeric
                END), (0)::numeric) AS "coalesce"
           FROM "public"."expenses"
          WHERE ("expenses"."user_id" = "transactions"."user_id")) AS "monthly_recurring_burn"
   FROM "public"."transactions"
  GROUP BY "user_id";


ALTER VIEW "public"."view_finance_overview" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."view_monthly_burn_rate" WITH ("security_invoker"='on') AS
 SELECT "user_id",
    "sum"(
        CASE
            WHEN ("billing_cycle" = 'MONTHLY'::"text") THEN "cost"
            WHEN ("billing_cycle" = 'QUARTERLY'::"text") THEN ("cost" / (3)::numeric)
            WHEN ("billing_cycle" = 'YEARLY'::"text") THEN ("cost" / (12)::numeric)
            ELSE (0)::numeric
        END) AS "total_monthly_burn"
   FROM "public"."expenses"
  GROUP BY "user_id";


ALTER VIEW "public"."view_monthly_burn_rate" OWNER TO "postgres";


ALTER TABLE ONLY "public"."admin_feedback"
    ADD CONSTRAINT "admin_feedback_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admin_outreach_log"
    ADD CONSTRAINT "admin_outreach_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admin_outreach_notes"
    ADD CONSTRAINT "admin_outreach_notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admin_prospect_activity"
    ADD CONSTRAINT "admin_prospect_activity_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admin_prospects"
    ADD CONSTRAINT "admin_prospects_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."admin_prospects"
    ADD CONSTRAINT "admin_prospects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agency_invites"
    ADD CONSTRAINT "agency_invites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agency_invites"
    ADD CONSTRAINT "agency_invites_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."agency_job_roles"
    ADD CONSTRAINT "agency_job_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agency_member_job_roles"
    ADD CONSTRAINT "agency_member_job_roles_pkey" PRIMARY KEY ("workspace_id", "member_user_id", "job_role_id");



ALTER TABLE ONLY "public"."agency_members"
    ADD CONSTRAINT "agency_members_agency_user_id_member_user_id_key" UNIQUE ("agency_user_id", "member_user_id");



ALTER TABLE ONLY "public"."agency_members"
    ADD CONSTRAINT "agency_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agency_subscriptions"
    ADD CONSTRAINT "agency_subscriptions_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."agency_subscriptions"
    ADD CONSTRAINT "agency_subscriptions_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."app_config"
    ADD CONSTRAINT "app_config_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."approval_events"
    ADD CONSTRAINT "approval_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."approvals"
    ADD CONSTRAINT "approvals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."approvals"
    ADD CONSTRAINT "approvals_post_version_id_key" UNIQUE ("post_version_id");



ALTER TABLE ONLY "public"."campaigns"
    ADD CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."campaigns"
    ADD CONSTRAINT "campaigns_review_token_key" UNIQUE ("review_token");



ALTER TABLE ONLY "public"."chat_channel_members"
    ADD CONSTRAINT "chat_channel_members_pkey" PRIMARY KEY ("channel_id", "user_id");



ALTER TABLE ONLY "public"."chat_channels"
    ADD CONSTRAINT "chat_channels_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chat_message_reactions"
    ADD CONSTRAINT "chat_message_reactions_message_id_user_id_emoji_key" UNIQUE ("message_id", "user_id", "emoji");



ALTER TABLE ONLY "public"."chat_message_reactions"
    ADD CONSTRAINT "chat_message_reactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_documents"
    ADD CONSTRAINT "client_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_users"
    ADD CONSTRAINT "client_users_client_id_user_id_key" UNIQUE ("client_id", "user_id");



ALTER TABLE ONLY "public"."client_users"
    ADD CONSTRAINT "client_users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."comment_reactions"
    ADD CONSTRAINT "comment_reactions_comment_id_user_id_emoji_key" UNIQUE ("comment_id", "user_id", "emoji");



ALTER TABLE ONLY "public"."comment_reactions"
    ADD CONSTRAINT "comment_reactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."document_collections"
    ADD CONSTRAINT "document_collections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invoice_items"
    ADD CONSTRAINT "invoice_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_user_id_invoice_number_key" UNIQUE ("user_id", "invoice_number");



ALTER TABLE ONLY "public"."meetings"
    ADD CONSTRAINT "meetings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."note_shares"
    ADD CONSTRAINT "note_shares_note_id_member_user_id_key" UNIQUE ("note_id", "member_user_id");



ALTER TABLE ONLY "public"."note_shares"
    ADD CONSTRAINT "note_shares_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."note_tag_links"
    ADD CONSTRAINT "note_tag_links_pkey" PRIMARY KEY ("note_id", "tag_id");



ALTER TABLE ONLY "public"."note_tags"
    ADD CONSTRAINT "note_tags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notes"
    ADD CONSTRAINT "notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."post_versions"
    ADD CONSTRAINT "post_versions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."post_versions"
    ADD CONSTRAINT "post_versions_post_id_version_number_key" UNIQUE ("post_id", "version_number");



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."proposal_line_items"
    ADD CONSTRAINT "proposal_line_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."proposals"
    ADD CONSTRAINT "proposals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."proposals"
    ADD CONSTRAINT "proposals_share_token_key" UNIQUE ("share_token");



ALTER TABLE ONLY "public"."prospect_activities"
    ADD CONSTRAINT "prospect_activities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."prospects"
    ADD CONSTRAINT "prospects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recurring_invoices"
    ADD CONSTRAINT "recurring_invoices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."schedules"
    ADD CONSTRAINT "schedules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."schedules"
    ADD CONSTRAINT "schedules_post_version_id_key" UNIQUE ("post_version_id");



ALTER TABLE ONLY "public"."share_tokens"
    ADD CONSTRAINT "share_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."share_tokens"
    ADD CONSTRAINT "share_tokens_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."task_activity"
    ADD CONSTRAINT "task_activity_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."task_posts"
    ADD CONSTRAINT "task_posts_pkey" PRIMARY KEY ("task_id", "post_id");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_feedback"
    ADD CONSTRAINT "user_feedback_pkey" PRIMARY KEY ("id");



CREATE INDEX "admin_prospect_activity_prospect_id_created_at_idx" ON "public"."admin_prospect_activity" USING "btree" ("prospect_id", "created_at" DESC);



CREATE INDEX "admin_prospects_email_idx" ON "public"."admin_prospects" USING "btree" ("email");



CREATE INDEX "admin_prospects_tercero_user_id_idx" ON "public"."admin_prospects" USING "btree" ("tercero_user_id");



CREATE UNIQUE INDEX "agency_job_roles_workspace_name_key" ON "public"."agency_job_roles" USING "btree" ("workspace_id", "lower"("name"));



CREATE INDEX "agency_member_job_roles_member_idx" ON "public"."agency_member_job_roles" USING "btree" ("workspace_id", "member_user_id");



CREATE INDEX "chat_channel_members_user_idx" ON "public"."chat_channel_members" USING "btree" ("user_id");



CREATE UNIQUE INDEX "chat_channels_one_workspace_per_workspace" ON "public"."chat_channels" USING "btree" ("workspace_id") WHERE ("type" = 'workspace'::"text");



CREATE INDEX "chat_messages_channel_created_idx" ON "public"."chat_messages" USING "btree" ("channel_id", "created_at" DESC);



CREATE INDEX "client_documents_prospect_id_idx" ON "public"."client_documents" USING "btree" ("prospect_id");



CREATE INDEX "comment_reactions_comment_idx" ON "public"."comment_reactions" USING "btree" ("comment_id");



CREATE INDEX "comments_thread_idx" ON "public"."comments" USING "btree" ("entity_type", "entity_id", "created_at");



CREATE INDEX "idx_approval_events_post_version" ON "public"."approval_events" USING "btree" ("post_version_id");



CREATE INDEX "idx_approval_events_workspace_created" ON "public"."approval_events" USING "btree" ("workspace_user_id", "created_at" DESC);



CREATE INDEX "idx_campaigns_client_id" ON "public"."campaigns" USING "btree" ("client_id");



CREATE INDEX "idx_campaigns_status" ON "public"."campaigns" USING "btree" ("status");



CREATE INDEX "idx_campaigns_user_id" ON "public"."campaigns" USING "btree" ("user_id");



CREATE INDEX "idx_client_documents_category" ON "public"."client_documents" USING "btree" ("category");



CREATE INDEX "idx_client_documents_client_id" ON "public"."client_documents" USING "btree" ("client_id");



CREATE INDEX "idx_client_documents_collection_id" ON "public"."client_documents" USING "btree" ("collection_id");



CREATE INDEX "idx_client_documents_status" ON "public"."client_documents" USING "btree" ("status");



CREATE INDEX "idx_client_documents_user_id" ON "public"."client_documents" USING "btree" ("user_id");



CREATE INDEX "idx_document_collections_client_id" ON "public"."document_collections" USING "btree" ("client_id");



CREATE INDEX "idx_document_collections_user_id" ON "public"."document_collections" USING "btree" ("user_id");



CREATE INDEX "idx_expenses_category" ON "public"."expenses" USING "btree" ("category");



CREATE INDEX "idx_expenses_next_billing" ON "public"."expenses" USING "btree" ("next_billing_date");



CREATE INDEX "idx_invoices_campaign_id" ON "public"."invoices" USING "btree" ("campaign_id");



CREATE INDEX "idx_notes_client_id" ON "public"."notes" USING "btree" ("client_id");



CREATE INDEX "idx_notes_user_id" ON "public"."notes" USING "btree" ("user_id");



CREATE INDEX "idx_posts_campaign_id" ON "public"."posts" USING "btree" ("campaign_id");



CREATE INDEX "idx_share_tokens_token" ON "public"."share_tokens" USING "btree" ("token");



CREATE INDEX "idx_transactions_campaign_id" ON "public"."transactions" USING "btree" ("campaign_id");



CREATE INDEX "idx_transactions_client" ON "public"."transactions" USING "btree" ("client_id");



CREATE INDEX "idx_transactions_invoice_id" ON "public"."transactions" USING "btree" ("invoice_id") WHERE ("invoice_id" IS NOT NULL);



CREATE INDEX "idx_transactions_user_date" ON "public"."transactions" USING "btree" ("user_id", "date");



CREATE INDEX "idx_user_feedback_status" ON "public"."user_feedback" USING "btree" ("status");



CREATE INDEX "idx_user_feedback_type" ON "public"."user_feedback" USING "btree" ("type");



CREATE INDEX "idx_user_feedback_workspace" ON "public"."user_feedback" USING "btree" ("workspace_user_id");



CREATE INDEX "note_tag_links_tag_id_idx" ON "public"."note_tag_links" USING "btree" ("tag_id");



CREATE UNIQUE INDEX "note_tags_user_name_unique" ON "public"."note_tags" USING "btree" ("user_id", "lower"("name"));



CREATE INDEX "notifications_created_at_idx" ON "public"."notifications" USING "btree" ("created_at");



CREATE INDEX "notifications_list_idx" ON "public"."notifications" USING "btree" ("recipient_user_id", "created_at" DESC);



CREATE INDEX "notifications_unread_idx" ON "public"."notifications" USING "btree" ("recipient_user_id", "read_at") WHERE ("read_at" IS NULL);



CREATE INDEX "proposals_prospect_id_idx" ON "public"."proposals" USING "btree" ("prospect_id");



CREATE INDEX "prospect_activities_prospect_idx" ON "public"."prospect_activities" USING "btree" ("prospect_id", "occurred_at" DESC);



CREATE INDEX "prospects_converted_client_id_idx" ON "public"."prospects" USING "btree" ("converted_client_id");



CREATE INDEX "prospects_followup_idx" ON "public"."prospects" USING "btree" ("user_id", "next_followup_at");



CREATE INDEX "prospects_status_idx" ON "public"."prospects" USING "btree" ("user_id", "status");



CREATE INDEX "prospects_user_id_idx" ON "public"."prospects" USING "btree" ("user_id");



CREATE INDEX "task_activity_participants_idx" ON "public"."task_activity" USING "btree" ("task_id", "to_user_id") WHERE ("type" = 'assigned'::"text");



CREATE INDEX "task_activity_task_created_idx" ON "public"."task_activity" USING "btree" ("task_id", "created_at" DESC);



CREATE INDEX "task_posts_post_id_idx" ON "public"."task_posts" USING "btree" ("post_id");



CREATE INDEX "task_posts_workspace_idx" ON "public"."task_posts" USING "btree" ("workspace_id");



CREATE INDEX "tasks_assigned_to_idx" ON "public"."tasks" USING "btree" ("assigned_to");



CREATE INDEX "tasks_campaign_idx" ON "public"."tasks" USING "btree" ("campaign_id");



CREATE INDEX "tasks_client_idx" ON "public"."tasks" USING "btree" ("client_id");



CREATE INDEX "tasks_status_idx" ON "public"."tasks" USING "btree" ("status");



CREATE INDEX "tasks_workspace_idx" ON "public"."tasks" USING "btree" ("workspace_id");



CREATE UNIQUE INDEX "unique_internal_client_per_user" ON "public"."clients" USING "btree" ("user_id") WHERE ("is_internal" = true);



CREATE OR REPLACE TRIGGER "admin_feedback_updated_at" BEFORE UPDATE ON "public"."admin_feedback" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "admin_prospects_updated_at" BEFORE UPDATE ON "public"."admin_prospects" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "app_config_updated_at" BEFORE UPDATE ON "public"."app_config" FOR EACH ROW EXECUTE FUNCTION "public"."update_app_config_timestamp"();



CREATE OR REPLACE TRIGGER "enforce_client_limit" BEFORE INSERT ON "public"."clients" FOR EACH ROW EXECUTE FUNCTION "public"."check_client_limit"();



CREATE OR REPLACE TRIGGER "guard_post_version_updates" BEFORE UPDATE ON "public"."post_versions" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_illegal_updates"();



CREATE OR REPLACE TRIGGER "meetings_set_creator" BEFORE INSERT ON "public"."meetings" FOR EACH ROW EXECUTE FUNCTION "public"."set_meeting_creator_id"();



CREATE OR REPLACE TRIGGER "tg_autocomplete_tasks" AFTER UPDATE OF "status" ON "public"."post_versions" FOR EACH ROW EXECUTE FUNCTION "public"."tg_autocomplete_tasks_on_publish"();



CREATE OR REPLACE TRIGGER "tg_chat_message_author_name" BEFORE INSERT ON "public"."chat_messages" FOR EACH ROW EXECUTE FUNCTION "public"."tg_chat_message_author_name"();



CREATE OR REPLACE TRIGGER "tg_comment_adds_task_participants" AFTER INSERT ON "public"."comments" FOR EACH ROW EXECUTE FUNCTION "public"."tg_comment_adds_task_participants"();



CREATE OR REPLACE TRIGGER "tr_notes_visibility_author_only" BEFORE UPDATE ON "public"."notes" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_note_visibility_author_only"();



CREATE OR REPLACE TRIGGER "tr_notify_note_shared" AFTER INSERT ON "public"."note_shares" FOR EACH ROW EXECUTE FUNCTION "public"."tg_notify_note_shared"();



CREATE OR REPLACE TRIGGER "tr_subscription_plan_change" BEFORE UPDATE ON "public"."agency_subscriptions" FOR EACH ROW EXECUTE FUNCTION "public"."set_subscription_ends_at_on_plan_change"();



CREATE OR REPLACE TRIGGER "trg_delete_comments_on_campaign_delete" AFTER DELETE ON "public"."campaigns" FOR EACH ROW EXECUTE FUNCTION "public"."tg_delete_orphaned_comments"('campaign');



CREATE OR REPLACE TRIGGER "trg_delete_comments_on_post_delete" AFTER DELETE ON "public"."posts" FOR EACH ROW EXECUTE FUNCTION "public"."tg_delete_orphaned_comments"('post');



CREATE OR REPLACE TRIGGER "trg_enforce_owner_only_signatory" BEFORE UPDATE ON "public"."agency_subscriptions" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_owner_only_signatory"();



CREATE OR REPLACE TRIGGER "trg_enforce_task_assignment" BEFORE INSERT OR UPDATE ON "public"."tasks" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_task_assignment"();



CREATE OR REPLACE TRIGGER "trg_log_task_activity" AFTER INSERT OR UPDATE ON "public"."tasks" FOR EACH ROW EXECUTE FUNCTION "public"."tg_log_task_activity"();



CREATE OR REPLACE TRIGGER "trg_notify_chat_message" AFTER INSERT ON "public"."chat_messages" FOR EACH ROW EXECUTE FUNCTION "public"."tg_notify_chat_message"();



CREATE OR REPLACE TRIGGER "trg_notify_comment_added" AFTER INSERT ON "public"."comments" FOR EACH ROW EXECUTE FUNCTION "public"."tg_notify_comment_added"();



CREATE OR REPLACE TRIGGER "trg_notify_task_changes" AFTER INSERT OR UPDATE ON "public"."tasks" FOR EACH ROW EXECUTE FUNCTION "public"."tg_notify_task_changes"();



CREATE OR REPLACE TRIGGER "trg_post_version_status_transition" BEFORE UPDATE OF "status" ON "public"."post_versions" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_post_status_transition"();



CREATE OR REPLACE TRIGGER "trg_post_versions_updated_by" BEFORE UPDATE ON "public"."post_versions" FOR EACH ROW EXECUTE FUNCTION "public"."set_post_version_updated_by"();



CREATE OR REPLACE TRIGGER "trg_set_post_creator" AFTER INSERT ON "public"."post_versions" FOR EACH ROW EXECUTE FUNCTION "public"."tg_set_post_creator"();



CREATE OR REPLACE TRIGGER "trg_user_feedback_updated_at" BEFORE UPDATE ON "public"."user_feedback" FOR EACH ROW EXECUTE FUNCTION "public"."update_user_feedback_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_update_current_version" AFTER INSERT ON "public"."post_versions" FOR EACH ROW EXECUTE FUNCTION "public"."update_post_current_version"();



ALTER TABLE ONLY "public"."admin_feedback"
    ADD CONSTRAINT "admin_feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."admin_outreach_log"
    ADD CONSTRAINT "admin_outreach_log_prospect_id_fkey" FOREIGN KEY ("prospect_id") REFERENCES "public"."admin_prospects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."admin_prospect_activity"
    ADD CONSTRAINT "admin_prospect_activity_prospect_id_fkey" FOREIGN KEY ("prospect_id") REFERENCES "public"."admin_prospects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."admin_prospects"
    ADD CONSTRAINT "admin_prospects_tercero_user_id_fkey" FOREIGN KEY ("tercero_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."agency_invites"
    ADD CONSTRAINT "agency_invites_agency_user_id_fkey" FOREIGN KEY ("agency_user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."agency_member_job_roles"
    ADD CONSTRAINT "agency_member_job_roles_job_role_id_fkey" FOREIGN KEY ("job_role_id") REFERENCES "public"."agency_job_roles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agency_members"
    ADD CONSTRAINT "agency_members_agency_user_id_fkey" FOREIGN KEY ("agency_user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."agency_members"
    ADD CONSTRAINT "agency_members_member_user_id_fkey" FOREIGN KEY ("member_user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."agency_subscriptions"
    ADD CONSTRAINT "agency_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."approval_events"
    ADD CONSTRAINT "approval_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."approval_events"
    ADD CONSTRAINT "approval_events_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."approval_events"
    ADD CONSTRAINT "approval_events_post_version_id_fkey" FOREIGN KEY ("post_version_id") REFERENCES "public"."post_versions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."approval_events"
    ADD CONSTRAINT "approval_events_workspace_user_id_fkey" FOREIGN KEY ("workspace_user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."approvals"
    ADD CONSTRAINT "approvals_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."approvals"
    ADD CONSTRAINT "approvals_post_version_id_fkey" FOREIGN KEY ("post_version_id") REFERENCES "public"."post_versions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."campaigns"
    ADD CONSTRAINT "campaigns_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."campaigns"
    ADD CONSTRAINT "campaigns_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_channel_members"
    ADD CONSTRAINT "chat_channel_members_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "public"."chat_channels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_channel_members"
    ADD CONSTRAINT "chat_channel_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_channels"
    ADD CONSTRAINT "chat_channels_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_message_reactions"
    ADD CONSTRAINT "chat_message_reactions_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."chat_messages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_message_reactions"
    ADD CONSTRAINT "chat_message_reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "public"."chat_channels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_documents"
    ADD CONSTRAINT "client_documents_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_documents"
    ADD CONSTRAINT "client_documents_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "public"."document_collections"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."client_documents"
    ADD CONSTRAINT "client_documents_prospect_id_fkey" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."client_documents"
    ADD CONSTRAINT "client_documents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_users"
    ADD CONSTRAINT "client_users_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comment_reactions"
    ADD CONSTRAINT "comment_reactions_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."document_collections"
    ADD CONSTRAINT "document_collections_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."document_collections"
    ADD CONSTRAINT "document_collections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_assigned_client_id_fkey" FOREIGN KEY ("assigned_client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "fk_current_version" FOREIGN KEY ("current_version_id") REFERENCES "public"."post_versions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."invoice_items"
    ADD CONSTRAINT "invoice_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invoice_items"
    ADD CONSTRAINT "invoice_items_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."meetings"
    ADD CONSTRAINT "meetings_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."meetings"
    ADD CONSTRAINT "meetings_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."meetings"
    ADD CONSTRAINT "meetings_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."note_shares"
    ADD CONSTRAINT "note_shares_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."note_shares"
    ADD CONSTRAINT "note_shares_member_user_id_fkey" FOREIGN KEY ("member_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."note_shares"
    ADD CONSTRAINT "note_shares_note_id_fkey" FOREIGN KEY ("note_id") REFERENCES "public"."notes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."note_tag_links"
    ADD CONSTRAINT "note_tag_links_note_id_fkey" FOREIGN KEY ("note_id") REFERENCES "public"."notes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."note_tag_links"
    ADD CONSTRAINT "note_tag_links_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "public"."note_tags"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."note_tags"
    ADD CONSTRAINT "note_tags_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notes"
    ADD CONSTRAINT "notes_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notes"
    ADD CONSTRAINT "notes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."notes"
    ADD CONSTRAINT "notes_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."notes"
    ADD CONSTRAINT "notes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_versions"
    ADD CONSTRAINT "post_versions_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_versions"
    ADD CONSTRAINT "post_versions_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_versions"
    ADD CONSTRAINT "post_versions_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."post_versions"
    ADD CONSTRAINT "post_versions_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."proposal_line_items"
    ADD CONSTRAINT "proposal_line_items_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."proposals"
    ADD CONSTRAINT "proposals_agency_user_id_fkey" FOREIGN KEY ("agency_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."proposals"
    ADD CONSTRAINT "proposals_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."proposals"
    ADD CONSTRAINT "proposals_prospect_id_fkey" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."prospect_activities"
    ADD CONSTRAINT "prospect_activities_prospect_id_fkey" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."prospects"
    ADD CONSTRAINT "prospects_converted_client_id_fkey" FOREIGN KEY ("converted_client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."prospects"
    ADD CONSTRAINT "prospects_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recurring_invoices"
    ADD CONSTRAINT "recurring_invoices_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recurring_invoices"
    ADD CONSTRAINT "recurring_invoices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."schedules"
    ADD CONSTRAINT "schedules_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."schedules"
    ADD CONSTRAINT "schedules_post_version_id_fkey" FOREIGN KEY ("post_version_id") REFERENCES "public"."post_versions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."share_tokens"
    ADD CONSTRAINT "share_tokens_post_version_id_fkey" FOREIGN KEY ("post_version_id") REFERENCES "public"."post_versions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_activity"
    ADD CONSTRAINT "task_activity_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_posts"
    ADD CONSTRAINT "task_posts_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_posts"
    ADD CONSTRAINT "task_posts_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_feedback"
    ADD CONSTRAINT "user_feedback_submitter_user_id_fkey" FOREIGN KEY ("submitter_user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."user_feedback"
    ADD CONSTRAINT "user_feedback_workspace_user_id_fkey" FOREIGN KEY ("workspace_user_id") REFERENCES "auth"."users"("id");



CREATE POLICY "Public read app_config" ON "public"."app_config" FOR SELECT USING (true);



CREATE POLICY "Superadmins can update feedback status" ON "public"."user_feedback" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."agency_members"
  WHERE (("agency_members"."member_user_id" = "auth"."uid"()) AND ("agency_members"."system_role" = 'superadmin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."agency_members"
  WHERE (("agency_members"."member_user_id" = "auth"."uid"()) AND ("agency_members"."system_role" = 'superadmin'::"text")))));



CREATE POLICY "Superadmins can view all feedback" ON "public"."user_feedback" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."agency_members"
  WHERE (("agency_members"."member_user_id" = "auth"."uid"()) AND ("agency_members"."system_role" = 'superadmin'::"text")))));



CREATE POLICY "Users can dismiss own feedback" ON "public"."user_feedback" FOR UPDATE USING (("workspace_user_id" = ( SELECT "public"."get_my_agency_user_id"() AS "get_my_agency_user_id"))) WITH CHECK (("dismissed_by_user" = true));



CREATE POLICY "Users insert own feedback" ON "public"."user_feedback" FOR INSERT WITH CHECK ((("workspace_user_id" = ( SELECT "public"."get_my_agency_user_id"() AS "get_my_agency_user_id")) AND ("submitter_user_id" = "auth"."uid"())));



CREATE POLICY "Users view own workspace feedback" ON "public"."user_feedback" FOR SELECT USING (("workspace_user_id" = ( SELECT "public"."get_my_agency_user_id"() AS "get_my_agency_user_id")));



ALTER TABLE "public"."admin_feedback" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."admin_outreach_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."admin_outreach_notes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."admin_prospect_activity" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."admin_prospects" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."agency_invites" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "agency_invites_insert_owner" ON "public"."agency_invites" FOR INSERT WITH CHECK ((("agency_user_id" = "public"."get_my_agency_user_id"()) AND "public"."is_workspace_owner"()));



CREATE POLICY "agency_invites_select_owner" ON "public"."agency_invites" FOR SELECT USING (("auth"."uid"() = "agency_user_id"));



CREATE POLICY "agency_invites_update_owner" ON "public"."agency_invites" FOR UPDATE USING (("auth"."uid"() = "agency_user_id"));



ALTER TABLE "public"."agency_job_roles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "agency_job_roles_select_workspace" ON "public"."agency_job_roles" FOR SELECT USING (("workspace_id" = "public"."get_my_agency_user_id"()));



CREATE POLICY "agency_job_roles_write_owner" ON "public"."agency_job_roles" USING ((("workspace_id" = "public"."get_my_agency_user_id"()) AND "public"."is_workspace_owner"())) WITH CHECK ((("workspace_id" = "public"."get_my_agency_user_id"()) AND "public"."is_workspace_owner"()));



ALTER TABLE "public"."agency_member_job_roles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "agency_member_job_roles_select_workspace" ON "public"."agency_member_job_roles" FOR SELECT USING (("workspace_id" = "public"."get_my_agency_user_id"()));



CREATE POLICY "agency_member_job_roles_write_owner" ON "public"."agency_member_job_roles" USING ((("workspace_id" = "public"."get_my_agency_user_id"()) AND "public"."is_workspace_owner"())) WITH CHECK ((("workspace_id" = "public"."get_my_agency_user_id"()) AND "public"."is_workspace_owner"()));



ALTER TABLE "public"."agency_members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "agency_members_delete_owner" ON "public"."agency_members" FOR DELETE USING (("auth"."uid"() = "agency_user_id"));



CREATE POLICY "agency_members_insert_owner" ON "public"."agency_members" FOR INSERT WITH CHECK (("auth"."uid"() = "agency_user_id"));



CREATE POLICY "agency_members_select_owner" ON "public"."agency_members" FOR SELECT USING (("auth"."uid"() = "agency_user_id"));



CREATE POLICY "agency_members_select_self" ON "public"."agency_members" FOR SELECT USING (("auth"."uid"() = "member_user_id"));



CREATE POLICY "agency_members_update_owner" ON "public"."agency_members" FOR UPDATE USING (("auth"."uid"() = "agency_user_id"));



ALTER TABLE "public"."agency_subscriptions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "agency_subscriptions_workspace_scoped" ON "public"."agency_subscriptions" USING (("user_id" = "public"."get_my_agency_user_id"())) WITH CHECK (("user_id" = "public"."get_my_agency_user_id"()));



CREATE POLICY "any_authenticated_can_submit_feedback" ON "public"."admin_feedback" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



ALTER TABLE "public"."app_config" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."approval_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "approval_events_delete" ON "public"."approval_events" FOR DELETE USING ((("workspace_user_id" = "public"."get_my_agency_user_id"()) AND "public"."is_workspace_admin"()));



CREATE POLICY "approval_events_select" ON "public"."approval_events" FOR SELECT USING (("workspace_user_id" = "public"."get_my_agency_user_id"()));



ALTER TABLE "public"."approvals" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "approvals_workspace_scoped" ON "public"."approvals" USING ((EXISTS ( SELECT 1
   FROM "public"."clients"
  WHERE (("clients"."id" = "approvals"."client_id") AND ("clients"."user_id" = "public"."get_my_agency_user_id"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."clients"
  WHERE (("clients"."id" = "approvals"."client_id") AND ("clients"."user_id" = "public"."get_my_agency_user_id"())))));



ALTER TABLE "public"."campaigns" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "campaigns_workspace_scoped" ON "public"."campaigns" USING (("user_id" = "public"."get_my_agency_user_id"())) WITH CHECK (("user_id" = "public"."get_my_agency_user_id"()));



CREATE POLICY "cd_delete" ON "public"."client_documents" FOR DELETE USING ((("user_id" = "public"."get_my_agency_user_id"()) AND ("public"."my_documents_level"() = 'manage'::"text")));



CREATE POLICY "cd_insert" ON "public"."client_documents" FOR INSERT WITH CHECK ((("user_id" = "public"."get_my_agency_user_id"()) AND ("public"."my_documents_level"() = 'manage'::"text")));



CREATE POLICY "cd_select" ON "public"."client_documents" FOR SELECT USING ((("user_id" = "public"."get_my_agency_user_id"()) AND ("public"."my_documents_level"() <> 'none'::"text") AND (("is_confidential" = false) OR "public"."can_view_confidential_docs"())));



CREATE POLICY "cd_update" ON "public"."client_documents" FOR UPDATE USING ((("user_id" = "public"."get_my_agency_user_id"()) AND ("public"."my_documents_level"() = 'manage'::"text"))) WITH CHECK ((("user_id" = "public"."get_my_agency_user_id"()) AND ("public"."my_documents_level"() = 'manage'::"text")));



ALTER TABLE "public"."chat_channel_members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "chat_channel_members: member can select" ON "public"."chat_channel_members" FOR SELECT USING ("public"."is_chat_channel_member"("channel_id"));



ALTER TABLE "public"."chat_channels" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "chat_channels: member can select" ON "public"."chat_channels" FOR SELECT USING ("public"."is_chat_channel_member"("id"));



ALTER TABLE "public"."chat_message_reactions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "chat_message_reactions: channel member can select" ON "public"."chat_message_reactions" FOR SELECT USING ("public"."is_chat_message_channel_member"("message_id"));



CREATE POLICY "chat_message_reactions: user can delete own" ON "public"."chat_message_reactions" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "chat_message_reactions: user can insert own" ON "public"."chat_message_reactions" FOR INSERT WITH CHECK ((("user_id" = "auth"."uid"()) AND "public"."is_chat_message_channel_member"("message_id")));



ALTER TABLE "public"."chat_messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "chat_messages: author can update" ON "public"."chat_messages" FOR UPDATE USING (("author_user_id" = "auth"."uid"())) WITH CHECK (("author_user_id" = "auth"."uid"()));



CREATE POLICY "chat_messages: channel member can insert" ON "public"."chat_messages" FOR INSERT WITH CHECK ((("workspace_id" = "public"."get_my_agency_user_id"()) AND ("author_user_id" = "auth"."uid"()) AND "public"."is_chat_channel_member"("channel_id") AND "public"."is_chat_enabled_for_workspace"("workspace_id")));



CREATE POLICY "chat_messages: channel member can select" ON "public"."chat_messages" FOR SELECT USING ("public"."is_chat_channel_member"("channel_id"));



ALTER TABLE "public"."client_documents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."client_users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."clients" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "clients_enforce_limit" ON "public"."clients" FOR INSERT WITH CHECK ((("user_id" = "public"."get_my_agency_user_id"()) AND (( SELECT "count"(*) AS "count"
   FROM "public"."clients" "c"
  WHERE ("c"."user_id" = "public"."get_my_agency_user_id"())) < ( SELECT "agency_subscriptions"."max_clients"
   FROM "public"."agency_subscriptions"
  WHERE ("agency_subscriptions"."user_id" = "public"."get_my_agency_user_id"())))));



CREATE POLICY "clients_workspace_scoped" ON "public"."clients" USING (("user_id" = "public"."get_my_agency_user_id"())) WITH CHECK (("user_id" = "public"."get_my_agency_user_id"()));



ALTER TABLE "public"."comment_reactions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "comment_reactions: user can delete own" ON "public"."comment_reactions" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "comment_reactions: user can insert own" ON "public"."comment_reactions" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."comments" "c"
  WHERE (("c"."id" = "comment_reactions"."comment_id") AND ("c"."workspace_id" = "public"."get_my_agency_user_id"()))))));



CREATE POLICY "comment_reactions: workspace member can select" ON "public"."comment_reactions" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."comments" "c"
  WHERE (("c"."id" = "comment_reactions"."comment_id") AND ("c"."workspace_id" = "public"."get_my_agency_user_id"())))));



ALTER TABLE "public"."comments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "comments: author can insert" ON "public"."comments" FOR INSERT WITH CHECK ((("workspace_id" = "public"."get_my_agency_user_id"()) AND ("author_user_id" = "auth"."uid"()) AND (("entity_type" <> 'task'::"text") OR (EXISTS ( SELECT 1
   FROM "public"."tasks" "t"
  WHERE ("t"."id" = "comments"."entity_id"))))));



CREATE POLICY "comments: author can update" ON "public"."comments" FOR UPDATE TO "authenticated" USING (("author_user_id" = "auth"."uid"())) WITH CHECK (("author_user_id" = "auth"."uid"()));



CREATE POLICY "comments: workspace member can select" ON "public"."comments" FOR SELECT USING ((("workspace_id" = "public"."get_my_agency_user_id"()) AND (("entity_type" <> 'task'::"text") OR (EXISTS ( SELECT 1
   FROM "public"."tasks" "t"
  WHERE ("t"."id" = "comments"."entity_id"))))));



CREATE POLICY "dc_delete" ON "public"."document_collections" FOR DELETE USING ((("user_id" = "public"."get_my_agency_user_id"()) AND ("public"."my_documents_level"() = 'manage'::"text")));



CREATE POLICY "dc_insert" ON "public"."document_collections" FOR INSERT WITH CHECK ((("user_id" = "public"."get_my_agency_user_id"()) AND ("public"."my_documents_level"() = 'manage'::"text")));



CREATE POLICY "dc_select" ON "public"."document_collections" FOR SELECT USING ((("user_id" = "public"."get_my_agency_user_id"()) AND ("public"."my_documents_level"() <> 'none'::"text")));



CREATE POLICY "dc_update" ON "public"."document_collections" FOR UPDATE USING ((("user_id" = "public"."get_my_agency_user_id"()) AND ("public"."my_documents_level"() = 'manage'::"text"))) WITH CHECK ((("user_id" = "public"."get_my_agency_user_id"()) AND ("public"."my_documents_level"() = 'manage'::"text")));



ALTER TABLE "public"."document_collections" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."expenses" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "expenses_workspace_scoped" ON "public"."expenses" USING ((("user_id" = "public"."get_my_agency_user_id"()) AND "public"."can_access_finance"())) WITH CHECK ((("user_id" = "public"."get_my_agency_user_id"()) AND "public"."can_access_finance"()));



CREATE POLICY "internal_client_access" ON "public"."posts" USING ((EXISTS ( SELECT 1
   FROM "public"."client_users" "cu"
  WHERE (("cu"."client_id" = "posts"."client_id") AND ("cu"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."invoice_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "invoice_items_workspace_scoped" ON "public"."invoice_items" USING (("public"."can_access_finance"() AND ("invoice_id" IN ( SELECT "invoices"."id"
   FROM "public"."invoices"
  WHERE ("invoices"."user_id" = "public"."get_my_agency_user_id"()))))) WITH CHECK (("public"."can_access_finance"() AND ("invoice_id" IN ( SELECT "invoices"."id"
   FROM "public"."invoices"
  WHERE ("invoices"."user_id" = "public"."get_my_agency_user_id"())))));



ALTER TABLE "public"."invoices" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "invoices_workspace_scoped" ON "public"."invoices" USING ((("user_id" = "public"."get_my_agency_user_id"()) AND "public"."can_access_finance"())) WITH CHECK ((("user_id" = "public"."get_my_agency_user_id"()) AND "public"."can_access_finance"()));



ALTER TABLE "public"."meetings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "meetings_delete" ON "public"."meetings" FOR DELETE USING ((("client_id" IN ( SELECT "clients"."id"
   FROM "public"."clients"
  WHERE ("clients"."user_id" = "public"."get_my_agency_user_id"()))) AND (("visibility" = 'public'::"text") OR ("creator_id" = "auth"."uid"()))));



CREATE POLICY "meetings_insert" ON "public"."meetings" FOR INSERT WITH CHECK (("client_id" IN ( SELECT "clients"."id"
   FROM "public"."clients"
  WHERE ("clients"."user_id" = "public"."get_my_agency_user_id"()))));



CREATE POLICY "meetings_select" ON "public"."meetings" FOR SELECT USING ((("client_id" IN ( SELECT "clients"."id"
   FROM "public"."clients"
  WHERE ("clients"."user_id" = "public"."get_my_agency_user_id"()))) AND (("visibility" = 'public'::"text") OR ("creator_id" = "auth"."uid"()))));



CREATE POLICY "meetings_update" ON "public"."meetings" FOR UPDATE USING ((("client_id" IN ( SELECT "clients"."id"
   FROM "public"."clients"
  WHERE ("clients"."user_id" = "public"."get_my_agency_user_id"()))) AND (("visibility" = 'public'::"text") OR ("creator_id" = "auth"."uid"())))) WITH CHECK (("client_id" IN ( SELECT "clients"."id"
   FROM "public"."clients"
  WHERE ("clients"."user_id" = "public"."get_my_agency_user_id"()))));



ALTER TABLE "public"."note_shares" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "note_shares_author_manages" ON "public"."note_shares" USING ("public"."is_note_author"("note_id")) WITH CHECK ("public"."is_note_author"("note_id"));



CREATE POLICY "note_shares_visible_to_collaborators" ON "public"."note_shares" FOR SELECT USING (("public"."my_note_share_permission"("note_id") IS NOT NULL));



ALTER TABLE "public"."note_tag_links" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "note_tag_links_visibility_scoped" ON "public"."note_tag_links" USING ((EXISTS ( SELECT 1
   FROM "public"."notes" "n"
  WHERE (("n"."id" = "note_tag_links"."note_id") AND ("n"."user_id" = "public"."get_my_agency_user_id"()) AND (("n"."created_by" = "auth"."uid"()) OR ("n"."visibility" = 'workspace'::"text") OR (("n"."visibility" = 'shared'::"text") AND ("public"."my_note_share_permission"("n"."id") IS NOT NULL))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."notes" "n"
  WHERE (("n"."id" = "note_tag_links"."note_id") AND ("n"."user_id" = "public"."get_my_agency_user_id"()) AND (("n"."created_by" = "auth"."uid"()) OR ("n"."visibility" = 'workspace'::"text") OR (("n"."visibility" = 'shared'::"text") AND ("public"."my_note_share_permission"("n"."id") = 'write'::"text")))))));



ALTER TABLE "public"."note_tags" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "note_tags_workspace_scoped" ON "public"."note_tags" USING (("user_id" = "public"."get_my_agency_user_id"())) WITH CHECK (("user_id" = "public"."get_my_agency_user_id"()));



ALTER TABLE "public"."notes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notes_delete" ON "public"."notes" FOR DELETE USING ((("user_id" = "public"."get_my_agency_user_id"()) AND (("created_by" = "auth"."uid"()) OR (("visibility" = 'workspace'::"text") AND "public"."is_workspace_admin"()))));



CREATE POLICY "notes_insert" ON "public"."notes" FOR INSERT WITH CHECK ((("user_id" = "public"."get_my_agency_user_id"()) AND ("created_by" = "auth"."uid"())));



CREATE POLICY "notes_select" ON "public"."notes" FOR SELECT USING ((("user_id" = "public"."get_my_agency_user_id"()) AND (("created_by" = "auth"."uid"()) OR ("visibility" = 'workspace'::"text") OR (("visibility" = 'shared'::"text") AND ("public"."my_note_share_permission"("id") IS NOT NULL)))));



CREATE POLICY "notes_update" ON "public"."notes" FOR UPDATE USING ((("user_id" = "public"."get_my_agency_user_id"()) AND (("created_by" = "auth"."uid"()) OR ("visibility" = 'workspace'::"text") OR (("visibility" = 'shared'::"text") AND ("public"."my_note_share_permission"("id") = 'write'::"text"))))) WITH CHECK ((("user_id" = "public"."get_my_agency_user_id"()) AND (("created_by" = "auth"."uid"()) OR ("visibility" = 'workspace'::"text") OR (("visibility" = 'shared'::"text") AND ("public"."my_note_share_permission"("id") = 'write'::"text")))));



ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notifications: recipient can delete" ON "public"."notifications" FOR DELETE USING (("recipient_user_id" = "auth"."uid"()));



CREATE POLICY "notifications: recipient can select" ON "public"."notifications" FOR SELECT TO "authenticated" USING (("recipient_user_id" = "auth"."uid"()));



CREATE POLICY "notifications: recipient can update" ON "public"."notifications" FOR UPDATE TO "authenticated" USING (("recipient_user_id" = "auth"."uid"())) WITH CHECK (("recipient_user_id" = "auth"."uid"()));



CREATE POLICY "notifications: workspace member can insert" ON "public"."notifications" FOR INSERT TO "authenticated" WITH CHECK (("workspace_id" = "public"."get_my_agency_user_id"()));



ALTER TABLE "public"."post_versions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "post_versions_workspace_scoped" ON "public"."post_versions" USING ((EXISTS ( SELECT 1
   FROM "public"."clients"
  WHERE (("clients"."id" = "post_versions"."client_id") AND ("clients"."user_id" = "public"."get_my_agency_user_id"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."clients"
  WHERE (("clients"."id" = "post_versions"."client_id") AND ("clients"."user_id" = "public"."get_my_agency_user_id"())))));



ALTER TABLE "public"."posts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "posts_workspace_delete" ON "public"."posts" FOR DELETE USING (((EXISTS ( SELECT 1
   FROM "public"."clients"
  WHERE (("clients"."id" = "posts"."client_id") AND ("clients"."user_id" = "public"."get_my_agency_user_id"())))) AND ("public"."is_workspace_admin"() OR (("created_by" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."post_versions" "pv"
  WHERE (("pv"."id" = "posts"."current_version_id") AND (("pv"."status")::"text" = ANY (ARRAY['DRAFT'::"text", 'SUBMITTED'::"text", 'ARCHIVED'::"text"])))))))));



CREATE POLICY "posts_workspace_insert" ON "public"."posts" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."clients"
  WHERE (("clients"."id" = "posts"."client_id") AND ("clients"."user_id" = "public"."get_my_agency_user_id"())))));



CREATE POLICY "posts_workspace_select" ON "public"."posts" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."clients"
  WHERE (("clients"."id" = "posts"."client_id") AND ("clients"."user_id" = "public"."get_my_agency_user_id"())))));



CREATE POLICY "posts_workspace_update" ON "public"."posts" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."clients"
  WHERE (("clients"."id" = "posts"."client_id") AND ("clients"."user_id" = "public"."get_my_agency_user_id"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."clients"
  WHERE (("clients"."id" = "posts"."client_id") AND ("clients"."user_id" = "public"."get_my_agency_user_id"())))));



ALTER TABLE "public"."proposal_line_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "proposal_line_items_access" ON "public"."proposal_line_items" USING (("public"."is_workspace_admin"() AND (EXISTS ( SELECT 1
   FROM "public"."proposals" "p"
  WHERE (("p"."id" = "proposal_line_items"."proposal_id") AND ("public"."get_my_agency_user_id"() = "p"."agency_user_id")))))) WITH CHECK (("public"."is_workspace_admin"() AND (EXISTS ( SELECT 1
   FROM "public"."proposals" "p"
  WHERE (("p"."id" = "proposal_line_items"."proposal_id") AND ("public"."get_my_agency_user_id"() = "p"."agency_user_id"))))));



ALTER TABLE "public"."proposals" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "proposals_access" ON "public"."proposals" USING ((("public"."get_my_agency_user_id"() = "agency_user_id") AND "public"."is_workspace_admin"())) WITH CHECK ((("public"."get_my_agency_user_id"() = "agency_user_id") AND "public"."is_workspace_admin"()));



ALTER TABLE "public"."prospect_activities" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "prospect_activities_workspace_policy" ON "public"."prospect_activities" USING ((("user_id" = "public"."get_my_agency_user_id"()) AND "public"."is_workspace_admin"())) WITH CHECK ((("user_id" = "public"."get_my_agency_user_id"()) AND "public"."is_workspace_admin"()));



ALTER TABLE "public"."prospects" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "prospects_workspace_policy" ON "public"."prospects" USING ((("user_id" = "public"."get_my_agency_user_id"()) AND "public"."is_workspace_admin"())) WITH CHECK ((("user_id" = "public"."get_my_agency_user_id"()) AND "public"."is_workspace_admin"()));



ALTER TABLE "public"."recurring_invoices" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "recurring_invoices_workspace_scoped" ON "public"."recurring_invoices" USING ((("user_id" = "public"."get_my_agency_user_id"()) AND "public"."can_access_finance"())) WITH CHECK ((("user_id" = "public"."get_my_agency_user_id"()) AND "public"."can_access_finance"()));



ALTER TABLE "public"."schedules" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "schedules_workspace_scoped" ON "public"."schedules" USING ((EXISTS ( SELECT 1
   FROM "public"."clients"
  WHERE (("clients"."id" = "schedules"."client_id") AND ("clients"."user_id" = "public"."get_my_agency_user_id"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."clients"
  WHERE (("clients"."id" = "schedules"."client_id") AND ("clients"."user_id" = "public"."get_my_agency_user_id"())))));



ALTER TABLE "public"."share_tokens" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "share_tokens_workspace" ON "public"."share_tokens" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."post_versions" "pv"
     JOIN "public"."clients" "c" ON (("c"."id" = "pv"."client_id")))
  WHERE (("pv"."id" = "share_tokens"."post_version_id") AND ("c"."user_id" = "public"."get_my_agency_user_id"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."post_versions" "pv"
     JOIN "public"."clients" "c" ON (("c"."id" = "pv"."client_id")))
  WHERE (("pv"."id" = "share_tokens"."post_version_id") AND ("c"."user_id" = "public"."get_my_agency_user_id"())))));



CREATE POLICY "superadmin_can_select_feedback" ON "public"."admin_feedback" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."agency_members"
  WHERE (("agency_members"."member_user_id" = "auth"."uid"()) AND ("agency_members"."system_role" = 'superadmin'::"text")))));



CREATE POLICY "superadmin_can_update_feedback" ON "public"."admin_feedback" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."agency_members"
  WHERE (("agency_members"."member_user_id" = "auth"."uid"()) AND ("agency_members"."system_role" = 'superadmin'::"text")))));



CREATE POLICY "superadmin_only_outreach" ON "public"."admin_outreach_log" USING ((EXISTS ( SELECT 1
   FROM "public"."agency_members"
  WHERE (("agency_members"."member_user_id" = "auth"."uid"()) AND ("agency_members"."system_role" = 'superadmin'::"text")))));



CREATE POLICY "superadmin_only_outreach_notes" ON "public"."admin_outreach_notes" USING ((EXISTS ( SELECT 1
   FROM "public"."agency_members"
  WHERE (("agency_members"."member_user_id" = "auth"."uid"()) AND ("agency_members"."system_role" = 'superadmin'::"text")))));



CREATE POLICY "superadmin_only_prospect_activity" ON "public"."admin_prospect_activity" USING ((EXISTS ( SELECT 1
   FROM "public"."agency_members"
  WHERE (("agency_members"."member_user_id" = "auth"."uid"()) AND ("agency_members"."system_role" = 'superadmin'::"text")))));



CREATE POLICY "superadmin_only_prospects" ON "public"."admin_prospects" USING ((EXISTS ( SELECT 1
   FROM "public"."agency_members"
  WHERE (("agency_members"."member_user_id" = "auth"."uid"()) AND ("agency_members"."system_role" = 'superadmin'::"text")))));



ALTER TABLE "public"."task_activity" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "task_activity_select" ON "public"."task_activity" FOR SELECT USING ((("workspace_id" = "public"."get_my_agency_user_id"()) AND (EXISTS ( SELECT 1
   FROM "public"."tasks" "t"
  WHERE ("t"."id" = "task_activity"."task_id")))));



ALTER TABLE "public"."task_posts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "task_posts_delete" ON "public"."task_posts" FOR DELETE TO "authenticated" USING (("workspace_id" = "public"."get_my_agency_user_id"()));



CREATE POLICY "task_posts_insert" ON "public"."task_posts" FOR INSERT TO "authenticated" WITH CHECK (("workspace_id" = "public"."get_my_agency_user_id"()));



CREATE POLICY "task_posts_select" ON "public"."task_posts" FOR SELECT TO "authenticated" USING (("workspace_id" = "public"."get_my_agency_user_id"()));



ALTER TABLE "public"."tasks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tasks_delete" ON "public"."tasks" FOR DELETE USING ((("workspace_id" = "public"."get_my_agency_user_id"()) AND (("created_by" = "auth"."uid"()) OR "public"."is_workspace_admin"())));



CREATE POLICY "tasks_insert" ON "public"."tasks" FOR INSERT WITH CHECK ((("workspace_id" = "public"."get_my_agency_user_id"()) AND ("created_by" = "auth"."uid"()) AND (("assigned_to" IS NULL) OR "public"."is_workspace_admin"())));



CREATE POLICY "tasks_select" ON "public"."tasks" FOR SELECT USING ((("workspace_id" = "public"."get_my_agency_user_id"()) AND ("public"."is_workspace_admin"() OR ("created_by" = "auth"."uid"()) OR ("assigned_to" = "auth"."uid"()) OR "public"."is_task_participant"("id"))));



CREATE POLICY "tasks_update" ON "public"."tasks" FOR UPDATE USING ((("workspace_id" = "public"."get_my_agency_user_id"()) AND (("created_by" = "auth"."uid"()) OR "public"."is_workspace_admin"()))) WITH CHECK ((("workspace_id" = "public"."get_my_agency_user_id"()) AND (("created_by" = "auth"."uid"()) OR "public"."is_workspace_admin"())));



ALTER TABLE "public"."transactions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "transactions_workspace_scoped" ON "public"."transactions" USING ((("user_id" = "public"."get_my_agency_user_id"()) AND "public"."can_access_finance"())) WITH CHECK ((("user_id" = "public"."get_my_agency_user_id"()) AND "public"."can_access_finance"()));



ALTER TABLE "public"."user_feedback" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."chat_channel_members";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."chat_channels";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."chat_message_reactions";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."chat_messages";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."comment_reactions";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."comments";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."notifications";









GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";











































































































































































GRANT ALL ON FUNCTION "public"."accept_proposal"("p_token" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."accept_proposal"("p_token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."accept_proposal"("p_token" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_cancel_workspace_deletion"("target_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_cancel_workspace_deletion"("target_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_cancel_workspace_deletion"("target_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_get_client_detail"("target_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_get_client_detail"("target_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."admin_get_client_detail"("target_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_get_client_detail"("target_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_get_client_onboarding"("p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_get_client_onboarding"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_get_client_onboarding"("p_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_get_clients"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_get_clients"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_get_clients"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_get_user_auth_info"("target_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_get_user_auth_info"("target_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_get_user_auth_info"("target_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_link_prospect_on_signup"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_link_prospect_on_signup"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_link_prospect_on_signup"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_schedule_workspace_deletion"("target_user_id" "uuid", "days" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_schedule_workspace_deletion"("target_user_id" "uuid", "days" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_schedule_workspace_deletion"("target_user_id" "uuid", "days" integer) TO "service_role";



GRANT ALL ON TABLE "public"."agency_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."agency_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."agency_subscriptions" TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_update_subscription"("target_user_id" "uuid", "patch" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_update_subscription"("target_user_id" "uuid", "patch" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_update_subscription"("target_user_id" "uuid", "patch" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."advance_expense_billing_date"("expense_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."advance_expense_billing_date"("expense_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."advance_expense_billing_date"("expense_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."advance_recurring_invoice_date"("p_recurring_invoice_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."advance_recurring_invoice_date"("p_recurring_invoice_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."advance_recurring_invoice_date"("p_recurring_invoice_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."approve_internally"("p_post_version_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."approve_internally"("p_post_version_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."approve_internally"("p_post_version_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_access_finance"() TO "anon";
GRANT ALL ON FUNCTION "public"."can_access_finance"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_access_finance"() TO "service_role";



GRANT ALL ON FUNCTION "public"."can_view_confidential_docs"() TO "anon";
GRANT ALL ON FUNCTION "public"."can_view_confidential_docs"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_view_confidential_docs"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."cancel_workspace_deletion"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cancel_workspace_deletion"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cancel_workspace_deletion"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_client_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_client_limit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_client_limit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_email_exists"("p_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."check_email_exists"("p_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_email_exists"("p_email" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."cleanup_old_notifications"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cleanup_old_notifications"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_old_notifications"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_old_notifications"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_new_post_with_version"("p_client_id" "uuid", "p_title" "text", "p_content" "text", "p_media_urls" "text"[], "p_platform" "text"[], "p_target_date" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_new_post_with_version"("p_client_id" "uuid", "p_title" "text", "p_content" "text", "p_media_urls" "text"[], "p_platform" "text"[], "p_target_date" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_new_post_with_version"("p_client_id" "uuid", "p_title" "text", "p_content" "text", "p_media_urls" "text"[], "p_platform" "text"[], "p_target_date" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."create_new_version"("p_post_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."create_new_version"("p_post_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_new_version"("p_post_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_post_draft_v3"("p_client_id" "uuid", "p_title" "text", "p_content" "text", "p_media_urls" "text"[], "p_platform" "text"[], "p_user_id" "uuid", "p_target_date" timestamp with time zone, "p_admin_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_post_draft_v3"("p_client_id" "uuid", "p_title" "text", "p_content" "text", "p_media_urls" "text"[], "p_platform" "text"[], "p_user_id" "uuid", "p_target_date" timestamp with time zone, "p_admin_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_post_draft_v3"("p_client_id" "uuid", "p_title" "text", "p_content" "text", "p_media_urls" "text"[], "p_platform" "text"[], "p_user_id" "uuid", "p_target_date" timestamp with time zone, "p_admin_notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_post_draft_v3"("p_client_id" "uuid", "p_title" "text", "p_content" "text", "p_media_urls" "text"[], "p_platform" "text"[], "p_user_id" "uuid", "p_target_date" timestamp with time zone, "p_admin_notes" "text", "p_platform_schedules" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."create_post_draft_v3"("p_client_id" "uuid", "p_title" "text", "p_content" "text", "p_media_urls" "text"[], "p_platform" "text"[], "p_user_id" "uuid", "p_target_date" timestamp with time zone, "p_admin_notes" "text", "p_platform_schedules" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_post_draft_v3"("p_client_id" "uuid", "p_title" "text", "p_content" "text", "p_media_urls" "text"[], "p_platform" "text"[], "p_user_id" "uuid", "p_target_date" timestamp with time zone, "p_admin_notes" "text", "p_platform_schedules" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_post_draft_v3"("p_client_id" "uuid", "p_title" "text", "p_content" "text", "p_media_urls" "text"[], "p_platform" "text"[], "p_user_id" "uuid", "p_target_date" timestamp with time zone, "p_admin_notes" "text", "p_platform_schedules" "jsonb", "p_campaign_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."create_post_draft_v3"("p_client_id" "uuid", "p_title" "text", "p_content" "text", "p_media_urls" "text"[], "p_platform" "text"[], "p_user_id" "uuid", "p_target_date" timestamp with time zone, "p_admin_notes" "text", "p_platform_schedules" "jsonb", "p_campaign_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_post_draft_v3"("p_client_id" "uuid", "p_title" "text", "p_content" "text", "p_media_urls" "text"[], "p_platform" "text"[], "p_user_id" "uuid", "p_target_date" timestamp with time zone, "p_admin_notes" "text", "p_platform_schedules" "jsonb", "p_campaign_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_post_draft_v3"("p_client_id" "uuid", "p_title" "text", "p_content" "text", "p_media_urls" "text"[], "p_platform" "text"[], "p_user_id" "uuid", "p_target_date" timestamp with time zone, "p_admin_notes" "text", "p_platform_schedules" "jsonb", "p_campaign_id" "uuid", "p_deliverable_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_post_draft_v3"("p_client_id" "uuid", "p_title" "text", "p_content" "text", "p_media_urls" "text"[], "p_platform" "text"[], "p_user_id" "uuid", "p_target_date" timestamp with time zone, "p_admin_notes" "text", "p_platform_schedules" "jsonb", "p_campaign_id" "uuid", "p_deliverable_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_post_draft_v3"("p_client_id" "uuid", "p_title" "text", "p_content" "text", "p_media_urls" "text"[], "p_platform" "text"[], "p_user_id" "uuid", "p_target_date" timestamp with time zone, "p_admin_notes" "text", "p_platform_schedules" "jsonb", "p_campaign_id" "uuid", "p_deliverable_type" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_revision_version"("p_parent_version_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."create_revision_version"("p_parent_version_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_revision_version"("p_parent_version_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_revision_version"("p_parent_version_id" "uuid", "p_user_id" "uuid", "p_admin_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_revision_version"("p_parent_version_id" "uuid", "p_user_id" "uuid", "p_admin_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_revision_version"("p_parent_version_id" "uuid", "p_user_id" "uuid", "p_admin_notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."decline_proposal"("p_token" "text", "p_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."decline_proposal"("p_token" "text", "p_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."decline_proposal"("p_token" "text", "p_reason" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."decrement_storage_used"("p_user_id" "uuid", "p_bytes" bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."decrement_storage_used"("p_user_id" "uuid", "p_bytes" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."decrement_storage_used"("p_user_id" "uuid", "p_bytes" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_approval_events"("p_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."delete_approval_events"("p_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_approval_events"("p_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_draft_post"("p_post_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_draft_post"("p_post_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_draft_post"("p_post_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."edit_draft"("p_version_id" "uuid", "p_content" "text", "p_media_urls" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."edit_draft"("p_version_id" "uuid", "p_content" "text", "p_media_urls" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."edit_draft"("p_version_id" "uuid", "p_content" "text", "p_media_urls" "text"[]) TO "service_role";



REVOKE ALL ON FUNCTION "public"."emit_notifications"("p_workspace_id" "uuid", "p_actor" "uuid", "p_recipients" "uuid"[], "p_type" "text", "p_title" "text", "p_body" "text", "p_entity_type" "text", "p_entity_id" "uuid", "p_link" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."emit_notifications"("p_workspace_id" "uuid", "p_actor" "uuid", "p_recipients" "uuid"[], "p_type" "text", "p_title" "text", "p_body" "text", "p_entity_type" "text", "p_entity_id" "uuid", "p_link" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_note_visibility_author_only"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_note_visibility_author_only"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_note_visibility_author_only"() TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_owner_only_signatory"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_owner_only_signatory"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_owner_only_signatory"() TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_post_status_transition"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_post_status_transition"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_post_status_transition"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."enforce_task_assignment"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."enforce_task_assignment"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."ensure_workspace_channel"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ensure_workspace_channel"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_workspace_channel"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."generate_invoice_from_template"("p_template_id" "uuid", "p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."generate_invoice_from_template"("p_template_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_invoice_from_template"("p_template_id" "uuid", "p_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."generate_proposal_token"("p_proposal_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."generate_proposal_token"("p_proposal_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_proposal_token"("p_proposal_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."generate_version_token"("p_version_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."generate_version_token"("p_version_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_version_token"("p_version_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_agency_branding_by_token"("p_token" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_agency_branding_by_token"("p_token" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_agency_branding_by_token"("p_token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_agency_branding_by_token"("p_token" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_approval_log"("p_action" "text", "p_limit" integer, "p_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_approval_log"("p_action" "text", "p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_approval_log"("p_action" "text", "p_limit" integer, "p_offset" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_approval_log_count"("p_action" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_approval_log_count"("p_action" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_approval_log_count"("p_action" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_campaign_analytics"("p_campaign_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_campaign_analytics"("p_campaign_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_campaign_analytics"("p_campaign_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_campaign_by_review_token"("p_token" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_campaign_by_review_token"("p_token" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_campaign_by_review_token"("p_token" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_campaigns_with_post_summary"("p_user_id" "uuid", "p_client_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_campaigns_with_post_summary"("p_user_id" "uuid", "p_client_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_campaigns_with_post_summary"("p_user_id" "uuid", "p_client_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_client_report"("p_client_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_client_report"("p_client_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_client_report"("p_client_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_clients_with_pipeline"("p_user_id" "uuid", "p_search" "text", "p_industry" "text", "p_tier" "text", "p_urgency" "text", "p_status" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_clients_with_pipeline"("p_user_id" "uuid", "p_search" "text", "p_industry" "text", "p_tier" "text", "p_urgency" "text", "p_status" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_clients_with_pipeline"("p_user_id" "uuid", "p_search" "text", "p_industry" "text", "p_tier" "text", "p_urgency" "text", "p_status" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_global_calendar"("p_user_id" "uuid", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."get_global_calendar"("p_user_id" "uuid", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_global_calendar"("p_user_id" "uuid", "p_start_date" timestamp with time zone, "p_end_date" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_global_calendar_posts"("user_id" "uuid", "start_date" timestamp without time zone, "end_date" timestamp without time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."get_global_calendar_posts"("user_id" "uuid", "start_date" timestamp without time zone, "end_date" timestamp without time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_global_calendar_posts"("user_id" "uuid", "start_date" timestamp without time zone, "end_date" timestamp without time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_invite_by_token"("p_token" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_invite_by_token"("p_token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_invite_by_token"("p_token" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_agency_user_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_agency_user_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_agency_user_id"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_my_chat_channels"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_my_chat_channels"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_chat_channels"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_submissions"("p_status" "text", "p_page" integer, "p_page_size" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_submissions"("p_status" "text", "p_page" integer, "p_page_size" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_submissions"("p_status" "text", "p_page" integer, "p_page_size" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_submissions_count"("p_status" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_submissions_count"("p_status" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_submissions_count"("p_status" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_my_workspace_owner"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_my_workspace_owner"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_workspace_owner"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_or_create_dm_channel"("p_other_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_or_create_dm_channel"("p_other_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_or_create_dm_channel"("p_other_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_post_by_token"("p_token" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_post_by_token"("p_token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_post_by_token"("p_token" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_proposal_by_token"("p_token" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_proposal_by_token"("p_token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_proposal_by_token"("p_token" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_proposals_with_totals"("p_user_id" "uuid", "p_client_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_proposals_with_totals"("p_user_id" "uuid", "p_client_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_proposals_with_totals"("p_user_id" "uuid", "p_client_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_removed_members"("p_agency_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_removed_members"("p_agency_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_removed_members"("p_agency_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_team_members"("p_agency_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_team_members"("p_agency_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_team_members"("p_agency_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."handle_new_user_subscription"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."handle_new_user_subscription"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user_subscription"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."hard_delete_team_member"("p_member_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."hard_delete_team_member"("p_member_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hard_delete_team_member"("p_member_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."increment_storage_used"("p_user_id" "uuid", "p_bytes" bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."increment_storage_used"("p_user_id" "uuid", "p_bytes" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_storage_used"("p_user_id" "uuid", "p_bytes" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."is_chat_channel_member"("p_channel_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_chat_channel_member"("p_channel_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_chat_channel_member"("p_channel_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_chat_enabled_for_workspace"("p_workspace_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_chat_enabled_for_workspace"("p_workspace_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_chat_enabled_for_workspace"("p_workspace_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_chat_enabled_for_workspace"("p_workspace_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_chat_message_channel_member"("p_message_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_chat_message_channel_member"("p_message_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_chat_message_channel_member"("p_message_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_note_author"("p_note_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_note_author"("p_note_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_note_author"("p_note_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_superadmin"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_superadmin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_superadmin"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_task_participant"("p_task_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_task_participant"("p_task_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_task_participant"("p_task_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_workspace_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_workspace_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_workspace_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_workspace_owner"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_workspace_owner"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_workspace_owner"() TO "service_role";



GRANT ALL ON FUNCTION "public"."join_team"("p_token" "text", "p_first_name" "text", "p_last_name" "text", "p_mobile_number" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."join_team"("p_token" "text", "p_first_name" "text", "p_last_name" "text", "p_mobile_number" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."join_team"("p_token" "text", "p_first_name" "text", "p_last_name" "text", "p_mobile_number" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."mark_channel_read"("p_channel_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mark_channel_read"("p_channel_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_channel_read"("p_channel_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_proposal_viewed"("p_token" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."mark_proposal_viewed"("p_token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_proposal_viewed"("p_token" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."my_documents_level"() TO "anon";
GRANT ALL ON FUNCTION "public"."my_documents_level"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."my_documents_level"() TO "service_role";



GRANT ALL ON FUNCTION "public"."my_note_share_permission"("p_note_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."my_note_share_permission"("p_note_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."my_note_share_permission"("p_note_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."my_system_role"() TO "anon";
GRANT ALL ON FUNCTION "public"."my_system_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."my_system_role"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."my_workspace_client_ids"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."my_workspace_client_ids"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."my_workspace_client_ids"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."notify_overdue_invoices"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."notify_overdue_invoices"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_overdue_invoices"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_overdue_invoices"() TO "service_role";



GRANT ALL ON FUNCTION "public"."prevent_illegal_updates"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_illegal_updates"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_illegal_updates"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."prospect_status_label"("p_status" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."prospect_status_label"("p_status" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."prospect_status_label"("p_status" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."prospect_status_label"("p_status" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."reassign_task"("p_task_id" "uuid", "p_assigned_to" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reassign_task"("p_task_id" "uuid", "p_assigned_to" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reassign_task"("p_task_id" "uuid", "p_assigned_to" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."remove_team_member"("p_member_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."remove_team_member"("p_member_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."remove_team_member"("p_member_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."request_internal_changes"("p_post_version_id" "uuid", "p_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."request_internal_changes"("p_post_version_id" "uuid", "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."request_internal_changes"("p_post_version_id" "uuid", "p_notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."request_proposal_changes"("p_token" "text", "p_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."request_proposal_changes"("p_token" "text", "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."request_proposal_changes"("p_token" "text", "p_notes" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."request_workspace_deletion"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."request_workspace_deletion"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."request_workspace_deletion"() TO "service_role";



GRANT ALL ON FUNCTION "public"."schedule_post"("p_version_id" "uuid", "p_client_id" "uuid", "p_datetime" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."schedule_post"("p_version_id" "uuid", "p_client_id" "uuid", "p_datetime" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."schedule_post"("p_version_id" "uuid", "p_client_id" "uuid", "p_datetime" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."send_for_approval"("p_version_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."send_for_approval"("p_version_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."send_for_approval"("p_version_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."send_post_for_approval"("p_post_version_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."send_post_for_approval"("p_post_version_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."send_post_for_approval"("p_post_version_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_agency_plan"("p_user_id" "uuid", "p_plan" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_agency_plan"("p_user_id" "uuid", "p_plan" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_agency_plan"("p_user_id" "uuid", "p_plan" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_meeting_creator_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_meeting_creator_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_meeting_creator_id"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_member_job_roles"("p_member_user_id" "uuid", "p_job_role_ids" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_member_job_roles"("p_member_user_id" "uuid", "p_job_role_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_member_job_roles"("p_member_user_id" "uuid", "p_job_role_ids" "uuid"[]) TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_member_responsibilities"("p_member_user_id" "uuid", "p_text" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_member_responsibilities"("p_member_user_id" "uuid", "p_text" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_member_responsibilities"("p_member_user_id" "uuid", "p_text" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_my_email_task_assignments"("p_enabled" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_my_email_task_assignments"("p_enabled" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_my_email_task_assignments"("p_enabled" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_post_version_updated_by"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_post_version_updated_by"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_post_version_updated_by"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_subscription_ends_at_on_plan_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_subscription_ends_at_on_plan_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_subscription_ends_at_on_plan_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."soft_delete_chat_message"("p_message_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."soft_delete_chat_message"("p_message_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."soft_delete_chat_message"("p_message_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."soft_delete_comment"("p_comment_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."soft_delete_comment"("p_comment_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."soft_delete_comment"("p_comment_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."storage_workspace_for"("p_owner" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."storage_workspace_for"("p_owner" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."submit_approval"("p_version_id" "uuid", "p_client_id" "uuid", "p_approved" boolean, "p_comment" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."submit_approval"("p_version_id" "uuid", "p_client_id" "uuid", "p_approved" boolean, "p_comment" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."submit_approval"("p_version_id" "uuid", "p_client_id" "uuid", "p_approved" boolean, "p_comment" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."submit_for_internal_approval"("p_post_version_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."submit_for_internal_approval"("p_post_version_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."submit_for_internal_approval"("p_post_version_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."task_reference_exists"("p_task_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."task_reference_exists"("p_task_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."task_reference_exists"("p_task_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."task_reference_exists"("p_task_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."tg_autocomplete_tasks_on_publish"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."tg_autocomplete_tasks_on_publish"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."tg_chat_message_author_name"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."tg_chat_message_author_name"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."tg_comment_adds_task_participants"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."tg_comment_adds_task_participants"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."tg_delete_orphaned_comments"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."tg_delete_orphaned_comments"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."tg_log_task_activity"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."tg_log_task_activity"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."tg_notify_chat_message"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."tg_notify_chat_message"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."tg_notify_comment_added"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."tg_notify_comment_added"() TO "service_role";



GRANT ALL ON FUNCTION "public"."tg_notify_note_shared"() TO "anon";
GRANT ALL ON FUNCTION "public"."tg_notify_note_shared"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."tg_notify_note_shared"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."tg_notify_task_changes"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."tg_notify_task_changes"() TO "service_role";



GRANT ALL ON FUNCTION "public"."tg_set_post_creator"() TO "anon";
GRANT ALL ON FUNCTION "public"."tg_set_post_creator"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."tg_set_post_creator"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."toggle_chat_reaction"("p_message_id" "uuid", "p_emoji" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."toggle_chat_reaction"("p_message_id" "uuid", "p_emoji" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."toggle_chat_reaction"("p_message_id" "uuid", "p_emoji" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."toggle_comment_reaction"("p_comment_id" "uuid", "p_emoji" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."toggle_comment_reaction"("p_comment_id" "uuid", "p_emoji" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."toggle_comment_reaction"("p_comment_id" "uuid", "p_emoji" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_app_config_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_app_config_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_app_config_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_member_access"("p_member_id" "uuid", "p_system_role" "text", "p_permissions" "jsonb", "p_roles_and_responsibilities" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_member_access"("p_member_id" "uuid", "p_system_role" "text", "p_permissions" "jsonb", "p_roles_and_responsibilities" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_member_access"("p_member_id" "uuid", "p_system_role" "text", "p_permissions" "jsonb", "p_roles_and_responsibilities" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_post_current_version"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_post_current_version"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_post_current_version"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_post_status_by_token"("p_token" "text", "p_status" "text", "p_feedback" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_post_status_by_token"("p_token" "text", "p_status" "text", "p_feedback" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_post_status_by_token"("p_token" "text", "p_status" "text", "p_feedback" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."update_storage_usage"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_storage_usage"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_storage_usage"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_task_status"("p_task_id" "uuid", "p_new_status" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_task_status"("p_task_id" "uuid", "p_new_status" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_task_status"("p_task_id" "uuid", "p_new_status" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_user_feedback_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_user_feedback_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_user_feedback_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."workspace_admin_uids"("p_workspace_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."workspace_admin_uids"("p_workspace_id" "uuid") TO "service_role";
























GRANT ALL ON TABLE "public"."admin_feedback" TO "anon";
GRANT ALL ON TABLE "public"."admin_feedback" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_feedback" TO "service_role";



GRANT ALL ON TABLE "public"."admin_outreach_log" TO "anon";
GRANT ALL ON TABLE "public"."admin_outreach_log" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_outreach_log" TO "service_role";



GRANT ALL ON TABLE "public"."admin_outreach_notes" TO "anon";
GRANT ALL ON TABLE "public"."admin_outreach_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_outreach_notes" TO "service_role";



GRANT ALL ON TABLE "public"."admin_prospect_activity" TO "anon";
GRANT ALL ON TABLE "public"."admin_prospect_activity" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_prospect_activity" TO "service_role";



GRANT ALL ON TABLE "public"."admin_prospects" TO "anon";
GRANT ALL ON TABLE "public"."admin_prospects" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_prospects" TO "service_role";



GRANT ALL ON TABLE "public"."agency_invites" TO "anon";
GRANT ALL ON TABLE "public"."agency_invites" TO "authenticated";
GRANT ALL ON TABLE "public"."agency_invites" TO "service_role";



GRANT ALL ON TABLE "public"."agency_job_roles" TO "anon";
GRANT ALL ON TABLE "public"."agency_job_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."agency_job_roles" TO "service_role";



GRANT ALL ON TABLE "public"."agency_member_job_roles" TO "anon";
GRANT ALL ON TABLE "public"."agency_member_job_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."agency_member_job_roles" TO "service_role";



GRANT ALL ON TABLE "public"."agency_members" TO "anon";
GRANT ALL ON TABLE "public"."agency_members" TO "authenticated";
GRANT ALL ON TABLE "public"."agency_members" TO "service_role";



GRANT ALL ON TABLE "public"."app_config" TO "anon";
GRANT ALL ON TABLE "public"."app_config" TO "authenticated";
GRANT ALL ON TABLE "public"."app_config" TO "service_role";



GRANT ALL ON TABLE "public"."approval_events" TO "anon";
GRANT ALL ON TABLE "public"."approval_events" TO "authenticated";
GRANT ALL ON TABLE "public"."approval_events" TO "service_role";



GRANT ALL ON TABLE "public"."approvals" TO "anon";
GRANT ALL ON TABLE "public"."approvals" TO "authenticated";
GRANT ALL ON TABLE "public"."approvals" TO "service_role";



GRANT ALL ON TABLE "public"."campaigns" TO "anon";
GRANT ALL ON TABLE "public"."campaigns" TO "authenticated";
GRANT ALL ON TABLE "public"."campaigns" TO "service_role";



GRANT ALL ON TABLE "public"."chat_channel_members" TO "anon";
GRANT ALL ON TABLE "public"."chat_channel_members" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_channel_members" TO "service_role";



GRANT ALL ON TABLE "public"."chat_channels" TO "anon";
GRANT ALL ON TABLE "public"."chat_channels" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_channels" TO "service_role";



GRANT ALL ON TABLE "public"."chat_message_reactions" TO "anon";
GRANT ALL ON TABLE "public"."chat_message_reactions" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_message_reactions" TO "service_role";



GRANT ALL ON TABLE "public"."chat_messages" TO "anon";
GRANT ALL ON TABLE "public"."chat_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_messages" TO "service_role";



GRANT ALL ON TABLE "public"."client_documents" TO "anon";
GRANT ALL ON TABLE "public"."client_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."client_documents" TO "service_role";



GRANT ALL ON TABLE "public"."clients" TO "anon";
GRANT ALL ON TABLE "public"."clients" TO "authenticated";
GRANT ALL ON TABLE "public"."clients" TO "service_role";



GRANT ALL ON TABLE "public"."post_versions" TO "anon";
GRANT ALL ON TABLE "public"."post_versions" TO "authenticated";
GRANT ALL ON TABLE "public"."post_versions" TO "service_role";



GRANT ALL ON TABLE "public"."posts" TO "anon";
GRANT ALL ON TABLE "public"."posts" TO "authenticated";
GRANT ALL ON TABLE "public"."posts" TO "service_role";



GRANT ALL ON TABLE "public"."client_pipeline_analytics" TO "anon";
GRANT ALL ON TABLE "public"."client_pipeline_analytics" TO "authenticated";
GRANT ALL ON TABLE "public"."client_pipeline_analytics" TO "service_role";



GRANT ALL ON TABLE "public"."client_users" TO "anon";
GRANT ALL ON TABLE "public"."client_users" TO "authenticated";
GRANT ALL ON TABLE "public"."client_users" TO "service_role";



GRANT ALL ON TABLE "public"."comment_reactions" TO "anon";
GRANT ALL ON TABLE "public"."comment_reactions" TO "authenticated";
GRANT ALL ON TABLE "public"."comment_reactions" TO "service_role";



GRANT ALL ON TABLE "public"."comments" TO "anon";
GRANT ALL ON TABLE "public"."comments" TO "authenticated";
GRANT ALL ON TABLE "public"."comments" TO "service_role";



GRANT ALL ON TABLE "public"."document_collections" TO "anon";
GRANT ALL ON TABLE "public"."document_collections" TO "authenticated";
GRANT ALL ON TABLE "public"."document_collections" TO "service_role";



GRANT ALL ON TABLE "public"."expenses" TO "anon";
GRANT ALL ON TABLE "public"."expenses" TO "authenticated";
GRANT ALL ON TABLE "public"."expenses" TO "service_role";



GRANT ALL ON TABLE "public"."invoice_items" TO "anon";
GRANT ALL ON TABLE "public"."invoice_items" TO "authenticated";
GRANT ALL ON TABLE "public"."invoice_items" TO "service_role";



GRANT ALL ON TABLE "public"."invoices" TO "anon";
GRANT ALL ON TABLE "public"."invoices" TO "authenticated";
GRANT ALL ON TABLE "public"."invoices" TO "service_role";



GRANT ALL ON TABLE "public"."meetings" TO "anon";
GRANT ALL ON TABLE "public"."meetings" TO "authenticated";
GRANT ALL ON TABLE "public"."meetings" TO "service_role";



GRANT ALL ON TABLE "public"."note_shares" TO "anon";
GRANT ALL ON TABLE "public"."note_shares" TO "authenticated";
GRANT ALL ON TABLE "public"."note_shares" TO "service_role";



GRANT ALL ON TABLE "public"."note_tag_links" TO "anon";
GRANT ALL ON TABLE "public"."note_tag_links" TO "authenticated";
GRANT ALL ON TABLE "public"."note_tag_links" TO "service_role";



GRANT ALL ON TABLE "public"."note_tags" TO "anon";
GRANT ALL ON TABLE "public"."note_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."note_tags" TO "service_role";



GRANT ALL ON TABLE "public"."notes" TO "anon";
GRANT ALL ON TABLE "public"."notes" TO "authenticated";
GRANT ALL ON TABLE "public"."notes" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."proposal_line_items" TO "anon";
GRANT ALL ON TABLE "public"."proposal_line_items" TO "authenticated";
GRANT ALL ON TABLE "public"."proposal_line_items" TO "service_role";



GRANT ALL ON TABLE "public"."proposals" TO "anon";
GRANT ALL ON TABLE "public"."proposals" TO "authenticated";
GRANT ALL ON TABLE "public"."proposals" TO "service_role";



GRANT ALL ON TABLE "public"."prospect_activities" TO "anon";
GRANT ALL ON TABLE "public"."prospect_activities" TO "authenticated";
GRANT ALL ON TABLE "public"."prospect_activities" TO "service_role";



GRANT ALL ON TABLE "public"."prospects" TO "anon";
GRANT ALL ON TABLE "public"."prospects" TO "authenticated";
GRANT ALL ON TABLE "public"."prospects" TO "service_role";



GRANT ALL ON TABLE "public"."recurring_invoices" TO "anon";
GRANT ALL ON TABLE "public"."recurring_invoices" TO "authenticated";
GRANT ALL ON TABLE "public"."recurring_invoices" TO "service_role";



GRANT ALL ON TABLE "public"."schedules" TO "anon";
GRANT ALL ON TABLE "public"."schedules" TO "authenticated";
GRANT ALL ON TABLE "public"."schedules" TO "service_role";



GRANT ALL ON TABLE "public"."share_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."share_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."subscription_usage_stats" TO "anon";
GRANT ALL ON TABLE "public"."subscription_usage_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."subscription_usage_stats" TO "service_role";



GRANT ALL ON TABLE "public"."task_activity" TO "anon";
GRANT ALL ON TABLE "public"."task_activity" TO "authenticated";
GRANT ALL ON TABLE "public"."task_activity" TO "service_role";



GRANT ALL ON TABLE "public"."task_posts" TO "anon";
GRANT ALL ON TABLE "public"."task_posts" TO "authenticated";
GRANT ALL ON TABLE "public"."task_posts" TO "service_role";



GRANT ALL ON TABLE "public"."tasks" TO "anon";
GRANT ALL ON TABLE "public"."tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."tasks" TO "service_role";



GRANT ALL ON TABLE "public"."transactions" TO "anon";
GRANT ALL ON TABLE "public"."transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."transactions" TO "service_role";



GRANT ALL ON TABLE "public"."user_feedback" TO "anon";
GRANT ALL ON TABLE "public"."user_feedback" TO "authenticated";
GRANT ALL ON TABLE "public"."user_feedback" TO "service_role";



GRANT ALL ON TABLE "public"."view_finance_overview" TO "anon";
GRANT ALL ON TABLE "public"."view_finance_overview" TO "authenticated";
GRANT ALL ON TABLE "public"."view_finance_overview" TO "service_role";



GRANT ALL ON TABLE "public"."view_monthly_burn_rate" TO "anon";
GRANT ALL ON TABLE "public"."view_monthly_burn_rate" TO "authenticated";
GRANT ALL ON TABLE "public"."view_monthly_burn_rate" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































