-- Mentioning someone on a task comment gives them access to that task.
--
-- Tasks are restricted by default (creator, current assignee, past assignees,
-- admins). Mentions were not: the composer offered every workspace member, so
-- you could @ someone, they would get a notification carrying a snippet of the
-- comment, click it, and land on "You don't have access to this task".
--
-- The fix is Slack-shaped: being pulled into the conversation is what grants
-- access, and it is transitive — anyone who can see a task can bring someone
-- in, and that person can then do the same. Restricted by default, openable by
-- any participant. Access is never revoked once granted.
--
-- Participation is its own activity type rather than reusing 'assigned'.
-- Reusing it would have been a one-word change to is_task_participant, but the
-- Activity feed reads these rows and would then claim "X assigned this to Y"
-- for something that was never an assignment.
alter table public.task_activity drop constraint if exists task_activity_type_check;
alter table public.task_activity add constraint task_activity_type_check
  check (type = any (array['assigned'::text, 'status_changed'::text, 'participant_added'::text]));

create or replace function public.is_task_participant(p_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from task_activity ta
    where ta.task_id = p_task_id
      and ta.type in ('assigned', 'participant_added')
      and ta.to_user_id = auth.uid()
  );
$function$;

-- Server-side so it cannot be skipped. Doing this in the client would leave
-- any comment posted by another path reproducing the same dead end.
--
-- No permission check is needed on the actor: the comments INSERT policy
-- already requires the task to be visible to the author (its EXISTS runs under
-- tasks_select), so only someone who can see a task can ever reach here.
create or replace function public.tg_comment_adds_task_participants()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_uid uuid;
begin
  if new.entity_type <> 'task' then
    return new;
  end if;
  -- array_length is null (not 0) for an empty array.
  if new.mentioned_uids is null or array_length(new.mentioned_uids, 1) is null then
    return new;
  end if;

  foreach v_uid in array new.mentioned_uids loop
    -- Skip anyone who already has access by any route, so the feed does not
    -- fill up with redundant "added as participant" lines for the assignee.
    if exists (
         select 1 from public.agency_members am
         where am.agency_user_id = new.workspace_id
           and am.member_user_id = v_uid
           and am.is_active
       )
       and not exists (
         select 1 from public.task_activity ta
         where ta.task_id = new.entity_id
           and ta.type in ('assigned', 'participant_added')
           and ta.to_user_id = v_uid
       )
       and not exists (
         select 1 from public.tasks t
         where t.id = new.entity_id
           and (t.created_by = v_uid or t.assigned_to = v_uid)
       )
    then
      insert into public.task_activity (workspace_id, task_id, type, actor_user_id, to_user_id)
      values (new.workspace_id, new.entity_id, 'participant_added', new.author_user_id, v_uid);
    end if;
  end loop;

  return new;
end;
$function$;

revoke all on function public.tg_comment_adds_task_participants() from public;
revoke all on function public.tg_comment_adds_task_participants() from anon;
revoke all on function public.tg_comment_adds_task_participants() from authenticated;

drop trigger if exists tg_comment_adds_task_participants on public.comments;
create trigger tg_comment_adds_task_participants
after insert on public.comments
for each row execute function public.tg_comment_adds_task_participants();;
