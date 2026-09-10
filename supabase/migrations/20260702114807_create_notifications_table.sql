
-- ─── Notifications table ───────────────────────────────────────────────────────
create table public.notifications (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null,
  recipient_user_id uuid not null,
  actor_user_id     uuid,
  type              text not null,
  title             text not null,
  body              text,
  entity_type       text,           -- 'post' | 'task' | 'campaign' | 'invoice' | 'team'
  entity_id         uuid,
  link              text,           -- explicit route override (e.g. /campaigns/xxx)
  read_at           timestamptz,
  created_at        timestamptz not null default now()
);

-- ─── Indexes ───────────────────────────────────────────────────────────────────
-- Unread count query
create index notifications_unread_idx
  on public.notifications (recipient_user_id, read_at)
  where read_at is null;

-- List query (newest first per recipient)
create index notifications_list_idx
  on public.notifications (recipient_user_id, created_at desc);

-- Retention cleanup (age-based delete)
create index notifications_created_at_idx
  on public.notifications (created_at);

-- ─── RLS ───────────────────────────────────────────────────────────────────────
alter table public.notifications enable row level security;

-- Recipients can read their own notifications
create policy "notifications: recipient can select"
  on public.notifications for select
  using (recipient_user_id = auth.uid());

-- Recipients can mark their own notifications as read (update read_at only)
create policy "notifications: recipient can update"
  on public.notifications for update
  using (recipient_user_id = auth.uid())
  with check (recipient_user_id = auth.uid());

-- Workspace members can insert notifications (fan-out from mutation functions)
-- workspace_id must match the caller's resolved workspace
create policy "notifications: workspace member can insert"
  on public.notifications for insert
  with check (workspace_id = get_my_agency_user_id());

-- ─── Realtime ──────────────────────────────────────────────────────────────────
alter publication supabase_realtime add table public.notifications;
;
