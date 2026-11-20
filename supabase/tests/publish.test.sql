-- #174 test: publishing goes through mark_published() / mark_platform_published()
-- (ADR 0004). An Owner or Admin of the Deliverable's workspace, or the system
-- (service role), may publish; a Member may not. A per-platform Deliverable is
-- published one platform at a time, and the last one makes it PUBLISHED. Every
-- publish queues the Client's "published" email through pg_net.
-- Self-checking and self-cleaning: runs in a transaction that is rolled back
-- (so the queued requests are never sent), and raises on the first failure.
--
--   docker exec -i supabase_db_tercero psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/publish.test.sql
--
-- Uses the seeded Northwind Social workspace (owner 1111…, admin 2222…,
-- member 3333…) and an outsider (9999…) who owns a workspace of their own.
--   e1…0001  Acme Coffee, created by the Member → SCHEDULED per-platform (Instagram + Facebook)
--   e1…0005  Brightline, SCHEDULED single-date Instagram
--   e1…0009  Acme Coffee, DRAFT

\set ON_ERROR_STOP 1
BEGIN;

INSERT INTO auth.users (id, instance_id, aud, role, email)
VALUES ('99999999-9999-4999-8999-999999999999', '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'delivered+outsider@resend.dev');

UPDATE post_versions
SET platform = '{instagram,facebook}',
    platform_schedules = jsonb_build_object(
      'instagram', jsonb_build_object('scheduled_at', '2026-12-20T09:00:00Z'),
      'facebook',  jsonb_build_object('scheduled_at', '2026-12-21T09:00:00Z')),
    status = 'SCHEDULED'
WHERE id = 'e1000000-0000-4000-8000-000000000001';

-- Only requests queued by this test count.
CREATE TEMP TABLE t_queue_start AS SELECT coalesce(max(id), 0) AS id FROM net.http_request_queue;
CREATE FUNCTION pg_temp.published_emails() RETURNS SETOF jsonb LANGUAGE sql AS $$
  SELECT convert_from(q.body, 'utf8')::jsonb
  FROM net.http_request_queue q
  WHERE q.id > (SELECT id FROM t_queue_start)
    AND q.url LIKE '%/functions/v1/send-platform-published-email'
  ORDER BY q.id;
$$;

-- Record the transition flag as the status trigger would see it.
CREATE TEMP TABLE t_flag_seen (version_id uuid, flag text);
CREATE FUNCTION pg_temp.record_flag() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO t_flag_seen VALUES (NEW.id, current_setting('tercero.deliverable_transition', true));
  RETURN NEW;
END $$;
CREATE TRIGGER t_record_flag BEFORE UPDATE OF status, platform_schedules, published_at ON post_versions
  FOR EACH ROW EXECUTE FUNCTION pg_temp.record_flag();
GRANT INSERT ON t_flag_seen TO authenticated, service_role;

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
  IF has_function_privilege('anon', 'public.mark_published(uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.mark_platform_published(uuid, text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: anon can publish';
  END IF;
  IF has_function_privilege('authenticated', 'public.queue_edge_function(text, jsonb)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.assert_deliverable_admin(uuid, text, boolean)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: users can execute an internal helper';
  END IF;
END $$;

-- ── Outsider: another workspace's Deliverable is not found ────────────────
SELECT pg_temp.act_as('99999999-9999-4999-8999-999999999999');
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  PERFORM public.mark_published('e1000000-0000-4000-8000-000000000005');
  RAISE EXCEPTION 'FAIL: an outsider published another workspace''s Deliverable';
EXCEPTION WHEN no_data_found THEN NULL;
END $$;
RESET ROLE;

-- ── Member: refused for both ──────────────────────────────────────────────
SELECT pg_temp.act_as('33333333-3333-4333-8333-333333333333');
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  PERFORM public.mark_published('e1000000-0000-4000-8000-000000000005');
  RAISE EXCEPTION 'FAIL: a Member published a Deliverable';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;
DO $$
BEGIN
  PERFORM public.mark_platform_published('e1000000-0000-4000-8000-000000000001', 'instagram');
  RAISE EXCEPTION 'FAIL: a Member published a platform';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;
RESET ROLE;

-- ── Owner: refusals ───────────────────────────────────────────────────────
SELECT pg_temp.act_as('11111111-1111-4111-8111-111111111111');
SET LOCAL ROLE authenticated;
SELECT pg_temp.expect_refusal(
  $q$SELECT public.mark_published('e1000000-0000-4000-8000-000000000009')$q$,
  'DRAFT', 'a DRAFT Version was published');
SELECT pg_temp.expect_refusal(
  $q$SELECT public.mark_platform_published('e1000000-0000-4000-8000-000000000005', 'instagram')$q$,
  'per-platform', 'a platform was published on a single-date Deliverable');
SELECT pg_temp.expect_refusal(
  $q$SELECT public.mark_platform_published('e1000000-0000-4000-8000-000000000001', 'tiktok')$q$,
  'tiktok', 'a platform the Deliverable isn''t scheduled on was published');

-- ── Owner: first platform (partial publish) ───────────────────────────────
DO $$
BEGIN
  IF public.mark_platform_published('e1000000-0000-4000-8000-000000000001', 'instagram') THEN
    RAISE EXCEPTION 'FAIL: one of two platforms reported the Deliverable fully published';
  END IF;
END $$;
SELECT pg_temp.expect_refusal(
  $q$SELECT public.mark_platform_published('e1000000-0000-4000-8000-000000000001', 'instagram')$q$,
  'already', 'a platform was published twice');
RESET ROLE;

DO $$
DECLARE
  v record;
BEGIN
  SELECT status, published_at, platform_schedules INTO v
  FROM post_versions WHERE id = 'e1000000-0000-4000-8000-000000000001';
  IF v.status <> 'SCHEDULED' OR v.published_at IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: a partial publish changed the status (%)', v.status;
  END IF;
  IF v.platform_schedules #>> '{instagram,published_at}' IS NULL
     OR v.platform_schedules #>> '{facebook,published_at}' IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: the wrong platforms are marked published: %', v.platform_schedules;
  END IF;
  IF v.platform_schedules #>> '{instagram,scheduled_at}' <> '2026-12-20T09:00:00Z' THEN
    RAISE EXCEPTION 'FAIL: publishing a platform lost its scheduled_at';
  END IF;
  IF (SELECT array_agg(e ORDER BY e::text) FROM pg_temp.published_emails() e)
     IS DISTINCT FROM ARRAY[jsonb_build_object('post_version_id', 'e1000000-0000-4000-8000-000000000001',
                                               'platform', 'instagram', 'all_published', false)] THEN
    RAISE EXCEPTION 'FAIL: the partial publish did not queue exactly one email: %',
      (SELECT array_agg(e) FROM pg_temp.published_emails() e);
  END IF;
END $$;

-- ── Admin: last platform publishes the Deliverable ────────────────────────
SELECT pg_temp.act_as('22222222-2222-4222-8222-222222222222');
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  IF NOT public.mark_platform_published('e1000000-0000-4000-8000-000000000001', 'facebook') THEN
    RAISE EXCEPTION 'FAIL: the last platform did not report the Deliverable published';
  END IF;
END $$;
RESET ROLE;

DO $$
BEGIN
  IF (SELECT status FROM post_versions WHERE id = 'e1000000-0000-4000-8000-000000000001') <> 'PUBLISHED'
     OR (SELECT published_at FROM post_versions WHERE id = 'e1000000-0000-4000-8000-000000000001') IS NULL THEN
    RAISE EXCEPTION 'FAIL: the last platform did not make the Deliverable PUBLISHED';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_temp.published_emails() e
    WHERE e = jsonb_build_object('post_version_id', 'e1000000-0000-4000-8000-000000000001',
                                 'platform', 'facebook', 'all_published', true)
  ) THEN
    RAISE EXCEPTION 'FAIL: the full publish queued no all-published email';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM notifications
    WHERE entity_id = 'd1000000-0000-4000-8000-000000000001' AND type = 'post_status_changed'
      AND recipient_user_id = '33333333-3333-4333-8333-333333333333'
      AND actor_user_id = '22222222-2222-4222-8222-222222222222'
      AND title = 'Your deliverable was published'
  ) THEN
    RAISE EXCEPTION 'FAIL: the creator was not told the Deliverable was published';
  END IF;
END $$;

-- ── The system (service role) publishes a single-date Deliverable ─────────
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);
SET LOCAL ROLE service_role;
SELECT public.mark_published('e1000000-0000-4000-8000-000000000005');
RESET ROLE;

