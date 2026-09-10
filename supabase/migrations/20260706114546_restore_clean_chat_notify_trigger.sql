-- Restore tg_notify_chat_message to the clean Phase 1 version (drop the
-- temporary debug logging/exception handler used to diagnose a false-alarm
-- test failure — the trigger itself was correct all along).
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
  select type into v_channel_type from public.chat_channels where id = new.channel_id;

  if v_channel_type = 'dm' then
    v_recipients := array(
      select m.user_id from public.chat_channel_members m
      where m.channel_id = new.channel_id and m.user_id <> new.author_user_id
    );

    perform public.emit_notifications(
      new.workspace_id, new.author_user_id, v_recipients,
      'chat_dm', 'New message', left(new.body, 140),
      'chat_channel', new.channel_id, '/chat'
    );
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
end;
$$;

revoke execute on function public.tg_notify_chat_message() from public, anon, authenticated;

drop table if exists public.chat_debug_log;

-- Remove the test artifacts committed while diagnosing (real DM channel +
-- message + notification created between Ryan and Claire during testing).
delete from public.chat_channels
where id in (
  select distinct channel_id from public.chat_messages where body like 'DM debug message%'
);;
