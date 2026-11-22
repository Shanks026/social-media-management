-- #172 test: marking a Deliverable delivered goes through mark_delivered()
-- (ADR 0004), which only an Owner or Admin of the Deliverable's workspace may
-- call, only on an APPROVED Version, and which tells the Deliverable's creator.
-- Self-checking and self-cleaning: runs in a transaction that is rolled back,
-- and raises on the first failed assertion.
--
--   docker exec -i supabase_db_tercero psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/mark_delivered.test.sql
--
-- Uses the seeded Northwind Social workspace (owner 1111…, admin 2222…,
-- member 3333…) and an outsider (9999…) who owns a workspace of their own.
--   e1…0001  Acme Coffee, created by the Member → made non-social and APPROVED
--   e1…0003  Acme Coffee, created by the Admin  → made non-social and APPROVED
--   e1…0009  Acme Coffee, created by the Admin, left DRAFT

\set ON_ERROR_STOP 1
BEGIN;

INSERT INTO auth.users (id, instance_id, aud, role, email)
VALUES ('99999999-9999-4999-8999-999999999999', '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'delivered+outsider@resend.dev');

UPDATE post_versions SET platform = '{}'
WHERE id IN ('e1000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000003');
SELECT set_config('tercero.deliverable_transition', 'on', true);  -- fixtures stand in for history (#178)
UPDATE post_versions SET status = 'APPROVED'
WHERE id IN ('e1000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000003');
SELECT set_config('tercero.deliverable_transition', '', true);

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

-- ── Nobody can call the internal helper directly ──────────────────────────
DO $$
BEGIN
  IF has_function_privilege('authenticated', 'public.deliverable_event(uuid, text, jsonb)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.deliverable_event(uuid, text, jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: users can execute deliverable_event directly';
  END IF;
  IF has_function_privilege('anon', 'public.mark_delivered(uuid, text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: anon can execute mark_delivered';
  END IF;
END $$;

-- ── Outsider: another workspace's Deliverable is not found ────────────────
SELECT pg_temp.act_as('99999999-9999-4999-8999-999999999999');
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  PERFORM public.mark_delivered('e1000000-0000-4000-8000-000000000001', NULL);
  RAISE EXCEPTION 'FAIL: an outsider marked another workspace''s Deliverable delivered';
EXCEPTION WHEN no_data_found THEN NULL;
END $$;
RESET ROLE;

-- ── Member: refused ───────────────────────────────────────────────────────
SELECT pg_temp.act_as('33333333-3333-4333-8333-333333333333');
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  PERFORM public.mark_delivered('e1000000-0000-4000-8000-000000000001', NULL);
  RAISE EXCEPTION 'FAIL: a Member marked a Deliverable delivered';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;
RESET ROLE;

DO $$
BEGIN
  IF (SELECT status FROM post_versions WHERE id = 'e1000000-0000-4000-8000-000000000001') <> 'APPROVED' THEN
    RAISE EXCEPTION 'FAIL: a refused call changed the status';
  END IF;
END $$;

-- ── Owner: a Version that isn't APPROVED is refused ───────────────────────
SELECT pg_temp.act_as('11111111-1111-4111-8111-111111111111');
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  PERFORM public.mark_delivered('e1000000-0000-4000-8000-000000000009', NULL);
  RAISE EXCEPTION 'FAIL: a DRAFT Version was marked delivered';
EXCEPTION WHEN raise_exception THEN
  IF SQLERRM LIKE 'FAIL:%' THEN RAISE; END IF;
END $$;

-- ── Owner: an APPROVED Version with a delivery note ───────────────────────
SELECT public.mark_delivered('e1000000-0000-4000-8000-000000000001', '  Sent via Drive  ');
RESET ROLE;

DO $$
DECLARE
  v_post uuid;
BEGIN
  IF (SELECT status FROM post_versions WHERE id = 'e1000000-0000-4000-8000-000000000001') <> 'DELIVERED' THEN
    RAISE EXCEPTION 'FAIL: the Owner could not mark an APPROVED Version delivered';
  END IF;
  IF (SELECT admin_notes FROM post_versions WHERE id = 'e1000000-0000-4000-8000-000000000001') IS DISTINCT FROM 'Sent via Drive' THEN
    RAISE EXCEPTION 'FAIL: the delivery note was not saved (trimmed)';
  END IF;

  IF (SELECT flag FROM t_flag_seen WHERE version_id = 'e1000000-0000-4000-8000-000000000001') IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'FAIL: the status changed without the transition flag set';
  END IF;
  IF current_setting('tercero.deliverable_transition', true) = 'on' THEN
    RAISE EXCEPTION 'FAIL: the transition flag stayed on after the call';
  END IF;

  SELECT post_id INTO v_post FROM post_versions WHERE id = 'e1000000-0000-4000-8000-000000000001';
  IF NOT EXISTS (
    SELECT 1 FROM notifications
    WHERE entity_id = v_post AND type = 'post_status_changed'
      AND recipient_user_id = '33333333-3333-4333-8333-333333333333'
      AND actor_user_id = '11111111-1111-4111-8111-111111111111'
      AND title = 'Your deliverable was delivered'
  ) THEN
    RAISE EXCEPTION 'FAIL: the creator got no in-app notification';
  END IF;
END $$;

-- ── Admin: allowed, without a note (the note stays as it was) ─────────────
UPDATE post_versions SET admin_notes = 'earlier note'
WHERE id = 'e1000000-0000-4000-8000-000000000003';

SELECT pg_temp.act_as('22222222-2222-4222-8222-222222222222');
SET LOCAL ROLE authenticated;
SELECT public.mark_delivered('e1000000-0000-4000-8000-000000000003');
RESET ROLE;

DO $$
BEGIN
  IF (SELECT status FROM post_versions WHERE id = 'e1000000-0000-4000-8000-000000000003') <> 'DELIVERED' THEN
    RAISE EXCEPTION 'FAIL: the Admin could not mark an APPROVED Version delivered';
  END IF;
  IF (SELECT admin_notes FROM post_versions WHERE id = 'e1000000-0000-4000-8000-000000000003') IS DISTINCT FROM 'earlier note' THEN
    RAISE EXCEPTION 'FAIL: marking delivered without a note changed admin_notes';
  END IF;
END $$;

\echo 'mark_delivered: all assertions passed'
ROLLBACK;
