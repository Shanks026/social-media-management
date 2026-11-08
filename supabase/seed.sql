-- Local development seed (#91, ADR 0005). Runs after the migrations on every
-- `supabase db reset` / first `supabase start`. LOCAL ONLY — never run against
-- production.
--
-- One workspace ("Northwind Social") with three people who can all sign in:
--
--   owner   delivered+owner@resend.dev    password: tercero-local
--   admin   delivered+admin@resend.dev    password: tercero-local
--   member  delivered+member@resend.dev   password: tercero-local
--
-- Every address is on resend.dev (Resend's test domain), so nothing seeded here
-- can email a real person even if EMAIL_MODE were live.

-- ── People ─────────────────────────────────────────────────────────────────

-- Admin and member carry an invite_token, as real invitees do, so the signup
-- trigger (handle_new_user_subscription) gives only the owner a workspace.
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
SELECT '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
       extensions.crypt('tercero-local', extensions.gen_salt('bf')), now(),
       '{"provider":"email","providers":["email"]}'::jsonb, u.meta, now(), now(),
       '', '', '', ''
FROM (VALUES
  ('11111111-1111-4111-8111-111111111111'::uuid, 'delivered+owner@resend.dev',  '{"full_name":"Olivia Owner"}'::jsonb),
  ('22222222-2222-4222-8222-222222222222'::uuid, 'delivered+admin@resend.dev',  '{"full_name":"Adam Admin","invite_token":"seed"}'::jsonb),
  ('33333333-3333-4333-8333-333333333333'::uuid, 'delivered+member@resend.dev', '{"full_name":"Mia Member","invite_token":"seed"}'::jsonb)
) AS u(id, email, meta);

INSERT INTO auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
SELECT gen_random_uuid(), u.id, u.id::text, 'email',
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       now(), now(), now()
FROM auth.users u
WHERE u.email LIKE 'delivered+%@resend.dev';

-- The owner's workspace: named and past onboarding, so sign-in lands on the app.
UPDATE public.agency_subscriptions
SET agency_name = 'Northwind Social',
    email = 'delivered+owner@resend.dev',
    onboarding_completed_at = now()
WHERE user_id = '11111111-1111-4111-8111-111111111111';

INSERT INTO public.agency_members (agency_user_id, member_user_id, system_role, permissions, is_active)
VALUES
  ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', 'admin',  '{"documents":"manage"}', true),
  ('11111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333333', 'member', '{"documents":"view"}',   true);

-- ── Clients ────────────────────────────────────────────────────────────────

INSERT INTO public.clients (id, user_id, name, email, status, tier, industry, platforms, is_internal, client_type)
VALUES
  ('c0000000-0000-4000-8000-000000000000', '11111111-1111-4111-8111-111111111111', 'Northwind Social (Internal)', 'delivered+internal@resend.dev', 'ACTIVE', 'INTERNAL', NULL, '{instagram,linkedin}', true,  NULL),
  ('c1111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', 'Acme Coffee',        'delivered+acme@resend.dev',       'ACTIVE', 'PRO',   'Food & Beverage', '{instagram,facebook}', false, 'monthly_retainer'),
  ('c2222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 'Brightline Fitness', 'delivered+brightline@resend.dev', 'ACTIVE', 'BASIC', 'Health',          '{instagram,youtube}',  false, 'project_based'),
  ('c3333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111', 'Harbor Dental',      'delivered+harbor@resend.dev',     'PAUSED', 'VIP',   'Healthcare',      '{facebook,google_business}', false, 'monthly_retainer');

-- ── Deliverables across the main statuses ──────────────────────────────────

WITH d(post_id, version_id, client_id, author, status, title, platform, days) AS (
  VALUES
    ('d1000000-0000-4000-8000-000000000001'::uuid, 'e1000000-0000-4000-8000-000000000001'::uuid, 'c1111111-1111-4111-8111-111111111111'::uuid, '33333333-3333-4333-8333-333333333333'::uuid, 'DRAFT'::post_status,            'Autumn latte teaser',       '{instagram}'::text[],          7),
    ('d1000000-0000-4000-8000-000000000002', 'e1000000-0000-4000-8000-000000000002', 'c1111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333333', 'SUBMITTED',        'Barista spotlight reel',    '{instagram,facebook}',  5),
    ('d1000000-0000-4000-8000-000000000003', 'e1000000-0000-4000-8000-000000000003', 'c1111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', 'PENDING_APPROVAL', 'Loyalty card launch',       '{instagram}',           4),
    ('d1000000-0000-4000-8000-000000000004', 'e1000000-0000-4000-8000-000000000004', 'c2222222-2222-4222-8222-222222222222', '22222222-2222-4222-8222-222222222222', 'NEEDS_REVISION',   'January challenge kickoff', '{instagram,youtube}',   10),
    ('d1000000-0000-4000-8000-000000000005', 'e1000000-0000-4000-8000-000000000005', 'c2222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 'SCHEDULED',        'Trainer Q&A carousel',      '{instagram}',           2),
    ('d1000000-0000-4000-8000-000000000006', 'e1000000-0000-4000-8000-000000000006', 'c3333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111', 'PUBLISHED',        'Smile makeover story',      '{facebook}',            -3),
    ('d1000000-0000-4000-8000-000000000007', 'e1000000-0000-4000-8000-000000000007', 'c0000000-0000-4000-8000-000000000000', '33333333-3333-4333-8333-333333333333', 'DRAFT',            'Agency hiring post',        '{linkedin}',            14)
), posts_in AS (
  INSERT INTO public.posts (id, client_id, created_by)
  SELECT post_id, client_id, author FROM d
  RETURNING id
), versions_in AS (
  INSERT INTO public.post_versions (id, post_id, client_id, version_number, status, title, content, platform, created_by, target_date, published_at)
  SELECT version_id, post_id, client_id, 1, status, title,
         'Seed copy for "' || title || '".', platform, author,
         date_trunc('hour', now()) + make_interval(days => days),
         CASE WHEN status = 'PUBLISHED' THEN now() - interval '3 days' END
  FROM d
  WHERE EXISTS (SELECT 1 FROM posts_in)
  RETURNING id, post_id
)
UPDATE public.posts p
SET current_version_id = v.id
FROM versions_in v
WHERE p.id = v.post_id;

-- ── A revised deliverable with a superseded version still open (#111) ───────
-- Legacy shape: the old create_new_version RPC (dropped in #101) moved
-- posts.current_version_id to a new version without archiving the APPROVED
-- one, so production can hold superseded versions in an open status. v1 is due
-- in 12 hours; the current v2 is a draft due in 9 days. The Clients page must
-- base Acme's next date on v2, not v1.
INSERT INTO public.posts (id, client_id, created_by)
VALUES ('d1000000-0000-4000-8000-000000000008', 'c1111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222');

INSERT INTO public.post_versions (id, post_id, client_id, version_number, status, title, content, platform, created_by, target_date)
VALUES
  ('e1000000-0000-4000-8000-000000000008', 'd1000000-0000-4000-8000-000000000008', 'c1111111-1111-4111-8111-111111111111', 1, 'APPROVED',
   'Holiday menu promo', 'Seed copy for "Holiday menu promo" (v1, superseded).', '{instagram}', '22222222-2222-4222-8222-222222222222',
   date_trunc('hour', now()) + interval '12 hours'),
  ('e1000000-0000-4000-8000-000000000009', 'd1000000-0000-4000-8000-000000000008', 'c1111111-1111-4111-8111-111111111111', 2, 'DRAFT',
   'Holiday menu promo', 'Seed copy for "Holiday menu promo" (v2).', '{instagram}', '22222222-2222-4222-8222-222222222222',
   date_trunc('hour', now()) + interval '9 days');

UPDATE public.posts
SET current_version_id = 'e1000000-0000-4000-8000-000000000009'
WHERE id = 'd1000000-0000-4000-8000-000000000008';

-- ── Vault: where database code finds the functions (#89) ────────────────────
-- pg_net runs inside the db container, so the API is reached by its container
-- name on the stack's Docker network (project_id = "tercero" in config.toml).
-- The service key is the public supabase-demo key every local stack uses
-- (iss "supabase-demo"); it is valid nowhere but a local stack.
SELECT vault.create_secret('http://supabase_kong_tercero:8000', 'project_url',
  'Local stack API, reached from inside the db container');
SELECT vault.create_secret(
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU',
  'service_role_key', 'Local supabase-demo service role key');
