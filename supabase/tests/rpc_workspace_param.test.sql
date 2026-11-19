-- #169 regression test: RPCs that take a workspace id must not act on a
-- workspace the caller doesn't belong to.
-- Self-checking and self-cleaning: runs in a transaction that is rolled back,
-- and raises on the first failed assertion.
--
--   docker exec -i supabase_db_tercero psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/rpc_workspace_param.test.sql
--
-- Uses the seeded Northwind Social workspace (owner 1111…, member 3333…) and
-- its Acme Coffee client, plus an outsider (9999…) who owns a workspace of
-- their own (the auth.users trigger creates it), so they have finance access.

\set ON_ERROR_STOP 1
BEGIN;

INSERT INTO auth.users (id, instance_id, aud, role, email)
VALUES ('99999999-9999-4999-8999-999999999999', '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'delivered+outsider@resend.dev');

INSERT INTO proposals (agency_user_id, title, status)
VALUES ('11111111-1111-4111-8111-111111111111', 'Secret retainer pitch', 'DRAFT');

CREATE TEMP TABLE t_ids (name text PRIMARY KEY, id uuid);
GRANT SELECT ON t_ids TO authenticated;
WITH x AS (
  INSERT INTO recurring_invoices (user_id, client_id, amount, category, description, billing_cycle, next_invoice_date, payment_terms)
  VALUES ('11111111-1111-4111-8111-111111111111', 'c1111111-1111-4111-8111-111111111111', 1000, 'Retainer', 'Monthly retainer', 'MONTHLY', CURRENT_DATE, 'Net 15')
  RETURNING id
)
INSERT INTO t_ids SELECT 'template', id FROM x;

-- Act as a signed-in user for the rest of the transaction (or until reset).
CREATE FUNCTION pg_temp.act_as(p_uid uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
$$;

-- ── Outsider ──────────────────────────────────────────────────────────────
SELECT pg_temp.act_as('99999999-9999-4999-8999-999999999999');
SET LOCAL ROLE authenticated;

DO $$
BEGIN
  BEGIN
    PERFORM public.set_agency_plan('11111111-1111-4111-8111-111111111111', 'quantum');
    RAISE EXCEPTION 'FAIL: outsider could call set_agency_plan';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  IF (SELECT count(*) FROM public.get_proposals_with_totals('11111111-1111-4111-8111-111111111111', NULL)) <> 0 THEN
    RAISE EXCEPTION 'FAIL: outsider can read another workspace''s proposals';
  END IF;

  BEGIN
    PERFORM public.generate_invoice_from_template(
      (SELECT id FROM t_ids WHERE name = 'template'), '11111111-1111-4111-8111-111111111111');
    RAISE EXCEPTION 'FAIL: outsider drafted an invoice into another workspace';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FAIL:%' THEN RAISE; END IF;
  END;
END $$;

-- ── Member of the workspace: Proposals are Owner/Admin only (RLS) ────────
RESET ROLE;
SELECT pg_temp.act_as('33333333-3333-4333-8333-333333333333');
SET LOCAL ROLE authenticated;

DO $$
BEGIN
  IF (SELECT count(*) FROM public.get_proposals_with_totals('11111111-1111-4111-8111-111111111111', NULL)) <> 0 THEN
    RAISE EXCEPTION 'FAIL: a Member can read proposals through the RPC';
  END IF;
END $$;

-- ── Owner: still works ───────────────────────────────────────────────────
RESET ROLE;
SELECT pg_temp.act_as('11111111-1111-4111-8111-111111111111');
SET LOCAL ROLE authenticated;

DO $$
BEGIN
  IF (SELECT count(*) FROM public.get_proposals_with_totals('11111111-1111-4111-8111-111111111111', NULL)) <> 1 THEN
    RAISE EXCEPTION 'FAIL: the Owner no longer sees their proposals';
  END IF;
  IF public.generate_invoice_from_template(
       (SELECT id FROM t_ids WHERE name = 'template'), '11111111-1111-4111-8111-111111111111') IS NULL THEN
    RAISE EXCEPTION 'FAIL: the Owner can no longer generate an invoice';
  END IF;
END $$;

RESET ROLE;
DO $$
BEGIN
  IF (SELECT plan_name FROM agency_subscriptions WHERE user_id = '11111111-1111-4111-8111-111111111111') <> 'trial' THEN
    RAISE EXCEPTION 'FAIL: the plan changed';
  END IF;
  IF NOT has_function_privilege('service_role', 'public.set_agency_plan(uuid,text)', 'execute') THEN
    RAISE EXCEPTION 'FAIL: the service role lost set_agency_plan';
  END IF;
END $$;

\echo 'rpc_workspace_param: all assertions passed'
ROLLBACK;
