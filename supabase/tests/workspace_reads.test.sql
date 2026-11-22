-- #180 test (ADR 0008): the read functions without a workspace id return
-- only the caller's workspace: the calendar, the client pipeline, the
-- campaign summary, the Proposals totals (Owner/Admin only) and the two
-- team-member lists. Self-checking and self-cleaning: runs in a transaction
-- that is rolled back, and raises on the first failure.
--
--   docker exec -i supabase_db_tercero psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/workspace_reads.test.sql
--
-- Seeded Northwind Social (owner 1111…, admin 2222…, member 3333…), plus an
-- outsider (9999…) who owns a workspace with one client, Deliverable,
-- campaign and Proposal of their own.

\set ON_ERROR_STOP 1
BEGIN;

INSERT INTO auth.users (id, instance_id, aud, role, email)
VALUES ('99999999-9999-4999-8999-999999999999', '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'delivered+outsider@resend.dev');
INSERT INTO clients (id, user_id, name, email, status)
VALUES ('c9999999-9999-4999-8999-999999999999', '99999999-9999-4999-8999-999999999999', 'Outsider Co',
        'delivered+outsiderco@resend.dev', 'ACTIVE');
SELECT set_config('request.jwt.claims',
  json_build_object('sub', '99999999-9999-4999-8999-999999999999', 'role', 'authenticated')::text, true);
SELECT public.create_post_draft_v3(p_client_id => 'c9999999-9999-4999-8999-999999999999', p_title => 'Outsider post',
  p_content => 'x', p_media_urls => '{}', p_platform => '{instagram}', p_target_date => now() + interval '1 day');
INSERT INTO campaigns (user_id, client_id, name)
VALUES ('99999999-9999-4999-8999-999999999999', 'c9999999-9999-4999-8999-999999999999', 'Outsider campaign');
INSERT INTO campaigns (user_id, client_id, name)
VALUES ('11111111-1111-4111-8111-111111111111', 'c1111111-1111-4111-8111-111111111111', 'Northwind campaign');
INSERT INTO proposals (agency_user_id, title, status) VALUES
  ('99999999-9999-4999-8999-999999999999', 'Outsider proposal', 'DRAFT'),
  ('11111111-1111-4111-8111-111111111111', 'Northwind proposal', 'DRAFT');

CREATE FUNCTION pg_temp.act_as(p_uid uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
$$;

-- What a caller sees, by workspace: the client names / campaign names /
-- proposal titles / member ids each read returns.
CREATE TEMP TABLE t_seen (who text, what text, val text);
GRANT INSERT, SELECT ON t_seen TO authenticated;
CREATE FUNCTION pg_temp.look(p_who text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO t_seen
  SELECT p_who, 'calendar', client_name FROM public.get_global_calendar(
    p_start_date => now() - interval '1 year', p_end_date => now() + interval '1 year');
  INSERT INTO t_seen
  SELECT p_who, 'pipeline', c ->> 'name'
  FROM jsonb_array_elements(public.get_clients_with_pipeline(p_status => 'all') -> 'clients') c;
  INSERT INTO t_seen
  SELECT p_who, 'campaigns', name FROM public.get_campaigns_with_post_summary(p_client_id => NULL);
  INSERT INTO t_seen
  SELECT p_who, 'proposals', title FROM public.get_proposals_with_totals(p_client_id => NULL);
  INSERT INTO t_seen SELECT p_who, 'team', member_user_id::text FROM public.get_team_members();
  INSERT INTO t_seen SELECT p_who, 'removed', member_user_id::text FROM public.get_removed_members();
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.look(text) TO authenticated;

-- One removed Northwind member, so the removed list has something to show.
UPDATE agency_members SET is_active = false WHERE member_user_id = '33333333-3333-4333-8333-333333333333';
SELECT pg_temp.act_as('11111111-1111-4111-8111-111111111111');
SET LOCAL ROLE authenticated;
SELECT pg_temp.look('owner');
RESET ROLE;
UPDATE agency_members SET is_active = true WHERE member_user_id = '33333333-3333-4333-8333-333333333333';

SELECT pg_temp.act_as('22222222-2222-4222-8222-222222222222');
SET LOCAL ROLE authenticated;
SELECT pg_temp.look('admin');
RESET ROLE;

SELECT pg_temp.act_as('33333333-3333-4333-8333-333333333333');
SET LOCAL ROLE authenticated;
SELECT pg_temp.look('member');
RESET ROLE;

SELECT pg_temp.act_as('99999999-9999-4999-8999-999999999999');
SET LOCAL ROLE authenticated;
SELECT pg_temp.look('outsider');
RESET ROLE;

DO $$
DECLARE
  r record;
BEGIN
  -- Northwind's people never see the outsider's rows, and the outsider sees
  -- nothing of Northwind's.
  IF EXISTS (SELECT 1 FROM t_seen WHERE who <> 'outsider'
             AND val IN ('Outsider Co', 'Outsider campaign', 'Outsider proposal', '99999999-9999-4999-8999-999999999999')) THEN
    RAISE EXCEPTION 'FAIL: a Northwind caller saw the outsider''s workspace: %',
      (SELECT array_agg(who || '/' || what || '=' || val) FROM t_seen WHERE who <> 'outsider' AND val LIKE 'Outsider%');
  END IF;
  IF EXISTS (SELECT 1 FROM t_seen WHERE who = 'outsider'
             AND val NOT IN ('Outsider Co', 'Outsider campaign', 'Outsider proposal', '99999999-9999-4999-8999-999999999999')) THEN
    RAISE EXCEPTION 'FAIL: the outsider saw another workspace: %',
      (SELECT array_agg(what || '=' || val) FROM t_seen WHERE who = 'outsider');
  END IF;

  -- Each read returns the caller's own workspace's rows.
  FOR r IN SELECT * FROM (VALUES
      ('owner', 'calendar'), ('owner', 'pipeline'), ('owner', 'campaigns'), ('owner', 'proposals'),
      ('owner', 'team'), ('owner', 'removed'),
      ('admin', 'calendar'), ('admin', 'pipeline'), ('admin', 'campaigns'), ('admin', 'proposals'), ('admin', 'team'),
      ('member', 'calendar'), ('member', 'pipeline'), ('member', 'campaigns'), ('member', 'team'),
      ('outsider', 'calendar'), ('outsider', 'pipeline'), ('outsider', 'campaigns'), ('outsider', 'proposals'))
    AS v(who, what)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM t_seen s WHERE s.who = r.who AND s.what = r.what) THEN
      RAISE EXCEPTION 'FAIL: % got nothing from % in their own workspace', r.who, r.what;
    END IF;
  END LOOP;

  IF NOT EXISTS (SELECT 1 FROM t_seen WHERE who = 'owner' AND what = 'removed'
                 AND val = '33333333-3333-4333-8333-333333333333') THEN
    RAISE EXCEPTION 'FAIL: the Owner did not see the removed member';
  END IF;

  -- A Member sees no Proposals (Owner/Admin only, as RLS).
  IF EXISTS (SELECT 1 FROM t_seen WHERE who = 'member' AND what = 'proposals') THEN
    RAISE EXCEPTION 'FAIL: a Member saw Proposals';
  END IF;

  -- Not callable signed out.
  IF has_function_privilege('anon', 'public.get_team_members()', 'EXECUTE')
     OR has_function_privilege('anon', 'public.get_global_calendar(timestamp with time zone, timestamp with time zone)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: anon can call a workspace read';
  END IF;
END $$;

\echo 'workspace_reads: all assertions passed'
ROLLBACK;