DO $$
BEGIN
  IF (SELECT status FROM post_versions WHERE id = 'e1000000-0000-4000-8000-000000000005') <> 'PUBLISHED'
     OR (SELECT published_at FROM post_versions WHERE id = 'e1000000-0000-4000-8000-000000000005') IS NULL THEN
    RAISE EXCEPTION 'FAIL: the system could not publish a SCHEDULED Deliverable';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_temp.published_emails() e
    WHERE e = jsonb_build_object('post_version_id', 'e1000000-0000-4000-8000-000000000005',
                                 'platform', NULL, 'all_published', true)
  ) THEN
    RAISE EXCEPTION 'FAIL: the system publish queued no email';
  END IF;
  IF (SELECT count(*) FROM pg_temp.published_emails()) <> 3 THEN
    RAISE EXCEPTION 'FAIL: expected 3 queued emails, got %', (SELECT count(*) FROM pg_temp.published_emails());
  END IF;

  -- The trigger was created after setup, so every row here is a publish write.
  IF (SELECT count(*) FROM t_flag_seen) <> 3
     OR EXISTS (SELECT 1 FROM t_flag_seen WHERE flag IS DISTINCT FROM 'on') THEN
    RAISE EXCEPTION 'FAIL: a publish wrote without the transition flag set: %',
      (SELECT array_agg(flag) FROM t_flag_seen);
  END IF;
  IF current_setting('tercero.deliverable_transition', true) = 'on' THEN
    RAISE EXCEPTION 'FAIL: the transition flag stayed on after the call';
  END IF;
END $$;

\echo 'publish: all assertions passed'
ROLLBACK;
