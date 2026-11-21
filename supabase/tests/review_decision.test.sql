-- #176 test: a Client's answer on a review link is a decision (ADR 0004).
-- The anonymous link holder sends APPROVE or REQUEST_REVISIONS, and the
-- database decides the status; through either signature it can reach no
-- status but SCHEDULED, APPROVED (non-social) or NEEDS_REVISION.
-- Self-checking and self-cleaning: runs in a transaction that is rolled back
-- (so the queued requests are never sent), and raises on the first failure.
--
--   docker exec -i supabase_db_tercero psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/review_decision.test.sql
--
-- Uses the seeded Northwind Social workspace (owner 1111…, admin 2222…, member 3333…):
--   e1…0003  Loyalty card launch, Social, PENDING_APPROVAL, created by the Admin → approved
--   e1…0001  Acme Coffee, made non-social and PENDING_APPROVAL → approved through the old signature
--   e1…0002  Acme Coffee, Social, taken to PENDING_APPROVAL, created by the Member → revisions
--   e1…0005  SCHEDULED → its link decides nothing

\set ON_ERROR_STOP 1
BEGIN;

-- Fixtures (raw writes, as postgres; the transition trigger still applies).
UPDATE post_versions SET platform = '{}' WHERE id = 'e1000000-0000-4000-8000-000000000001';
UPDATE post_versions SET status = 'PENDING_APPROVAL' WHERE id = 'e1000000-0000-4000-8000-000000000001';
UPDATE post_versions SET status = 'READY' WHERE id = 'e1000000-0000-4000-8000-000000000002';
UPDATE post_versions SET status = 'PENDING_APPROVAL' WHERE id = 'e1000000-0000-4000-8000-000000000002';

INSERT INTO share_tokens (post_version_id, token) VALUES
  ('e1000000-0000-4000-8000-000000000003', 'tok-176-social'),
  ('e1000000-0000-4000-8000-000000000001', 'tok-176-nonsocial'),
  ('e1000000-0000-4000-8000-000000000002', 'tok-176-revise'),
  ('e1000000-0000-4000-8000-000000000005', 'tok-176-scheduled');
INSERT INTO share_tokens (post_version_id, token, expires_at) VALUES
  ('e1000000-0000-4000-8000-000000000002', 'tok-176-expired', now() - interval '1 day');

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
GRANT INSERT ON t_flag_seen TO anon;

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
GRANT EXECUTE ON FUNCTION pg_temp.expect_refusal(text, text, text) TO anon;

-- ── Privileges ────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT has_function_privilege('anon', 'public.submit_review_decision(text, text, text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: anon cannot send a review decision';
  END IF;
  IF has_function_privilege('anon', 'public.deliverable_event(uuid, text, jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: anon can call deliverable_event directly';
  END IF;
END $$;

-- ── Anonymous: no other status, through either signature ──────────────────
SET LOCAL ROLE anon;

SELECT pg_temp.expect_refusal(
  format('SELECT public.submit_review_decision(%L, %L, NULL)', 'tok-176-revise', d),
  'APPROVE or REQUEST_REVISIONS', format('the new signature accepted the decision %s', d))
FROM unnest(ARRAY['ARCHIVED', 'SCHEDULED', 'APPROVED', 'NEEDS_REVISION', 'PUBLISHED',
                  'DELIVERED', 'DRAFT', 'approve', '']) AS d;
SELECT pg_temp.expect_refusal(
  $q$SELECT public.submit_review_decision('tok-176-revise', NULL, NULL)$q$,
  'APPROVE or REQUEST_REVISIONS', 'the new signature accepted no decision');

SELECT pg_temp.expect_refusal(
  format('SELECT public.update_post_status_by_token(%L, %L, NULL)', 'tok-176-revise', s),
  'only approve or request revisions', format('the old signature set %s', s))
FROM unnest(ARRAY['DRAFT', 'SUBMITTED', 'CHANGES_REQUESTED', 'READY', 'PENDING_APPROVAL',
                  'PUBLISHED', 'DELIVERED', 'ARCHIVED', 'APPROVE', 'REQUEST_REVISIONS']) AS s;

-- A link whose Version isn't awaiting approval decides nothing.
SELECT pg_temp.expect_refusal(
  $q$SELECT public.submit_review_decision('tok-176-scheduled', 'REQUEST_REVISIONS', 'x')$q$,
  'SCHEDULED', 'a SCHEDULED Version was sent back for revisions');
SELECT pg_temp.expect_refusal(
  $q$SELECT public.update_post_status_by_token('tok-176-scheduled', 'NEEDS_REVISION', 'x')$q$,
  'SCHEDULED', 'a SCHEDULED Version was sent back through the old signature');
SELECT pg_temp.expect_refusal(
  $q$SELECT public.submit_review_decision('tok-176-expired', 'APPROVE', NULL)$q$,
  'Invalid or expired token', 'an expired link was used');
SELECT pg_temp.expect_refusal(
  $q$SELECT public.submit_review_decision('no-such-token', 'APPROVE', NULL)$q$,
  'Invalid or expired token', 'an unknown token was used');

RESET ROLE;

DO $$
BEGIN
  IF (SELECT status FROM post_versions WHERE id = 'e1000000-0000-4000-8000-000000000002') <> 'PENDING_APPROVAL'
     OR (SELECT status FROM post_versions WHERE id = 'e1000000-0000-4000-8000-000000000005') <> 'SCHEDULED' THEN
    RAISE EXCEPTION 'FAIL: a refused decision changed a status';
  END IF;
  IF NOT (SELECT is_active FROM share_tokens WHERE token = 'tok-176-revise')
     OR NOT (SELECT is_active FROM share_tokens WHERE token = 'tok-176-scheduled') THEN
    RAISE EXCEPTION 'FAIL: a refused decision used up its link';
  END IF;
  IF (SELECT count(*) FROM pg_temp.approval_emails()) <> 0 OR (SELECT count(*) FROM t_flag_seen) <> 0 THEN
    RAISE EXCEPTION 'FAIL: a refused decision wrote or queued an email';
  END IF;
END $$;

-- ── Social: APPROVE ends SCHEDULED ────────────────────────────────────────
SET LOCAL ROLE anon;
DO $$
BEGIN
  IF public.submit_review_decision('tok-176-social', 'APPROVE', NULL) <> 'SCHEDULED' THEN
    RAISE EXCEPTION 'FAIL: approving a Social deliverable did not return SCHEDULED';
  END IF;
END $$;
-- Single use.
SELECT pg_temp.expect_refusal(
  $q$SELECT public.submit_review_decision('tok-176-social', 'REQUEST_REVISIONS', 'changed my mind')$q$,
  'Invalid or expired token', 'a used link decided again');
RESET ROLE;

DO $$
BEGIN
  IF (SELECT status FROM post_versions WHERE id = 'e1000000-0000-4000-8000-000000000003') <> 'SCHEDULED' THEN
    RAISE EXCEPTION 'FAIL: the Social deliverable did not end SCHEDULED';
  END IF;
  IF (SELECT is_active FROM share_tokens WHERE token = 'tok-176-social') THEN
    RAISE EXCEPTION 'FAIL: the link is still active after use';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_temp.approval_emails() e
    WHERE e -> 'record' ->> 'id' = 'e1000000-0000-4000-8000-000000000003'
      AND e -> 'record' ->> 'status' = 'SCHEDULED'
  ) THEN
    RAISE EXCEPTION 'FAIL: no agency email was queued for the approval';
  END IF;
  -- The creator (the Admin) and the Owner are told.
  IF (SELECT array_agg(recipient_user_id::text ORDER BY recipient_user_id) FROM notifications
      WHERE entity_id = 'd1000000-0000-4000-8000-000000000003' AND type = 'campaign_reviewed'
        AND title = 'Client approved a deliverable')
     IS DISTINCT FROM ARRAY['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'] THEN
    RAISE EXCEPTION 'FAIL: the creator and the Owner were not both told of the approval';
  END IF;
END $$;

-- ── Non-social, old signature: even "SCHEDULED" ends APPROVED ─────────────
SET LOCAL ROLE anon;
SELECT public.update_post_status_by_token('tok-176-nonsocial', 'SCHEDULED', NULL);
RESET ROLE;

DO $$
BEGIN
  IF (SELECT status FROM post_versions WHERE id = 'e1000000-0000-4000-8000-000000000001') <> 'APPROVED' THEN
    RAISE EXCEPTION 'FAIL: the non-social deliverable did not end APPROVED';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_temp.approval_emails() e
    WHERE e -> 'record' ->> 'id' = 'e1000000-0000-4000-8000-000000000001'
      AND e -> 'record' ->> 'status' = 'APPROVED'
  ) THEN
    RAISE EXCEPTION 'FAIL: no agency email was queued for the non-social approval';
  END IF;
