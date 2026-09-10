
alter table public.proposals
  drop constraint proposals_agency_user_id_fkey,
  add constraint proposals_agency_user_id_fkey
    foreign key (agency_user_id) references auth.users(id) on delete cascade;
;
