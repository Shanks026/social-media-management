create table if not exists public.chat_debug_log (id serial primary key, msg text, created_at timestamptz default now());
grant all on public.chat_debug_log to authenticated;
grant all on public.chat_debug_log_id_seq to authenticated;

create or replace function public.tg_notify_chat_message()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_channel_type text;
  v_recipients uuid[];
begin
  insert into public.chat_debug_log(msg) values ('fired channel_id=' || new.channel_id || ' author=' || new.author_user_id);

  select type into v_channel_type from public.chat_channels where id = new.channel_id;
  insert into public.chat_debug_log(msg) values ('channel_type=' || coalesce(v_channel_type, 'NULL'));

  if v_channel_type = 'dm' then
    v_recipients := array(
      select m.user_id from public.chat_channel_members m
      where m.channel_id = new.channel_id and m.user_id <> new.author_user_id
    );
    insert into public.chat_debug_log(msg) values ('recipients=' || coalesce(array_to_string(v_recipients, ','), 'EMPTY'));

    perform public.emit_notifications(
      new.workspace_id, new.author_user_id, v_recipients,
      'chat_dm', 'New message', left(new.body, 140),
      'chat_channel', new.channel_id, '/chat'
    );
    insert into public.chat_debug_log(msg) values ('emit called ok');
  else
    if new.mentioned_uids is not null and array_length(new.mentioned_uids, 1) > 0 then
      perform public.emit_notifications(
        new.workspace_id, new.author_user_id, new.mentioned_uids,
        'chat_mention', 'You were mentioned in team chat', left(new.body, 140),
        'chat_channel', new.channel_id, '/chat'
      );
    end if;
  end if;

  return new;
exception when others then
  insert into public.chat_debug_log(msg) values ('EXCEPTION: ' || sqlerrm);
  raise;
end;
$$;;
