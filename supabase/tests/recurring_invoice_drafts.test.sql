-- #112 regression test for draft_due_recurring_invoices (the daily pg_cron job).
-- Self-checking and self-cleaning: runs in a transaction that is rolled back,
-- and raises on the first failed assertion.
--
--   docker exec -i supabase_db_tercero psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/recurring_invoice_drafts.test.sql
--
-- Uses the seeded Northwind Social workspace (owner 1111…, admin 2222…,
-- member 3333…) and its Acme Coffee client.

\set ON_ERROR_STOP 1
BEGIN;

CREATE TEMP TABLE t_ids (name text PRIMARY KEY, id uuid);

WITH x AS (
  INSERT INTO recurring_invoices (user_id, client_id, amount, category, description, billing_cycle, next_invoice_date, payment_terms)
  VALUES ('11111111-1111-4111-8111-111111111111', 'c1111111-1111-4111-8111-111111111111', 1000, 'Retainer', 'Monthly retainer', 'MONTHLY', CURRENT_DATE, 'Net 15')
  RETURNING id
)
INSERT INTO t_ids SELECT 'due_today', id FROM x;

WITH x AS (
  INSERT INTO recurring_invoices (user_id, client_id, amount, category, description, billing_cycle, next_invoice_date, payment_terms)
  VALUES ('11111111-1111-4111-8111-111111111111', 'c1111111-1111-4111-8111-111111111111', 500, 'Retainer', 'Content add-on', 'MONTHLY', (CURRENT_DATE - INTERVAL '2 months')::date, 'Net 30')
  RETURNING id
)
INSERT INTO t_ids SELECT 'three_behind', id FROM x;

-- Not due yet, and paused: both must be left alone.
WITH x AS (
  INSERT INTO recurring_invoices (user_id, client_id, amount, billing_cycle, next_invoice_date)
  VALUES ('11111111-1111-4111-8111-111111111111', 'c1111111-1111-4111-8111-111111111111', 1, 'MONTHLY', (CURRENT_DATE + 3))
  RETURNING id
)
INSERT INTO t_ids SELECT 'future', id FROM x;
WITH x AS (
  INSERT INTO recurring_invoices (user_id, client_id, amount, billing_cycle, next_invoice_date, is_active)
  VALUES ('11111111-1111-4111-8111-111111111111', 'c1111111-1111-4111-8111-111111111111', 1, 'MONTHLY', CURRENT_DATE, false)
  RETURNING id
)
INSERT INTO t_ids SELECT 'paused', id FROM x;

DELETE FROM notifications WHERE type = 'recurring_invoices_drafted';

DO $test$
DECLARE
  v_created int;
  v_due_today uuid := (SELECT id FROM t_ids WHERE name = 'due_today');
  v_behind    uuid := (SELECT id FROM t_ids WHERE name = 'three_behind');
  v_dates date[];
  v_inv_before int;
  v_n int;
