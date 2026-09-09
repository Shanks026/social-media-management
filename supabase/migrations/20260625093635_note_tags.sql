-- Dynamic tag definitions, workspace-scoped.
create table public.note_tags (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null,
  color      text not null default 'slate',
  created_at timestamptz not null default now()
);

-- One tag name per workspace (case-insensitive).
create unique index note_tags_user_name_unique
  on public.note_tags (user_id, lower(name));

-- Note <-> tag junction.
create table public.note_tag_links (
  note_id uuid not null references public.notes (id) on delete cascade,
  tag_id  uuid not null references public.note_tags (id) on delete cascade,
  primary key (note_id, tag_id)
);

-- Filter-by-tag lookups (note_id is already the PK's leading column).
create index note_tag_links_tag_id_idx on public.note_tag_links (tag_id);

-- RLS
alter table public.note_tags enable row level security;
alter table public.note_tag_links enable row level security;

create policy note_tags_workspace_scoped on public.note_tags
  for all
  using (user_id = get_my_agency_user_id())
  with check (user_id = get_my_agency_user_id());

-- Junction has no user_id; scope through the parent note.
create policy note_tag_links_workspace_scoped on public.note_tag_links
  for all
  using (
    exists (
      select 1 from public.notes n
      where n.id = note_id and n.user_id = get_my_agency_user_id()
    )
  )
  with check (
    exists (
      select 1 from public.notes n
      where n.id = note_id and n.user_id = get_my_agency_user_id()
    )
  );;
