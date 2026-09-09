
create table public.comment_reactions (
  id          uuid primary key default gen_random_uuid(),
  comment_id  uuid not null references public.comments(id) on delete cascade,
  user_id     uuid not null,
  emoji       text not null check (emoji in ('👍','👎','❤️','😂','😮','😢','🎉','🙌','🔥','👀','✅','🤔')),
  created_at  timestamptz not null default now(),
  unique (comment_id, user_id, emoji)
);

create index comment_reactions_comment_idx on public.comment_reactions (comment_id);

alter table public.comment_reactions enable row level security;

create policy "comment_reactions: workspace member can select"
  on public.comment_reactions for select to authenticated
  using (
    exists (
      select 1 from public.comments c
      where c.id = comment_reactions.comment_id
        and c.workspace_id = get_my_agency_user_id()
    )
  );

create policy "comment_reactions: user can insert own"
  on public.comment_reactions for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.comments c
      where c.id = comment_reactions.comment_id
        and c.workspace_id = get_my_agency_user_id()
    )
  );

create policy "comment_reactions: user can delete own"
  on public.comment_reactions for delete to authenticated
  using (user_id = auth.uid());

alter publication supabase_realtime add table public.comment_reactions;
;
