-- The original design deliberately left DELETE off (retention was meant to
-- be server-side/cron-only). Adding manual per-notification delete now,
-- scoped to the recipient's own rows only — same scoping as the existing
-- SELECT/UPDATE policies. The 30-day auto-expiry cron job is unaffected;
-- this is purely an additional, user-initiated path.
create policy "notifications: recipient can delete"
  on public.notifications for delete
  using (recipient_user_id = auth.uid());;
