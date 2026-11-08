-- #101: drop dead database functions, views and duplicates.
--
-- Each object was re-checked right before writing this migration for
-- references from the app (src/), edge functions, other function bodies,
-- RLS policies, views and pg_cron jobs. None remain.
--
-- Deliberately KEPT, although the 2026-11 audit listed them:
--   * send_post_for_approval(uuid) -- PostDetails.jsx calls it to send a
--     deliverable for client approval (the audit missed the caller).
--   * client_pipeline_analytics    -- get_client_report reads it (#73).
--   * storage.update_updated_at_column -- Supabase-owned, not ours.
-- schedule_post / submit_approval go with the legacy tables in #102.

-- 1. Dead functions (no callers anywhere) --------------------------------
drop function public.create_new_post_with_version(uuid, text, text, text[], text[], timestamp with time zone);
drop function public.create_new_version(uuid);
drop function public.edit_draft(uuid, text, text[]);
drop function public.delete_draft_post(uuid);
drop function public.send_for_approval(uuid);
drop function public.get_global_calendar_posts(uuid, timestamp without time zone, timestamp without time zone);
drop function public.my_system_role();
-- Generating a recurring invoice already advances its date (decided in #74).
drop function public.advance_recurring_invoice_date(uuid);

-- 2. Stale overloads ------------------------------------------------------
-- Keep create_post_draft_v3(..., p_campaign_id uuid, p_deliverable_type text),
-- the 11-argument signature src/api/posts.js calls.
drop function public.create_post_draft_v3(uuid, text, text, text[], text[], uuid, timestamp with time zone, text);
drop function public.create_post_draft_v3(uuid, text, text, text[], text[], uuid, timestamp with time zone, text, jsonb);
drop function public.create_post_draft_v3(uuid, text, text, text[], text[], uuid, timestamp with time zone, text, jsonb, uuid);
-- Keep create_revision_version(p_parent_version_id, p_user_id, p_admin_notes).
drop function public.create_revision_version(uuid, uuid);

-- 3. Unused view ----------------------------------------------------------
drop view public.subscription_usage_stats;

-- 4. One updated_at trigger function: set_updated_at --------------------
drop trigger app_config_updated_at on public.app_config;
create trigger app_config_updated_at
  before update on public.app_config
  for each row execute function public.set_updated_at();

drop trigger trg_user_feedback_updated_at on public.user_feedback;
create trigger trg_user_feedback_updated_at
  before update on public.user_feedback
  for each row execute function public.set_updated_at();

drop function public.update_app_config_timestamp();
drop function public.update_user_feedback_updated_at();

-- 5. Duplicate unique index (same column as the primary key) ---------------
alter table public.agency_subscriptions
  drop constraint agency_subscriptions_user_id_key;
