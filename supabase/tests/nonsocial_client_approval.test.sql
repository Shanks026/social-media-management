-- #167 regression test: a Client can approve a non-social Deliverable through
-- its review link, and the agency is told, as for a Social deliverable.
-- Self-checking and self-cleaning: runs in a transaction that is rolled back,
-- and raises on the first failed assertion.
--
--   docker exec -i supabase_db_tercero psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/nonsocial_client_approval.test.sql
--
-- Uses the seeded Acme Coffee DRAFT (e1000000-…-0001, owner 1111…), turned
-- into a non-social Deliverable (no platforms) and sent for Client approval.

\set ON_ERROR_STOP 1
BEGIN;

UPDATE post_versions SET platform = '{}'
WHERE id = 'e1000000-0000-4000-8000-000000000001';
SELECT set_config('tercero.deliverable_transition', 'on', true);  -- fixtures stand in for history (#178)
UPDATE post_versions SET status = 'PENDING_APPROVAL'
WHERE id = 'e1000000-0000-4000-8000-000000000001';
SELECT set_config('tercero.deliverable_transition', '', true);

INSERT INTO share_tokens (post_version_id, token)
VALUES ('e1000000-0000-4000-8000-000000000001', 'test-token-167');

-- ── The Client approves from the review link (anonymous) ─────────────────
SET LOCAL ROLE anon;
SELECT public.submit_review_decision('test-token-167', 'APPROVE', NULL);
RESET ROLE;

DO $$
DECLARE
  v_post uuid;
BEGIN
  IF (SELECT status FROM post_versions WHERE id = 'e1000000-0000-4000-8000-000000000001') <> 'APPROVED' THEN
    RAISE EXCEPTION 'FAIL: the non-social Deliverable did not end APPROVED';
  END IF;

  IF (SELECT is_active FROM share_tokens WHERE token = 'test-token-167') THEN
    RAISE EXCEPTION 'FAIL: the review link is still active after use';
  END IF;

  SELECT post_id INTO v_post FROM post_versions WHERE id = 'e1000000-0000-4000-8000-000000000001';
  IF NOT EXISTS (
    SELECT 1 FROM notifications
    WHERE entity_id = v_post AND type = 'campaign_reviewed'
      AND title = 'Client approved a deliverable'
  ) THEN
    RAISE EXCEPTION 'FAIL: the agency got no in-app notification for the approval';
  END IF;
END $$;

-- ── The transition table still refuses skipping straight to DELIVERED ────
DO $$
BEGIN
  -- With the flag on, only the transition table stands in the way.
  PERFORM set_config('tercero.deliverable_transition', 'on', true);
  UPDATE post_versions SET status = 'PENDING_APPROVAL', platform = '{}'
  WHERE id = 'e1000000-0000-4000-8000-000000000009';
  BEGIN
    UPDATE post_versions SET status = 'DELIVERED'
    WHERE id = 'e1000000-0000-4000-8000-000000000009';
    RAISE EXCEPTION 'FAIL: PENDING_APPROVAL → DELIVERED was allowed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FAIL:%' THEN RAISE; END IF;
  END;
END $$;

\echo 'nonsocial_client_approval: all assertions passed'
ROLLBACK;
