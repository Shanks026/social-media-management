
-- ─── Comments table ───────────────────────────────────────────────────────────
create table public.comments (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null,
  entity_type     text not null check (entity_type in ('post', 'campaign')),
  entity_id       uuid not null,
  author_user_id  uuid not null,
  body            text not null,
  mentioned_uids  uuid[] not null default '{}',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz,
  deleted_at      timestamptz
);

create index comments_thread_idx
  on public.comments (entity_type, entity_id, created_at);

-- ─── RLS ───────────────────────────────────────────────────────────────────────
alter table public.comments enable row level security;

-- All workspace members read every comment in their workspace
create policy "comments: workspace member can select"
  on public.comments for select to authenticated
  using (workspace_id = get_my_agency_user_id());

-- Members create comments authored by themselves in their workspace
create policy "comments: author can insert"
  on public.comments for insert to authenticated
  with check (
    workspace_id = get_my_agency_user_id()
    and author_user_id = auth.uid()
  );

-- Edit is author-only (soft-delete goes through a SECURITY DEFINER RPC instead,
-- so admins can remove without a column-level UPDATE-policy split)
create policy "comments: author can update"
  on public.comments for update to authenticated
  using (author_user_id = auth.uid())
  with check (author_user_id = auth.uid());

-- ─── Realtime ──────────────────────────────────────────────────────────────────
alter publication supabase_realtime add table public.comments;
;
