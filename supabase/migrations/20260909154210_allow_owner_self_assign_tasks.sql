-- Let the owner (and superadmin) self-assign a task.
--
-- enforce_task_assignment (feature 09, Phase 1) unconditionally blocked any
-- assignment where the target is owner/superadmin — including the owner
-- assigning a task to themselves. That rule exists to stop an admin routing
-- work onto the owner without consent ("Owner runs the company, Admin runs
-- the work"); it was never meant to stop the owner tracking their own to-dos,
-- and there was no way for them to do that at all.
--
-- Narrow fix: self-assignment (assigned_to = the caller's own uid) is always
-- allowed, regardless of role. Third-party assignment TO the owner/superadmin
-- by someone else stays exactly as blocked as before.
--
-- Verified in rolled-back transactions before applying:
--   owner self-assigns at creation           -> now allowed
--   owner reassign_task's an existing task
--     back to themselves                     -> now allowed
--   admin assigns a task TO the owner        -> still blocked
--   admin self-assigns (already worked)      -> unaffected
--   member reassign_task's to self           -> unaffected

create or replace function public.enforce_task_assignment()
returns trigger language plpgsql security definer set search_path = public as $$
declare target_role text;
begin
  if new.assigned_to is null
     or (tg_op = 'UPDATE' and new.assigned_to is not distinct from old.assigned_to) then
    return new;
  end if;

  -- Self-assignment is always allowed. auth.uid() is the real authenticated
  -- caller regardless of this function's SECURITY DEFINER context, so this
  -- cannot be spoofed by setting assigned_to to someone else's id.
  if new.assigned_to = auth.uid() then
    return new;
  end if;

  select system_role into target_role
  from agency_members
  where agency_user_id = new.workspace_id
    and member_user_id = new.assigned_to
    and is_active = true;

  if target_role is null then
    raise exception 'Assignee is not an active member of this workspace';
  end if;

  if target_role in ('owner','superadmin') then
    raise exception 'Tasks cannot be assigned to the workspace owner';
  end if;

  return new;
end $$;;
