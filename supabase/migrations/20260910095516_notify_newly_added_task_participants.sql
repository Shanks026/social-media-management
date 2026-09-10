-- Tell someone they were ADDED to a task, not just that a comment happened.
--
-- Being mentioned into a restricted task is a different event from a comment
-- on a task you already follow: it is the moment you gained access. "New
-- comment on a task" undersells that and reads as noise from a thread the
-- recipient has never seen.
--
-- Two fixes here:
--
-- 1. Newly-added participants are pulled out of the normal recipient list and
--    sent 'task_participant_added' instead, so they get exactly one
--    notification and it says what actually happened.
--
--    They are identified by the participant_added row that
--    tg_comment_adds_task_participants wrote for THIS comment. That trigger
--    runs first — Postgres fires triggers in name order and
--    tg_comment_adds... sorts before tg_notify_comment... — and both rows take
--    their created_at from now(), which is the transaction timestamp, so the
--    comparison is exact rather than a race.
--
-- 2. The past-participant sweep matched only type = 'assigned', so anyone
--    added as a participant would never have heard about subsequent comments
--    on the task they had just been given access to.
create or replace function public.tg_notify_comment_added()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_recipients       uuid[];
  v_new_participants uuid[];
  v_owner            uuid;
  v_assignee         uuid;
  v_client_id        uuid;
  v_link             text;
  v_title            text;
begin
  v_recipients := array(
    select distinct c.author_user_id
    from public.comments c
    where c.entity_type = new.entity_type
      and c.entity_id = new.entity_id
      and c.deleted_at is null
  );

  v_recipients := v_recipients || coalesce(new.mentioned_uids, '{}');

  if new.entity_type = 'post' then
    select pv.created_by, p.client_id
      into v_owner, v_client_id
    from public.posts p
    join public.post_versions pv on pv.id = p.current_version_id
    where p.id = new.entity_id;

    if v_owner is not null then
      v_recipients := v_recipients || array[v_owner];
    end if;

    v_link  := '/clients/' || v_client_id || '/posts/' || new.entity_id
               || '?comment=' || new.id;
    v_title := 'New comment on a deliverable';

  elsif new.entity_type = 'task' then
    -- Creator + current assignee + everyone ever assigned OR added as a
    -- participant: the same watcher set tg_notify_task_changes fans out to.
    -- SECURITY DEFINER, so these reads see the whole set rather than the
    -- commenter's RLS-visible slice. emit_notifications drops nulls, de-dupes
    -- and strips the actor, so overlap is harmless.
    select t.created_by, t.assigned_to
      into v_owner, v_assignee
    from public.tasks t
    where t.id = new.entity_id;

    v_recipients := v_recipients
      || array[v_owner, v_assignee]
      || array(
           select distinct ta.to_user_id
           from public.task_activity ta
           where ta.task_id = new.entity_id
             and ta.type in ('assigned', 'participant_added')
             and ta.to_user_id is not null
         );

    v_link  := '/tasks/' || new.entity_id || '?comment=' || new.id;
    v_title := 'New comment on a task';

    v_new_participants := array(
      select ta.to_user_id
      from public.task_activity ta
      where ta.task_id = new.entity_id
        and ta.type = 'participant_added'
        and ta.actor_user_id = new.author_user_id
        and ta.created_at >= new.created_at
        and ta.to_user_id = any(coalesce(new.mentioned_uids, '{}'))
    );

    if array_length(v_new_participants, 1) is not null then
      v_recipients := array(
        select unnest(v_recipients)
        except
        select unnest(v_new_participants)
      );

      perform public.emit_notifications(
        new.workspace_id,
        new.author_user_id,
        v_new_participants,
        'task_participant_added',
        'You were added to a task',
        left(new.body, 140),
        new.entity_type,
        new.entity_id,
        v_link
      );
    end if;

  else
    v_link  := '/campaigns/' || new.entity_id || '?comment=' || new.id;
    v_title := 'New comment on a campaign';
  end if;

  perform public.emit_notifications(
    new.workspace_id,
    new.author_user_id,
    v_recipients,
    'comment_added',
    v_title,
    left(new.body, 140),
    new.entity_type,
    new.entity_id,
    v_link
  );

  return new;
end;
$function$;;