END $$;

-- ── REQUEST_REVISIONS ends NEEDS_REVISION, feedback saved ─────────────────
SET LOCAL ROLE anon;
DO $$
BEGIN
  IF public.submit_review_decision('tok-176-revise', 'REQUEST_REVISIONS', '  More punch in the hook  ')
     <> 'NEEDS_REVISION' THEN
    RAISE EXCEPTION 'FAIL: requesting revisions did not return NEEDS_REVISION';
  END IF;
END $$;
RESET ROLE;

DO $$
BEGIN
  IF (SELECT status FROM post_versions WHERE id = 'e1000000-0000-4000-8000-000000000002') <> 'NEEDS_REVISION' THEN
    RAISE EXCEPTION 'FAIL: the deliverable did not end NEEDS_REVISION';
  END IF;
  IF (SELECT client_notes FROM post_versions WHERE id = 'e1000000-0000-4000-8000-000000000002')
     IS DISTINCT FROM 'More punch in the hook' THEN
    RAISE EXCEPTION 'FAIL: the Client''s feedback was not saved';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_temp.approval_emails() e
    WHERE e -> 'record' ->> 'id' = 'e1000000-0000-4000-8000-000000000002'
      AND e -> 'record' ->> 'status' = 'NEEDS_REVISION'
  ) THEN
    RAISE EXCEPTION 'FAIL: no agency email was queued for the revision request';
  END IF;
  IF (SELECT array_agg(recipient_user_id::text ORDER BY recipient_user_id) FROM notifications
      WHERE entity_id = 'd1000000-0000-4000-8000-000000000002' AND type = 'campaign_reviewed'
        AND title = 'Client requested revisions')
     IS DISTINCT FROM ARRAY['11111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333333'] THEN
    RAISE EXCEPTION 'FAIL: the creator and the Owner were not both told of the revision request';
  END IF;
  -- Every write went through the helper, with the flag on.
  IF (SELECT count(*) FROM t_flag_seen) <> 3 OR EXISTS (SELECT 1 FROM t_flag_seen WHERE flag IS DISTINCT FROM 'on') THEN
    RAISE EXCEPTION 'FAIL: a decision wrote without the transition flag set: %', (SELECT array_agg(flag) FROM t_flag_seen);
  END IF;
  IF (SELECT count(*) FROM pg_temp.approval_emails()) <> 3 THEN
    RAISE EXCEPTION 'FAIL: expected exactly 3 queued agency emails';
  END IF;
END $$;

\echo 'review_decision: all assertions passed'
ROLLBACK;
