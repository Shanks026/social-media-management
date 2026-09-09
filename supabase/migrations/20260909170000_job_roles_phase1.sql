-- Feature 10, Phase 1: owner-defined job titles, many per member.
--
-- Replaces the hardcoded AGENCY_ROLE_GROUPS list with a per-workspace table.
-- Job roles are IDENTIFICATION ONLY and never affect access — all permissions
-- continue to come from system_role and the permissions JSONB. That is the
-- locked decision in 03-rbac-team-roles.md, and it matters more now the list is
-- user-defined: a badly-named job role must be cosmetic, never a vulnerability.
--
-- Shape follows note_tags / note_tag_links exactly.

-- ─── Definitions ────────────────────────────────────────────────────────────
create table if not exists public.agency_job_roles (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  name         text not null,
  color        text not null default 'slate',
  created_at   timestamptz not null default now()
);

-- The point of a curated list is that "Designer" and "designer" aren't two roles.
create unique index if not exists agency_job_roles_workspace_name_key
  on public.agency_job_roles (workspace_id, lower(name));

-- ─── Links ──────────────────────────────────────────────────────────────────
-- Stores member_user_id directly rather than agency_members.id: every display
-- site keys off member_user_id via memberMap, so this saves a join per render.
create table if not exists public.agency_member_job_roles (
  workspace_id   uuid not null,
  member_user_id uuid not null,
  job_role_id    uuid not null references public.agency_job_roles(id) on delete cascade,
  created_at     timestamptz not null default now(),
  primary key (workspace_id, member_user_id, job_role_id)
);

create index if not exists agency_member_job_roles_member_idx
  on public.agency_member_job_roles (workspace_id, member_user_id);

-- ─── RLS: read workspace-wide, write owner-only ─────────────────────────────
-- Read is not gated on is_workspace_admin() because every user must see their
-- own titles in Settings, which already requires a member to read both tables.
-- Once a member can read their own row there is no case for hiding a
-- colleague's: a job title is a label, not a secret, and members can already
-- see the full roster including everyone's system_role badge on /team. Hiding
-- the cosmetic axis while showing the privileged one would be backwards.
-- What is hidden from members is the management UI, not the data.
alter table public.agency_job_roles enable row level security;

drop policy if exists "agency_job_roles_select_workspace" on public.agency_job_roles;
create policy "agency_job_roles_select_workspace" on public.agency_job_roles for select using (
  workspace_id = get_my_agency_user_id()
);

drop policy if exists "agency_job_roles_write_owner" on public.agency_job_roles;
create policy "agency_job_roles_write_owner" on public.agency_job_roles for all using (
  workspace_id = get_my_agency_user_id() and is_workspace_owner()
) with check (
  workspace_id = get_my_agency_user_id() and is_workspace_owner()
);

alter table public.agency_member_job_roles enable row level security;

drop policy if exists "agency_member_job_roles_select_workspace" on public.agency_member_job_roles;
create policy "agency_member_job_roles_select_workspace" on public.agency_member_job_roles for select using (
  workspace_id = get_my_agency_user_id()
);

drop policy if exists "agency_member_job_roles_write_owner" on public.agency_member_job_roles;
create policy "agency_member_job_roles_write_owner" on public.agency_member_job_roles for all using (
  workspace_id = get_my_agency_user_id() and is_workspace_owner()
) with check (
  workspace_id = get_my_agency_user_id() and is_workspace_owner()
);

-- ─── Seed from what each workspace already uses ─────────────────────────────
-- Only titles actually in use, so nobody loses the title they have and no
-- workspace inherits 19 irrelevant defaults. Colors spread across the shared
-- TAG_COLORS palette deterministically; the owner can recolor afterwards.
insert into public.agency_job_roles (workspace_id, name, color)
select t.agency_user_id, t.name,
       (array['slate','red','orange','amber','green','teal','blue','indigo','violet','pink'])[
         (row_number() over (partition by t.agency_user_id order by t.name) - 1) % 10 + 1]
from (
  select distinct m.agency_user_id, trim(m.functional_role) as name
  from public.agency_members m
  where m.functional_role is not null and trim(m.functional_role) <> ''
) t
on conflict do nothing;

insert into public.agency_member_job_roles (workspace_id, member_user_id, job_role_id)
select m.agency_user_id, m.member_user_id, r.id
from public.agency_members m
join public.agency_job_roles r
  on r.workspace_id = m.agency_user_id
 and lower(r.name) = lower(trim(m.functional_role))
where m.functional_role is not null and trim(m.functional_role) <> ''
on conflict do nothing;

-- ─── Assignment RPC ─────────────────────────────────────────────────────────
-- Deliberately separate from update_member_access: "change what someone is
-- called" and "change what someone can do" stay separately auditable, and this
-- avoids widening the surface of the function that sets system_role.
create or replace function public.set_member_job_roles(
  p_member_user_id uuid, p_job_role_ids uuid[])
returns void language plpgsql security definer set search_path = public as $$
declare v_workspace uuid := public.get_my_agency_user_id();
begin
  if not public.is_workspace_owner() then
    raise exception 'Only the workspace owner can assign job roles';
  end if;

  if not exists (
    select 1 from agency_members
    where agency_user_id = v_workspace and member_user_id = p_member_user_id
  ) then
    raise exception 'Member not found';
  end if;

  -- Every id must belong to this workspace: stops a crafted request linking a
  -- member to another agency's role row.
  if exists (
    select 1 from unnest(coalesce(p_job_role_ids, '{}'::uuid[])) as rid
    where not exists (
      select 1 from agency_job_roles r where r.id = rid and r.workspace_id = v_workspace
    )
  ) then
    raise exception 'Unknown job role for this workspace';
  end if;

  delete from agency_member_job_roles
  where workspace_id = v_workspace and member_user_id = p_member_user_id
    and job_role_id <> all (coalesce(p_job_role_ids, '{}'::uuid[]));

  insert into agency_member_job_roles (workspace_id, member_user_id, job_role_id)
  select v_workspace, p_member_user_id, rid
  from unnest(coalesce(p_job_role_ids, '{}'::uuid[])) as rid
  on conflict do nothing;

  -- Keep the legacy column in step for the length of Phase 1. All four display
  -- sites still read agency_members.functional_role, so without this a title
  -- assigned here would never appear in Settings, on the team table, or in the
  -- TaskWatchers card until Phase 2 — the feature would look broken for a whole
  -- phase. Holds the alphabetically-first title, so it is *a* correct title,
  -- just not all of them. Phase 2 drops both this sync and the column.
  update agency_members m
  set functional_role = (
    select r.name from agency_member_job_roles l
    join agency_job_roles r on r.id = l.job_role_id
    where l.workspace_id = v_workspace and l.member_user_id = p_member_user_id
    order by r.name limit 1
  )
  where m.agency_user_id = v_workspace and m.member_user_id = p_member_user_id;
end $$;

revoke execute on function public.set_member_job_roles(uuid, uuid[]) from public, anon;
grant execute on function public.set_member_job_roles(uuid, uuid[]) to authenticated;

-- ─── Cleanup ────────────────────────────────────────────────────────────────
-- Two overloads of update_member_access exist. PostgREST resolves by named
-- argument, so the 5-arg version always wins and the 4-arg one is dead code
-- that will silently diverge from it.
drop function if exists public.update_member_access(uuid, text, jsonb, text);
