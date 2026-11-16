-- Self-checking test for the status vocabulary (ADR 0006, #141–#145).
-- Runs against a migrated database (after `npx supabase db reset`) inside a
-- transaction that is always rolled back:
--   docker exec -i supabase_db_tercero psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/status_vocabulary.test.sql
\set ON_ERROR_STOP 1
BEGIN;

-- ── Every status column is text with a CHECK, and no enum is left ─────────
DO $$
DECLARE
  c text;
BEGIN
  FOREACH c IN ARRAY ARRAY[
    'post_versions_status_check', 'transactions_status_check', 'tasks_status_check',
    'tasks_priority_check', 'invoices_status_check', 'clients_status_check',
    'prospects_status_check'
  ] LOOP
    ASSERT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = c AND contype = 'c'), 'missing CHECK ' || c;
  END LOOP;
  ASSERT NOT EXISTS (SELECT 1 FROM pg_type WHERE typname IN ('post_status', 'transaction_status')),
    'a status enum type still exists';
  RAISE NOTICE 'PASS: CHECKs present, no status enums';
END $$;

-- ── Deliverables (#141) ──────────────────────────────────────────────────
DO $$
BEGIN
  -- The CHECK on its own (the transition trigger would fire first).
  ALTER TABLE post_versions DISABLE TRIGGER trg_post_version_status_transition;
  BEGIN
    UPDATE post_versions SET status = 'BOGUS' WHERE id = 'e1000000-0000-4000-8000-000000000001';
    RAISE EXCEPTION 'unknown Deliverable status accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  ALTER TABLE post_versions ENABLE TRIGGER trg_post_version_status_transition;

  -- The transition trigger still guards the flow.
  BEGIN
    UPDATE post_versions SET status = 'PUBLISHED' WHERE id = 'e1000000-0000-4000-8000-000000000001';
    RAISE EXCEPTION 'DRAFT -> PUBLISHED accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'Invalid post status transition%' THEN RAISE; END IF;
  END;
  UPDATE post_versions SET status = 'SUBMITTED' WHERE id = 'e1000000-0000-4000-8000-000000000001';

  -- Client approval through a review link.
  INSERT INTO share_tokens (post_version_id, token) VALUES ('e1000000-0000-4000-8000-000000000003', 'test-tok');
  PERFORM update_post_status_by_token('test-tok', 'SCHEDULED', 'looks good');
  ASSERT (SELECT status FROM post_versions WHERE id = 'e1000000-0000-4000-8000-000000000003') = 'SCHEDULED',
    'review-link approval did not schedule';

  -- Reads that used to return or cast the enum.
  ASSERT (SELECT count(*) FROM get_global_calendar('11111111-1111-4111-8111-111111111111',
          now() - interval '5 years', now() + interval '5 years')) > 0, 'calendar returned nothing';
  PERFORM * FROM get_campaigns_with_post_summary('11111111-1111-4111-8111-111111111111');
  PERFORM * FROM client_pipeline_analytics;
  RAISE NOTICE 'PASS: Deliverable statuses';
END $$;

-- ── Transactions (#141) ──────────────────────────────────────────────────
DO $$
BEGIN
  BEGIN
    INSERT INTO transactions (user_id, status) VALUES ('11111111-1111-4111-8111-111111111111', 'paid');
    RAISE EXCEPTION 'lowercase transaction status accepted';
  EXCEPTION WHEN check_violation OR not_null_violation THEN NULL; END;
  RAISE NOTICE 'PASS: transaction statuses';
END $$;

-- ── Prospects (#143) ─────────────────────────────────────────────────────
DO $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO prospects (user_id, business_name)
  VALUES ('11111111-1111-4111-8111-111111111111', 'Test prospect') RETURNING id INTO v_id;
  ASSERT (SELECT status FROM prospects WHERE id = v_id) = 'NEW', 'default is not NEW';

  BEGIN
    UPDATE prospects SET status = 'demo_scheduled' WHERE id = v_id;
    RAISE EXCEPTION 'old stage name accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;

  UPDATE prospects SET status = 'PROPOSAL_SENT' WHERE id = v_id;
  INSERT INTO proposals (agency_user_id, title, status, prospect_id, share_token)
  VALUES ('11111111-1111-4111-8111-111111111111', 'Test proposal', 'sent', v_id, 'test-ptok');

  -- The Client asks for changes, then accepts: the Prospect follows, and each move is logged.
  PERFORM request_proposal_changes('test-ptok', 'smaller scope');
  ASSERT (SELECT status FROM prospects WHERE id = v_id) = 'CHANGES_REQUESTED', 'changes did not move prospect';
  UPDATE proposals SET status = 'sent' WHERE share_token = 'test-ptok';
  PERFORM accept_proposal('test-ptok');
  ASSERT (SELECT status FROM prospects WHERE id = v_id) = 'PROPOSAL_ACCEPTED', 'accept did not move prospect';
  ASSERT EXISTS (SELECT 1 FROM prospect_activities
                 WHERE prospect_id = v_id AND metadata->>'from_status' = 'CHANGES_REQUESTED'
                   AND metadata->>'to_status' = 'PROPOSAL_ACCEPTED'),
    'stage change not logged with the new values';
  ASSERT prospect_status_label('DISCOVERY_CALL') = 'Discovery Call', 'label function';
  RAISE NOTICE 'PASS: Prospect stages';
END $$;

ROLLBACK;
