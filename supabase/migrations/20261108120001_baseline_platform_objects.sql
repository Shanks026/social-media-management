-- Squashed baseline, part 2 (#90, ADR 0005): the objects a `public`-schema dump
-- does not capture. Taken from production's catalog on 2026-11-08.
--
--   * triggers that live on Supabase-owned tables (auth.users, storage.objects)
--   * storage.objects RLS policies
--   * pg_cron jobs
--
-- The Realtime publication membership is in the dump (part 1).
-- Storage buckets are declared in supabase/config.toml ([storage.buckets.*]).
-- Vault secrets are per environment and are NOT created here: production holds
-- `service_role_key` and `project_url`; the local stack gets its own from seed.sql.

-- ── Triggers on Supabase-owned tables ──────────────────────────────────────

DROP TRIGGER IF EXISTS tr_on_auth_user_created ON auth.users;
CREATE TRIGGER tr_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_subscription();

-- Single source of truth for storage usage (D1/B16, migration 20261107143000).
DROP TRIGGER IF EXISTS on_storage_object_changed ON storage.objects;
CREATE TRIGGER on_storage_object_changed
  AFTER INSERT OR DELETE OR UPDATE ON storage.objects
  FOR EACH ROW EXECUTE FUNCTION public.update_storage_usage();

-- ── storage.objects policies ───────────────────────────────────────────────

-- post-media (public bucket)
CREATE POLICY "Allow Authenticated Uploads to Branding" ON storage.objects
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((bucket_id = 'post-media'::text) AND ((storage.foldername(name))[1] = 'branding'::text));

CREATE POLICY "Allow Individual Delete Access" ON storage.objects
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (bucket_id = 'post-media'::text);

CREATE POLICY branding_superadmin_read ON storage.objects
  AS PERMISSIVE FOR SELECT TO authenticated
  USING ((bucket_id = 'post-media'::text) AND ((storage.foldername(name))[1] = 'branding'::text) AND public.is_superadmin());

CREATE POLICY post_media_read ON storage.objects
  AS PERMISSIVE FOR SELECT TO authenticated
  USING ((bucket_id = 'post-media'::text) AND ((storage.foldername(name))[1] IN (SELECT public.my_workspace_client_ids())));

CREATE POLICY post_media_upload_internal ON storage.objects
  AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((bucket_id = 'post-media'::text) AND (auth.uid() IS NOT NULL));

-- client-documents (private)
CREATE POLICY client_docs_read ON storage.objects
  AS PERMISSIVE FOR SELECT TO public
  USING ((bucket_id = 'client-documents'::text) AND ((storage.foldername(name))[1] = (public.get_my_agency_user_id())::text) AND (public.my_documents_level() <> 'none'::text));

CREATE POLICY client_docs_insert ON storage.objects
  AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((bucket_id = 'client-documents'::text) AND ((storage.foldername(name))[1] = (public.get_my_agency_user_id())::text) AND (public.my_documents_level() = 'manage'::text));

CREATE POLICY client_docs_delete ON storage.objects
  AS PERMISSIVE FOR DELETE TO public
  USING ((bucket_id = 'client-documents'::text) AND ((storage.foldername(name))[1] = (public.get_my_agency_user_id())::text) AND (public.my_documents_level() = 'manage'::text));

-- note-media (private)
CREATE POLICY "note-media select" ON storage.objects
  AS PERMISSIVE FOR SELECT TO authenticated
  USING ((bucket_id = 'note-media'::text) AND ((storage.foldername(name))[1] = (public.get_my_agency_user_id())::text));

CREATE POLICY "note-media insert" ON storage.objects
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((bucket_id = 'note-media'::text) AND ((storage.foldername(name))[1] = (public.get_my_agency_user_id())::text));

CREATE POLICY "note-media delete" ON storage.objects
  AS PERMISSIVE FOR DELETE TO authenticated
  USING ((bucket_id = 'note-media'::text) AND ((storage.foldername(name))[1] = (public.get_my_agency_user_id())::text));

-- proposal-files (public bucket)
CREATE POLICY proposal_files_read_own ON storage.objects
  AS PERMISSIVE FOR SELECT TO authenticated
  USING ((bucket_id = 'proposal-files'::text) AND ((storage.foldername(name))[1] = (public.get_my_agency_user_id())::text));

CREATE POLICY proposal_files_auth_insert ON storage.objects
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((bucket_id = 'proposal-files'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text));

CREATE POLICY proposal_files_auth_update ON storage.objects
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((bucket_id = 'proposal-files'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text));

CREATE POLICY proposal_files_auth_delete ON storage.objects
  AS PERMISSIVE FOR DELETE TO authenticated
  USING ((bucket_id = 'proposal-files'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text));

-- ── pg_cron jobs ───────────────────────────────────────────────────────────

SELECT cron.schedule('cleanup-old-notifications', '30 3 * * *',
  $cmd$ select public.cleanup_old_notifications(); $cmd$);

SELECT cron.schedule('notify-overdue-invoices', '0 8 * * *',
  $cmd$ select public.notify_overdue_invoices(); $cmd$);

-- Needs Vault `project_url` + `service_role_key`; with no `project_url` row the
-- FROM clause yields nothing and no request is made (#89).
SELECT cron.schedule('purge-scheduled-workspaces', '0 3 * * *', $cmd$
    SELECT net.http_post(
      url := rtrim(u.decrypted_secret, '/') || '/functions/v1/delete-workspace',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || COALESCE(
          (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key'),
          ''
        )
      ),
      body := '{}'::jsonb
    )
    FROM vault.decrypted_secrets u
    WHERE u.name = 'project_url';
  $cmd$);

-- ── Privileges production revoked ─────────────────────────────────────────
-- pg_dump records GRANTs, not the absence of one. On a fresh database Supabase's
-- default privileges give anon/authenticated EXECUTE on every new function, so
-- without these the rebuilt schema would let logged-out callers run the admin_*
-- and trigger functions that production locks down. Found by `db diff` (#90).
REVOKE ALL ON FUNCTION "public"."admin_cancel_workspace_deletion"(uuid) FROM "anon";
REVOKE ALL ON FUNCTION "public"."admin_get_client_onboarding"(uuid) FROM "anon";
REVOKE ALL ON FUNCTION "public"."admin_get_clients"() FROM "anon";
REVOKE ALL ON FUNCTION "public"."admin_get_user_auth_info"(uuid) FROM "anon";
REVOKE ALL ON FUNCTION "public"."admin_link_prospect_on_signup"() FROM "anon";
REVOKE ALL ON FUNCTION "public"."admin_schedule_workspace_deletion"(uuid, integer) FROM "anon";
REVOKE ALL ON FUNCTION "public"."admin_update_subscription"(uuid, jsonb) FROM "anon";
REVOKE ALL ON FUNCTION "public"."advance_recurring_invoice_date"(uuid) FROM "anon";
REVOKE ALL ON FUNCTION "public"."cancel_workspace_deletion"() FROM "anon";
REVOKE ALL ON FUNCTION "public"."create_new_post_with_version"(uuid, text, text, text[], text[], timestamp WITH time zone) FROM "anon";
REVOKE ALL ON FUNCTION "public"."decrement_storage_used"(uuid, bigint) FROM "anon";
REVOKE ALL ON FUNCTION "public"."emit_notifications"(uuid, uuid, uuid[], text, text, text, text, uuid, text) FROM "anon";
REVOKE ALL ON FUNCTION "public"."emit_notifications"(uuid, uuid, uuid[], text, text, text, text, uuid, text) FROM "authenticated";
REVOKE ALL ON FUNCTION "public"."enforce_task_assignment"() FROM "anon";
REVOKE ALL ON FUNCTION "public"."enforce_task_assignment"() FROM "authenticated";
REVOKE ALL ON FUNCTION "public"."ensure_workspace_channel"() FROM "anon";
REVOKE ALL ON FUNCTION "public"."generate_invoice_from_template"(uuid, uuid) FROM "anon";
REVOKE ALL ON FUNCTION "public"."generate_proposal_token"(uuid) FROM "anon";
REVOKE ALL ON FUNCTION "public"."generate_version_token"(uuid) FROM "anon";
REVOKE ALL ON FUNCTION "public"."get_campaign_analytics"(uuid) FROM "anon";
REVOKE ALL ON FUNCTION "public"."get_my_chat_channels"() FROM "anon";
REVOKE ALL ON FUNCTION "public"."get_my_workspace_owner"() FROM "anon";
REVOKE ALL ON FUNCTION "public"."get_or_create_dm_channel"(uuid) FROM "anon";
REVOKE ALL ON FUNCTION "public"."get_proposals_with_totals"(uuid, uuid) FROM "anon";
REVOKE ALL ON FUNCTION "public"."handle_new_user_subscription"() FROM "anon";
REVOKE ALL ON FUNCTION "public"."hard_delete_team_member"(uuid) FROM "anon";
REVOKE ALL ON FUNCTION "public"."increment_storage_used"(uuid, bigint) FROM "anon";
REVOKE ALL ON FUNCTION "public"."is_superadmin"() FROM "anon";
REVOKE ALL ON FUNCTION "public"."is_task_participant"(uuid) FROM "anon";
REVOKE ALL ON FUNCTION "public"."mark_channel_read"(uuid) FROM "anon";
REVOKE ALL ON FUNCTION "public"."my_workspace_client_ids"() FROM "anon";
REVOKE ALL ON FUNCTION "public"."reassign_task"(uuid, uuid) FROM "anon";
REVOKE ALL ON FUNCTION "public"."remove_team_member"(uuid) FROM "anon";
REVOKE ALL ON FUNCTION "public"."request_workspace_deletion"() FROM "anon";
REVOKE ALL ON FUNCTION "public"."set_agency_plan"(uuid, text) FROM "anon";
REVOKE ALL ON FUNCTION "public"."set_member_job_roles"(uuid, uuid[]) FROM "anon";
REVOKE ALL ON FUNCTION "public"."set_member_responsibilities"(uuid, text) FROM "anon";
REVOKE ALL ON FUNCTION "public"."set_my_email_task_assignments"(boolean) FROM "anon";
REVOKE ALL ON FUNCTION "public"."soft_delete_chat_message"(uuid) FROM "anon";
REVOKE ALL ON FUNCTION "public"."soft_delete_comment"(uuid) FROM "anon";
REVOKE ALL ON FUNCTION "public"."storage_workspace_for"(uuid) FROM "anon";
REVOKE ALL ON FUNCTION "public"."storage_workspace_for"(uuid) FROM "authenticated";
REVOKE ALL ON FUNCTION "public"."tg_autocomplete_tasks_on_publish"() FROM "anon";
REVOKE ALL ON FUNCTION "public"."tg_autocomplete_tasks_on_publish"() FROM "authenticated";
REVOKE ALL ON FUNCTION "public"."tg_chat_message_author_name"() FROM "anon";
REVOKE ALL ON FUNCTION "public"."tg_chat_message_author_name"() FROM "authenticated";
REVOKE ALL ON FUNCTION "public"."tg_comment_adds_task_participants"() FROM "anon";
REVOKE ALL ON FUNCTION "public"."tg_comment_adds_task_participants"() FROM "authenticated";
REVOKE ALL ON FUNCTION "public"."tg_delete_orphaned_comments"() FROM "anon";
REVOKE ALL ON FUNCTION "public"."tg_delete_orphaned_comments"() FROM "authenticated";
REVOKE ALL ON FUNCTION "public"."tg_log_task_activity"() FROM "anon";
REVOKE ALL ON FUNCTION "public"."tg_log_task_activity"() FROM "authenticated";
REVOKE ALL ON FUNCTION "public"."tg_notify_chat_message"() FROM "anon";
REVOKE ALL ON FUNCTION "public"."tg_notify_chat_message"() FROM "authenticated";
REVOKE ALL ON FUNCTION "public"."tg_notify_comment_added"() FROM "anon";
REVOKE ALL ON FUNCTION "public"."tg_notify_comment_added"() FROM "authenticated";
REVOKE ALL ON FUNCTION "public"."tg_notify_task_changes"() FROM "anon";
REVOKE ALL ON FUNCTION "public"."tg_notify_task_changes"() FROM "authenticated";
REVOKE ALL ON FUNCTION "public"."toggle_chat_reaction"(uuid, text) FROM "anon";
REVOKE ALL ON FUNCTION "public"."toggle_comment_reaction"(uuid, text) FROM "anon";
REVOKE ALL ON FUNCTION "public"."update_storage_usage"() FROM "anon";
REVOKE ALL ON FUNCTION "public"."workspace_admin_uids"(uuid) FROM "anon";
REVOKE ALL ON FUNCTION "public"."workspace_admin_uids"(uuid) FROM "authenticated";
REVOKE ALL ON TABLE "public"."share_tokens" FROM "anon";
