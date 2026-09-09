
alter table public.tasks
  add column post_id uuid references public.posts(id) on delete set null;
;
