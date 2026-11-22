-- #181 test (ADR 0008): creating a Deliverable and a revision stamps the
-- real caller as created_by (no user id can be passed since #182), and generating an
-- invoice from a recurring template works only for finance users of that
-- template's workspace. Self-checking and self-cleaning: runs in a
-- transaction that is rolled back, and raises on the first failure.
--
--   docker exec -i supabase_db_tercero psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/real_caller.test.sql
--
-- Seeded Northwind Social: owner 1111…, admin 2222…, member 3333… (documents
-- "view", no finance access); outsider 9999… owns a workspace of their own.

\set ON_ERROR_STOP 1
BEGIN;

INSERT INTO auth.users (id, instance_id, aud, role, email)
VALUES ('99999999-9999-4999-8999-999999999999', '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'delivered+outsider@resend.dev');

CREATE FUNCTION pg_temp.act_as(p_uid uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
$$;

CREATE FUNCTION pg_temp.expect_refusal(p_sql text, p_like text, p_fail text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE p_sql;
  RAISE EXCEPTION 'FAIL: %', p_fail;
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM LIKE 'FAIL:%' THEN RAISE; END IF;
  IF SQLERRM NOT LIKE '%' || p_like || '%' THEN
    RAISE EXCEPTION 'FAIL: % (refused with "%" instead)', p_fail, SQLERRM;
  END IF;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.expect_refusal(text, text, text) TO authenticated;

CREATE TEMP TABLE t_ids (label text, id uuid);
GRANT INSERT, SELECT ON t_ids TO authenticated;

-- ── The Member creates a Deliverable and a revision ───────────────────────
SELECT pg_temp.act_as('33333333-3333-4333-8333-333333333333');
SET LOCAL ROLE authenticated;
INSERT INTO t_ids
SELECT 'new', public.create_post_draft_v3(
  p_client_id => 'c1111111-1111-4111-8111-111111111111', p_title => 'Member draft', p_content => 'x',
  p_media_urls => '{}', p_platform => '{instagram}');
INSERT INTO t_ids
SELECT 'rev_new', public.create_revision_version(
  p_parent_version_id => 'e1000000-0000-4000-8000-000000000004', p_admin_notes => 'Second pass');
RESET ROLE;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT t.label, pv.created_by, p.created_by AS post_creator
           FROM t_ids t JOIN post_versions pv ON pv.id = t.id JOIN posts p ON p.id = pv.post_id
  LOOP
    IF r.created_by IS DISTINCT FROM '33333333-3333-4333-8333-333333333333' THEN
      RAISE EXCEPTION 'FAIL: % stamped created_by % instead of the Member', r.label, r.created_by;
    END IF;
    IF r.label = 'new' AND r.post_creator IS DISTINCT FROM '33333333-3333-4333-8333-333333333333' THEN
      RAISE EXCEPTION 'FAIL: % made the Deliverable''s creator % instead of the Member', r.label, r.post_creator;
    END IF;
  END LOOP;
  IF (SELECT count(*) FROM t_ids) <> 2 THEN
    RAISE EXCEPTION 'FAIL: expected 2 created Versions';
  END IF;
END $$;

-- Signed out: refused.
SELECT set_config('request.jwt.claims', '', true);
DO $$
BEGIN
  PERFORM public.create_post_draft_v3(
    p_client_id => 'c1111111-1111-4111-8111-111111111111', p_title => 'Nobody', p_content => 'x',
    p_media_urls => '{}', p_platform => '{}');
  RAISE EXCEPTION 'FAIL: a Deliverable was created without a caller';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;

-- ── Invoice from a recurring template ─────────────────────────────────────
INSERT INTO recurring_invoices (id, user_id, client_id, amount, category, description, billing_cycle, next_invoice_date, payment_terms)
VALUES ('f1000000-0000-4000-8000-000000000181', '11111111-1111-4111-8111-111111111111',
        'c1111111-1111-4111-8111-111111111111', 1000, 'Retainer', 'Monthly retainer', 'MONTHLY', CURRENT_DATE, 'Net 15');

-- The Member has no finance access; the outsider is another workspace.
SELECT pg_temp.act_as('33333333-3333-4333-8333-333333333333');
SET LOCAL ROLE authenticated;
SELECT pg_temp.expect_refusal(
  $q$SELECT public.generate_invoice_from_template('f1000000-0000-4000-8000-000000000181')$q$,
  'finance access', 'a Member without finance access generated an invoice');
RESET ROLE;

SELECT pg_temp.act_as('99999999-9999-4999-8999-999999999999');
SET LOCAL ROLE authenticated;
SELECT pg_temp.expect_refusal(
  $q$SELECT public.generate_invoice_from_template('f1000000-0000-4000-8000-000000000181')$q$,
  'not found', 'an outsider generated an invoice from another workspace''s template');
RESET ROLE;

-- The Owner can.
SELECT pg_temp.act_as('11111111-1111-4111-8111-111111111111');
SET LOCAL ROLE authenticated;
INSERT INTO t_ids SELECT 'invoice', public.generate_invoice_from_template('f1000000-0000-4000-8000-000000000181');
RESET ROLE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM invoices WHERE id = (SELECT id FROM t_ids WHERE label = 'invoice')
      AND user_id = '11111111-1111-4111-8111-111111111111'
  ) THEN
    RAISE EXCEPTION 'FAIL: the Owner''s invoice was not created in their workspace';
  END IF;
END $$;

\echo 'real_caller: all assertions passed'
ROLLBACK;
