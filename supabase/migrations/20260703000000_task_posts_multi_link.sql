-- Multiple deliverable (post) links per task.
-- Replaces the single tasks.post_id FK with a many-to-many join table.
--
-- Chosen over a post_id uuid[] column so that:
--   * a deleted post cleanly removes its link (ON DELETE CASCADE) instead of
--     leaving a stale id behind, and
--   * "all tasks for this deliverable" is a simple indexed join.

create table if not exists public.task_posts (
  task_id      uuid        not null references public.tasks(id) on delete cascade,
  post_id      uuid        not null references public.posts(id) on delete cascade,
  workspace_id uuid        not null,
  created_at   timestamptz not null default now(),
  primary key (task_id, post_id)
);

create index if not exists task_posts_post_id_idx   on public.task_posts (post_id);
create index if not exists task_posts_workspace_idx on public.task_posts (workspace_id);

-- Backfill any existing single links, then retire the column.
insert into public.task_posts (task_id, post_id, workspace_id)
  select id, post_id, workspace_id
  from public.tasks
  where post_id is not null
on conflict do nothing;

alter table public.tasks drop column if exists post_id;

-- RLS: workspace members manage links within their own workspace, mirroring
-- the scoping used on tasks/notifications (get_my_agency_user_id()).
alter table public.task_posts enable row level security;

create policy "task_posts_select" on public.task_posts
  for select to authenticated
  using (workspace_id = public.get_my_agency_user_id());

create policy "task_posts_insert" on public.task_posts
  for insert to authenticated
  with check (workspace_id = public.get_my_agency_user_id());

create policy "task_posts_delete" on public.task_posts
  for delete to authenticated
  using (workspace_id = public.get_my_agency_user_id());
