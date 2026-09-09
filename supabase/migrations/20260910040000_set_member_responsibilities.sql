-- Let the owner maintain their own descriptive details.
--
-- update_member_access refuses the owner row outright ("The owner row cannot be
-- modified"), which is correct and stays: it is what stops the owner's
-- system_role or permissions being changed, by themselves or anyone else.
--
-- But roles_and_responsibilities is not access. It is a note about what someone
-- does, and an owner had no way to write one for themselves — their row was the
-- only one in the workspace with no editable description at all.
--
-- So it gets its own narrow RPC, exactly as job roles did with
-- set_member_job_roles (which already permits the owner's self-row, since the
-- owner is an ordinary member of agency_members). Same reasoning as before:
-- "what someone is called and does" and "what someone can do" stay separate,
-- separately-auditable operations. Nothing here can touch access, so the
-- owner-row protection in update_member_access is untouched and still total.

create or replace function public.set_member_responsibilities(
  p_member_user_id uuid, p_text text)
returns void language plpgsql security definer set search_path = public as $$
declare v_workspace uuid := public.get_my_agency_user_id();
begin
  if not public.is_workspace_owner() then
    raise exception 'Only the workspace owner can edit responsibilities';
  end if;

  if not exists (
    select 1 from agency_members
    where agency_user_id = v_workspace and member_user_id = p_member_user_id
  ) then
    raise exception 'Member not found';
  end if;

  update agency_members
  set roles_and_responsibilities = nullif(trim(coalesce(p_text, '')), '')
  where agency_user_id = v_workspace and member_user_id = p_member_user_id;
end $$;

revoke execute on function public.set_member_responsibilities(uuid, text) from public, anon;
grant execute on function public.set_member_responsibilities(uuid, text) to authenticated;
