
create table admin_prospect_activity (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references admin_prospects(id) on delete cascade,
  type text not null default 'status_change',
  from_status text,
  to_status text,
  note text,
  created_at timestamptz not null default now()
);

create index on admin_prospect_activity (prospect_id, created_at desc);
;
