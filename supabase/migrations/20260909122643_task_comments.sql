-- Phase 3 (09-task-collaboration): comments on tasks.
--
-- Security-critical: `comments` today lets every workspace member both read AND
-- write every comment, because neither policy is entity-aware. Tasks are
-- narrower than posts and campaigns — creator / assignee / past participant /
-- admin, per the tasks_select widened in Phase 1 — so both policies have to
-- learn about entity_type together. Fixing only SELECT would leave a
-- non-participant able to post into a thread they cannot read.

alter table public.comments drop constraint comments_entity_type_check;
alter table public.comments add constraint comments_entity_type_check
  check (entity_type in ('post', 'campaign', 'task'));

-- SELECT: task comments follow task visibility. The `exists` subquery is
-- evaluated under the caller's own rights, so tasks' RLS filters it — a task
-- the caller can't select simply isn't found, and its comments fall out with
-- it. post/campaign behaviour is unchanged.
drop policy "comments: workspace member can select" on public.comments;
create policy "comments: workspace member can select" on public.comments for select using (
  workspace_id = get_my_agency_user_id()
  and (
    entity_type <> 'task'
    or exists (select 1 from public.tasks t where t.id = entity_id)
  )
);

-- INSERT: the same scoping on the write side.
drop policy "comments: author can insert" on public.comments;
create policy "comments: author can insert" on public.comments for insert with check (
  workspace_id = get_my_agency_user_id()
  and author_user_id = auth.uid()
  and (
    entity_type <> 'task'
    or exists (select 1 from public.tasks t where t.id = entity_id)
  )
);

-- "comments: author can update" is deliberately left untouched: editing your
-- own comment needs no entity check, since you could only have authored it if
-- INSERT already let you through. Same reasoning covers soft_delete_comment().

-- Fan-out. The deployed function branched on 'post' vs. an unconditional else
-- that ASSUMED 'campaign' — a task comment would have fallen into it and
-- produced '/campaigns/<task_id>' with campaign-shaped copy. Making the branch
-- three-way is a bug fix, not an enhancement.
create or replace function public.tg_notify_comment_added()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_recipients uuid[];
  v_owner      uuid;
  v_assignee   uuid;
  v_client_id  uuid;
  v_link       text;
  v_title      text;
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
    -- Creator + current assignee + every past assignee: the same watcher set
    -- tg_notify_task_changes fans out to, so "who hears about this task" means
    -- one thing regardless of what happened to it. This function is SECURITY
    -- DEFINER, so these reads see the whole set rather than the commenter's own
    -- RLS-visible slice. emit_notifications drops nulls, de-dupes and strips
    -- the actor, so overlap with the thread participants and mentions already
    -- in v_recipients is harmless.
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
             and ta.type = 'assigned'
             and ta.to_user_id is not null
         );

    v_link  := '/tasks/' || new.entity_id || '?comment=' || new.id;
    v_title := 'New comment on a task';

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
