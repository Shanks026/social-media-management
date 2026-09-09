alter table public.notes
  add column created_by      uuid references auth.users(id) on delete set null,
  add column created_by_name text,
  add column created_by_avatar text;;
