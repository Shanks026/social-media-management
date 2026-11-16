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
    'prospects_status_check', 'proposals_status_check', 'campaigns_status_check',
    'client_documents_status_check'
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
  VALUES ('11111111-1111-4111-8111-111111111111', 'Test proposal', 'SENT', v_id, 'test-ptok');

  -- The Client asks for changes, then accepts: the Prospect follows, and each move is logged.
  PERFORM request_proposal_changes('test-ptok', 'smaller scope');
  ASSERT (SELECT status FROM prospects WHERE id = v_id) = 'CHANGES_REQUESTED', 'changes did not move prospect';
  UPDATE proposals SET status = 'SENT' WHERE share_token = 'test-ptok';
  PERFORM accept_proposal('test-ptok');
  ASSERT (SELECT status FROM prospects WHERE id = v_id) = 'PROPOSAL_ACCEPTED', 'accept did not move prospect';
  ASSERT EXISTS (SELECT 1 FROM prospect_activities
                 WHERE prospect_id = v_id AND metadata->>'from_status' = 'CHANGES_REQUESTED'
                   AND metadata->>'to_status' = 'PROPOSAL_ACCEPTED'),
    'stage change not logged with the new values';
  ASSERT prospect_status_label('DISCOVERY_CALL') = 'Discovery Call', 'label function';
  RAISE NOTICE 'PASS: Prospect stages';
END $$;

-- ── Proposals (#144) ─────────────────────────────────────────────────────
DO $$
DECLARE
  ws constant uuid := '11111111-1111-4111-8111-111111111111';
  v_id uuid;
BEGIN
  INSERT INTO proposals (agency_user_id, title) VALUES (ws, 'Default check') RETURNING id INTO v_id;
  ASSERT (SELECT status FROM proposals WHERE id = v_id) = 'DRAFT', 'default is not DRAFT';

  BEGIN
    UPDATE proposals SET status = 'sent' WHERE id = v_id;
    RAISE EXCEPTION 'lowercase Proposal status accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    UPDATE proposals SET status = 'EXPIRED' WHERE id = v_id;
    RAISE EXCEPTION 'EXPIRED stored';
  EXCEPTION WHEN check_violation THEN NULL; END;

  -- The public review flow: viewed, then declined.
  INSERT INTO proposals (agency_user_id, title, status, share_token)
  VALUES (ws, 'Review flow', 'SENT', 'test-flow') RETURNING id INTO v_id;
  PERFORM mark_proposal_viewed('test-flow');
  ASSERT (SELECT status FROM proposals WHERE id = v_id) = 'VIEWED', 'viewed not recorded';
  ASSERT (SELECT status FROM get_proposal_by_token('test-flow')) = 'VIEWED', 'by-token status';
  PERFORM decline_proposal('test-flow', 'too pricey');
  ASSERT (SELECT status FROM proposals WHERE id = v_id) = 'DECLINED', 'decline not recorded';
  PERFORM accept_proposal('test-flow');
  ASSERT (SELECT status FROM proposals WHERE id = v_id) = 'DECLINED', 'a decided Proposal was re-decided';

  -- Expired is computed for an outstanding Proposal past valid_until, never for a draft.
  INSERT INTO proposals (agency_user_id, title, status, valid_until) VALUES
    (ws, 'Lapsed', 'SENT', CURRENT_DATE - 1),
    (ws, 'Old draft', 'DRAFT', CURRENT_DATE - 1);
  ASSERT (SELECT status FROM get_proposals_with_totals(ws) WHERE title = 'Lapsed') = 'EXPIRED', 'lapsed not EXPIRED';
  ASSERT (SELECT status FROM get_proposals_with_totals(ws) WHERE title = 'Old draft') = 'DRAFT', 'draft expired';
  RAISE NOTICE 'PASS: Proposal statuses';
END $$;

-- ── Campaigns and client documents (#145) ────────────────────────────────
DO $$
DECLARE
  ws constant uuid := '11111111-1111-4111-8111-111111111111';
  acme constant uuid := 'c1111111-1111-4111-8111-111111111111';
  v_id uuid;
BEGIN
  INSERT INTO campaigns (user_id, client_id, name) VALUES (ws, acme, 'Test campaign') RETURNING id INTO v_id;
  ASSERT (SELECT status FROM campaigns WHERE id = v_id) = 'ACTIVE', 'campaign default is not ACTIVE';
  ASSERT (SELECT (e->>'active_campaigns')::int FROM jsonb_array_elements(get_clients_with_pipeline(ws)->'clients') e
          WHERE (e->>'id')::uuid = acme) >= 1,
    'pipeline does not count the active Campaign';
  UPDATE campaigns SET status = 'COMPLETED' WHERE id = v_id;
  BEGIN
    UPDATE campaigns SET status = 'Active' WHERE id = v_id;
    RAISE EXCEPTION 'Title-case Campaign status accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;

  INSERT INTO client_documents (user_id, client_id, display_name, original_filename, storage_path, file_size_bytes, mime_type)
  VALUES (ws, acme, 'Brief', 'brief.pdf', 'test/brief.pdf', 10, 'application/pdf') RETURNING id INTO v_id;
  ASSERT (SELECT status FROM client_documents WHERE id = v_id) = 'ACTIVE', 'document default is not ACTIVE';
  UPDATE client_documents SET status = 'ARCHIVED' WHERE id = v_id;
  BEGIN
    UPDATE client_documents SET status = 'Archived' WHERE id = v_id;
    RAISE EXCEPTION 'Title-case document status accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  RAISE NOTICE 'PASS: Campaign and document statuses';
END $$;

ROLLBACK;
