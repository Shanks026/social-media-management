-- #177 test: archiving a Deliverable goes through archive_deliverable()
-- (ADR 0004), and create_revision_version archives the Version it replaces
-- through the same helper. Self-checking and self-cleaning: runs in a
-- transaction that is rolled back, and raises on the first failure.
--
--   docker exec -i supabase_db_tercero psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/archive_deliverable.test.sql
--
-- Seeded Northwind Social workspace (owner 1111…, admin 2222…, member 3333…)
-- and an outsider (9999…) with a workspace of their own. Creators are
-- posts.created_by:
--   e1…0001  DRAFT, the Member's            → the Member archives it
--   e1…0002  SUBMITTED, the Member's        → the Member archives it
--   e1…0003  PENDING_APPROVAL, the Admin's  → Member refused (not theirs); the Owner archives it
--   e1…0007  DRAFT (internal), the Member's → taken to READY: Member refused (later status)
--   e1…0005  SCHEDULED, the Owner's         → the Admin archives it
--   e1…0006  PUBLISHED                      → nobody can archive it
--   e1…0004  NEEDS_REVISION                 → revised: old archived, new DRAFT by the caller

\set ON_ERROR_STOP 1
BEGIN;

INSERT INTO auth.users (id, instance_id, aud, role, email)
VALUES ('99999999-9999-4999-8999-999999999999', '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'delivered+outsider@resend.dev');

SELECT set_config('tercero.deliverable_transition', 'on', true);  -- fixtures stand in for history (#178)
UPDATE post_versions SET status = 'SUBMITTED' WHERE id = 'e1000000-0000-4000-8000-000000000007';
UPDATE post_versions SET status = 'READY' WHERE id = 'e1000000-0000-4000-8000-000000000007';
SELECT set_config('tercero.deliverable_transition', '', true);
INSERT INTO share_tokens (post_version_id, token) VALUES ('e1000000-0000-4000-8000-000000000003', 'tok-177');

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
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM LIKE 'FAIL:%' THEN RAISE; END IF;
  IF SQLERRM NOT LIKE '%' || p_like || '%' THEN
    RAISE EXCEPTION 'FAIL: % (refused with "%" instead)', p_fail, SQLERRM;
  END IF;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.expect_refusal(text, text, text) TO authenticated;

CREATE FUNCTION pg_temp.status_of(p_id uuid) RETURNS text LANGUAGE sql AS $$
  SELECT status::text FROM post_versions WHERE id = p_id;
$$;

-- ── Privileges ────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF has_function_privilege('anon', 'public.archive_deliverable(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: anon can archive a Deliverable';
  END IF;
  IF has_function_privilege('anon', 'public.create_revision_version(uuid, uuid, text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: anon can create a revision';
  END IF;
END $$;

-- ── Outsider: another workspace's Deliverable is not found ────────────────
SELECT pg_temp.act_as('99999999-9999-4999-8999-999999999999');
SET LOCAL ROLE authenticated;
SELECT pg_temp.expect_refusal(
  $q$SELECT public.archive_deliverable('e1000000-0000-4000-8000-000000000001')$q$,
  'not found', 'an outsider archived another workspace''s Deliverable');
SELECT pg_temp.expect_refusal(
  $q$SELECT public.create_revision_version('e1000000-0000-4000-8000-000000000004', NULL, NULL)$q$,
  'not found', 'an outsider revised another workspace''s Deliverable');
RESET ROLE;

-- ── Member: refusals ──────────────────────────────────────────────────────
SELECT pg_temp.act_as('33333333-3333-4333-8333-333333333333');
SET LOCAL ROLE authenticated;
SELECT pg_temp.expect_refusal(
  $q$SELECT public.archive_deliverable('e1000000-0000-4000-8000-000000000003')$q$,
  'only a deliverable they created', 'a Member archived someone else''s Deliverable');
SELECT pg_temp.expect_refusal(
  $q$SELECT public.archive_deliverable('e1000000-0000-4000-8000-000000000007')$q$,
  'draft or submitted', 'a Member archived their own READY Deliverable');
RESET ROLE;

DO $$
BEGIN
  IF (SELECT count(*) FROM t_flag_seen) <> 0 THEN
    RAISE EXCEPTION 'FAIL: a refused archive wrote';
  END IF;
END $$;

-- ── Member: their own DRAFT and SUBMITTED ─────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT public.archive_deliverable('e1000000-0000-4000-8000-000000000001');
SELECT public.archive_deliverable('e1000000-0000-4000-8000-000000000002');
-- Already archived.
SELECT pg_temp.expect_refusal(
  $q$SELECT public.archive_deliverable('e1000000-0000-4000-8000-000000000001')$q$,
  'draft or submitted', 'a Member archived an ARCHIVED Version again');
RESET ROLE;

-- ── Owner: someone else's PENDING_APPROVAL; nobody: PUBLISHED ─────────────
SELECT pg_temp.act_as('11111111-1111-4111-8111-111111111111');
SET LOCAL ROLE authenticated;
SELECT public.archive_deliverable('e1000000-0000-4000-8000-000000000003');
SELECT pg_temp.expect_refusal(
  $q$SELECT public.archive_deliverable('e1000000-0000-4000-8000-000000000006')$q$,
  'Cannot archive a deliverable that is PUBLISHED', 'the Owner archived a PUBLISHED Deliverable');
RESET ROLE;

-- ── Admin: a SCHEDULED one ────────────────────────────────────────────────
SELECT pg_temp.act_as('22222222-2222-4222-8222-222222222222');
SET LOCAL ROLE authenticated;
SELECT public.archive_deliverable('e1000000-0000-4000-8000-000000000005');
RESET ROLE;

DO $$
BEGIN
  IF pg_temp.status_of('e1000000-0000-4000-8000-000000000001') <> 'ARCHIVED'
     OR pg_temp.status_of('e1000000-0000-4000-8000-000000000002') <> 'ARCHIVED'
     OR pg_temp.status_of('e1000000-0000-4000-8000-000000000003') <> 'ARCHIVED'
     OR pg_temp.status_of('e1000000-0000-4000-8000-000000000005') <> 'ARCHIVED' THEN
    RAISE EXCEPTION 'FAIL: an allowed archive did not end ARCHIVED';
  END IF;
  IF pg_temp.status_of('e1000000-0000-4000-8000-000000000007') <> 'READY'
     OR pg_temp.status_of('e1000000-0000-4000-8000-000000000006') <> 'PUBLISHED' THEN
    RAISE EXCEPTION 'FAIL: a refused archive changed a status';
  END IF;
  IF (SELECT is_active FROM share_tokens WHERE token = 'tok-177') THEN
    RAISE EXCEPTION 'FAIL: an archived Version''s review link still works';
  END IF;
  -- The Admin, creator of e1…0003, hears the Owner archived it.
  IF NOT EXISTS (
    SELECT 1 FROM notifications
    WHERE entity_id = 'd1000000-0000-4000-8000-000000000003' AND type = 'post_status_changed'
      AND recipient_user_id = '22222222-2222-4222-8222-222222222222'
      AND title = 'Your deliverable was archived'
  ) THEN
    RAISE EXCEPTION 'FAIL: the creator was not told of the archive';
  END IF;
END $$;

-- ── Revision: only the current NEEDS_REVISION Version ─────────────────────
SELECT pg_temp.act_as('33333333-3333-4333-8333-333333333333');
SET LOCAL ROLE authenticated;
-- e1…0008 is v1 of a post whose current Version is e1…0009.
SELECT pg_temp.expect_refusal(
  $q$SELECT public.create_revision_version('e1000000-0000-4000-8000-000000000008', NULL, NULL)$q$,
  'current version', 'a superseded Version was revised');
SELECT pg_temp.expect_refusal(
  $q$SELECT public.create_revision_version('e1000000-0000-4000-8000-000000000009', NULL, NULL)$q$,
  'Cannot create a new version of a deliverable that is DRAFT', 'a DRAFT was revised');

CREATE TEMP TABLE t_new ON COMMIT DROP AS
SELECT public.create_revision_version(
  'e1000000-0000-4000-8000-000000000004',
  '11111111-1111-4111-8111-111111111111',   -- a forged p_user_id is ignored
  'Tighten the hook') AS id;
RESET ROLE;

DO $$
DECLARE
  v_new record;
BEGIN
  SELECT pv.*, p.current_version_id INTO v_new
  FROM post_versions pv JOIN posts p ON p.id = pv.post_id
  WHERE pv.id = (SELECT id FROM t_new);

  IF pg_temp.status_of('e1000000-0000-4000-8000-000000000004') <> 'ARCHIVED' THEN
    RAISE EXCEPTION 'FAIL: the revised Version was not archived';
  END IF;
  IF v_new.status <> 'DRAFT' OR v_new.version_number <> 2 OR v_new.admin_notes <> 'Tighten the hook'
     OR v_new.current_version_id <> v_new.id THEN
    RAISE EXCEPTION 'FAIL: the new Version is wrong: %', row_to_json(v_new);
  END IF;
  IF v_new.created_by <> '33333333-3333-4333-8333-333333333333' THEN
    RAISE EXCEPTION 'FAIL: the new Version''s created_by is not the caller';
  END IF;
  -- Superseding is a versioning step: nobody is told.
  IF EXISTS (
    SELECT 1 FROM notifications
    WHERE entity_id = 'd1000000-0000-4000-8000-000000000004' AND title = 'Your deliverable was archived'
  ) THEN
    RAISE EXCEPTION 'FAIL: a revision sent an "archived" notification';
  END IF;
  -- Every status write went through the helper.
  IF EXISTS (SELECT 1 FROM t_flag_seen WHERE flag IS DISTINCT FROM 'on') OR (SELECT count(*) FROM t_flag_seen) <> 5 THEN
    RAISE EXCEPTION 'FAIL: a write went without the transition flag: %', (SELECT array_agg(flag) FROM t_flag_seen);
  END IF;
END $$;

\echo 'archive_deliverable: all assertions passed'
ROLLBACK;
