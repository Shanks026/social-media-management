-- #178 test (ADR 0004, the contract): the database refuses a Deliverable's
-- status and publish dates unless a transition function writes them, and the
-- whole lifecycle still works through the functions alone. No fixture here
-- sets the transition flag. Self-checking and self-cleaning: runs in a
-- transaction that is rolled back, and raises on the first failure.
--
--   docker exec -i supabase_db_tercero psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/deliverable_lifecycle.test.sql
--
-- Seeded Northwind Social workspace: owner 1111…, admin 2222…, member 3333….
--   e1…0001  Acme Coffee, DRAFT, the Member's, Social → the full Social path
--   e1…0007  Internal account, DRAFT, the Member's    → made non-social: approve → deliver
--   e1…0005  SCHEDULED                                → target of the raw writes
--   e1…0004  NEEDS_REVISION                           → a new Version

\set ON_ERROR_STOP 1
BEGIN;

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
GRANT EXECUTE ON FUNCTION pg_temp.expect_refusal(text, text, text) TO authenticated, service_role, anon;

CREATE FUNCTION pg_temp.expect_status(p_id uuid, p_status text, p_step text) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  v text := (SELECT status FROM post_versions WHERE id = p_id);
BEGIN
  IF v IS DISTINCT FROM p_status THEN
    RAISE EXCEPTION 'FAIL: after %, expected % but found %', p_step, p_status, v;
  END IF;
END $$;

-- ── Raw writes are refused, for everyone ──────────────────────────────────
-- As the Owner (RLS would let them write the row).
SELECT pg_temp.act_as('11111111-1111-4111-8111-111111111111');
SET LOCAL ROLE authenticated;
SELECT pg_temp.expect_refusal(
  $q$UPDATE post_versions SET status = 'PUBLISHED' WHERE id = 'e1000000-0000-4000-8000-000000000005'$q$,
  'only through its actions', 'the Owner set a status directly');
SELECT pg_temp.expect_refusal(
  $q$UPDATE post_versions SET published_at = now() WHERE id = 'e1000000-0000-4000-8000-000000000005'$q$,
  'only through its actions', 'the Owner set published_at directly');
SELECT pg_temp.expect_refusal(
  $q$UPDATE post_versions
     SET platform_schedules = jsonb_build_object('instagram', jsonb_build_object('scheduled_at', '2026-12-20T09:00:00Z', 'published_at', now()))
     WHERE id = 'e1000000-0000-4000-8000-000000000005'$q$,
  'only through its actions', 'the Owner marked a platform published directly');
SELECT pg_temp.expect_refusal(
  $q$INSERT INTO post_versions (post_id, client_id, version_number, status, title, content, platform, created_by)
     VALUES ('d1000000-0000-4000-8000-000000000005', 'c2222222-2222-4222-8222-222222222222', 9, 'PUBLISHED',
             'Forged', 'x', '{instagram}', '11111111-1111-4111-8111-111111111111')$q$,
  'starts as an unpublished DRAFT', 'the Owner inserted a PUBLISHED Version');
-- Dates and content stay editable.
UPDATE post_versions
SET target_date = '2026-12-24 10:00+00',
    platform_schedules = jsonb_build_object('instagram', jsonb_build_object('scheduled_at', '2026-12-24T10:00:00Z'))
WHERE id = 'e1000000-0000-4000-8000-000000000005';
UPDATE post_versions SET title = 'Renamed draft' WHERE id = 'e1000000-0000-4000-8000-000000000001';
RESET ROLE;

-- As the service role (bypasses RLS, not the guard).
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);
SET LOCAL ROLE service_role;
SELECT pg_temp.expect_refusal(
  $q$UPDATE post_versions SET status = 'ARCHIVED' WHERE id = 'e1000000-0000-4000-8000-000000000005'$q$,
  'only through its actions', 'the service role set a status directly');
RESET ROLE;

-- As postgres (the SQL editor).
SELECT pg_temp.expect_refusal(
  $q$UPDATE post_versions SET status = 'ARCHIVED' WHERE id = 'e1000000-0000-4000-8000-000000000005'$q$,
  'only through its actions', 'postgres set a status directly');

DO $$
BEGIN
  IF (SELECT target_date FROM post_versions WHERE id = 'e1000000-0000-4000-8000-000000000005') <> '2026-12-24 10:00+00'
     OR (SELECT title FROM post_versions WHERE id = 'e1000000-0000-4000-8000-000000000001') <> 'Renamed draft' THEN
    RAISE EXCEPTION 'FAIL: a date or a title could not be edited';
  END IF;
  PERFORM pg_temp.expect_status('e1000000-0000-4000-8000-000000000005', 'SCHEDULED', 'the refused writes');
  IF to_regprocedure('public.update_post_status_by_token(text, text, text)') IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: the old review-link signature still exists';
  END IF;
END $$;

-- ── Social: draft → internal review → client approval → publish ──────────
-- Member submits; Admin asks for changes; Member resubmits; Admin approves.
SELECT pg_temp.act_as('33333333-3333-4333-8333-333333333333');
SET LOCAL ROLE authenticated;
SELECT public.submit_for_internal_approval('e1000000-0000-4000-8000-000000000001');
RESET ROLE;
SELECT pg_temp.expect_status('e1000000-0000-4000-8000-000000000001', 'SUBMITTED', 'submit');

