-- Follow-ups from #179: review links are written only by the service role and
-- read only by Owner/Admin, and campaign analytics counts each post and
-- invoice once. Self-checking and self-cleaning: runs in a transaction that
-- is rolled back, and raises on the first failure.
--
--   docker exec -i supabase_db_tercero psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/review_links_and_analytics.test.sql
--
-- Seeded Northwind Social: owner 1111…, admin 2222…, member 3333….
-- e1…0003 is PENDING_APPROVAL (a Client decision is waiting on it).

\set ON_ERROR_STOP 1
BEGIN;

INSERT INTO share_tokens (post_version_id, token) VALUES ('e1000000-0000-4000-8000-000000000003', 'tok-links');

CREATE FUNCTION pg_temp.act_as(p_uid uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
$$;

-- ── A Member can't mint, rotate or read a review link ─────────────────────
SELECT pg_temp.act_as('33333333-3333-4333-8333-333333333333');
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  BEGIN
    INSERT INTO share_tokens (post_version_id, token) VALUES ('e1000000-0000-4000-8000-000000000003', 'member-made');
    RAISE EXCEPTION 'FAIL: a Member minted a review link';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE share_tokens SET is_active = false WHERE token = 'tok-links';
    RAISE EXCEPTION 'FAIL: a Member could write review links';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  IF EXISTS (SELECT 1 FROM share_tokens) THEN
    RAISE EXCEPTION 'FAIL: a Member can read review links (and so decide as the Client)';
  END IF;
END $$;
RESET ROLE;

-- ── The Admin reads them, but can't write them either ─────────────────────
SELECT pg_temp.act_as('22222222-2222-4222-8222-222222222222');
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM share_tokens WHERE token = 'tok-links') THEN
    RAISE EXCEPTION 'FAIL: the Admin can no longer read their workspace''s review links';
  END IF;
  BEGIN
    INSERT INTO share_tokens (post_version_id) VALUES ('e1000000-0000-4000-8000-000000000003');
    RAISE EXCEPTION 'FAIL: the Admin minted a review link from the browser';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;

DO $$
BEGIN
  IF NOT (SELECT is_active FROM share_tokens WHERE token = 'tok-links') THEN
    RAISE EXCEPTION 'FAIL: a refused write changed the link';
  END IF;
  IF has_function_privilege('authenticated', 'public.generate_version_token(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: users can mint links through generate_version_token';
  END IF;
END $$;

-- ── Campaign analytics: 3 posts and 2 invoices, each counted once ─────────
INSERT INTO campaigns (id, user_id, client_id, name, budget)
VALUES ('ca000000-0000-4000-8000-0000000000a1', '11111111-1111-4111-8111-111111111111',
        'c1111111-1111-4111-8111-111111111111', 'Spring push', 9000);
UPDATE posts SET campaign_id = 'ca000000-0000-4000-8000-0000000000a1'
WHERE id IN ('d1000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000002',
             'd1000000-0000-4000-8000-000000000003');
INSERT INTO invoices (user_id, client_id, invoice_number, due_date, status, total, campaign_id) VALUES
  ('11111111-1111-4111-8111-111111111111', 'c1111111-1111-4111-8111-111111111111', 'T-A1', CURRENT_DATE, 'PAID', 1000, 'ca000000-0000-4000-8000-0000000000a1'),
  ('11111111-1111-4111-8111-111111111111', 'c1111111-1111-4111-8111-111111111111', 'T-A2', CURRENT_DATE, 'SENT', 500,  'ca000000-0000-4000-8000-0000000000a1');

SELECT pg_temp.act_as('11111111-1111-4111-8111-111111111111');
SET LOCAL ROLE authenticated;
DO $$
DECLARE
  r record;
BEGIN
  SELECT * INTO r FROM public.get_campaign_analytics('ca000000-0000-4000-8000-0000000000a1');
  IF r.total_posts <> 3 THEN
    RAISE EXCEPTION 'FAIL: expected 3 posts, got %', r.total_posts;
  END IF;
  IF r.total_invoiced <> 1500 OR r.total_collected <> 1000 THEN
    RAISE EXCEPTION 'FAIL: expected 1500 invoiced / 1000 collected, got % / %', r.total_invoiced, r.total_collected;
  END IF;
  IF r.budget <> 9000 THEN
    RAISE EXCEPTION 'FAIL: budget %', r.budget;
  END IF;
  -- e1…0001 {instagram}, 0002 {instagram,facebook}, 0003 {instagram}
  IF r.platform_distribution <> '{"instagram": 3, "facebook": 1}'::jsonb THEN
    RAISE EXCEPTION 'FAIL: platform distribution %', r.platform_distribution;
  END IF;
END $$;
RESET ROLE;

\echo 'review_links_and_analytics: all assertions passed'
ROLLBACK;
