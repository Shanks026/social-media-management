
-- Fan out a comment_added notification on insert.
-- Recipients (minus the author): prior thread participants, @mentioned users,
-- and — for posts — the current version's creator.
create or replace function public.tg_notify_comment_added()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_recipients uuid[];
  v_owner      uuid;
  v_client_id  uuid;
  v_link       text;
  v_title      text;
begin
  -- Prior participants on this entity
  v_recipients := array(
    select distinct c.author_user_id
    from public.comments c
    where c.entity_type = new.entity_type
      and c.entity_id = new.entity_id
      and c.deleted_at is null
  );

  -- Mentioned users
  v_recipients := v_recipients || coalesce(new.mentioned_uids, '{}');

  -- Entity-specific: post owner + navigation link
  if new.entity_type = 'post' then
    select pv.created_by, p.client_id
      into v_owner, v_client_id
    from public.posts p
    join public.post_versions pv on pv.id = p.current_version_id
    where p.id = new.entity_id;

    if v_owner is not null then
      v_recipients := v_recipients || array[v_owner];
    end if;

    v_link  := '/clients/' || v_client_id || '/posts/' || new.entity_id;
    v_title := 'New comment on a deliverable';
  else
    v_link  := '/campaigns/' || new.entity_id;
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
$$;

drop trigger if exists trg_notify_comment_added on public.comments;
create trigger trg_notify_comment_added
  after insert on public.comments
  for each row execute function public.tg_notify_comment_added();
;
