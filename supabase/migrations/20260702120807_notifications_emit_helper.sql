
create or replace function public.emit_notifications(
  p_workspace_id uuid,
  p_actor        uuid,
  p_recipients   uuid[],
  p_type         text,
  p_title        text,
  p_body         text default null,
  p_entity_type  text default null,
  p_entity_id    uuid default null,
  p_link         text default null
) returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  insert into public.notifications
    (workspace_id, recipient_user_id, actor_user_id, type, title, body,
     entity_type, entity_id, link)
  select distinct
    p_workspace_id, r, p_actor, p_type, p_title, p_body,
    p_entity_type, p_entity_id, p_link
  from unnest(p_recipients) as r
  where r is not null
    and r is distinct from p_actor;
end;
$$;

create or replace function public.workspace_admin_uids(p_workspace_id uuid)
returns uuid[]
language sql
security definer
set search_path to 'public'
stable
as $$
  select coalesce(array_agg(distinct member_user_id), '{}'::uuid[]) || p_workspace_id
  from public.agency_members
  where agency_user_id = p_workspace_id
    and is_active = true
    and system_role in ('owner', 'admin', 'superadmin');
$$;
;