SELECT pg_temp.act_as('22222222-2222-4222-8222-222222222222');
SET LOCAL ROLE authenticated;
SELECT public.request_internal_changes('e1000000-0000-4000-8000-000000000001', 'Shorter caption');
RESET ROLE;
SELECT pg_temp.expect_status('e1000000-0000-4000-8000-000000000001', 'CHANGES_REQUESTED', 'request changes');

SELECT pg_temp.act_as('33333333-3333-4333-8333-333333333333');
SET LOCAL ROLE authenticated;
SELECT public.submit_for_internal_approval('e1000000-0000-4000-8000-000000000001');
-- A Member can't review their own work.
SELECT pg_temp.expect_refusal(
  $q$SELECT public.approve_internally('e1000000-0000-4000-8000-000000000001')$q$,
  'Only an Owner or Admin', 'a Member approved internally');
RESET ROLE;

SELECT pg_temp.act_as('22222222-2222-4222-8222-222222222222');
SET LOCAL ROLE authenticated;
SELECT public.approve_internally('e1000000-0000-4000-8000-000000000001');
RESET ROLE;
SELECT pg_temp.expect_status('e1000000-0000-4000-8000-000000000001', 'READY', 'internal approval');

-- Owner sends it to the Client; the Client approves through the link.
SELECT pg_temp.act_as('11111111-1111-4111-8111-111111111111');
SET LOCAL ROLE authenticated;
SELECT public.send_post_for_approval('e1000000-0000-4000-8000-000000000001');
RESET ROLE;
SELECT pg_temp.expect_status('e1000000-0000-4000-8000-000000000001', 'PENDING_APPROVAL', 'send for approval');

INSERT INTO share_tokens (post_version_id, token) VALUES ('e1000000-0000-4000-8000-000000000001', 'tok-178');
SELECT set_config('request.jwt.claims', '', true);
SET LOCAL ROLE anon;
SELECT public.submit_review_decision('tok-178', 'APPROVE', NULL);
RESET ROLE;
SELECT pg_temp.expect_status('e1000000-0000-4000-8000-000000000001', 'SCHEDULED', 'client approval');

-- Owner publishes it.
SELECT pg_temp.act_as('11111111-1111-4111-8111-111111111111');
SET LOCAL ROLE authenticated;
SELECT public.mark_published('e1000000-0000-4000-8000-000000000001');
RESET ROLE;
SELECT pg_temp.expect_status('e1000000-0000-4000-8000-000000000001', 'PUBLISHED', 'publish');

-- ── Non-social: draft → approved → delivered ──────────────────────────────
UPDATE post_versions SET platform = '{}' WHERE id = 'e1000000-0000-4000-8000-000000000007';

SELECT pg_temp.act_as('11111111-1111-4111-8111-111111111111');
SET LOCAL ROLE authenticated;
SELECT public.approve_deliverable('e1000000-0000-4000-8000-000000000007');
RESET ROLE;
SELECT pg_temp.expect_status('e1000000-0000-4000-8000-000000000007', 'APPROVED', 'approve non-social');

SET LOCAL ROLE authenticated;
SELECT public.mark_delivered('e1000000-0000-4000-8000-000000000007', 'Handed over');
RESET ROLE;
SELECT pg_temp.expect_status('e1000000-0000-4000-8000-000000000007', 'DELIVERED', 'deliver');

-- ── Revision and archive ──────────────────────────────────────────────────
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE t_v2 ON COMMIT DROP AS
SELECT public.create_revision_version('e1000000-0000-4000-8000-000000000004', NULL, 'Second pass') AS id;
RESET ROLE;
SELECT pg_temp.expect_status('e1000000-0000-4000-8000-000000000004', 'ARCHIVED', 'create a new version');
SELECT pg_temp.expect_status((SELECT id FROM t_v2), 'DRAFT', 'the new version');

SET LOCAL ROLE authenticated;
SELECT public.archive_deliverable((SELECT id FROM t_v2));
RESET ROLE;
SELECT pg_temp.expect_status((SELECT id FROM t_v2), 'ARCHIVED', 'archive');

-- ── Another workspace's Admin can't review this one's Versions ────────────
INSERT INTO auth.users (id, instance_id, aud, role, email)
VALUES ('99999999-9999-4999-8999-999999999999', '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'delivered+outsider@resend.dev');
-- e1…0002 is seeded SUBMITTED.
SELECT pg_temp.act_as('99999999-9999-4999-8999-999999999999');
SET LOCAL ROLE authenticated;
SELECT pg_temp.expect_refusal(
  $q$SELECT public.approve_internally('e1000000-0000-4000-8000-000000000002')$q$,
  'not found', 'an outsider approved another workspace''s Version');
SELECT pg_temp.expect_refusal(
  $q$SELECT public.request_internal_changes('e1000000-0000-4000-8000-000000000002', 'x')$q$,
  'not found', 'an outsider requested changes on another workspace''s Version');
RESET ROLE;
SELECT pg_temp.expect_status('e1000000-0000-4000-8000-000000000002', 'SUBMITTED', 'the outsider''s attempts');

\echo 'deliverable_lifecycle: all assertions passed'
ROLLBACK;
