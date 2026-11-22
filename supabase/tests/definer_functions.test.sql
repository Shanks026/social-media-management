-- #179 (ADR 0008): which SECURITY DEFINER functions users can call.
-- A DEFINER function runs as its owner, past RLS, so one that anon or
-- authenticated can EXECUTE must authorize the caller itself, or be a public
-- review-link endpoint that the token authorizes. This test lists every such
-- function in `public` and fails when one isn't on the reviewed allow-list
-- below, or is callable by a wider role than its entry allows. Supabase's
-- default privileges grant EXECUTE to anon and authenticated on every new
-- function, so a new DEFINER function fails here until its PR either revokes
-- it or adds an entry with a reason. Stale entries fail too, and so does any
-- DEFINER function without a search_path.
--
-- Trigger functions are left out: Postgres won't run them outside a trigger.
--
--   docker exec -i supabase_db_tercero psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/definer_functions.test.sql
--
-- Self-checking and self-cleaning: runs in a transaction that is rolled back,
-- and raises on the first failure.

\set ON_ERROR_STOP 1
BEGIN;

-- who: 'anon' = anyone (anon and authenticated); 'authenticated' = signed in only.
CREATE TEMP TABLE allowed (fn text PRIMARY KEY, who text NOT NULL CHECK (who IN ('anon', 'authenticated')), reason text NOT NULL CHECK (btrim(reason) <> ''));
INSERT INTO allowed (fn, who, reason) VALUES
  -- Public endpoints: the token in the link is the authority.
  ('accept_proposal(text)',                    'anon', 'proposal review link: acts only on the proposal with that share token'),
  ('decline_proposal(text,text)',              'anon', 'proposal review link: acts only on the proposal with that share token'),
  ('request_proposal_changes(text,text)',      'anon', 'proposal review link: acts only on the proposal with that share token'),
  ('mark_proposal_viewed(text)',               'anon', 'proposal review link: marks only the proposal with that share token'),
  ('get_proposal_by_token(text)',              'anon', 'proposal review link: reads only the proposal with that share token'),
  ('get_post_by_token(text)',                  'anon', 'deliverable review link: reads only the Version with that active token'),
  ('get_agency_branding_by_token(text)',       'anon', 'deliverable review link: branding of the token''s workspace only'),
  ('get_campaign_by_review_token(uuid)',       'anon', 'campaign review link: reads only the campaign with that review token'),
  ('submit_review_decision(text,text,text)',   'anon', 'deliverable review link: one decision, once, on the token''s Version (#176)'),
  ('get_invite_by_token(text)',                'anon', 'team invite link: reads only the invite with that token'),
  ('join_team(text,text,text,text)',           'anon', 'team invite link: refuses a caller without auth.uid(), then joins only the token''s workspace'),
  ('check_email_exists(text)',                 'anon', 'login form says "no account" vs "wrong password"; a deliberate trade-off: it reveals whether an email has an account'),

  -- RLS helpers: policies call them for whoever queries, anon included; each
  -- answers only about the caller.
  ('get_my_agency_user_id()',                  'anon', 'RLS helper: the caller''s workspace (null for anon)'),
  ('is_workspace_admin()',                     'anon', 'RLS helper: whether the caller is Owner/Admin'),
  ('is_workspace_owner()',                     'anon', 'RLS helper: whether the caller is the Owner'),
  ('can_access_finance()',                     'anon', 'RLS helper: the caller''s finance permission'),
  ('can_view_confidential_docs()',             'anon', 'RLS helper: the caller''s documents permission'),
  ('my_documents_level()',                     'anon', 'RLS helper: the caller''s documents level'),
  ('is_note_author(uuid)',                     'anon', 'RLS helper: whether the caller wrote that note'),
  ('my_note_share_permission(uuid)',           'anon', 'RLS helper: the caller''s share on that note'),
  ('is_chat_channel_member(uuid)',             'anon', 'RLS helper: whether the caller is in that channel'),
  ('is_chat_message_channel_member(uuid)',     'anon', 'RLS helper: whether the caller is in that message''s channel'),
  ('is_chat_enabled_for_workspace(uuid)',      'anon', 'RLS helper: a workspace''s chat flag (a plan feature, nothing private)'),
  ('is_superadmin()',                          'authenticated', 'RLS helper: whether the caller is a superadmin'),
  ('is_task_participant(uuid)',                'authenticated', 'RLS helper: whether the caller is on that task'),
  ('my_workspace_client_ids()',                'authenticated', 'RLS helper: the caller''s workspace''s clients'),
  ('get_my_workspace_owner()',                 'authenticated', 'the caller''s own workspace Owner''s profile'),

  -- Superadmin console: each checks is_superadmin first.
  ('admin_get_clients()',                      'authenticated', 'superadmin only (#179: had no check)'),
  ('admin_get_client_detail(uuid)',            'authenticated', 'superadmin only'),
  ('admin_get_client_onboarding(uuid)',        'authenticated', 'superadmin only'),
  ('admin_get_user_auth_info(uuid)',           'authenticated', 'superadmin only'),
  ('admin_update_subscription(uuid,jsonb)',    'authenticated', 'superadmin only'),
  ('admin_schedule_workspace_deletion(uuid,integer)', 'authenticated', 'superadmin only'),
  ('admin_cancel_workspace_deletion(uuid)',    'authenticated', 'superadmin only'),

  -- Deliverables (ADR 0004): caller check, then deliverable_event.
  ('submit_for_internal_approval(uuid)',       'authenticated', 'the Version''s creator only'),
  ('approve_internally(uuid)',                 'authenticated', 'Owner/Admin of the Version''s workspace (assert_deliverable_admin)'),
  ('request_internal_changes(uuid,text)',      'authenticated', 'Owner/Admin of the Version''s workspace (assert_deliverable_admin)'),
  ('send_post_for_approval(uuid)',             'authenticated', 'Owner/Admin of the Version''s workspace (assert_deliverable_admin)'),
  ('schedule_deliverable(uuid,timestamp with time zone)', 'authenticated', 'Owner/Admin of the Version''s workspace (assert_deliverable_admin)'),
  ('approve_deliverable(uuid)',                'authenticated', 'Owner/Admin of the Version''s workspace (assert_deliverable_admin)'),
  ('mark_published(uuid)',                     'authenticated', 'Owner/Admin of the Version''s workspace, or the service role'),
  ('mark_platform_published(uuid,text)',       'authenticated', 'Owner/Admin of the Version''s workspace, or the service role'),
  ('mark_delivered(uuid,text)',                'authenticated', 'Owner/Admin of the Version''s workspace (assert_deliverable_admin)'),
  ('archive_deliverable(uuid)',                'authenticated', 'Owner/Admin, or a Member on their own DRAFT/SUBMITTED Deliverable, in the caller''s workspace'),
  ('create_revision_version(uuid,uuid,text)',  'authenticated', 'the caller''s workspace, current NEEDS_REVISION Version only; created_by = auth.uid()'),
  ('delete_approval_events(uuid[])',           'authenticated', 'Owner/Admin; deletes only the caller''s workspace''s rows'),
  ('get_approval_log(text,integer,integer)',   'authenticated', 'reads only the caller''s workspace (get_my_agency_user_id)'),
  ('get_approval_log_count(text)',             'authenticated', 'reads only the caller''s workspace (get_my_agency_user_id)'),
  ('get_my_submissions(text,integer,integer)', 'authenticated', 'reads only the caller''s own submissions'),
  ('get_my_submissions_count(text)',           'authenticated', 'reads only the caller''s own submissions'),

  -- Workspace reads that still take a workspace id (#180 drops the parameter);
  -- each refuses an id that isn't the caller's workspace (#169).
  ('get_team_members(uuid)',                   'authenticated', 'checks the id is the caller''s workspace (#169); #180 drops the parameter'),
  ('get_removed_members(uuid)',                'authenticated', 'checks the id is the caller''s workspace (#169); #180 drops the parameter'),
  ('get_proposals_with_totals(uuid,uuid)',     'authenticated', 'Owner/Admin, and the id must be the caller''s workspace (#169); #180 drops the parameter'),
  ('get_campaign_analytics(uuid)',             'authenticated', 'only a campaign in the caller''s workspace (#179: had no check)'),
  ('generate_invoice_from_template(uuid,uuid)', 'authenticated', 'a signed-in caller needs finance access and its own workspace''s template (the cron calls it as postgres); #181 makes it use the real caller'),
  ('generate_proposal_token(uuid)',            'authenticated', 'only a proposal in the caller''s workspace'),

  -- Team.
  ('update_member_access(uuid,text,jsonb,text)', 'authenticated', 'Owner only, on a member of the caller''s workspace'),
  ('remove_team_member(uuid)',                 'authenticated', 'Owner only, on a member of the caller''s workspace'),
  ('hard_delete_team_member(uuid)',            'authenticated', 'Owner only, on a member of the caller''s workspace'),
  ('set_member_job_roles(uuid,uuid[])',        'authenticated', 'Owner only, on a member and job roles of the caller''s workspace'),
  ('set_member_responsibilities(uuid,text)',   'authenticated', 'Owner only, on a member of the caller''s workspace'),
  ('set_my_email_task_assignments(boolean)',   'authenticated', 'the caller''s own setting'),
  ('request_workspace_deletion()',             'authenticated', 'the caller''s own workspace, Owner only'),
  ('cancel_workspace_deletion()',              'authenticated', 'the caller''s own workspace, Owner only'),

  -- Tasks.
  ('update_task_status(uuid,text)',            'authenticated', 'a task in the caller''s workspace that they created or are assigned, or any as Owner/Admin'),
  ('reassign_task(uuid,uuid)',                 'authenticated', 'a task in the caller''s workspace that they created, are assigned or participate in, or any as Owner/Admin'),
  ('task_reference_exists(uuid)',              'authenticated', 'only says whether a task exists in the caller''s workspace'),

  -- Chat and comments: each acts as auth.uid() on rows it may see.
  ('ensure_workspace_channel()',               'authenticated', 'the caller''s workspace channel and their membership; chat-gated'),
  ('get_or_create_dm_channel(uuid)',           'authenticated', 'a DM between the caller and a teammate in their workspace; chat-gated'),
  ('mark_channel_read(uuid)',                  'authenticated', 'the caller''s own read marker'),
  ('toggle_chat_reaction(uuid,text)',          'authenticated', 'the caller''s own reaction, in a channel they belong to'),
  ('soft_delete_chat_message(uuid)',           'authenticated', 'the caller''s own message in their workspace, or Owner/Admin in the workspace channel'),
  ('soft_delete_comment(uuid)',                'authenticated', 'the caller''s own comment in their workspace, or Owner/Admin'),
  ('toggle_comment_reaction(uuid,text)',       'authenticated', 'the caller''s own reaction, on a comment in their workspace'),

  -- Storage counters: no-ops since the storage.objects trigger took over; #182 drops them.
  ('increment_storage_used(uuid,bigint)',      'authenticated', 'deprecated no-op (does nothing); dropped in #182'),
  ('decrement_storage_used(uuid,bigint)',      'authenticated', 'deprecated no-op (does nothing); dropped in #182');

-- Every user-callable DEFINER function that isn't allowed at that level, and
-- every entry that no longer matches a callable function.
CREATE FUNCTION pg_temp.definer_problems() RETURNS TABLE (fn text, problem text)
LANGUAGE sql AS $$
  WITH callable AS (
    SELECT p.oid::regprocedure::text AS fn,
           CASE WHEN has_function_privilege('anon', p.oid, 'EXECUTE') THEN 'anon' ELSE 'authenticated' END AS who
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef AND p.prorettype <> 'trigger'::regtype
      AND (has_function_privilege('anon', p.oid, 'EXECUTE')
           OR has_function_privilege('authenticated', p.oid, 'EXECUTE'))
  )
  SELECT c.fn, 'user-callable SECURITY DEFINER function with no allow-list entry (callable by ' || c.who || ')'
  FROM callable c LEFT JOIN allowed a USING (fn) WHERE a.fn IS NULL
  UNION ALL
  SELECT c.fn, 'callable by anon, but allowed only for authenticated'
  FROM callable c JOIN allowed a USING (fn) WHERE c.who = 'anon' AND a.who = 'authenticated'
  UNION ALL
  SELECT a.fn, 'stale allow-list entry: no such user-callable DEFINER function'
  FROM allowed a LEFT JOIN callable c USING (fn) WHERE c.fn IS NULL
  UNION ALL
  SELECT p.oid::regprocedure::text, 'SECURITY DEFINER function without search_path'
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.prosecdef
    AND NOT EXISTS (SELECT 1 FROM unnest(coalesce(p.proconfig, '{}')) c WHERE c LIKE 'search_path=%')
$$;

DO $$
DECLARE
  v text;
BEGIN
  SELECT string_agg(fn || ': ' || problem, E'\n  ' ORDER BY fn) INTO v FROM pg_temp.definer_problems();
  IF v IS NOT NULL THEN
    RAISE EXCEPTION E'FAIL: SECURITY DEFINER review (see supabase/tests/definer_functions.test.sql):\n  %', v;
  END IF;
END $$;

-- ── The holes the first review found stay closed ──────────────────────────
INSERT INTO auth.users (id, instance_id, aud, role, email)
VALUES ('99999999-9999-4999-8999-999999999999', '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'delivered+outsider@resend.dev');
INSERT INTO campaigns (id, user_id, client_id, name, budget)
VALUES ('ca000000-0000-4000-8000-000000000179', '11111111-1111-4111-8111-111111111111',
        'c1111111-1111-4111-8111-111111111111', 'Winter push', 5000);

DO $$
BEGIN
  IF has_function_privilege('authenticated', 'public.generate_version_token(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: a signed-in user can mint a review link';
  END IF;
  IF has_function_privilege('anon', 'public.notify_overdue_invoices()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.cleanup_old_notifications()', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: a user can run a cron job';
  END IF;
END $$;

-- An outsider (Owner of their own workspace) …
SELECT set_config('request.jwt.claims',
  json_build_object('sub', '99999999-9999-4999-8999-999999999999', 'role', 'authenticated')::text, true);
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  -- … can't list every agency,
  BEGIN
    PERFORM * FROM public.admin_get_clients();
    RAISE EXCEPTION 'FAIL: a non-superadmin listed every agency';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  -- … nor read another workspace's campaign analytics.
  IF EXISTS (SELECT 1 FROM public.get_campaign_analytics('ca000000-0000-4000-8000-000000000179')) THEN
    RAISE EXCEPTION 'FAIL: an outsider read another workspace''s campaign analytics';
  END IF;
END $$;
RESET ROLE;

-- The Owner still reads their own.
SELECT set_config('request.jwt.claims',
  json_build_object('sub', '11111111-1111-4111-8111-111111111111', 'role', 'authenticated')::text, true);
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  IF (SELECT budget FROM public.get_campaign_analytics('ca000000-0000-4000-8000-000000000179')) IS DISTINCT FROM 5000 THEN
    RAISE EXCEPTION 'FAIL: the Owner could not read their own campaign analytics';
  END IF;
END $$;
RESET ROLE;

-- The check catches what it should: a new DEFINER function, as Supabase
-- creates it (default privileges grant anon and authenticated), and one
-- without search_path.
CREATE FUNCTION public.t179_probe() RETURNS int LANGUAGE sql SECURITY DEFINER AS $$ SELECT 1 $$;
DO $$
BEGIN
  IF (SELECT count(*) FROM pg_temp.definer_problems() WHERE fn = 't179_probe()') <> 2 THEN
    RAISE EXCEPTION 'FAIL: an unlisted DEFINER function without search_path was not caught: %',
      (SELECT array_agg(problem) FROM pg_temp.definer_problems() WHERE fn = 't179_probe()');
  END IF;
END $$;
DROP FUNCTION public.t179_probe();

\echo 'definer_functions: all assertions passed'
ROLLBACK;
