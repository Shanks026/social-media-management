-- #175 test: sending a Deliverable for Client approval goes through
-- send_post_for_approval() (ADR 0004). Only an Owner or Admin of the
-- Deliverable's workspace may call it, only from DRAFT or READY, and the
-- approval email is queued by the database as part of the status change.
-- Self-checking and self-cleaning: runs in a transaction that is rolled back
-- (so the queued requests are never sent), and raises on the first failure.
--
--   docker exec -i supabase_db_tercero psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/send_for_approval.test.sql
--
-- Uses the seeded Northwind Social workspace (owner 1111…, admin 2222…,
-- member 3333…) and an outsider (9999…) who owns a workspace of their own.
--   e1…0001  Acme Coffee, DRAFT, created by the Member  → sent by the Owner
--   e1…0002  Acme Coffee, SUBMITTED, created by the Member → refused, then READY → sent by the Admin
--   e1…0009  Acme Coffee, DRAFT v2 of a post whose v1 is still APPROVED → refused
--   e1…0007  Internal account, DRAFT → given empty content → refused

\set ON_ERROR_STOP 1
BEGIN;

INSERT INTO auth.users (id, instance_id, aud, role, email)
VALUES ('99999999-9999-4999-8999-999999999999', '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'delivered+outsider@resend.dev');

UPDATE post_versions SET content = '' WHERE id = 'e1000000-0000-4000-8000-000000000007';

CREATE TEMP TABLE t_queue_start AS SELECT coalesce(max(id), 0) AS id FROM net.http_request_queue;
CREATE FUNCTION pg_temp.approval_emails() RETURNS SETOF jsonb LANGUAGE sql AS $$
  SELECT convert_from(q.body, 'utf8')::jsonb
  FROM net.http_request_queue q
  WHERE q.id > (SELECT id FROM t_queue_start)
    AND q.url LIKE '%/functions/v1/send-approval-email'
  ORDER BY q.id;
$$;

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
  IF has_function_privilege('anon', 'public.send_post_for_approval(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: anon can send a Deliverable for approval';
  END IF;
END $$;

-- ── Outsider: another workspace's Deliverable is not found ────────────────
SELECT pg_temp.act_as('99999999-9999-4999-8999-999999999999');
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  PERFORM public.send_post_for_approval('e1000000-0000-4000-8000-000000000001');
  RAISE EXCEPTION 'FAIL: an outsider sent another workspace''s Deliverable for approval';
EXCEPTION WHEN no_data_found THEN NULL;
END $$;
RESET ROLE;

-- ── Member: refused ───────────────────────────────────────────────────────
SELECT pg_temp.act_as('33333333-3333-4333-8333-333333333333');
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  PERFORM public.send_post_for_approval('e1000000-0000-4000-8000-000000000001');
  RAISE EXCEPTION 'FAIL: a Member sent a Deliverable for approval';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;
RESET ROLE;

-- ── Owner: refusals ───────────────────────────────────────────────────────
SELECT pg_temp.act_as('11111111-1111-4111-8111-111111111111');
SET LOCAL ROLE authenticated;
SELECT pg_temp.expect_refusal(
  $q$SELECT public.send_post_for_approval('e1000000-0000-4000-8000-000000000002')$q$,
  'SUBMITTED', 'a SUBMITTED Version was sent for approval');
SELECT pg_temp.expect_refusal(
  $q$SELECT public.send_post_for_approval('e1000000-0000-4000-8000-000000000009')$q$,
  'active approval', 'a second Version of a Deliverable already in approval was sent');
SELECT pg_temp.expect_refusal(
  $q$SELECT public.send_post_for_approval('e1000000-0000-4000-8000-000000000007')$q$,
  'content', 'a Version without content was sent for approval');
RESET ROLE;

UPDATE clients SET email = '' WHERE id = 'c1111111-1111-4111-8111-111111111111';
SET LOCAL ROLE authenticated;
SELECT pg_temp.expect_refusal(
  $q$SELECT public.send_post_for_approval('e1000000-0000-4000-8000-000000000001')$q$,
  'no email', 'a Deliverable was sent for approval to a Client with no email');
RESET ROLE;
UPDATE clients SET email = 'delivered+acme@resend.dev' WHERE id = 'c1111111-1111-4111-8111-111111111111';

DO $$
BEGIN
  IF (SELECT count(*) FROM pg_temp.approval_emails()) <> 0 OR (SELECT count(*) FROM t_flag_seen) <> 0 THEN
    RAISE EXCEPTION 'FAIL: a refused call wrote or queued an email';
  END IF;
END $$;

-- ── Owner: sends a DRAFT ──────────────────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT public.send_post_for_approval('e1000000-0000-4000-8000-000000000001');
RESET ROLE;

DO $$
BEGIN
  IF (SELECT status FROM post_versions WHERE id = 'e1000000-0000-4000-8000-000000000001') <> 'PENDING_APPROVAL' THEN
    RAISE EXCEPTION 'FAIL: the Owner could not send a DRAFT for approval';
  END IF;
  IF (SELECT array_agg(e -> 'record' ->> 'id') FROM pg_temp.approval_emails() e)
     IS DISTINCT FROM ARRAY['e1000000-0000-4000-8000-000000000001'] THEN
    RAISE EXCEPTION 'FAIL: sending for approval did not queue exactly one approval email: %',
      (SELECT array_agg(e) FROM pg_temp.approval_emails() e);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM notifications
    WHERE entity_id = 'd1000000-0000-4000-8000-000000000001' AND type = 'post_status_changed'
      AND recipient_user_id = '33333333-3333-4333-8333-333333333333'
      AND title = 'Your deliverable was sent for client approval'
  ) THEN
    RAISE EXCEPTION 'FAIL: the creator was not told';
  END IF;
END $$;

-- ── Admin: sends a READY Version ──────────────────────────────────────────
UPDATE post_versions SET status = 'READY' WHERE id = 'e1000000-0000-4000-8000-000000000002';
DELETE FROM t_flag_seen WHERE version_id = 'e1000000-0000-4000-8000-000000000002';

SELECT pg_temp.act_as('22222222-2222-4222-8222-222222222222');
SET LOCAL ROLE authenticated;
SELECT public.send_post_for_approval('e1000000-0000-4000-8000-000000000002');
RESET ROLE;

DO $$
BEGIN
  IF (SELECT status FROM post_versions WHERE id = 'e1000000-0000-4000-8000-000000000002') <> 'PENDING_APPROVAL' THEN
    RAISE EXCEPTION 'FAIL: the Admin could not send a READY Version for approval';
  END IF;
  IF (SELECT count(*) FROM pg_temp.approval_emails()) <> 2 THEN
    RAISE EXCEPTION 'FAIL: expected 2 queued approval emails';
  END IF;
  IF (SELECT count(*) FROM t_flag_seen) <> 2 OR EXISTS (SELECT 1 FROM t_flag_seen WHERE flag IS DISTINCT FROM 'on') THEN
    RAISE EXCEPTION 'FAIL: a send wrote without the transition flag set: %', (SELECT array_agg(flag) FROM t_flag_seen);
  END IF;
END $$;

\echo 'send_for_approval: all assertions passed'
ROLLBACK;
