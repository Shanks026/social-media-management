-- #173 test: scheduling a Social deliverable and approving a non-social one
-- go through schedule_deliverable() / approve_deliverable() (ADR 0004). Only an
-- Owner or Admin of the Deliverable's workspace may call them, only from DRAFT
-- or READY, and each tells the Deliverable's creator.
-- Self-checking and self-cleaning: runs in a transaction that is rolled back,
-- and raises on the first failed assertion.
--
--   docker exec -i supabase_db_tercero psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/schedule_approve.test.sql
--
-- Uses the seeded Northwind Social workspace (owner 1111…, admin 2222…,
-- member 3333…) and an outsider (9999…) who owns a workspace of their own.
--   e1…0001  Acme Coffee, Instagram, DRAFT, created by the Member  → single-date schedule
--   e1…0009  Acme Coffee, Instagram, DRAFT, created by the Admin   → given per-platform dates
--   e1…0002  Acme Coffee, SUBMITTED, created by the Member         → refused, then READY + non-social
--   e1…0007  Internal account, DRAFT, created by the Member        → made non-social

\set ON_ERROR_STOP 1
BEGIN;

INSERT INTO auth.users (id, instance_id, aud, role, email)
VALUES ('99999999-9999-4999-8999-999999999999', '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'delivered+outsider@resend.dev');

UPDATE post_versions SET platform = '{}' WHERE id = 'e1000000-0000-4000-8000-000000000007';
UPDATE post_versions
SET platform_schedules = jsonb_build_object('instagram', jsonb_build_object('scheduled_at', '2026-12-20T09:00:00Z'))
WHERE id = 'e1000000-0000-4000-8000-000000000009';
UPDATE post_versions SET platform_schedules = NULL WHERE id = 'e1000000-0000-4000-8000-000000000001';

-- Record the transition flag as the status trigger would see it.
CREATE TEMP TABLE t_flag_seen (version_id uuid, flag text);
CREATE FUNCTION pg_temp.record_flag() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO t_flag_seen VALUES (NEW.id, current_setting('tercero.deliverable_transition', true));
  RETURN NEW;
END $$;
CREATE TRIGGER t_record_flag BEFORE UPDATE OF status ON post_versions
  FOR EACH ROW EXECUTE FUNCTION pg_temp.record_flag();
GRANT INSERT ON t_flag_seen TO authenticated;

CREATE FUNCTION pg_temp.act_as(p_uid uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
$$;

-- Expects the call to fail with a raise_exception whose message contains p_like.
CREATE FUNCTION pg_temp.expect_refusal(p_sql text, p_like text, p_fail text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE p_sql;
  RAISE EXCEPTION 'FAIL: %', p_fail;
EXCEPTION WHEN raise_exception THEN
  IF SQLERRM LIKE 'FAIL:%' THEN RAISE; END IF;
  IF SQLERRM NOT LIKE '%' || p_like || '%' THEN
    RAISE EXCEPTION 'FAIL: % (refused with "%" instead)', p_fail, SQLERRM;
  END IF;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.expect_refusal(text, text, text) TO authenticated;

-- ── Privileges ────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF has_function_privilege('anon', 'public.schedule_deliverable(uuid, timestamptz)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.approve_deliverable(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: anon can schedule or approve';
  END IF;
  IF has_function_privilege('authenticated', 'public.assert_deliverable_admin(uuid, text, boolean)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: users can execute the internal caller check';
  END IF;
END $$;

-- ── Outsider: another workspace's Deliverable is not found ────────────────
SELECT pg_temp.act_as('99999999-9999-4999-8999-999999999999');
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  PERFORM public.schedule_deliverable('e1000000-0000-4000-8000-000000000001', now());
  RAISE EXCEPTION 'FAIL: an outsider scheduled another workspace''s Deliverable';
EXCEPTION WHEN no_data_found THEN NULL;
END $$;
DO $$
BEGIN
  PERFORM public.approve_deliverable('e1000000-0000-4000-8000-000000000007');
  RAISE EXCEPTION 'FAIL: an outsider approved another workspace''s Deliverable';
EXCEPTION WHEN no_data_found THEN NULL;
END $$;
RESET ROLE;

-- ── Member: refused for both ──────────────────────────────────────────────
SELECT pg_temp.act_as('33333333-3333-4333-8333-333333333333');
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  PERFORM public.schedule_deliverable('e1000000-0000-4000-8000-000000000001', now());
  RAISE EXCEPTION 'FAIL: a Member scheduled a Deliverable';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;
DO $$
BEGIN
  PERFORM public.approve_deliverable('e1000000-0000-4000-8000-000000000007');
  RAISE EXCEPTION 'FAIL: a Member approved a Deliverable';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;
RESET ROLE;

DO $$
BEGIN
  IF (SELECT status FROM post_versions WHERE id = 'e1000000-0000-4000-8000-000000000001') <> 'DRAFT'
     OR (SELECT status FROM post_versions WHERE id = 'e1000000-0000-4000-8000-000000000007') <> 'DRAFT' THEN
    RAISE EXCEPTION 'FAIL: a refused call changed the status';
  END IF;
END $$;

-- ── Owner: refusals ───────────────────────────────────────────────────────
SELECT pg_temp.act_as('11111111-1111-4111-8111-111111111111');
SET LOCAL ROLE authenticated;
SELECT pg_temp.expect_refusal(
  $q$SELECT public.schedule_deliverable('e1000000-0000-4000-8000-000000000002', now())$q$,
  'SUBMITTED', 'a SUBMITTED Version was scheduled');
SELECT pg_temp.expect_refusal(
  $q$SELECT public.approve_deliverable('e1000000-0000-4000-8000-000000000002')$q$,
  'SUBMITTED', 'a SUBMITTED Version was approved');
SELECT pg_temp.expect_refusal(
  $q$SELECT public.schedule_deliverable('e1000000-0000-4000-8000-000000000001', NULL)$q$,
  'Please select a publish date', 'a single-date Deliverable was scheduled without a date');
SELECT pg_temp.expect_refusal(
  $q$SELECT public.approve_deliverable('e1000000-0000-4000-8000-000000000001')$q$,
  'non-social', 'a Social deliverable was approved instead of scheduled');
SELECT pg_temp.expect_refusal(
  $q$SELECT public.schedule_deliverable('e1000000-0000-4000-8000-000000000007', now())$q$,
  'Social', 'a non-social Deliverable was scheduled');

-- ── Owner: schedule with a single date ────────────────────────────────────
SELECT public.schedule_deliverable('e1000000-0000-4000-8000-000000000001', '2026-12-24 10:00+00');

-- ── Owner: approve non-social ─────────────────────────────────────────────
SELECT public.approve_deliverable('e1000000-0000-4000-8000-000000000007');
RESET ROLE;

DO $$
BEGIN
  IF (SELECT status FROM post_versions WHERE id = 'e1000000-0000-4000-8000-000000000001') <> 'SCHEDULED' THEN
    RAISE EXCEPTION 'FAIL: the Owner could not schedule a DRAFT';
  END IF;
  IF (SELECT target_date FROM post_versions WHERE id = 'e1000000-0000-4000-8000-000000000001') <> '2026-12-24 10:00+00' THEN
    RAISE EXCEPTION 'FAIL: the publish date was not saved';
  END IF;
  IF (SELECT status FROM post_versions WHERE id = 'e1000000-0000-4000-8000-000000000007') <> 'APPROVED' THEN
    RAISE EXCEPTION 'FAIL: the Owner could not approve a non-social DRAFT';
  END IF;

  IF EXISTS (SELECT 1 FROM t_flag_seen
             WHERE version_id IN ('e1000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000007')
               AND flag IS DISTINCT FROM 'on')
     OR (SELECT count(*) FROM t_flag_seen) <> 2 THEN
    RAISE EXCEPTION 'FAIL: a status changed without the transition flag set';
  END IF;
  IF current_setting('tercero.deliverable_transition', true) = 'on' THEN
    RAISE EXCEPTION 'FAIL: the transition flag stayed on after the call';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM notifications
    WHERE entity_id = 'd1000000-0000-4000-8000-000000000001' AND type = 'post_status_changed'
      AND recipient_user_id = '33333333-3333-4333-8333-333333333333'
      AND actor_user_id = '11111111-1111-4111-8111-111111111111'
      AND title = 'Your deliverable was scheduled'
  ) THEN
    RAISE EXCEPTION 'FAIL: the creator got no notification for the schedule';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM notifications
    WHERE entity_id = 'd1000000-0000-4000-8000-000000000007' AND type = 'post_status_changed'
      AND recipient_user_id = '33333333-3333-4333-8333-333333333333'
      AND title = 'Your deliverable was approved'
  ) THEN
    RAISE EXCEPTION 'FAIL: the creator got no notification for the approval';
  END IF;
END $$;

-- ── Admin: per-platform schedule needs no date and keeps target_date ──────
UPDATE post_versions SET target_date = '2026-12-20 09:00+00' WHERE id = 'e1000000-0000-4000-8000-000000000009';
-- and a READY non-social Version to approve
UPDATE post_versions SET status = 'READY', platform = '{}' WHERE id = 'e1000000-0000-4000-8000-000000000002';

SELECT pg_temp.act_as('22222222-2222-4222-8222-222222222222');
SET LOCAL ROLE authenticated;
SELECT public.schedule_deliverable('e1000000-0000-4000-8000-000000000009');
SELECT public.approve_deliverable('e1000000-0000-4000-8000-000000000002');
RESET ROLE;

DO $$
BEGIN
  IF (SELECT status FROM post_versions WHERE id = 'e1000000-0000-4000-8000-000000000009') <> 'SCHEDULED' THEN
    RAISE EXCEPTION 'FAIL: the Admin could not schedule a per-platform Deliverable';
  END IF;
  IF (SELECT target_date FROM post_versions WHERE id = 'e1000000-0000-4000-8000-000000000009') <> '2026-12-20 09:00+00' THEN
    RAISE EXCEPTION 'FAIL: scheduling per-platform changed target_date';
  END IF;
  IF (SELECT status FROM post_versions WHERE id = 'e1000000-0000-4000-8000-000000000002') <> 'APPROVED' THEN
    RAISE EXCEPTION 'FAIL: the Admin could not approve a READY non-social Version';
  END IF;
END $$;

\echo 'schedule_approve: all assertions passed'
ROLLBACK;