BEGIN
  -- Run 1 --------------------------------------------------------------------
  v_created := public.draft_due_recurring_invoices();
  IF v_created <> 4 THEN RAISE EXCEPTION 'run 1: expected 4 drafts, got %', v_created; END IF;

  -- A template due today: exactly one draft, next date one cycle on.
  SELECT count(*) INTO v_n FROM invoices
  WHERE user_id = '11111111-1111-4111-8111-111111111111' AND notes IS NULL AND subtotal = 1000;
  IF v_n <> 1 THEN RAISE EXCEPTION 'due_today: expected 1 draft, got %', v_n; END IF;
  IF (SELECT next_invoice_date FROM recurring_invoices WHERE id = v_due_today) <> (CURRENT_DATE + INTERVAL '1 month')::date THEN
    RAISE EXCEPTION 'due_today: next date did not move one cycle';
  END IF;

  -- Three cycles behind: three drafts, each dated to its own period.
  SELECT array_agg(issue_date ORDER BY issue_date) INTO v_dates
  FROM invoices WHERE subtotal = 500 AND user_id = '11111111-1111-4111-8111-111111111111';
  IF v_dates IS DISTINCT FROM ARRAY[(CURRENT_DATE - INTERVAL '2 months')::date,
                                    (CURRENT_DATE - INTERVAL '2 months' + INTERVAL '1 month')::date,
                                    (CURRENT_DATE - INTERVAL '2 months' + INTERVAL '2 months')::date] THEN
    RAISE EXCEPTION 'three_behind: wrong period dates %', v_dates;
  END IF;
  IF (SELECT next_invoice_date FROM recurring_invoices WHERE id = v_behind) <= CURRENT_DATE THEN
    RAISE EXCEPTION 'three_behind: next date not moved past today';
  END IF;

  -- All drafts, none sent; due date follows each period's payment terms.
  IF EXISTS (SELECT 1 FROM invoices WHERE subtotal IN (500, 1000) AND status <> 'DRAFT') THEN
    RAISE EXCEPTION 'a drafted invoice is not DRAFT';
  END IF;
  IF EXISTS (SELECT 1 FROM invoices WHERE subtotal = 500 AND due_date <> issue_date + 30) THEN
    RAISE EXCEPTION 'three_behind: due dates not Net 30 from each period';
  END IF;

  -- Not due / paused templates untouched.
  IF EXISTS (SELECT 1 FROM invoices WHERE subtotal = 1) THEN
    RAISE EXCEPTION 'future or paused template was drafted';
  END IF;

  -- One in-app notification for the owner and for the admin; none for the member.
  SELECT count(*) INTO v_n FROM notifications
  WHERE type = 'recurring_invoices_drafted' AND title = '4 recurring invoices drafted'
    AND recipient_user_id IN ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222');
  IF v_n <> 2 THEN RAISE EXCEPTION 'run 1: expected 1 notification each for owner + admin, got %', v_n; END IF;
  IF EXISTS (SELECT 1 FROM notifications WHERE type = 'recurring_invoices_drafted'
             AND recipient_user_id = '33333333-3333-4333-8333-333333333333') THEN
    RAISE EXCEPTION 'member was notified';
  END IF;

  -- Run 2: idempotent — no new drafts, no new notification ---------------------
  SELECT count(*) INTO v_inv_before FROM invoices;
  v_created := public.draft_due_recurring_invoices();
  IF v_created <> 0 THEN RAISE EXCEPTION 'run 2: expected 0 drafts, got %', v_created; END IF;
  IF (SELECT count(*) FROM invoices) <> v_inv_before THEN RAISE EXCEPTION 'run 2 created invoices'; END IF;
  IF (SELECT count(*) FROM notifications WHERE type = 'recurring_invoices_drafted') <> 2 THEN
    RAISE EXCEPTION 'run 2 notified again';
  END IF;

  -- Plan without finance_recurring_invoices: skipped ----------------------------
  UPDATE recurring_invoices SET next_invoice_date = CURRENT_DATE WHERE id = v_due_today;
  UPDATE agency_subscriptions SET finance_recurring_invoices = false
  WHERE user_id = '11111111-1111-4111-8111-111111111111';
  v_created := public.draft_due_recurring_invoices();
  IF v_created <> 0 THEN RAISE EXCEPTION 'unflagged workspace: expected 0 drafts, got %', v_created; END IF;
  UPDATE agency_subscriptions SET finance_recurring_invoices = true
  WHERE user_id = '11111111-1111-4111-8111-111111111111';

  -- The Generate button is unchanged: dated today, advances one cycle ---------
  PERFORM public.generate_invoice_from_template(v_due_today, '11111111-1111-4111-8111-111111111111');
  IF (SELECT count(*) FROM invoices WHERE subtotal = 1000 AND issue_date = CURRENT_DATE) <> 2 THEN
    RAISE EXCEPTION 'generate_invoice_from_template did not draft today''s invoice';
  END IF;
  IF (SELECT next_invoice_date FROM recurring_invoices WHERE id = v_due_today) <> (CURRENT_DATE + INTERVAL '1 month')::date THEN
    RAISE EXCEPTION 'generate_invoice_from_template did not advance the template';
  END IF;
  BEGIN
    PERFORM public.generate_invoice_from_template(v_due_today, '22222222-2222-4222-8222-222222222222');
    RAISE EXCEPTION 'generate_invoice_from_template accepted a foreign workspace';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'Template not found or access denied%' THEN RAISE; END IF;
  END;

  RAISE NOTICE 'PASS: recurring invoice drafts (% checks)', 14;
END
$test$;

-- The job is scheduled, and callers outside the database cannot run it.
DO $test$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'draft-recurring-invoices'
                 AND command LIKE '%draft_due_recurring_invoices()%') THEN
    RAISE EXCEPTION 'cron job draft-recurring-invoices is not scheduled';
  END IF;
  IF has_function_privilege('authenticated', 'public.draft_due_recurring_invoices()', 'EXECUTE')
     OR has_function_privilege('anon', 'public.draft_due_recurring_invoices()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.draft_invoice_from_template(uuid, date)', 'EXECUTE') THEN
    RAISE EXCEPTION 'job functions are executable by API roles';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.generate_invoice_from_template(uuid, uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Generate button lost its EXECUTE grant';
  END IF;
  RAISE NOTICE 'PASS: schedule and privileges';
END
$test$;

ROLLBACK;
